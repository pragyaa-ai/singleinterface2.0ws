import 'dotenv/config';
import http from 'http';
import WebSocket, { WebSocketServer } from 'ws';
import fs from 'fs';
import path from 'path';
import { int16ArrayToBase64, ensureInt16Array, upsample8kTo24k, downsample24kTo8k } from './audio';

// 🔄 DECOUPLED ARCHITECTURE: Agent processing moved to async service
// Telephony service now focuses only on call handling and transcript collection

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

interface QuestionAnswerPair {
  question: string;
  answer: string;
  questionTimestamp: number;
  answerTimestamp: number;
  duration: number;
  dataType?: 'full_name' | 'car_model' | 'email_id';
  reattempts: number;
}

interface CallAnalytics {
  callStartTime: number;
  callEndTime?: number;
  questionAnswerPairs: QuestionAnswerPair[];
  parametersAttempted: Set<string>;
  parametersCaptured: Set<string>;
  dropOffPoint?: {
    lastEvent: string;
    timestamp: number;
    context: string;
  };
  currentSpeechStart?: number;
  currentQuestionStart?: number;
}

interface TranscriptEntry {
  timestamp: string;
  speaker: 'user' | 'assistant';
  text: string;
  confidence?: number;
  event_type?: string;
}

// NEW: Enhanced data point status tracking
interface DataPointStatus {
  value?: string;
  status: 'verified' | 'captured' | 'needs_to_be_validated' | 'not_captured';
  confidence?: number;
  attempts: number;
  timestamps: {
    first_attempt?: number;
    last_attempt?: number;
    verified_at?: number;
  };
}

interface Session {
  ucid: string;
  client: WebSocket;
  openaiWs: WebSocket;
  receivedFirstPacket: boolean;
  inputFrameBuffer: number[][]; // queue of sample arrays
  salesData: {
    full_name?: string;
    car_model?: string;
    email_id?: string;
    verified: Set<string>;
    processing_status?: 'pending' | 'processing' | 'completed' | 'failed';
    // NEW: Enhanced data point tracking
    dataPoints?: {
      full_name: DataPointStatus;
      car_model: DataPointStatus;
      email_id: DataPointStatus;
    };
  };
  transcripts: string[]; // Keep for backward compatibility
  fullTranscript: TranscriptEntry[]; // 🔄 NEW: Rich transcript with timestamps
  lastCapturedData?: string;
  callAnalytics?: CallAnalytics;
}

const port = Number(process.env.TELEPHONY_WS_PORT || 8080);
const host = process.env.TELEPHONY_WS_HOST || '0.0.0.0';

const server = http.createServer((req, res) => {
  // Handle Ozonetel XML requests for /getXML_SI/
  if (req.url?.startsWith('/getXML_SI/')) {
    console.log(`📞 Ozonetel XML request: ${req.method} ${req.url}`);
    
    // Parse query parameters to get call details
    const url = new URL(req.url, `http://${req.headers.host}`);
    const outbound_sid = url.searchParams.get('outbound_sid');
    const event = url.searchParams.get('event');
    const cid = url.searchParams.get('cid');
    
    console.log(`📞 Call details: sid=${outbound_sid}, event=${event}, cid=${cid}`);
    
    // Return XML response pointing to our WebSocket endpoint
    const wsUrl = process.env.TELEPHONY_WS_URL || 'wss://ws-singleinterfacews.pragyaa.ai/ws';
    const sipId = process.env.TELEPHONY_SIP_ID || outbound_sid || 'UNKNOWN';
    
    const xml = `<response><stream is_sip='true' url='${wsUrl}'>${sipId}</stream></response>`;
    
    res.writeHead(200, { 
      'Content-Type': 'text/xml; charset=utf-8',
      'Cache-Control': 'no-store'
    });
    res.end(xml);
    
    console.log(`📞 XML response sent: ${xml}`);
  } else {
    // Handle other requests
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});
const wss = new WebSocketServer({ server, path: '/ws' });

const sessions = new Map<string, Session>();

// 🔄 ENHANCED: Ensure all data directories exist for decoupled architecture
const dataDir = path.join(process.cwd(), 'data', 'calls');
const transcriptsDir = path.join(process.cwd(), 'data', 'transcripts');
const processingDir = path.join(process.cwd(), 'data', 'processing');
const resultsDir = path.join(process.cwd(), 'data', 'results');

[dataDir, transcriptsDir, processingDir, resultsDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`📁 Created directory: ${dir}`);
  }
});

