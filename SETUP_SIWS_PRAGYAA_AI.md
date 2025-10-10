# 🚀 Setup Guide for siws.pragyaa.ai

Complete step-by-step deployment guide for SingleInterface Voice Agent v4.5.1 on a new GCP VM with subdomain `siws.pragyaa.ai`.

---

## 📋 Prerequisites

Before starting, ensure you have:
- [ ] GCP account with billing enabled
- [ ] Domain access to `pragyaa.ai` for DNS configuration
- [ ] OpenAI API key
- [ ] SSH key for GCP access
- [ ] Telephony provider details (SIP ID if using Ozonetel/Waybeo)

---

## 🖥️ Step 1: Create GCP VM Instance

### 1.1 Using GCP Console

1. Go to **Compute Engine** → **VM Instances** → **Create Instance**
2. Configure the following:
   - **Name**: `siws-voice-agent`
   - **Region**: Choose closest to your users (e.g., `us-central1`)
   - **Zone**: `us-central1-a`
   - **Machine type**: `e2-medium` (2 vCPU, 4GB RAM) - Minimum recommended
   - **Boot disk**: Ubuntu 22.04 LTS, 20GB standard persistent disk
   - **Firewall**: ✅ Allow HTTP traffic, ✅ Allow HTTPS traffic

3. Click **Create**

### 1.2 Using gcloud CLI

```bash
gcloud compute instances create siws-voice-agent \
    --zone=us-central1-a \
    --machine-type=e2-medium \
    --boot-disk-size=20GB \
    --boot-disk-type=pd-standard \
    --image-family=ubuntu-2204-lts \
    --image-project=ubuntu-os-cloud \
    --tags=http-server,https-server \
    --metadata=startup-script='#!/bin/bash
apt-get update'
```

### 1.3 Reserve Static IP

```bash
# Reserve static IP
gcloud compute addresses create siws-voice-agent-ip --region=us-central1

# Get the IP address
gcloud compute addresses describe siws-voice-agent-ip --region=us-central1 --format="get(address)"
```

### 1.4 Assign Static IP to VM

```bash
gcloud compute instances delete-access-config siws-voice-agent \
    --access-config-name="External NAT" \
    --zone=us-central1-a

gcloud compute instances add-access-config siws-voice-agent \
    --access-config-name="External NAT" \
    --address=<STATIC_IP_FROM_PREVIOUS_STEP> \
    --zone=us-central1-a
```

---

## 🌐 Step 2: Configure DNS Records

Configure these DNS A records in your domain registrar (pointing to the static IP from Step 1.3):

```
siws.pragyaa.ai        A    <YOUR_STATIC_IP>    (TTL: 300)
```

**Note**: For this setup, we'll use a single domain `siws.pragyaa.ai` for both the app and WebSocket connections.

**Verify DNS propagation** (wait 5-15 minutes):
```bash
nslookup siws.pragyaa.ai
# Should return your static IP
```

---

## 🔌 Step 3: Connect to VM and Initial Setup

### 3.1 SSH into VM

```bash
gcloud compute ssh siws-voice-agent --zone=us-central1-a
```

### 3.2 Update System

```bash
sudo apt update && sudo apt upgrade -y
```

### 3.3 Install Essential Tools

```bash
sudo apt install -y \
    git \
    curl \
    wget \
    build-essential \
    ufw \
    nginx \
    certbot \
    python3-certbot-nginx
```

---

## 📦 Step 4: Install Node.js and PM2

### 4.1 Install Node.js 18.x LTS

```bash
# Add NodeSource repository
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -

# Install Node.js
sudo apt install -y nodejs

# Verify installation
node --version   # Should show v18.x.x
npm --version    # Should show 9.x.x or higher
```

### 4.2 Install PM2 Process Manager

```bash
sudo npm install -g pm2

# Verify installation
pm2 --version
```

---

## 🚀 Step 5: Deploy Application

### 5.1 Create Application Directory

```bash
sudo mkdir -p /opt/voiceagent
sudo chown $USER:$USER /opt/voiceagent
cd /opt/voiceagent
```

### 5.2 Clone Repository

```bash
# Clone your repository (replace with your actual GitHub repo URL)
git clone https://github.com/YOUR_USERNAME/singleinterfaceVoiceAgent2.0.git .

# Or if you have the code locally, you can use:
# scp -r /path/to/local/code/* your-vm-name:/opt/voiceagent/
```

### 5.3 Install Dependencies

```bash
npm ci
```

### 5.4 Build Application

```bash
npm run build
```

---

## ⚙️ Step 6: Environment Configuration

### 6.1 Create .env File

