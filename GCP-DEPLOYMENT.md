# GCP VM Deployment Guide

Deploy SingleInterface Voice Agent to Google Cloud Platform VM with HTTPS/WSS support.

## Prerequisites

1. **GCP VM Setup**
   - Create VM: e2-medium or better (2 vCPU, 4GB RAM)
   - OS: Ubuntu 20.04 LTS or Debian 11
   - Allow HTTP/HTTPS traffic in firewall
   - Reserve static external IP

2. **Domain Setup**
   - Point DNS A records to your VM's static IP:
     - `app.yourdomain.com` → VM IP
     - `ws.yourdomain.com` → VM IP
   - Wait for DNS propagation (5-15 minutes)

3. **GitHub Repository**
   - Push your code to GitHub
   - Ensure `.env.sample` exists in the repo

## Quick Deployment

### 1. Connect to your VM
```bash
gcloud compute ssh your-vm-name --zone=your-zone
```

### 2. Download and configure deployment script
```bash
# Download the deployment script
curl -fsSL https://raw.githubusercontent.com/your-username/singleinterfaceVoiceAgent2.0/main/deploy-gcp.sh -o deploy-gcp.sh
chmod +x deploy-gcp.sh

# Edit configuration (required)
nano deploy-gcp.sh
```

### 3. Update these variables in the script:
```bash
DOMAIN_APP="app.yourdomain.com"          # Your app domain
DOMAIN_WS="ws.yourdomain.com"            # Your WebSocket domain  
GITHUB_REPO="https://github.com/your-username/singleinterfaceVoiceAgent2.0.git"
OPENAI_API_KEY="sk-..."                  # Your OpenAI API key
TELEPHONY_SIP_ID="XYZ"                   # Your SIP ID
```

### 4. Run deployment
```bash
./deploy-gcp.sh
```

The script will:
- Install Node.js, Nginx, PM2, Certbot
- Clone your GitHub repo
- Build the Next.js app
- Configure Nginx with SSL/TLS
- Start services with PM2
- Setup auto-restart and SSL renewal

## Manual Deployment Steps

If you prefer manual deployment:

### 1. System Setup
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install dependencies
sudo apt install -y nginx certbot python3-certbot-nginx git curl build-essential

# Install Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2
sudo npm install -g pm2
```

### 2. Application Setup
```bash
# Create app directory
sudo mkdir -p /opt/voiceagent
sudo chown $USER:$USER /opt/voiceagent
cd /opt/voiceagent

# Clone repository
git clone https://github.com/your-username/singleinterfaceVoiceAgent2.0.git .

# Install dependencies and build
npm ci
npm run build

# Create environment file
cp .env.sample .env
nano .env  # Add your OPENAI_API_KEY and other configs
```

### 3. Nginx Configuration
```bash
# App domain config
sudo tee /etc/nginx/sites-available/app.yourdomain.com > /dev/null << 'EOF'
server {
    listen 80;
    server_name app.yourdomain.com;
    
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
    }
}
EOF

# WebSocket domain config
sudo tee /etc/nginx/sites-available/ws.yourdomain.com > /dev/null << 'EOF'
server {
    listen 80;
    server_name ws.yourdomain.com;
    
    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
    }
}
EOF

# Enable sites
sudo ln -s /etc/nginx/sites-available/app.yourdomain.com /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/ws.yourdomain.com /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test and restart Nginx
sudo nginx -t
sudo systemctl restart nginx
```

### 4. SSL Setup
```bash
sudo certbot --nginx -d app.yourdomain.com -d ws.yourdomain.com
```

### 5. Start Services
```bash
# Create PM2 ecosystem
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'voiceagent-next',
      script: 'npm',
      args: 'run start',
      env: { NODE_ENV: 'production', PORT: 3000 }
    },
    {
      name: 'voiceagent-telephony', 
      script: 'npm',
      args: 'run telephony',
      env: { NODE_ENV: 'production' }
    }
  ]
};
EOF

# Start with PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

## Testing Deployment

### 1. Verify Services
```bash
# Check PM2 status
pm2 status

# Check logs
pm2 logs

# Test local endpoints
curl http://localhost:3000
curl http://localhost:8080
```

### 2. Test Public URLs
```bash
# Test IVR XML endpoint
curl "https://app.yourdomain.com/api/ivr?ws=wss://ws.yourdomain.com/ws&sip=XYZ"

# Expected response:
# <response><stream is_sip='true' url='wss://ws.yourdomain.com/ws'>XYZ</stream></response>
```

### 3. WebSocket Test
```bash
# Install wscat for testing
npm install -g wscat

# Test WebSocket connection
wscat -c wss://ws.yourdomain.com/ws

# Send test messages:
{"event":"start","type":"text","ucid":"test-123","did":"000"}
{"event":"stop","type":"text","ucid":"test-123","did":"000"}
```

## Ozonetel Integration

Use these URLs in your Ozonetel configuration:

```
Outbound URL: https://app.yourdomain.com/api/ivr?ws=wss://ws.yourdomain.com/ws&sip=YOUR_SIP_ID
Callback URL: https://app.yourdomain.com/api/callback (if needed)
```

## Management Commands

```bash
# View application status
pm2 status

# View logs
pm2 logs voiceagent-next
pm2 logs voiceagent-telephony

# Restart services
pm2 restart all

# Update application
cd /opt/voiceagent
git pull origin main
npm ci
npm run build
pm2 restart all

# View Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# SSL certificate renewal (automatic via cron)
sudo certbot renew --dry-run
```

## Troubleshooting

### Common Issues

1. **SSL Certificate Issues**
   ```bash
   # Check certificate status
   sudo certbot certificates
   
   # Renew manually
   sudo certbot renew
   ```

2. **Service Not Starting**
   ```bash
   # Check PM2 logs
   pm2 logs
   
   # Check environment variables
   cd /opt/voiceagent && cat .env
   
   # Restart services
   pm2 restart all
   ```

3. **WebSocket Connection Issues**
   ```bash
   # Check Nginx WebSocket config
   sudo nginx -t
   
   # Test local WebSocket
   curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" http://localhost:8080/
   ```

4. **DNS Issues**
   ```bash
   # Check DNS resolution
   nslookup app.yourdomain.com
   nslookup ws.yourdomain.com
   ```

### Monitoring

Set up basic monitoring:

```bash
# Add to crontab for health checks
echo "*/5 * * * * curl -f https://app.yourdomain.com/ || echo 'App down' | mail admin@yourdomain.com" | crontab -
```

## Security Notes

- Firewall allows only ports 22, 80, 443
- SSL certificates auto-renew via cron
- PM2 runs services as non-root user
- Environment variables stored securely in .env
- Nginx proxy headers include security headers

## Scaling Considerations

For production use:
- Use multiple VM instances behind a load balancer
- Set up Cloud SQL for session storage
- Use Cloud Storage for audio files
- Configure Cloud Monitoring and alerting
- Set up automated backups
