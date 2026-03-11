
DROP POLICY "Users can join groups" ON public.group_members;
CREATE POLICY "Users can join groups" ON public.group_members
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND is_admin = false);
