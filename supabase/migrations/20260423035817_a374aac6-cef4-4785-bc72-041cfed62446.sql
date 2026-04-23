DROP TRIGGER IF EXISTS on_group_member_change ON public.group_members;
DROP TRIGGER IF EXISTS trg_update_group_members_count ON public.group_members;

UPDATE public.groups g
SET members_count = COALESCE((SELECT COUNT(*) FROM public.group_members gm WHERE gm.group_id = g.id), 0);