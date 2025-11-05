#!/bin/bash

# SSL Diagnosis Script for RexCloud
# Checks DNS, Nginx config, and SSL certificate status

set -e

echo "🔍 SSL Diagnosis for RexCloud"
echo "=============================="
echo ""

# Check if .env exists and read SSL domain
if [ -f .env ]; then
    SSL_DOMAIN=$(grep "^SSL_DOMAIN=" .env 2>/dev/null | cut -d'=' -f2)
fi

if [ -z "$SSL_DOMAIN" ]; then
    read -p "Enter your domain name (e.g., servername.de): " SSL_DOMAIN
fi

echo "Diagnosing domain: $SSL_DOMAIN"
echo ""

# 1. DNS Check
echo "1️⃣  DNS Resolution Check"
echo "========================"
SERVER_IP=$(hostname -I | awk '{print $1}')
echo "Server IP: $SERVER_IP"
echo ""

RESOLVED_IP=$(dig +short $SSL_DOMAIN A | tail -n1)
if [ -z "$RESOLVED_IP" ]; then
    echo "❌ DNS A-Record not found for $SSL_DOMAIN"
    echo "   Action: Add A-Record pointing to $SERVER_IP in your DNS settings"
else
    echo "✓ DNS A-Record found: $RESOLVED_IP"
    if [ "$RESOLVED_IP" != "$SERVER_IP" ]; then
        echo "❌ DNS points to wrong IP!"
        echo "   Expected: $SERVER_IP"
        echo "   Found: $RESOLVED_IP"
        echo "   Action: Update your DNS A-Record to point to $SERVER_IP"
    else
        echo "✓ DNS correctly points to this server"
    fi
fi
echo ""

# 2. Nginx Configuration Check
echo "2️⃣  Nginx Configuration Check"
echo "============================="
if [ -f "nginx.conf" ]; then
    SERVER_NAME=$(grep "server_name" nginx.conf | head -1 | awk '{print $2}' | tr -d ';')
    echo "Configured server_name: $SERVER_NAME"
    
    if [ "$SERVER_NAME" = "_" ]; then
        echo "❌ Nginx is configured for any domain (server_name _)"
        echo "   Action: Run setup-ssl.sh to configure domain properly"
    elif [ "$SERVER_NAME" != "$SSL_DOMAIN" ]; then
        echo "❌ Nginx server_name doesn't match SSL domain!"
        echo "   Expected: $SSL_DOMAIN"
        echo "   Found: $SERVER_NAME"
    else
        echo "✓ Nginx server_name matches domain"
    fi
    
    if grep -q "listen 443 ssl" nginx.conf; then
        echo "✓ SSL is enabled in nginx.conf"
    else
        echo "❌ SSL not enabled in nginx.conf"
        echo "   Action: Run setup-ssl.sh to enable SSL"
    fi
else
    echo "❌ nginx.conf not found"
fi
echo ""

# 3. SSL Certificate Check
echo "3️⃣  SSL Certificate Check"
echo "========================="
if [ -f "/etc/letsencrypt/live/$SSL_DOMAIN/fullchain.pem" ]; then
    echo "✓ Certificate found for $SSL_DOMAIN"
    
    CERT_DOMAIN=$(openssl x509 -in /etc/letsencrypt/live/$SSL_DOMAIN/fullchain.pem -noout -subject | grep -oP 'CN\s*=\s*\K[^,]+')
    echo "Certificate issued for: $CERT_DOMAIN"
    
    VALID_UNTIL=$(openssl x509 -in /etc/letsencrypt/live/$SSL_DOMAIN/fullchain.pem -noout -enddate | cut -d= -f2)
    echo "Valid until: $VALID_UNTIL"
    
    DAYS_LEFT=$(( ($(date -d "$VALID_UNTIL" +%s) - $(date +%s)) / 86400 ))
    echo "Days remaining: $DAYS_LEFT"
    
    if [ $DAYS_LEFT -lt 30 ]; then
        echo "⚠️  Certificate expires soon - consider renewal"
    fi
else
    echo "❌ No certificate found for $SSL_DOMAIN"
    echo "   Action: Run setup-ssl.sh to obtain certificate"
fi
echo ""

# 4. Port Check
echo "4️⃣  Port Check"
echo "=============="
if netstat -tuln | grep -q ":443 "; then
    echo "✓ Port 443 (HTTPS) is listening"
else
    echo "❌ Port 443 (HTTPS) is not listening"
    echo "   Action: Check if nginx container is running: docker ps"
fi

if netstat -tuln | grep -q ":80 "; then
    echo "✓ Port 80 (HTTP) is listening"
else
    echo "❌ Port 80 (HTTP) is not listening"
fi
echo ""

# 5. Docker Status
echo "5️⃣  Docker Container Status"
echo "==========================="
docker ps --filter "name=rexcloud" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo ""

# 6. Firewall Check
echo "6️⃣  Firewall Check"
echo "=================="
if command -v ufw &> /dev/null; then
    UFW_STATUS=$(ufw status | grep "Status:" | awk '{print $2}')
    echo "UFW Status: $UFW_STATUS"
    if [ "$UFW_STATUS" = "active" ]; then
        echo "Checking firewall rules..."
        ufw status | grep -E "(80|443)/tcp" || echo "⚠️  Ports 80/443 might be blocked"
    fi
else
    echo "ℹ️  UFW not installed"
fi
echo ""

# Summary
echo "📋 Summary & Next Steps"
echo "======================="
echo "1. Verify DNS A-Record points to: $SERVER_IP"
echo "2. Ensure nginx server_name is: $SSL_DOMAIN"
echo "3. Check SSL certificate is valid for: $SSL_DOMAIN"
echo "4. Confirm ports 80 and 443 are open in firewall"
echo "5. Wait up to 72 hours for DNS propagation if you just changed DNS"
echo ""
echo "Test your domain:"
echo "  curl -I http://$SSL_DOMAIN"
echo "  curl -I https://$SSL_DOMAIN"
echo ""
