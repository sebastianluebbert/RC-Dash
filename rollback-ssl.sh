#!/bin/bash

# SSL Rollback Script for RexCloud
# Disables SSL and restores HTTP-only configuration

set -e

echo "🔄 Rolling back SSL configuration..."
echo "======================================"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
   echo "❌ Please run as root (use sudo)"
   exit 1
fi

# Stop containers
echo "⏹️  Stopping containers..."
docker-compose down || true

# Restore original nginx configuration
if [ -f "nginx.conf.backup" ]; then
    echo "📋 Restoring original nginx.conf..."
    cp nginx.conf.backup nginx.conf
else
    echo "📝 Creating fresh HTTP-only nginx.conf..."
    cat > nginx.conf << 'EOF'
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/json application/javascript;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Handle React Router
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API proxy to backend
    location /api {
        proxy_pass http://backend:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF
fi

# Restore original docker-compose.yml
if [ -f "docker-compose.yml.backup" ]; then
    echo "📋 Restoring original docker-compose.yml..."
    cp docker-compose.yml.backup docker-compose.yml
else
    echo "⚠️  No backup found for docker-compose.yml - keeping current"
fi

# Remove SSL configuration from .env
if [ -f ".env" ]; then
    echo "🔧 Removing SSL variables from .env..."
    sed -i '/# SSL Configuration/d' .env
    sed -i '/SSL_ENABLED/d' .env
    sed -i '/SSL_DOMAIN/d' .env
    sed -i '/SSL_EMAIL/d' .env
fi

# Remove auto-renewal cron job
echo "⏰ Removing auto-renewal cron job..."
crontab -l 2>/dev/null | grep -v "certbot renew" | crontab - || true

# Clean up SSL-related files
echo "🧹 Cleaning up SSL files..."
rm -f nginx-ssl.conf nginx-ssl-challenge.conf renew-ssl.sh

# Start containers
echo "🚀 Starting RexCloud without SSL..."
docker-compose up -d

echo ""
echo "✅ SSL Rollback Complete!"
echo ""
echo "🌐 Your RexCloud instance is now accessible at:"
echo "   http://localhost"
echo ""
echo "📝 SSL certificates and configuration have been disabled."
echo "   To re-enable SSL, run: sudo ./setup-ssl.sh"
echo ""
