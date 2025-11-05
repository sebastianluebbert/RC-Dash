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
    const { node, vmid, type, action } = await req.json();

    if (!node || !vmid || !type || !action) {
      throw new Error('Missing required parameters: node, vmid, type, action');
    }

    if (!['start', 'stop', 'shutdown', 'reboot'].includes(action)) {
      throw new Error('Invalid action. Must be: start, stop, shutdown, or reboot');
    }

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
      throw new Error(`Proxmox Node '${node}' nicht gefunden. Bitte konfigurieren Sie den Server in den Einstellungen.`);
    }

    const PROXMOX_HOST = nodeConfig.host;
    const PROXMOX_USERNAME = nodeConfig.username;
    const PROXMOX_PASSWORD = nodeConfig.password;

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
