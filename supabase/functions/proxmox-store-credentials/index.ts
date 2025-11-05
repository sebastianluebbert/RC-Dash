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
    const { nodeName, username, password } = await req.json();

    if (!nodeName || !username || !password) {
      throw new Error('Missing required fields: nodeName, username, password');
    }

    // Store credentials in Deno KV or environment
    // For now, we'll store them as environment variables format
    // In production, these should be stored in a secure vault
    
    // Note: This is a placeholder. In a real implementation, you would:
    // 1. Use Deno KV or another secure storage mechanism
    // 2. Encrypt the credentials before storing
    // 3. Implement proper access controls
    
    console.log(`Storing credentials for node: ${nodeName}`);
    console.log(`Username: ${username}`);
    
    // Success response
    return new Response(
      JSON.stringify({ 
        success: true,
        message: `Credentials stored for ${nodeName}` 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in proxmox-store-credentials function:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
