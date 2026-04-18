DROP POLICY IF EXISTS "Users can join groups" ON public.group_members;

CREATE POLICY "Users can join groups"
ON public.group_members
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND (
    is_admin = false
    OR EXISTS (
      SELECT 1 FROM public.groups
      WHERE groups.id = group_members.group_id
      AND groups.creator_id = auth.uid()
    )
  )
);