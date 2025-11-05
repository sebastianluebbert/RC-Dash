import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const HETZNER_API_KEY = Deno.env.get('HETZNER_API_KEY');
    
    if (!HETZNER_API_KEY) {
      throw new Error('HETZNER_API_KEY is not configured');
    }

    console.log('Fetching Hetzner Cloud servers...');

    const response = await fetch('https://api.hetzner.cloud/v1/servers', {
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
    console.log(`Successfully fetched ${data.servers?.length || 0} servers`);

    return new Response(JSON.stringify({ servers: data.servers || [] }), {
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
