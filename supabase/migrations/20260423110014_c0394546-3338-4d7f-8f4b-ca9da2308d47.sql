
-- Function to check if user can post in a specific organization
CREATE OR REPLACE FUNCTION public.can_post_in_organization(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _org_name text;
  _required_roles app_role[];
BEGIN
  -- Admins can always post
  IF public.is_admin(_user_id) THEN
    RETURN true;
  END IF;

  SELECT name INTO _org_name FROM public.organizations WHERE id = _org_id;
  IF _org_name IS NULL THEN
    RETURN false;
  END IF;

  -- Map org name -> allowed org-specific roles
  IF _org_name = 'Computer Society' THEN
    _required_roles := ARRAY['officer_cs','teacher_cs']::app_role[];
  ELSIF _org_name = 'Future Educators Club' THEN
    _required_roles := ARRAY['officer_fec','teacher_fec']::app_role[];
  ELSIF _org_name = 'Young Businessman Club' THEN
    _required_roles := ARRAY['officer_ybc','teacher_ybc']::app_role[];
  ELSIF _org_name IN ('Student Council','The Student Council') THEN
    _required_roles := ARRAY['officer_sc','teacher_sc']::app_role[];
  ELSIF _org_name = 'The Lewisian' THEN
    _required_roles := ARRAY['officer_tl','teacher_tl']::app_role[];
  ELSIF _org_name = 'The Lewis College' THEN
    _required_roles := ARRAY['officer_tlc','teacher_tlc']::app_role[];
  ELSE
    -- Unknown org: fall back to generic teacher/officer roles
    _required_roles := ARRAY['officer','teacher']::app_role[];
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = ANY(_required_roles)
  );
END;
$$;

-- Replace the org_posts insert policy with one that enforces per-org role
DROP POLICY IF EXISTS "Teachers and officers can create org posts" ON public.organization_posts;

CREATE POLICY "Authorized users can create org posts"
ON public.organization_posts
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND public.can_post_in_organization(auth.uid(), organization_id)
);
