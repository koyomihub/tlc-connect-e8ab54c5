
-- Drop the existing permissive update policy
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- Create a trigger function that prevents client-side token_balance changes
CREATE OR REPLACE FUNCTION public.protect_token_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If the update is not coming from a service_role (i.e. from a regular user),
  -- preserve the old token_balance
  IF current_setting('request.jwt.claims', true)::json->>'role' != 'service_role' THEN
    NEW.token_balance := OLD.token_balance;
  END IF;
  RETURN NEW;
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS protect_token_balance_trigger ON public.profiles;
CREATE TRIGGER protect_token_balance_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_token_balance();

-- Re-create the update policy (same as before, the trigger handles column protection)
CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);
