#!/bin/bash
set -e

# Automated Deployment Script for siws.pragyaa.ai
# SingleInterface Voice Agent v4.5.1
# Run this on a fresh GCP Ubuntu VM

echo "🚀 Starting deployment of SingleInterface Voice Agent to siws.pragyaa.ai..."
echo

# Configuration
DOMAIN="siws.pragyaa.ai"
GITHUB_REPO="https://github.com/YOUR_USERNAME/singleinterfaceVoiceAgent2.0.git"
BRANCH="main"
APP_DIR="/opt/voiceagent"
EMAIL="info@pragyaa.ai"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1"
    exit 1
}

info() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] INFO:${NC} $1"
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   error "This script should NOT be run as root. Run as a regular user with sudo privileges."
fi

# Check for required environment variables
if [ -z "$OPENAI_API_KEY" ]; then
    warn "OPENAI_API_KEY not set in environment. You'll need to update .env file manually."
fi

if [ -z "$TELEPHONY_SIP_ID" ]; then
    warn "TELEPHONY_SIP_ID not set. You'll need to update .env file manually."
fi

echo
info "Deployment Configuration:"
info "  Domain: $DOMAIN"
info "  App Directory: $APP_DIR"
info "  GitHub Repo: $GITHUB_REPO"
info "  Branch: $BRANCH"
echo

read -p "Press Enter to continue or Ctrl+C to abort..."

# ============================================
# Step 1: System Update
# ============================================
log "Step 1/12: Updating system packages..."
sudo apt update && sudo apt upgrade -y

# ============================================
# Step 2: Install Required Packages
# ============================================
log "Step 2/12: Installing required packages..."
sudo apt install -y \
    nginx \
    certbot \
    python3-certbot-nginx \
    git \
    curl \
    wget \
    build-essential \
    ufw

# ============================================
# Step 3: Install Node.js 18.x
# ============================================
log "Step 3/12: Installing Node.js 18.x..."
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
NODE_VERSION=$(node --version)
NPM_VERSION=$(npm --version)
info "Node.js version: $NODE_VERSION"
info "npm version: $NPM_VERSION"

# ============================================
# Step 4: Install PM2
# ============================================
log "Step 4/12: Installing PM2 process manager..."
sudo npm install -g pm2

# ============================================
# Step 5: Create Application Directory
# ============================================
log "Step 5/12: Creating application directory..."
sudo mkdir -p $APP_DIR
sudo chown $USER:$USER $APP_DIR

# ============================================
# Step 6: Clone Repository
# ============================================
log "Step 6/12: Cloning repository..."
cd $APP_DIR
if [ -d ".git" ]; then
    info "Repository already exists, pulling latest changes..."
    git pull origin $BRANCH
else
    git clone -b $BRANCH $GITHUB_REPO .
fi

# ============================================
# Step 7: Install Dependencies and Build
# ============================================
log "Step 7/12: Installing Node.js dependencies..."
npm ci

log "Building Next.js application..."
npm run build

# ============================================
# Step 8: Create Environment Configuration
# ============================================
log "Step 8/12: Creating environment configuration..."

OPENAI_KEY="${OPENAI_API_KEY:-your_openai_api_key_here}"
SIP_ID="${TELEPHONY_SIP_ID:-YOUR_SIP_ID_HERE}"

cat > $APP_DIR/.env << EOF
# OpenAI Configuration
OPENAI_API_KEY=$OPENAI_KEY

# Telephony WebSocket Configuration
TELEPHONY_WS_HOST=0.0.0.0
TELEPHONY_WS_PORT=8080
TELEPHONY_WS_URL=wss://$DOMAIN/ws
TELEPHONY_SIP_ID=$SIP_ID

# Next.js Configuration
PORT=3000
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://$DOMAIN

# Admin Dashboard
ADMIN_USERNAME=admin
ADMIN_PASSWORD=change_this_password_now

# Logging
LOG_LEVEL=info
EOF

chmod 600 $APP_DIR/.env
info "Environment file created at $APP_DIR/.env"

if [ "$OPENAI_KEY" = "your_openai_api_key_here" ] || [ "$SIP_ID" = "YOUR_SIP_ID_HERE" ]; then
    warn "Remember to update $APP_DIR/.env with your actual API keys!"
fi

# ============================================
# Step 9: Configure Firewall
# ============================================
log "Step 9/12: Configuring firewall..."
sudo ufw --force enable
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# ============================================
# Step 10: Configure Nginx
# ============================================
log "Step 10/12: Configuring Nginx..."

sudo tee /etc/nginx/sites-available/$DOMAIN > /dev/null << 'NGINX_EOF'
# HTTP - Redirect to HTTPS
server {
    listen 80;
    server_name siws.pragyaa.ai;
    
    # Allow Let's Encrypt verification
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }
    
    location / {
        return 301 https://$server_name$request_uri;
    }
}

# HTTPS - Main Application
server {
    listen 443 ssl http2;
    server_name siws.pragyaa.ai;
    
    # SSL certificates (configured by certbot)
    ssl_certificate /etc/letsencrypt/live/siws.pragyaa.ai/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/siws.pragyaa.ai/privkey.pem;
    
    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384';
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # WebSocket endpoint
    location /ws {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
        proxy_buffering off;
    }
    
    # Main application
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400s;
        proxy_buffering off;
    }
    
    # Static files
    location /_next/static {
        proxy_pass http://127.0.0.1:3000;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/json application/javascript;
}
NGINX_EOF

# Enable site
sudo rm -f /etc/nginx/sites-enabled/default
sudo ln -sf /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/

