# RexCloud - Self-Hosted Infrastructure Management Platform

Complete self-hosted solution for managing your infrastructure including Proxmox VMs/Containers, DNS, Mail servers, Plesk websites, and Hetzner Cloud servers.

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- Linux VM (Debian 11+ or Ubuntu 20.04+)
- 2GB RAM minimum
- 20GB disk space

### One-Line Installation

```bash
curl -fsSL https://raw.githubusercontent.com/yourusername/rexcloud/main/install.sh | bash
```

Or manual setup:

```bash
# 1. Clone repository
git clone https://github.com/yourusername/rexcloud.git
cd rexcloud

# 2. Run setup script
chmod +x setup.sh
./setup.sh

# 3. Access application
# Open http://your-server-ip in browser
```

## 📋 Features

### Infrastructure Management
- **Proxmox**: Manage VMs and LXC containers
- **Hetzner Cloud**: Control cloud servers
- **DNS**: Hetzner DNS & AutoDNS management
- **Mail**: Mailcow server integration
- **Plesk**: Website and hosting management
- **Customers**: Multi-tenant customer management

### Security
- 🔐 JWT Authentication
- 🔒 AES-256 Encryption for all credentials
- 👥 Role-based access control (Admin/User)
- 🛡️ Rate limiting & security headers
- 🔑 Secure password hashing (bcrypt)

### Technical Stack
- **Frontend**: React + TypeScript + Vite + Tailwind CSS
- **Backend**: Node.js + Express + TypeScript
- **Database**: PostgreSQL 15
- **Deployment**: Docker + Docker Compose

## 🔧 Configuration

### Environment Variables

After installation, configure your `.env` file:

```bash
cd rexcloud
nano .env
```

All sensitive credentials are automatically generated during setup.

### First Time Setup

1. **Access Application**: Open `http://your-server-ip`
2. **Register Admin**: First registered user becomes admin
3. **Configure Servers**: Add your infrastructure in Settings

## 📖 Usage

### Accessing the Application

```bash
# Local
http://localhost

# Remote
http://your-server-ip
```

### Updating RexCloud

Use the automated update script:

```bash
cd rexcloud
chmod +x update.sh
./update.sh
```

The update script automatically:
- Backs up your configuration
- Pulls latest changes from Git
- Rebuilds Docker containers
- Runs database migrations
- Restarts all services
- Cleans up old Docker images

### Managing the Application

```bash
# View logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f backend
docker-compose logs -f frontend

# Restart services
docker-compose restart

# Stop application
docker-compose stop

# Start application
docker-compose start
```

### Database Management

```bash
# Access PostgreSQL
docker-compose exec postgres psql -U rexcloud -d rexcloud

# Backup database
docker-compose exec postgres pg_dump -U rexcloud rexcloud > backup.sql

# Restore database
docker-compose exec -T postgres psql -U rexcloud rexcloud < backup.sql
```

## 🔐 Security Best Practices

1. **Change Default Passwords**: All generated passwords in `.env` should be kept secure
2. **Enable SSL/TLS**: Use reverse proxy (nginx/Caddy) with Let's Encrypt
3. **Firewall**: Only expose port 80/443
4. **Regular Updates**: Keep Docker images and system updated
5. **Backups**: Regular database and configuration backups

## 🔄 Updates

```bash
cd rexcloud
git pull
docker-compose build --no-cache
docker-compose up -d
docker-compose exec backend npm run migrate:build
```

## 🐛 Troubleshooting

### Database Connection Failed

```bash
# Check if PostgreSQL is running
docker-compose ps

# Check logs
docker-compose logs postgres

# Restart database
docker-compose restart postgres
```

### Port Already in Use

```bash
# Change ports in docker-compose.yml
# Frontend port: 80 -> 8080
# Backend port: 3001 -> 3002
```

### Permission Denied

```bash
# Fix Docker permissions
sudo usermod -aG docker $USER
newgrp docker
```

### Cannot Access Application

```bash
# Check firewall
sudo ufw allow 80/tcp

# Check if containers are running
docker-compose ps

# Check container logs
docker-compose logs -f
```

## 📚 API Documentation

### Authentication

All API endpoints (except `/api/auth/login` and `/api/auth/register`) require JWT authentication:

```bash
Authorization: Bearer <token>
```

### Available Endpoints

#### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user

#### Proxmox
- `GET /api/proxmox/nodes` - List nodes
- `POST /api/proxmox/nodes` - Add node
- `GET /api/proxmox/resources` - Get VMs/Containers
- `POST /api/proxmox/control` - Control VM/Container
- `POST /api/proxmox/lxc/create` - Create LXC container
- `POST /api/proxmox/vm/create` - Create VM

#### Hetzner Cloud
- `GET /api/hetzner/servers` - List servers
- `POST /api/hetzner/servers/action` - Server actions
- `GET /api/hetzner/networks` - List networks
- `GET /api/hetzner/firewalls` - List firewalls

#### DNS
- `GET /api/dns/hetzner/zones` - Hetzner DNS zones
- `GET /api/dns/autodns/zones` - AutoDNS zones

#### Mail (Mailcow)
- `GET /api/mail/servers` - List servers
- `POST /api/mail/servers` - Add server
- `GET /api/mail/servers/:id/mailboxes` - Get mailboxes

#### Plesk
- `GET /api/plesk/servers` - List servers
- `POST /api/plesk/servers` - Add server
- `GET /api/plesk/servers/:id/websites` - Get websites

#### Helper Scripts
- `GET /api/scripts/available` - Available scripts
- `POST /api/scripts/execute` - Execute script

#### VNC
- `POST /api/vnc/ticket` - Get VNC ticket
- `GET /api/vnc/proxy/:node/:vmid` - VNC proxy config

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📝 License

MIT License - see LICENSE file for details

## 🆘 Support

For issues and questions:
- GitHub Issues: https://github.com/yourusername/rexcloud/issues
- Documentation: https://docs.rexcloud.dev (coming soon)

## ⚙️ Architecture

```
RexCloud/
├── frontend/          # React + TypeScript + Vite
├── backend/           # Node.js + Express API
├── nginx.conf         # Nginx configuration
├── docker-compose.yml # Docker orchestration
└── install.sh         # Installation script
```

## 🔮 Roadmap

- [ ] Multi-language support
- [ ] Advanced monitoring & alerting
- [ ] Backup automation
- [ ] API rate limiting per user
- [ ] WebSocket real-time updates
- [ ] Mobile app
- [ ] Kubernetes support

---

Made with ❤️ for self-hosters
