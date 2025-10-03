# 🚀 Parallel Deployment Guide - v4.5.1 Testing

**Goal:** Deploy v4.5.1 alongside existing v4.3.0 for side-by-side comparison  
**Location:** `/opt/voiceagent-v4.5.1` (new) alongside `/opt/voiceagent` (existing)

---

## 📋 **Deployment Overview**

### **Current Setup:**
```
/opt/voiceagent/          ← v4.3.0 (Production - Don't touch)
├── Uses ports: 8080 (telephony), 3000 (next)
└── PM2 processes: voiceagent-telephony, voiceagent-next, voiceagent-queue-processor
```

### **New Setup (After Deployment):**
```
/opt/voiceagent/          ← v4.3.0 (gpt-realtime Full model)
├── Ports: 8080, 3000
└── PM2: voiceagent-telephony, voiceagent-next, voiceagent-queue-processor

/opt/voiceagent-v4.5.1/   ← v4.5.1 (UI-controlled model switching)
├── Ports: 8081, 3001
└── PM2: voiceagent-v451-telephony, voiceagent-v451-next, voiceagent-v451-queue
```

---

## 🎯 **Step-by-Step Deployment**

### **Step 1: Commit & Push v4.5.1 from Local**

```bash
# On your local machine
cd /Users/gulshan/Cursor/singleinterfaceVoiceAgent2.0

# Add all changes
git add .

# Commit
git commit -m "v4.5.1: Add UI-controlled dynamic model switching"

# Tag the release
git tag v4.5.1

# Push to remote
git push origin main --tags
```

---

### **Step 2: SSH to GCP VM**

```bash
ssh info@voiceagentindia2
```

---

### **Step 3: Clone to New Directory**

```bash
# Navigate to /opt
cd /opt

# Clone the repository to new directory
sudo git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git voiceagent-v4.5.1

# Change ownership to your user
sudo chown -R info:info voiceagent-v4.5.1

# Navigate to new directory
cd /opt/voiceagent-v4.5.1

# Checkout v4.5.1
git checkout v4.5.1
```

---

### **Step 4: Copy Environment Variables**

```bash
# Copy .env from production to new deployment
cp /opt/voiceagent/.env /opt/voiceagent-v4.5.1/.env

# Verify
cat /opt/voiceagent-v4.5.1/.env
```

---

### **Step 5: Install Dependencies**

```bash
cd /opt/voiceagent-v4.5.1

# Install Node.js dependencies
npm install

# Build Next.js application
npm run build
```

---

### **Step 6: Create PM2 Ecosystem Config for v4.5.1**

Create a new PM2 config file with different ports:

```bash
cd /opt/voiceagent-v4.5.1

# Create ecosystem config
cat > ecosystem.v451.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'voiceagent-v451-telephony',
      script: 'ts-node',
      args: '--compiler-options \'{"module":"commonjs","moduleResolution":"node"}\' src/server/telephony/index.ts',
      cwd: '/opt/voiceagent-v4.5.1',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: '8081'  // Different port from production (8080)
      },
      error_file: '/opt/voiceagent-v4.5.1/logs/telephony-error.log',
      out_file: '/opt/voiceagent-v4.5.1/logs/telephony-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true
    },
    {
      name: 'voiceagent-v451-next',
      script: 'npm',
      args: 'start',
      cwd: '/opt/voiceagent-v4.5.1',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: '3001'  // Different port from production (3000)
      },
      error_file: '/opt/voiceagent-v4.5.1/logs/next-error.log',
      out_file: '/opt/voiceagent-v4.5.1/logs/next-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true
    },
    {
      name: 'voiceagent-v451-queue',
      script: 'node',
      args: 'src/server/agents/queueProcessor.js',
      cwd: '/opt/voiceagent-v4.5.1',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production'
      },
      error_file: '/opt/voiceagent-v4.5.1/logs/queue-error.log',
      out_file: '/opt/voiceagent-v4.5.1/logs/queue-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true
    }
  ]
};
EOF
```

---

### **Step 7: Create Logs Directory**

```bash
mkdir -p /opt/voiceagent-v4.5.1/logs
```

---

### **Step 8: Create Data Directories**

```bash
cd /opt/voiceagent-v4.5.1

# Create data directories
mkdir -p data/transcripts
mkdir -p data/processing
mkdir -p data/results
mkdir -p data/calls

# Set permissions
chmod -R 755 data
```

---

### **Step 9: Update Next.js Port**

Create a custom start script or update package.json:

```bash
cd /opt/voiceagent-v4.5.1

# Edit package.json to add custom start script
# Or use environment variable (PORT=3001 already set in ecosystem config)

# Verify the port in .env if needed
echo "PORT=3001" >> .env
```

---

### **Step 10: Start PM2 Processes**