# Test and restart Nginx
log "Testing Nginx configuration..."
sudo nginx -t || error "Nginx configuration test failed"
sudo systemctl restart nginx
sudo systemctl enable nginx

# ============================================
# Step 11: Setup SSL Certificate
# ============================================
log "Step 11/12: Setting up SSL certificate..."

# Check if DNS is properly configured
info "Checking DNS configuration for $DOMAIN..."
DNS_IP=$(dig +short $DOMAIN | tail -n1)
if [ -z "$DNS_IP" ]; then
    warn "DNS not configured or not propagated yet for $DOMAIN"
    warn "Please configure DNS A record pointing to this server's IP and run:"
    warn "  sudo certbot --nginx -d $DOMAIN --email $EMAIL --agree-tos --non-interactive"
else
    info "DNS resolves to: $DNS_IP"
    log "Obtaining SSL certificate..."
    sudo certbot --nginx -d $DOMAIN \
        --email $EMAIL \
        --agree-tos \
        --non-interactive \
        --redirect || warn "SSL certificate setup failed. You may need to configure it manually."
fi

# ============================================
# Step 12: Start Services with PM2
# ============================================
log "Step 12/12: Starting services with PM2..."

cd $APP_DIR

# Stop any existing PM2 processes
pm2 delete all 2>/dev/null || true

# Start services
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Setup PM2 startup
log "Configuring PM2 to start on boot..."
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u $USER --hp $HOME || warn "PM2 startup configuration may need manual setup"

# Wait for services to start
log "Waiting for services to initialize..."
sleep 10

# ============================================
# Verification
# ============================================
log "Verifying deployment..."

echo
info "=== Service Status ==="
pm2 status

echo
info "=== Testing Local Services ==="
if curl -sf http://localhost:3000 > /dev/null; then
    log "✅ Next.js service is running"
else
    warn "❌ Next.js service may not be running properly"
fi

if curl -sf http://localhost:8080 > /dev/null; then
    log "✅ Telephony WebSocket service is running"
else
    warn "❌ Telephony WebSocket service may not be running properly"
fi

# ============================================
# Create Management Scripts
# ============================================
log "Creating management scripts..."

# Update script
cat > $APP_DIR/update.sh << 'UPDATE_EOF'
#!/bin/bash
set -e
cd /opt/voiceagent
echo "Stopping services..."
pm2 stop all
echo "Pulling latest code..."
git pull origin main
echo "Installing dependencies..."
npm ci
echo "Building application..."
npm run build
echo "Restarting services..."
pm2 restart all
sleep 5
pm2 status
echo "✅ Update completed!"
UPDATE_EOF

# Health check script
cat > $APP_DIR/health-check.sh << 'HEALTH_EOF'
#!/bin/bash
echo "=== Health Check for siws.pragyaa.ai ==="
echo
echo "1. PM2 Status:"
pm2 status
echo
echo "2. Nginx Status:"
sudo systemctl status nginx --no-pager | head -5
echo
echo "3. Local Service Check:"
echo -n "Next.js (port 3000): "
curl -s -o /dev/null -w "HTTP %{http_code}\n" http://localhost:3000
echo -n "Telephony (port 8080): "
curl -s -o /dev/null -w "HTTP %{http_code}\n" http://localhost:8080
echo
echo "4. HTTPS Check:"
echo -n "Public HTTPS: "
curl -s -o /dev/null -w "HTTP %{http_code}\n" https://siws.pragyaa.ai/
echo
echo "5. Resources:"
echo "Disk: $(df -h / | tail -1 | awk '{print $5 " used"}')"
echo "Memory: $(free -h | grep Mem | awk '{print $3 " used of " $2}')"
echo
echo "=== Health Check Complete ==="
HEALTH_EOF

chmod +x $APP_DIR/update.sh
chmod +x $APP_DIR/health-check.sh

# ============================================
# Deployment Complete
# ============================================
echo
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "🎉 DEPLOYMENT COMPLETED SUCCESSFULLY! 🎉"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo

info "📋 Deployment Summary:"
echo "  • Application URL: https://$DOMAIN/"
echo "  • Admin Dashboard: https://$DOMAIN/admin"
echo "  • WebSocket URL: wss://$DOMAIN/ws"
echo "  • App Directory: $APP_DIR"
echo

info "🔧 Management Commands:"
echo "  • Check status: pm2 status"
echo "  • View logs: pm2 logs"
echo "  • Restart all: pm2 restart all"
echo "  • Update app: cd $APP_DIR && ./update.sh"
echo "  • Health check: cd $APP_DIR && ./health-check.sh"
echo

info "🌐 API Endpoints:"
echo "  • IVR: https://$DOMAIN/api/ivr?ws=wss://$DOMAIN/ws&sip=YOUR_SIP_ID"
echo "  • Webhook: https://$DOMAIN/api/webhooks/singleinterface"
echo

if [ "$OPENAI_KEY" = "your_openai_api_key_here" ] || [ "$SIP_ID" = "YOUR_SIP_ID_HERE" ]; then
    warn "⚠️  IMPORTANT: Update environment variables in $APP_DIR/.env"
    warn "  • OPENAI_API_KEY"
    warn "  • TELEPHONY_SIP_ID"
    warn "  • ADMIN_PASSWORD"
    echo
    info "After updating .env, restart services with: pm2 restart all"
    echo
fi

info "📊 View deployment logs:"
echo "  pm2 logs --lines 50"
echo

log "Deployment script completed!"
echo


