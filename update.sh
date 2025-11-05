#!/bin/bash

# RexCloud Update Script
# Automatically updates RexCloud to the latest version

set -e

echo "🔄 RexCloud Update Script"
echo "========================="
echo ""

# Check if we're in the right directory
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ Error: docker-compose.yml not found!"
    echo "Please run this script from the RexCloud root directory."
    exit 1
fi

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running!"
    echo "Please start Docker and try again."
    exit 1
fi

echo "📦 Backing up current .env file..."
if [ -f .env ]; then
    cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
    echo "✅ Backup created"
else
    echo "⚠️  No .env file found to backup"
fi

echo ""
echo "📥 Pulling latest changes from Git..."
git fetch origin
git pull origin main || {
    echo "⚠️  Git pull failed. Continuing with local version..."
}

echo ""
echo "🛑 Stopping containers..."
docker-compose down

echo ""
echo "🏗️  Building updated containers..."
docker-compose build --no-cache

echo ""
echo "🚀 Starting containers..."
docker-compose up -d

echo ""
echo "⏳ Waiting for database to be ready..."
sleep 10

echo ""
echo "🔄 Running database migrations..."
docker-compose exec -T backend npm run migrate:build || {
    echo "⚠️  Migration warning - this is normal if no new migrations exist"
}

echo ""
echo "🧹 Cleaning up old Docker images..."
docker image prune -f

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✨ Update Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📊 Container Status:"
docker-compose ps
echo ""
echo "📝 View logs:    docker-compose logs -f"
echo "🔄 Restart:      docker-compose restart"
echo "🛑 Stop:         docker-compose stop"
echo ""
