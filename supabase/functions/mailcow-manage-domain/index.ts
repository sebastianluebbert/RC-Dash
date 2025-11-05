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
  action: z.enum(['create', 'update', 'delete']),
  domain: z.object({
    domain_name: z.string(),
    description: z.string().optional(),
    max_aliases: z.number().optional(),
    max_mailboxes: z.number().optional(),
    default_quota: z.number().optional(),
    max_quota: z.number().optional(),
    quota: z.number().optional(),
    active: z.boolean().optional(),
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
    const requestBody = await req.json();
    const { serverId, action, domain } = requestSchema.parse(requestBody);
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`Managing domain: ${action} for server ${serverId}`);

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
      url += '/add/domain';
      body = {
        domain: domain.domain_name,
        description: domain.description || '',
        aliases: domain.max_aliases || 400,
        mailboxes: domain.max_mailboxes || 10,
        defquota: domain.default_quota || 1073741824,
        maxquota: domain.max_quota || 10737418240,
        quota: domain.quota || 10737418240,
        active: domain.active ? 1 : 0,
        restart_sogo: 1
      };
    } else if (action === 'update') {
      url += '/edit/domain';
      body = {
        items: [domain.domain_name],
        attr: {
          description: domain.description,
          aliases: domain.max_aliases,
          mailboxes: domain.max_mailboxes,
          defquota: domain.default_quota,
          maxquota: domain.max_quota,
          quota: domain.quota,
          active: domain.active ? 1 : 0,
        }
      };
    } else if (action === 'delete') {
      url += '/delete/domain';
      body = [domain.domain_name];
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

    console.log(`Successfully ${action}d domain`);

    return new Response(
      JSON.stringify({ success: true, result }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in mailcow-manage-domain function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});