```bash
cd /opt/voiceagent-v4.5.1

# Start all v4.5.1 services
pm2 start ecosystem.v451.config.js

# Save PM2 configuration
pm2 save
```

---

### **Step 11: Verify Both Instances Running**

```bash
# Check PM2 status
pm2 status

# Expected output:
# ┌─────────────────────────────┬────────┬─────────┬──────────┐
# │ Name                        │ Status │ CPU     │ Memory   │
# ├─────────────────────────────┼────────┼─────────┼──────────┤
# │ voiceagent-telephony        │ online │ 0%      │ 150 MB   │ ← v4.3.0
# │ voiceagent-next             │ online │ 0%      │ 180 MB   │ ← v4.3.0
# │ voiceagent-queue-processor  │ online │ 0%      │ 80 MB    │ ← v4.3.0
# │ voiceagent-v451-telephony   │ online │ 0%      │ 150 MB   │ ← v4.5.1
# │ voiceagent-v451-next        │ online │ 0%      │ 180 MB   │ ← v4.5.1
# │ voiceagent-v451-queue       │ online │ 0%      │ 80 MB    │ ← v4.5.1
# └─────────────────────────────┴────────┴─────────┴──────────┘
```

---

### **Step 12: Configure Nginx for Both Instances**

```bash
# Edit nginx configuration
sudo nano /etc/nginx/sites-available/default
```

Add upstream and locations for v4.5.1:

```nginx
# Existing v4.3.0 configuration (keep as is)
upstream voiceagent_prod {
    server 127.0.0.1:3000;
}

# New v4.5.1 configuration
upstream voiceagent_test {
    server 127.0.0.1:3001;
}

server {
    listen 80;
    server_name voiceagentindia2;

    # Production v4.3.0 (existing)
    location / {
        proxy_pass http://voiceagent_prod;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Testing v4.5.1 (new) - access via /v451/
    location /v451/ {
        rewrite ^/v451/(.*) /$1 break;
        proxy_pass http://voiceagent_test;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Or use subdomain for v4.5.1
    # test.voiceagentindia2.com → port 3001
}

# Alternative: Use subdomain
server {
    listen 80;
    server_name test.voiceagentindia2.com;

    location / {
        proxy_pass http://voiceagent_test;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Test and reload Nginx:

```bash
# Test configuration
sudo nginx -t

# Reload if OK
sudo systemctl reload nginx
```

---

### **Step 13: Configure Telephony Routing**

You'll need to route some calls to the new instance. Options:

**Option A: Use Different Phone Numbers**
- Production number → Port 8080 (v4.3.0)
- Test number → Port 8081 (v4.5.1)

**Option B: Route by Time**
- Morning calls → v4.3.0
- Afternoon calls → v4.5.1

**Option C: Manual Testing**
- Use internal test numbers for v4.5.1
- Keep all customer calls on v4.3.0

---

## 🧪 **Testing the New Deployment**

### **Test 1: Access Admin UI**

```bash
# Via path prefix
http://your-domain.com/v451/admin/models

# Or via subdomain (if configured)
http://test.your-domain.com/admin/models
```

### **Test 2: Switch Models via UI**

1. Open admin models page
2. Click "Switch to Mini"
3. Verify success message
4. Check config file:
```bash
cat /opt/voiceagent-v4.5.1/data/model-config.json
```

### **Test 3: Make Test Call**

```bash
# Watch v4.5.1 logs
pm2 logs voiceagent-v451-telephony --lines 50

# Look for:
[CALL_ID] 🤖 Using model: VoiceAgent Mini (or Full)
[CALL_ID] Connected to OpenAI Realtime API with VoiceAgent Mini
```

### **Test 4: Compare Both Instances**

```bash
# v4.3.0 logs
pm2 logs voiceagent-telephony --lines 20

# v4.5.1 logs
pm2 logs voiceagent-v451-telephony --lines 20

# Compare model usage
```

---

## 📊 **Side-by-Side Comparison**

| Feature | v4.3.0 (Production) | v4.5.1 (Testing) |
|---------|---------------------|------------------|
| **Location** | `/opt/voiceagent` | `/opt/voiceagent-v4.5.1` |
| **Telephony Port** | 8080 | 8081 |
| **Web UI Port** | 3000 | 3001 |
| **Model** | gpt-realtime (Fixed) | UI-controlled (Full/Mini) |
| **PM2 Name** | voiceagent-* | voiceagent-v451-* |
| **URL** | http://domain.com/ | http://domain.com/v451/ |
| **Status** | Stable Production | Testing |

---

## 🔍 **Monitoring Both Instances**

### **Check All Services:**
```bash
pm2 status
```

### **Monitor Specific Instance:**
```bash
# v4.3.0
pm2 logs voiceagent-telephony --lines 50

