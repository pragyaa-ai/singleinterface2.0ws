# ✅ Deployment Checklist - siws.pragyaa.ai

**Complete checklist for deploying SingleInterface Voice Agent v4.5.1 to siws.pragyaa.ai**

---

## 📋 Pre-Deployment Checklist

### Required Credentials & Information

- [ ] **OpenAI API Key** (`sk-proj-...`)
  - Verify key is active and has billing enabled
  - Check rate limits and quotas
  - Keep key secure and ready to paste

- [ ] **Telephony Provider Details**
  - [ ] SIP ID / Account ID
  - [ ] Webhook authentication token (if required)
  - [ ] Provider documentation handy (Ozonetel/Waybeo)

- [ ] **GCP Access**
  - [ ] GCP account with billing enabled
  - [ ] `gcloud` CLI installed and authenticated
  - [ ] Appropriate IAM permissions for VM creation

- [ ] **Domain Access**
  - [ ] Access to pragyaa.ai DNS management
  - [ ] Ability to create A records
  - [ ] DNS propagation time accounted for (15-30 min)

- [ ] **GitHub Repository**
  - [ ] Code pushed to repository
  - [ ] Repository URL ready
  - [ ] Branch name confirmed (usually `main`)
  - [ ] SSH key or access token if private repo

### Environment Preparation

- [ ] **Local Machine Setup**
  ```bash
  # Verify gcloud is installed
  gcloud --version
  
  # Verify authentication
  gcloud auth list
  
  # Set project
  gcloud config set project YOUR_PROJECT_ID
  ```

- [ ] **Documentation Ready**
  - [ ] `SETUP_SIWS_PRAGYAA_AI.md` - Full setup guide
  - [ ] `QUICK_SETUP_SIWS.md` - Quick reference
  - [ ] `deploy-siws.sh` - Automated deployment script

---

## 🖥️ Phase 1: GCP Infrastructure Setup

### 1.1 Create VM Instance

- [ ] **Create VM**
  ```bash
  gcloud compute instances create siws-voice-agent \
      --zone=us-central1-a \
      --machine-type=e2-medium \
      --boot-disk-size=20GB \
      --image-family=ubuntu-2204-lts \
      --image-project=ubuntu-os-cloud \
      --tags=http-server,https-server
  ```
  
- [ ] **Verify VM is running**
  ```bash
  gcloud compute instances list | grep siws-voice-agent
  ```

### 1.2 Configure Networking

- [ ] **Reserve static IP**
  ```bash
  gcloud compute addresses create siws-voice-agent-ip --region=us-central1
  ```

- [ ] **Get the IP address** (save this!)
  ```bash
  gcloud compute addresses describe siws-voice-agent-ip \
      --region=us-central1 \
      --format="get(address)"
  ```
  
  **Static IP:** `___.___.___.___ ` ← Write it here!

- [ ] **Assign IP to VM**
  ```bash
  # Delete default ephemeral IP
  gcloud compute instances delete-access-config siws-voice-agent \
      --access-config-name="External NAT" \
      --zone=us-central1-a
  
  # Add static IP
  gcloud compute instances add-access-config siws-voice-agent \
      --access-config-name="External NAT" \
      --address=YOUR_STATIC_IP \
      --zone=us-central1-a
  ```

### 1.3 Configure Firewall

- [ ] **Verify firewall rules exist**
  ```bash
  gcloud compute firewall-rules list | grep -E "http-server|https-server"
  ```

- [ ] **Create rules if needed**
  ```bash
  gcloud compute firewall-rules create allow-http \
      --allow tcp:80 \
      --target-tags http-server
  
  gcloud compute firewall-rules create allow-https \
      --allow tcp:443 \
      --target-tags https-server
  ```

---

## 🌐 Phase 2: DNS Configuration

### 2.1 Configure DNS Records

- [ ] **Create A record in DNS provider**
  ```
  Type: A
  Name: siws
  Value: YOUR_STATIC_IP
  TTL: 300 (5 minutes)
  ```

- [ ] **Verify DNS propagation**
  ```bash
  # Wait 5-15 minutes, then check:
  nslookup siws.pragyaa.ai
  
  # Should return your static IP
  # If not, wait longer and check again
  ```

- [ ] **Test from multiple locations** (optional)
  ```bash
  # Use online DNS checkers:
  # - https://www.whatsmydns.net/
  # - Enter: siws.pragyaa.ai
  ```

---

## 🔧 Phase 3: Initial Server Setup

### 3.1 Connect to Server

- [ ] **SSH into VM**
  ```bash
  gcloud compute ssh siws-voice-agent --zone=us-central1-a
  ```

- [ ] **Verify you're connected** (should see Ubuntu prompt)

