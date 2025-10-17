// PCM16 (Int16) utilities for 8kHz mono audio
import { create, ConverterType } from '@alexanderolsen/libsamplerate-js';
import { createRNNWasmModuleSync } from '@jitsi/rnnoise-wasm';

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
// NOISE SUPPRESSION (RNNoise - Jitsi)
// ========================================
// RNNoise uses a recurrent neural network to suppress background noise
// RNNoise requires 48kHz audio and processes frames of 480 samples (10ms)

let rnnoiseModule: any = null;
let rnnoiseState: number | null = null;
let rnnoiseHeapPtr: number | null = null;
let resampler8kTo48k: any = null;
let resampler48kTo8k: any = null;
const RNNOISE_FRAME_SIZE = 480; // 10ms at 48kHz
let noiseSuppressionInitialized = false;

// Initialize RNNoise module and resamplers
function initializeNoiseSuppression() {
  if (!noiseSuppressionInitialized && USE_NOISE_SUPPRESSION) {
    try {
      // Initialize RNNoise WASM module (synchronous version)
      rnnoiseModule = createRNNWasmModuleSync();
      
      // Create RNNoise state
      rnnoiseState = rnnoiseModule._rnnoise_create();
      
      // Allocate heap memory for audio frames (480 float samples)
      rnnoiseHeapPtr = rnnoiseModule._malloc(RNNOISE_FRAME_SIZE * 4); // 4 bytes per float
      
      if (!rnnoiseState || !rnnoiseHeapPtr) {
        throw new Error('Failed to allocate RNNoise resources');
      }
      
      noiseSuppressionInitialized = true;
      console.log('🔇 RNNoise noise suppression initialized successfully (Jitsi WASM)');
    } catch (error) {
      console.error('❌ Failed to initialize RNNoise:', error);
      noiseSuppressionInitialized = false;
      rnnoiseModule = null;
      rnnoiseState = null;
      rnnoiseHeapPtr = null;
    }
  }
}

// Initialize 8kHz <-> 48kHz resamplers for RNNoise
async function initializeNoiseResamplers() {
  if (!noiseSuppressionInitialized || !USE_NOISE_SUPPRESSION) return;
  
  try {
    // Upsampler: 8kHz -> 48kHz (for RNNoise input)
    resampler8kTo48k = await create(
      1,      // nChannels: mono
      8000,   // inputSampleRate
      48000,  // outputSampleRate
      {
        converterType: ConverterType.SRC_SINC_FASTEST // Use fastest for noise suppression path
      }
    );
    
    // Downsampler: 48kHz -> 8kHz (after RNNoise processing)
    resampler48kTo8k = await create(
      1,      // nChannels: mono
      48000,  // inputSampleRate
      8000,   // outputSampleRate
      {
        converterType: ConverterType.SRC_SINC_FASTEST
      }
    );
    
    console.log('🔇 RNNoise resamplers (8kHz ↔ 48kHz) initialized');
  } catch (error) {
    console.error('❌ Failed to initialize RNNoise resamplers:', error);
  }
}

// Apply noise suppression to 8kHz audio
function suppressNoise8k(samples8k: Int16Array): Int16Array {
  if (!USE_NOISE_SUPPRESSION || !noiseSuppressionInitialized || !rnnoiseModule || !rnnoiseState || !rnnoiseHeapPtr || !resampler8kTo48k || !resampler48kTo8k) {
    return samples8k; // Return original if not initialized
  }
  
  try {
    // Step 1: Upsample 8kHz -> 48kHz
    const float32_8k = int16ToFloat32(samples8k);
    const float32_48k = resampler8kTo48k.full(float32_8k);
    const samples48k = float32ToInt16(float32_48k);
    
    // Step 2: Process through RNNoise in 480-sample frames
    const processedSamples48k: number[] = [];
    
    for (let i = 0; i < samples48k.length; i += RNNOISE_FRAME_SIZE) {
      const frame = samples48k.subarray(i, i + RNNOISE_FRAME_SIZE);
      
      // If frame is incomplete, pad with zeros
      let processedFrame: Int16Array;
      if (frame.length < RNNOISE_FRAME_SIZE) {
        const paddedFrame = new Int16Array(RNNOISE_FRAME_SIZE);
        paddedFrame.set(frame);
        processedFrame = processRnnoiseFrame(paddedFrame);
        // Only keep the actual samples, not padding
        processedSamples48k.push(...Array.from(processedFrame.subarray(0, frame.length)));
      } else {
        processedFrame = processRnnoiseFrame(frame);
        processedSamples48k.push(...Array.from(processedFrame));
      }
    }
    
    // Step 3: Downsample 48kHz -> 8kHz
    const processed48k = new Int16Array(processedSamples48k);
    const float32_48k_processed = int16ToFloat32(processed48k);
    const float32_8k_processed = resampler48kTo8k.full(float32_48k_processed);
    const processed8k = float32ToInt16(float32_8k_processed);
    
    return processed8k;
  } catch (error) {
    console.error('❌ RNNoise processing error:', error);
    return samples8k; // Return original on error
  }
}

// Process a single 480-sample frame through RNNoise
function processRnnoiseFrame(frame480: Int16Array): Int16Array {
  if (!rnnoiseModule || !rnnoiseState || !rnnoiseHeapPtr) {
    return frame480;
  }
  
  // Convert Int16 samples to Float32 and copy to WASM heap
  const heapFloat32 = new Float32Array(rnnoiseModule.HEAPF32.buffer, rnnoiseHeapPtr, RNNOISE_FRAME_SIZE);
  for (let i = 0; i < RNNOISE_FRAME_SIZE; i++) {
    heapFloat32[i] = frame480[i];
  }
  
  // Process frame through RNNoise (modifies heapFloat32 in-place)
  rnnoiseModule._rnnoise_process_frame(rnnoiseState, heapFloat32.byteOffset, heapFloat32.byteOffset);
  
  // Convert back to Int16
  const output = new Int16Array(RNNOISE_FRAME_SIZE);
  for (let i = 0; i < RNNOISE_FRAME_SIZE; i++) {
    const sample = heapFloat32[i];
    output[i] = sample < 0 ? Math.max(-32768, sample) : Math.min(32767, sample);
  }
  
  return output;
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
export { initializeResamplers, initializeNoiseSuppression, initializeNoiseResamplers };

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



