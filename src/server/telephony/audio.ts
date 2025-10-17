// PCM16 (Int16) utilities for 8kHz mono audio
import { create, ConverterType } from '@alexanderolsen/libsamplerate-js';
import { NoiseSuppressor } from '@sapphi-red/web-noise-suppressor';

// Environment variable to enable high-quality resampling (default: true for production)
const USE_HIGH_QUALITY_RESAMPLING = process.env.USE_HIGH_QUALITY_RESAMPLING !== 'false';

// Quality level: BEST (default) | MEDIUM | FASTEST
// BEST = Highest quality, most CPU, may cause muffling
// MEDIUM = Good balance of quality and speed
// FASTEST = Lowest quality, least CPU, but no muffling
const RESAMPLING_QUALITY = process.env.RESAMPLING_QUALITY || 'MEDIUM';

// Map quality level to ConverterType
const getQualityType = () => {
  switch (RESAMPLING_QUALITY) {
    case 'BEST': return ConverterType.SRC_SINC_BEST_QUALITY;
    case 'MEDIUM': return ConverterType.SRC_SINC_MEDIUM_QUALITY;
    case 'FASTEST': return ConverterType.SRC_SINC_FASTEST;
    default: return ConverterType.SRC_SINC_MEDIUM_QUALITY;
  }
};

// Environment variable to enable RNNoise noise suppression (default: true for Waybeo)
const USE_NOISE_SUPPRESSION = process.env.USE_NOISE_SUPPRESSION !== 'false';

// Log which audio processing is being used
console.log(`🎵 Audio Resampling: ${USE_HIGH_QUALITY_RESAMPLING ? `HIGH-QUALITY (libsamplerate - ${RESAMPLING_QUALITY})` : 'SIMPLE (linear interpolation)'}`);
console.log(`🔇 Noise Suppression: ${USE_NOISE_SUPPRESSION ? 'ENABLED (RNNoise)' : 'DISABLED'}`);

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
      const qualityType = getQualityType();
      
      // Create upsampler: 8kHz -> 24kHz
      upsampler = await create(
        1,      // nChannels: mono
        8000,   // inputSampleRate
        24000,  // outputSampleRate
        {
          converterType: qualityType
        }
      );
      
      // Create downsampler: 24kHz -> 8kHz
      downsampler = await create(
        1,      // nChannels: mono
        24000,  // inputSampleRate
        8000,   // outputSampleRate
        {
          converterType: qualityType
        }
      );
      
      resamplersInitialized = true;
      console.log(`🎵 High-quality resamplers initialized successfully (Quality: ${RESAMPLING_QUALITY})`);
    } catch (error) {
      console.error('❌ Failed to initialize high-quality resamplers:', error);
      // Fall back to simple resampling
      resamplersInitialized = false;
    }
  }
}

// ========================================
// NOISE SUPPRESSION (RNNoise)
// ========================================
// RNNoise uses a recurrent neural network to suppress background noise
// while preserving voice quality - ideal for telephony applications

let noiseSuppressor8k: NoiseSuppressor | null = null;
let noiseSuppressionInitialized = false;

// Initialize noise suppressor for 8kHz audio (telephony input)
async function initializeNoiseSuppression() {
  if (!noiseSuppressionInitialized && USE_NOISE_SUPPRESSION) {
    try {
      // RNNoise works best at 48kHz, but we'll use 8kHz for telephony input
      noiseSuppressor8k = await NoiseSuppressor.Create(8000); // 8kHz sample rate
      
      noiseSuppressionInitialized = true;
      console.log('🔇 RNNoise noise suppression initialized successfully (8kHz)');
    } catch (error) {
      console.error('❌ Failed to initialize noise suppression:', error);
      noiseSuppressionInitialized = false;
    }
  }
}

// Apply noise suppression to 8kHz audio (before upsampling)
function suppressNoise8k(samples8k: Int16Array): Int16Array {
  if (!USE_NOISE_SUPPRESSION || !noiseSuppressor8k) {
    return samples8k; // Return original if disabled or not initialized
  }
  
  try {
    // Convert Int16 -> Float32
    const float32Input = int16ToFloat32(samples8k);
    
    // Process with RNNoise (modifies in-place)
    const processedFloat32 = noiseSuppressor8k.process(float32Input);
    
    // Convert Float32 -> Int16
    return float32ToInt16(processedFloat32);
  } catch (error) {
    console.error('❌ Noise suppression error:', error);
    return samples8k; // Return original on error
  }
}

// Helper: Convert Int16Array to Float32Array (normalized to -1 to 1)
function int16ToFloat32(int16: Int16Array): Float32Array {
  const float32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) {
    // Proper normalization: divide by 32768 for negative, 32767 for positive
    // This avoids asymmetry that can cause distortion
    const sample = int16[i];
    float32[i] = sample < 0 ? sample / 32768.0 : sample / 32767.0;
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

// Export initialization functions
export { initializeResamplers, initializeNoiseSuppression };

// Upsample 8kHz to 24kHz (3x) with optional noise suppression
export function upsample8kTo24k(samples8k: Int16Array): Int16Array {
  // Apply noise suppression BEFORE upsampling (if enabled)
  const cleanSamples8k = suppressNoise8k(samples8k);
  
  // Then upsample to 24kHz
  if (USE_HIGH_QUALITY_RESAMPLING) {
    return upsampleHighQuality(cleanSamples8k);
  } else {
    return upsampleSimple(cleanSamples8k);
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



