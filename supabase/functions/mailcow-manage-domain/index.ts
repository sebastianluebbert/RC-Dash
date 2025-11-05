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

    const { serverId, action, domain } = await req.json();

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

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'X-API-Key': server.api_key,
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