```bash
cat > /opt/voiceagent/.env << 'EOF'
# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key_here

# Telephony WebSocket Configuration
TELEPHONY_WS_HOST=0.0.0.0
TELEPHONY_WS_PORT=8080
TELEPHONY_WS_URL=wss://siws.pragyaa.ai/ws
TELEPHONY_SIP_ID=YOUR_SIP_ID_HERE

# Next.js Configuration
PORT=3000
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://siws.pragyaa.ai

# Admin Dashboard (Optional)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=change_this_secure_password

# Logging
LOG_LEVEL=info
EOF
```

### 6.2 Update Environment Variables

```bash
nano /opt/voiceagent/.env
```

**Replace these values:**
- `your_openai_api_key_here` → Your actual OpenAI API key (starts with `sk-`)
- `YOUR_SIP_ID_HERE` → Your telephony provider SIP ID
- `change_this_secure_password` → A secure admin password

### 6.3 Secure Environment File

```bash
chmod 600 /opt/voiceagent/.env
```

---

## 🔒 Step 7: Configure Firewall

```bash
# Configure UFW firewall
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable

# Verify firewall status
sudo ufw status
```

---

## 🌐 Step 8: Configure Nginx

### 8.1 Create Nginx Configuration

```bash
sudo tee /etc/nginx/sites-available/siws.pragyaa.ai > /dev/null << 'EOF'
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
    
    # SSL certificates (will be configured by certbot)
    # ssl_certificate /etc/letsencrypt/live/siws.pragyaa.ai/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/siws.pragyaa.ai/privkey.pem;
    
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
    
    # WebSocket endpoint - proxy to telephony server
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
    
    # Main application - proxy to Next.js
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
    
    # Static files optimization
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
EOF
```

### 8.2 Enable Site Configuration

```bash
# Remove default site
sudo rm -f /etc/nginx/sites-enabled/default

# Enable our site
sudo ln -sf /etc/nginx/sites-available/siws.pragyaa.ai /etc/nginx/sites-enabled/

# Test Nginx configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
sudo systemctl enable nginx
```

---

## 🔐 Step 9: Setup SSL Certificate (Let's Encrypt)

### 9.1 Obtain SSL Certificate

```bash
# Run certbot with the email info@pragyaa.ai
sudo certbot --nginx -d siws.pragyaa.ai \
    --non-interactive \
    --agree-tos \
    --email info@pragyaa.ai \
    --redirect
```

### 9.2 Verify SSL Setup

```bash
# Check certificate status
sudo certbot certificates

# Test automatic renewal
sudo certbot renew --dry-run
```

**Note**: Certificates will auto-renew via cron job. Let's Encrypt certificates are valid for 90 days.

---

## 🎯 Step 10: Configure and Start Services with PM2

### 10.1 Verify Ecosystem Config

```bash
cat /opt/voiceagent/ecosystem.config.js
```

Should show:
```javascript
module.exports = {
  apps: [
    {
      name: 'voiceagent-next',
      script: 'npm',
      args: 'run start',
      cwd: '/opt/voiceagent',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      }
    },
    {
      name: 'voiceagent-telephony',
      script: 'npm',
      args: 'run telephony',
      cwd: '/opt/voiceagent',
      env: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'voiceagent-queue-processor',
      script: 'src/server/agents/queueProcessor.js',
      cwd: '/opt/voiceagent',
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
}
```

### 10.2 Start Services

```bash
cd /opt/voiceagent

# Start all services
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Setup PM2 to start on system boot
pm2 startup

# Copy and run the command that PM2 outputs (it will start with 'sudo')
```

### 10.3 Verify Services are Running

```bash
# Check PM2 status
pm2 status

# Expected output:
# ┌─────┬──────────────────────────────┬─────────┬─────────┬─────────┬──────────┐
# │ id  │ name                         │ status  │ cpu     │ memory  │ uptime   │
# ├─────┼──────────────────────────────┼─────────┼─────────┼─────────┼──────────┤
# │ 0   │ voiceagent-next             │ online  │ 0%      │ 100MB   │ 10s      │
# │ 1   │ voiceagent-telephony        │ online  │ 0%      │ 50MB    │ 10s      │
# │ 2   │ voiceagent-queue-processor  │ online  │ 0%      │ 30MB    │ 10s      │
# └─────┴──────────────────────────────┴─────────┴─────────┴─────────┴──────────┘

# View logs
pm2 logs --lines 50

# View specific service logs
pm2 logs voiceagent-telephony
```

---

## ✅ Step 11: Testing and Verification

### 11.1 Test Local Services

```bash
# Test Next.js app
curl -I http://localhost:3000

# Test telephony WebSocket server
curl -I http://localhost:8080
```

