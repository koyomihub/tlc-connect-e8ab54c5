-- Update posts SELECT policy to allow followers-only ("friends") posts visible to followers
DROP POLICY IF EXISTS "Public posts are viewable by everyone" ON public.posts;

CREATE POLICY "Posts visibility based on privacy"
ON public.posts
FOR SELECT
USING (
  is_hidden = false AND (
    privacy = 'public'::post_privacy
    OR (
      privacy = 'friends'::post_privacy
      AND auth.uid() IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.follows
        WHERE follows.follower_id = auth.uid()
          AND follows.following_id = posts.user_id
      )
    )
  )
);
