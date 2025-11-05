import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authenticateAdmin } from '../_shared/auth.ts';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const requestSchema = z.object({
  serverId: z.string().uuid(),
  action: z.enum(['status', 'enable', 'disable', 'list', 'add', 'delete', 'reset']),
  rule: z.string().optional(),
  port: z.string().optional(),
  protocol: z.enum(['tcp', 'udp', 'any']).optional(),
  from: z.string().ip().optional(),
  to: z.string().ip().optional(),
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
    const validated = requestSchema.parse(body);
    const { serverId, action, rule, port, protocol, from, to } = validated;

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get server SSH configuration from database
    // For now, we'll use Hetzner servers as the target
    const { data: settings, error: settingsError } = await supabase
      .from('application_settings')
      .select('value')
      .eq('key', 'hetzner_api_key')
      .maybeSingle();

    if (settingsError) throw settingsError;
    
    const HETZNER_API_KEY = settings?.value as string;
    
    if (!HETZNER_API_KEY) {
      throw new Error('Hetzner API key not configured');
    }

    // Get server details
    const response = await fetch(`https://api.hetzner.cloud/v1/servers/${serverId}`, {
      headers: {
        'Authorization': `Bearer ${HETZNER_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get server details: ${response.status}`);
    }

    const serverData = await response.json();
    const serverIp = serverData.server.public_net.ipv4.ip;

    // Build UFW command based on action
    let ufwCommand = '';
    
    switch (action) {
      case 'status':
        ufwCommand = 'sudo ufw status numbered';
        break;
      case 'enable':
        ufwCommand = 'sudo ufw --force enable';
        break;
      case 'disable':
        ufwCommand = 'sudo ufw disable';
        break;
      case 'list':
        ufwCommand = 'sudo ufw status verbose';
        break;
      case 'add':
        if (!port || !protocol) {
          throw new Error('Port and protocol required for adding rule');
        }
        if (from) {
          ufwCommand = `sudo ufw allow from ${from} to any port ${port} proto ${protocol}`;
        } else {
          ufwCommand = `sudo ufw allow ${port}/${protocol}`;
        }
        break;
      case 'delete':
        if (!rule) {
          throw new Error('Rule number required for deletion');
        }
        ufwCommand = `sudo ufw --force delete ${rule}`;
        break;
      case 'reset':
        ufwCommand = 'sudo ufw --force reset';
        break;
      default:
        throw new Error('Invalid action');
    }

    console.log(`Executing UFW command on ${serverIp}: ${ufwCommand}`);

    // Note: This is a placeholder. In production, you would:
    // 1. Use SSH library to connect to the server
    // 2. Execute the UFW command
    // 3. Return the output
    
    // For now, return a mock response indicating the command that would be executed
    return new Response(
      JSON.stringify({
        success: true,
        message: `UFW command prepared for execution`,
        command: ufwCommand,
        server: serverIp,
        note: 'SSH execution requires server credentials and SSH library integration'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in ufw-manage:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
