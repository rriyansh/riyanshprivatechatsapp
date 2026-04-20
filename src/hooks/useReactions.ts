import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type Reaction = {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
};

export const REACTION_EMOJIS = ["❤️", "😂", "😮", "😢", "🙏", "👍"];

/**
 * Loads reactions for the given list of message ids and keeps them in sync via realtime.
 * Returns a map: messageId → reactions[].
 */
export const useReactions = (messageIds: string[], partnerId?: string) => {
  const { user } = useAuth();
  const [byMessage, setByMessage] = useState<Record<string, Reaction[]>>({});

  const idsKey = messageIds.join(",");

  useEffect(() => {
    if (!user || messageIds.length === 0) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("message_reactions")
        .select("id, message_id, user_id, emoji")
        .in("message_id", messageIds);
      if (cancelled || error || !data) return;
      const grouped: Record<string, Reaction[]> = {};
      data.forEach((r) => {
        (grouped[r.message_id] ||= []).push(r as Reaction);
      });
      setByMessage(grouped);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, user?.id]);

  // Realtime sync (channel keyed per chat pair so we don't get cross-chat noise)
  useEffect(() => {
    if (!user || !partnerId) return;
    const channel = supabase
      .channel(`reactions:${[user.id, partnerId].sort().join(":")}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "message_reactions" },
        (payload) => {
          const r = payload.new as Reaction;
          setByMessage((prev) => {
            const arr = prev[r.message_id] || [];
            if (arr.some((x) => x.id === r.id)) return prev;
            return { ...prev, [r.message_id]: [...arr, r] };
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "message_reactions" },
        (payload) => {
          const r = payload.old as Reaction;
          setByMessage((prev) => {
            const arr = prev[r.message_id];
            if (!arr) return prev;
            return {
              ...prev,
              [r.message_id]: arr.filter((x) => x.id !== r.id),
            };
          });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, partnerId]);

  const toggle = useCallback(
    async (messageId: string, emoji: string) => {
      if (!user) return;
      const existing = (byMessage[messageId] || []).find(
        (r) => r.user_id === user.id && r.emoji === emoji
      );
      if (existing) {
        // optimistic remove
        setByMessage((prev) => ({
          ...prev,
          [messageId]: (prev[messageId] || []).filter((r) => r.id !== existing.id),
        }));
        await supabase.from("message_reactions").delete().eq("id", existing.id);
      } else {
        const tempId = `temp-${crypto.randomUUID()}`;
        setByMessage((prev) => ({
          ...prev,
          [messageId]: [
            ...(prev[messageId] || []),
            { id: tempId, message_id: messageId, user_id: user.id, emoji },
          ],
        }));
        const { data, error } = await supabase
          .from("message_reactions")
          .insert({ message_id: messageId, user_id: user.id, emoji })
          .select("id, message_id, user_id, emoji")
          .single();
        if (error || !data) {
          setByMessage((prev) => ({
            ...prev,
            [messageId]: (prev[messageId] || []).filter((r) => r.id !== tempId),
          }));
          return;
        }
        setByMessage((prev) => ({
          ...prev,
          [messageId]: (prev[messageId] || []).map((r) =>
            r.id === tempId ? (data as Reaction) : r
          ),
        }));
      }
    },
    [byMessage, user]
  );

  return { byMessage, toggle };
};
