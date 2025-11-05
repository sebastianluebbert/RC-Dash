#!/bin/bash

# SSL Certificate Setup Script for RexCloud
# Uses Let's Encrypt with Certbot

set -e

echo "🔒 SSL Certificate Setup for RexCloud"
echo "======================================"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
   echo "❌ Please run as root (use sudo)"
   exit 1
fi

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ .env file not found. Please run ./install.sh first."
    exit 1
fi

# Source environment variables
source .env

# Prompt for domain
read -p "Enter your domain name (e.g., dashboard.example.com): " DOMAIN
if [ -z "$DOMAIN" ]; then
    echo "❌ Domain cannot be empty"
    exit 1
fi

# Prompt for email
read -p "Enter your email address for Let's Encrypt notifications: " EMAIL
if [ -z "$EMAIL" ]; then
    echo "❌ Email cannot be empty"
    exit 1
fi

# Validate email format
if ! echo "$EMAIL" | grep -E '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$' > /dev/null; then
    echo "❌ Invalid email format"
    exit 1
fi

echo ""
echo "Domain: $DOMAIN"
echo "Email: $EMAIL"
echo ""
read -p "Is this correct? (y/n): " CONFIRM
if [ "$CONFIRM" != "y" ]; then
    echo "❌ Setup cancelled"
    exit 1
fi

# Install certbot if not already installed
echo ""
echo "ℹ️  Checking for certbot..."
if ! command -v certbot &> /dev/null; then
    echo "📦 Installing certbot..."
    apt-get update
    apt-get install -y certbot
else
    echo "✓ certbot already installed"
fi

# Create directories for certificates
mkdir -p ./nginx/ssl
mkdir -p ./certbot/www
mkdir -p ./certbot/conf

# Stop containers if running
echo ""
echo "ℹ️  Stopping containers..."
docker-compose down || true

# Create temporary nginx config for certificate challenge
echo "ℹ️  Creating temporary nginx configuration..."
cat > nginx-ssl-challenge.conf << 'EOF'
server {
    listen 80;
    server_name _;
    
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    
    location / {
        return 301 https://$host$request_uri;
    }
}
EOF

# Start temporary nginx for challenge
echo "ℹ️  Starting temporary nginx for certificate challenge..."
docker run -d --name nginx-certbot-temp \
    -p 80:80 \
    -v $(pwd)/nginx-ssl-challenge.conf:/etc/nginx/conf.d/default.conf:ro \
    -v $(pwd)/certbot/www:/var/www/certbot:ro \
    nginx:alpine

# Wait for nginx to start
sleep 3

# Obtain certificate
echo ""
echo "🔐 Obtaining SSL certificate from Let's Encrypt..."
certbot certonly \
    --webroot \
    --webroot-path $(pwd)/certbot/www \
    --email "$EMAIL" \
    --agree-tos \
    --no-eff-email \
    --non-interactive \
    --domain "$DOMAIN"

