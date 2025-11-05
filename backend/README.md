# RexCloud Backend

Self-hosted backend server for RexCloud Management Platform.

## Features

- 🔐 **JWT Authentication** - Secure token-based authentication
- 🔒 **AES-256 Encryption** - All credentials encrypted at rest
- 🏢 **Role-Based Access Control** - Admin and User roles
- 🚀 **RESTful API** - Clean, documented API endpoints
- 📊 **PostgreSQL Database** - Reliable data storage
- ⚡ **Express.js** - Fast, minimal web framework
- 🛡️ **Security** - Helmet, CORS, Rate limiting

## Requirements

- Node.js 18+ or Bun
- PostgreSQL 14+
- Git

## Quick Start (Development)

```bash
# Clone repository
cd backend

# Install dependencies
npm install
# or
bun install

# Copy environment file
cp .env.example .env

# Edit .env with your configuration
nano .env

# Start PostgreSQL (if not running)
# Make sure PostgreSQL is installed and running

# Run migrations (creates database schema)
npm run migrate

# Start development server
npm run dev
# Server will run on http://localhost:3001
```

## Environment Variables

See `.env.example` for all required variables:

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=rexcloud
DB_USER=rexcloud
DB_PASSWORD=your_password

# JWT
JWT_SECRET=your_super_secret_key
JWT_EXPIRES_IN=7d

# Server
PORT=3001
NODE_ENV=production

# Encryption (32 characters)
ENCRYPTION_KEY=your_32_character_key_here

# CORS
CORS_ORIGINS=http://localhost:5173
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Logout

### Proxmox
- `GET /api/proxmox/nodes` - List all Proxmox nodes
- `POST /api/proxmox/nodes` - Add Proxmox node
- `DELETE /api/proxmox/nodes/:id` - Delete node
- `GET /api/proxmox/resources` - Sync and get VMs/Containers
- `POST /api/proxmox/control` - Control VM (start/stop/reboot)

### DNS Management
- `GET /api/dns/hetzner/zones` - Get Hetzner DNS zones
- `GET /api/dns/hetzner/records/:zoneId` - Get DNS records
- `GET /api/dns/autodns/zones` - Get AutoDNS zones

### Mail (Mailcow)
- `GET /api/mail/servers` - List Mailcow servers
- `POST /api/mail/servers` - Add Mailcow server
- `DELETE /api/mail/servers/:id` - Delete server
- `GET /api/mail/servers/:id/mailboxes` - Get mailboxes

### Plesk
- `GET /api/plesk/servers` - List Plesk servers
- `POST /api/plesk/servers` - Add Plesk server
- `DELETE /api/plesk/servers/:id` - Delete server
- `GET /api/plesk/servers/:id/websites` - Get websites

### Settings
- `GET /api/settings` - Get all settings (keys only)
- `GET /api/settings/:key` - Get specific setting (decrypted)
- `POST /api/settings` - Update or create setting
- `DELETE /api/settings/:key` - Delete setting

## Security

### Authentication
All endpoints (except `/auth/register` and `/auth/login`) require a valid JWT token:

```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" http://localhost:3001/api/proxmox/nodes
```

### Admin Access
Most management endpoints require admin role:
- Proxmox management
- DNS management
- Mail server management
- Plesk management
- Settings management

The first registered user automatically becomes admin.

### Encryption
- Passwords encrypted with AES-256-GCM
- Credentials stored encrypted in database
- JWT tokens for stateless authentication
- Bcrypt for password hashing

## Production Deployment

```bash
# Build TypeScript
npm run build

# Run production server
npm start
```

### Database Setup (Production)

```bash
# Create database
sudo -u postgres psql
CREATE DATABASE rexcloud;
CREATE USER rexcloud WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE rexcloud TO rexcloud;
\q

# Run migrations
npm run migrate
```

## Development

```bash
# Run with auto-reload
npm run dev

# Build
npm run build

# Run tests (TODO)
npm test
```

## Project Structure

```
backend/
├── src/
│   ├── routes/          # API route handlers
│   │   ├── auth.ts      # Authentication
│   │   ├── proxmox.ts   # Proxmox management
│   │   ├── dns.ts       # DNS management
│   │   ├── mail.ts      # Mail server management
│   │   ├── plesk.ts     # Plesk management
│   │   └── settings.ts  # Application settings
│   ├── middleware/      # Express middleware
│   │   ├── auth.ts      # JWT authentication
│   │   └── errorHandler.ts
│   ├── database/        # Database layer
│   │   ├── pool.ts      # PostgreSQL pool
│   │   ├── init.ts      # Database initialization
│   │   └── schema.sql   # Database schema
│   ├── utils/           # Utility functions
│   │   └── encryption.ts # AES-256 encryption
│   └── index.ts         # Express app entry point
├── .env.example         # Environment variables template
├── package.json
├── tsconfig.json
└── README.md
```

## Troubleshooting

### Database Connection Error
```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Check credentials in .env
# Make sure DB_PASSWORD matches PostgreSQL user password
```

### Port Already in Use
```bash
# Change PORT in .env
PORT=3002
```

### Encryption Key Error
```bash
# Make sure ENCRYPTION_KEY is set and is 32 characters
ENCRYPTION_KEY=your_32_character_encryption_key_here
```

## Next Steps

- [ ] Docker support
- [ ] API documentation (Swagger)
- [ ] Unit tests
- [ ] Integration tests
- [ ] WebSocket support for real-time updates
- [ ] Audit logging
- [ ] Backup scripts

## License

MIT