### 3.2 System Update

- [ ] **Update system packages**
  ```bash
  sudo apt update && sudo apt upgrade -y
  ```

- [ ] **Verify update completed successfully** (no errors)

### 3.3 Install Base Tools

- [ ] **Install essential packages**
  ```bash
  sudo apt install -y git curl wget build-essential ufw
  ```

- [ ] **Verify installations**
  ```bash
  git --version
  curl --version
  ```

---

## 🚀 Phase 4: Application Deployment

### 4.1 Choose Deployment Method

#### Option A: Automated Deployment (Recommended)

- [ ] **Download deployment script**
  ```bash
  cd ~
  curl -fsSL https://raw.githubusercontent.com/YOUR_USERNAME/singleinterfaceVoiceAgent2.0/main/deploy-siws.sh -o deploy-siws.sh
  chmod +x deploy-siws.sh
  ```

- [ ] **Set environment variables**
  ```bash
  export OPENAI_API_KEY="sk-proj-YOUR_KEY_HERE"
  export TELEPHONY_SIP_ID="YOUR_SIP_ID_HERE"
  ```

- [ ] **Run deployment script**
  ```bash
  ./deploy-siws.sh
  ```

- [ ] **Monitor output for errors**
- [ ] **Verify all steps completed successfully**

#### Option B: Manual Deployment

Follow steps in `SETUP_SIWS_PRAGYAA_AI.md` sections 4-10

### 4.2 Verify Deployment Files

- [ ] **Check application directory exists**
  ```bash
  ls -la /opt/voiceagent
  ```

- [ ] **Verify .env file**
  ```bash
  cat /opt/voiceagent/.env
  # Ensure all values are set correctly
  ```

- [ ] **Check build completed**
  ```bash
  ls -la /opt/voiceagent/.next
  # Should contain built Next.js files
  ```

---

## 🔒 Phase 5: Security Configuration

### 5.1 Firewall Setup

- [ ] **Configure UFW**
  ```bash
  sudo ufw allow ssh
  sudo ufw allow 80/tcp
  sudo ufw allow 443/tcp
  sudo ufw --force enable
  ```

- [ ] **Verify firewall status**
  ```bash
  sudo ufw status
  # Should show rules for 22, 80, 443
  ```

### 5.2 SSL Certificate

- [ ] **Install Nginx**
  ```bash
  sudo apt install -y nginx certbot python3-certbot-nginx
  ```

- [ ] **Configure Nginx** (see full config in setup guide)

- [ ] **Test Nginx configuration**
  ```bash
  sudo nginx -t
  # Should show "test is successful"
  ```

- [ ] **Obtain SSL certificate**
  ```bash
  sudo certbot --nginx -d siws.pragyaa.ai \
      --email info@pragyaa.ai \
      --agree-tos \
      --non-interactive
  ```

- [ ] **Verify certificate**
  ```bash
  sudo certbot certificates
  # Should show valid certificate for siws.pragyaa.ai
  ```

### 5.3 Secure Environment File

- [ ] **Set correct permissions**
  ```bash
  chmod 600 /opt/voiceagent/.env
  ```

- [ ] **Update default passwords**
  ```bash
  nano /opt/voiceagent/.env
  # Change ADMIN_PASSWORD to something secure
  ```

---

## 🎯 Phase 6: Service Startup

### 6.1 Start Services with PM2

- [ ] **Verify PM2 is installed**
  ```bash
  pm2 --version
  ```

- [ ] **Start services**
  ```bash
  cd /opt/voiceagent
  pm2 start ecosystem.config.js
  ```

- [ ] **Save PM2 configuration**
  ```bash
  pm2 save
  ```

- [ ] **Configure auto-start on boot**
  ```bash
  pm2 startup
  # Run the command it outputs (starts with sudo)
  ```

### 6.2 Verify Services

- [ ] **Check PM2 status**
  ```bash
  pm2 status
  ```
  
  Expected services:
  - [ ] `voiceagent-next` - **status: online**
  - [ ] `voiceagent-telephony` - **status: online**
  - [ ] `voiceagent-queue-processor` - **status: online**

- [ ] **Check for errors in logs**
  ```bash
  pm2 logs --lines 50
  # Should not show critical errors
  ```

---

## ✅ Phase 7: Testing & Verification

### 7.1 Local Service Tests

- [ ] **Test Next.js app**
  ```bash
  curl -I http://localhost:3000
  # Should return: HTTP/1.1 200 OK
  ```

- [ ] **Test telephony WebSocket**
  ```bash
  curl -I http://localhost:8080
  # Should return connection upgrade or 200 OK
  ```

### 7.2 Public HTTPS Tests

