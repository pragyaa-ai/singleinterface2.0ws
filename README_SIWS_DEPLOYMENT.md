# 📦 SIWS Deployment Package

**Complete deployment package for SingleInterface Voice Agent v4.5.1 on siws.pragyaa.ai**

---

## 📚 Documentation Overview

This deployment package contains everything you need to deploy the voice agent to a new GCP VM with the subdomain `siws.pragyaa.ai`.

### 📄 Available Documents

| Document | Purpose | Use When |
|----------|---------|----------|
| **DEPLOYMENT_CHECKLIST_SIWS.md** | Complete step-by-step checklist | You want to ensure nothing is missed |
| **SETUP_SIWS_PRAGYAA_AI.md** | Comprehensive setup guide with detailed steps | You need detailed instructions and explanations |
| **QUICK_SETUP_SIWS.md** | Quick reference and commands | You need fast access to commands and URLs |
| **deploy-siws.sh** | Automated deployment script | You want one-command automated deployment |

---

## 🚀 Quick Start

### Option 1: Automated Deployment (Fastest)

```bash
# 1. Create VM and configure DNS (see DEPLOYMENT_CHECKLIST_SIWS.md Phase 1-2)

# 2. SSH into VM
gcloud compute ssh siws-voice-agent --zone=us-central1-a

# 3. Download and run deployment script
curl -fsSL https://raw.githubusercontent.com/YOUR_USERNAME/singleinterfaceVoiceAgent2.0/main/deploy-siws.sh -o deploy-siws.sh
chmod +x deploy-siws.sh

# 4. Set your credentials
export OPENAI_API_KEY="sk-proj-..."
export TELEPHONY_SIP_ID="your-sip-id"

# 5. Deploy!
./deploy-siws.sh
```

**Time estimate:** 15-20 minutes (after DNS propagation)

### Option 2: Manual Deployment (Full Control)

Follow the comprehensive guide in **SETUP_SIWS_PRAGYAA_AI.md**

**Time estimate:** 45-60 minutes

### Option 3: Checklist-Guided Deployment (Recommended for First-Time)

Use **DEPLOYMENT_CHECKLIST_SIWS.md** to ensure every step is completed and verified.

**Time estimate:** 60-90 minutes (includes verification steps)

---

## 📋 Pre-Deployment Requirements

### What You Need Before Starting

1. **GCP Account**
   - Active GCP account with billing enabled
   - Appropriate IAM permissions
   - `gcloud` CLI installed and authenticated

2. **Domain Access**
   - Ability to modify DNS records for `pragyaa.ai`
   - DNS A record: `siws.pragyaa.ai` → Your VM's static IP

3. **API Credentials**
   - OpenAI API key (starts with `sk-proj-...`)
   - Active billing on OpenAI account
   - Telephony provider SIP ID

4. **Code Repository**
   - Application code pushed to GitHub
   - Repository URL ready
   - Access credentials if private repo

---

## 🗺️ Deployment Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  siws.pragyaa.ai (Port 443)            │
│                         HTTPS/WSS                       │
└────────────────────┬────────────────────────────────────┘
                     │
                     │ Nginx Reverse Proxy
                     │
         ┌───────────┴───────────┐
         │                       │
    ┌────▼────┐           ┌─────▼────┐
    │ Next.js │           │ WebSocket│
    │  App    │           │  Server  │
    │ :3000   │           │  :8080   │
    └────┬────┘           └─────┬────┘
         │                      │
         └──────────┬───────────┘
                    │
            ┌───────▼────────┐
            │  OpenAI API    │
            │  (External)    │
            └────────────────┘