# v4.5.1
pm2 logs voiceagent-v451-telephony --lines 50
```

### **Compare Costs:**
```bash
# Check OpenAI usage dashboard
# Filter by date to compare v4.3.0 vs v4.5.1 costs
```

### **Compare Quality:**
```bash
# v4.3.0 results
ls -lh /opt/voiceagent/data/results/ | tail -10

# v4.5.1 results
ls -lh /opt/voiceagent-v4.5.1/data/results/ | tail -10
```

---

## 🛑 **Managing Both Instances**

### **Start/Stop v4.3.0 (Production):**
```bash
pm2 restart voiceagent-telephony
pm2 restart voiceagent-next
pm2 restart voiceagent-queue-processor

# Or stop
pm2 stop voiceagent-telephony
```

### **Start/Stop v4.5.1 (Testing):**
```bash
pm2 restart voiceagent-v451-telephony
pm2 restart voiceagent-v451-next
pm2 restart voiceagent-v451-queue

# Or stop
pm2 stop voiceagent-v451-telephony
```

### **View Logs:**
```bash
# v4.3.0
pm2 logs voiceagent-telephony

# v4.5.1
pm2 logs voiceagent-v451-telephony
```

---

## 📈 **Decision Time: After Testing**

### **If v4.5.1 Works Well:**

```bash
# Option 1: Replace v4.3.0 with v4.5.1
cd /opt/voiceagent
git pull origin main
git checkout v4.5.1
npm install
npm run build
pm2 restart all

# Option 2: Keep both, switch traffic gradually
# Update telephony routing to send more calls to v4.5.1
```

### **If v4.5.1 Has Issues:**

```bash
# Keep v4.3.0 as primary
# Stop v4.5.1 to save resources
pm2 stop voiceagent-v451-telephony
pm2 stop voiceagent-v451-next
pm2 stop voiceagent-v451-queue

# Or delete v4.5.1 completely
pm2 delete voiceagent-v451-telephony
pm2 delete voiceagent-v451-next
pm2 delete voiceagent-v451-queue
sudo rm -rf /opt/voiceagent-v4.5.1
```

---

## 🧹 **Cleanup After Testing**

Once you decide to fully migrate to v4.5.1:

```bash
# Stop old v4.3.0 processes
pm2 stop voiceagent-telephony
pm2 stop voiceagent-next
pm2 stop voiceagent-queue-processor
pm2 delete voiceagent-telephony
pm2 delete voiceagent-next
pm2 delete voiceagent-queue-processor

# Backup v4.3.0 data
sudo cp -r /opt/voiceagent/data /opt/voiceagent-v4.3.0-backup

# Remove or archive old deployment
sudo mv /opt/voiceagent /opt/voiceagent-v4.3.0-backup

# Rename v4.5.1 to primary
sudo mv /opt/voiceagent-v4.5.1 /opt/voiceagent

# Update PM2 process names (optional)
cd /opt/voiceagent
pm2 delete voiceagent-v451-telephony
pm2 delete voiceagent-v451-next
pm2 delete voiceagent-v451-queue

# Start with standard names
pm2 start ecosystem.config.js
pm2 save
```

---

## 🚨 **Troubleshooting**

### **Port Conflicts:**
```bash
# Check what's using ports
sudo lsof -i :8081
sudo lsof -i :3001

# If needed, change ports in ecosystem.v451.config.js
```

### **Permission Issues:**
```bash
# Fix ownership
sudo chown -R info:info /opt/voiceagent-v4.5.1

# Fix permissions
chmod -R 755 /opt/voiceagent-v4.5.1
```

### **PM2 Not Starting:**
```bash
# Check logs
pm2 logs voiceagent-v451-telephony --err --lines 50

# Delete and restart
pm2 delete voiceagent-v451-telephony
pm2 start ecosystem.v451.config.js --only voiceagent-v451-telephony
```

---

## ✅ **Quick Deployment Checklist**

- [ ] Committed and pushed v4.5.1 to GitHub
- [ ] SSH to GCP VM
- [ ] Cloned to `/opt/voiceagent-v4.5.1`
- [ ] Copied `.env` file
- [ ] Ran `npm install`
- [ ] Ran `npm run build`
- [ ] Created `ecosystem.v451.config.js`
- [ ] Created logs directory
- [ ] Created data directories
- [ ] Started PM2 processes
- [ ] Verified PM2 status (6 processes running)
- [ ] Configured Nginx (optional)
- [ ] Tested admin UI access
- [ ] Made test call to v4.5.1
- [ ] Verified model switching works
- [ ] Compared with v4.3.0 behavior

---

**Ready to deploy in parallel!** 🚀

This setup allows you to:
- ✅ Keep v4.3.0 running unchanged
- ✅ Test v4.5.1 independently
- ✅ Compare side-by-side
- ✅ Switch between them easily
- ✅ Migrate when ready

