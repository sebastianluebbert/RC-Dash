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

    if (req.method === 'GET') {
      // List all firewalls
      console.log('Fetching Hetzner Cloud firewalls...');
      
      const response = await fetch('https://api.hetzner.cloud/v1/firewalls', {
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
      return new Response(JSON.stringify({ firewalls: data.firewalls || [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else if (req.method === 'POST') {
      // Create or manage firewall
      const text = await req.text();
      if (!text || text.trim() === '') {
        throw new Error('Request body is required');
      }

      const body = JSON.parse(text);
      const { action, firewallId, serverId, ...firewallData } = body;

      let endpoint = '';
      let method = 'POST';
      let requestBody: any = {};

      if (action === 'create') {
        endpoint = 'https://api.hetzner.cloud/v1/firewalls';
        requestBody = firewallData;
      } else if (action === 'attach') {
        endpoint = `https://api.hetzner.cloud/v1/firewalls/${firewallId}/actions/apply_to_resources`;
        requestBody = { apply_to: [{ type: 'server', server: serverId }] };
      } else if (action === 'detach') {
        endpoint = `https://api.hetzner.cloud/v1/firewalls/${firewallId}/actions/remove_from_resources`;
        requestBody = { remove_from: [{ type: 'server', server: serverId }] };
      } else if (action === 'delete') {
        endpoint = `https://api.hetzner.cloud/v1/firewalls/${firewallId}`;
        method = 'DELETE';
      } else if (action === 'update') {
        endpoint = `https://api.hetzner.cloud/v1/firewalls/${firewallId}`;
        method = 'PUT';
        requestBody = firewallData;
      }

      console.log(`Executing firewall action: ${action}`);

      const response = await fetch(endpoint, {
        method,
        headers: {
          'Authorization': `Bearer ${HETZNER_API_KEY}`,
          'Content-Type': 'application/json',
        },
        ...(method !== 'DELETE' && { body: JSON.stringify(requestBody) }),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('Hetzner API error:', error);
        throw new Error(`Hetzner API error: ${response.status}`);
      }

      // Check if response has content before parsing
      const responseText = await response.text();
      const data = responseText ? JSON.parse(responseText) : {};
      
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    throw new Error('Method not allowed');
  } catch (error) {
    console.error('Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
