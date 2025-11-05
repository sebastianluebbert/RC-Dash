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
    const { node, scriptUrl, scriptName } = await req.json();

    if (!node || !scriptUrl) {
      throw new Error('Missing required parameters: node, scriptUrl');
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
      throw new Error(`Proxmox Node '${node}' nicht gefunden.`);
    }

    const PROXMOX_HOST = nodeConfig.host;
    const PROXMOX_USERNAME = nodeConfig.username;
    const PROXMOX_PASSWORD = nodeConfig.password;

    console.log(`Executing helper script ${scriptName} on node ${node}`);

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

    // Execute the script via Proxmox API
    // We use the execute endpoint to run bash commands
    const command = `bash -c "$(wget -qLO - ${scriptUrl})"`;
    
    const executeResponse = await fetch(
      `${PROXMOX_HOST}/api2/json/nodes/${node}/execute`,
      {
        method: 'POST',
        headers: {
          'Cookie': `PVEAuthCookie=${ticket}`,
          'CSRFPreventionToken': csrfToken,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          commands: command,
        }),
      }
    );

    if (!executeResponse.ok) {
      const errorText = await executeResponse.text();
      console.error('Script execution failed:', errorText);
      throw new Error(`Failed to execute script: ${executeResponse.status}`);
    }

    const executeData = await executeResponse.json();
    console.log(`Script execution started successfully`);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: `Script ${scriptName} wird ausgeführt`,
        data: executeData.data
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in proxmox-execute-script:', error);
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
