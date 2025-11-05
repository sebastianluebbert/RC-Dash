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

    const { zoneId } = await req.json();

    if (!zoneId) {
      throw new Error('zoneId is required');
    }

    console.log(`Fetching DNS records for zone: ${zoneId}`);

    // First, get the zone to fetch its default TTL
    console.log('Fetching zone details for default TTL');
    const zoneResponse = await fetch(`https://api.hetzner.cloud/v1/zones/${zoneId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${hetznerApiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!zoneResponse.ok) {
      const errorText = await zoneResponse.text();
      console.error('Hetzner API error fetching zone:', errorText);
      throw new Error(`Hetzner API error: ${zoneResponse.status}`);
    }

    const zoneData = await zoneResponse.json();
    const defaultTTL = zoneData.zone?.ttl || 86400;
    console.log(`Zone default TTL: ${defaultTTL}`);

    // Use Cloud API to get RRSets
    let response = await fetch(`https://api.hetzner.cloud/v1/zones/${zoneId}/rrsets`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${hetznerApiKey}`,
        'Content-Type': 'application/json',
      },
    });

    console.log(`Cloud API response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Hetzner API error:', errorText);
      throw new Error(`Hetzner API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Cloud API returns { rrsets: [...] }
    const rrsets = data.rrsets || [];
    console.log(`Successfully fetched ${rrsets.length} RRSets`);

    // Convert RRSets to individual records for compatibility with existing UI
    const records: any[] = [];
    rrsets.forEach((rrset: any) => {
      // Use RRSet TTL if available, otherwise use zone default TTL, finally fallback to 86400
      const ttl = rrset.ttl !== null && rrset.ttl !== undefined ? rrset.ttl : defaultTTL;
      console.log(`RRSet ${rrset.id}: ttl=${rrset.ttl}, using=${ttl}`);
      
      rrset.records.forEach((record: any, index: number) => {
        records.push({
          id: `${rrset.id}-${index}`,
          zone_id: zoneId,
          type: rrset.type,
          name: rrset.name,
          value: record.value,
          ttl: ttl,
          created: rrset.created,
          modified: rrset.modified,
          rrset_id: rrset.id, // Store RRSet ID for updates/deletes
        });
      });
    });
    console.log(`Converted to ${records.length} individual records`);

    return new Response(
      JSON.stringify({ records }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in hetzner-dns-records function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
