# ⚡ Quick Setup Guide - siws.pragyaa.ai

**Fast deployment reference for SingleInterface Voice Agent v4.5.1**

---

## 🚀 Quick Start (Automated)

### Prerequisites
1. Fresh GCP Ubuntu 22.04 VM (e2-medium or better)
2. Static IP assigned to VM
3. DNS A record: `siws.pragyaa.ai` → Your VM's static IP
4. Your OpenAI API key and SIP ID ready

### One-Command Deployment

```bash
# SSH into your VM
gcloud compute ssh siws-voice-agent --zone=us-central1-a

# Download deployment script
curl -fsSL https://raw.githubusercontent.com/YOUR_USERNAME/singleinterfaceVoiceAgent2.0/main/deploy-siws.sh -o deploy-siws.sh
chmod +x deploy-siws.sh

# Set environment variables (replace with your actual values)
export OPENAI_API_KEY="sk-proj-..."
export TELEPHONY_SIP_ID="your-sip-id"

# Run deployment
./deploy-siws.sh
```

**That's it!** The script handles everything automatically.

---

## 📋 Manual Setup (Step-by-Step)

### 1. Create GCP VM
```bash
gcloud compute instances create siws-voice-agent \
    --zone=us-central1-a \
    --machine-type=e2-medium \
    --boot-disk-size=20GB \
    --image-family=ubuntu-2204-lts \
    --image-project=ubuntu-os-cloud \
    --tags=http-server,https-server
```

### 2. Reserve & Assign Static IP
```bash
gcloud compute addresses create siws-voice-agent-ip --region=us-central1
# Assign to VM via GCP Console or CLI
```

### 3. Configure DNS
```
siws.pragyaa.ai  →  A  →  YOUR_STATIC_IP
```

### 4. SSH into VM
```bash
gcloud compute ssh siws-voice-agent --zone=us-central1-a
```

### 5. Quick Install
```bash
# Update & install essentials
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl nginx certbot python3-certbot-nginx ufw

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2
sudo npm install -g pm2

# Clone & setup app
sudo mkdir -p /opt/voiceagent && sudo chown $USER:$USER /opt/voiceagent
cd /opt/voiceagent
git clone YOUR_REPO_URL .
npm ci && npm run build

# Configure firewall
sudo ufw allow ssh && sudo ufw allow 80 && sudo ufw allow 443 && sudo ufw --force enable
```

### 6. Create .env
```bash
cat > /opt/voiceagent/.env << EOF
OPENAI_API_KEY=sk-proj-YOUR_KEY_HERE
TELEPHONY_WS_HOST=0.0.0.0
TELEPHONY_WS_PORT=8080
TELEPHONY_WS_URL=wss://siws.pragyaa.ai/ws
TELEPHONY_SIP_ID=YOUR_SIP_ID
PORT=3000
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://siws.pragyaa.ai
EOF
chmod 600 .env
```

### 7. Setup Nginx (see full config in SETUP_SIWS_PRAGYAA_AI.md)
```bash
sudo nano /etc/nginx/sites-available/siws.pragyaa.ai
# Copy config from documentation
sudo ln -sf /etc/nginx/sites-available/siws.pragyaa.ai /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl restart nginx
```

### 8. Get SSL Certificate
```bash
sudo certbot --nginx -d siws.pragyaa.ai --email info@pragyaa.ai --agree-tos --non-interactive
```

### 9. Start Services
```bash
cd /opt/voiceagent
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # Run the command it outputs
```

### 10. Verify
```bash
pm2 status
curl https://siws.pragyaa.ai/
```

**Done!** 🎉

---

## 🔧 Daily Management Commands

### Check Status
```bash
pm2 status              # All services
pm2 logs               # View all logs
pm2 logs --lines 100   # Last 100 lines
pm2 monit              # Real-time monitoring
```

### Restart Services
```bash
pm2 restart all                  # Restart everything
pm2 restart voiceagent-next      # Restart Next.js only
pm2 restart voiceagent-telephony # Restart WebSocket only
```

### View Logs
```bash
pm2 logs                           # All logs
pm2 logs voiceagent-telephony      # Specific service
pm2 logs --err                     # Errors only
pm2 flush                          # Clear logs
```

### Update Application
```bash
cd /opt/voiceagent
./update.sh
```

### Health Check
```bash
cd /opt/voiceagent
./health-check.sh
```

---

## 🌐 Important URLs

