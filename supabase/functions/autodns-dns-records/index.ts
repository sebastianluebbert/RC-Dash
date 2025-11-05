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

    const { zoneName } = await req.json();

    if (!zoneName) {
      throw new Error('zoneName is required');
    }

    console.log(`Fetching DNS records for zone: ${zoneName}`);

    const auth = btoa(`${autodnsUser}:${autodnsPassword}`);
    
    const response = await fetch(`https://api.autodns.com/v1/zone/${zoneName}`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
        'X-Domainrobot-Context': autodnsContext,
      },
    });

    console.log(`AutoDNS API response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AutoDNS API error:', errorText);
      throw new Error(`AutoDNS API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Transform AutoDNS resource records to our format
    const records = (data.data?.[0]?.resourceRecords || []).map((rr: any, index: number) => ({
      id: `${rr.name}-${rr.type}-${index}`,
      zone_id: zoneName,
      type: rr.type,
      name: rr.name,
      value: rr.value,
      ttl: rr.ttl || 86400,
      created: data.data?.[0]?.created || new Date().toISOString(),
      modified: data.data?.[0]?.changed || new Date().toISOString(),
      provider: 'autodns',
    }));

    console.log(`Successfully fetched ${records.length} records`);

    return new Response(
      JSON.stringify({ records }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in autodns-dns-records function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
