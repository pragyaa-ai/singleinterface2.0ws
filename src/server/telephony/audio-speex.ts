// PCM16 (Int16) utilities for 8kHz mono audio
// ALTERNATIVE IMPLEMENTATION using speex-resampler (optimized for voice/telephony)

const speex = require('speex-resampler');

// Environment variable to enable high-quality resampling (default: true for production)
const USE_HIGH_QUALITY_RESAMPLING = process.env.USE_HIGH_QUALITY_RESAMPLING !== 'false';

// Quality level for speex (0-10, where 10 is highest quality)
// 10 = Highest quality, most CPU (default)
// 8 = Very good quality, balanced CPU
// 5 = Good quality, fast
const SPEEX_QUALITY = parseInt(process.env.SPEEX_QUALITY || '8', 10);

console.log(`🎵 Audio Resampling: ${USE_HIGH_QUALITY_RESAMPLING ? `SPEEX (Voice-Optimized, Quality: ${SPEEX_QUALITY})` : 'SIMPLE (linear interpolation)'}`);

export function int16ArrayToBase64(int16: Int16Array): string {
  const bytes = new Uint8Array(int16.buffer, int16.byteOffset, int16.byteLength);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const sub = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, Array.from(sub) as any);
  }
  return Buffer.from(binary, 'binary').toString('base64');
}

export function base64ToInt16Array(b64: string): Int16Array {
  const buf = Buffer.from(b64, 'base64');
  return new Int16Array(buf.buffer, buf.byteOffset, buf.byteLength / 2);
}

export function float32ToInt16(float32: Float32Array): Int16Array {
  const out = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    let s = Math.max(-1, Math.min(1, float32[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

export function generateSilenceFrames(frames: number): Int16Array {
  return new Int16Array(frames);
}

export function ensureInt16Array(samples: number[] | Int16Array): Int16Array {
  if (samples instanceof Int16Array) return samples;
  const arr = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) arr[i] = samples[i];
  return arr;
}

// ========================================
// HIGH-QUALITY RESAMPLING (speex-resampler)
// ========================================
// Voice-optimized resampling - no muffling, excellent clarity
// Designed specifically for real-time voice/telephony applications

function upsampleSpeex(samples8k: Int16Array): Int16Array {
  try {
    // speex.resample(input, inputRate, outputRate, channels, quality)
    const samples24k = speex.resample(
      samples8k,
      8000,      // input sample rate
      24000,     // output sample rate  
      1,         // channels (mono)
      SPEEX_QUALITY
    );
    return samples24k;
  } catch (error) {
    console.error('❌ Speex upsample error:', error);
    return upsampleSimple(samples8k);
  }
}

function downsampleSpeex(samples24k: Int16Array): Int16Array {
  try {
    const samples8k = speex.resample(
      samples24k,
      24000,     // input sample rate
      8000,      // output sample rate
      1,         // channels (mono)
      SPEEX_QUALITY
    );
    return samples8k;
  } catch (error) {
    console.error('❌ Speex downsample error:', error);
    return downsampleSimple(samples24k);
  }
}

// ========================================
// SIMPLE RESAMPLING (Original - Fast but causes white noise)
// ========================================
// Kept as fallback for testing/comparison

function upsampleSimple(samples8k: Int16Array): Int16Array {
  const samples24k = new Int16Array(samples8k.length * 3);
  
  for (let i = 0; i < samples8k.length; i++) {
    const baseIndex = i * 3;
    const currentSample = samples8k[i];
    const nextSample = i < samples8k.length - 1 ? samples8k[i + 1] : currentSample;
    
    samples24k[baseIndex] = currentSample;
    samples24k[baseIndex + 1] = Math.round(currentSample + (nextSample - currentSample) * 0.33);
    samples24k[baseIndex + 2] = Math.round(currentSample + (nextSample - currentSample) * 0.67);
  }
  
  return samples24k;
}

function downsampleSimple(samples24k: Int16Array): Int16Array {
  const samples8k = new Int16Array(Math.floor(samples24k.length / 3));
  
  for (let i = 0; i < samples8k.length; i++) {
    samples8k[i] = samples24k[i * 3];
  }
  
  return samples8k;
}

// ========================================
// PUBLIC API
// ========================================

// No initialization needed for speex (synchronous API)
export async function initializeResamplers() {
  if (USE_HIGH_QUALITY_RESAMPLING) {
    console.log(`🎵 Speex-resampler ready (Voice-optimized, Quality: ${SPEEX_QUALITY})`);
  }
  return Promise.resolve();
}

// Upsample 8kHz to 24kHz (3x)
export function upsample8kTo24k(samples8k: Int16Array): Int16Array {
  if (USE_HIGH_QUALITY_RESAMPLING) {
    return upsampleSpeex(samples8k);
  } else {
    return upsampleSimple(samples8k);
  }
}

// Downsample 24kHz to 8kHz (1/3)
export function downsample24kTo8k(samples24k: Int16Array): Int16Array {
  if (USE_HIGH_QUALITY_RESAMPLING) {
    return downsampleSpeex(samples24k);
  } else {
    return downsampleSimple(samples24k);
  }
}

