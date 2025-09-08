import WebSocket from 'ws';

interface RealtimeClientConfig {
  apiKey: string;
  model?: string;
  inputSampleRate?: number;
  outputSampleRate?: number;
}

export class OpenAIRealtimeWSClient {
  private ws?: WebSocket;
  private readonly apiKey: string;
  private readonly model: string;
  private readonly inputSampleRate: number;
  private readonly outputSampleRate: number;

  constructor(cfg: RealtimeClientConfig) {
    this.apiKey = cfg.apiKey;
    this.model = cfg.model || 'gpt-4o-realtime-preview-2025-06-03';
    this.inputSampleRate = cfg.inputSampleRate ?? 8000;
    this.outputSampleRate = cfg.outputSampleRate ?? 8000;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = `wss://api.openai.com/v1/realtime?model=${encodeURIComponent(this.model)}`;
      const headers = {
        Authorization: `Bearer ${this.apiKey}`,
        'OpenAI-Beta': 'realtime=v1',
      } as any;

      const ws = new WebSocket(url, { headers });
      this.ws = ws;

      ws.on('open', async () => {
        try {
          // Configure session for PCM16 8k
          const sessionUpdate = {
            type: 'session.update',
            session: {
              model: this.model,
              input_audio_format: {
                type: 'pcm16',
                channels: 1,
                sample_rate_hz: this.inputSampleRate,
              },
              output_audio_format: {
                type: 'pcm16',
                channels: 1,
                sample_rate_hz: this.outputSampleRate,
              },
              turn_detection: {
                type: 'server_vad',
                threshold: 0.9,
                prefix_padding_ms: 300,
                silence_duration_ms: 500,
                create_response: true,
              },
            },
          };
          ws.send(JSON.stringify(sessionUpdate));
          resolve();
        } catch (e) {
          reject(e);
        }
      });

      ws.on('error', (err) => reject(err));
    });
  }

  sendAudioChunkBase64(b64Pcm: string) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({
      type: 'input_audio_buffer.append',
      audio: b64Pcm,
    }));
  }

  commitInput() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ type: 'input_audio_buffer.commit' }));
    this.ws.send(JSON.stringify({ type: 'response.create' }));
  }

  clearInput() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ type: 'input_audio_buffer.clear' }));
  }

  onMessage(cb: (msg: any) => void) {
    this.ws?.on('message', (data) => {
      try {
        const text = data.toString();
        const json = JSON.parse(text);
        cb(json);
      } catch {
        // ignore non-JSON frames
      }
    });
  }

  close() {
    this.ws?.close();
    this.ws = undefined;
  }
}



