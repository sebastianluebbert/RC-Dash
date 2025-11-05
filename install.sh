#!/bin/bash

# RexCloud Installation Script
# Tested on Ubuntu 20.04+, Debian 11+

set -e

echo "🚀 RC-Dash Installation Script"
echo "================================"

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   echo "❌ This script should not be run as root. Please run as a regular user with sudo privileges."
   exit 1
fi

# Check for sudo privileges
if ! sudo -v; then
    echo "❌ This script requires sudo privileges"
    exit 1
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_info() {
    echo -e "${YELLOW}ℹ${NC} $1"
}

# Function to generate random password
generate_password() {
    openssl rand -base64 32 | tr -d "=+/" | cut -c1-32
}

# Update system
print_info "Updating system packages..."
sudo apt-get update -qq
sudo apt-get upgrade -y -qq
print_success "System updated"

# Install required packages
print_info "Installing required packages..."
sudo apt-get install -y -qq \
    apt-transport-https \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    git \
    openssl
print_success "Required packages installed"

# Install Docker
if ! command -v docker &> /dev/null; then
    print_info "Installing Docker..."
    
    # Add Docker's official GPG key
    curl -fsSL https://download.docker.com/linux/$(lsb_release -is | tr '[:upper:]' '[:lower:]')/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
    
    # Set up Docker repository
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/$(lsb_release -is | tr '[:upper:]' '[:lower:]') \
      $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    # Install Docker Engine
    sudo apt-get update -qq
    sudo apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin
    
    # Add current user to docker group
    sudo usermod -aG docker $USER
    
    print_success "Docker installed"
else
    print_success "Docker already installed"
fi

# Install Docker Compose (standalone)
if ! command -v docker-compose &> /dev/null; then
    print_info "Installing Docker Compose..."
    sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    print_success "Docker Compose installed"
else
    print_success "Docker Compose already installed"
fi

# Clone repository
INSTALL_DIR="$HOME/RC-Dash"
if [ -d "$INSTALL_DIR" ]; then
    print_info "RC-Dash directory already exists. Updating..."
    cd "$INSTALL_DIR"
    
    # Stash any local changes and pull latest version
    git fetch origin
    git reset --hard origin/main
else
    print_info "Cloning RC-Dash repository..."
    git clone https://github.com/sebastianluebbert/RC-Dash.git "$INSTALL_DIR"
    cd "$INSTALL_DIR"
fi
print_success "Repository ready"

# Generate .env file
print_info "Generating configuration..."
if [ ! -f .env ]; then
    DB_PASSWORD=$(generate_password)
    JWT_SECRET=$(generate_password)
    ENCRYPTION_KEY=$(generate_password)
    
    cat > .env << EOF
# Database Configuration
DB_NAME=rexcloud
DB_USER=rexcloud
DB_PASSWORD=$DB_PASSWORD

# JWT Configuration
JWT_SECRET=$JWT_SECRET
JWT_EXPIRES_IN=7d

# Encryption Key (32 characters)
ENCRYPTION_KEY=$ENCRYPTION_KEY

# Ports
FRONTEND_PORT=80
BACKEND_PORT=3001
EOF
    print_success "Configuration generated"
    
    print_info "⚠️  Important: Your credentials have been saved to .env"
    print_info "Database Password: $DB_PASSWORD"
    print_info "JWT Secret: $JWT_SECRET"
else
    print_success "Using existing configuration"
fi

# Load environment variables
set -a
source .env
set +a

# Verify critical environment variables are set
if [ -z "$DB_PASSWORD" ] || [ -z "$JWT_SECRET" ] || [ -z "$ENCRYPTION_KEY" ]; then
    print_error "Critical environment variables are not set in .env file"
    echo "Please check your .env file and ensure DB_PASSWORD, JWT_SECRET, and ENCRYPTION_KEY are configured"
    exit 1
fi

# Check Docker permissions
if ! docker ps &> /dev/null; then
    print_error "Cannot connect to Docker daemon"
    echo ""
    echo "Please run one of the following commands:"
    echo "  1. Activate Docker group for current session:"
    echo "     newgrp docker"
    echo "     Then run this script again"
    echo ""
    echo "  2. Or log out and back in, then run this script again"
    echo ""
    exit 1
fi

# Build and start containers
print_info "Building Docker containers (this may take a few minutes)..."
docker-compose build --no-cache
print_success "Containers built"

print_info "Starting RC-Dash..."
docker-compose up -d
print_success "RC-Dash started"

# Wait for services to be healthy
print_info "Waiting for services to be ready..."
sleep 10

# Check if services are running
if docker-compose ps | grep -q "Up"; then
    print_success "All services are running"
else
    print_error "Some services failed to start. Check logs with: docker-compose logs"
    exit 1
fi

# Get server IP
SERVER_IP=$(hostname -I | awk '{print $1}')

echo ""
echo "================================"
echo -e "${GREEN}✓ RC-Dash Installation Complete!${NC}"
echo "================================"
echo ""
echo "📍 Access your RC-Dash instance:"
echo "   http://$SERVER_IP"
echo "   http://localhost (if accessing locally)"
echo ""
echo "🔐 First time setup:"
echo "   1. Open http://$SERVER_IP in your browser"
echo "   2. Register the first user (will become admin)"
echo "   3. Configure your Proxmox/Plesk/DNS settings"
echo ""
echo "📚 Useful commands:"
echo "   View logs:        cd $INSTALL_DIR && docker-compose logs -f"
echo "   Stop RC-Dash:     cd $INSTALL_DIR && docker-compose stop"
echo "   Start RC-Dash:    cd $INSTALL_DIR && docker-compose start"
echo "   Restart:          cd $INSTALL_DIR && docker-compose restart"
echo "   Update:           cd $INSTALL_DIR && git pull && docker-compose up -d --build"
echo ""
echo "📁 Installation directory: $INSTALL_DIR"
echo "⚙️  Configuration file: $INSTALL_DIR/.env"
echo ""
