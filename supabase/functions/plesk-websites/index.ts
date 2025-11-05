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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { serverId } = await req.json();

    console.log(`Fetching websites for Plesk server: ${serverId}`);

    // Get server credentials
    const { data: server, error: serverError } = await supabase
      .from('plesk_servers')
      .select('*')
      .eq('id', serverId)
      .single();

    if (serverError) throw serverError;

    const { detailsOnly } = await req.json().catch(() => ({}));

    // Create Basic Auth header
    const authString = btoa(`${server.username}:${server.password}`);
    
    // Fetch domains from Plesk API
    const response = await fetch(`${server.host}:${server.port}/api/v2/domains`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${authString}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Plesk API error:', errorText);
      throw new Error(`Plesk API error: ${response.status}`);
    }

    const domains = await response.json();
    console.log(`Successfully fetched ${domains.length || 0} domains`);

    // Create a map of clients by fetching detailed domain info
    const clientsMap = new Map();
    const domainsWithClient = [];
    
    console.log('Fetching detailed domain information with client data...');
    
    for (const domain of domains) {
      try {
        // Fetch detailed domain info which includes owner_client
        const detailResponse = await fetch(`${server.host}:${server.port}/api/v2/domains/${domain.id}`, {
          method: 'GET',
          headers: {
            'Authorization': `Basic ${authString}`,
            'Content-Type': 'application/json',
          },
        });

        if (detailResponse.ok) {
          const detailData = await detailResponse.json();
          
          // Add client to map if exists
          if (detailData.owner_client) {
            const clientId = detailData.owner_client.id;
            if (!clientsMap.has(clientId)) {
              clientsMap.set(clientId, {
                id: clientId,
                name: detailData.owner_client.company || detailData.owner_client.login || 'Unbenannt',
                company: detailData.owner_client.company,
                email: detailData.owner_client.email,
                login: detailData.owner_client.login,
              });
            }
          }
          
          domainsWithClient.push({
            ...domain,
            client_id: detailData.owner_client?.id,
          });
        } else {
          // If detail fetch fails, add domain without client info
          domainsWithClient.push(domain);
        }
      } catch (error) {
        console.error(`Error fetching details for domain ${domain.name}:`, error);
        domainsWithClient.push(domain);
      }
    }
    
    console.log(`Found ${clientsMap.size} unique clients from ${domainsWithClient.length} domains`);

    // For each domain, check if WordPress is installed via WP Toolkit
    const websitesWithWP = [];
    
    console.log(`Checking WordPress installations for ${domainsWithClient.length} domains...`);
    
    for (const domain of domainsWithClient) {
      try {
        console.log(`Checking WordPress for domain: ${domain.name}`);
        
        // Check WP Toolkit installations - try multiple API endpoints
        // First try: wp-toolkit installations endpoint
        let wpUrl = `${server.host}:${server.port}/api/v2/extensions/wp-toolkit/installations`;
        console.log(`Trying WP Toolkit API: ${wpUrl}`);
        
        const wpResponse = await fetch(wpUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Basic ${authString}`,
            'Content-Type': 'application/json',
          },
        });

        console.log(`WP Toolkit response status for ${domain.name}: ${wpResponse.status}`);

        if (wpResponse.ok) {
          const wpData = await wpResponse.json();
          console.log(`WP Toolkit data type: ${Array.isArray(wpData) ? 'array' : typeof wpData}`);
          console.log(`WP Toolkit data length: ${wpData.length || 0}`);
          
          // Check if this domain has any WordPress installations
          let domainWpInstallations = [];
          if (Array.isArray(wpData)) {
            domainWpInstallations = wpData.filter(wp => {
              const wpDomain = wp.domain || wp.main_domain || wp.url;
              return wpDomain && wpDomain.includes(domain.name);
            });
          }
          
          console.log(`Found ${domainWpInstallations.length} WP installations for ${domain.name}`);
          
          // Get client info for this domain
          const clientInfo = domain.client_id ? clientsMap.get(domain.client_id) : null;
          
          if (domainWpInstallations.length > 0) {
            console.log(`WordPress found on ${domain.name}:`, domainWpInstallations[0]);
            websitesWithWP.push({
              ...domain,
              wordpress: domainWpInstallations[0],
              hasWordPress: true,
              client: clientInfo ? {
                id: clientInfo.id,
                name: clientInfo.name || clientInfo.company || 'Unbenannt',
                company: clientInfo.company,
                email: clientInfo.email,
              } : null,
            });
          } else {
            websitesWithWP.push({
              ...domain,
              hasWordPress: false,
              client: clientInfo ? {
                id: clientInfo.id,
                name: clientInfo.name || clientInfo.company || 'Unbenannt',
                company: clientInfo.company,
                email: clientInfo.email,
              } : null,
            });
          }
        } else {
          const errorText = await wpResponse.text();
          console.error(`WP Toolkit API error for ${domain.name}:`, errorText);
          const clientInfo = domain.client_id ? clientsMap.get(domain.client_id) : null;
          websitesWithWP.push({
            ...domain,
            hasWordPress: false,
            client: clientInfo ? {
              id: clientInfo.id,
              name: clientInfo.name || clientInfo.company || 'Unbenannt',
              company: clientInfo.company,
              email: clientInfo.email,
            } : null,
          });
        }
      } catch (wpError) {
        console.error(`Error checking WordPress for ${domain.name}:`, wpError);
        const clientInfo = domain.client_id ? clientsMap.get(domain.client_id) : null;
        websitesWithWP.push({
          ...domain,
          hasWordPress: false,
          client: clientInfo ? {
            id: clientInfo.id,
            name: clientInfo.name || clientInfo.company || 'Unbenannt',
            company: clientInfo.company,
            email: clientInfo.email,
          } : null,
        });
      }
    }
    
    const wpCount = websitesWithWP.filter(w => w.hasWordPress).length;
    console.log(`Total WordPress installations found: ${wpCount} out of ${domainsWithClient.length} domains`);

    return new Response(
      JSON.stringify({ websites: websitesWithWP }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in plesk-websites function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});