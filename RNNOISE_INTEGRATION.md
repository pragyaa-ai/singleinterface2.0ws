# RNNoise Noise Suppression Integration

**Version**: 4.3.4  
**Branch**: `v4.3.0-webhook-updates`  
**Date**: October 17, 2025  
**Status**: Testing Phase

## Overview

Integrated **RNNoise** (Recurrent Neural Network-based noise suppression) to eliminate white noise and background static observed during Waybeo telephony calls.

## What is RNNoise?

RNNoise is a noise suppression library based on deep learning, specifically designed for voice applications. It uses a recurrent neural network trained on thousands of hours of noisy speech to distinguish between voice and background noise.

### Benefits:
- ✅ **Voice-optimized**: Preserves speech quality while removing noise
- ✅ **Low latency**: Suitable for real-time telephony applications  
- ✅ **Effective**: Superior to traditional signal processing methods for white noise
- ✅ **Efficient**: Uses minimal CPU resources

## Technical Implementation

### Architecture

```
Incoming Audio Flow (Telephony → OpenAI):
┌─────────────┐     ┌──────────────┐     ┌────────────┐     ┌─────────┐
│  Telephony  │────▶│   RNNoise    │────▶│  Upsample  │────▶│ OpenAI  │
│   (8kHz)    │     │ Suppression  │     │  8k→24kHz  │     │ (24kHz) │
└─────────────┘     └──────────────┘     └────────────┘     └─────────┘

Outgoing Audio Flow (OpenAI → Telephony):
┌─────────┐     ┌────────────┐     ┌─────────────┐
│ OpenAI  │────▶│ Downsample │────▶│  Telephony  │
│ (24kHz) │     │ 24k→8kHz   │     │   (8kHz)    │
└─────────┘     └────────────┘     └─────────────┘
```

### Files Modified

1. **`src/server/telephony/audio.ts`**
   - Added `@sapphi-red/web-noise-suppressor` import
   - Added `USE_NOISE_SUPPRESSION` environment variable (default: enabled)
   - Added `initializeNoiseSuppression()` async function
   - Added `suppressNoise8k()` function to process 8kHz audio
   - Integrated noise suppression into `upsample8kTo24k()` pipeline
   - Noise suppression is applied **before** upsampling for optimal quality

2. **`src/server/telephony/index.ts`**
   - Updated import to include `initializeNoiseSuppression`
   - Added noise suppression initialization on server startup
   - Updated startup log to reflect "audio processing" initialization

3. **`package.json`**
   - Added dependency: `@sapphi-red/web-noise-suppressor`
   - Updated version to `4.3.4`

## Configuration

### Environment Variables

Add to `.env` or configure via PM2:

```bash
# Enable/disable noise suppression (default: true)
USE_NOISE_SUPPRESSION=true

# Keep existing resampling settings
USE_HIGH_QUALITY_RESAMPLING=true
RESAMPLING_QUALITY=MEDIUM
```

### Configuration Options

| Variable | Default | Options | Description |
|----------|---------|---------|-------------|
| `USE_NOISE_SUPPRESSION` | `true` | `true`, `false` | Enable RNNoise noise suppression |
| `USE_HIGH_QUALITY_RESAMPLING` | `true` | `true`, `false` | Enable libsamplerate resampling |
| `RESAMPLING_QUALITY` | `MEDIUM` | `BEST`, `MEDIUM`, `FASTEST` | Resampling quality level |

## Deployment Guide

### Prerequisites

- Node.js environment with TypeScript support
- PM2 for process management
- Existing `v4.3.0-webhook-updates` codebase

### Deployment Steps

```bash
# 1. Navigate to project directory
cd /opt/voiceagent

# 2. Ensure you're on the correct branch
git fetch origin
git checkout v4.3.0-webhook-updates
git pull origin v4.3.0-webhook-updates

# 3. Install new dependencies
npm install

# 4. Configure environment variables (if not already set)
# Option A: Update .env file
echo "USE_NOISE_SUPPRESSION=true" >> .env

# Option B: Update PM2 environment in ecosystem.config.js
# Add USE_NOISE_SUPPRESSION: 'true' to env object

# 5. Build the project
npm run build

# 6. Restart telephony service
pm2 restart voiceagent-telephony

# 7. Verify initialization
pm2 logs voiceagent-telephony --lines 50 | grep -i "noise\|audio"
```

### Expected Output

On successful initialization, you should see:

```
🎵 Audio Resampling: HIGH-QUALITY (libsamplerate - MEDIUM)
🔇 Noise Suppression: ENABLED (RNNoise)
🎵 Initializing audio processing...
🎵 High-quality resamplers initialized successfully (Quality: MEDIUM)
🔇 RNNoise noise suppression initialized successfully (8kHz)
✅ Audio processing initialized
[telephony] WebSocket server with Spotlight-like behavior listening on ws://0.0.0.0:8765/ws
```

## Testing Plan

### Test Scenarios

1. **Baseline Test (Waybeo Telephony)**
   - Make a test call using Waybeo telephony
   - Listen for white noise / background static
   - **Expected**: No white noise, clear voice quality

