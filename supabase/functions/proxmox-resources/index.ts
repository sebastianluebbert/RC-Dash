import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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

  try {
    // Authenticate and authorize admin
    const authResult = await authenticateAdmin(req, corsHeaders);
    if (!authResult.success) {
      return authResult.response;
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get all Proxmox nodes from database
    const { data: nodes, error: nodesError } = await supabase
      .from('proxmox_nodes')
      .select('*');

    if (nodesError) throw nodesError;
    
    if (!nodes || nodes.length === 0) {
      throw new Error('Keine Proxmox-Server konfiguriert. Bitte fügen Sie einen Server in den Einstellungen hinzu.');
    }

    console.log(`Found ${nodes.length} Proxmox nodes`);
    
    const allVMs: any[] = [];

    // Process each node
    for (const node of nodes) {
      const PROXMOX_HOST = node.host;
      const PROXMOX_USERNAME = node.username;
      
      // Decrypt password
      const { data: decryptedPassword, error: decryptError } = await supabase
        .rpc('decrypt_value', { encrypted_text: node.password_encrypted });

      if (decryptError || !decryptedPassword) {
        console.error(`Failed to decrypt password for node ${node.name}`);
        continue;
      }

      const PROXMOX_PASSWORD = decryptedPassword;

      console.log(`Processing node: ${node.name} at ${PROXMOX_HOST}`);

      // Get auth ticket for this node
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
        console.error(`Authentication failed for node ${node.name}`);
        continue;
      }

      const authData = await authResponse.json();
      const ticket = authData.data.ticket;

      // Get cluster resources for this node
      console.log(`Fetching resources from ${node.name}`);
      const resourcesResponse = await fetch(`${PROXMOX_HOST}/api2/json/cluster/resources`, {
        headers: {
          'Cookie': `PVEAuthCookie=${ticket}`,
        },
      });

      if (!resourcesResponse.ok) {
        console.error(`Failed to fetch resources from ${node.name}`);
        continue;
      }

      const resourcesData = await resourcesResponse.json();
      const resources = resourcesData.data || [];
      
      // Filter for VMs and Containers from this node
      const nodeVMs = resources.filter((r: any) => 
        (r.type === 'qemu' || r.type === 'lxc') && r.node === node.name
      );
      
      allVMs.push(...nodeVMs);
    }

    console.log(`Total resources found: ${allVMs.length}`);

    // Update or insert servers
    const serverUpdates = allVMs.map((vm: any) => ({
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
      JSON.stringify({ error: 'An error occurred while fetching resources' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