```

**Components:**
- **Nginx**: Reverse proxy, SSL termination, WebSocket upgrade
- **Next.js App**: Main web application (Port 3000)
- **WebSocket Server**: Real-time telephony connection (Port 8080)
- **Queue Processor**: Background job processing
- **PM2**: Process manager for all Node.js services

---

## 📱 Deployment Workflow

### Phase 1: Infrastructure Setup (15 min)
1. Create GCP VM instance
2. Reserve and assign static IP
3. Configure firewall rules
4. Update DNS records
5. Wait for DNS propagation

### Phase 2: System Configuration (10 min)
1. SSH into server
2. Update system packages
3. Install base tools and dependencies
4. Configure firewall (UFW)

### Phase 3: Application Deployment (15 min)
1. Install Node.js 18 and PM2
2. Clone repository
3. Install dependencies
4. Build Next.js application
5. Configure environment variables

### Phase 4: Web Server Setup (10 min)
1. Install Nginx
2. Configure Nginx with SSL support
3. Obtain Let's Encrypt SSL certificate
4. Test configuration

### Phase 5: Service Startup (5 min)
1. Start services with PM2
2. Configure auto-start on boot
3. Verify all services running

### Phase 6: Testing (10 min)
1. Test local services
2. Test HTTPS endpoints
3. Test WebSocket connections
4. Make test phone call
5. Verify data collection

### Phase 7: Integration (10 min)
1. Configure telephony provider
2. Test end-to-end call flow
3. Verify webhooks
4. Check admin dashboard

---

## 🎯 Expected Results

After successful deployment, you should have:

### ✅ Working Endpoints

| Endpoint | URL | Status |
|----------|-----|--------|
| Main App | https://siws.pragyaa.ai/ | ✅ 200 OK |
| Admin Dashboard | https://siws.pragyaa.ai/admin | ✅ 200 OK |
| WebSocket | wss://siws.pragyaa.ai/ws | ✅ Connected |
| IVR API | https://siws.pragyaa.ai/api/ivr?ws=... | ✅ XML Response |
| Webhooks | https://siws.pragyaa.ai/api/webhooks/... | ✅ 200 OK |

### ✅ Running Services

```
pm2 status

┌─────┬──────────────────────────────┬─────────┬─────────┬─────────┐
│ id  │ name                         │ status  │ cpu     │ memory  │
├─────┼──────────────────────────────┼─────────┼─────────┼─────────┤
│ 0   │ voiceagent-next             │ online  │ 0%      │ 100MB   │
│ 1   │ voiceagent-telephony        │ online  │ 0%      │ 50MB    │
│ 2   │ voiceagent-queue-processor  │ online  │ 0%      │ 30MB    │
└─────┴──────────────────────────────┴─────────┴─────────┴─────────┘
```

### ✅ Security Features

- Firewall enabled (UFW)
- SSL/TLS certificate (Let's Encrypt)
- HTTPS redirect from HTTP
- Secure environment variable storage
- Security headers configured

### ✅ Management Tools

- PM2 process manager
- Automatic service restart
- Update script (`/opt/voiceagent/update.sh`)
- Health check script (`/opt/voiceagent/health-check.sh`)
- Automated SSL renewal

---

## 🔧 Common Management Tasks

### Daily Operations

```bash
# Check service status
pm2 status

# View logs
pm2 logs --lines 50

# Restart a service
pm2 restart voiceagent-telephony

# Check system health
cd /opt/voiceagent && ./health-check.sh
```

### Weekly Tasks

```bash
# Update application
cd /opt/voiceagent && ./update.sh

# Review logs for issues
pm2 logs --err --lines 100

# Check disk space
df -h
```

### Monthly Tasks

```bash
# Check SSL certificate status
sudo certbot certificates

# System updates
sudo apt update && sudo apt upgrade -y
pm2 update

# Review analytics
# Visit: https://siws.pragyaa.ai/admin/analytics
```

---

## 📊 Monitoring & Logs

### Service Logs

```bash
# All services
pm2 logs

# Specific service
pm2 logs voiceagent-next
pm2 logs voiceagent-telephony
pm2 logs voiceagent-queue-processor

# Real-time monitoring
pm2 monit
```

### Nginx Logs

```bash
# Access logs
sudo tail -f /var/log/nginx/access.log

# Error logs
sudo tail -f /var/log/nginx/error.log
```

### System Resources

```bash
# Install monitoring tools
sudo apt install htop iotop

# Monitor CPU/Memory
htop

# Monitor disk I/O
sudo iotop

# Check disk usage
df -h