// 🎯 NO TOOLS - Telephony service only captures transcripts
// Data extraction happens in queue processor AFTER the call
const telephonySDKTools: any[] = [];

// 🎯 NO TOOL HANDLERS NEEDED
// Tools disabled - telephony only captures transcripts
// Data extraction happens in queue processor after call ends

// REMOVED: All handler functions - no real-time data extraction
// Data extraction happens in queue processor after call ends

// REMOVED: extractSalesData function - no real-time data extraction
// All data extraction happens in queue processor after call ends

// 🔄 NEW: Save complete transcript for async processing
function saveTranscriptForProcessing(session: Session) {
  const ucid = session.ucid;
  const timestamp = Date.now();
  
  // Create transcript file data
  const transcriptData = {
    call_id: ucid,
    timestamp: new Date().toISOString(),
    call_start_time: session.callAnalytics?.callStartTime || timestamp,
    call_end_time: timestamp,
    call_duration: session.callAnalytics?.callStartTime ? 
      timestamp - session.callAnalytics.callStartTime : 0,
    
    // Full conversation with timestamps
    conversation: session.fullTranscript,
    
    // Backward compatibility - simple transcript array
    simple_transcripts: session.transcripts,
    
    // Current sales data (partial or complete)
    current_sales_data: {
      full_name: session.salesData.full_name || null,
      car_model: session.salesData.car_model || null,
      email_id: session.salesData.email_id || null,
      verified_fields: Array.from(session.salesData.verified || []),
      processing_status: 'pending'
    },
    
    // Call analytics
    analytics: session.callAnalytics ? {
      total_exchanges: session.fullTranscript.length,
      user_messages: session.fullTranscript.filter(t => t.speaker === 'user').length,
      assistant_messages: session.fullTranscript.filter(t => t.speaker === 'assistant').length,
      question_answer_pairs: session.callAnalytics.questionAnswerPairs?.length || 0,
      parameters_attempted: Array.from(session.callAnalytics.parametersAttempted || []),
      parameters_captured: Array.from(session.callAnalytics.parametersCaptured || [])
    } : null
  };
  
  // Save transcript file
  const transcriptFilename = `call_${ucid}_${timestamp}_transcript.json`;
  const transcriptPath = path.join(transcriptsDir, transcriptFilename);
  
  try {
    fs.writeFileSync(transcriptPath, JSON.stringify(transcriptData, null, 2));
    console.log(`[${ucid}] 📄 Transcript saved: ${transcriptFilename}`);
    
    // Create processing queue entry
    const queueData = {
      call_id: ucid,
      transcript_file: transcriptFilename,
      created_at: new Date().toISOString(),
      status: 'pending',
      priority: 'normal'
    };
    
    const queueFilename = `call_${ucid}_${timestamp}_queue.json`;
    const queuePath = path.join(processingDir, queueFilename);
    
    fs.writeFileSync(queuePath, JSON.stringify(queueData, null, 2));
    console.log(`[${ucid}] 📋 Processing queue entry created: ${queueFilename}`);
    
    // Update session status
    session.salesData.processing_status = 'pending';
    
    return { transcriptFile: transcriptFilename, queueFile: queueFilename };
    
  } catch (error) {
    console.error(`[${ucid}] ❌ Failed to save transcript:`, error);
    return null;
  }
}

