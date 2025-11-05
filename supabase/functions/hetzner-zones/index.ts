import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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
    
    const hetznerApiKey = settings?.value as string;
    
    if (!hetznerApiKey) {
      throw new Error('Hetzner API Key nicht konfiguriert. Bitte in den Einstellungen hinterlegen.');
    }

    console.log('Fetching Hetzner DNS zones via Cloud API');

    // Use Hetzner Cloud API endpoint (new integrated DNS)
    console.log('Trying Cloud API: https://api.hetzner.cloud/v1/zones');
    let response = await fetch('https://api.hetzner.cloud/v1/zones', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${hetznerApiKey}`,
        'Content-Type': 'application/json',
      },
    });

    console.log(`Cloud API response status: ${response.status}`);

    const data = await response.json();
    
    console.log('Raw API response structure:', JSON.stringify(Object.keys(data)));

    if (!response.ok) {
      console.error('Hetzner API error:', JSON.stringify(data));
      throw new Error(`Hetzner API error: ${response.status}`);
    }

    // Cloud API returns { zones: [...] }
    const zones = data.zones || [];
    console.log(`Successfully fetched ${zones.length} zones`);

    // Return in the expected format
    return new Response(
      JSON.stringify({ zones }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in hetzner-zones function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
