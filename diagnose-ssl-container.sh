#!/bin/bash

# SSL Container Diagnosis Script
# Checks SSL configuration inside the Docker container

echo "🔍 Checking SSL in Docker Container"
echo "===================================="
echo ""

# Check if container is running
if ! docker ps | grep -q rexcloud-frontend; then
    echo "❌ Frontend container is not running"
    echo "   Start with: docker-compose up -d"
    exit 1
fi

echo "1️⃣  Container Logs (last 50 lines)"
echo "==================================="
docker logs rexcloud-frontend --tail 50
echo ""

echo "2️⃣  Nginx Error Logs"
echo "===================="
docker exec rexcloud-frontend cat /var/log/nginx/error.log 2>/dev/null || echo "No error log found"
echo ""

echo "3️⃣  SSL Certificate Files in Container"
echo "======================================="
echo "Checking /etc/nginx/ssl/ directory..."
docker exec rexcloud-frontend ls -la /etc/nginx/ssl/ 2>/dev/null || echo "❌ SSL directory not found in container"
echo ""

echo "4️⃣  Nginx Configuration in Container"
echo "====================================="
docker exec rexcloud-frontend cat /etc/nginx/conf.d/default.conf 2>/dev/null || echo "❌ Config not found"
echo ""

echo "5️⃣  Test Nginx Configuration"
echo "============================="
docker exec rexcloud-frontend nginx -t 2>&1
echo ""

echo "6️⃣  SSL Certificate Validity (in container)"
echo "==========================================="
docker exec rexcloud-frontend openssl x509 -in /etc/nginx/ssl/fullchain.pem -noout -subject -dates 2>/dev/null || echo "❌ Cannot read certificate in container"
echo ""

echo "7️⃣  Port Bindings"
echo "================="
docker port rexcloud-frontend
echo ""

echo "📋 Recommended Actions"
echo "====================="
echo "If SSL files are missing in container:"
echo "  1. Check docker-compose.yml volume mounts"
echo "  2. Restart containers: docker-compose restart"
echo ""
echo "If nginx config test fails:"
echo "  3. Fix nginx.conf and reload: docker-compose exec frontend nginx -s reload"
echo ""
echo "View real-time logs:"
echo "  docker logs -f rexcloud-frontend"
echo ""
