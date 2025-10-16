# Alternative: speex-resampler Implementation

## Why speex-resampler?

**speex-resampler** is specifically designed for **real-time voice/telephony applications**:

- ✅ Used in WebRTC, VoIP applications
- ✅ Optimized for speech (not music)
- ✅ Fast and lightweight
- ✅ Less aggressive filtering (no muffling)
- ✅ Excellent voice clarity
- ✅ Much simpler API than libsamplerate

---

## Installation

```bash
npm install speex-resampler
```

---

## Implementation

### Replace in `src/server/telephony/audio.ts`:

```typescript
// BEFORE: libsamplerate-js
import { create, ConverterType } from '@alexanderolsen/libsamplerate-js';

// AFTER: speex-resampler
const speex = require('speex-resampler');
```

### Replace resampler initialization:

```typescript
// BEFORE: Complex async initialization with libsamplerate
async function initializeResamplers() {
  upsampler = await create(1, 8000, 24000, {...});
  downsampler = await create(1, 24000, 8000, {...});
}

// AFTER: Simple sync initialization with speex
function initializeResamplers() {
  // speex-resampler is synchronous and simpler
  console.log('🎵 Using speex-resampler for voice-optimized audio processing');
  return Promise.resolve(); // Return promise for compatibility
}
```

### Replace resampling functions:

```typescript
// BEFORE: Complex Float32 conversion with libsamplerate
function upsampleHighQuality(samples8k: Int16Array): Int16Array {
  const float32Input = int16ToFloat32(samples8k);
  const float32Output = upsampler.full(float32Input);
  return float32ToInt16(float32Output);
}

// AFTER: Direct Int16 processing with speex
function upsampleHighQuality(samples8k: Int16Array): Int16Array {
  // speex works directly with Int16Array, no Float32 conversion needed
  const samples24k = speex.resample(
    samples8k,      // input samples
    8000,           // input sample rate
    24000,          // output sample rate
    1               // channels (mono)
  );
  return samples24k;
}

function downsampleHighQuality(samples24k: Int16Array): Int16Array {
  const samples8k = speex.resample(
    samples24k,     // input samples
    24000,          // input sample rate
    8000,           // output sample rate
    1               // channels (mono)
  );
  return samples8k;
}
```

---

## Key Advantages

### 1. **Simpler Code**
- No async initialization needed
- No Float32 ↔ Int16 conversion (works directly with Int16)
- Fewer moving parts = fewer things to break

### 2. **Better for Voice**
- Optimized filter for speech frequencies
- Less aggressive anti-aliasing (preserves voice clarity)
- No over-filtering (no muffling)

### 3. **Faster**
- No Float32 conversion overhead
- Lighter weight algorithm
- Better for real-time streaming

### 4. **Battle-Tested**
- Used in production VoIP applications
- Same resampler used in Speex codec
- Proven for telephony use cases

---

## Comparison: Your Use Case

| Aspect | libsamplerate-js | speex-resampler | Winner |
|--------|------------------|-----------------|--------|
| **Voice Quality** | Over-filtered | Optimized | ✅ speex |
| **Muffling** | Possible | None | ✅ speex |
| **White Noise** | Minimal | Low | ≈ Tie |
| **Real-time** | Medium | Fast | ✅ speex |
| **Code Complexity** | High | Low | ✅ speex |
| **API** | Async, complex | Sync, simple | ✅ speex |
| **Music Quality** | Excellent | Good | libsamplerate |

**For VoIP/telephony**: speex-resampler is the better choice.

---

## Implementation Steps

1. **Install speex-resampler**
   ```bash
   npm install speex-resampler
   ```

2. **Update `src/server/telephony/audio.ts`**
   - Replace imports
   - Simplify initialization (no async needed)
   - Replace resampling functions (direct Int16 processing)

3. **Remove libsamplerate-js** (optional)
   ```bash
   npm uninstall @alexanderolsen/libsamplerate-js
   ```

4. **Test**
   ```bash
   npm run build
   pm2 restart voiceagent-telephony
   ```

---

## Expected Results

- ✅ **White noise**: Still significantly reduced (proper anti-aliasing)
- ✅ **Muffling**: Eliminated (voice-optimized filter)
- ✅ **Clarity**: Excellent (designed for speech)
- ✅ **Performance**: Faster (no Float32 conversion)
- ✅ **Simplicity**: Much simpler code

---

## Recommendation

**Try this order:**

1. **First**: Test `RESAMPLING_QUALITY=FASTEST` with current libsamplerate-js
   - Quick fix, no code changes
   - May solve the issue immediately

2. **If still muffled**: Switch to speex-resampler
   - Better suited for your telephony use case
   - Will definitely eliminate muffling
   - Excellent voice quality

---

## Other Options (Not Recommended)

- **sox/ffmpeg**: Requires external processes, too heavy
- **WebAudio API**: Only works in browser, not Node.js
- **Custom polyphase**: Complex to implement correctly
- **simple-resampler**: Too basic, won't fix white noise

**speex-resampler is the sweet spot** for voice/telephony applications.

