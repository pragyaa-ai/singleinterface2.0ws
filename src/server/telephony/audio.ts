// PCM16 (Int16) utilities for 8kHz mono audio

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



