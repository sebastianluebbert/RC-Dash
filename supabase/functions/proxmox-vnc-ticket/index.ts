import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authenticateAdmin } from '../_shared/auth.ts';
import { vncTicketSchema } from '../_shared/validation.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate and authorize admin
    const authResult = await authenticateAdmin(req, corsHeaders);
    if (!authResult.success) {
      return authResult.response;
    }

    // Validate input
    const body = await req.json();
    const validated = vncTicketSchema.parse(body);
    const { node, vmid, type } = validated;

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get Proxmox node configuration from database
    const { data: nodeConfig, error: nodeError } = await supabase
      .from('proxmox_nodes')
      .select('*')
      .eq('name', node)
      .maybeSingle();

    if (nodeError) throw nodeError;
    
    if (!nodeConfig) {
      throw new Error(`Proxmox Node '${node}' nicht gefunden.`);
    }

    const PROXMOX_HOST = nodeConfig.host;
    const PROXMOX_USERNAME = nodeConfig.username;
    const PROXMOX_PASSWORD = nodeConfig.password;

    console.log(`Getting VNC ticket for ${type} ${vmid} on node ${node}`);

    // Get auth ticket
    const authResponse = await fetch(`${PROXMOX_HOST}/api2/json/access/ticket`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        username: PROXMOX_USERNAME,
        password: PROXMOX_PASSWORD,
      }),
    });

    if (!authResponse.ok) {
      throw new Error(`Proxmox authentication failed`);
    }

    const authData = await authResponse.json();
    const ticket = authData.data.ticket;
    const csrfToken = authData.data.CSRFPreventionToken;

    // Get VNC ticket
    const vncEndpoint = type === 'qemu' 
      ? `${PROXMOX_HOST}/api2/json/nodes/${node}/qemu/${vmid}/vncproxy`
      : `${PROXMOX_HOST}/api2/json/nodes/${node}/lxc/${vmid}/vncproxy`;

    const vncResponse = await fetch(vncEndpoint, {
      method: 'POST',
      headers: {
        'Cookie': `PVEAuthCookie=${ticket}`,
        'CSRFPreventionToken': csrfToken,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        websocket: '1',
      }),
    });

    if (!vncResponse.ok) {
      console.error('VNC ticket failed');
      throw new Error(`Failed to get VNC ticket`);
    }

    const vncData = await vncResponse.json();

    console.log(`VNC ticket generated successfully`);

    // Construct WebSocket URL with proper authentication
    const wsProtocol = PROXMOX_HOST.startsWith('https://') ? 'wss://' : 'ws://';
    const hostWithoutProtocol = PROXMOX_HOST.replace('https://', '').replace('http://', '');
    const wsUrl = `${wsProtocol}${hostWithoutProtocol}/api2/json/nodes/${node}/${type}/${vmid}/vncwebsocket?port=${vncData.data.port}&vncticket=${encodeURIComponent(vncData.data.ticket)}`;

    console.log('VNC WebSocket URL constructed');

    return new Response(
      JSON.stringify({ 
        success: true,
        ticket: vncData.data.ticket,
        port: vncData.data.port,
        wsUrl: wsUrl,
        upid: vncData.data.upid,
        csrfToken: csrfToken
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in proxmox-vnc-ticket:', error);
    return new Response(
      JSON.stringify({ error: 'An error occurred while generating VNC ticket' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
