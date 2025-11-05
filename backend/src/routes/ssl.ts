import { Router } from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile, access } from 'fs/promises';
import { constants } from 'fs';
import path from 'path';

const execAsync = promisify(exec);
const router = Router();

interface CertificateInfo {
  domain: string;
  issuer: string;
  validFrom: string;
  validTo: string;
  daysRemaining: number;
  autoRenewalEnabled: boolean;
  lastRenewal: string | null;
}

// Get SSL certificate status
router.get('/status', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const domain = process.env.SSL_DOMAIN;
    
    if (!domain) {
      return res.json({
        enabled: false,
        message: 'SSL not configured'
      });
    }

    // Check if certificate files exist
    const certPath = `/etc/letsencrypt/live/${domain}/fullchain.pem`;
    const keyPath = `/etc/letsencrypt/live/${domain}/privkey.pem`;

    try {
      await access(certPath, constants.R_OK);
      await access(keyPath, constants.R_OK);
    } catch (error) {
      return res.json({
        enabled: false,
        domain,
        message: 'Certificate files not found'
      });
    }

    // Get certificate details using openssl
    const { stdout: certInfo } = await execAsync(
      `openssl x509 -in ${certPath} -noout -issuer -dates -subject`
    );

    // Parse certificate info
    const issuerMatch = certInfo.match(/issuer=(.+)/);
    const validFromMatch = certInfo.match(/notBefore=(.+)/);
    const validToMatch = certInfo.match(/notAfter=(.+)/);
    const subjectMatch = certInfo.match(/subject=(.+)/);

    const validTo = validToMatch ? new Date(validToMatch[1]) : null;
    const daysRemaining = validTo 
      ? Math.floor((validTo.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : 0;

    // Check last renewal from log
    let lastRenewal = null;
    try {
      const renewalLog = await readFile(
        path.join(__dirname, '../../../ssl-renewal.log'),
        'utf-8'
      );
      const lines = renewalLog.trim().split('\n');
      if (lines.length > 0) {
        const lastLine = lines[lines.length - 1];
        const dateMatch = lastLine.match(/^([^:]+):/);
        if (dateMatch) {
          lastRenewal = dateMatch[1];
        }
      }
    } catch (error) {
      // No renewal log yet
    }

    // Check if auto-renewal is enabled
    const { stdout: cronList } = await execAsync('crontab -l 2>/dev/null || echo ""');
    const autoRenewalEnabled = cronList.includes('certbot renew');

    const certificateInfo: CertificateInfo = {
      domain,
      issuer: issuerMatch ? issuerMatch[1].replace(/^.*CN\s*=\s*/, '') : 'Unknown',
      validFrom: validFromMatch ? validFromMatch[1] : 'Unknown',
      validTo: validToMatch ? validToMatch[1] : 'Unknown',
      daysRemaining,
      autoRenewalEnabled,
      lastRenewal
    };

    res.json({
      enabled: true,
      certificate: certificateInfo,
      needsRenewal: daysRemaining < 30
    });
  } catch (error) {
    console.error('Error getting SSL status:', error);
    res.status(500).json({ error: 'Failed to get SSL status' });
  }
});

// Renew SSL certificate manually
router.post('/renew', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const domain = process.env.SSL_DOMAIN;
    
    if (!domain) {
      return res.status(400).json({ error: 'SSL not configured' });
    }

    // Run certbot renew
    const { stdout, stderr } = await execAsync('certbot renew --force-renewal');
    
    // Run renewal script to copy certificates and reload nginx
    const renewalScript = path.join(__dirname, '../../../renew-ssl.sh');
    try {
      await access(renewalScript, constants.X_OK);
      await execAsync(`bash ${renewalScript}`);
    } catch (error) {
      console.warn('Renewal script not found or not executable');
    }

    res.json({
      success: true,
      message: 'Certificate renewed successfully',
      output: stdout
    });
  } catch (error: any) {
    console.error('Error renewing certificate:', error);
    res.status(500).json({ 
      error: 'Failed to renew certificate',
      details: error.stderr || error.message
    });
  }
});

// Test certificate configuration
router.post('/test', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const domain = process.env.SSL_DOMAIN;
    
    if (!domain) {
      return res.status(400).json({ error: 'SSL not configured' });
    }

    // Test nginx configuration
    const { stdout: nginxTest } = await execAsync(
      'docker-compose exec -T frontend nginx -t 2>&1 || echo "nginx test failed"'
    );

    // Test certificate validity
    const certPath = `/etc/letsencrypt/live/${domain}/fullchain.pem`;
    const { stdout: certTest } = await execAsync(
      `openssl x509 -in ${certPath} -noout -checkend 2592000`
    );

    const nginxOk = nginxTest.includes('successful');
    const certValid = certTest.includes('will not expire');

    res.json({
      nginxConfiguration: nginxOk ? 'valid' : 'invalid',
      certificateValidity: certValid ? 'valid (30+ days)' : 'expiring soon',
      details: {
        nginx: nginxTest,
        certificate: certTest
      }
    });
  } catch (error) {
    console.error('Error testing certificate:', error);
    res.status(500).json({ error: 'Failed to test certificate' });
  }
});

// Get renewal history
router.get('/history', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const logPath = path.join(__dirname, '../../../ssl-renewal.log');
    
    try {
      const logContent = await readFile(logPath, 'utf-8');
      const entries = logContent
        .trim()
        .split('\n')
        .filter(line => line)
        .map(line => {
          const match = line.match(/^([^:]+): (.+)/);
          return match ? {
            timestamp: match[1],
            message: match[2]
          } : null;
        })
        .filter(entry => entry !== null)
        .reverse(); // Most recent first

      res.json({
        entries,
        total: entries.length
      });
    } catch (error) {
      // No log file yet
      res.json({
        entries: [],
        total: 0
      });
    }
  } catch (error) {
    console.error('Error reading renewal history:', error);
    res.status(500).json({ error: 'Failed to read renewal history' });
  }
});

export { router as sslRouter };