2. **Comparison Test**
   - Test with `USE_NOISE_SUPPRESSION=false`
   - Test with `USE_NOISE_SUPPRESSION=true`
   - **Expected**: Significant reduction in white noise with RNNoise enabled

3. **Voice Quality Test**
   - Test multilingual conversations (English, Hindi, Marathi, etc.)
   - Verify speech clarity is preserved
   - **Expected**: Natural voice quality, no muffling or distortion

4. **Call Transfer Test**
   - Complete a full call flow with data collection
   - Verify call transfer works correctly
   - **Expected**: Transfer works without audio issues

5. **Long Call Test**
   - Test calls lasting 5+ minutes
   - Monitor for audio degradation or artifacts
   - **Expected**: Consistent audio quality throughout

### Testing Checklist

- [ ] White noise eliminated during Waybeo calls
- [ ] Voice quality preserved (no muffling)
- [ ] Multilingual conversations work correctly
- [ ] Call transfer functions properly
- [ ] No performance degradation (CPU/memory)
- [ ] Long calls remain stable

## Rollback Plan

If issues are encountered, rollback to `v4.3.3-live`:

```bash
cd /opt/voiceagent

# Switch to stable branch
git fetch origin
git checkout v4.3.3-live
git pull origin v4.3.3-live

# Reinstall dependencies (in case of package differences)
npm install

# Rebuild
npm run build

# Restart services
pm2 restart voiceagent-telephony

# Verify rollback
pm2 logs voiceagent-telephony --lines 20
```

## Technical Details

### RNNoise Processing

1. **Sample Rate**: RNNoise is initialized at 8kHz (telephony input rate)
2. **Processing**: Operates on Float32Array format (normalized -1.0 to 1.0)
3. **Frame Size**: Processes audio in frames (handled internally by library)
4. **Latency**: Minimal (~10ms per frame)

### Data Flow

```typescript
// Incoming audio from telephony (8kHz)
samples8k: Int16Array
  ↓
int16ToFloat32(samples8k) → Float32Array
  ↓
noiseSuppressor8k.process() → Clean Float32Array
  ↓
float32ToInt16() → Clean Int16Array
  ↓
upsampleHighQuality() → 24kHz Int16Array
  ↓
Send to OpenAI
```

### Error Handling

- **Graceful Fallback**: If RNNoise fails to initialize, audio processing continues without noise suppression
- **Runtime Errors**: If noise suppression fails during processing, original audio is passed through
- **Logging**: All errors are logged for debugging

## Performance Considerations

### CPU Usage

- RNNoise adds minimal CPU overhead (~5-10% per concurrent call)
- Deep learning model is optimized for real-time processing
- WASM implementation ensures cross-platform performance

### Memory Usage

- RNNoise model: ~2MB per instance
- Per-call overhead: ~1-2MB for processing buffers
- Total impact: Negligible for typical deployments

## Known Limitations

1. **Sample Rate**: RNNoise works best at 48kHz but we're using 8kHz for telephony compatibility
2. **Static Models**: RNNoise uses pre-trained models and cannot be customized for specific noise types
3. **Voice Changes**: Very aggressive noise suppression might affect some voice characteristics

## Comparison with Previous Attempts

| Approach | Result | Notes |
|----------|--------|-------|
| Simple Resampling | ❌ White noise present | Fast but poor quality |
| libsamplerate (BEST) | ⚠️ Muffling | High quality but over-filters |
| libsamplerate (MEDIUM) | ⚠️ Muffling | Better but still issues |
| libsamplerate (FASTEST) | ❌ Worse quality | Not acceptable |
| Speex Resampler | ❌ API errors | Could not initialize |
| Polyphase Filter | ❌ Failed | Implementation issues |
| **RNNoise + libsamplerate** | ✅ **Testing** | **Voice-optimized noise suppression** |

## Future Enhancements

1. **Adaptive Suppression**: Add environment variable to control suppression strength
2. **24kHz Processing**: Process outgoing audio (OpenAI → Telephony) for bidirectional noise suppression
3. **Metrics**: Add logging for noise reduction metrics (SNR improvement)
4. **A/B Testing**: Implement runtime switching for comparative testing

## References

- [RNNoise Project](https://jmvalin.ca/demo/rnnoise/)
- [@sapphi-red/web-noise-suppressor](https://github.com/sapphi-red/web-noise-suppressor)
- [Opus Codec (RNNoise origin)](https://opus-codec.org/)

## Support

For issues or questions:
1. Check PM2 logs: `pm2 logs voiceagent-telephony`
2. Verify initialization: Look for "RNNoise noise suppression initialized"
3. Test with noise suppression disabled: `USE_NOISE_SUPPRESSION=false`
4. Rollback to `v4.3.3-live` if issues persist

## Status

- **Current**: In testing on `v4.3.0-webhook-updates` branch
- **Stable**: `v4.3.3-live` remains unchanged for production
- **Next Steps**: Test with Waybeo telephony, validate audio quality, merge to live if successful

