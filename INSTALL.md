# RexCloud Installation Guide

Complete step-by-step guide for installing RexCloud on a fresh Linux VM.

## System Requirements

### Minimum Requirements
- **OS**: Debian 11+ or Ubuntu 20.04+
- **RAM**: 2GB minimum (4GB recommended)
- **Disk**: 20GB minimum (50GB recommended)
- **CPU**: 2 cores minimum
- **Network**: Public IPv4 address

### Software Requirements
- Docker 20.10+
- Docker Compose 2.0+
- Git
- OpenSSL

## Installation Methods

### Method 1: One-Line Installation (Recommended)

```bash
curl -fsSL https://raw.githubusercontent.com/yourusername/rexcloud/main/install.sh | bash
```

This script will:
1. Update system packages
2. Install Docker & Docker Compose
3. Clone RexCloud repository
4. Generate secure configuration
5. Build and start all containers
6. Run database migrations

### Method 2: Manual Installation

#### Step 1: Update System

```bash
sudo apt update && sudo apt upgrade -y
```

#### Step 2: Install Docker

```bash
# Install prerequisites
sudo apt install -y apt-transport-https ca-certificates curl gnupg lsb-release

# Add Docker's official GPG key
curl -fsSL https://download.docker.com/linux/$(lsb_release -is | tr '[:upper:]' '[:lower:]')/gpg | \
  sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

# Set up Docker repository
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] \
  https://download.docker.com/linux/$(lsb_release -is | tr '[:upper:]' '[:lower:]') \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Add user to docker group
sudo usermod -aG docker $USER
newgrp docker
```

#### Step 3: Install Docker Compose

```bash
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" \
  -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

#### Step 4: Clone Repository

```bash
git clone https://github.com/yourusername/rexcloud.git
cd rexcloud
```

#### Step 5: Configure Environment

```bash
# Generate secure passwords
DB_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)
JWT_SECRET=$(openssl rand -base64 48 | tr -d "=+/" | cut -c1-48)
ENCRYPTION_KEY=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)

# Create .env file
cat > .env << EOF
# Database Configuration
DB_HOST=postgres
DB_PORT=5432
DB_NAME=rexcloud
DB_USER=rexcloud
DB_PASSWORD=${DB_PASSWORD}

# JWT Configuration
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=7d

# Encryption Key (32 characters)
ENCRYPTION_KEY=${ENCRYPTION_KEY}

# Server Configuration
PORT=3001
NODE_ENV=production

# CORS Origins
CORS_ORIGINS=http://localhost
EOF

echo "✅ Configuration saved to .env"
```

#### Step 6: Build and Start

```bash
# Build containers
docker-compose build

# Start containers
docker-compose up -d

# Check status
docker-compose ps
```

#### Step 7: Run Database Migration

```bash
# Wait for database to be ready
sleep 10

# Run migration
docker-compose exec backend npm run migrate:build
```

## Post-Installation

### 1. Access Application

Open your browser and navigate to:
- Local: `http://localhost`
- Remote: `http://YOUR_SERVER_IP`

### 2. Create Admin Account

1. Click on "Registrieren" (Register)
2. Enter your details:
   - Username
   - Email
   - Password (minimum 6 characters)
3. Click "Registrieren"

**Important:** The first registered user automatically becomes admin!

### 3. Configure Infrastructure

Navigate to **Settings** and configure:

#### Proxmox Server
1. Go to **Proxmox Server** tab
2. Click "Server hinzufügen"
3. Enter:
   - Name (e.g., "Proxmox-Node-1")
   - Host (e.g., "https://proxmox.example.com")
   - Port (default: 8006)
   - Username (e.g., "root@pam")
   - Password
4. Click "Server hinzufügen"

#### DNS Provider (Optional)
1. Go to **DNS Provider** tab
2. For Hetzner DNS:
   - Enter your Hetzner API Key
   - Click "Speichern"
3. For AutoDNS:
   - Enter Username, Password, and Context
   - Click "Speichern"

#### Mailcow (Optional)
1. Go to **Mail Server** tab
2. Enter:
   - Name
   - Host URL
   - API Key
3. Click "Server hinzufügen"

#### Plesk (Optional)
1. Go to **Plesk Server** tab
2. Enter:
   - Server Name
   - Host URL
   - Username
   - Password
   - Port (default: 8443)
3. Click "Server hinzufügen"

## Verify Installation

### Check Service Status

```bash
docker-compose ps
```

All services should show "Up":
- `rexcloud-frontend` (port 80)
- `rexcloud-backend` (internal)
- `rexcloud-db` (internal)

### Check Logs

```bash
# All logs
docker-compose logs -f

# Backend logs only
docker-compose logs -f backend

# Frontend logs only
docker-compose logs -f frontend

# Database logs
docker-compose logs -f postgres
```

### Test API

```bash
# Health check
curl http://localhost/api/health

# Should return: {"status":"ok","timestamp":"..."}
```

## Firewall Configuration