// Save sales data to local file
function saveSalesDataToFile(session: Session) {
  const { full_name, car_model, email_id } = session.salesData;
  const ucid = session.ucid;
  
  // 🆕 NEW: Enhanced call data with comprehensive analytics
  const callData = {
    ucid: ucid,
    timestamp: new Date().toISOString(),
    
    // Sales Data
    salesData: {
      full_name: full_name || 'Not captured',
      car_model: car_model || 'Not captured', 
      email_id: email_id || 'Not captured',
      status: (full_name && car_model && email_id) ? 'Complete' : 'Partial'
    },
    
    // 🆕 NEW: Call Analytics
    callAnalytics: session.callAnalytics ? {
      callDuration: session.callAnalytics.callEndTime ? 
        session.callAnalytics.callEndTime - session.callAnalytics.callStartTime : 
        Date.now() - session.callAnalytics.callStartTime,
      
      parametersAttempted: Array.from(session.callAnalytics.parametersAttempted),
      parametersCaptured: Array.from(session.callAnalytics.parametersCaptured),
      
      questionAnswerPairs: session.callAnalytics.questionAnswerPairs.map(qa => ({
        question: qa.question,
        answer: qa.answer,
        duration: qa.duration,
        dataType: qa.dataType,
        reattempts: qa.reattempts,
        timestamp: new Date(qa.questionTimestamp).toISOString()
      })),
      
      totalQuestions: session.callAnalytics.questionAnswerPairs.length,
      averageResponseTime: session.callAnalytics.questionAnswerPairs.length > 0 ?
        session.callAnalytics.questionAnswerPairs.reduce((sum, qa) => sum + qa.duration, 0) / 
        session.callAnalytics.questionAnswerPairs.length : 0,
      
      dropOffPoint: session.callAnalytics.dropOffPoint || null
    } : null,
    
    // Conversation Context
    transcripts: session.transcripts || [],
    totalTranscripts: session.transcripts?.length || 0,
    
    // Legacy field for backward compatibility
    call_duration: session.callAnalytics?.callEndTime ? 
      session.callAnalytics.callEndTime - session.callAnalytics.callStartTime : 
      Date.now() - (session.callAnalytics?.callStartTime || Date.now())
  };
  
  const filename = `call_${ucid}_${Date.now()}.json`;
  const filepath = path.join(dataDir, filename);
  
  try {
    fs.writeFileSync(filepath, JSON.stringify(callData, null, 2));
    console.log(`[${ucid}] 💾 Sales data saved to: ${filename}`);
  } catch (error) {
    console.error(`[${ucid}] ❌ Failed to save data:`, error);
  }
}

