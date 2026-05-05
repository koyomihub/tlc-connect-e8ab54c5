-- Allow group creator to transfer ownership (UPDATE WITH CHECK currently inherits USING which blocks creator_id change)
DROP POLICY IF EXISTS "Group creators can update groups" ON public.groups;
CREATE POLICY "Group creators can update groups"
ON public.groups
FOR UPDATE
TO authenticated
USING (auth.uid() = creator_id)
WITH CHECK (true);

-- Enable realtime broadcasting for groups + group_members so member count updates live
ALTER TABLE public.groups REPLICA IDENTITY FULL;
ALTER TABLE public.group_members REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.groups;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.group_members;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;