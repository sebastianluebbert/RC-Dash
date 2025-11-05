-- Add username and password fields to proxmox_nodes table
ALTER TABLE public.proxmox_nodes 
ADD COLUMN IF NOT EXISTS username text NOT NULL DEFAULT 'root@pam',
ADD COLUMN IF NOT EXISTS password text NOT NULL DEFAULT '';

-- Update description
COMMENT ON TABLE public.proxmox_nodes IS 'Proxmox node configurations with credentials';