### 11.2 Test HTTPS Endpoints

```bash
# Test main application
curl -I https://siws.pragyaa.ai/

# Test IVR API endpoint (replace YOUR_SIP_ID with actual value)
curl "https://siws.pragyaa.ai/api/ivr?ws=wss://siws.pragyaa.ai/ws&sip=YOUR_SIP_ID"

# Expected response:
# <response><stream is_sip='true' url='wss://siws.pragyaa.ai/ws'>YOUR_SIP_ID</stream></response>
```

### 11.3 Test WebSocket Connection

```bash
# Install wscat for WebSocket testing
sudo npm install -g wscat

# Test WebSocket connection
wscat -c wss://siws.pragyaa.ai/ws

# You should see: "Connected"
# Send a test message:
{"event":"start","type":"text","ucid":"test-123","did":"000"}

# Exit with Ctrl+C
```

### 11.4 Access Web Interface

Open in your browser:
```
https://siws.pragyaa.ai/
```

You should see the voice agent interface.

### 11.5 Access Admin Dashboard

```
https://siws.pragyaa.ai/admin
```

Use the credentials from your `.env` file.

---

## 📊 Step 12: Monitoring and Management

### 12.1 PM2 Management Commands

```bash
# View all services
pm2 status

# View logs (all services)
pm2 logs

# View logs (specific service)
pm2 logs voiceagent-next
pm2 logs voiceagent-telephony

# Restart all services
pm2 restart all

# Restart specific service
pm2 restart voiceagent-next

# Stop all services
pm2 stop all

# Delete all services (stops and removes from PM2)
pm2 delete all

# Monitor in real-time
pm2 monit
```

### 12.2 Nginx Management

```bash
# Check Nginx status
sudo systemctl status nginx

# Restart Nginx
sudo systemctl restart nginx

# Reload Nginx (graceful)
sudo systemctl reload nginx

# Test configuration
sudo nginx -t

# View access logs
sudo tail -f /var/log/nginx/access.log

# View error logs
sudo tail -f /var/log/nginx/error.log
```

### 12.3 Application Logs

```bash
# PM2 logs location
ls ~/.pm2/logs/

# View combined logs
pm2 logs --lines 100

# View logs with timestamp
pm2 logs --timestamp

# Clear logs
pm2 flush
```

---

## 🔄 Step 13: Update Deployment Script

Create an update script for easy future deployments:

```bash
cat > /opt/voiceagent/update.sh << 'EOF'
#!/bin/bash
set -e

echo "🔄 Starting update process..."

# Navigate to application directory
cd /opt/voiceagent

# Stop services
echo "Stopping services..."
pm2 stop all

# Backup current version
echo "Creating backup..."
BACKUP_DIR="/opt/voiceagent-backup-$(date +%Y%m%d-%H%M%S)"
sudo cp -r /opt/voiceagent $BACKUP_DIR
echo "Backup created at: $BACKUP_DIR"

# Pull latest code
echo "Pulling latest code..."
git pull origin main

# Install dependencies
echo "Installing dependencies..."
npm ci

# Build application
echo "Building application..."
npm run build

# Restart services
echo "Restarting services..."
pm2 restart all

# Check status
sleep 5
pm2 status

echo "✅ Update completed successfully!"
echo "View logs with: pm2 logs"
EOF

chmod +x /opt/voiceagent/update.sh
```

---

## 🔧 Step 14: Telephony Provider Integration

### For Ozonetel Configuration:

```
Outbound URL: https://siws.pragyaa.ai/api/ivr?ws=wss://siws.pragyaa.ai/ws&sip=YOUR_SIP_ID
Callback URL: https://siws.pragyaa.ai/api/webhooks/telephony
```

### For Waybeo/SingleInterface Configuration:

```
WebSocket URL: wss://siws.pragyaa.ai/ws
Webhook URL: https://siws.pragyaa.ai/api/webhooks/singleinterface
```

### Test IVR Endpoint:

```bash
curl "https://siws.pragyaa.ai/api/ivr?ws=wss://siws.pragyaa.ai/ws&sip=YOUR_SIP_ID"
```

---

## 🚨 Troubleshooting

### Issue: Services Not Starting

```bash
# Check PM2 logs for errors
pm2 logs --err

# Check if ports are available
sudo netstat -tulpn | grep -E ':3000|:8080'

# Manually test the services
cd /opt/voiceagent
npm run start    # Test Next.js (Ctrl+C to stop)
npm run telephony # Test telephony server
```

### Issue: SSL Certificate Problems

```bash
# Check certificate status
sudo certbot certificates

# Renew manually
sudo certbot renew --force-renewal

# Check Nginx SSL configuration
sudo nginx -t
```

