import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

export function useStudyPresence(sessionId: string, userId: string | undefined) {
  const [partnerOnline, setPartnerOnline] = useState(false);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSentRef = useRef(0);

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
  }, [sessionId, userId]);

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

  return { partnerOnline, partnerTyping, notifyTyping, notifyTypingStop };
}
