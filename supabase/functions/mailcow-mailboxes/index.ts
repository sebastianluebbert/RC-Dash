import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authenticateAdmin } from '../_shared/auth.ts';
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const requestSchema = z.object({
      serverId: z.string().uuid(),
    });
    
    const { serverId } = requestSchema.parse(await req.json());

    console.log(`Fetching mailboxes for server: ${serverId}`);

    // Get server credentials
    const { data: server, error: serverError } = await supabase
      .from('mailcow_servers')
      .select('*')
      .eq('id', serverId)
      .single();

    if (serverError) throw serverError;

    // Get decrypted API key
    const { data: decryptedApiKey, error: decryptError } = await supabase
      .rpc('decrypt_value', { encrypted_text: server.api_key_encrypted });
    
    if (decryptError || !decryptedApiKey) {
      console.error('Failed to decrypt API key:', decryptError);
      throw new Error('Failed to decrypt server credentials');
    }

    // Fetch mailboxes from Mailcow API
    const mailboxesUrl = `${server.host}/api/v1/get/mailbox/all`;
    const response = await fetch(mailboxesUrl, {
      method: 'GET',
      headers: {
        'X-API-Key': decryptedApiKey,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Mailcow API error: ${response.status}`);
    }

    const mailboxes = await response.json();

    console.log(`Successfully fetched ${mailboxes.length || 0} mailboxes`);

    return new Response(
      JSON.stringify({ mailboxes }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in mailcow-mailboxes function:', error);
    
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
      JSON.stringify({ error: 'An error occurred while fetching mailboxes' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});