-- Fix customers table RLS policies - restrict to admin only
DROP POLICY IF EXISTS "Authenticated users can view customers" ON customers;
DROP POLICY IF EXISTS "Authenticated users can insert customers" ON customers;
DROP POLICY IF EXISTS "Authenticated users can update customers" ON customers;
DROP POLICY IF EXISTS "Authenticated users can delete customers" ON customers;

CREATE POLICY "Admins can view customers" ON customers
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert customers" ON customers
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update customers" ON customers
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete customers" ON customers
  FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

-- Update all edge functions to use encrypted credentials by dropping plaintext columns
-- First, ensure all is_encrypted flags are removed (no longer needed)
ALTER TABLE proxmox_nodes DROP COLUMN IF EXISTS is_encrypted;
ALTER TABLE plesk_servers DROP COLUMN IF EXISTS is_encrypted;
ALTER TABLE mailcow_servers DROP COLUMN IF EXISTS is_encrypted;
ALTER TABLE application_settings DROP COLUMN IF EXISTS is_encrypted;

-- Now drop the plaintext credential columns (code will use encrypted versions)
ALTER TABLE proxmox_nodes DROP COLUMN IF EXISTS password;
ALTER TABLE plesk_servers DROP COLUMN IF EXISTS password;
ALTER TABLE mailcow_servers DROP COLUMN IF EXISTS api_key;