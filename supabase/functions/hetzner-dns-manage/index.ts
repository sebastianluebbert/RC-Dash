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
  zoneId: z.string().min(1),
  rrsetId: z.string().optional(),
  record: z.object({
    name: z.string(),
    type: z.string(),
    ttl: z.number().positive().optional(),
    value: z.string(),
  }).optional(),
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
    const { action, zoneId, rrsetId, record } = requestSchema.parse(body);
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


    const headers = {
      'Authorization': `Bearer ${hetznerApiKey}`,
      'Content-Type': 'application/json',
    };

    let response;

    switch (action) {
      case 'create':
        if (!record) {
          throw new Error('record is required for create action');
        }
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
        if (!record) {
          throw new Error('record is required for update action');
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