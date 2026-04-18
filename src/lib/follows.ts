import { supabase } from "@/integrations/supabase/client";

export type FollowStatus = {
  isFollowing: boolean;
  isBlocked: boolean; // either direction
  iBlockedThem: boolean;
};

export const fetchFollowStatus = async (
  meId: string,
  otherId: string
): Promise<FollowStatus> => {
  const [{ data: follow }, { data: blocks }] = await Promise.all([
    supabase
      .from("follows")
      .select("id")
      .eq("follower_id", meId)
      .eq("followee_id", otherId)
      .maybeSingle(),
    supabase
      .from("blocks")
      .select("blocker_id, blocked_id")
      .or(
        `and(blocker_id.eq.${meId},blocked_id.eq.${otherId}),and(blocker_id.eq.${otherId},blocked_id.eq.${meId})`
      ),
  ]);

  const blockRows = blocks ?? [];
  const iBlockedThem = blockRows.some(
    (b) => b.blocker_id === meId && b.blocked_id === otherId
  );
  return {
    isFollowing: !!follow,
    isBlocked: blockRows.length > 0,
    iBlockedThem,
  };
};

export const follow = async (meId: string, otherId: string) => {
  const { error } = await supabase.from("follows").insert({
    follower_id: meId,
    followee_id: otherId,
  });
  if (error) throw error;
};

export const unfollow = async (meId: string, otherId: string) => {
  const { error } = await supabase
    .from("follows")
    .delete()
    .eq("follower_id", meId)
    .eq("followee_id", otherId);
  if (error) throw error;
};

export const blockUser = async (meId: string, otherId: string) => {
  const { error } = await supabase.from("blocks").insert({
    blocker_id: meId,
    blocked_id: otherId,
  });
  if (error) throw error;
};

export const unblockUser = async (meId: string, otherId: string) => {
  const { error } = await supabase
    .from("blocks")
    .delete()
    .eq("blocker_id", meId)
    .eq("blocked_id", otherId);
  if (error) throw error;
};
