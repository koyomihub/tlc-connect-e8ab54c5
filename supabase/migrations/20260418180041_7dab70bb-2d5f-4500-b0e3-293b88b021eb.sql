-- Change default to 0 so the trigger handles the creator's join correctly
ALTER TABLE public.groups ALTER COLUMN members_count SET DEFAULT 0;

-- Resync existing groups' members_count to match actual members
UPDATE public.groups g
SET members_count = COALESCE(sub.actual, 0)
FROM (
  SELECT group_id, COUNT(*)::int AS actual
  FROM public.group_members
  GROUP BY group_id
) sub
WHERE g.id = sub.group_id;

-- Set to 0 for groups with no members
UPDATE public.groups
SET members_count = 0
WHERE id NOT IN (SELECT DISTINCT group_id FROM public.group_members);