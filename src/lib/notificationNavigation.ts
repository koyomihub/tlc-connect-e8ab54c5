import { supabase } from '@/integrations/supabase/client';

const getAdminGroupIds = async (userId: string) => {
  const { data } = await supabase
    .from('group_members')
    .select('group_id')
    .eq('user_id', userId)
    .eq('is_admin', true);

  return [...new Set((data || []).map((row) => row.group_id))];
};

const getGroupFromInvitation = async (currentUserId: string, actorId: string) => {
  const { data: pendingInvite } = await supabase
    .from('group_invitations')
    .select('group_id, created_at')
    .eq('invitee_id', currentUserId)
    .eq('inviter_id', actorId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (pendingInvite?.group_id) return pendingInvite.group_id;

  const { data: latestInvite } = await supabase
    .from('group_invitations')
    .select('group_id, created_at')
    .eq('invitee_id', currentUserId)
    .eq('inviter_id', actorId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return latestInvite?.group_id ?? null;
};

const getGroupFromAdminSideRequest = async (adminUserId: string, requesterId: string) => {
  const adminGroupIds = await getAdminGroupIds(adminUserId);
  if (adminGroupIds.length === 0) return null;

  const { data: pendingRequest } = await supabase
    .from('group_join_requests')
    .select('group_id, updated_at, created_at')
    .eq('user_id', requesterId)
    .eq('status', 'pending')
    .in('group_id', adminGroupIds)
    .order('updated_at', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (pendingRequest?.group_id) return pendingRequest.group_id;

  const { data: latestRequest } = await supabase
    .from('group_join_requests')
    .select('group_id, updated_at, created_at')
    .eq('user_id', requesterId)
    .in('group_id', adminGroupIds)
    .order('updated_at', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return latestRequest?.group_id ?? null;
};

const getGroupFromRequesterSideRequest = async (requesterId: string, actorId: string) => {
  const actorAdminGroupIds = await getAdminGroupIds(actorId);
  if (actorAdminGroupIds.length === 0) return null;

  const { data: latestRequest } = await supabase
    .from('group_join_requests')
    .select('group_id, updated_at, created_at')
    .eq('user_id', requesterId)
    .in('group_id', actorAdminGroupIds)
    .order('updated_at', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return latestRequest?.group_id ?? null;
};

export const resolveNotificationTarget = async (notification: any, currentUserId?: string | null) => {
  if (notification.type === 'follow' && notification.actor_id) {
    return `/profile/${notification.actor_id}`;
  }

  if (notification.post_id) {
    return `/posts/${notification.post_id}`;
  }

  if (notification.type === 'group_invite' && notification.actor_id && currentUserId) {
    const invitationGroupId = await getGroupFromInvitation(currentUserId, notification.actor_id);
    if (invitationGroupId) return `/groups/${invitationGroupId}`;

    const adminSideGroupId = await getGroupFromAdminSideRequest(currentUserId, notification.actor_id);
    if (adminSideGroupId) return `/groups/${adminSideGroupId}`;

    const requesterSideGroupId = await getGroupFromRequesterSideRequest(currentUserId, notification.actor_id);
    if (requesterSideGroupId) return `/groups/${requesterSideGroupId}`;
  }

  if (notification.actor_id) {
    return `/profile/${notification.actor_id}`;
  }

  return null;
};