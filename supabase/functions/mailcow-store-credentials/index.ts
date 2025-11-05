import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authenticateAdmin } from '../_shared/auth.ts';
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const requestSchema = z.object({
  name: z.string().min(1).max(100),
  host: z.string().url(),
  apiKey: z.string().min(1).max(255),
  verifySsl: z.boolean().optional(),
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
    const { name, host, apiKey, verifySsl = true } = requestSchema.parse(body);
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`Storing Mailcow credentials for: ${name} at ${host}`);

    // Test connection first
    const testUrl = `${host}/api/v1/get/mailbox/all`;
    const testResponse = await fetch(testUrl, {
      method: 'GET',
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
      },
    });

    if (!testResponse.ok) {
      throw new Error(`Failed to connect to Mailcow API: ${testResponse.status}`);
    }

    // Store credentials - check if exists first
    const { data: existing } = await supabase
      .from('mailcow_servers')
      .select('id')
      .eq('host', host)
      .maybeSingle();

    let data;
    let error;

    if (existing) {
      // Update existing
      const result = await supabase
        .from('mailcow_servers')
        .update({
          name,
          api_key: apiKey,
          verify_ssl: verifySsl,
        })
        .eq('host', host)
        .select()
        .single();
      
      data = result.data;
      error = result.error;
    } else {
      // Insert new
      const result = await supabase
        .from('mailcow_servers')
        .insert({
          name,
          host,
          api_key: apiKey,
          verify_ssl: verifySsl,
        })
        .select()
        .single();
      
      data = result.data;
      error = result.error;
    }

    if (error) {
      console.error('Database error:', error);
      throw error;
    }

    console.log('Mailcow credentials stored successfully');

    return new Response(
      JSON.stringify({ success: true, server: data }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in mailcow-store-credentials function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});