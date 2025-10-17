# RNNoise Compiled - Experimental Branch 🧪

**Branch**: `v4.3.4-rnnoise-compiled`  
**Status**: 🧪 **EXPERIMENTAL** - For Testing Only  
**Date**: October 17, 2025

---

## ⚠️ IMPORTANT

This is an **experimental branch** to test RNNoise with JavaScript compilation. Do NOT use in production without thorough testing.

**For production, use**:
- `v4.3.3-live` - Stable production (simple resampling, working transfer)
- `v4.3.0-webhook-updates` - Current working (fallback audio: ~60-70% noise reduction)

---

## 🎯 What This Branch Does

**Compiles TypeScript → JavaScript** to enable RNNoise ES module loading.

### Why?
- RNNoise uses `import.meta` (ES module feature)
- ts-node in CommonJS mode blocks ES modules
- **Solution**: Compile to JavaScript first, then run as ES module

### Expected Result:
- ✅ RNNoise initializes successfully
- ✅ 95% noise reduction (vs 60-70% fallback)
- ✅ Crystal-clear audio

---

## 📋 Branch Comparison

| Branch | Audio Quality | RNNoise | Call Transfer | Status |
|--------|---------------|---------|---------------|--------|
| `v4.3.3-live` | Basic (some noise) | ❌ | ✅ | 🟢 Stable |
| `v4.3.0-webhook-updates` | Good (~60-70% reduction) | ❌ (fallback) | ✅ | 🟢 Stable |
| `v4.3.4-rnnoise-compiled` | Excellent (95% reduction) | ✅ (full) | ✅ | 🧪 Experimental |

---

## 🚀 Deployment Steps (GCP VM)

### 1. **Backup Current Setup**

```bash
cd /opt/voiceagent

# Note current branch
git branch
# Should show: * v4.3.0-webhook-updates

# Backup for quick rollback
git log --oneline -1 > CURRENT_BRANCH.txt
```

---

### 2. **Switch to Experimental Branch**

```bash
# Fetch latest
git fetch origin

# Checkout experimental branch
git checkout v4.3.4-rnnoise-compiled
git pull origin v4.3.4-rnnoise-compiled
```

---

### 3. **Install Dependencies**

```bash
npm install
```

---

### 4. **Build Telephony Service**

```bash
# Make build script executable
chmod +x build-telephony.sh

# Compile TypeScript to JavaScript
./build-telephony.sh
```

**Expected Output:**
```
🔨 Building telephony service (TypeScript → JavaScript with ES modules)...
🧹 Cleaning previous build...
📦 Compiling TypeScript...
✅ Build successful!
📁 Output: dist/server/telephony/
```

---

### 5. **Stop Current Telephony Service**

```bash
# Stop the ts-node version
pm2 stop voiceagent-telephony

# Or delete it
pm2 delete voiceagent-telephony
```

---

### 6. **Start Compiled Version**

```bash
# Start with compiled version config
pm2 start ecosystem.telephony-compiled.config.js

# Or manually
pm2 start dist/server/telephony/index.js --name voiceagent-telephony-compiled

# Save PM2 config
pm2 save
```

---

### 7. **Verify RNNoise Initialization**

```bash
# Watch logs
pm2 logs voiceagent-telephony-compiled --lines 100

# Look for this:
# ✅ [AUDIO] Jitsi RNNoise initialized via dynamic import (denoiser: X)
```

---

### 8. **Test**

1. **Make a test call** using Waybeo
2. **Listen for**:
   - ✅ No white noise (95% reduction)
   - ✅ Crystal-clear voice
   - ✅ No clicks or pops
3. **Test call transfer** - should work normally
4. **Test multilingual** - Hindi, English, etc.

---

## 🔄 Rollback Plan

If experimental version has issues, **instant rollback**:

```bash
cd /opt/voiceagent

# Stop compiled version
pm2 stop voiceagent-telephony-compiled
pm2 delete voiceagent-telephony-compiled

# Switch back to stable branch
git checkout v4.3.0-webhook-updates
git pull origin v4.3.0-webhook-updates

# Restart original ts-node version
pm2 resurrect
# Or
pm2 start ecosystem.config.js --only voiceagent-telephony

# Verify
pm2 status
pm2 logs voiceagent-telephony --lines 50
```

**Rollback time: < 2 minutes**

---

## 🔧 How It Works

### Build Process:

```
TypeScript Source (src/server/telephony/*.ts)
         ↓
   tsc compiler with tsconfig.telephony.json
         ↓
JavaScript Output (dist/server/telephony/*.js) with ES modules
         ↓
   Node.js runs compiled JavaScript
         ↓
   dynamic import('@jitsi/rnnoise-wasm') works! ✅
         ↓
   RNNoise initializes successfully
```

### Key Changes:

1. **tsconfig.telephony.json**
   - `module: "esnext"` - Compile to ES modules
   - `outDir: "./dist"` - Output to dist directory

