import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface UnreadState {
  /** Set of group ids with unread messages (for joined groups only). */
  unreadGroupIds: Set<string>;
  /** Refresh unread state. */
  refresh: () => void;
  /** Mark a group as read (updates last_seen to now). */
  markAsRead: (groupId: string) => Promise<void>;
}

/**
 * Tracks unread group messages for groups the user has joined.
 * Compares last group_messages.created_at vs user's group_last_seen.
 */
export function useUnreadGroups(): UnreadState {
  const { user } = useAuth();
  const [unreadGroupIds, setUnreadGroupIds] = useState<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    if (!user) {
      setUnreadGroupIds(new Set());
      return;
    }

    // Get joined group ids
    const { data: memberData } = await supabase
      .from('group_members')
      .select('group_id')
      .eq('user_id', user.id);

    const joinedIds = (memberData || []).map((m) => m.group_id);
    if (joinedIds.length === 0) {
      setUnreadGroupIds(new Set());
      return;
    }

    // Get last_seen map
    const { data: seenData } = await supabase
      .from('group_last_seen')
      .select('group_id, last_seen_at')
      .eq('user_id', user.id)
      .in('group_id', joinedIds);

    const seenMap = new Map<string, string>(
      (seenData || []).map((s: any) => [s.group_id, s.last_seen_at]),
    );

    // Get latest message per joined group
    const { data: msgs } = await supabase
      .from('group_messages')
      .select('group_id, created_at, user_id')
      .in('group_id', joinedIds)
      .order('created_at', { ascending: false });

    const latestPerGroup = new Map<string, { created_at: string; user_id: string }>();
    for (const m of msgs || []) {
      if (!latestPerGroup.has(m.group_id)) {
        latestPerGroup.set(m.group_id, { created_at: m.created_at, user_id: m.user_id });
      }
    }

    const unread = new Set<string>();
    for (const [gid, latest] of latestPerGroup.entries()) {
      // Don't count own messages as unread
      if (latest.user_id === user.id) continue;
      const seen = seenMap.get(gid);
      if (!seen || new Date(latest.created_at) > new Date(seen)) {
        unread.add(gid);
      }
    }
    setUnreadGroupIds(unread);
  }, [user]);

  const markAsRead = useCallback(
    async (groupId: string) => {
      if (!user) return;
      const now = new Date().toISOString();
      await supabase
        .from('group_last_seen')
        .upsert(
          { user_id: user.id, group_id: groupId, last_seen_at: now } as any,
          { onConflict: 'user_id,group_id' },
        );
      setUnreadGroupIds((prev) => {
        if (!prev.has(groupId)) return prev;
        const next = new Set(prev);
        next.delete(groupId);
        return next;
      });
    },
    [user],
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Realtime: refresh on any new group message
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('unread-groups-watch')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'group_messages' },
        () => refresh(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'group_members', filter: `user_id=eq.${user.id}` },
        () => refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, refresh]);

  return { unreadGroupIds, refresh, markAsRead };
}
