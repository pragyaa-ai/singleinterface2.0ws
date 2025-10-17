# Deployment Guide: v4.3.4 - RNNoise Integration

**Target Branch**: `v4.3.0-webhook-updates`  
**Version**: 4.3.4  
**Date**: October 17, 2025

## Quick Start

This update adds RNNoise-based noise suppression to eliminate white noise during Waybeo telephony calls.

## Pre-Deployment Checklist

- [ ] **Backup Current State**
  ```bash
  cd /opt/voiceagent
  git log --oneline -1 > CURRENT-VERSION.txt
  ```

- [ ] **Verify Stable Rollback Available**
  ```bash
  git fetch origin
  git branch -a | grep v4.3.3-live
  # Should show: remotes/origin/v4.3.3-live
  ```

- [ ] **Check Current Branch**
  ```bash
  git status
  # Should be on: v4.3.0-webhook-updates
  ```

## Deployment Steps

### 1. Pull Latest Code

```bash
cd /opt/voiceagent
git fetch origin
git checkout v4.3.0-webhook-updates
git pull origin v4.3.0-webhook-updates
```

**Expected Output:**
```
From https://github.com/pragyaa-ai/singleinterface2.0ws.git
 * branch            v4.3.0-webhook-updates -> FETCH_HEAD
Updating [old-hash]..[new-hash]
Fast-forward
 package.json                        |   3 +-
 src/server/telephony/audio.ts       |  63 ++++++++++++++++++
 src/server/telephony/index.ts       |   8 ++-
 RNNOISE_INTEGRATION.md              | 350 +++++++++++++++++++++++++++++++
 DEPLOYMENT_GUIDE_v4.3.4.md          | xxx +++++++++++++++++++
 5 files changed, xxx insertions(+), x deletions(-)
```

### 2. Install Dependencies

```bash
npm install
```

**Expected Output:**
```
added 1 package, and audited 575 packages in Xs

[package count] packages are looking for funding
  run `npm fund` for details
```

### 3. Configure Environment (Optional)

RNNoise is **enabled by default**. To disable or configure:

```bash
# Edit .env file
nano .env

# Add or update:
USE_NOISE_SUPPRESSION=true
USE_HIGH_QUALITY_RESAMPLING=true
RESAMPLING_QUALITY=MEDIUM
```

**Or update PM2 ecosystem.config.js:**

```javascript
{
  name: 'voiceagent-telephony',
  env: {
    USE_NOISE_SUPPRESSION: 'true',
    USE_HIGH_QUALITY_RESAMPLING: 'true',
    RESAMPLING_QUALITY: 'MEDIUM'
  }
}
```

### 4. Build Project

```bash
npm run build
```

**Expected Output:**
```
> openai-realtime-agents@4.3.4 build
> next build

▲ Next.js 14.2.3
  - Environments: .env

   Creating an optimized production build ...
✓ Compiled successfully
   Skipping linting
✓ Checking validity of types
✓ Collecting page data
✓ Generating static pages (11/11)
✓ Collecting build traces
✓ Finalizing page optimization

Route (app)                              Size     First Load JS
┌ ○ /                                    183 kB         270 kB
├ ○ /_not-found                          871 B         87.9 kB
...
```

### 5. Restart Telephony Service

```bash
pm2 restart voiceagent-telephony
```

**Expected Output:**
```
[PM2] Applying action restartProcessId on app [voiceagent-telephony](ids: [ 1 ])
[PM2] [voiceagent-telephony](1) ✓
```

### 6. Verify Initialization

```bash
pm2 logs voiceagent-telephony --lines 50 | grep -E "noise|audio|Audio|Noise|RNNoise"
```

**Expected Output:**
```
🎵 Audio Resampling: HIGH-QUALITY (libsamplerate - MEDIUM)
🔇 Noise Suppression: ENABLED (RNNoise)
🎵 Initializing audio processing...
🎵 High-quality resamplers initialized successfully (Quality: MEDIUM)
🔇 RNNoise noise suppression initialized successfully (8kHz)
✅ Audio processing initialized
```

### 7. Monitor Service

```bash
# Watch logs in real-time
pm2 logs voiceagent-telephony --lines 100

# Check service status
pm2 status
```

## Post-Deployment Testing

### Test 1: Verify Service is Running

```bash
pm2 status voiceagent-telephony
```

**Expected**: Status should be "online" with restart count incremented by 1.

### Test 2: Make Test Call (Waybeo)

1. Dial the Waybeo test number
2. Listen for:
   - ✅ No white noise / background static
   - ✅ Clear voice from agent
   - ✅ No muffling or distortion
3. Complete full conversation flow
4. Verify call transfer works

### Test 3: Check Logs for Errors

```bash
pm2 logs voiceagent-telephony --lines 200 | grep -i "error\|fail"
```