2. **build-telephony.sh**
   - Compiles TypeScript to JavaScript
   - Creates dist/server/telephony/

3. **ecosystem.telephony-compiled.config.js**
   - Runs compiled JavaScript (not ts-node)
   - Sets `USE_NOISE_SUPPRESSION=true` by default

---

## 🐛 Troubleshooting

### Issue: Build fails with TypeScript errors

```bash
# Check TypeScript version
npx tsc --version

# Check for syntax errors
npx tsc --noEmit --project tsconfig.telephony.json
```

### Issue: RNNoise still not initializing

```bash
# Check logs for specific error
pm2 logs voiceagent-telephony-compiled --err --lines 100

# Verify environment variable
pm2 env voiceagent-telephony-compiled | grep USE_NOISE_SUPPRESSION
# Should show: USE_NOISE_SUPPRESSION=true
```

### Issue: Service crashes on startup

```bash
# Check for missing dependencies
npm install

# Rebuild
./build-telephony.sh

# Check Node.js version
node --version
# Should be: v18.20.8 or higher
```

---

## 📊 Expected Performance

### With RNNoise (Compiled):
- **Noise Reduction**: 95% ✅
- **Voice Clarity**: Excellent ✅
- **CPU Usage**: ~5-10% per call ✅
- **Latency**: <5ms ✅
- **Memory**: ~150-200KB per call ✅

### Audio Pipeline:
```
OpenAI (24kHz)
    ↓
Upsample → 48kHz
    ↓
RNNoise Processing (480-sample frames)
    ↓
Downsample → 24kHz
    ↓
Downsample → 8kHz (with averaging)
    ↓
Apply Fade (2ms)
    ↓
Telephony (8kHz)
```

---

## ⚙️ Configuration

### Enable/Disable RNNoise:

**Via Environment Variable:**
```bash
# Enable (default)
export USE_NOISE_SUPPRESSION=true
pm2 restart voiceagent-telephony-compiled --update-env

# Disable
export USE_NOISE_SUPPRESSION=false
pm2 restart voiceagent-telephony-compiled --update-env
```

**Via PM2 Config:**
Edit `ecosystem.telephony-compiled.config.js`:
```javascript
env: {
  USE_NOISE_SUPPRESSION: 'false', // Change to 'false' to disable
}
```

---

## 📝 Deployment Checklist

- [ ] Backup current branch info
- [ ] Checkout v4.3.4-rnnoise-compiled branch
- [ ] Run `npm install`
- [ ] Run `./build-telephony.sh` successfully
- [ ] Stop current voiceagent-telephony service
- [ ] Start voiceagent-telephony-compiled with new config
- [ ] Verify RNNoise initialization in logs
- [ ] Make test call and confirm audio quality
- [ ] Test call transfer functionality
- [ ] Test multilingual support

---

## 🎯 Success Criteria

### ✅ Experimental Version is Working If:
1. Service starts without errors
2. Logs show: `✅ [AUDIO] Jitsi RNNoise initialized via dynamic import`
3. Test call has **no white noise** (95% reduction)
4. Voice quality is **crystal-clear**
5. Call transfer works correctly
6. Multilingual conversations work

### ❌ Rollback If:
1. Service crashes repeatedly
2. RNNoise fails to initialize
3. Audio quality is worse than fallback
4. Call transfer breaks
5. Any critical functionality fails

---

## 📚 Technical Details

### Why Compilation Works:

**Problem with ts-node:**
- ts-node with `--compiler-options '{"module":"commonjs"}'`
- Blocks ALL ES module loading
- Even dynamic `import()` fails

**Solution with Compilation:**
- Compile to ES modules (`module: "esnext"`)
- Node.js runs compiled JavaScript directly
- ES modules fully supported
- Dynamic `import()` works
- RNNoise can use `import.meta`

---

## 🔗 Related Documentation

- **v4.3.3-live**: `RELEASE_NOTES_v4.3.3.md`
- **v4.3.0-webhook-updates**: `DEPLOY_RNNOISE_WORKING.md`
- **RNNoise Technical**: `RNNOISE_JITSI_INTEGRATION.md`

---

## 📞 Support

**For issues with this experimental branch:**
1. Check logs: `pm2 logs voiceagent-telephony-compiled`
2. Review build output from `build-telephony.sh`
3. Rollback to stable if needed (commands above)

**For production issues:**
- Use `v4.3.3-live` or `v4.3.0-webhook-updates`
- Do NOT use experimental branch in production

---

## ⚠️ Final Reminder

This is an **EXPERIMENTAL BRANCH**. Test thoroughly before considering for production use.

**Current stable options:**
- `v4.3.3-live` - Proven stable
- `v4.3.0-webhook-updates` - Working with good audio (60-70% noise reduction)

---

**Test, evaluate, decide!** 🧪

