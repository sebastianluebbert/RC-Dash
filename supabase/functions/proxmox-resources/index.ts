import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProxmoxResource {
  vmid: number;
  name: string;
  node: string;
  type: 'qemu' | 'lxc';
  status: string;
  cpu?: number;
  mem?: number;
  maxmem?: number;
  disk?: number;
  maxdisk?: number;
  uptime?: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const PROXMOX_HOST = Deno.env.get('PROXMOX_HOST');
    const PROXMOX_USERNAME = Deno.env.get('PROXMOX_USERNAME');
    const PROXMOX_PASSWORD = Deno.env.get('PROXMOX_PASSWORD');

    if (!PROXMOX_HOST || !PROXMOX_USERNAME || !PROXMOX_PASSWORD) {
      throw new Error('Proxmox credentials not configured');
    }

    console.log('Connecting to Proxmox:', PROXMOX_HOST);

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
      const errorText = await authResponse.text();
      console.error('Proxmox auth failed:', errorText);
      throw new Error(`Proxmox authentication failed: ${authResponse.status}`);
    }

    const authData = await authResponse.json();
    const ticket = authData.data.ticket;
    const csrfToken = authData.data.CSRFPreventionToken;

    console.log('Proxmox authenticated successfully');

    // Get cluster resources
    const resourcesResponse = await fetch(`${PROXMOX_HOST}/api2/json/cluster/resources`, {
      headers: {
        'Cookie': `PVEAuthCookie=${ticket}`,
        'CSRFPreventionToken': csrfToken,
      },
    });

    if (!resourcesResponse.ok) {
      throw new Error(`Failed to fetch resources: ${resourcesResponse.status}`);
    }

    const resourcesData = await resourcesResponse.json();
    const resources = resourcesData.data as ProxmoxResource[];

    console.log('Found resources:', resources.length);

    // Filter for VMs and Containers only
    const vms = resources.filter(r => r.type === 'qemu' || r.type === 'lxc');

    console.log('VMs and Containers:', vms.length);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Update or insert servers
    const serverUpdates = vms.map(vm => ({
      vmid: vm.vmid,
      name: vm.name || `VM-${vm.vmid}`,
      node: vm.node,
      type: vm.type,
      status: vm.status,
      cpu_usage: vm.cpu ? vm.cpu * 100 : null,
      memory_usage: vm.mem ? Math.round(vm.mem / 1024 / 1024) : null,
      memory_total: vm.maxmem ? Math.round(vm.maxmem / 1024 / 1024) : null,
      disk_usage: vm.disk ? Math.round(vm.disk / 1024 / 1024 / 1024) : null,
      disk_total: vm.maxdisk ? Math.round(vm.maxdisk / 1024 / 1024 / 1024) : null,
      uptime: vm.uptime || null,
      last_sync: new Date().toISOString(),
    }));

    // Upsert servers
    const { error: upsertError } = await supabase
      .from('servers')
      .upsert(serverUpdates, { 
        onConflict: 'vmid,node'
      });

    if (upsertError) {
      console.error('Error upserting servers:', upsertError);
      throw upsertError;
    }

    console.log('Successfully upserted all servers');

    // Get all servers from database
    const { data: allServers, error: fetchError } = await supabase
      .from('servers')
      .select('*')
      .order('vmid', { ascending: true });

    if (fetchError) {
      throw fetchError;
    }

    console.log('Successfully synced servers');

    return new Response(
      JSON.stringify({ 
        success: true, 
        servers: allServers,
        synced: serverUpdates.length 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in proxmox-resources:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : undefined
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
