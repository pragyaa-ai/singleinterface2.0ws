# Quick Deploy: RNNoise v4.3.4 🎯

**Library**: `@jitsi/rnnoise-wasm` (Jitsi - Legitimate & Well-Maintained)  
**Status**: Ready for GCP VM Testing  
**Rollback**: `v4.3.3-live` available

---

## ✅ Deploy to GCP VM

```bash
cd /opt/voiceagent

# Stash local changes
git stash

# Pull latest code
git fetch origin
git checkout v4.3.0-webhook-updates
git pull origin v4.3.0-webhook-updates

# Install new package (@jitsi/rnnoise-wasm)
npm install

# Build
npm run build

# IMPORTANT: Enable RNNoise (disabled by default)
echo "USE_NOISE_SUPPRESSION=true" >> .env

# Restart with updated environment
pm2 restart voiceagent-telephony --update-env

# Verify RNNoise initialized
pm2 logs voiceagent-telephony --lines 50 | grep -E "RNNoise|noise"
```

---

## 🔍 Expected Output

You should see:

```
🔇 Noise Suppression: ENABLED (RNNoise/Jitsi)
🎵 Initializing audio processing...
🎵 High-quality resamplers initialized successfully (Quality: MEDIUM)
🔇 RNNoise noise suppression initialized successfully (Jitsi WASM)
🔇 RNNoise resamplers (8kHz ↔ 48kHz) initialized
✅ Audio processing initialized
```

**✅ If you see these logs, RNNoise is active!**

---

## 🧪 Test It

1. **Make a test call** using Waybeo telephony
2. **Listen for**:
   - ✅ **White noise eliminated**
   - ✅ **Clear voice** (no muffling)
   - ✅ **Natural quality**
3. **Test call transfer** - should work normally
4. **Test multilingual** - Hindi, English, etc.

---

## 🔄 Rollback (if needed)

```bash
cd /opt/voiceagent
git checkout v4.3.3-live
git pull origin v4.3.3-live
npm install
npm run build
pm2 restart voiceagent-telephony
```

**Rollback time: < 2 minutes**

---

## 🎛️ Configuration Options

### Disable RNNoise (for comparison)

```bash
# Edit .env
nano .env
# Set: USE_NOISE_SUPPRESSION=false

# Restart
pm2 restart voiceagent-telephony --update-env
```

### Test Different Resampling Quality

```bash
# Edit .env
nano .env
# Add: RESAMPLING_QUALITY=BEST    # or MEDIUM (default) or FASTEST

# Restart
pm2 restart voiceagent-telephony --update-env
```

---

## 🐛 Troubleshooting

### Issue: RNNoise not initializing

```bash
# Check if USE_NOISE_SUPPRESSION is set
pm2 env 1 | grep USE_NOISE_SUPPRESSION

# If empty, add to .env
echo "USE_NOISE_SUPPRESSION=true" >> .env
pm2 restart voiceagent-telephony --update-env
```

### Issue: White noise still present

```bash
# Verify RNNoise is actually enabled in logs
pm2 logs voiceagent-telephony | grep "Noise Suppression"
# Should show: ENABLED (RNNoise/Jitsi)

# If shows DISABLED, check .env
cat .env | grep USE_NOISE_SUPPRESSION
```

---

## 📊 What's Different from Previous Attempts?

| Previous | Status | This (Jitsi RNNoise) |
|----------|--------|----------------------|
| @sapphi-red/web-noise-suppressor | ❌ Browser-only | ✅ Node.js compatible |
| rnnoise-wasm | ❌ Malicious | ✅ Legitimate (Jitsi) |
| libsamplerate BEST | ⚠️ Muffling | ✅ Voice-optimized AI |
| Simple resampling | ❌ White noise | ✅ Neural network suppression |

**Jitsi RNNoise** = AI-powered noise suppression used in production by Jitsi video conferencing

---

## 📖 Full Documentation

See `RNNOISE_JITSI_INTEGRATION.md` for:
- Technical architecture
- How RNNoise works
- Performance metrics
- Detailed troubleshooting

---

## 🎯 Success Criteria

- ✅ No white noise / background static
- ✅ Clear, natural voice quality
- ✅ Call transfer works
- ✅ Multilingual conversations work
- ✅ No service crashes

---

**Ready to test! Deploy and make a call.** 🚀

