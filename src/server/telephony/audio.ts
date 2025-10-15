// PCM16 (Int16) utilities for 8kHz mono audio
import { create, ConverterType } from '@alexanderolsen/libsamplerate-js';

// Environment variable to enable high-quality resampling (default: true for production)
const USE_HIGH_QUALITY_RESAMPLING = process.env.USE_HIGH_QUALITY_RESAMPLING !== 'false';

// Log which resampling algorithm is being used
console.log(`🎵 Audio Resampling: ${USE_HIGH_QUALITY_RESAMPLING ? 'HIGH-QUALITY (libsamplerate)' : 'SIMPLE (linear interpolation)'}`);

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
  // Little-endian signed 16-bit PCM
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
// HIGH-QUALITY RESAMPLING (libsamplerate)
// ========================================
// This uses proper anti-aliasing filters to eliminate white noise/static
// Equivalent to Python's librosa.resample() which fixed Ozonetel's white noise issue

let upsampler: any = null;
let downsampler: any = null;
let resamplersInitialized = false;

// Initialize resamplers asynchronously
async function initializeResamplers() {
  if (!resamplersInitialized) {
    try {
      // Create upsampler: 8kHz -> 24kHz
      upsampler = await create(
        1,      // nChannels: mono
        8000,   // inputSampleRate
        24000,  // outputSampleRate
        {
          converterType: ConverterType.SRC_SINC_BEST_QUALITY // Highest quality - same as librosa
        }
      );
      
      // Create downsampler: 24kHz -> 8kHz
      downsampler = await create(
        1,      // nChannels: mono
        24000,  // inputSampleRate
        8000,   // outputSampleRate
        {
          converterType: ConverterType.SRC_SINC_BEST_QUALITY // Includes proper anti-aliasing filter
        }
      );
      
      resamplersInitialized = true;
      console.log('🎵 High-quality resamplers initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize high-quality resamplers:', error);
      // Fall back to simple resampling
      resamplersInitialized = false;
    }
  }
}

// Helper: Convert Int16Array to Float32Array (normalized to -1 to 1)
function int16ToFloat32(int16: Int16Array): Float32Array {
  const float32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) {
    float32[i] = int16[i] / 32768.0; // Normalize: -32768..32767 -> -1..1
  }
  return float32;
}

function upsampleHighQuality(samples8k: Int16Array): Int16Array {
  if (!upsampler) {
    console.warn('⚠️ Upsampler not initialized, falling back to simple resampling');
    return upsampleSimple(samples8k);
  }
  
  // Convert Int16 -> Float32
  const float32Input = int16ToFloat32(samples8k);
  
  // Resample (returns Float32Array)
  const float32Output = upsampler.full(float32Input);
  
  // Convert Float32 -> Int16
  return float32ToInt16(float32Output);
}

function downsampleHighQuality(samples24k: Int16Array): Int16Array {
  if (!downsampler) {
    console.warn('⚠️ Downsampler not initialized, falling back to simple resampling');
    return downsampleSimple(samples24k);
  }
  
  // Convert Int16 -> Float32
  const float32Input = int16ToFloat32(samples24k);
  
  // Resample (returns Float32Array)
  const float32Output = downsampler.full(float32Input);
  
  // Convert Float32 -> Int16
  return float32ToInt16(float32Output);
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
    
    // Original sample
    samples24k[baseIndex] = currentSample;
    
    // Linear interpolation for intermediate samples
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
// PUBLIC API - Configurable via Environment Variable
// ========================================

// Export initialization function for resamplers
export { initializeResamplers };

// Upsample 8kHz to 24kHz (3x)
export function upsample8kTo24k(samples8k: Int16Array): Int16Array {
  if (USE_HIGH_QUALITY_RESAMPLING) {
    return upsampleHighQuality(samples8k);
  } else {
    return upsampleSimple(samples8k);
  }
}

// Downsample 24kHz to 8kHz (1/3)
export function downsample24kTo8k(samples24k: Int16Array): Int16Array {
  if (USE_HIGH_QUALITY_RESAMPLING) {
    return downsampleHighQuality(samples24k);
  } else {
    return downsampleSimple(samples24k);
  }
}



