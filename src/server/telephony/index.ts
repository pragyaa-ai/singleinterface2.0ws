import 'dotenv/config';
import http from 'http';
import WebSocket, { WebSocketServer } from 'ws';
import { int16ArrayToBase64, ensureInt16Array } from './audio';

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
  openaiWs: WebSocket;
  receivedFirstPacket: boolean;
  inputFrameBuffer: number[][]; // queue of sample arrays
}

const port = Number(process.env.TELEPHONY_WS_PORT || 8080);
const host = process.env.TELEPHONY_WS_HOST || '0.0.0.0';

const server = http.createServer();
const wss = new WebSocketServer({ server, path: '/ws' });

const sessions = new Map<string, Session>();

async function createOpenAIConnection(ucid: string): Promise<WebSocket> {
  const apiKey = process.env.OPENAI_API_KEY as string;
  if (!apiKey) throw new Error('OPENAI_API_KEY not set');

  return new Promise((resolve, reject) => {
    const openaiWs = new WebSocket('wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2025-06-03', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'OpenAI-Beta': 'realtime=v1'
      }
    });

    openaiWs.on('open', () => {
      console.log(`[${ucid}] Connected to OpenAI Realtime API`);
      
      // Configure session for Spotlight agent behavior
      openaiWs.send(JSON.stringify({
        type: 'session.update',
        session: {
          input_audio_format: 'pcm16',
          output_audio_format: 'pcm16',
          input_audio_transcription: { model: 'whisper-1' },
          turn_detection: {
            type: 'server_vad',
            threshold: 0.5,
            prefix_padding_ms: 300,
            silence_duration_ms: 500
          },
          instructions: `You are a professional automotive sales assistant for SingleInterface. Your role is to collect customer information for automotive sales leads.

## Your Task
Collect these 3 essential pieces of information:
1. **Full Name** - Complete customer name
2. **Car Model** - Specific car model they're interested in
3. **Email ID** - Customer's email for follow-up

## Your Approach
- Be warm and professional with Indian English accent
- Start with: "Hello! This call is from Single Interface. For your car purchase enquiry, we need to collect some details from you so we can connect you with the correct car dealer closest to you. Can I continue?"
- Collect each piece of information systematically
- Always repeat back information for confirmation
- After collecting all 3 data points, say: "Thank you! We will now connect you with the dealer for your ${car_model}. Please hold on."

## Important
- Keep responses concise and natural
- Focus only on collecting the 3 required data points
- Be enthusiastic about helping with their car buying journey`,
          voice: 'alloy',
          temperature: 0.8
        }
      }));

      resolve(openaiWs);
    });

    openaiWs.on('error', (err) => {
      console.error(`[${ucid}] OpenAI error:`, err);
      reject(err);
    });
  });
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
          session.openaiWs.send(JSON.stringify({ type: 'input_audio_buffer.clear' }));
        } else if (cmd === 'callDisconnect') {
          session.openaiWs.close();
          ws.close();
        }
        return;
      }

      // From here, msg is OzonetelMediaPacket
      if (msg.event === 'start') {
        ucid = msg.ucid || '';
        try {
          const openaiWs = await createOpenAIConnection(ucid);
          session = {
            ucid,
            client: ws,
            openaiWs,
            receivedFirstPacket: false,
            inputFrameBuffer: [],
          };
          sessions.set(ucid, session);

          // Handle responses from OpenAI (Spotlight-like behavior)
          openaiWs.on('message', (data) => {
            try {
              const event = JSON.parse(data.toString());
              
              if (event.type === 'response.audio.delta' && event.delta) {
                // Convert base64 to samples for Ozonetel
                const audioBuffer = Buffer.from(event.delta, 'base64');
                const samples = Array.from(new Int16Array(audioBuffer.buffer));
                
                const payload = {
                  event: 'media',
                  type: 'media',
                  ucid: ucid,
                  data: {
                    samples: samples,
                    bitsPerSample: 16,
                    sampleRate: 8000,
                    channelCount: 1,
                    numberOfFrames: samples.length,
                    type: 'data' as const,
                  },
                };
                
                if (ws.readyState === WebSocket.OPEN) {
                  ws.send(JSON.stringify(payload));
                }
              }

              // Log important events
              if (event.type === 'conversation.item.created') {
                console.log(`[${ucid}] User said:`, event.item?.content?.[0]?.transcript || 'audio');
              }
              
              if (event.type === 'response.text.done') {
                console.log(`[${ucid}] Assistant response:`, event.text);
              }

            } catch (err) {
              console.error(`[${ucid}] OpenAI message parse error:`, err);
            }
          });

        } catch (err) {
          console.error(`[${ucid}] Failed to create OpenAI connection:`, err);
        }
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

        // Send to OpenAI Realtime
        session.openaiWs.send(JSON.stringify({
          type: 'input_audio_buffer.append',
          audio: b64,
        }));

        // Commit and trigger response
        session.openaiWs.send(JSON.stringify({
          type: 'input_audio_buffer.commit',
        }));

        session.openaiWs.send(JSON.stringify({
          type: 'response.create',
        }));
        return;
      }

      if (msg.event === 'stop') {
        if (session) {
          session.openaiWs.close();
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
      session.openaiWs.close();
      sessions.delete(session.ucid);
    }
  });
}

wss.on('connection', handleConnection);

server.listen(port, host, () => {
  console.log(`[telephony] WebSocket server with Spotlight-like behavior listening on ws://${host}:${port}/ws`);
});


