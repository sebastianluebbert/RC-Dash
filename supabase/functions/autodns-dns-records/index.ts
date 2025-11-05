import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authenticateAdmin } from '../_shared/auth.ts';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const requestSchema = z.object({
  zoneName: z.string().min(1),
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
    const { zoneName } = requestSchema.parse(body);
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
