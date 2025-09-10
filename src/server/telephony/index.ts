import 'dotenv/config';
import http from 'http';
import WebSocket, { WebSocketServer } from 'ws';
import { int16ArrayToBase64, ensureInt16Array } from './audio';
import { RealtimeSession, OpenAIRealtimeWebRTC } from '@openai/agents/realtime';

// Import your existing agents
import { spotlightAgent } from '../../app/agentConfigs/customerServiceRetail/spotlight';
import { createModerationGuardrail } from '../../app/agentConfigs/guardrails';

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
  realtimeSession: RealtimeSession;
  receivedFirstPacket: boolean;
  inputFrameBuffer: number[][]; // queue of sample arrays
}

const port = Number(process.env.TELEPHONY_WS_PORT || 8080);
const host = process.env.TELEPHONY_WS_HOST || '0.0.0.0';

const server = http.createServer();
const wss = new WebSocketServer({ server, path: '/ws' });

const sessions = new Map<string, Session>();

async function createRealtimeSession(ucid: string): Promise<RealtimeSession> {
  const apiKey = process.env.OPENAI_API_KEY as string;
  if (!apiKey) throw new Error('OPENAI_API_KEY not set');

  // Create guardrail
  const guardrail = createModerationGuardrail('Single Interface');

  // Create session with Spotlight agent as root
  const session = new RealtimeSession(spotlightAgent, {
    transport: new OpenAIRealtimeWebRTC({
      // No audio element needed for server-side
    }),
    model: 'gpt-4o-realtime-preview-2025-06-03',
    config: {
      inputAudioFormat: 'pcm16',
      outputAudioFormat: 'pcm16',
      inputAudioTranscription: {
        model: 'whisper-1',
      },
      turnDetection: {
        type: 'server_vad',
        threshold: 0.5,
        prefix_padding_ms: 300,
        silence_duration_ms: 500,
        create_response: true,
      },
    },
    outputGuardrails: [guardrail],
    context: {
      preferredLanguage: 'English',
      // Sales data functions for Spotlight agent
      captureSalesData: (type: string, value: string, notes?: string) => {
        console.log(`[${ucid}] Sales data captured: ${type} = ${value}`);
        return { success: true, message: `Captured ${type}: ${value}` };
      },
      verifySalesData: (type: string, confirmed: boolean) => {
        console.log(`[${ucid}] Sales data verified: ${type} = ${confirmed}`);
        return { success: true, message: `Verified ${type}` };
      },
      captureAllSalesData: (data: Record<string, string>) => {
        console.log(`[${ucid}] All sales data captured:`, data);
        return { success: true, message: "All sales data captured successfully" };
      },
      pushToLMS: (data: Record<string, string>) => {
        console.log(`[${ucid}] Pushing to LMS:`, data);
        return { success: true, message: "Sales data successfully pushed to SingleInterface LMS" };
      },
      downloadSalesData: (format: string) => {
        console.log(`[${ucid}] Download request: ${format}`);
        return { success: true, message: `Sales data prepared in ${format} format` };
      },
      disconnectSession: () => {
        console.log(`[${ucid}] Session disconnect requested`);
        // Will be handled by the session cleanup
      },
    },
  });

  await session.connect({ apiKey });
  console.log(`[${ucid}] Connected to OpenAI Realtime with Spotlight agent`);
  
  return session;
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
          session.realtimeSession.transport.sendEvent({ type: 'input_audio_buffer.clear' });
        } else if (cmd === 'callDisconnect') {
          session.realtimeSession.close();
          ws.close();
        }
        return;
      }

      // From here, msg is OzonetelMediaPacket
      if (msg.event === 'start') {
        ucid = msg.ucid || '';
        try {
          const realtimeSession = await createRealtimeSession(ucid);
          session = {
            ucid,
            client: ws,
            realtimeSession,
            receivedFirstPacket: false,
            inputFrameBuffer: [],
          };
          sessions.set(ucid, session);

          // Handle responses from the Spotlight agent
          realtimeSession.on('transport_event' as any, (event: any) => {
            try {
              if (event.type === 'response.audio.delta' && event.delta) {
                // Convert base64 to samples
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
            } catch (err) {
              console.error(`[${ucid}] Audio response error:`, err);
            }
          });

          // Handle agent handoffs
          realtimeSession.on('agent_handoff', (handoffEvent: any) => {
            console.log(`[${ucid}] Agent handoff to:`, handoffEvent.agentName);
          });

          // Handle tool calls
          realtimeSession.on('agent_tool_start', (toolEvent: any) => {
            console.log(`[${ucid}] Tool call started:`, toolEvent.tool?.name);
          });

          realtimeSession.on('agent_tool_end', (toolEvent: any) => {
            console.log(`[${ucid}] Tool call completed:`, toolEvent.tool?.name);
          });

        } catch (err) {
          console.error(`[${ucid}] Failed to create Realtime session:`, err);
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

        // Send to Realtime session
        session.realtimeSession.transport.sendEvent({
          type: 'input_audio_buffer.append',
          audio: b64,
        });

        // Commit and trigger response
        session.realtimeSession.transport.sendEvent({
          type: 'input_audio_buffer.commit',
        });

        session.realtimeSession.transport.sendEvent({
          type: 'response.create',
        });
        return;
      }

      if (msg.event === 'stop') {
        if (session) {
          session.realtimeSession.close();
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
      session.realtimeSession.close();
      sessions.delete(session.ucid);
    }
  });
}

wss.on('connection', handleConnection);

server.listen(port, host, () => {
  console.log(`[telephony] WebSocket server with Spotlight agent listening on ws://${host}:${port}/ws`);
});


