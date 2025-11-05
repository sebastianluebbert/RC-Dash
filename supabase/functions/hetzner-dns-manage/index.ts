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

    const { action, zoneId, rrsetId, record } = await req.json();

    if (!action || !zoneId) {
      throw new Error('action and zoneId are required');
    }

    const headers = {
      'Authorization': `Bearer ${hetznerApiKey}`,
      'Content-Type': 'application/json',
    };

    let response;

    switch (action) {
      case 'create':
        console.log(`Creating RRSet in zone: ${zoneId}`);
        response = await fetch(`https://api.hetzner.cloud/v1/zones/${zoneId}/rrsets`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            name: record.name,
            type: record.type,
            ttl: record.ttl || 3600,
            records: [
              {
                value: record.value,
              },
            ],
          }),
        });
        break;

      case 'update':
        if (!rrsetId) {
          throw new Error('rrsetId is required for update action');
        }
        console.log(`Updating RRSet: ${rrsetId}`);
        response = await fetch(`https://api.hetzner.cloud/v1/zones/${zoneId}/rrsets/${rrsetId}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({
            name: record.name,
            type: record.type,
            ttl: record.ttl || 3600,
            records: [
              {
                value: record.value,
              },
            ],
          }),
        });
        break;

      case 'delete':
        if (!rrsetId) {
          throw new Error('rrsetId is required for delete action');
        }
        console.log(`Deleting RRSet: ${rrsetId}`);
        response = await fetch(`https://api.hetzner.cloud/v1/zones/${zoneId}/rrsets/${rrsetId}`, {
          method: 'DELETE',
          headers,
        });
        break;

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Hetzner API error:', errorText);
      throw new Error(`Hetzner API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('Operation successful');

    return new Response(
      JSON.stringify(data),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in hetzner-dns-manage function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});