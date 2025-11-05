-- Create table for application-wide settings (API keys, etc.)
CREATE TABLE IF NOT EXISTS public.application_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value jsonb NOT NULL,
  description text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.application_settings ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read all settings
CREATE POLICY "Authenticated users can view settings"
  ON public.application_settings
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to insert settings
CREATE POLICY "Authenticated users can insert settings"
  ON public.application_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow authenticated users to update settings
CREATE POLICY "Authenticated users can update settings"
  ON public.application_settings
  FOR UPDATE
  TO authenticated
  USING (true);

-- Allow authenticated users to delete settings
CREATE POLICY "Authenticated users can delete settings"
  ON public.application_settings
  FOR DELETE
  TO authenticated
  USING (true);

-- Add trigger for updated_at
CREATE TRIGGER update_application_settings_updated_at
  BEFORE UPDATE ON public.application_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();