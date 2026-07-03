import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type AudioState = "idle" | "connecting" | "live" | "muted" | "error";
type SignalPayload = {
  from: string;
  type: "offer" | "answer" | "ice" | "hangup";
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
};

function peerUserId(from: string): string {
  return from.split(":")[0] ?? from;
}

function waitForChannelReady(isReady: () => boolean, timeoutMs = 10_000): Promise<void> {
  return new Promise((resolve, reject) => {
    if (isReady()) return resolve();
    const started = Date.now();
    const tick = () => {
      if (isReady()) return resolve();
      if (Date.now() - started >= timeoutMs) return reject(new Error("signaling_timeout"));
      window.setTimeout(tick, 50);
    };
    tick();
  });
}

export function useStudyAudioCall(sessionId: string, userId: string | undefined) {
  const peerId = useMemo(() => {
    const rand =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2) + Date.now().toString(36);
    return `${userId ?? "anon"}:${rand}`;
  }, [userId]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const channelReadyRef = useRef(false);
  const makingOfferRef = useRef(false);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const localStreamRef = useRef<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [state, setState] = useState<AudioState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);

  const isPoliteToward = useCallback(
    (remoteFrom: string) => {
      if (!userId) return true;
      return userId < peerUserId(remoteFrom);
    },
    [userId],
  );

  const sendSignal = useCallback((payload: Omit<SignalPayload, "from">) => {
    if (!channelReadyRef.current) return;
    channelRef.current?.send({
      type: "broadcast",
      event: "signal",
      payload: { ...payload, from: peerId },
    });
  }, [peerId]);

  const flushPendingCandidates = useCallback(async (pc: RTCPeerConnection) => {
    if (!pc.remoteDescription) return;
    const pending = pendingCandidatesRef.current.splice(0);
    for (const candidate of pending) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch {
        // Non-fatal: a late or duplicate candidate should not tear down the call.
      }
    }
  }, []);

  const addIceCandidateSafe = useCallback(
    async (pc: RTCPeerConnection, candidate: RTCIceCandidateInit) => {
      if (!pc.remoteDescription) {
        pendingCandidatesRef.current.push(candidate);
        return;
      }
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch {
        // Ignore individual candidate failures during trickle ICE.
      }
    },
    [],
  );

  const ensurePeer = useCallback(async () => {
    if (pcRef.current) return pcRef.current;
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) sendSignal({ type: "ice", candidate: event.candidate.toJSON() });
    };
    pc.ontrack = (event) => {
      setRemoteStream(event.streams[0] ?? new MediaStream([event.track]));
      setState((s) => (s === "muted" ? "muted" : "live"));
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") setState((s) => (s === "muted" ? "muted" : "live"));
      if (pc.connectionState === "failed" || pc.connectionState === "disconnected")
        setState("error");
    };

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      pc.close();
      throw new Error("mic_unavailable");
    }

    let local: MediaStream;
    try {
      local = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    } catch (e) {
      pc.close();
      throw e;
    }

    localStreamRef.current = local;
    setLocalStream(local);
    for (const track of local.getAudioTracks()) pc.addTrack(track, local);
    pcRef.current = pc;
    return pc;
  }, [sendSignal]);

  const startCall = useCallback(async () => {
    try {
      setError(null);
      setState("connecting");
      await waitForChannelReady(() => channelReadyRef.current);
      const pc = await ensurePeer();
      if (pc.signalingState !== "stable") return;

      makingOfferRef.current = true;
      const offer = await pc.createOffer({ offerToReceiveAudio: true });
      await pc.setLocalDescription(offer);
      sendSignal({ type: "offer", sdp: offer });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setState("error");
    } finally {
      makingOfferRef.current = false;
    }
  }, [ensurePeer, sendSignal]);

  const hangUp = useCallback(() => {
    sendSignal({ type: "hangup" });
    pendingCandidatesRef.current = [];
    pcRef.current?.close();
    pcRef.current = null;
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
    setState("idle");
    setMuted(false);
  }, [sendSignal]);

  const toggleMute = useCallback(() => {
    const next = !muted;
    localStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = !next;
    });
    setMuted(next);
    setState(next ? "muted" : pcRef.current ? "live" : "idle");
  }, [muted]);

  useEffect(() => {
    channelReadyRef.current = false;
    const channel = supabase.channel(`chavruta-audio:${sessionId}`, {
      config: { broadcast: { self: false }, presence: { key: peerId }, private: true },
    });
    channelRef.current = channel;

    channel.on("broadcast", { event: "signal" }, async ({ payload }) => {
      const msg = payload as SignalPayload;
      if (!msg || msg.from === peerId) return;
      try {
        if (msg.type === "offer" && msg.sdp) {
          const polite = isPoliteToward(msg.from);
          const offerCollision =
            makingOfferRef.current || pcRef.current?.signalingState === "have-local-offer";
          if (offerCollision && !polite) return;

          setState("connecting");
          const pc = await ensurePeer();
          if (offerCollision && polite) {
            await pc.setLocalDescription({ type: "rollback" });
          }
          await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
          await flushPendingCandidates(pc);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          sendSignal({ type: "answer", sdp: answer });
        } else if (msg.type === "answer" && msg.sdp && pcRef.current) {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(msg.sdp));
          await flushPendingCandidates(pcRef.current);
        } else if (msg.type === "ice" && msg.candidate) {
          if (pcRef.current) {
            await addIceCandidateSafe(pcRef.current, msg.candidate);
          } else {
            pendingCandidatesRef.current.push(msg.candidate);
          }
        } else if (msg.type === "hangup") {
          pendingCandidatesRef.current = [];
          pcRef.current?.close();
          pcRef.current = null;
          localStreamRef.current?.getTracks().forEach((track) => track.stop());
          localStreamRef.current = null;
          setLocalStream(null);
          setRemoteStream(null);
          setState("idle");
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setState("error");
      }
    });

    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        channelReadyRef.current = true;
        await channel.track({ userId, peerId, online_at: new Date().toISOString() });
      }
    });

    return () => {
      channelReadyRef.current = false;
      supabase.removeChannel(channel);
      channelRef.current = null;
      pendingCandidatesRef.current = [];
      pcRef.current?.close();
      pcRef.current = null;
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
      setLocalStream(null);
      setRemoteStream(null);
    };
  }, [
    addIceCandidateSafe,
    ensurePeer,
    flushPendingCandidates,
    isPoliteToward,
    peerId,
    sendSignal,
    sessionId,
    userId,
  ]);

  return { state, error, muted, localStream, remoteStream, startCall, hangUp, toggleMute };
}
