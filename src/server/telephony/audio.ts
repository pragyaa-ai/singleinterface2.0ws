// PCM16 (Int16) utilities for 8kHz mono audio
import { create, ConverterType } from '@alexanderolsen/libsamplerate-js';

// Environment variable to enable noise suppression (default: false until tested)
const USE_NOISE_SUPPRESSION = process.env.USE_NOISE_SUPPRESSION === 'true';

// Environment variable to enable high-quality resampling (default: true for production)
const USE_HIGH_QUALITY_RESAMPLING = process.env.USE_HIGH_QUALITY_RESAMPLING !== 'false';

// Quality level: BEST | MEDIUM (default) | FASTEST
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

// Log which audio processing is being used
console.log(`🎵 Audio Resampling: ${USE_HIGH_QUALITY_RESAMPLING ? `HIGH-QUALITY (libsamplerate - ${RESAMPLING_QUALITY})` : 'SIMPLE (linear interpolation)'}`);
console.log(`🔇 Noise Suppression: ${USE_NOISE_SUPPRESSION ? 'ENABLED (RNNoise/Jitsi)' : 'DISABLED'}`);

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

// Removed - using improved version in RNNoise section

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
// NOISE SUPPRESSION (RNNoise - Jitsi)
// ========================================
// RNNoise uses a recurrent neural network to suppress background noise
// RNNoise requires 48kHz audio and processes frames of 480 samples (10ms)

let rnnoiseModule: any = null;
let denoiser: number | null = null;
let rnnoiseReady = false;
const RNNOISE_FRAME_SIZE = 480; // 10ms at 48kHz

// Initialize RNNoise in background (non-blocking) - matches working test system
function initializeNoiseSuppression() {
  if (!USE_NOISE_SUPPRESSION) {
    console.log('🔇 Noise Suppression: DISABLED');
    return;
  }
  
  // Non-blocking initialization with setTimeout (from working test system)
  setTimeout(() => {
    (async () => {
      try {
        // Use require() with direct path to dist file (CommonJS compatible)
        const createRNNWasmModuleSync = require('@jitsi/rnnoise-wasm/dist/rnnoise-sync.js').default;
        rnnoiseModule = createRNNWasmModuleSync();
        await rnnoiseModule.ready;
        denoiser = rnnoiseModule._rnnoise_create(null);
        rnnoiseReady = true;
        console.log('✅ [AUDIO] Jitsi RNNoise initialized (denoiser:', denoiser, ')');
      } catch (error: any) {
        console.warn('⚠️ [AUDIO] RNNoise not available, using basic audio processing:', error?.message || error);
        rnnoiseModule = null;
        denoiser = null;
        rnnoiseReady = false;
      }
    })();
  }, 100);
}

// Helper functions for sample rate conversion (matching test system)
function upsample24kTo48k(samples24k: Int16Array): Int16Array {
  const samples48k = new Int16Array(samples24k.length * 2);
  
  for (let i = 0; i < samples24k.length; i++) {
    const currentSample = samples24k[i];
    const nextSample = i < samples24k.length - 1 ? samples24k[i + 1] : currentSample;
    
    samples48k[i * 2] = currentSample;
    samples48k[i * 2 + 1] = Math.round((currentSample + nextSample) / 2);
  }
  
  return samples48k;
}

function downsample48kTo24k(samples48k: Int16Array): Int16Array {
  const samples24k = new Int16Array(Math.floor(samples48k.length / 2));
  
  for (let i = 0; i < samples24k.length; i++) {
    const idx = i * 2;
    const s1 = samples48k[idx];
    const s2 = samples48k[Math.min(idx + 1, samples48k.length - 1)];
    samples24k[i] = Math.round((s1 + s2) / 2);
  }
  
  return samples24k;
}

// Placeholder for compatibility with telephony service init
async function initializeNoiseResamplers() {
  // No separate resamplers needed - using simple interpolation
  console.log('🔇 RNNoise uses built-in sample rate conversion');
}

// Convert Int16 to Float32 (matching test system)
function int16ToFloat32(samples: Int16Array): Float32Array {
  const float32 = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    float32[i] = samples[i] / 32768.0;
  }
  return float32;
}

