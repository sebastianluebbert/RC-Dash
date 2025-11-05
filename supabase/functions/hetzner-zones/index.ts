import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const hetznerApiKey = Deno.env.get('HETZNER_API_KEY');
    
    if (!hetznerApiKey) {
      throw new Error('HETZNER_API_KEY not configured');
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