# Check memory
free -h
```

---

## 🚨 Troubleshooting

### Quick Diagnostics

Run the health check:
```bash
cd /opt/voiceagent && ./health-check.sh
```

### Common Issues & Solutions

| Issue | Quick Fix |
|-------|-----------|
| Service down | `pm2 restart all` |
| Can't access HTTPS | `sudo nginx -t && sudo systemctl restart nginx` |
| WebSocket not connecting | `pm2 logs voiceagent-telephony` |
| SSL error | `sudo certbot renew` |
| Out of memory | `pm2 restart all` |

For detailed troubleshooting, see:
- **SETUP_SIWS_PRAGYAA_AI.md** - Section: "Troubleshooting"
- **QUICK_SETUP_SIWS.md** - Section: "Quick Troubleshooting"

---

## 📱 Telephony Integration

### Ozonetel Configuration

```
Outbound URL: https://siws.pragyaa.ai/api/ivr?ws=wss://siws.pragyaa.ai/ws&sip=YOUR_SIP_ID
```

### Waybeo/SingleInterface Configuration

```
WebSocket URL: wss://siws.pragyaa.ai/ws
Webhook URL: https://siws.pragyaa.ai/api/webhooks/singleinterface
```

### Testing

```bash
# Test IVR endpoint
curl "https://siws.pragyaa.ai/api/ivr?ws=wss://siws.pragyaa.ai/ws&sip=YOUR_SIP_ID"

# Test WebSocket
wscat -c wss://siws.pragyaa.ai/ws

# Make a test call
# Use your telephony provider's test call feature
```

---

## 🔄 Update Procedure

### Updating the Application

```bash
# Option 1: Use update script
cd /opt/voiceagent
./update.sh

# Option 2: Manual update
cd /opt/voiceagent
git pull origin main
npm ci
npm run build
pm2 restart all
```

### Updating System Packages

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Update Node.js global packages
sudo npm update -g pm2

# Restart services
pm2 restart all
```

### Rollback Procedure

```bash
cd /opt/voiceagent

# View commit history
git log --oneline

# Rollback to specific commit
git checkout COMMIT_HASH

# Rebuild and restart
npm ci
npm run build
pm2 restart all
```

---

## 📞 Support Information

### Important URLs

- **Application**: https://siws.pragyaa.ai/
- **Admin Dashboard**: https://siws.pragyaa.ai/admin
- **Analytics**: https://siws.pragyaa.ai/admin/analytics

### File Locations

- **Application**: `/opt/voiceagent/`
- **Environment Config**: `/opt/voiceagent/.env`
- **Nginx Config**: `/etc/nginx/sites-available/siws.pragyaa.ai`
- **SSL Certificates**: `/etc/letsencrypt/live/siws.pragyaa.ai/`

### Key Commands

```bash
# SSH into server
gcloud compute ssh siws-voice-agent --zone=us-central1-a

# Check status
pm2 status

# View logs
pm2 logs

# Health check
cd /opt/voiceagent && ./health-check.sh

# Update app
cd /opt/voiceagent && ./update.sh
```

---

## 📚 Additional Resources

### Documentation Files

1. **DEPLOYMENT_CHECKLIST_SIWS.md**
   - Complete deployment checklist with all phases
   - Best for: First-time deployment, thorough verification
   - Length: Comprehensive (11 phases)

2. **SETUP_SIWS_PRAGYAA_AI.md**
   - Detailed setup instructions with explanations
   - Best for: Understanding what each step does
   - Length: Full guide (14 sections)

3. **QUICK_SETUP_SIWS.md**
   - Quick reference for commands and URLs
   - Best for: Daily operations, quick lookups
   - Length: Concise reference

4. **deploy-siws.sh**
   - Automated deployment script
   - Best for: Fast automated deployment
   - Length: Single executable script

### Related Documentation

- **GCP-DEPLOYMENT.md** - General GCP deployment guide
- **DEPLOYMENT.md** - General deployment instructions
- **VERSION.md** - Version history and features
- **CHANGELOG.md** - Detailed change log

---

## ✅ Deployment Success Criteria

Your deployment is successful when:

