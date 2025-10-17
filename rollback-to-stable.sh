#!/bin/bash
# Quick rollback script to return to stable version

echo "🔄 Rolling Back to Stable Version"
echo "=================================================="
echo ""

# Step 1: Stop experimental service
echo "🛑 Stopping experimental service..."
pm2 stop voiceagent-telephony-compiled 2>/dev/null || echo "  (not running)"
pm2 delete voiceagent-telephony-compiled 2>/dev/null || echo "  (not found)"
echo ""

# Step 2: Switch to stable branch
echo "📂 Switching to stable branch (v4.3.0-webhook-updates)..."
git checkout v4.3.0-webhook-updates
if [ $? -ne 0 ]; then
  echo "❌ Failed to checkout stable branch!"
  exit 1
fi

git pull origin v4.3.0-webhook-updates
echo ""

# Step 3: Install dependencies (in case they changed)
echo "📦 Installing dependencies..."
npm install
echo ""

# Step 4: Build Next.js (for admin dashboard)
echo "🔨 Building Next.js..."
npm run build
echo ""

# Step 5: Restart stable telephony service
echo "🚀 Starting stable telephony service..."
pm2 restart voiceagent-telephony
if [ $? -ne 0 ]; then
  echo "⚠️  Service not running, starting fresh..."
  pm2 start ecosystem.config.js --only voiceagent-telephony
fi
echo ""

# Step 6: Save PM2 config
echo "💾 Saving PM2 configuration..."
pm2 save
echo ""

# Step 7: Show status
echo "📊 PM2 Status:"
pm2 status
echo ""

# Step 8: Show initial logs
echo "📋 Initial logs (waiting 3 seconds)..."
sleep 3
pm2 logs voiceagent-telephony --lines 30 --nostream
echo ""

echo "=================================================="
echo "✅ Rollback Complete!"
echo ""
echo "Now running: v4.3.0-webhook-updates (stable)"
echo "  - ~60-70% noise reduction (fallback mode)"
echo "  - Call transfer working"
echo "  - All features stable"
echo ""
echo "Watch logs: pm2 logs voiceagent-telephony"

