
-- Migration: 20251104171228
-- Create servers table for tracking Proxmox resources
CREATE TABLE public.servers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vmid INTEGER NOT NULL,
  name TEXT NOT NULL,
  node TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('qemu', 'lxc')),
  status TEXT NOT NULL,
  cpu_usage NUMERIC,
  memory_usage NUMERIC,
  memory_total NUMERIC,
  disk_usage NUMERIC,
  disk_total NUMERIC,
  uptime BIGINT,
  last_sync TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.servers ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations (public dashboard)
CREATE POLICY "Allow all operations on servers"
ON public.servers
FOR ALL
USING (true)
WITH CHECK (true);

-- Create index for faster queries
CREATE INDEX idx_servers_node ON public.servers(node);
CREATE INDEX idx_servers_vmid ON public.servers(vmid);
CREATE INDEX idx_servers_type ON public.servers(type);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_servers_updated_at
BEFORE UPDATE ON public.servers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Migration: 20251104172043
-- Add unique constraint on vmid and node combination
ALTER TABLE public.servers 
ADD CONSTRAINT servers_vmid_node_key UNIQUE (vmid, node);

-- Migration: 20251104190333
-- Create table for storing proxmox nodes configuration
CREATE TABLE IF NOT EXISTS public.proxmox_nodes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  host TEXT NOT NULL,
  port INTEGER NOT NULL DEFAULT 8006,
  realm TEXT NOT NULL DEFAULT 'pam',
  verify_ssl BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.proxmox_nodes ENABLE ROW LEVEL SECURITY;

-- Create policies (allow all for now, can be restricted later)
CREATE POLICY "Allow all operations on proxmox_nodes" 
ON public.proxmox_nodes 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_proxmox_nodes_updated_at
BEFORE UPDATE ON public.proxmox_nodes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Migration: 20251104192633
-- Create mailcow_servers table
CREATE TABLE IF NOT EXISTS public.mailcow_servers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  host TEXT NOT NULL,
  api_key TEXT NOT NULL,
  verify_ssl BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.mailcow_servers ENABLE ROW LEVEL SECURITY;

