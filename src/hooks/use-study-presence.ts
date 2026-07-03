import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

export type LiveReaction = {
  id: string;
  emoji: string;
  fromSelf: boolean;
  at: number;
};

const MAX_LIVE_REACTIONS = 24;

export function useStudyPresence(sessionId: string, userId: string | undefined) {
  const [partnerOnline, setPartnerOnline] = useState(false);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [reactions, setReactions] = useState<LiveReaction[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSentRef = useRef(0);
  const lastReactionRef = useRef(0);

  const pushReaction = useCallback((emoji: string, fromSelf: boolean) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setReactions((prev) => [...prev.slice(-MAX_LIVE_REACTIONS + 1), { id, emoji, fromSelf, at: Date.now() }]);
    window.setTimeout(() => {
      setReactions((prev) => prev.filter((r) => r.id !== id));
    }, 2600);
  }, []);

  useEffect(() => {
    if (!userId || !sessionId) return;
    const channel = supabase.channel(`chavruta-presence:${sessionId}`, {
      config: { presence: { key: userId }, private: true },
    });
    channelRef.current = channel;

    const computePartnerOnline = () => {
      const state = channel.presenceState() as Record<string, unknown[]>;
      const others = Object.keys(state).filter((k) => k !== userId);
      setPartnerOnline(others.length > 0);
    };

    channel
      .on("presence", { event: "sync" }, computePartnerOnline)
      .on("presence", { event: "join" }, computePartnerOnline)
      .on("presence", { event: "leave" }, computePartnerOnline)
      .on("broadcast", { event: "typing" }, (payload) => {
        const from = (payload.payload as { userId?: string } | undefined)?.userId;
        if (!from || from === userId) return;
        setPartnerTyping(true);
        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
        typingTimerRef.current = setTimeout(() => setPartnerTyping(false), 2500);
      })
      .on("broadcast", { event: "typing_stop" }, (payload) => {
        const from = (payload.payload as { userId?: string } | undefined)?.userId;
        if (!from || from === userId) return;
        setPartnerTyping(false);
      })
      .on("broadcast", { event: "reaction" }, (payload) => {
        const body = payload.payload as { userId?: string; emoji?: string } | undefined;
        if (!body?.emoji || body.userId === userId) return;
        pushReaction(body.emoji, false);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ userId, online_at: new Date().toISOString() });
        }
      });

    return () => {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      channel.untrack().catch(() => undefined);
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [sessionId, userId, pushReaction]);

  const notifyTyping = useCallback(() => {
    const channel = channelRef.current;
    if (!channel || !userId) return;
    const now = Date.now();
    if (now - lastSentRef.current < 800) return;
    lastSentRef.current = now;
    channel
      .send({ type: "broadcast", event: "typing", payload: { userId } })
      .catch(() => undefined);
  }, [userId]);

  const notifyTypingStop = useCallback(() => {
    const channel = channelRef.current;
    if (!channel || !userId) return;
    lastSentRef.current = 0;
    channel
      .send({ type: "broadcast", event: "typing_stop", payload: { userId } })
      .catch(() => undefined);
  }, [userId]);

  const sendReaction = useCallback(
    (emoji: string) => {
      if (!userId) return;
      const now = Date.now();
      if (now - lastReactionRef.current < 350) return;
      lastReactionRef.current = now;
      pushReaction(emoji, true);
      channelRef.current
        ?.send({ type: "broadcast", event: "reaction", payload: { userId, emoji } })
        .catch(() => undefined);
    },
    [userId, pushReaction],
  );

  return { partnerOnline, partnerTyping, notifyTyping, notifyTypingStop, reactions, sendReaction };
}
