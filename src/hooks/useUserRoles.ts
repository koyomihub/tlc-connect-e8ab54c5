import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type AppRole =
  | 'admin' | 'student' | 'teacher' | 'officer'
  | 'officer_cs' | 'teacher_cs'
  | 'officer_fec' | 'teacher_fec'
  | 'officer_ybc' | 'teacher_ybc'
  | 'officer_sc' | 'teacher_sc'
  | 'officer_tl' | 'teacher_tl'
  | 'officer_tlc' | 'teacher_tlc';

export type RoleKind = 'officer' | 'instructor' | null;

export function classifyRoles(roles: AppRole[] | undefined | null): RoleKind {
  if (!roles || roles.length === 0) return null;
  // Instructor (teacher) takes precedence over Officer for display
  if (roles.some((r) => r === 'teacher' || r.startsWith('teacher_'))) return 'instructor';
  if (roles.some((r) => r === 'officer' || r.startsWith('officer_'))) return 'officer';
  return null;
}

// Simple in-memory cache + in-flight dedupe
const cache = new Map<string, AppRole[]>();
const inflight = new Map<string, Promise<AppRole[]>>();
const subscribers = new Map<string, Set<(roles: AppRole[]) => void>>();

async function fetchRoles(userId: string): Promise<AppRole[]> {
  if (cache.has(userId)) return cache.get(userId)!;
  if (inflight.has(userId)) return inflight.get(userId)!;
  const p = (async () => {
    const { data } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);
    const roles = (data || []).map((r: any) => r.role as AppRole);
    cache.set(userId, roles);
    inflight.delete(userId);
    subscribers.get(userId)?.forEach((cb) => cb(roles));
    return roles;
  })();
  inflight.set(userId, p);
  return p;
}

export function useUserRoles(userId?: string | null) {
  const [roles, setRoles] = useState<AppRole[]>(() =>
    userId && cache.has(userId) ? cache.get(userId)! : []
  );

  useEffect(() => {
    if (!userId) { setRoles([]); return; }
    let cancelled = false;
    if (cache.has(userId)) {
      setRoles(cache.get(userId)!);
    } else {
      fetchRoles(userId).then((r) => { if (!cancelled) setRoles(r); });
    }
    let set = subscribers.get(userId);
    if (!set) { set = new Set(); subscribers.set(userId, set); }
    const cb = (r: AppRole[]) => { if (!cancelled) setRoles(r); };
    set.add(cb);
    return () => { cancelled = true; set?.delete(cb); };
  }, [userId]);

  return roles;
}
