import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authenticateAdmin } from '../_shared/auth.ts';
import { proxmoxCreateVMSchema } from '../_shared/validation.ts';

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
    const validated = proxmoxCreateVMSchema.parse(body);
    const { node, vmid, name, cores, memory, disk, ostype } = validated;

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
      throw new Error(`Proxmox authentication failed`);
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
      console.error('VM creation failed');
      throw new Error(`Failed to create VM`);
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
      JSON.stringify({ error: 'An error occurred while creating VM' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
