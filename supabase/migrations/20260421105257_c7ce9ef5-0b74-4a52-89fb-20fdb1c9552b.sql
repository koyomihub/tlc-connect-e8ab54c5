DROP POLICY IF EXISTS "Posts visibility based on privacy" ON public.posts;
DROP POLICY IF EXISTS "Users can view their own posts" ON public.posts;

CREATE POLICY "Posts visibility based on privacy"
ON public.posts
FOR SELECT
USING (
  is_hidden = false AND (
    auth.uid() = user_id
    OR privacy = 'public'::post_privacy
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