- [ ] **Test main application**
  ```bash
  curl -I https://siws.pragyaa.ai/
  # Should return: HTTP/2 200
  ```

- [ ] **Open in browser**
  ```
  https://siws.pragyaa.ai/
  ```
  - [ ] Page loads successfully
  - [ ] No SSL warnings
  - [ ] Interface displays correctly

### 7.3 API Endpoint Tests

- [ ] **Test IVR endpoint** (replace YOUR_SIP_ID)
  ```bash
  curl "https://siws.pragyaa.ai/api/ivr?ws=wss://siws.pragyaa.ai/ws&sip=YOUR_SIP_ID"
  ```
  
  Expected response:
  ```xml
  <response><stream is_sip='true' url='wss://siws.pragyaa.ai/ws'>YOUR_SIP_ID</stream></response>
  ```

- [ ] **Test webhook endpoint**
  ```bash
  curl -X POST https://siws.pragyaa.ai/api/webhooks/singleinterface \
      -H "Content-Type: application/json" \
      -d '{"event":"test"}'
  # Should return 200 OK
  ```

### 7.4 WebSocket Test

- [ ] **Install wscat**
  ```bash
  sudo npm install -g wscat
  ```

- [ ] **Test WebSocket connection**
  ```bash
  wscat -c wss://siws.pragyaa.ai/ws
  ```
  - [ ] Connection established (shows "Connected")
  - [ ] Can send test message
  - [ ] Receives responses

### 7.5 Admin Dashboard Test

- [ ] **Access admin dashboard**
  ```
  https://siws.pragyaa.ai/admin
  ```
  - [ ] Login page loads
  - [ ] Can log in with credentials
  - [ ] Dashboard displays correctly
  - [ ] All sections accessible:
    - [ ] Dashboard
    - [ ] Calls
    - [ ] Analytics
    - [ ] Models
    - [ ] Greetings
    - [ ] Telephony

---

## 📱 Phase 8: Telephony Integration

### 8.1 Configure Telephony Provider

#### For Ozonetel:

- [ ] **Add outbound URL**
  ```
  https://siws.pragyaa.ai/api/ivr?ws=wss://siws.pragyaa.ai/ws&sip=YOUR_SIP_ID
  ```

- [ ] **Add callback URL** (if needed)
  ```
  https://siws.pragyaa.ai/api/webhooks/telephony
  ```

#### For Waybeo/SingleInterface:

- [ ] **Configure WebSocket URL**
  ```
  wss://siws.pragyaa.ai/ws
  ```

- [ ] **Configure webhook URL**
  ```
  https://siws.pragyaa.ai/api/webhooks/singleinterface
  ```

### 8.2 Test Call Flow

- [ ] **Make test call to your number**
- [ ] **Verify call connects**
- [ ] **Check agent responds**
- [ ] **Test data collection**
- [ ] **Verify call ends properly**

### 8.3 Check Call Logs

- [ ] **View PM2 logs during call**
  ```bash
  pm2 logs voiceagent-telephony --lines 100
  ```

- [ ] **Check for any errors**
- [ ] **Verify WebSocket events are logged**
- [ ] **Check OpenAI API calls are successful**

---

## 📊 Phase 9: Monitoring Setup

### 9.1 Create Management Scripts

- [ ] **Verify scripts exist**
  ```bash
  ls -la /opt/voiceagent/*.sh
  ```
  
  Should have:
  - [ ] `update.sh` - Update application
  - [ ] `health-check.sh` - System health check

- [ ] **Test health check script**
  ```bash
  cd /opt/voiceagent
  ./health-check.sh
  ```

### 9.2 Setup Monitoring Commands

- [ ] **Bookmark these commands:**
  ```bash
  # Quick status check
  pm2 status
  
  # View logs
  pm2 logs --lines 50
  
  # Real-time monitoring
  pm2 monit
  
  # System resources
  htop  # Install: sudo apt install htop
  ```

### 9.3 Optional: Setup Monitoring Alerts

- [ ] **Configure email alerts** (optional)
  ```bash
  # Add to crontab for health monitoring
  crontab -e
  
  # Add this line:
  */15 * * * * /opt/voiceagent/health-check.sh >> /var/log/health-check.log
  ```

---

## 📝 Phase 10: Documentation & Handoff

### 10.1 Document Deployment Details

**Server Information:**
- VM Name: `siws-voice-agent`
- Zone: `us-central1-a`
- Static IP: `___.___.___.___`
- Domain: `siws.pragyaa.ai`

**Service Ports:**
- Next.js: `3000`
- WebSocket: `8080`
- Nginx: `80`, `443`

