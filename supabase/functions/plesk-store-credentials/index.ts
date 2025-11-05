import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authenticateAdmin } from '../_shared/auth.ts';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const requestSchema = z.object({
  name: z.string().min(1).max(100),
  host: z.string().url().or(z.string().regex(/^https?:\/\/.+/)),
  username: z.string().min(1).max(100),
  password: z.string().min(1).max(255),
  port: z.number().int().positive().max(65535).optional(),
  verify_ssl: z.boolean().optional(),
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
    const { name, host, username, password, port, verify_ssl } = requestSchema.parse(body);
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`Storing Plesk server credentials: ${name}`);

    // Ensure host has protocol and format correctly
    let pleskHost = host.trim();
    
    // Remove any trailing slashes
    pleskHost = pleskHost.replace(/\/+$/, '');
    
    // Remove port if accidentally included in host
    pleskHost = pleskHost.replace(/:\d+$/, '');
    
    // Add https:// if no protocol
    if (!pleskHost.startsWith('http://') && !pleskHost.startsWith('https://')) {
      pleskHost = `https://${pleskHost}`;
    }

    const pleskPort = port || 8443;
    const testUrl = `${pleskHost}:${pleskPort}/api/v2/server`;
    
    console.log(`Testing connection to: ${testUrl}`);
    console.log(`Username: ${username}`);

    // Test connection first
    const authString = btoa(`${username}:${password}`);
    
    try {
      const testResponse = await fetch(testUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${authString}`,
          'Content-Type': 'application/json',
        },
      });

      console.log(`Test response status: ${testResponse.status}`);

      if (!testResponse.ok) {
        const errorText = await testResponse.text();
        console.error(`Plesk API error response: ${errorText}`);
        throw new Error(`Failed to connect to Plesk server (Status ${testResponse.status}). Please check credentials and host.`);
      }

      const testData = await testResponse.json();
      console.log('Successfully connected to Plesk server:', testData);
    } catch (fetchError: any) {
      console.error('Fetch error:', fetchError);
      throw new Error(`Connection failed: ${fetchError.message}. Check if host, port, and credentials are correct.`);
    }

    // Store in database with normalized host
    const { data, error } = await supabase
      .from('plesk_servers')
      .insert({
        name,
        host: pleskHost, // Use normalized host with protocol
        username,
        password,
        port: port || 8443,
        verify_ssl: verify_ssl !== false,
      })
      .select()
      .single();

    if (error) throw error;

    console.log('Successfully stored Plesk server credentials');

    return new Response(
      JSON.stringify({ success: true, server: data }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in plesk-store-credentials function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});