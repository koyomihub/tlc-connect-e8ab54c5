CREATE POLICY "Users can update their own join requests"
ON public.group_join_requests
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);