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
      action: z.enum(['create', 'update', 'delete']),
      mailbox: z.object({
        local_part: z.string().optional(),
        domain: z.string().optional(),
        name: z.string().optional(),
        password: z.string().optional(),
        quota: z.number().optional(),
        active: z.boolean().optional(),
        username: z.string().optional(),
      }),
    });
    
    const { serverId, action, mailbox } = requestSchema.parse(await req.json());

    console.log(`Managing mailbox: ${action} for server ${serverId}`);

    // Get server credentials
    const { data: server, error: serverError } = await supabase
      .from('mailcow_servers')
      .select('*')
      .eq('id', serverId)
      .single();

    if (serverError) throw serverError;

    let url = `${server.host}/api/v1`;
    let method = 'POST';
    let body: any = {};

    if (action === 'create') {
      url += '/add/mailbox';
      body = {
        local_part: mailbox.local_part,
        domain: mailbox.domain,
        name: mailbox.name,
        password: mailbox.password,
        password2: mailbox.password,
        quota: mailbox.quota || 1073741824,
        active: mailbox.active ? 1 : 0,
      };
    } else if (action === 'update') {
      url += '/edit/mailbox';
      body = {
        items: [mailbox.username],
        attr: {
          name: mailbox.name,
          quota: mailbox.quota,
          active: mailbox.active ? 1 : 0,
        }
      };
      
      // Only include password if provided
      if (mailbox.password) {
        body.attr.password = mailbox.password;
        body.attr.password2 = mailbox.password;
      }
    } else if (action === 'delete') {
      url += '/delete/mailbox';
      body = [mailbox.username];
    }

    // Get decrypted API key
    const { data: decryptedApiKey, error: decryptError } = await supabase
      .rpc('decrypt_value', { encrypted_text: server.api_key_encrypted });
    
    if (decryptError || !decryptedApiKey) {
      console.error('Failed to decrypt API key:', decryptError);
      throw new Error('Failed to decrypt server credentials');
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'X-API-Key': decryptedApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Mailcow API error:', errorText);
      throw new Error(`Mailcow API error: ${response.status}`);
    }

    const result = await response.json();

    console.log(`Successfully ${action}d mailbox`);

    return new Response(
      JSON.stringify({ success: true, result }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in mailcow-manage-mailbox function:', error);
    
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
      JSON.stringify({ error: 'An error occurred while managing mailbox' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});