**Expected**: No errors related to "noise" or "audio" initialization.

### Test 4: Long Call Test

1. Make a call lasting 3-5 minutes
2. Monitor audio quality throughout
3. Check for any degradation

### Test 5: Multilingual Test

Test conversations in multiple languages:
- English
- Hindi
- Marathi

Verify voice quality is consistent across languages.

## Rollback Procedure

If issues are encountered, rollback immediately:

### Quick Rollback

```bash
cd /opt/voiceagent

# Switch to stable branch
git checkout v4.3.3-live
git pull origin v4.3.3-live

# Reinstall dependencies
npm install

# Rebuild
npm run build

# Restart service
pm2 restart voiceagent-telephony

# Verify
pm2 logs voiceagent-telephony --lines 20
```

**Rollback should complete in < 2 minutes**

### Verify Rollback

```bash
# Check version
cat package.json | grep version
# Should show: "version": "4.3.3"

# Check branch
git branch
# Should show: * v4.3.3-live

# Check service
pm2 status voiceagent-telephony
# Should show: status: online
```

## Troubleshooting

### Issue: "RNNoise not initialized" warnings

**Solution:**
```bash
# Check if USE_NOISE_SUPPRESSION is set
pm2 env 1 | grep USE_NOISE_SUPPRESSION

# If not set, add to .env and restart
echo "USE_NOISE_SUPPRESSION=true" >> .env
pm2 restart voiceagent-telephony --update-env
```

### Issue: Build fails with TypeScript errors

**Solution:**
```bash
# Clean build cache
rm -rf .next
rm -rf node_modules

# Reinstall
npm install

# Rebuild
npm run build
```

### Issue: Service crashes on startup

**Solution:**
```bash
# Check detailed logs
pm2 logs voiceagent-telephony --err --lines 100

# If RNNoise is causing issues, disable it temporarily
export USE_NOISE_SUPPRESSION=false
pm2 restart voiceagent-telephony --update-env
```

### Issue: White noise still present

**Diagnostics:**
```bash
# 1. Verify RNNoise is enabled
pm2 logs voiceagent-telephony | grep "Noise Suppression"
# Should show: ENABLED (RNNoise)

# 2. Verify initialization succeeded
pm2 logs voiceagent-telephony | grep "RNNoise noise suppression initialized"
# Should show: successfully (8kHz)

# 3. Test with different quality settings
export RESAMPLING_QUALITY=BEST
pm2 restart voiceagent-telephony --update-env
```

## Configuration Options

### Noise Suppression

```bash
# Enable (default)
USE_NOISE_SUPPRESSION=true

# Disable (for comparison)
USE_NOISE_SUPPRESSION=false
```

### Resampling Quality

```bash
# Best quality (may muffle)
RESAMPLING_QUALITY=BEST

# Medium quality (recommended)
RESAMPLING_QUALITY=MEDIUM

# Fastest (lower quality)
RESAMPLING_QUALITY=FASTEST
```

### Combined Testing

```bash
# Test 1: RNNoise + MEDIUM resampling (recommended)
export USE_NOISE_SUPPRESSION=true
export RESAMPLING_QUALITY=MEDIUM
pm2 restart voiceagent-telephony --update-env

# Test 2: RNNoise + BEST resampling
export RESAMPLING_QUALITY=BEST
pm2 restart voiceagent-telephony --update-env

# Test 3: RNNoise disabled (comparison)
export USE_NOISE_SUPPRESSION=false
pm2 restart voiceagent-telephony --update-env
```

## Success Criteria

- ✅ Service starts without errors
- ✅ RNNoise initializes successfully
- ✅ White noise eliminated during calls
- ✅ Voice quality preserved (no muffling)
- ✅ Call transfer works correctly
- ✅ Multilingual conversations work properly
- ✅ No performance degradation

## Next Steps

After successful testing:

1. **Document Results**: Record audio quality improvements
2. **Performance Metrics**: Monitor CPU/memory usage
3. **User Feedback**: Collect feedback from actual calls
4. **Merge to Live**: If successful, merge to `v4.3.3-live` branch

## Support

- **Documentation**: See `RNNOISE_INTEGRATION.md` for technical details
- **Logs**: `pm2 logs voiceagent-telephony`
- **Status**: `pm2 status`
- **Rollback**: Follow rollback procedure above

## Deployment Timeline

- **Preparation**: 5 minutes
- **Deployment**: 5 minutes
- **Verification**: 5 minutes
- **Testing**: 15-30 minutes
- **Total**: ~30-45 minutes

## Notes

- `v4.3.3-live` remains stable and unchanged
- This deployment is on the development branch (`v4.3.0-webhook-updates`)
- Rollback is fast (<2 minutes) if issues arise
- Monitor first few test calls closely for audio quality

