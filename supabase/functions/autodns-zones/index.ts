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

    console.log('Fetching AutoDNS zones');

    // AutoDNS API uses Basic Auth
    const auth = btoa(`${autodnsUser}:${autodnsPassword}`);
    
    // Use _search endpoint with empty or null body for listing all zones
    const response = await fetch('https://api.autodns.com/v1/zone/_search', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
        'X-Domainrobot-Context': autodnsContext,
      },
      body: JSON.stringify({}), // Empty query to get all zones
    });

    console.log(`AutoDNS API response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AutoDNS API error:', errorText);
      throw new Error(`AutoDNS API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Log the first zone object completely to understand its structure
    if (data.data && data.data.length > 0) {
      console.log('First zone object keys:', Object.keys(data.data[0]));
      console.log('First zone complete object:', JSON.stringify(data.data[0], null, 2));
    }
    
    // Transform AutoDNS zones to match our Zone interface
    const zones = (data.data || []).map((zone: any) => {
      // Try multiple possible nameserver fields
      const nameservers = zone.nameServers || 
                         zone.nameServerSet?.nameServers ||
                         zone.nameServerGroup?.nameServers ||
                         zone.nsList ||
                         [];
      
      console.log(`Zone ${zone.origin} nameservers:`, nameservers);
      
      return {
        id: zone.origin, // Use origin as ID
        name: zone.origin,
        ttl: zone.soa?.ttl || 86400,
        created: zone.created || new Date().toISOString(),
        mode: 'primary',
        status: 'ok',
        record_count: zone.resourceRecords?.length || 0,
        authoritative_nameservers: {
          assigned: nameservers,
          delegated: nameservers,
          delegation_status: 'valid',
        },
        registrar: 'autodns',
        provider: 'autodns', // Add provider tag
      };
    });

    console.log(`Successfully fetched ${zones.length} AutoDNS zones`);

    return new Response(
      JSON.stringify({ zones }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in autodns-zones function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
