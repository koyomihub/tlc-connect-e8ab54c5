-- Posts: admins can delete any
CREATE POLICY "Admins can delete any post"
ON public.posts
FOR DELETE
TO authenticated
USING (public.is_admin(auth.uid()));

-- Organization posts: admins can delete any
CREATE POLICY "Admins can delete any org post"
ON public.organization_posts
FOR DELETE
TO authenticated
USING (public.is_admin(auth.uid()));

-- Groups: admins can delete any
CREATE POLICY "Admins can delete any group"
ON public.groups
FOR DELETE
TO authenticated
USING (public.is_admin(auth.uid()));

-- Post comments: admins can delete any (so admin can moderate comments on posts they delete or otherwise)
CREATE POLICY "Admins can delete any comment"
ON public.post_comments
FOR DELETE
TO authenticated
USING (public.is_admin(auth.uid()));