import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

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

    const requestSchema = z.object({
      serverId: z.string().uuid(),
    });
    
    const { serverId } = requestSchema.parse(await req.json());

    console.log(`Fetching domains for server: ${serverId}`);

    // Get server credentials
    const { data: server, error: serverError } = await supabase
      .from('mailcow_servers')
      .select('*')
      .eq('id', serverId)
      .single();

    if (serverError) throw serverError;

    // Fetch domains from Mailcow API
    const domainsUrl = `${server.host}/api/v1/get/domain/all`;
    const response = await fetch(domainsUrl, {
      method: 'GET',
      headers: {
        'X-API-Key': server.api_key,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Mailcow API error: ${response.status}`);
    }

    const domains = await response.json();

    console.log(`Successfully fetched ${domains.length || 0} domains`);

    return new Response(
      JSON.stringify({ domains }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in mailcow-domains function:', error);
    
    if (error instanceof z.ZodError) {
      return new Response(
        JSON.stringify({ error: 'Invalid request parameters' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      );
    }
    
    return new Response(
      JSON.stringify({ error: 'An error occurred while fetching domains' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});