| Purpose | URL |
|---------|-----|
| **Application** | https://siws.pragyaa.ai/ |
| **Admin Dashboard** | https://siws.pragyaa.ai/admin |
| **Analytics** | https://siws.pragyaa.ai/admin/analytics |
| **WebSocket** | wss://siws.pragyaa.ai/ws |
| **IVR Endpoint** | https://siws.pragyaa.ai/api/ivr?ws=wss://siws.pragyaa.ai/ws&sip=YOUR_SIP_ID |
| **Webhook (SingleInterface)** | https://siws.pragyaa.ai/api/webhooks/singleinterface |
| **Webhook (Telephony)** | https://siws.pragyaa.ai/api/webhooks/telephony |

---

## 🚨 Quick Troubleshooting

### Services not running?
```bash
pm2 status
pm2 logs --err
pm2 restart all
```

### Can't access via HTTPS?
```bash
sudo systemctl status nginx
sudo nginx -t
sudo certbot certificates
curl -I https://siws.pragyaa.ai/
```

### WebSocket not connecting?
```bash
pm2 logs voiceagent-telephony
sudo netstat -tulpn | grep :8080
wscat -c wss://siws.pragyaa.ai/ws
```

### SSL certificate issues?
```bash
sudo certbot certificates
sudo certbot renew
sudo systemctl reload nginx
```

### Out of memory?
```bash
free -h
pm2 status
# Restart services to clear memory
pm2 restart all
```

### Check all services
```bash
cd /opt/voiceagent
./health-check.sh
```

---

## 📞 Test Your Deployment

### 1. Test HTTPS Access
```bash
curl -I https://siws.pragyaa.ai/
# Should return: HTTP/2 200
```

### 2. Test IVR Endpoint
```bash
curl "https://siws.pragyaa.ai/api/ivr?ws=wss://siws.pragyaa.ai/ws&sip=YOUR_SIP_ID"
# Should return XML response
```

### 3. Test WebSocket
```bash
# Install wscat if not installed
sudo npm install -g wscat

# Test connection
wscat -c wss://siws.pragyaa.ai/ws

# Send test message:
{"event":"start","type":"text","ucid":"test-123","did":"000"}
```

### 4. Access Admin Dashboard
```
https://siws.pragyaa.ai/admin
Username: admin
Password: (from your .env file)
```

---

## 🔄 Update Procedure

```bash
cd /opt/voiceagent
git pull origin main
npm ci
npm run build
pm2 restart all
```

Or use the update script:
```bash
cd /opt/voiceagent
./update.sh
```

---

## 📊 Monitoring

### Check Resources
```bash
htop                # CPU/Memory (install: sudo apt install htop)
df -h               # Disk usage
pm2 monit           # PM2 monitoring
sudo ufw status     # Firewall status
```

### Check Logs
```bash
# Application logs
pm2 logs --lines 100

# Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# System logs
sudo journalctl -xe
```

---

## 🔐 Security Checklist

- [ ] Firewall enabled (UFW)
- [ ] Only ports 22, 80, 443 open
- [ ] SSL certificate installed and valid
- [ ] .env file permissions set to 600
- [ ] Admin password changed from default
- [ ] SSH key authentication enabled
- [ ] Password authentication disabled (optional)
- [ ] Automatic security updates enabled

---

## 📱 Telephony Integration

### Ozonetel Setup
```
Outbound URL: https://siws.pragyaa.ai/api/ivr?ws=wss://siws.pragyaa.ai/ws&sip=YOUR_SIP_ID
```

### Waybeo/SingleInterface Setup
```
WebSocket URL: wss://siws.pragyaa.ai/ws
Webhook URL: https://siws.pragyaa.ai/api/webhooks/singleinterface
```

---

## 📝 File Locations

| Item | Location |
|------|----------|
| Application | `/opt/voiceagent/` |
| Environment Config | `/opt/voiceagent/.env` |
| PM2 Config | `/opt/voiceagent/ecosystem.config.js` |
| Update Script | `/opt/voiceagent/update.sh` |
| Health Check Script | `/opt/voiceagent/health-check.sh` |
| Nginx Config | `/etc/nginx/sites-available/siws.pragyaa.ai` |
| SSL Certificates | `/etc/letsencrypt/live/siws.pragyaa.ai/` |
| PM2 Logs | `~/.pm2/logs/` |
| Nginx Logs | `/var/log/nginx/` |

---

## 🆘 Support

For detailed documentation, see:
- **Full Setup Guide**: `SETUP_SIWS_PRAGYAA_AI.md`
- **General Deployment**: `GCP-DEPLOYMENT.md`
- **Version Info**: `VERSION.md`
- **Changelog**: `CHANGELOG.md`

**Quick Status Check:**
```bash
cd /opt/voiceagent && ./health-check.sh
```

---

**Version**: 4.5.1  
**Deployment**: siws.pragyaa.ai  
**Last Updated**: October 9, 2025


