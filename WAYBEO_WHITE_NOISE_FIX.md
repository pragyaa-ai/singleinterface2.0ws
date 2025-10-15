# Waybeo White Noise Fix - High-Quality Audio Resampling

**Branch**: `v4.3.0-webhook-updates`  
**Issue**: White noise/background static noise observed during Waybeo telephony calls  
**Root Cause**: Poor quality audio resampling causing aliasing artifacts  
**Solution**: Replace simple linear interpolation/decimation with professional-grade anti-aliasing resampling

---

## 🎯 Problem Analysis

### What Causes White Noise?

The original audio processing used:

**Upsampling (8kHz → 24kHz):**
```typescript
// Simple linear interpolation - NO anti-aliasing filter
samples24k[baseIndex + 1] = Math.round(currentSample + (nextSample - currentSample) * 0.33);
```

**Downsampling (24kHz → 8kHz):**
```typescript
// Simple decimation - NO anti-aliasing filter
samples8k[i] = samples24k[i * 3];  // Just taking every 3rd sample
```

### **Why This Causes White Noise:**

When downsampling without a low-pass filter:
- High-frequency components above 4kHz (Nyquist frequency for 8kHz) "fold back" into the audible range
- This creates **aliasing noise** = white noise/static
- Linear interpolation also creates high-frequency harmonics and quantization noise

---

## ✅ Solution

### Implemented Fix

Replaced custom resampling with **libsamplerate-js** - the JavaScript equivalent of the industry-standard libsamplerate library (Secret Rabbit Code).

This is the **same solution** used in the Python implementation with `librosa.resample()` that fixed Ozonetel's white noise issue.

### Technical Implementation

**Library**: `@alexanderolsen/libsamplerate-js`  
**Algorithm**: `SRC_SINC_BEST_QUALITY` (highest quality, proper anti-aliasing)  
**File**: `src/server/telephony/audio.ts`

```typescript
// Upsampler: 8kHz → 24kHz with anti-aliasing
upsampler = await create(
  1,      // nChannels: mono
  8000,   // inputSampleRate
  24000,  // outputSampleRate
  {
    converterType: ConverterType.SRC_SINC_BEST_QUALITY
  }
);

// Downsampler: 24kHz → 8kHz with anti-aliasing
downsampler = await create(
  1,      // nChannels: mono
  24000,  // inputSampleRate
  8000,   // outputSampleRate
  {
    converterType: ConverterType.SRC_SINC_BEST_QUALITY
  }
);
```

---

## 🎛️ Configuration

### Environment Variable Toggle

```bash
# Enable high-quality resampling (default: true)
USE_HIGH_QUALITY_RESAMPLING=true

# Disable for testing/fallback (uses simple resampling)
USE_HIGH_QUALITY_RESAMPLING=false
```

### Automatic Fallback

If high-quality resamplers fail to initialize, the system automatically falls back to simple resampling with a warning:

```
⚠️ Upsampler not initialized, falling back to simple resampling
```

---

## 📊 Expected Impact

### Audio Quality
- ✅ **Eliminates white noise/static** from downsampling aliasing
- ✅ **Cleaner audio output** with proper anti-aliasing filters
- ✅ **No interpolation artifacts** from high-quality sinc interpolation

### Performance
- ⚠️ **Slightly increased CPU usage** (~0.5-2ms per audio frame vs ~0.1ms)
- ✅ **Still real-time capable** - designed for streaming audio
- ✅ **Resampler instances cached** (not recreated per frame)

### Compatibility
- ✅ **Works with both Ozonetel and Waybeo**
- ✅ **No changes to telephony protocol**
- ✅ **Backward compatible** (can disable via env var)

---

## 🧪 Testing Checklist

### Test Scenarios

1. **Waybeo Call Quality**
   - [ ] Make test call to Waybeo number
   - [ ] Listen for white noise/static (should be eliminated)
   - [ ] Verify audio clarity

2. **Ozonetel Call Quality**
   - [ ] Make test call to Ozonetel number
   - [ ] Verify no regression (should still work)
   - [ ] Confirm audio quality maintained or improved

3. **Call Transfer Feature**
   - [ ] Complete data collection (Name, Car Model, Email)
   - [ ] Verify transfer message plays completely before transfer
   - [ ] Confirm transfer executes successfully

4. **Performance**
   - [ ] Monitor CPU usage during calls
   - [ ] Verify no audio latency/lag
   - [ ] Check for any timing issues with VAD (300ms silence detection)

5. **Fallback**
   - [ ] Test with `USE_HIGH_QUALITY_RESAMPLING=false`
   - [ ] Verify simple resampling still works
   - [ ] Confirm fallback warning logs appear

---

## 🚀 Deployment Steps

### 1. Pull Latest Code

```bash
cd /opt/voiceagent
git checkout v4.3.0-webhook-updates
git pull origin v4.3.0-webhook-updates
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Build

```bash
npm run build
```

### 4. Configure Environment (Optional)

```bash
# Add to .env if you want to explicitly enable
echo "USE_HIGH_QUALITY_RESAMPLING=true" >> .env
```

### 5. Restart Telephony Service

```bash
pm2 restart voiceagent-telephony
```

### 6. Verify Initialization

```bash
pm2 logs voiceagent-telephony --lines 20
```

**Expected log:**
```
🎵 Audio Resampling: HIGH-QUALITY (libsamplerate)
🎵 High-quality resamplers initialized successfully
```

---

## 🔄 Rollback Plan

If issues occur:

### Option 1: Disable High-Quality Resampling

```bash
export USE_HIGH_QUALITY_RESAMPLING=false
pm2 restart voiceagent-telephony --update-env
```

### Option 2: Revert to Previous Version

```bash
cd /opt/voiceagent
git checkout <previous-commit-hash>
npm run build
pm2 restart voiceagent-telephony
```

---

## 📝 Files Modified

- `src/server/telephony/audio.ts` - Audio resampling implementation
- `package.json` - Added `@alexanderolsen/libsamplerate-js` dependency
- `WAYBEO_WHITE_NOISE_FIX.md` - This documentation

---

## 🔗 References

- **libsamplerate-js**: https://github.com/aolsenjazz/libsamplerate-js
- **libsamplerate (C library)**: http://www.mega-nerd.com/SRC/
- **Python librosa**: Used same technique to fix Ozonetel white noise
- **Aliasing in Audio**: https://en.wikipedia.org/wiki/Aliasing

---

## ✅ Status

- [x] Implementation complete
- [x] Linter errors resolved
- [x] Documentation created
- [ ] Tested on GCP VM
- [ ] Verified with Waybeo calls
- [ ] Verified with Ozonetel calls
- [ ] Deployed to production

---

**Next Step**: Test on GCP VM with actual Waybeo calls to confirm white noise is eliminated.
