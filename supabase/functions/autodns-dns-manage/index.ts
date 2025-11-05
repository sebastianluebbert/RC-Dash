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
    const autodnsUser = Deno.env.get('AUTODNS_API_USER');
    const autodnsPassword = Deno.env.get('AUTODNS_API_PASSWORD');
    const autodnsContext = Deno.env.get('AUTODNS_API_CONTEXT');
    
    if (!autodnsUser || !autodnsPassword || !autodnsContext) {
      throw new Error('AutoDNS credentials not configured');
    }

    const { action, zoneName, record } = await req.json();

    if (!action || !zoneName) {
      throw new Error('action and zoneName are required');
    }

    const auth = btoa(`${autodnsUser}:${autodnsPassword}`);
    const headers = {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json',
      'X-Domainrobot-Context': autodnsContext,
    };

    // First, get the current zone data
    console.log(`Fetching current zone data for: ${zoneName}`);
    const getResponse = await fetch(`https://api.autodns.com/v1/zone/${zoneName}`, {
      method: 'GET',
      headers,
    });

    if (!getResponse.ok) {
      throw new Error(`Failed to fetch zone: ${getResponse.status}`);
    }

    const zoneData = await getResponse.json();
    const zone = zoneData.data?.[0];
    if (!zone) {
      throw new Error('Zone not found');
    }

    let resourceRecords = zone.resourceRecords || [];

    switch (action) {
      case 'create':
        console.log(`Adding record to zone: ${zoneName}`);
        resourceRecords.push({
          name: record.name,
          type: record.type,
          value: record.value,
          ttl: record.ttl || 86400,
        });
        break;

      case 'update':
        console.log(`Updating record in zone: ${zoneName}`);
        // Find and update the record
        const updateIndex = resourceRecords.findIndex(
          (rr: any) => rr.name === record.name && rr.type === record.type
        );
        if (updateIndex === -1) {
          throw new Error('Record not found for update');
        }
        resourceRecords[updateIndex] = {
          name: record.name,
          type: record.type,
          value: record.value,
          ttl: record.ttl || 86400,
        };
        break;

      case 'delete':
        console.log(`Deleting record from zone: ${zoneName}`);
        resourceRecords = resourceRecords.filter(
          (rr: any) => !(rr.name === record.name && rr.type === record.type)
        );
        break;

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    // Update the zone with modified records
    const updateResponse = await fetch(`https://api.autodns.com/v1/zone/${zoneName}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        origin: zoneName,
        resourceRecords: resourceRecords,
        soa: zone.soa,
        nameServers: zone.nameServers,
      }),
    });

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      console.error('AutoDNS API error:', errorText);
      throw new Error(`AutoDNS API error: ${updateResponse.status}`);
    }

    const data = await updateResponse.json();
    console.log('Operation successful');

    return new Response(
      JSON.stringify(data),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in autodns-dns-manage function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