// Check if all required data is collected
function parseAgentOutput(output: string): { full_name?: string, car_model?: string, email_id?: string } | null {
  if (!output) return null;
  
  const result: { full_name?: string, car_model?: string, email_id?: string } = {};
  
  // First try to parse structured JSON if the agent returned it
  try {
    // Look for JSON in the output
    const jsonMatch = output.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.full_name) result.full_name = parsed.full_name;
      if (parsed.car_model) result.car_model = parsed.car_model;
      if (parsed.email_id || parsed.email) result.email_id = parsed.email_id || parsed.email;
      
      // If we found data in JSON, return it
      if (Object.keys(result).length > 0) {
        console.log('📊 Parsed structured JSON from agent:', result);
        return result;
      }
    }
  } catch (e) {
    // Fall back to regex parsing
  }
  
  // Extract full name with improved validation
  const namePatterns = [
    /(?:Full Name|Name):\s*([A-Za-z\s.''-]{2,30})(?:\s*\n|$)/i,
    /(?:full name|name):\s*([A-Za-z\s.''-]{2,30})(?:\s*\n|$)/i,
    /- Full Name:\s*([A-Za-z\s.''-]{2,30})(?:\s*\n|$)/i,
    /\"full_name\":\s*\"([A-Za-z\s.''-]{2,30})\"/i
  ];
  
  for (const pattern of namePatterns) {
    const nameMatch = output.match(pattern);
    if (nameMatch && nameMatch[1].trim() && 
        nameMatch[1].trim() !== 'Not captured' && 
        nameMatch[1].trim().length > 1 &&
        /^[A-Za-z\s.''-]+$/.test(nameMatch[1].trim())) {
      result.full_name = nameMatch[1].trim();
      break;
    }
  }
  
  // Extract email ID with stricter validation
  const emailPatterns = [
    /(?:Email ID|Email):\s*([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/i,
    /(?:email id|email):\s*([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/i,
    /- Email ID:\s*([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/i,
    /\"email_id\":\s*\"([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})\"/i
  ];
  
  for (const pattern of emailPatterns) {
    const emailMatch = output.match(pattern);
    if (emailMatch && emailMatch[1] && emailMatch[1].includes('@')) {
      result.email_id = emailMatch[1];
      break;
    }
  }
  
  // Extract car model with better filtering
  const carPatterns = [
    /(?:Car Model|Car|Vehicle):\s*([A-Za-z0-9\s\-._]{2,40})(?:\s*\n|$)/i,
    /(?:car model|car|vehicle):\s*([A-Za-z0-9\s\-._]{2,40})(?:\s*\n|$)/i,
    /- Car Model:\s*([A-Za-z0-9\s\-._]{2,40})(?:\s*\n|$)/i,
    /\"car_model\":\s*\"([A-Za-z0-9\s\-._]{2,40})\"/i
  ];
  
  for (const pattern of carPatterns) {
    const carMatch = output.match(pattern);
    if (carMatch && carMatch[1].trim() && 
        carMatch[1].trim() !== 'Not captured' && 
        carMatch[1].trim().length > 1 &&
        // Filter out obvious non-car-model responses
        !['yes', 'no', 'ok', 'hello', 'thanks', 'thank you'].includes(carMatch[1].trim().toLowerCase())) {
      result.car_model = carMatch[1].trim();
      break;
    }
  }
  
  // Return result only if we found at least one piece of valid data
  console.log('📊 Parsed agent output:', result);
  return Object.keys(result).length > 0 ? result : null;
}

// REMOVED: checkDataCompletion function - no real-time data validation
// Data validation happens in queue processor after call ends

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
      console.log(`[${ucid}] Connected to VoiceAgent Realtime API`);
      
      // Configure session for Spotlight agent behavior with SDK tools
      const sessionConfig = {
        type: 'session.update',
        session: {
          input_audio_format: 'pcm16',
          output_audio_format: 'pcm16',
          voice: 'coral',
          input_audio_transcription: { model: 'whisper-1' },
          turn_detection: {
            type: 'server_vad',
            threshold: 0.5,
            prefix_padding_ms: 300,
            silence_duration_ms: 300
          },
          tools: telephonySDKTools,
          temperature: 0.8,
          instructions: `# Personality and Tone
## Identity
You are a North Indian female sales assistant working at Dee Emm Mahindra Dealer. You speak politely and clearly with a distinctly Indian-English accent and Indian pronunciation. Your voice is gentle, warm, and respectful — like a caring Indian woman speaking naturally in a real conversation. You specialize in helping customers with Mahindra cars at Dee Emm Mahindra Dealer.
You maintain a slightly faster and more engaging speaking pace from the very beginning to the end of the conversation, while always remaining clear, polite, and respectful.

## Task
You need to collect the *Name, Car model interested in, and Email* from the customer.
- Always collect all three details in the conversation.
- After the introduction, you may ask them in *any order* — not necessarily Name → Car Model → Email.
- Example: Sometimes start with the name, sometimes ask about the car model first, or sometimes begin with email. Shuffle the order randomly so it feels conversational and not scripted.
- Use different conversational variations for asking questions.
- *Capture only what the customer says — exactly, same to same.*
- Do not assume, infer, normalize, or add anything that is not explicitly spoken by the customer.
- Confirm every detail word-for-word, in clear Indian accent and pronunciation.
- If a correction is given, always apologize politely before restating the corrected detail.
*Important:* You only handle Mahindra car enquiries. If a caller asks about any other brand, politely explain that Dee Emm is a Mahindra dealer and request their interest in a Mahindra vehicle instead.

## Demeanor
Respectful, attentive, and supportive. You listen carefully, ask gently, and always confirm information exactly as spoken or spelled by the caller. You make the caller feel comfortable, valued, and respected.

## Tone
Soft, warm, conversational, with Indian-English accent and pronunciation. Inspired by the tone of *Vidya Balan* — feminine, graceful, and welcoming. Always polite, never robotic. You maintain a slightly faster, smoother delivery throughout the whole conversation.

## Level of Enthusiasm
Gentle enthusiasm. You are helpful and positive, calm and measured. You never sound pushy or overexcited.

## Level of Formality
Professionally friendly, using simple and polite everyday English. Always respectful, like a humble consultant who speaks with care.

## Level of Emotion
Supportive and empathetic. You show patience, kindness, and reassurance in your voice.

## Filler Words
Occasionally use natural fillers like "hmm," "um," or "you know?" softly and sparingly, so that you sound conversational and human while keeping clarity.

## Pacing
- *Overall conversation:* Slightly faster and fluent from start to end.
- Still clear and respectful, but not overly slow.
- Never rushed, never robotic — always natural and conversational.

## Other details
- *Mandatory Indian accent and Indian pronunciation in every sentence.*
- *Clear pronunciation with Indian accent at all times.*
- Dynamic capture only: *Repeat caller's input exactly, same to same — names, car models, and emails. Do not assume, normalize, or auto-complete.*
- Never add anything to email IDs unless caller explicitly says it (no automatic ".com" or ".in").
- If caller spells, repeat back exactly letter by letter.
- If unclear, ask again. On second attempt, request spelling.
- After 2 failed attempts: say exactly:
  "I want to make sure I get this right… An expert will call back to validate this. Let me… move on to the next detail."
  and mark the record as *Need_expert_review*.
- Always confirm gently: "Is this correct?"
- Immediately capture details the moment you hear them — do not delay or reformat.
- For brand extraction, if the car model contains "Mahindra", extract "Mahindra". If not confidently determinable, set brand to "Unknown" and add *Need_expert_review*.
- If a customer asks for a *non-Mahindra brand*, politely respond in a conversational way:
  "I understand you mentioned <brand>… but since we are a Mahindra dealer, we can only take enquiries for Mahindra vehicles. Could you please tell me which Mahindra model you are interested in? We have vehicles like XUV700, Scorpio N, Thar, Bolero, XUV300, 3XO, and many more."

# Opening Greeting (MANDATORY)
Always start with: "Namaskar.............. Welcome to Dee Emm Mahindra dealer. How may I help you today?"

Alternative greetings you can use:
- "Namaskar.............. Welcome to Dee Emm Mahindra dealer. Thanks for your interest in Mahindra cars, you have come to the right place. How can I assist you?"
- "Namaskar.............. You've reached Dee Emm Mahindra dealer customer desk. We are here to help with your enquiry. May I take a few details to connect you with the right team?"

# Data Collection Protocol

## Required Information (3 Sales Data Points):
1. **Full Name** - Complete name of the potential customer
2. **Car Model** - Specific Mahindra car model they are interested in
3. **Email ID** - Customer's email address for follow-up communication

## Question Variations (Use randomly for natural conversation):
- Name: "May I know your full name, please?" / "Please, may I know your name?" / "Could you share your name with me?" / "What is your good name, please?"
- Car Model: "Which Mahindra car model are you interested in?" / "Can you tell me which Mahindra vehicle you are looking for?" / "May I know the Mahindra model you have in mind?"
- Email: "Could you please share your email ID with me?" / "May I know your email address so I can note it?" / "What would be your email address?"

## CONFIRMATION PROTOCOL (MANDATORY)
For each response, capture exactly what caller says — same to same, no assumptions.
Repeat back each detail word-for-word: "I've noted <caller_input>… Is this correct?"
If the customer corrects the detail, apologize warmly before repeating: "Oh, my apologies, I must have noted that wrong… thank you, let me correct it." / "I'm sorry ji, I just want to make sure I have it right… so it is <corrected_input>, correct?"

## ESCALATION PROTOCOL (MANDATORY)
If unclear responses occur, ask again politely; after 2 failed attempts, say exactly:
"I want to make sure I get this right… An expert will call back to validate this. Let me… move on to the next detail."
and mark as Need_expert_review.

# Completion Protocol (MANDATORY)
Once all three details are collected:
Thank the customer: "Thank you so much for confirming all the details." / "Wonderful, I have noted everything down. Thank you for your time." / "Great, thanks a lot for providing these details."
Then say: "We will now connect you with the Mahindra dealer near you.............. Please hold on."

Remember: Your success is measured by complete, accurate Mahindra sales data collection with warm, respectful Indian hospitality.`
        }
      };
      
      openaiWs.send(JSON.stringify(sessionConfig));

      resolve(openaiWs);
    });

    openaiWs.on('error', (err) => {
      console.error(`[${ucid}] VoiceAgent error:`, err);
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
            salesData: {
              verified: new Set<string>(),
              processing_status: 'pending', // 🔄 NEW: Track async processing status
              // 🆕 NEW: Initialize enhanced data point tracking
              dataPoints: {
                full_name: {
                  status: 'not_captured',
                  attempts: 0,
                  timestamps: {}
                },
                car_model: {
                  status: 'not_captured',
                  attempts: 0,
                  timestamps: {}
                },
                email_id: {
                  status: 'not_captured',
                  attempts: 0,
                  timestamps: {}
                }
              }
            },
            transcripts: [], // Keep for backward compatibility
            fullTranscript: [], // 🔄 NEW: Rich transcript with timestamps
            lastCapturedData: undefined,
            // 🆕 NEW: Initialize call analytics
            callAnalytics: {
              callStartTime: Date.now(),
              questionAnswerPairs: [],
              parametersAttempted: new Set<string>(),
              parametersCaptured: new Set<string>(),
            }
          };
          sessions.set(ucid, session);

          // Handle responses from VoiceAgent (Spotlight-like behavior)
          openaiWs.on('message', (data) => {
            try {
              const event = JSON.parse(data.toString());
              
              // 🔍 DEBUG: Log important VoiceAgent events only
              const importantEvents = [
                'conversation.item.created',
                'input_audio_buffer.speech_started', 
                'input_audio_buffer.speech_stopped',
                'conversation.item.input_audio_transcription.completed',
                'response.function_call_delta',
                'response.function_call_done'
              ];
              
              if (importantEvents.includes(event.type)) {
                console.log(`[${ucid}] 🔍 VoiceAgent Event:`, event.type);
                if (event.type !== 'response.audio.delta') {
                  console.log(`[${ucid}] 📋 Event Details:`, JSON.stringify(event, null, 2));
                }
              }
              
              if (event.type === 'response.audio.delta' && event.delta) {
                // Convert base64 to samples and downsample from 24kHz to 8kHz for Ozonetel
                const audioBuffer = Buffer.from(event.delta, 'base64');
                const samples24k = new Int16Array(audioBuffer.buffer);
                const samples8k = downsample24kTo8k(samples24k);
                const samplesArray = Array.from(samples8k);
                
                // console.log(`[${ucid}] 🎵 Response: 24kHz (${samples24k.length}) → 8kHz (${samples8k.length}) samples`); // DISABLED - too noisy
                
                const payload = {
                  event: 'media',
                  type: 'media',
                  ucid: ucid,
                  data: {
                    samples: samplesArray,
                    bitsPerSample: 16,
                    sampleRate: 8000,
                    channelCount: 1,
                    numberOfFrames: samplesArray.length,
                    type: 'data' as const,
                  },
                };
                
                if (ws.readyState === WebSocket.OPEN) {
                  ws.send(JSON.stringify(payload));
                }
              }

              // 🔍 ENHANCED: Log ALL conversation events
              if (event.type === 'conversation.item.created') {
                console.log(`[${ucid}] 🗣️ Conversation Item Created:`, JSON.stringify(event.item, null, 2));
                
                // NO FUNCTION CALLS - Tools disabled, only transcript capture
                if (event.item?.type === 'function_call' && event.item?.name) {
                  console.log(`[${ucid}] ⚠️ Unexpected function call (tools disabled): ${event.item.name}`);
                }
                
                // Handle user messages
                if (event.item?.type === 'message' && event.item?.role === 'user') {
                  const transcript = event.item?.content?.[0]?.transcript || '';
                  console.log(`[${ucid}] 📝 User said: "${transcript}"`);
                  
                // 🔄 DECOUPLED: No real-time processing - transcripts collected for async processing
                if (session && transcript.trim()) {
                  console.log(`[${ucid}] 📝 Transcript collected: "${transcript}"`);
                  // Note: Actual data extraction will happen via async agent processor on call end
                } else if (!transcript.trim()) {
                  console.log(`[${ucid}] ⚠️ Empty transcript received`);
                }
                }
              }
              
              // 🔍 ENHANCED: Log response events and capture in rich transcript
              if (event.type === 'response.audio_transcript.done') {
                console.log(`[${ucid}] 🔊 Assistant audio transcript:`, event.transcript);
                
                // 🔄 NEW: Add assistant response to rich transcript (PRIMARY SOURCE)
                if (session && event.transcript) {
                  // 🚫 DEDUPLICATE: Check if this exact text was already added recently
                  const recentTranscripts = session.fullTranscript.slice(-3);
                  const isDuplicate = recentTranscripts.some(entry => 
                    entry.speaker === 'assistant' && 
                    entry.text === event.transcript &&
                    Date.now() - new Date(entry.timestamp).getTime() < 5000 // Within 5 seconds
                  );
                  
                  if (!isDuplicate) {
                    const assistantEntry: TranscriptEntry = {
                      timestamp: new Date().toISOString(),
                      speaker: 'assistant',
                      text: event.transcript,
                      event_type: 'response_audio_transcript_done'
                    };
                    session.fullTranscript.push(assistantEntry);
                    console.log(`[${ucid}] 📋 Assistant response added to rich transcript`);
                  } else {
                    console.log(`[${ucid}] 🚫 Skipped duplicate assistant response`);
                  }
                }
              }
              
              if (event.type === 'response.text.delta') {
                console.log(`[${ucid}] 🤖 Assistant text delta:`, event.delta);
              }
              
              if (event.type === 'input_audio_buffer.speech_started') {
                console.log(`[${ucid}] 🎤 Speech started detected`);
                // 🆕 NEW: Capture speech timing
                if (session?.callAnalytics) {
                  session.callAnalytics.currentSpeechStart = Date.now();
                }
              }
              
              if (event.type === 'input_audio_buffer.speech_stopped') {
                console.log(`[${ucid}] 🛑 Speech stopped detected`);
                // 🆕 NEW: Calculate speech duration
                if (session?.callAnalytics?.currentSpeechStart) {
                  const speechDuration = Date.now() - session.callAnalytics.currentSpeechStart;
                  console.log(`[${ucid}] ⏱️ Speech duration: ${speechDuration}ms`);
                }
              }
              
              if (event.type === 'conversation.item.input_audio_transcription.completed') {
                console.log(`[${ucid}] 📝 Transcription completed:`, event.transcript);
                
                // 🔄 ENHANCED: Track both simple and rich transcripts
                if (session && event.transcript) {
                  // Keep backward compatibility
                  session.transcripts.push(event.transcript);
                  // Keep only last 5 transcripts to avoid memory issues
                  if (session.transcripts.length > 5) {
                    session.transcripts = session.transcripts.slice(-5);
                  }
                  
                  // 🔄 NEW: Rich transcript with timestamps
                  const transcriptEntry: TranscriptEntry = {
                    timestamp: new Date().toISOString(),
                    speaker: 'user',
                    text: event.transcript,
                    confidence: event.confidence || 0.9,
                    event_type: 'transcription_completed'
                  };
                  session.fullTranscript.push(transcriptEntry);
                  
                  console.log(`[${ucid}] 📚 Transcripts buffer:`, session.transcripts);
                  console.log(`[${ucid}] 📋 Rich transcript entries:`, session.fullTranscript.length);
                  
                  // 🔄 DECOUPLED: Real-time processing removed - will be handled by async processor
                  console.log(`[${ucid}] 📤 Transcript collected for async processing`);
                  
                  // 🆕 NEW: Collect analytics using OpenAI timestamps
                  const timestamp = Date.now();
                  const duration = event.usage?.seconds || 0;
                  
                  console.log(`[${ucid}] 📊 Analytics: "${event.transcript}" (${duration}s) [${event.event_id}]`);
                }
              }
              
              // 🎯 SDK TOOL CALLS - Handle function calls from AI
              if (event.type === 'response.function_call_delta') {
                console.log(`[${ucid}] 🔧 Function call delta:`, event);
              }
              
              if (event.type === 'response.function_call_done') {
                console.log(`[${ucid}] ⚠️ Unexpected function call done event (tools disabled)`);
              }

            } catch (err) {
              console.error(`[${ucid}] ❌ VoiceAgent message parse error:`, err);
            }
          });

        } catch (err) {
          console.error(`[${ucid}] Failed to create VoiceAgent connection:`, err);
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

        // Expect 8k mono 10ms frames (80 samples) - upsample to 24k for VoiceAgent
        const samples8k = ensureInt16Array(msg.data.samples);
        const samples24k = upsample8kTo24k(samples8k);
        const b64 = int16ArrayToBase64(samples24k);

        // console.log(`[${ucid}] Audio: 8kHz (${samples8k.length}) → 24kHz (${samples24k.length}) samples`); // DISABLED - too noisy

        // Send upsampled 24kHz audio to VoiceAgent Realtime
        session.openaiWs.send(JSON.stringify({
          type: 'input_audio_buffer.append',
          audio: b64,
        }));

        // Let VoiceAgent's server_vad handle turn detection automatically
        // Do NOT force response.create - let VAD detect when user stops speaking
        return;
      }

      if (msg.event === 'stop') {
        if (session) {
          // 🆕 NEW: Capture call end time and duration
          if (session.callAnalytics) {
            session.callAnalytics.callEndTime = Date.now();
            const totalDuration = session.callAnalytics.callEndTime - session.callAnalytics.callStartTime;
            console.log(`[${session.ucid}] ⏱️ Total call duration: ${totalDuration}ms (${Math.round(totalDuration/1000)}s)`);
          }
          
          // Save any partial data collected before call ends
          const { full_name, car_model, email_id } = session.salesData;
          if (full_name || car_model || email_id) {
            console.log(`[${session.ucid}] 📋 Call ended - saving partial data`);
            saveSalesDataToFile(session);
          }
          
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
      console.log(`[${session.ucid}] 🔌 Connection closed - processing call data`);
      
      // 🔄 NEW: Save complete transcript for async processing
      const transcriptResult = saveTranscriptForProcessing(session);
      if (transcriptResult) {
        console.log(`[${session.ucid}] ✅ Transcript saved for async processing`);
      }
      
      // Keep existing logic for immediate partial data saving (backward compatibility)
      const { full_name, car_model, email_id } = session.salesData;
      if (full_name || car_model || email_id) {
        console.log(`[${session.ucid}] 💾 Saving immediate partial data`);
        saveSalesDataToFile(session);
      }
      
      session.openaiWs.close();
      sessions.delete(session.ucid);
    }
  });
}

wss.on('connection', handleConnection);

server.listen(port, host, () => {
  console.log(`[telephony] WebSocket server with Spotlight-like behavior listening on ws://${host}:${port}/ws`);
});