// Convert Float32 to Int16 (matching test system)
function float32ToInt16(samples: Float32Array): Int16Array {
  const int16 = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    int16[i] = s < 0 ? Math.round(s * 32768) : Math.round(s * 32767);
  }
  return int16;
}

// Apply RNNoise to 24kHz audio (matching test system)
async function applyRNNoise(samples24k: Int16Array): Promise<Int16Array> {
  // If RNNoise not ready, return immediately (no blocking)
  if (!rnnoiseReady || !denoiser || !rnnoiseModule) {
    return samples24k; // Fallback to original
  }

  try {
    // Upsample to 48kHz (RNNoise requirement)
    const samples48k = upsample24kTo48k(samples24k);
    
    // Convert Int16 to Float32 for RNNoise
    const float32Samples = int16ToFloat32(samples48k);
    
    // Allocate WASM memory for input/output
    const bufferPtr = rnnoiseModule._malloc(480 * 4); // 480 Float32 samples
    const buffer = new Float32Array(rnnoiseModule.HEAPF32.buffer, bufferPtr, 480);
    
    // Process in 480-sample chunks (10ms at 48kHz)
    const denoisedFloat32 = new Float32Array(float32Samples.length);
    
    for (let i = 0; i < float32Samples.length; i += 480) {
      const chunk = float32Samples.slice(i, i + 480);
      
      // Pad last chunk if needed
      if (chunk.length < 480) {
        const padded = new Float32Array(480);
        padded.set(chunk);
        buffer.set(padded);
      } else {
        buffer.set(chunk);
      }
      
      // Process frame with RNNoise
      rnnoiseModule._rnnoise_process_frame(denoiser, bufferPtr, bufferPtr);
      
      // Copy denoised samples
      const denoised = new Float32Array(rnnoiseModule.HEAPF32.buffer, bufferPtr, chunk.length);
      denoisedFloat32.set(denoised, i);
    }
    
    // Free WASM memory
    rnnoiseModule._free(bufferPtr);
    
    // Convert back to Int16
    const denoisedInt16_48k = float32ToInt16(denoisedFloat32);
    
    // Downsample back to 24kHz
    const denoisedInt16_24k = downsample48kTo24k(denoisedInt16_48k);
    
    return denoisedInt16_24k;
  } catch (error) {
    console.error('❌ RNNoise processing error:', error);
    return samples24k; // Return original on error
  }
}

// Apply gentle fade to prevent clicks (matching test system)
function applyFade(samples: Int16Array): Int16Array {
  const output = new Int16Array(samples.length);
  const fadeLength = Math.min(16, Math.floor(samples.length / 4)); // ~2ms at 8kHz
  
  for (let i = 0; i < samples.length; i++) {
    if (i < fadeLength) {
      // Fade in
      const factor = i / fadeLength;
      output[i] = Math.round(samples[i] * factor);
    } else if (i >= samples.length - fadeLength) {
      // Fade out
      const factor = (samples.length - i) / fadeLength;
      output[i] = Math.round(samples[i] * factor);
    } else {
      output[i] = samples[i];
    }
  }
  
  return output;
}

// Complete audio processing pipeline (matching test system)
export async function processAudioForOutput(samples24k: Int16Array): Promise<Int16Array> {
  try {
    // Step 1: Apply RNNoise denoising at 24kHz→48kHz→24kHz
    let denoised24k = await applyRNNoise(samples24k);
    
    // Step 2: Downsample 24kHz to 8kHz with averaging
    let samples8k = downsample24kTo8k(denoised24k);
    
    // Step 3: Apply gentle fade to prevent clicks
    samples8k = applyFade(samples8k);
    
    return samples8k;
  } catch (error) {
    console.error('❌ Audio processing error:', error);
    // Fallback: simple processing without RNNoise
    let samples8k = downsample24kTo8k(samples24k);
    samples8k = applyFade(samples8k);
    return samples8k;
  }
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
export { initializeResamplers, initializeNoiseSuppression, initializeNoiseResamplers };

// Upsample 8kHz to 24kHz (3x) for input audio (from telephony)
export function upsample8kTo24k(samples8k: Int16Array): Int16Array {
  // Simple upsampling for input audio (no noise suppression here)
  // Noise suppression is applied to output audio (processAudioForOutput)
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