-- Create policy for all operations
CREATE POLICY "Allow all operations on mailcow_servers"
ON public.mailcow_servers
FOR ALL
USING (true)
WITH CHECK (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_mailcow_servers_updated_at
BEFORE UPDATE ON public.mailcow_servers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Migration: 20251104193055
-- Add unique constraint to mailcow_servers host column
ALTER TABLE public.mailcow_servers 
ADD CONSTRAINT mailcow_servers_host_unique UNIQUE (host);

-- Migration: 20251104201144
-- Create profiles table with username
create table public.profiles (
  id uuid not null references auth.users on delete cascade,
  username text unique not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  primary key (id)
);

-- Enable RLS
alter table public.profiles enable row level security;

-- RLS Policies
create policy "Public profiles are viewable by everyone"
on public.profiles for select
using (true);

create policy "Users can insert their own profile"
on public.profiles for insert
with check (auth.uid() = id);

create policy "Users can update their own profile"
on public.profiles for update
using (auth.uid() = id);

-- Trigger function for automatic profile creation
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (new.id, new.raw_user_meta_data->>'username');
  return new;
end;
$$;

-- Trigger on user creation
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Function to update updated_at timestamp
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Trigger for updated_at
create trigger on_profile_updated
  before update on public.profiles
  for each row execute procedure public.handle_updated_at();

-- Migration: 20251104201211
-- Fix search_path for handle_updated_at function
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Migration: 20251104201721
-- Create plesk_servers table with username/password auth
create table public.plesk_servers (
  id uuid not null default gen_random_uuid() primary key,
  name text not null,
  host text not null,
  username text not null,
  password text not null,
  port integer not null default 8443,
  verify_ssl boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

-- Enable RLS
alter table public.plesk_servers enable row level security;

-- RLS Policies
create policy "Allow all operations on plesk_servers"
on public.plesk_servers for all
using (true)
with check (true);

-- Trigger for updated_at
create trigger on_plesk_servers_updated
  before update on public.plesk_servers
  for each row execute procedure public.handle_updated_at();

-- Migration: 20251104203805
-- Create customers table
CREATE TABLE public.customers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#3b82f6',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Allow all operations on customers"
ON public.customers
FOR ALL
USING (true)
WITH CHECK (true);

-- Add customer_id to plesk_servers
ALTER TABLE public.plesk_servers 
ADD COLUMN customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL;

-- Create index for better performance
CREATE INDEX idx_plesk_servers_customer_id ON public.plesk_servers(customer_id);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_customers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_customers_updated_at
BEFORE UPDATE ON public.customers
FOR EACH ROW
EXECUTE FUNCTION public.update_customers_updated_at();

-- Migration: 20251104203936
-- Fix function search_path security issue by recreating function and trigger
DROP TRIGGER IF EXISTS update_customers_updated_at ON public.customers;
DROP FUNCTION IF EXISTS public.update_customers_updated_at();

CREATE OR REPLACE FUNCTION public.update_customers_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_customers_updated_at
BEFORE UPDATE ON public.customers
FOR EACH ROW
EXECUTE FUNCTION public.update_customers_updated_at();

-- Migration: 20251105095829
-- Fix overly permissive RLS policies on all tables
-- This ensures only authenticated users can access sensitive data

-- Fix mailcow_servers table (contains API keys)
DROP POLICY IF EXISTS "Allow all operations on mailcow_servers" ON mailcow_servers;
CREATE POLICY "Authenticated users can view mailcow servers" 
  ON mailcow_servers FOR SELECT 
  TO authenticated 
  USING (true);
CREATE POLICY "Authenticated users can insert mailcow servers" 
  ON mailcow_servers FOR INSERT 
  TO authenticated 
  WITH CHECK (true);
CREATE POLICY "Authenticated users can update mailcow servers" 
  ON mailcow_servers FOR UPDATE 
  TO authenticated 
  USING (true);
CREATE POLICY "Authenticated users can delete mailcow servers" 
  ON mailcow_servers FOR DELETE 
  TO authenticated 
  USING (true);

-- Fix plesk_servers table (contains passwords)
DROP POLICY IF EXISTS "Allow all operations on plesk_servers" ON plesk_servers;
CREATE POLICY "Authenticated users can view plesk servers" 
  ON plesk_servers FOR SELECT 
  TO authenticated 
  USING (true);
CREATE POLICY "Authenticated users can insert plesk servers" 
  ON plesk_servers FOR INSERT 
  TO authenticated 
  WITH CHECK (true);
CREATE POLICY "Authenticated users can update plesk servers" 
  ON plesk_servers FOR UPDATE 
  TO authenticated 
  USING (true);
CREATE POLICY "Authenticated users can delete plesk servers" 
  ON plesk_servers FOR DELETE 
  TO authenticated 
  USING (true);

-- Fix proxmox_nodes table
DROP POLICY IF EXISTS "Allow all operations on proxmox_nodes" ON proxmox_nodes;
CREATE POLICY "Authenticated users can view proxmox nodes" 
  ON proxmox_nodes FOR SELECT 
  TO authenticated 
  USING (true);
CREATE POLICY "Authenticated users can insert proxmox nodes" 
  ON proxmox_nodes FOR INSERT 
  TO authenticated 
  WITH CHECK (true);
CREATE POLICY "Authenticated users can update proxmox nodes" 
  ON proxmox_nodes FOR UPDATE 
  TO authenticated 
  USING (true);
CREATE POLICY "Authenticated users can delete proxmox nodes" 
  ON proxmox_nodes FOR DELETE 
  TO authenticated 
  USING (true);

-- Fix servers table
DROP POLICY IF EXISTS "Allow all operations on servers" ON servers;
CREATE POLICY "Authenticated users can view servers" 
  ON servers FOR SELECT 
  TO authenticated 
  USING (true);
CREATE POLICY "Authenticated users can insert servers" 
  ON servers FOR INSERT 
  TO authenticated 
  WITH CHECK (true);
CREATE POLICY "Authenticated users can update servers" 
  ON servers FOR UPDATE 
  TO authenticated 
  USING (true);
CREATE POLICY "Authenticated users can delete servers" 
  ON servers FOR DELETE 
  TO authenticated 
  USING (true);

-- Fix customers table
DROP POLICY IF EXISTS "Allow all operations on customers" ON customers;
CREATE POLICY "Authenticated users can view customers" 
  ON customers FOR SELECT 
  TO authenticated 
  USING (true);
CREATE POLICY "Authenticated users can insert customers" 
  ON customers FOR INSERT 
  TO authenticated 
  WITH CHECK (true);
CREATE POLICY "Authenticated users can update customers" 
  ON customers FOR UPDATE 
  TO authenticated 
  USING (true);
CREATE POLICY "Authenticated users can delete customers" 
  ON customers FOR DELETE 
  TO authenticated 
  USING (true);
