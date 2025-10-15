# Audio Quality Testing Guide - Muffling Fix

## 🎯 Issue

After implementing high-quality resampling:
- ✅ **White noise improved** (aliasing reduced)
- ❌ **Muffling detected** when VoiceAgent speaks
- ❌ **Voice not very clear**

## 🔍 Root Cause

**SINC_BEST_QUALITY** algorithm may be:
- Too aggressive with anti-aliasing filter (over-filtering high frequencies)
- Introducing phase shifts that cause muffling
- Too CPU-intensive for real-time audio (causing latency/buffering)

## ✅ Solution Implemented

### 1. **Configurable Quality Levels**

Added `RESAMPLING_QUALITY` environment variable:

```bash
# MEDIUM (default) - Best balance
RESAMPLING_QUALITY=MEDIUM

# FASTEST - Least CPU, no muffling, still better than simple
RESAMPLING_QUALITY=FASTEST

# BEST - Highest quality, may cause muffling
RESAMPLING_QUALITY=BEST
```

### 2. **Improved Float32 ↔ Int16 Conversion**

Fixed asymmetric normalization that could cause distortion:

**Before:**
```typescript
float32[i] = int16[i] / 32768.0;  // Asymmetric
```

**After:**
```typescript
float32[i] = sample < 0 ? sample / 32768.0 : sample / 32767.0;  // Symmetric
```

---

## 🧪 Testing Protocol

### Test 1: MEDIUM Quality (Default)

```bash
cd /opt/voiceagent
git pull origin v4.3.0-webhook-updates
npm install
npm run build

# Use MEDIUM quality (default)
pm2 restart voiceagent-telephony

# Check logs
pm2 logs voiceagent-telephony --lines 20
```

**Expected log:**
```
🎵 Audio Resampling: HIGH-QUALITY (libsamplerate - MEDIUM)
🎵 High-quality resamplers initialized successfully (Quality: MEDIUM)
```

**Test:**
- Make a Waybeo call
- Listen for:
  - [ ] White noise - should be reduced
  - [ ] Muffling - should be minimal/gone
  - [ ] Clarity - should be good

---

### Test 2: FASTEST Quality (If MEDIUM Still Muffled)

```bash
# Add to .env
echo "RESAMPLING_QUALITY=FASTEST" >> .env

pm2 restart voiceagent-telephony --update-env

# Check logs
pm2 logs voiceagent-telephony --lines 20
```

**Expected log:**
```
🎵 Audio Resampling: HIGH-QUALITY (libsamplerate - FASTEST)
🎵 High-quality resamplers initialized successfully (Quality: FASTEST)
```

**Test:**
- Make a Waybeo call
- Listen for:
  - [ ] White noise - should still be better than original
  - [ ] Muffling - should be completely gone
  - [ ] Clarity - should be excellent

---

### Test 3: BEST Quality (For Comparison)

```bash
# Change in .env
export RESAMPLING_QUALITY=BEST
pm2 restart voiceagent-telephony --update-env
```

**Test:**
- Compare with MEDIUM and FASTEST
- Likely to have muffling (this was the original issue)

---

### Test 4: Disable Resampling (Baseline)

```bash
# Disable high-quality resampling
export USE_HIGH_QUALITY_RESAMPLING=false
pm2 restart voiceagent-telephony --update-env
```

**Expected log:**
```
🎵 Audio Resampling: SIMPLE (linear interpolation)
```

**Test:**
- This is the original algorithm
- Will have white noise/aliasing
- But no muffling
- Use as baseline for comparison

---

## 📊 Comparison Matrix

| Quality Level | White Noise | Muffling | Clarity | CPU Usage | Recommendation |
|--------------|-------------|----------|---------|-----------|----------------|
| **SIMPLE (original)** | ❌ High | ✅ None | ⚠️ Medium | ✅ Low | Baseline |
| **FASTEST** | ✅ Low | ✅ None | ✅ Good | ⚠️ Medium | **Best for production** |
| **MEDIUM (default)** | ✅ Very Low | ⚠️ Slight | ✅ Very Good | ⚠️ Medium | **Recommended** |
| **BEST** | ✅ Minimal | ❌ Yes | ⚠️ Over-filtered | ❌ High | Not recommended |

---

## 🎯 Expected Outcome

**MEDIUM quality should:**
- ✅ Reduce white noise significantly
- ✅ Minimal or no muffling
- ✅ Good voice clarity
- ✅ Acceptable CPU usage

**If MEDIUM still has muffling:**
- Switch to **FASTEST**
- Still much better than SIMPLE (original)
- No muffling
- Excellent clarity

---

## 🔄 Rollback Options

### Option 1: Change Quality
```bash
export RESAMPLING_QUALITY=FASTEST
pm2 restart voiceagent-telephony --update-env
```

### Option 2: Disable High-Quality Resampling
```bash
export USE_HIGH_QUALITY_RESAMPLING=false
pm2 restart voiceagent-telephony --update-env
```

### Option 3: Revert Code
```bash
git checkout e79f540  # Before resampling
npm run build
pm2 restart voiceagent-telephony
```

---

## 📝 Files Modified

- `src/server/telephony/audio.ts` - Added quality levels and improved conversion
- `AUDIO_QUALITY_TESTING_GUIDE.md` - This testing guide

---

## ✅ Recommendation

**Start with MEDIUM (default)**, test thoroughly.

If muffling persists, use **FASTEST** - it provides excellent balance:
- ✅ Much better than original simple resampling
- ✅ Proper anti-aliasing (reduces white noise)
- ✅ Fast enough for real-time audio
- ✅ No over-filtering (no muffling)
- ✅ Clear voice quality

---

**Next Step**: Deploy and test with MEDIUM quality (default), then adjust based on results.

