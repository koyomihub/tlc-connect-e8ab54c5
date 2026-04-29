import { createContext, useContext, useEffect, useRef, useState, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type PresenceStatus = 'online' | 'idle' | 'offline';
export type PresencePreference = 'auto' | 'idle' | 'invisible';

interface PresenceMap {
  [userId: string]: PresenceStatus;
}

interface PresenceContextValue {
  /** Map of online/idle users (offline users are simply absent). */
  presence: PresenceMap;
  /** Current user's stored preference. */
  preference: PresencePreference;
  /** Computed status for current user (what others see). */
  myStatus: PresenceStatus;
  /** Update preference (auto / idle / invisible). */
  setPreference: (pref: PresencePreference) => Promise<void>;
}

const PresenceContext = createContext<PresenceContextValue | undefined>(undefined);

const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const PRESENCE_CHANNEL = 'presence:online';

export function PresenceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [presence, setPresence] = useState<PresenceMap>({});
  const [preference, setPreferenceState] = useState<PresencePreference>('auto');
  const [activityTick, setActivityTick] = useState(0);
  const [isIdle, setIsIdle] = useState(false);
  const channelRef = useRef<any>(null);
  const lastActivityRef = useRef<number>(Date.now());

  // Compute my visible status from preference + idle detection
  const computeStatus = useCallback((): PresenceStatus => {
    if (!user) return 'offline';
    if (preference === 'invisible') return 'offline';
    if (preference === 'idle') return 'idle';
    return isIdle ? 'idle' : 'online';
  }, [user, preference, isIdle]);

  const myStatus = computeStatus();

  // Load preference from profile
  useEffect(() => {
    if (!user) {
      setPreferenceState('auto');
      return;
    }
    supabase
      .from('profiles')
      .select('presence_preference')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        const pref = (data?.presence_preference as PresencePreference) || 'auto';
        setPreferenceState(pref);
      });
  }, [user]);

  const setPreference = useCallback(
    async (pref: PresencePreference) => {
      if (!user) return;
      setPreferenceState(pref);
      // When user actively chooses, treat it as activity so 'auto' immediately
      // reads as online (not stuck on idle).
      lastActivityRef.current = Date.now();
      setIsIdle(false);
      await supabase.from('profiles').update({ presence_preference: pref } as any).eq('id', user.id);
    },
    [user],
  );

  // Activity listeners for idle detection
  useEffect(() => {
    if (!user) return;
    const onActivity = () => {
      lastActivityRef.current = Date.now();
      setActivityTick((t) => t + 1);
      if (isIdle) setIsIdle(false);
    };
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));

    const interval = setInterval(() => {
      const elapsed = Date.now() - lastActivityRef.current;
      if (elapsed >= IDLE_TIMEOUT_MS) {
        setIsIdle(true);
      }
    }, 30_000);

    return () => {
      events.forEach((e) => window.removeEventListener(e, onActivity));
      clearInterval(interval);
    };
  }, [user, isIdle]);

  // Realtime presence channel
  useEffect(() => {
    if (!user) {
      setPresence({});
      return;
    }

    const channel = supabase.channel(PRESENCE_CHANNEL, {
      config: { presence: { key: user.id } },
    });
    channelRef.current = channel;

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState() as Record<string, Array<{ status?: PresenceStatus }>>;
        const next: PresenceMap = {};
        for (const [uid, metas] of Object.entries(state)) {
          // Take the most recent meta's status; default online
          const status = (metas[metas.length - 1]?.status as PresenceStatus) || 'online';
          if (status !== 'offline') next[uid] = status;
        }
        setPresence(next);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          const initial = computeStatus();
          if (initial !== 'offline') {
            await channel.track({ status: initial, online_at: Date.now() });
          }
        }
      });

    return () => {
      try { channel.untrack(); } catch {}
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [user]); // intentionally only on user change

  // Re-track when status changes — always untrack first so rapid back-to-back
  // changes (e.g. auto → invisible → auto) reliably re-broadcast.
  useEffect(() => {
    const ch = channelRef.current;
    if (!ch || !user) return;
    let cancelled = false;
    (async () => {
      try { await ch.untrack(); } catch {}
      if (cancelled) return;
      if (myStatus !== 'offline') {
        try { await ch.track({ status: myStatus, online_at: Date.now() }); } catch {}
      }
    })();
    return () => { cancelled = true; };
  }, [myStatus, user]);

  return (
    <PresenceContext.Provider value={{ presence, preference, myStatus, setPreference }}>
      {children}
    </PresenceContext.Provider>
  );
}

export function usePresence() {
  const ctx = useContext(PresenceContext);
  if (!ctx) throw new Error('usePresence must be used within PresenceProvider');
  return ctx;
}

/** Helper to get status for any user id */
export function useUserPresence(userId?: string | null): PresenceStatus {
  const { presence } = usePresence();
  if (!userId) return 'offline';
  return presence[userId] || 'offline';
}
