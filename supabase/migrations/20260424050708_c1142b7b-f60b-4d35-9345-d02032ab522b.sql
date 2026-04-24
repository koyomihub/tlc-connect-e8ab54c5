
-- Add privacy column to reposts using existing post_privacy enum
ALTER TABLE public.reposts
  ADD COLUMN IF NOT EXISTS privacy public.post_privacy NOT NULL DEFAULT 'friends';

-- Replace the old "viewable by everyone" SELECT policy with privacy-aware one
DROP POLICY IF EXISTS "Reposts are viewable by everyone" ON public.reposts;

CREATE POLICY "Reposts visibility based on privacy"
  ON public.reposts
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR privacy = 'public'
    OR (
      privacy = 'friends'
      AND auth.uid() IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.follows
        WHERE follows.follower_id = auth.uid()
          AND follows.following_id = reposts.user_id
      )
    )
  );