# Check if certificate was obtained
if [ ! -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
    echo "❌ Failed to obtain certificate"
    docker stop nginx-certbot-temp && docker rm nginx-certbot-temp
    exit 1
fi

# Stop temporary nginx
docker stop nginx-certbot-temp && docker rm nginx-certbot-temp

# Copy certificates to project directory
echo "📋 Copying certificates..."
cp -L /etc/letsencrypt/live/$DOMAIN/fullchain.pem ./nginx/ssl/
cp -L /etc/letsencrypt/live/$DOMAIN/privkey.pem ./nginx/ssl/

# Update nginx configuration with SSL
echo "⚙️  Updating nginx configuration..."
cat > nginx-ssl.conf << EOF
server {
    listen 80;
    server_name $DOMAIN;
    
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    
    location / {
        return 301 https://\$host\$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name $DOMAIN;
    root /usr/share/nginx/html;
    index index.html;

    # SSL Configuration
    ssl_certificate /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;
    
    # SSL Security Settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/json application/javascript;

    # Handle React Router
    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # API proxy to backend
    location /api {
        proxy_pass http://backend:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF

# Replace nginx.conf
cp nginx-ssl.conf nginx.conf

# Save SSL configuration to .env
echo "" >> .env
echo "# SSL Configuration" >> .env
echo "SSL_ENABLED=true" >> .env
echo "SSL_DOMAIN=$DOMAIN" >> .env
echo "SSL_EMAIL=$EMAIL" >> .env

# Update docker-compose for SSL
echo "⚙️  Updating docker-compose.yml..."
if [ ! -f "docker-compose.yml.backup" ]; then
    cp docker-compose.yml docker-compose.yml.backup
    echo "✓ Backup created: docker-compose.yml.backup"
fi

# Create updated docker-compose.yml with SSL configuration
python3 - <<EOF
import yaml
import sys

try:
    with open('docker-compose.yml', 'r') as f:
        config = yaml.safe_load(f)
    
    frontend = config['services']['frontend']
    
    # Add port 443 if not present
    if 'ports' in frontend:
        ports = frontend['ports']
        if '443:443' not in ports and '"443:443"' not in str(ports):
            frontend['ports'].append('443:443')
            print("✓ Added port 443")
    
    # Add volumes if not present
    if 'volumes' not in frontend:
        frontend['volumes'] = []
    
    volumes = frontend['volumes']
    ssl_vol = './nginx/ssl:/etc/nginx/ssl:ro'
    certbot_vol = './certbot/www:/var/www/certbot:ro'
    
    if ssl_vol not in volumes:
        frontend['volumes'].append(ssl_vol)
        print("✓ Added SSL volume mount")
    
    if certbot_vol not in volumes:
        frontend['volumes'].append(certbot_vol)
        print("✓ Added Certbot volume mount")
    
    with open('docker-compose.yml', 'w') as f:
        yaml.dump(config, f, default_flow_style=False, sort_keys=False)
    
    print("✓ docker-compose.yml updated successfully")
    
except Exception as e:
    print(f"⚠️  Python YAML update failed: {e}")
    print("Falling back to sed commands...")
    sys.exit(1)
EOF

# Fallback to sed if Python fails
if [ $? -ne 0 ]; then
    if ! grep -q "443:443" docker-compose.yml; then
        sed -i '/ports:/a\      - "443:443"' docker-compose.yml
    fi
    if ! grep -q "nginx/ssl" docker-compose.yml; then
        sed -i '/nginx.conf:/a\      - ./nginx/ssl:/etc/nginx/ssl:ro' docker-compose.yml
        sed -i '/nginx.conf:/a\      - ./certbot/www:/var/www/certbot:ro' docker-compose.yml
    fi
fi

# Setup auto-renewal cron job
echo "⏰ Setting up automatic certificate renewal..."
CRON_JOB="0 0,12 * * * certbot renew --quiet --deploy-hook 'cd $(pwd) && ./renew-ssl.sh'"
(crontab -l 2>/dev/null | grep -v "certbot renew"; echo "$CRON_JOB") | crontab -

# Create renewal script
cat > renew-ssl.sh << EOF
#!/bin/bash
# SSL Certificate Renewal Script

DOMAIN="$DOMAIN"
PROJECT_DIR="$(pwd)"

# Copy renewed certificates
cp -L /etc/letsencrypt/live/\$DOMAIN/fullchain.pem \$PROJECT_DIR/nginx/ssl/
cp -L /etc/letsencrypt/live/\$DOMAIN/privkey.pem \$PROJECT_DIR/nginx/ssl/

# Reload nginx
cd \$PROJECT_DIR
docker-compose exec frontend nginx -s reload

echo "\$(date): SSL certificate renewed and nginx reloaded" >> \$PROJECT_DIR/ssl-renewal.log
EOF

chmod +x renew-ssl.sh

# Start containers with SSL
echo ""
echo "🚀 Starting RexCloud with SSL..."
docker-compose up -d

echo ""
echo "✅ SSL Setup Complete!"
echo ""
echo "📝 Configuration Summary:"
echo "   Domain: $DOMAIN"
echo "   Email: $EMAIL"
echo "   Certificate: /etc/letsencrypt/live/$DOMAIN/"
echo "   Auto-renewal: Enabled (runs twice daily)"
echo ""
echo "🌐 Your RexCloud instance is now accessible at:"
echo "   https://$DOMAIN"
echo ""
echo "📋 Certificate will be automatically renewed before expiration."
echo "   Check renewal logs: tail -f ssl-renewal.log"
echo ""
