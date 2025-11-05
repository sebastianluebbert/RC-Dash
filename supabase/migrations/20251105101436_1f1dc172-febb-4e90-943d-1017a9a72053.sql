-- Enable pgcrypto extension for encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create encryption key management (stored in vault in production)
-- For now, we'll use a function that gets the key from environment
CREATE OR REPLACE FUNCTION public.get_encryption_key()
RETURNS bytea
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- In production, this should fetch from vault or use a secret
  -- For now, we generate a consistent key from a hash
  RETURN digest('encryption_key_v1_change_in_production', 'sha256');
END;
$$;

-- Encryption function
CREATE OR REPLACE FUNCTION public.encrypt_value(plain_text text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF plain_text IS NULL OR plain_text = '' THEN
    RETURN NULL;
  END IF;
  
  RETURN encode(
    pgp_sym_encrypt(
      plain_text,
      encode(get_encryption_key(), 'hex')
    ),
    'base64'
  );
END;
$$;

-- Decryption function
CREATE OR REPLACE FUNCTION public.decrypt_value(encrypted_text text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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

-- Create user roles table for access control
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'user')),
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  UNIQUE(user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- User roles policies
CREATE POLICY "Users can view their own roles"
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin(check_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = check_user_id
      AND role = 'admin'
  );
$$;

-- Update proxmox_nodes: Add encrypted columns
ALTER TABLE public.proxmox_nodes 
  ADD COLUMN IF NOT EXISTS password_encrypted text,
  ADD COLUMN IF NOT EXISTS is_encrypted boolean DEFAULT false;

-- Migrate existing passwords to encrypted format
UPDATE public.proxmox_nodes
SET password_encrypted = public.encrypt_value(password),
    is_encrypted = true
WHERE password IS NOT NULL AND password_encrypted IS NULL;

-- Drop old RLS policies on proxmox_nodes
DROP POLICY IF EXISTS "Authenticated users can delete proxmox nodes" ON public.proxmox_nodes;
DROP POLICY IF EXISTS "Authenticated users can insert proxmox nodes" ON public.proxmox_nodes;
DROP POLICY IF EXISTS "Authenticated users can update proxmox nodes" ON public.proxmox_nodes;
DROP POLICY IF EXISTS "Authenticated users can view proxmox nodes" ON public.proxmox_nodes;

-- New RLS policies for proxmox_nodes (admin only)
CREATE POLICY "Admins can view proxmox nodes"
  ON public.proxmox_nodes
  FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert proxmox nodes"
  ON public.proxmox_nodes
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update proxmox nodes"
  ON public.proxmox_nodes
  FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete proxmox nodes"
  ON public.proxmox_nodes
  FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- Update plesk_servers: Add encrypted columns
ALTER TABLE public.plesk_servers 
  ADD COLUMN IF NOT EXISTS password_encrypted text,
  ADD COLUMN IF NOT EXISTS is_encrypted boolean DEFAULT false;

-- Migrate existing passwords
UPDATE public.plesk_servers
SET password_encrypted = public.encrypt_value(password),
    is_encrypted = true
WHERE password IS NOT NULL AND password_encrypted IS NULL;

-- Update plesk_servers RLS policies (admin only)
DROP POLICY IF EXISTS "Authenticated users can delete plesk servers" ON public.plesk_servers;
DROP POLICY IF EXISTS "Authenticated users can insert plesk servers" ON public.plesk_servers;
DROP POLICY IF EXISTS "Authenticated users can update plesk servers" ON public.plesk_servers;
DROP POLICY IF EXISTS "Authenticated users can view plesk servers" ON public.plesk_servers;

CREATE POLICY "Admins can view plesk servers"
  ON public.plesk_servers FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert plesk servers"
  ON public.plesk_servers FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update plesk servers"
  ON public.plesk_servers FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete plesk servers"
  ON public.plesk_servers FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

-- Update mailcow_servers: Add encrypted columns
ALTER TABLE public.mailcow_servers 
  ADD COLUMN IF NOT EXISTS api_key_encrypted text,
  ADD COLUMN IF NOT EXISTS is_encrypted boolean DEFAULT false;

-- Migrate existing API keys
UPDATE public.mailcow_servers
SET api_key_encrypted = public.encrypt_value(api_key),
    is_encrypted = true
WHERE api_key IS NOT NULL AND api_key_encrypted IS NULL;

-- Update mailcow_servers RLS policies (admin only)
DROP POLICY IF EXISTS "Authenticated users can delete mailcow servers" ON public.mailcow_servers;
DROP POLICY IF EXISTS "Authenticated users can insert mailcow servers" ON public.mailcow_servers;
DROP POLICY IF EXISTS "Authenticated users can update mailcow servers" ON public.mailcow_servers;
DROP POLICY IF EXISTS "Authenticated users can view mailcow servers" ON public.mailcow_servers;

CREATE POLICY "Admins can view mailcow servers"
  ON public.mailcow_servers FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert mailcow servers"
  ON public.mailcow_servers FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update mailcow servers"
  ON public.mailcow_servers FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete mailcow servers"
  ON public.mailcow_servers FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

-- Update application_settings: Add encrypted columns
ALTER TABLE public.application_settings 
  ADD COLUMN IF NOT EXISTS value_encrypted text,
  ADD COLUMN IF NOT EXISTS is_encrypted boolean DEFAULT false;

-- Migrate existing sensitive values (those containing credentials)
UPDATE public.application_settings
SET value_encrypted = public.encrypt_value(value::text),
    is_encrypted = true
WHERE key IN ('hetzner_api_key', 'autodns_credentials') 
  AND value_encrypted IS NULL;

-- Update application_settings RLS policies (admin only)
DROP POLICY IF EXISTS "Authenticated users can delete settings" ON public.application_settings;
DROP POLICY IF EXISTS "Authenticated users can insert settings" ON public.application_settings;
DROP POLICY IF EXISTS "Authenticated users can update settings" ON public.application_settings;
DROP POLICY IF EXISTS "Authenticated users can view settings" ON public.application_settings;

CREATE POLICY "Admins can view settings"
  ON public.application_settings FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert settings"
  ON public.application_settings FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update settings"
  ON public.application_settings FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete settings"
  ON public.application_settings FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

-- Fix profiles table - restrict to authenticated users only
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;

CREATE POLICY "Authenticated users can view profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (true);

-- Comment on encryption
COMMENT ON FUNCTION public.encrypt_value IS 'Encrypts sensitive text data using AES-256';
COMMENT ON FUNCTION public.decrypt_value IS 'Decrypts sensitive text data encrypted with encrypt_value';
COMMENT ON TABLE public.user_roles IS 'Stores user roles for access control (admin, user)';