### Open Required Ports

```bash
# Allow HTTP
sudo ufw allow 80/tcp

# Allow HTTPS (if using SSL)
sudo ufw allow 443/tcp

# Enable firewall
sudo ufw enable
```

## SSL/TLS Setup (Optional but Recommended)

### Using Let's Encrypt with Certbot

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d yourdomain.com

# Auto-renewal
sudo certbot renew --dry-run
```

### Update docker-compose.yml

Add port 443 mapping:

```yaml
frontend:
  ports:
    - "80:80"
    - "443:443"
```

## Troubleshooting

### Database Connection Failed

```bash
# Check PostgreSQL container
docker-compose logs postgres

# Restart database
docker-compose restart postgres

# Check if database is accepting connections
docker-compose exec postgres pg_isready -U rexcloud
```

### Backend Won't Start

```bash
# Check backend logs
docker-compose logs backend

# Common issues:
# - Database not ready: Wait 30 seconds and restart
# - Missing env vars: Check .env file
# - Port conflict: Change PORT in docker-compose.yml
```

### Frontend Shows 502 Bad Gateway

```bash
# Backend is not running or not reachable
docker-compose restart backend

# Check backend health
curl http://localhost:3001/health
```

### Cannot Login / Register

```bash
# Check backend logs
docker-compose logs backend

# Verify database connection
docker-compose exec postgres psql -U rexcloud -d rexcloud -c "SELECT COUNT(*) FROM users;"
```

### Permission Denied Errors

```bash
# Docker permission issue
sudo usermod -aG docker $USER
newgrp docker

# File permission issue
sudo chown -R $USER:$USER ~/rexcloud
```

## Maintenance

### Update RexCloud

Use the automated update script:

```bash
cd rexcloud
chmod +x update.sh
./update.sh
```

The update script will:
- Backup your current `.env` file
- Pull the latest changes from Git
- Rebuild Docker containers
- Run database migrations
- Restart all services
- Clean up old Docker images

Or update manually:

```bash
cd rexcloud
git pull
docker-compose build --no-cache
docker-compose up -d
docker-compose exec backend npm run migrate:build
```

### Backup Database

```bash
# Create backup
docker-compose exec postgres pg_dump -U rexcloud rexcloud > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore backup
docker-compose exec -T postgres psql -U rexcloud rexcloud < backup_20231105_120000.sql
```

### View Resource Usage

```bash
# Container stats
docker stats

# Disk usage
docker system df
```

### Clean Up

```bash
# Remove stopped containers
docker-compose down

# Remove with volumes (⚠️ deletes database)
docker-compose down -v

# Clean unused images
docker system prune -a
```

## Advanced Configuration

### Custom Domain

1. Point your domain's A record to your server IP
2. Update nginx.conf:
   ```nginx
   server_name yourdomain.com;
   ```
3. Restart frontend:
   ```bash
   docker-compose restart frontend
   ```

### Reverse Proxy (Recommended for Production)

Use Nginx or Caddy as reverse proxy:

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    
    location / {
        proxy_pass http://localhost:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Environment Variables Reference

| Variable | Description | Default |
|----------|-------------|---------|
| `DB_HOST` | PostgreSQL host | postgres |
| `DB_PORT` | PostgreSQL port | 5432 |
| `DB_NAME` | Database name | rexcloud |
| `DB_USER` | Database user | rexcloud |
| `DB_PASSWORD` | Database password | (generated) |
| `JWT_SECRET` | JWT signing key | (generated) |
| `JWT_EXPIRES_IN` | Token expiration | 7d |
| `ENCRYPTION_KEY` | AES-256 key (32 chars) | (generated) |
| `PORT` | Backend port | 3001 |
| `NODE_ENV` | Environment | production |
| `CORS_ORIGINS` | Allowed origins | http://localhost |

## Security Checklist

- [ ] Changed default passwords in `.env`
- [ ] Enabled firewall (ufw/iptables)
- [ ] Only ports 80/443 exposed
- [ ] SSL/TLS certificate configured
- [ ] Regular backups scheduled
- [ ] Docker running as non-root user
- [ ] Strong admin password (12+ characters)
- [ ] Database credentials secured
- [ ] `.env` file permissions: `chmod 600 .env`

## Getting Help

- 📖 Documentation: [Backend README](backend/README.md)
- 🐛 Issues: [GitHub Issues](https://github.com/yourusername/rexcloud/issues)
- 💬 Discussions: [GitHub Discussions](https://github.com/yourusername/rexcloud/discussions)

## Next Steps

After installation:
1. ✅ Configure your Proxmox servers
2. ✅ Set up DNS providers (optional)
3. ✅ Add mail servers (optional)
4. ✅ Configure Plesk servers (optional)
5. ✅ Create customers (optional)
6. ✅ Set up SSL/TLS
7. ✅ Schedule automatic backups

---

**Need more help?** Check the [Troubleshooting](#troubleshooting) section above or open an issue on GitHub.
