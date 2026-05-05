-- Recreate the trigger that maintains groups.members_count
DROP TRIGGER IF EXISTS trg_sync_group_members_count ON public.group_members;
DROP TRIGGER IF EXISTS trg_update_group_members_count ON public.group_members;
DROP TRIGGER IF EXISTS update_group_members_count ON public.group_members;

CREATE TRIGGER trg_sync_group_members_count
AFTER INSERT OR DELETE ON public.group_members
FOR EACH ROW EXECUTE FUNCTION public.sync_group_members_count();

-- Resync existing counts
UPDATE public.groups g
SET members_count = COALESCE((SELECT COUNT(*) FROM public.group_members gm WHERE gm.group_id = g.id), 0);

-- Recreate remove policy via SECURITY DEFINER helper to avoid RLS evaluation edge cases
CREATE OR REPLACE FUNCTION public.is_group_admin(_user_id uuid, _group_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = _group_id AND user_id = _user_id AND is_admin = true
  );
$$;

DROP POLICY IF EXISTS "Admins can remove members" ON public.group_members;
CREATE POLICY "Admins can remove members"
ON public.group_members
FOR DELETE
TO authenticated
USING (
  public.is_group_admin(auth.uid(), group_id)
  OR auth.uid() = user_id
  OR public.is_admin(auth.uid())
);