import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface UnreadOrgsState {
  unreadOrgIds: Set<string>;
  refresh: () => void;
  markAsRead: (orgId: string) => Promise<void>;
}

/**
 * Tracks orgs with new posts since the user last viewed them.
 * Applies to all organizations (any new org post triggers).
 */
export function useUnreadOrgs(): UnreadOrgsState {
  const { user } = useAuth();
  const [unreadOrgIds, setUnreadOrgIds] = useState<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    if (!user) {
      setUnreadOrgIds(new Set());
      return;
    }

    // Get all orgs
    const { data: orgs } = await supabase.from('organizations').select('id');
    const orgIds = (orgs || []).map((o: any) => o.id);
    if (orgIds.length === 0) {
      setUnreadOrgIds(new Set());
      return;
    }

    const { data: seenData } = await supabase
      .from('org_last_seen')
      .select('organization_id, last_seen_at')
      .eq('user_id', user.id);

    const seenMap = new Map<string, string>(
      (seenData || []).map((s: any) => [s.organization_id, s.last_seen_at]),
    );

    const { data: posts } = await supabase
      .from('organization_posts')
      .select('organization_id, created_at, user_id')
      .order('created_at', { ascending: false });

    const latestPerOrg = new Map<string, { created_at: string; user_id: string }>();
    for (const p of posts || []) {
      if (!latestPerOrg.has(p.organization_id)) {
        latestPerOrg.set(p.organization_id, { created_at: p.created_at, user_id: p.user_id });
      }
    }

    const unread = new Set<string>();
    for (const [oid, latest] of latestPerOrg.entries()) {
      if (latest.user_id === user.id) continue;
      const seen = seenMap.get(oid);
      if (!seen || new Date(latest.created_at) > new Date(seen)) {
        unread.add(oid);
      }
    }
    setUnreadOrgIds(unread);
  }, [user]);

  const markAsRead = useCallback(
    async (orgId: string) => {
      if (!user) return;
      const now = new Date().toISOString();
      await supabase
        .from('org_last_seen')
        .upsert(
          { user_id: user.id, organization_id: orgId, last_seen_at: now } as any,
          { onConflict: 'user_id,organization_id' },
        );
      setUnreadOrgIds((prev) => {
        if (!prev.has(orgId)) return prev;
        const next = new Set(prev);
        next.delete(orgId);
        return next;
      });
    },
    [user],
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('unread-orgs-watch')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'organization_posts' },
        () => refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, refresh]);

  return { unreadOrgIds, refresh, markAsRead };
}
