#!/bin/bash

# RexCloud Quick Setup Script
# This script sets up the complete RexCloud environment

set -e

echo "🚀 RexCloud Quick Setup"
echo "======================"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    
    # Generate secure random passwords
    DB_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)
    JWT_SECRET=$(openssl rand -base64 48 | tr -d "=+/" | cut -c1-48)
    ENCRYPTION_KEY=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)
    
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
    
    echo "✅ .env file created with secure random passwords"
    echo ""
else
    echo "ℹ️  .env file already exists, skipping..."
    echo ""
fi

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed!"
    echo "Please install Docker first: https://docs.docker.com/get-docker/"
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed!"
    echo "Please install Docker Compose first: https://docs.docker.com/compose/install/"
    exit 1
fi

echo "✅ Docker and Docker Compose are installed"
echo ""

# Build and start containers
echo "📦 Building Docker containers..."
docker-compose build --no-cache

echo ""
echo "🚀 Starting containers..."
docker-compose up -d

echo ""
echo "⏳ Waiting for database to be ready..."
sleep 10

# Run migrations
echo ""
echo "🔄 Running database migrations..."
docker-compose exec -T backend npm run migrate:build || {
    echo "⚠️  Migration failed, but that's okay if database is already initialized"
}

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✨ RexCloud Setup Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🌐 Access your RexCloud instance at:"
echo "   http://localhost"
echo "   http://$(hostname -I | awk '{print $1}')"
echo ""
echo "📊 Check status: docker-compose ps"
echo "📝 View logs:    docker-compose logs -f"
echo "🛑 Stop:         docker-compose stop"
echo "🔄 Restart:      docker-compose restart"
echo ""
echo "🔐 First time setup:"
echo "   1. Open http://localhost in your browser"
echo "   2. Register a new account (will become admin)"
echo "   3. Configure your infrastructure"
echo ""
