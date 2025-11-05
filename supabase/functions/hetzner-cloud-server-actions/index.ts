import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { serverId, action } = await req.json();
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get Hetzner API key from database
    const { data: settings, error: settingsError } = await supabase
      .from('application_settings')
      .select('value')
      .eq('key', 'hetzner_api_key')
      .maybeSingle();

    if (settingsError) throw settingsError;
    
    const HETZNER_API_KEY = settings?.value as string;
    
    if (!HETZNER_API_KEY) {
      throw new Error('Hetzner API Key nicht konfiguriert. Bitte in den Einstellungen hinterlegen.');
    }

    if (!serverId || !action) {
      throw new Error('serverId and action are required');
    }

    console.log(`Executing ${action} on server ${serverId}`);

    let endpoint = '';
    let method = 'POST';
    
    switch (action) {
      case 'start':
      case 'reboot':
      case 'shutdown':
      case 'reset':
        endpoint = `https://api.hetzner.cloud/v1/servers/${serverId}/actions/${action}`;
        break;
      case 'delete':
        endpoint = `https://api.hetzner.cloud/v1/servers/${serverId}`;
        method = 'DELETE';
        break;
      default:
        throw new Error(`Unknown action: ${action}`);
    }

    const response = await fetch(endpoint, {
      method,
      headers: {
        'Authorization': `Bearer ${HETZNER_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Hetzner API error:', error);
      throw new Error(`Hetzner API error: ${response.status}`);
    }

    const data = await response.json();
    console.log(`Successfully executed ${action} on server ${serverId}`);

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
