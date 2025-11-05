import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authenticateAdmin } from '../_shared/auth.ts';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const requestSchema = z.object({
  action: z.enum(['create', 'update', 'delete']),
  zoneName: z.string().min(1),
  record: z.object({
    name: z.string(),
    type: z.string(),
    value: z.string(),
    ttl: z.number().positive().optional(),
  }),
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Authenticate and authorize admin
  const authResult = await authenticateAdmin(req, corsHeaders);
  if (!authResult.success) {
    return authResult.response;
  }

  try {
    const body = await req.json();
    const { action, zoneName, record } = requestSchema.parse(body);
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get AutoDNS credentials from database
    const { data: settings, error: settingsError } = await supabase
      .from('application_settings')
      .select('value')
      .eq('key', 'autodns_credentials')
      .maybeSingle();

    if (settingsError) throw settingsError;
    
    if (!settings?.value) {
      throw new Error('AutoDNS Credentials nicht konfiguriert. Bitte in den Einstellungen hinterlegen.');
    }
    
    const credentials = settings.value as any;
    const autodnsUser = credentials.user;
    const autodnsPassword = credentials.password;
    const autodnsContext = credentials.context;
    
    if (!autodnsUser || !autodnsPassword || !autodnsContext) {
      throw new Error('AutoDNS Credentials unvollständig. Bitte alle Felder in den Einstellungen ausfüllen.');
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
