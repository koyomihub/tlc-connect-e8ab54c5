
-- Trigger to keep groups.members_count accurate
CREATE OR REPLACE FUNCTION public.sync_group_members_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.groups
      SET members_count = (SELECT COUNT(*) FROM public.group_members WHERE group_id = NEW.group_id)
      WHERE id = NEW.group_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.groups
      SET members_count = (SELECT COUNT(*) FROM public.group_members WHERE group_id = OLD.group_id)
      WHERE id = OLD.group_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_group_members_count ON public.group_members;
CREATE TRIGGER trg_sync_group_members_count
AFTER INSERT OR DELETE ON public.group_members
FOR EACH ROW EXECUTE FUNCTION public.sync_group_members_count();

-- One-time backfill to correct existing inaccurate counts
UPDATE public.groups g
SET members_count = COALESCE((SELECT COUNT(*) FROM public.group_members gm WHERE gm.group_id = g.id), 0);

-- Allow group admins to remove members from their group
CREATE POLICY "Admins can remove members"
ON public.group_members
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.group_members gm
    WHERE gm.group_id = group_members.group_id
      AND gm.user_id = auth.uid()
      AND gm.is_admin = true
  )
);
