import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authenticateAdmin } from '../_shared/auth.ts';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const requestSchema = z.object({
  serverId: z.string().uuid(),
  installationId: z.number().int().positive(),
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
    const { serverId, installationId } = requestSchema.parse(body);
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`Creating WordPress SSO link for installation: ${installationId}`);

    // Get server credentials
    const { data: server, error: serverError } = await supabase
      .from('plesk_servers')
      .select('*')
      .eq('id', serverId)
      .single();

    if (serverError) throw serverError;

    // Create Basic Auth header
    const authString = btoa(`${server.username}:${server.password}`);
    
    // Request SSO link from Plesk WP Toolkit
    const response = await fetch(
      `${server.host}:${server.port}/api/v2/extensions/wp-toolkit/installations/${installationId}/sso-link`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${authString}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          return_url: '', // Optional: URL to return to after logout
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Plesk WP Toolkit SSO error:', errorText);
      throw new Error(`Plesk API error: ${response.status}`);
    }

    const ssoData = await response.json();

    console.log('Successfully created WordPress SSO link');

    return new Response(
      JSON.stringify({ ssoUrl: ssoData.url || ssoData.link }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in plesk-wp-sso function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});