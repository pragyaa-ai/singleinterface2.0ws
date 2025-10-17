# RNNoise Integration (Jitsi WASM) - v4.3.4

**Version**: 4.3.4  
**Branch**: `v4.3.0-webhook-updates`  
**Library**: `@jitsi/rnnoise-wasm` v0.2.1  
**Status**: Ready for Testing  
**Date**: October 17, 2025

## Overview

Integrated **@jitsi/rnnoise-wasm** (Jitsi's WASM build of RNNoise) to eliminate white noise and background static during Waybeo telephony calls.

## Why Jitsi RNNoise?

- ✅ **Reputable**: From Jitsi open-source video conferencing platform
- ✅ **Legitimate**: Not flagged as malicious (unlike rnnoise-wasm)
- ✅ **Node.js Compatible**: Works in server-side environments
- ✅ **Well-Maintained**: Actively used in production by Jitsi
- ✅ **Voice-Optimized**: AI-powered noise suppression trained on speech

## Technical Implementation

### Architecture

```
Incoming Audio Flow (Telephony → OpenAI):
┌─────────────┐   ┌──────────┐   ┌──────────┐   ┌────────────┐   ┌─────────┐
│  Telephony  │──▶│ Upsample │──▶│ RNNoise  │──▶│ Downsample │──▶│ OpenAI  │
│   (8kHz)    │   │ 8k→48kHz │   │ (48kHz)  │   │ 48k→24kHz  │   │ (24kHz) │
└─────────────┘   └──────────┘   └──────────┘   └────────────┘   └─────────┘

Outgoing Audio Flow (OpenAI → Telephony):
┌─────────┐   ┌────────────┐   ┌─────────────┐
│ OpenAI  │──▶│ Downsample │──▶│  Telephony  │
│ (24kHz) │   │ 24k→8kHz   │   │   (8kHz)    │
└─────────┘   └────────────┘   └─────────────┘
```

### How RNNoise Works

1. **Sample Rate**: RNNoise requires 48kHz audio
2. **Frame Size**: Processes 480 samples (10ms) per frame
3. **Processing**: Uses a trained neural network to separate voice from noise

### Processing Steps

1. **Receive 8kHz audio** from telephony
2. **Upsample to 48kHz** using libsamplerate (FASTEST quality)
3. **Process through RNNoise** in 480-sample frames
4. **Downsample to 8kHz** using libsamplerate
5. **Upsample to 24kHz** for OpenAI (using existing pipeline)

### Files Modified

1. **`package.json`**
   - Added: `@jitsi/rnnoise-wasm@0.2.1`
   - Version: 4.3.4

2. **`src/server/telephony/audio.ts`**
   - Added RNNoise WASM module initialization
   - Added 8kHz ↔ 48kHz resamplers for RNNoise
   - Added frame processing logic (480 samples)
   - Updated `suppressNoise8k()` function
   - Added `processRnnoiseFrame()` helper

3. **`src/server/telephony/index.ts`**
   - Updated import to include `initializeNoiseResamplers`
   - Added RNNoise initialization in startup sequence

4. **`src/types/jitsi-rnnoise.d.ts`** (New)
   - TypeScript type definitions for @jitsi/rnnoise-wasm

## Configuration

### Environment Variables

```bash
# Enable/disable noise suppression (default: false)
USE_NOISE_SUPPRESSION=true

# Resampling quality for main pipeline (default: MEDIUM)
RESAMPLING_QUALITY=MEDIUM  # Options: BEST, MEDIUM, FASTEST

# High-quality resampling (default: true)
USE_HIGH_QUALITY_RESAMPLING=true
```

**Note**: RNNoise uses FASTEST quality for its internal 8kHz ↔ 48kHz resampling to minimize latency.

## Deployment Guide

### On GCP VM

```bash
# 1. Navigate to project
cd /opt/voiceagent

# 2. Stash any local changes
git stash

# 3. Pull latest code
git fetch origin
git checkout v4.3.0-webhook-updates
git pull origin v4.3.0-webhook-updates

# 4. Install dependencies (including @jitsi/rnnoise-wasm)
npm install

# 5. Build project
npm run build

# 6. Enable RNNoise (IMPORTANT: It's disabled by default)
echo "USE_NOISE_SUPPRESSION=true" >> .env

# 7. Restart telephony service
pm2 restart voiceagent-telephony --update-env

# 8. Verify initialization
pm2 logs voiceagent-telephony --lines 50 | grep -E "noise|audio|RNNoise"
```

### Expected Output

On successful initialization:

```
🎵 Audio Resampling: HIGH-QUALITY (libsamplerate - MEDIUM)
🔇 Noise Suppression: ENABLED (RNNoise/Jitsi)
🎵 Initializing audio processing...
🎵 High-quality resamplers initialized successfully (Quality: MEDIUM)
🔇 RNNoise noise suppression initialized successfully (Jitsi WASM)
🔇 RNNoise resamplers (8kHz ↔ 48kHz) initialized
✅ Audio processing initialized
[telephony] WebSocket server listening on ws://0.0.0.0:8765/ws
```

## Testing Plan

### Test Scenarios

1. **Baseline Test** (RNNoise Disabled)
   - Set `USE_NOISE_SUPPRESSION=false`
   - Make test call
   - Note white noise level

2. **RNNoise Enabled Test**
   - Set `USE_NOISE_SUPPRESSION=true`
   - Make test call
   - **Expected**: Significant reduction in white noise

3. **Voice Quality Test**
   - Test multilingual: English, Hindi, Marathi
   - **Expected**: Clear voice, no muffling or distortion

4. **Call Transfer Test**
   - Complete data collection → transfer
   - **Expected**: Transfer works correctly with clear audio

5. **Long Call Test**
   - 5+ minute call
   - **Expected**: Consistent audio quality

### Testing Checklist

- [ ] White noise eliminated during Waybeo calls
- [ ] Voice quality preserved (natural, clear)
- [ ] No muffling or distortion
- [ ] Multilingual conversations work
- [ ] Call transfer functions properly
- [ ] No service crashes or errors
- [ ] CPU usage acceptable (<20% increase per call)

## Rollback Plan

If issues occur, rollback to stable version:

```bash
cd /opt/voiceagent
git checkout v4.3.3-live
git pull origin v4.3.3-live
npm install
npm run build
pm2 restart voiceagent-telephony
```

**Rollback time**: < 2 minutes

## Technical Details

### RNNoise API

```typescript
// Initialize WASM module
const rnnoiseModule = createRNNWasmModuleSync();

// Create noise suppression state
const rnnoiseState = rnnoiseModule._rnnoise_create();

// Allocate heap memory for 480 samples
const heapPtr = rnnoiseModule._malloc(480 * 4); // 4 bytes per float

// Process a frame (modifies in-place)
rnnoiseModule._rnnoise_process_frame(
  rnnoiseState,      // State handle
  heapFloat32.byteOffset,  // Input pointer
  heapFloat32.byteOffset   // Output pointer (same for in-place)
);

// Cleanup
rnnoiseModule._free(heapPtr);
rnnoiseModule._rnnoise_destroy(rnnoiseState);
```

### Memory Management

- **RNNoise State**: ~100KB per instance
- **Heap Buffer**: 1,920 bytes (480 floats)
- **Resampler Buffers**: ~10-20KB per direction
- **Total per call**: ~150-200KB additional memory

### Performance

- **CPU Impact**: ~5-15% per concurrent call
- **Latency**: ~10-15ms additional (negligible for telephony)
- **Frame Processing**: 480 samples @ 48kHz = 10ms chunks

## Comparison with Previous Attempts

| Approach | Status | Notes |
|----------|--------|-------|
| Simple Resampling | ❌ | White noise present |
| libsamplerate BEST | ⚠️ | Muffling |
| libsamplerate MEDIUM | ⚠️ | Muffling |
| libsamplerate FASTEST | ❌ | Worse quality |
| Speex Resampler | ❌ | API errors |
| Polyphase Filter | ❌ | Implementation issues |
| @sapphi-red/web-noise-suppressor | ❌ | Browser-only (Web Audio API) |
| rnnoise-wasm | ❌ | Malicious package |
| **@jitsi/rnnoise-wasm** | ✅ **Testing** | **Legitimate, voice-optimized** |

## Troubleshooting

### Issue: "RNNoise not initialized" warnings

```bash
# Verify USE_NOISE_SUPPRESSION is set
pm2 env 1 | grep USE_NOISE_SUPPRESSION

# If not set, add to .env and restart
echo "USE_NOISE_SUPPRESSION=true" >> .env
pm2 restart voiceagent-telephony --update-env
```

### Issue: Build fails with TypeScript errors

```bash
# Ensure type definitions exist
ls -la src/types/jitsi-rnnoise.d.ts

# If missing, pull latest code
git pull origin v4.3.0-webhook-updates
npm run build
```

### Issue: Service crashes on startup

```bash
# Check logs for WASM initialization errors
pm2 logs voiceagent-telephony --err --lines 100

# If RNNoise fails, temporarily disable
export USE_NOISE_SUPPRESSION=false
pm2 restart voiceagent-telephony --update-env
```

## Known Limitations

1. **48kHz Requirement**: RNNoise is hardcoded for 48kHz, requiring additional resampling steps
2. **Frame Size**: Must process in 480-sample chunks (10ms @ 48kHz)
3. **CPU Usage**: Additional resampling adds some CPU overhead
4. **Latency**: ~10-15ms additional latency (acceptable for telephony)

## Future Enhancements

1. **Adaptive Suppression**: Add control for suppression strength
2. **Bidirectional**: Apply to outgoing audio (OpenAI → Telephony) as well
3. **Metrics**: Log noise reduction metrics (SNR improvement)
4. **Optimization**: Investigate 8kHz RNNoise model to eliminate resampling

## References

- [Jitsi RNNoise WASM Repository](https://github.com/jitsi/rnnoise-wasm)
- [RNNoise Project](https://people.xiph.org/~jm/demo/rnnoise/)
- [Xiph.org RNNoise](https://gitlab.xiph.org/xiph/rnnoise)

## Support

For issues:
1. Check logs: `pm2 logs voiceagent-telephony`
2. Verify initialization: Look for "RNNoise noise suppression initialized"
3. Test with disabled: `USE_NOISE_SUPPRESSION=false`
4. Rollback to `v4.3.3-live` if needed

## Status

- **Current**: Ready for testing on `v4.3.0-webhook-updates`
- **Stable Fallback**: `v4.3.3-live` (unchanged)
- **Next Steps**: 
  1. Deploy to GCP VM
  2. Test with Waybeo calls
  3. Validate white noise elimination
  4. Merge to live if successful

