#!/bin/bash
set -e

# GCP VM Deployment Script for SingleInterface Voice Agent
# Run this script on a fresh Ubuntu/Debian VM

echo "🚀 Starting deployment of SingleInterface Voice Agent..."

# Configuration - update these before running
DOMAIN_APP="app.yourdomain.com"
DOMAIN_WS="ws.yourdomain.com"
GITHUB_REPO="https://github.com/your-username/singleinterfaceVoiceAgent2.0.git"
BRANCH="main"
APP_DIR="/opt/voiceagent"
OPENAI_API_KEY="${OPENAI_API_KEY:-YOUR_OPENAI_KEY_HERE}"
TELEPHONY_SIP_ID="${TELEPHONY_SIP_ID:-XYZ}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
    exit 1
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   error "This script should not be run as root. Run as a regular user with sudo privileges."
fi

# Update system
log "Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install required packages
log "Installing required packages..."
sudo apt install -y nginx certbot python3-certbot-nginx git curl build-essential ufw

# Install Node.js 18.x
log "Installing Node.js..."
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installations
log "Verifying installations..."
node --version || error "Node.js installation failed"
npm --version || error "npm installation failed"

# Install PM2 globally
log "Installing PM2 process manager..."
sudo npm install -g pm2

# Create application directory
log "Creating application directory..."
sudo mkdir -p $APP_DIR
sudo chown $USER:$USER $APP_DIR

# Clone repository
log "Cloning repository from GitHub..."
cd $APP_DIR
if [ -d ".git" ]; then
    log "Repository already exists, pulling latest changes..."
    git pull origin $BRANCH
else
    git clone -b $BRANCH $GITHUB_REPO .
fi

# Install dependencies
log "Installing Node.js dependencies..."
npm ci

# Create environment file
log "Creating environment configuration..."
cat > .env << EOF
# OpenAI Configuration
OPENAI_API_KEY=$OPENAI_API_KEY

# Telephony WebSocket Configuration
TELEPHONY_WS_HOST=0.0.0.0
TELEPHONY_WS_PORT=8080
TELEPHONY_WS_URL=wss://$DOMAIN_WS/ws
TELEPHONY_SIP_ID=$TELEPHONY_SIP_ID

# Next.js Configuration
PORT=3000
NODE_ENV=production
EOF

# Build Next.js application
log "Building Next.js application..."
npm run build

# Configure firewall
log "Configuring firewall..."
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443
sudo ufw --force enable

# Create Nginx configuration
log "Creating Nginx configuration..."

# App domain config
sudo tee /etc/nginx/sites-available/$DOMAIN_APP > /dev/null << EOF
server {
    listen 80;
    server_name $DOMAIN_APP;
    
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 86400;
    }
}
EOF

# WebSocket domain config
sudo tee /etc/nginx/sites-available/$DOMAIN_WS > /dev/null << EOF
server {
    listen 80;
    server_name $DOMAIN_WS;
    
    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }
}
EOF

# Enable sites
sudo ln -sf /etc/nginx/sites-available/$DOMAIN_APP /etc/nginx/sites-enabled/
sudo ln -sf /etc/nginx/sites-available/$DOMAIN_WS /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test and reload Nginx
log "Testing Nginx configuration..."
sudo nginx -t || error "Nginx configuration test failed"
sudo systemctl restart nginx
sudo systemctl enable nginx

# Setup SSL certificates
log "Setting up SSL certificates..."
sudo certbot --nginx -d $DOMAIN_APP -d $DOMAIN_WS --non-interactive --agree-tos --email admin@$(echo $DOMAIN_APP | cut -d'.' -f2-) || warn "SSL setup failed - you may need to configure DNS first"

# Create PM2 ecosystem file
log "Creating PM2 ecosystem configuration..."
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [
    {
      name: 'voiceagent-next',
      script: 'npm',
      args: 'run start',
      cwd: '$APP_DIR',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G'
    },
    {
      name: 'voiceagent-telephony',
      script: 'npm',
      args: 'run telephony',
      cwd: '$APP_DIR',
      env: {
        NODE_ENV: 'production'
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M'
    }
  ]
};
EOF

# Start applications with PM2
log "Starting applications with PM2..."
pm2 delete all 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save
pm2 startup | grep -E '^sudo' | sh || warn "PM2 startup configuration may need manual setup"

# Wait for services to start
log "Waiting for services to start..."
sleep 10

# Verify services
log "Verifying service status..."
if curl -f http://localhost:3000 > /dev/null 2>&1; then
    log "✅ Next.js service is running"
else
    warn "❌ Next.js service may not be running properly"
fi

if curl -f http://localhost:8080 > /dev/null 2>&1; then
    log "✅ Telephony WebSocket service is running"
else
    warn "❌ Telephony WebSocket service may not be running properly"
fi

# Create update script
log "Creating update script..."
cat > update.sh << 'EOF'
#!/bin/bash
set -e
cd /opt/voiceagent
git pull origin main
npm ci
npm run build
pm2 restart all
echo "✅ Application updated successfully"
EOF
chmod +x update.sh

# Display final information
log "🎉 Deployment completed successfully!"
echo
echo "📋 Deployment Summary:"
echo "======================================"
echo "App URL: https://$DOMAIN_APP"
echo "WebSocket URL: wss://$DOMAIN_WS/ws"
echo "Application Directory: $APP_DIR"
echo
echo "🔧 Management Commands:"
echo "PM2 Status: pm2 status"
echo "PM2 Logs: pm2 logs"
echo "PM2 Restart: pm2 restart all"
echo "Update App: cd $APP_DIR && ./update.sh"
echo
echo "🌐 Test URLs:"
echo "IVR XML: https://$DOMAIN_APP/api/ivr?ws=wss://$DOMAIN_WS/ws&sip=$TELEPHONY_SIP_ID"
echo "Health Check: https://$DOMAIN_APP/"
echo
echo "⚠️  Important Notes:"
echo "1. Ensure DNS A records point $DOMAIN_APP and $DOMAIN_WS to this VM's IP"
echo "2. Update OPENAI_API_KEY in $APP_DIR/.env if needed"
echo "3. Monitor logs with: pm2 logs"
echo "4. SSL certificates will auto-renew via cron"
echo
log "Deployment script completed!"
