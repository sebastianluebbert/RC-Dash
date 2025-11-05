import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  const { headers } = req;
  const upgradeHeader = headers.get("upgrade") || "";

  if (upgradeHeader.toLowerCase() !== "websocket") {
    return new Response("Expected WebSocket connection", { status: 400 });
  }

  try {
    // Get query parameters
    const url = new URL(req.url);
    const node = url.searchParams.get('node');
    const vmid = url.searchParams.get('vmid');
    const type = url.searchParams.get('type');

    if (!node || !vmid || !type) {
      return new Response("Missing parameters", { status: 400 });
    }

    console.log(`WebSocket proxy request for ${type} ${vmid} on node ${node}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get Proxmox node configuration from database
    const { data: nodeConfig, error: nodeError } = await supabase
      .from('proxmox_nodes')
      .select('*')
      .eq('name', node)
      .maybeSingle();

    if (nodeError || !nodeConfig) {
      return new Response('Proxmox node not found', { status: 500 });
    }

    const PROXMOX_HOST = nodeConfig.host;
    const PROXMOX_USERNAME = nodeConfig.username;
    const PROXMOX_PASSWORD = nodeConfig.password;

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
      return new Response('Proxmox authentication failed', { status: 500 });
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
      return new Response('Failed to get VNC ticket', { status: 500 });
    }

    const vncData = await vncResponse.json();
    console.log(`VNC ticket obtained, port: ${vncData.data.port}`);

    // Upgrade client WebSocket
    const { socket: clientSocket, response } = Deno.upgradeWebSocket(req);
    
    // Build Proxmox WebSocket URL
    const wsProtocol = PROXMOX_HOST.startsWith('https://') ? 'wss://' : 'ws://';
    const hostWithoutProtocol = PROXMOX_HOST.replace('https://', '').replace('http://', '');
    const proxmoxWsUrl = `${wsProtocol}${hostWithoutProtocol}/api2/json/nodes/${node}/${type}/${vmid}/vncwebsocket?port=${vncData.data.port}&vncticket=${encodeURIComponent(vncData.data.ticket)}`;

    console.log('Connecting to Proxmox WebSocket...');

    // Connect to Proxmox WebSocket
    let proxmoxSocket: WebSocket | null = null;

    clientSocket.onopen = () => {
      console.log('Client WebSocket connected');
      try {
        proxmoxSocket = new WebSocket(proxmoxWsUrl);

        proxmoxSocket.onopen = () => {
          console.log('Proxmox WebSocket connected');
        };

        proxmoxSocket.onmessage = (event) => {
          if (clientSocket.readyState === WebSocket.OPEN) {
            clientSocket.send(event.data);
          }
        };

        proxmoxSocket.onerror = (error) => {
          console.error('Proxmox WebSocket error:', error);
          clientSocket.close(1011, 'Proxmox connection error');
        };

        proxmoxSocket.onclose = () => {
          console.log('Proxmox WebSocket closed');
          clientSocket.close();
        };
      } catch (error) {
        console.error('Failed to connect to Proxmox:', error);
        clientSocket.close(1011, 'Failed to connect to Proxmox');
      }
    };

    clientSocket.onmessage = (event) => {
      if (proxmoxSocket && proxmoxSocket.readyState === WebSocket.OPEN) {
        proxmoxSocket.send(event.data);
      }
    };

    clientSocket.onclose = () => {
      console.log('Client WebSocket closed');
      if (proxmoxSocket) {
        proxmoxSocket.close();
      }
    };

    clientSocket.onerror = (error) => {
      console.error('Client WebSocket error:', error);
      if (proxmoxSocket) {
        proxmoxSocket.close();
      }
    };

    return response;

  } catch (error) {
    console.error('WebSocket proxy error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), 
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
});
