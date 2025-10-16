# Test speex-resampler Alternative

## 🎯 Quick Decision Guide

**Try this order:**

1. ✅ **FASTEST with libsamplerate** (5 min) - No code changes
2. ✅ **speex-resampler** (10 min) - Best for voice/telephony
3. ⚠️ **Stay with MEDIUM** (if acceptable) - Keep current

---

## Option 1: Test FASTEST Quality (Quickest)

**No code changes needed!**

```bash
cd /opt/voiceagent
echo "RESAMPLING_QUALITY=FASTEST" >> .env
pm2 restart voiceagent-telephony --update-env
pm2 logs voiceagent-telephony --lines 20
```

**Expected:**
- White noise: Still reduced
- Muffling: Should be eliminated
- Clarity: Excellent

**If this works**, you're done! No need to change libraries.

---

## Option 2: Switch to speex-resampler (Recommended for Voice)

### Why speex-resampler?

- ✅ **Specifically designed for VoIP/telephony**
- ✅ **No muffling** (voice-optimized filter)
- ✅ **Simpler** (no Float32 conversion, synchronous API)
- ✅ **Faster** (lighter weight than libsamplerate)
- ✅ **Battle-tested** (used in WebRTC, Speex codec)

### Deployment Steps

**1. Install speex-resampler**

```bash
cd /opt/voiceagent
npm install speex-resampler
```

**2. Switch to speex audio module**

```bash
# Backup current audio.ts
cp src/server/telephony/audio.ts src/server/telephony/audio-libsamplerate.ts

# Use speex version
cp src/server/telephony/audio-speex.ts src/server/telephony/audio.ts
```

**3. Build and restart**

```bash
npm run build
pm2 restart voiceagent-telephony
```

**4. Verify logs**

```bash
pm2 logs voiceagent-telephony --lines 20
```

**Expected log:**
```
🎵 Audio Resampling: SPEEX (Voice-Optimized, Quality: 8)
🎵 Speex-resampler ready (Voice-optimized, Quality: 8)
```

**5. Test call**

Make a test call and check:
- [ ] White noise - should be reduced
- [ ] Muffling - should be GONE
- [ ] Voice clarity - should be excellent
- [ ] Transfer - should still work

---

### Quality Levels for speex

```bash
# High quality (default)
echo "SPEEX_QUALITY=8" >> .env

# Maximum quality (more CPU)
echo "SPEEX_QUALITY=10" >> .env

# Fast (good balance)
echo "SPEEX_QUALITY=5" >> .env

pm2 restart voiceagent-telephony --update-env
```

**Recommendation**: Start with 8 (default), it's optimal for voice.

---

## Rollback Plans

### Go back to libsamplerate-js

```bash
cd /opt/voiceagent

# Restore libsamplerate version
cp src/server/telephony/audio-libsamplerate.ts src/server/telephony/audio.ts

npm run build
pm2 restart voiceagent-telephony
```

### Go back to original simple resampling

```bash
export USE_HIGH_QUALITY_RESAMPLING=false
pm2 restart voiceagent-telephony --update-env
```

---

## Expected Results Comparison

| Test | White Noise | Muffling | Clarity | Speed | Best For |
|------|-------------|----------|---------|-------|----------|
| **Original** | ❌ High | ✅ None | ⚠️ OK | ✅ Fast | Baseline |
| **libsamplerate BEST** | ✅ Minimal | ❌ Yes | ⚠️ Over-filtered | ⚠️ Slow | Not voice |
| **libsamplerate MEDIUM** | ✅ Very Low | ⚠️ Slight | ✅ Good | ⚠️ Medium | Music |
| **libsamplerate FASTEST** | ✅ Low | ⚠️ Maybe | ✅ Good | ✅ Fast | Quick fix |
| **speex-resampler** | ✅ Low | ✅ **None** | ✅ **Excellent** | ✅ **Fast** | **Voice/VoIP** |

---

## My Recommendation

**For your telephony use case:**

1. **Quick test**: Try `RESAMPLING_QUALITY=FASTEST` first
2. **If still issues**: Switch to **speex-resampler**
3. **speex is the best long-term solution** for voice/telephony

**Why speex wins for voice:**
- Specifically designed for what you're doing (VoIP/telephony)
- No muffling (voice-optimized anti-aliasing)
- Simpler implementation (no Float32 conversion overhead)
- Faster than libsamplerate
- Same library used in production VoIP systems

---

## Summary Commands

### Option A: Test FASTEST (Quick)
```bash
cd /opt/voiceagent
echo "RESAMPLING_QUALITY=FASTEST" >> .env
pm2 restart voiceagent-telephony --update-env
```

### Option B: Switch to speex (Best for Voice)
```bash
cd /opt/voiceagent
npm install speex-resampler
cp src/server/telephony/audio-speex.ts src/server/telephony/audio.ts
npm run build
pm2 restart voiceagent-telephony
pm2 logs voiceagent-telephony --lines 20
```

---

**Start with Option A**, test thoroughly. If still muffled, go with **Option B** (speex).

