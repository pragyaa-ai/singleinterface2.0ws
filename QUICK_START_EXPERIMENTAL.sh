#!/bin/bash
# Quick deployment script for experimental RNNoise branch on GCP VM

echo "🧪 Deploying Experimental RNNoise (Compiled) Version"
echo "=================================================="
echo ""

# Step 1: Verify we're on the right branch
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "v4.3.4-rnnoise-compiled" ]; then
  echo "⚠️  Not on v4.3.4-rnnoise-compiled branch!"
  echo "Current branch: $CURRENT_BRANCH"
  echo ""
  echo "Run this first:"
  echo "  git fetch origin"
  echo "  git checkout v4.3.4-rnnoise-compiled"
  echo "  git pull origin v4.3.4-rnnoise-compiled"
  exit 1
fi

echo "✅ On correct branch: $CURRENT_BRANCH"
echo ""

# Step 2: Install dependencies
echo "📦 Installing dependencies..."
npm install
if [ $? -ne 0 ]; then
  echo "❌ npm install failed!"
  exit 1
fi
echo ""

# Step 3: Build (compile TypeScript to JavaScript)
echo "🔨 Compiling TypeScript to JavaScript..."
chmod +x build-telephony.sh
./build-telephony.sh
if [ $? -ne 0 ]; then
  echo "❌ Build failed!"
  exit 1
fi
echo ""

# Step 4: Verify compiled output exists
if [ ! -f "dist/server/telephony/index.js" ]; then
  echo "❌ Compiled file not found: dist/server/telephony/index.js"
  exit 1
fi
echo "✅ Compiled file exists: dist/server/telephony/index.js"
echo ""

# Step 5: Stop old service if running
echo "🛑 Stopping old telephony service..."
pm2 stop voiceagent-telephony 2>/dev/null || echo "  (not running)"
echo ""

# Step 6: Start compiled version
echo "🚀 Starting compiled version..."
pm2 start ecosystem.telephony-compiled.config.js
if [ $? -ne 0 ]; then
  echo "❌ PM2 start failed!"
  exit 1
fi
echo ""

# Step 7: Save PM2 config
echo "💾 Saving PM2 configuration..."
pm2 save
echo ""

# Step 8: Show status
echo "📊 PM2 Status:"
pm2 status
echo ""

# Step 9: Show initial logs
echo "📋 Initial logs (waiting 3 seconds)..."
sleep 3
pm2 logs voiceagent-telephony-compiled --lines 30 --nostream
echo ""

echo "=================================================="
echo "✅ Deployment Complete!"
echo ""
echo "Next steps:"
echo "  1. Watch logs: pm2 logs voiceagent-telephony-compiled"
echo "  2. Look for: ✅ [AUDIO] Jitsi RNNoise initialized"
echo "  3. Make a test call"
echo ""
echo "To rollback:"
echo "  ./rollback-to-stable.sh"

