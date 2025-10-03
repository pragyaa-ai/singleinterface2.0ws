# 🚀 Deploy Admin Dashboard to GCP VM

## **Step 1: Upload Admin Dashboard Code**

```bash
# On your local machine, create a deployment package
cd /Users/gulshan/Cursor/singleinterfaceVoiceAgent2.0

# Create a tar file with the new admin code
tar -czf admin-dashboard-update.tar.gz \
  src/app/admin/ \
  src/app/components/admin/ \
  src/app/api/admin/ \
  src/lib/admin/ \
  src/types/admin.ts \
  ADMIN_DASHBOARD_README.md

# Upload to GCP VM
scp admin-dashboard-update.tar.gz info@voiceagentindia2:/tmp/
```

## **Step 2: Deploy on GCP VM**

```bash
# SSH to your GCP VM
ssh info@voiceagentindia2

# Navigate to project directory
cd /opt/voiceagent

# Backup current code
cp -r src src_backup_$(date +%Y%m%d_%H%M%S)

# Extract new admin code
cd /tmp
tar -xzf admin-dashboard-update.tar.gz

# Copy to project directory
cp -r src/* /opt/voiceagent/src/
cp ADMIN_DASHBOARD_README.md /opt/voiceagent/

# Navigate back to project
cd /opt/voiceagent

# Install any new dependencies (if needed)
npm install

# Build the updated application
npm run build

# Restart the Next.js service
pm2 restart voiceagent-next

# Check status
pm2 status
```

## **Step 3: Access Admin Dashboard**

```bash
# The admin dashboard will be available at:
https://singleinterfacws.pragyaa.ai/admin

# Or if using direct IP:
http://YOUR_GCP_VM_IP:3000/admin
```

## **Step 4: Verify Data Access**

Once deployed on the GCP VM, the dashboard will have access to:

```bash
# Check if data directories exist
ls -la /opt/voiceagent/data/
ls -la /opt/voiceagent/data/calls/
ls -la /opt/voiceagent/data/results/

# The dashboard will now show real data from these directories
```


