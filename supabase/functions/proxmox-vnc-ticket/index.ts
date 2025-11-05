import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { node, vmid, type } = await req.json();

    if (!node || !vmid || !type) {
      throw new Error('Missing required parameters: node, vmid, type');
    }

    const PROXMOX_HOST = Deno.env.get('PROXMOX_HOST');
    const PROXMOX_USERNAME = Deno.env.get('PROXMOX_USERNAME');
    const PROXMOX_PASSWORD = Deno.env.get('PROXMOX_PASSWORD');

    if (!PROXMOX_HOST || !PROXMOX_USERNAME || !PROXMOX_PASSWORD) {
      throw new Error('Proxmox credentials not configured');
    }

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
      throw new Error(`Proxmox authentication failed: ${authResponse.status}`);
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
      const errorText = await vncResponse.text();
      console.error('VNC ticket failed:', errorText);
      throw new Error(`Failed to get VNC ticket: ${vncResponse.status}`);
    }

    const vncData = await vncResponse.json();

    console.log(`VNC ticket generated successfully`);

    // Construct WebSocket URL with proper authentication
    const wsProtocol = PROXMOX_HOST.startsWith('https://') ? 'wss://' : 'ws://';
    const hostWithoutProtocol = PROXMOX_HOST.replace('https://', '').replace('http://', '');
    const wsUrl = `${wsProtocol}${hostWithoutProtocol}/api2/json/nodes/${node}/${type}/${vmid}/vncwebsocket?port=${vncData.data.port}&vncticket=${encodeURIComponent(vncData.data.ticket)}`;

    console.log('VNC WebSocket URL constructed:', wsUrl);

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
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
