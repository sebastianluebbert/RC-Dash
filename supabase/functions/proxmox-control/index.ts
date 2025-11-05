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
    const { node, vmid, type, action } = await req.json();

    if (!node || !vmid || !type || !action) {
      throw new Error('Missing required parameters: node, vmid, type, action');
    }

    if (!['start', 'stop', 'shutdown', 'reboot'].includes(action)) {
      throw new Error('Invalid action. Must be: start, stop, shutdown, or reboot');
    }

    const PROXMOX_HOST = Deno.env.get('PROXMOX_HOST');
    const PROXMOX_USERNAME = Deno.env.get('PROXMOX_USERNAME');
    const PROXMOX_PASSWORD = Deno.env.get('PROXMOX_PASSWORD');

    if (!PROXMOX_HOST || !PROXMOX_USERNAME || !PROXMOX_PASSWORD) {
      throw new Error('Proxmox credentials not configured');
    }

    console.log(`Executing ${action} on ${type} ${vmid} on node ${node}`);

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

    // Execute action
    const actionEndpoint = type === 'qemu' 
      ? `${PROXMOX_HOST}/api2/json/nodes/${node}/qemu/${vmid}/status/${action}`
      : `${PROXMOX_HOST}/api2/json/nodes/${node}/lxc/${vmid}/status/${action}`;

    const actionResponse = await fetch(actionEndpoint, {
      method: 'POST',
      headers: {
        'Cookie': `PVEAuthCookie=${ticket}`,
        'CSRFPreventionToken': csrfToken,
      },
    });

    if (!actionResponse.ok) {
      const errorText = await actionResponse.text();
      console.error('Proxmox action failed:', errorText);
      throw new Error(`Failed to ${action} ${type}: ${actionResponse.status}`);
    }

    const result = await actionResponse.json();

    console.log(`Successfully executed ${action} on ${type} ${vmid}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        action,
        vmid,
        type,
        node,
        upid: result.data
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in proxmox-control:', error);
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