- [ ] All 3 PM2 services are online
- [ ] HTTPS access works without warnings
- [ ] Admin dashboard is accessible
- [ ] WebSocket connections are stable
- [ ] Test call completes successfully
- [ ] IVR endpoint returns valid XML
- [ ] Data collection is working
- [ ] SSL certificate is valid
- [ ] All logs show no critical errors
- [ ] Firewall is properly configured

---

## 🎓 Learning Resources

### For Team Members New to This Stack

**Next.js:**
- [Next.js Documentation](https://nextjs.org/docs)
- Focus on: App Router, API Routes, Production deployment

**PM2:**
- [PM2 Documentation](https://pm2.keymetrics.io/docs/)
- Focus on: Process management, Logs, Startup scripts

**Nginx:**
- [Nginx Beginner's Guide](http://nginx.org/en/docs/beginners_guide.html)
- Focus on: Reverse proxy, SSL configuration, WebSocket

**GCP:**
- [Compute Engine Documentation](https://cloud.google.com/compute/docs)
- Focus on: VM instances, Static IPs, Firewall rules

---

## 🔐 Security Best Practices

### Implemented

✅ Firewall configured (UFW)  
✅ SSL/TLS encryption (Let's Encrypt)  
✅ Secure environment variables  
✅ Non-root user execution  
✅ Security headers in Nginx  
✅ File permissions (600 for .env)  

### Recommended Additional Steps

- [ ] Setup SSH key-only authentication
- [ ] Disable root login
- [ ] Configure fail2ban for brute-force protection
- [ ] Enable automatic security updates
- [ ] Setup monitoring alerts
- [ ] Regular security audits
- [ ] Database encryption (if applicable)

---

## 📈 Performance Optimization

### Current Configuration

- **VM Type**: e2-medium (2 vCPU, 4GB RAM)
- **Node.js**: Single instance per service
- **Nginx**: Basic caching and gzip compression

### Scaling Options

**Vertical Scaling:**
```bash
# Upgrade to larger machine type
gcloud compute instances stop siws-voice-agent --zone=us-central1-a
gcloud compute instances set-machine-type siws-voice-agent \
    --machine-type=e2-standard-2 \
    --zone=us-central1-a
gcloud compute instances start siws-voice-agent --zone=us-central1-a
```

**Horizontal Scaling:**
- Setup load balancer
- Multiple VM instances
- Shared session storage (Redis/Memcached)

---

## 🎉 Conclusion

This deployment package provides everything needed to deploy SingleInterface Voice Agent v4.5.1 to `siws.pragyaa.ai`.

### Next Steps After Deployment

1. Make test calls and verify functionality
2. Configure your telephony provider
3. Train team on management commands
4. Setup monitoring and alerts
5. Create backup strategy
6. Document any customizations

### Getting Help

If you encounter issues:

1. Check the troubleshooting sections in the guides
2. Run the health check script
3. Review PM2 and Nginx logs
4. Verify all prerequisites are met
5. Check DNS and SSL configuration

---

**Package Version:** 1.0  
**Application Version:** 4.5.1  
**Target Domain:** siws.pragyaa.ai  
**Created:** October 9, 2025  
**Maintained by:** Pragyaa.ai Team

---

## 📝 Quick Command Reference

```bash
# SSH into server
gcloud compute ssh siws-voice-agent --zone=us-central1-a

# Essential commands
pm2 status                          # Check services
pm2 logs                            # View logs
cd /opt/voiceagent && ./update.sh   # Update app
cd /opt/voiceagent && ./health-check.sh  # Health check

# Access URLs
open https://siws.pragyaa.ai/              # Main app
open https://siws.pragyaa.ai/admin         # Admin dashboard
```

**For detailed instructions, see:**
- First-time deployment: `DEPLOYMENT_CHECKLIST_SIWS.md`
- Need help understanding: `SETUP_SIWS_PRAGYAA_AI.md`
- Quick command lookup: `QUICK_SETUP_SIWS.md`
- Automated deployment: `./deploy-siws.sh`

---

🚀 **Ready to deploy? Start with DEPLOYMENT_CHECKLIST_SIWS.md!**


