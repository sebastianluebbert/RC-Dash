-- Fix decrypt_value() to require admin access
CREATE OR REPLACE FUNCTION public.decrypt_value(encrypted_text text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only admins can decrypt
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  
  IF encrypted_text IS NULL OR encrypted_text = '' THEN
    RETURN NULL;
  END IF;
  
  RETURN pgp_sym_decrypt(
    decode(encrypted_text, 'base64'),
    encode(get_encryption_key(), 'hex')
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$;

-- Fix servers table RLS policies - restrict to admin only
DROP POLICY IF EXISTS "Authenticated users can view servers" ON servers;
DROP POLICY IF EXISTS "Authenticated users can insert servers" ON servers;
DROP POLICY IF EXISTS "Authenticated users can update servers" ON servers;
DROP POLICY IF EXISTS "Authenticated users can delete servers" ON servers;

CREATE POLICY "Admins can view servers" ON servers
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert servers" ON servers
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update servers" ON servers
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete servers" ON servers
  FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

-- Fix profiles table RLS - users can only view their own profile
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON profiles;

CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles" ON profiles
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));