**Important Files:**
- App Directory: `/opt/voiceagent`
- Environment: `/opt/voiceagent/.env`
- Nginx Config: `/etc/nginx/sites-available/siws.pragyaa.ai`
- SSL Certs: `/etc/letsencrypt/live/siws.pragyaa.ai/`

### 10.2 Credentials Record

**Keep these secure:**
- [ ] OpenAI API Key: `sk-proj-...` (in .env)
- [ ] Admin Username: `admin`
- [ ] Admin Password: `_____________`
- [ ] SIP ID: `_____________`
- [ ] GCP Project ID: `_____________`

### 10.3 Share Access

- [ ] **Team members who need access:**
  - [ ] Person 1: ___________
  - [ ] Person 2: ___________
  
- [ ] **Add SSH keys for team** (if needed)
  ```bash
  # Add to authorized_keys on server
  echo "ssh-rsa AAAA... user@host" >> ~/.ssh/authorized_keys
  ```

---

## 🎉 Phase 11: Final Verification

### 11.1 Complete System Test

- [ ] **Run full health check**
  ```bash
  cd /opt/voiceagent
  ./health-check.sh
  ```

- [ ] **All services online**
  ```bash
  pm2 status
  # All should show "online" status
  ```

- [ ] **No critical errors in logs**
  ```bash
  pm2 logs --err --lines 100
  ```

### 11.2 Functionality Tests

- [ ] Web interface accessible: `https://siws.pragyaa.ai/`
- [ ] Admin dashboard working: `https://siws.pragyaa.ai/admin`
- [ ] IVR endpoint responding correctly
- [ ] WebSocket connections stable
- [ ] Test call successful
- [ ] Data collection working
- [ ] Transcripts being saved

### 11.3 Performance Baseline

- [ ] **Record initial metrics**
  ```bash
  # CPU & Memory
  free -h
  uptime
  
  # Disk usage
  df -h
  
  # Service memory
  pm2 status
  ```

### 11.4 Backup Verification

- [ ] **Create initial backup**
  ```bash
  BACKUP_DIR="/opt/backups/voiceagent-$(date +%Y%m%d)"
  sudo mkdir -p /opt/backups
  sudo cp -r /opt/voiceagent $BACKUP_DIR
  sudo cp /etc/nginx/sites-available/siws.pragyaa.ai $BACKUP_DIR/nginx-config
  ```

---

## 📋 Post-Deployment Tasks

### Immediate (Within 24 hours)

- [ ] Monitor logs for first 24 hours
  ```bash
  pm2 logs --timestamp
  ```

- [ ] Make multiple test calls
- [ ] Verify data persistence
- [ ] Check SSL certificate expiry date
  ```bash
  sudo certbot certificates
  ```

### Within 1 Week

- [ ] Review analytics dashboard
- [ ] Check call quality and accuracy
- [ ] Optimize agent responses if needed
- [ ] Set up automated backups
- [ ] Document any issues encountered

### Ongoing

- [ ] Weekly health checks
- [ ] Monthly updates
- [ ] Monitor SSL certificate renewal (auto-renews)
- [ ] Review logs for errors
- [ ] Check disk space usage

---

## 🆘 Troubleshooting Quick Reference

### If Something Goes Wrong

**Services not starting:**
```bash
pm2 logs --err
pm2 restart all
```

**Can't access HTTPS:**
```bash
sudo nginx -t
sudo systemctl restart nginx
sudo certbot certificates
```

**WebSocket issues:**
```bash
pm2 logs voiceagent-telephony
sudo netstat -tulpn | grep :8080
```

**Out of disk space:**
```bash
df -h
pm2 flush  # Clear PM2 logs
sudo apt clean
```

**Need to rollback:**
```bash
cd /opt/voiceagent
git log --oneline  # Find previous commit
git checkout COMMIT_HASH
npm ci && npm run build
pm2 restart all
```

---

## ✅ Final Sign-Off

**Deployment completed by:** _______________  
**Date:** _______________  
**Time:** _______________  

**Verified by:** _______________  
**Date:** _______________  

**Production release approved:** ☐ Yes  ☐ No

---

## 📚 Reference Documents

- **Full Setup Guide:** `SETUP_SIWS_PRAGYAA_AI.md`
- **Quick Reference:** `QUICK_SETUP_SIWS.md`
- **Deployment Script:** `deploy-siws.sh`
- **General GCP Docs:** `GCP-DEPLOYMENT.md`
- **Version Info:** `VERSION.md`
- **Changelog:** `CHANGELOG.md`

---

**Deployment Checklist Version:** 1.0  
**Application Version:** 4.5.1  
**Target:** siws.pragyaa.ai  
**Last Updated:** October 9, 2025