### Issue: WebSocket Connection Failing

```bash
# Check if telephony server is running
pm2 logs voiceagent-telephony

# Test local WebSocket
curl -i -N \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  http://localhost:8080/

# Check Nginx WebSocket configuration
sudo cat /etc/nginx/sites-available/siws.pragyaa.ai | grep -A 10 "location /ws"
```

### Issue: Application Not Accessible

```bash
# Check firewall
sudo ufw status

# Check Nginx is running
sudo systemctl status nginx

# Check DNS resolution
nslookup siws.pragyaa.ai

# Test SSL certificate
curl -vI https://siws.pragyaa.ai/
```

### Check All Services Health

```bash
# Create a health check script
cat > /opt/voiceagent/health-check.sh << 'EOF'
#!/bin/bash

echo "=== Health Check for siws.pragyaa.ai ==="
echo

echo "1. PM2 Status:"
pm2 status
echo

echo "2. Nginx Status:"
sudo systemctl status nginx --no-pager
echo

echo "3. Local Service Check:"
echo "Next.js (port 3000):"
curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" http://localhost:3000
echo "Telephony (port 8080):"
curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" http://localhost:8080
echo

echo "4. Public HTTPS Check:"
curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" https://siws.pragyaa.ai/
echo

echo "5. SSL Certificate:"
sudo certbot certificates | grep siws.pragyaa.ai
echo

echo "6. Disk Usage:"
df -h / | grep -v Filesystem
echo

echo "7. Memory Usage:"
free -h | grep -E "Mem|Swap"
echo

echo "=== Health Check Complete ==="
EOF

chmod +x /opt/voiceagent/health-check.sh

# Run health check
/opt/voiceagent/health-check.sh
```

---

## 📝 Post-Deployment Checklist

- [ ] VM created and static IP assigned
- [ ] DNS record configured and propagated
- [ ] SSH access working
- [ ] Node.js and PM2 installed
- [ ] Application code deployed and built
- [ ] Environment variables configured
- [ ] Firewall configured (UFW)
- [ ] Nginx installed and configured
- [ ] SSL certificate obtained and working
- [ ] All PM2 services running (3 services)
- [ ] HTTPS access working: `https://siws.pragyaa.ai/`
- [ ] WebSocket connection working: `wss://siws.pragyaa.ai/ws`
- [ ] IVR API endpoint tested
- [ ] Admin dashboard accessible
- [ ] PM2 startup configured for auto-restart
- [ ] Update script created
- [ ] Health check script created
- [ ] Telephony provider configured
- [ ] Test call completed successfully

---

## 📞 Support and Maintenance

### Important URLs

- **Application**: https://siws.pragyaa.ai/
- **Admin Dashboard**: https://siws.pragyaa.ai/admin
- **IVR Endpoint**: https://siws.pragyaa.ai/api/ivr?ws=wss://siws.pragyaa.ai/ws&sip=YOUR_SIP_ID
- **WebSocket**: wss://siws.pragyaa.ai/ws
- **Analytics**: https://siws.pragyaa.ai/admin/analytics

### Regular Maintenance Tasks

**Daily:**
```bash
pm2 logs --lines 100  # Check for errors
```

**Weekly:**
```bash
/opt/voiceagent/health-check.sh  # Run health check
sudo certbot renew --dry-run     # Test SSL renewal
```

**Monthly:**
```bash
cd /opt/voiceagent
./update.sh  # Update to latest version
```

### Backup Strategy

```bash
# Create backup script
cat > /opt/voiceagent/backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/opt/backups/voiceagent-$(date +%Y%m%d-%H%M%S)"
mkdir -p /opt/backups
sudo cp -r /opt/voiceagent $BACKUP_DIR
sudo cp -r /etc/nginx/sites-available/siws.pragyaa.ai $BACKUP_DIR/nginx-config
echo "Backup created at: $BACKUP_DIR"
# Delete backups older than 30 days
find /opt/backups -type d -mtime +30 -exec rm -rf {} +
EOF

chmod +x /opt/voiceagent/backup.sh

# Setup weekly backup cron job
(crontab -l 2>/dev/null; echo "0 2 * * 0 /opt/voiceagent/backup.sh") | crontab -
```

---

## 🎉 Deployment Complete!

Your SingleInterface Voice Agent v4.5.1 is now running on:

**🌐 https://siws.pragyaa.ai/**

For questions or issues, check the logs:
```bash
pm2 logs
```

---

**Version**: 4.5.1  
**Last Updated**: October 9, 2025  
**Subdomain**: siws.pragyaa.ai


