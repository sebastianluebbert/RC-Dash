import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authenticateAdmin } from '../_shared/auth.ts';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const requestSchema = z.object({
  serverId: z.string().uuid(),
  domainId: z.number().int().positive(),
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Authenticate and authorize admin
  const authResult = await authenticateAdmin(req, corsHeaders);
  if (!authResult.success) {
    return authResult.response;
  }

  try {
    const body = await req.json();
    const { serverId, domainId } = requestSchema.parse(body);
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`Fetching detailed information for domain ${domainId} on server ${serverId}`);

    // Get server credentials
    const { data: server, error: serverError } = await supabase
      .from('plesk_servers')
      .select('*')
      .eq('id', serverId)
      .single();

    if (serverError) throw serverError;

    const authString = btoa(`${server.username}:${server.password}`);
    const headers = {
      'Authorization': `Basic ${authString}`,
      'Content-Type': 'application/json',
    };

    // Fetch detailed domain information
    const domainResponse = await fetch(`${server.host}:${server.port}/api/v2/domains/${domainId}`, {
      method: 'GET',
      headers,
    });

    if (!domainResponse.ok) {
      throw new Error(`Failed to fetch domain details: ${domainResponse.status}`);
    }

    const domainDetails = await domainResponse.json();
    console.log('Domain details fetched successfully');

    // Fetch SSL certificates via CLI
    let sslCerts: any[] = [];
    try {
      const sslResponse = await fetch(`${server.host}:${server.port}/api/v2/cli/certificate/call`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          params: ['--list', '-domain-name', domainDetails.name]
        })
      });
      console.log(`SSL Response status: ${sslResponse.status}`);
      if (sslResponse.ok) {
        const sslData = await sslResponse.json();
        console.log('SSL raw response:', JSON.stringify(sslData));
        if (sslData.stdout) {
          sslCerts = [{ raw: sslData.stdout }];
        }
      } else {
        const errorText = await sslResponse.text();
        console.log(`SSL fetch failed:`, errorText);
      }
    } catch (error) {
      console.error('SSL certificates fetch error:', error);
    }

    // Fetch DNS records via CLI
    let dnsRecords: any[] = [];
    try {
      const dnsResponse = await fetch(`${server.host}:${server.port}/api/v2/cli/dns/call`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          params: ['--list', domainDetails.name]
        })
      });
      console.log(`DNS Response status: ${dnsResponse.status}`);
      if (dnsResponse.ok) {
        const dnsData = await dnsResponse.json();
        console.log('DNS raw response:', JSON.stringify(dnsData));
        if (dnsData.stdout) {
          // Parse DNS records from CLI output
          const lines = dnsData.stdout.split('\n').filter((line: string) => line.trim());
          dnsRecords = lines.slice(1).map((line: string) => {
            const parts = line.trim().split(/\s+/);
            return {
              host: parts[0] || '',
              type: parts[1] || '',
              value: parts.slice(2).join(' ') || ''
            };
          }).filter((record: any) => record.type);
        }
      } else {
        const errorText = await dnsResponse.text();
        console.log(`DNS fetch failed:`, errorText);
      }
    } catch (error) {
      console.error('DNS records fetch error:', error);
    }

    // Fetch databases via CLI
    let databases: any[] = [];
    try {
      const dbResponse = await fetch(`${server.host}:${server.port}/api/v2/cli/database/call`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          params: ['--list', '-domain-name', domainDetails.name]
        })
      });
      console.log(`Database Response status: ${dbResponse.status}`);
      if (dbResponse.ok) {
        const dbData = await dbResponse.json();
        console.log('Database raw response:', JSON.stringify(dbData));
        if (dbData.stdout) {
          // Parse database list from CLI output
          const lines = dbData.stdout.split('\n').filter((line: string) => line.trim());
          databases = lines.slice(1).map((line: string) => {
            const parts = line.trim().split(/\s+/);
            return {
              name: parts[0] || '',
              type: parts[1] || 'MySQL'
            };
          }).filter((db: any) => db.name);
        }
      } else {
        const errorText = await dbResponse.text();
        console.log(`Database fetch failed:`, errorText);
      }
    } catch (error) {
      console.error('Databases fetch error:', error);
    }

    // Extract hosting settings from domain details
    let hostingSettings = null;
    try {
      if (domainDetails.hosting) {
        hostingSettings = {
          ip_address: domainDetails.hosting.ip_address,
          ipv4: domainDetails.hosting.ip_address ? [domainDetails.hosting.ip_address] : [],
          ipv6: domainDetails.hosting.ipv6_address ? [domainDetails.hosting.ipv6_address] : [],
        };
      }
    } catch (error) {
      console.log('Hosting settings extraction failed:', error);
    }

    console.log(`Returning: SSL=${sslCerts.length}, DNS=${dnsRecords.length}, DB=${databases.length}`);

    return new Response(
      JSON.stringify({
        domain: domainDetails,
        sslCertificates: sslCerts,
        dnsRecords: dnsRecords,
        databases: databases,
        hostingSettings: hostingSettings,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in plesk-website-details function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
