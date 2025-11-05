import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authenticateAdmin } from '../_shared/auth.ts';

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
    
    // Get Hetzner API key from database
    const { data: settings, error: settingsError } = await supabase
      .from('application_settings')
      .select('value')
      .eq('key', 'hetzner_api_key')
      .maybeSingle();

    if (settingsError) throw settingsError;
    
    const HETZNER_API_KEY = settings?.value as string;
    
    if (!HETZNER_API_KEY) {
      throw new Error('HETZNER_API_KEY is not configured');
    }

    if (req.method === 'GET') {
      // List all networks
      console.log('Fetching Hetzner Cloud networks...');
      
      const response = await fetch('https://api.hetzner.cloud/v1/networks', {
        headers: {
          'Authorization': `Bearer ${HETZNER_API_KEY}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('Hetzner API error:', error);
        throw new Error(`Hetzner API error: ${response.status}`);
      }

      const data = await response.json();
      return new Response(JSON.stringify({ networks: data.networks || [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else if (req.method === 'POST') {
      // Create or manage network
      const text = await req.text();
      if (!text || text.trim() === '') {
        throw new Error('Request body is required');
      }

      const body = JSON.parse(text);
      const { action, networkId, serverId, ...networkData } = body;

      let endpoint = '';
      let method = 'POST';
      let requestBody: any = {};

      if (action === 'create') {
        endpoint = 'https://api.hetzner.cloud/v1/networks';
        requestBody = networkData;
      } else if (action === 'attach') {
        endpoint = `https://api.hetzner.cloud/v1/networks/${networkId}/actions/attach_to_server`;
        requestBody = { server: serverId, ...networkData };
      } else if (action === 'detach') {
        endpoint = `https://api.hetzner.cloud/v1/networks/${networkId}/actions/detach_from_server`;
        requestBody = { server: serverId };
      } else if (action === 'delete') {
        endpoint = `https://api.hetzner.cloud/v1/networks/${networkId}`;
        method = 'DELETE';
      } else if (action === 'update') {
        endpoint = `https://api.hetzner.cloud/v1/networks/${networkId}`;
        method = 'PUT';
        requestBody = networkData;
      }

      console.log(`Executing network action: ${action}`);

      const response = await fetch(endpoint, {
        method,
        headers: {
          'Authorization': `Bearer ${HETZNER_API_KEY}`,
          'Content-Type': 'application/json',
        },
        ...(method !== 'DELETE' && { body: JSON.stringify(requestBody) }),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('Hetzner API error:', error);
        throw new Error(`Hetzner API error: ${response.status}`);
      }

      // Check if response has content before parsing
      const responseText = await response.text();
      const data = responseText ? JSON.parse(responseText) : {};
      
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    throw new Error('Method not allowed');
  } catch (error) {
    console.error('Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
