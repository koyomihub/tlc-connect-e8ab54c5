
-- Fix mutable search_path on get_follower_count and get_following_count
CREATE OR REPLACE FUNCTION public.get_follower_count(profile_id uuid)
RETURNS bigint
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COUNT(*) FROM follows WHERE following_id = profile_id;
$$;

CREATE OR REPLACE FUNCTION public.get_following_count(profile_id uuid)
RETURNS bigint
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COUNT(*) FROM follows WHERE follower_id = profile_id;
$$;

-- Fix groups SELECT policy to hide private groups from non-members
DROP POLICY IF EXISTS "Groups are viewable by everyone" ON public.groups;

CREATE POLICY "Public groups are viewable by everyone"
ON public.groups
FOR SELECT
USING (
  privacy = 'public'
  OR creator_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_members.group_id = groups.id
    AND group_members.user_id = auth.uid()
  )
);

-- Remove token_transactions from realtime publication (sensitive financial data)
ALTER PUBLICATION supabase_realtime DROP TABLE public.token_transactions;

-- Remove notifications from realtime (user-specific, no channel policies)
ALTER PUBLICATION supabase_realtime DROP TABLE public.notifications;
