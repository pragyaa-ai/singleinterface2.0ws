import 'dotenv/config';
import http from 'http';
import WebSocket, { WebSocketServer } from 'ws';
import { int16ArrayToBase64, ensureInt16Array } from './audio';
import { OpenAIRealtimeWSClient } from './openaiRealtime';

interface OzonetelMediaPacket {
  event: string;
  type: string;
  ucid: string;
  data?: {
    samples: number[];
    bitsPerSample: number;
    sampleRate: number;
    channelCount: number;
    numberOfFrames: number;
    type: 'data';
  };
}

interface Session {
  ucid: string;
  client: WebSocket;
  openai: OpenAIRealtimeWSClient;
  receivedFirstPacket: boolean;
  inputFrameBuffer: number[][]; // queue of sample arrays
}

const port = Number(process.env.TELEPHONY_WS_PORT || 8080);
const host = process.env.TELEPHONY_WS_HOST || '0.0.0.0';

const server = http.createServer();
const wss = new WebSocketServer({ server, path: '/ws' });

const sessions = new Map<string, Session>();

function createOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY as string;
  if (!apiKey) throw new Error('OPENAI_API_KEY not set');
  return new OpenAIRealtimeWSClient({ apiKey, inputSampleRate: 8000, outputSampleRate: 8000 });
}

async function handleConnection(ws: WebSocket) {
  let ucid = '';
  let session: Session | null = null;

  ws.on('message', async (data) => {
    try {
      const msg = JSON.parse(data.toString()) as OzonetelMediaPacket | { command: string };

      // Handle command messages
      if ('command' in msg) {
        if (!session) return;
        const cmd = msg.command;
        if (cmd === 'clearBuffer') {
          session.openai.clearInput();
        } else if (cmd === 'callDisconnect') {
          session.openai.close();
          ws.close();
        }
        return;
      }

      // From here, msg is OzonetelMediaPacket
      if (msg.event === 'start') {
        ucid = msg.ucid || '';
        const openai = createOpenAIClient();
        await openai.connect();
        session = {
          ucid,
          client: ws,
          openai,
          receivedFirstPacket: false,
          inputFrameBuffer: [],
        };
        sessions.set(ucid, session);

        // Forward OpenAI audio responses back to Ozonetel as PCM16 frames
        openai.onMessage((evt) => {
          try {
            if (evt.type === 'response.output_audio.delta' && evt.audio) {
              // evt.audio is base64; decode to Int16 if necessary
              const b64 = evt.audio as string;
              const buf = Buffer.from(b64, 'base64');
              const int16 = new Int16Array(buf.buffer, buf.byteOffset, buf.byteLength / 2);
              const numberOfFrames = int16.length;
              const payload = {
                event: 'media',
                type: 'media',
                ucid: ucid,
                data: {
                  samples: Array.from(int16),
                  bitsPerSample: 16,
                  sampleRate: 8000,
                  channelCount: 1,
                  numberOfFrames,
                  type: 'data' as const,
                },
              };
              if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload));
            }
          } catch {}
        });
        return;
      }

      if (!session) return;

      if (msg.event === 'media' && msg.data) {
        // Ignore very first packet (may be 16k per Ozonetel note)
        if (!session.receivedFirstPacket) {
          session.receivedFirstPacket = true;
          return;
        }

        // Expect 8k mono 10ms frames (80 samples)
        const samples = ensureInt16Array(msg.data.samples);
        const b64 = int16ArrayToBase64(samples);
        session.openai.sendAudioChunkBase64(b64);

        // Commit periodically — here we commit each frame for simplicity
        session.openai.commitInput();
        return;
      }

      if (msg.event === 'stop') {
        if (session) {
          session.openai.close();
          sessions.delete(session.ucid);
        }
        if (ws.readyState === WebSocket.OPEN) ws.close();
        return;
      }
    } catch (err) {
      console.error('WS message error', err);
    }
  });

  ws.on('close', () => {
    if (session) {
      session.openai.close();
      sessions.delete(session.ucid);
    }
  });
}

wss.on('connection', handleConnection);

server.listen(port, host, () => {
  console.log(`[telephony] WebSocket server listening on ws://${host}:${port}/ws`);
});


