// Type declarations for @jitsi/rnnoise-wasm
declare module '@jitsi/rnnoise-wasm' {
  export interface RNNWasmModule {
    _rnnoise_create(): number;
    _rnnoise_destroy(state: number): void;
    _rnnoise_process_frame(state: number, inputPtr: number, outputPtr: number): number;
    _malloc(size: number): number;
    _free(ptr: number): void;
    HEAPF32: Float32Array;
  }
  
  export function createRNNWasmModule(): Promise<RNNWasmModule>;
  export function createRNNWasmModuleSync(): RNNWasmModule;
}

