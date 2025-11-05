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
    const { node, vmid, name, cores, memory, disk, ostype } = await req.json();

    if (!node || !vmid || !name) {
      throw new Error('Missing required parameters: node, vmid, name');
    }

    const PROXMOX_HOST = Deno.env.get('PROXMOX_HOST');
    const PROXMOX_USERNAME = Deno.env.get('PROXMOX_USERNAME');
    const PROXMOX_PASSWORD = Deno.env.get('PROXMOX_PASSWORD');

    if (!PROXMOX_HOST || !PROXMOX_USERNAME || !PROXMOX_PASSWORD) {
      throw new Error('Proxmox credentials not configured');
    }

    console.log(`Creating VM ${vmid} (${name}) on node ${node}`);

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

    // Create VM
    const createParams = new URLSearchParams({
      vmid: vmid.toString(),
      name: name,
      cores: (cores || 2).toString(),
      memory: (memory || 2048).toString(),
      ostype: ostype || 'l26',
      net0: 'virtio,bridge=vmbr0',
    });

    if (disk) {
      createParams.append('scsi0', `local-lvm:${disk}`);
    }

    const createResponse = await fetch(`${PROXMOX_HOST}/api2/json/nodes/${node}/qemu`, {
      method: 'POST',
      headers: {
        'Cookie': `PVEAuthCookie=${ticket}`,
        'CSRFPreventionToken': csrfToken,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: createParams,
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error('VM creation failed:', errorText);
      throw new Error(`Failed to create VM: ${createResponse.status}`);
    }

    const result = await createResponse.json();

    console.log(`Successfully created VM ${vmid}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        vmid,
        name,
        node,
        upid: result.data
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in proxmox-create-vm:', error);
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
