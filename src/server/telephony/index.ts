import 'dotenv/config';
import http from 'http';
import WebSocket, { WebSocketServer } from 'ws';
import fs from 'fs';
import path from 'path';
import { int16ArrayToBase64, ensureInt16Array, upsample8kTo24k, downsample24kTo8k } from './audio';

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
  salesData: {
    full_name?: string;
    car_model?: string;
    email_id?: string;
    verified: Set<string>;
  };
  transcripts: string[];
  lastCapturedData?: string;
}

const port = Number(process.env.TELEPHONY_WS_PORT || 8080);
const host = process.env.TELEPHONY_WS_HOST || '0.0.0.0';

const server = http.createServer();
const wss = new WebSocketServer({ server, path: '/ws' });

const sessions = new Map<string, Session>();

// Ensure data directory exists
const dataDir = path.join(process.cwd(), 'data', 'calls');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// 🎯 AGENTS SDK TOOLS - Ported for telephony use
const telephonySDKTools = [
  {
    type: "function" as const,
    name: "capture_sales_data",
    description: "Capture and store individual pieces of sales lead information during the verification process",
    parameters: {
      type: "object",
      properties: {
        data_type: {
          type: "string",
          enum: ["full_name", "car_model", "email_id"],
          description: "The type of sales data being captured"
        },
        value: {
          type: "string", 
          description: "The actual data value provided by the customer"
        },
        notes: {
          type: "string",
          description: "Any additional notes or context about this data point"
        }
      },
      required: ["data_type", "value"],
      additionalProperties: false,
    }
  },
  {
    type: "function" as const,
    name: "verify_sales_data",
    description: "Verify and confirm previously captured sales data with the customer",
    parameters: {
      type: "object",
      properties: {
        data_type: {
          type: "string",
          enum: ["full_name", "car_model", "email_id"],
          description: "The type of sales data being verified"
        },
        confirmed: {
          type: "boolean",
          description: "Whether the customer confirmed this data as correct"
        }
      },
      required: ["data_type", "confirmed"],
      additionalProperties: false,
    }
  },
  {
    type: "function" as const,
    name: "capture_all_sales_data",
    description: "Capture all sales data at once when conversation is complete",
    parameters: {
      type: "object",
      properties: {
        full_name: { type: "string", description: "Complete name of the potential customer" },
        car_model: { type: "string", description: "Specific car model they are interested in" },
        email_id: { type: "string", description: "Customer's email address for follow-up" }
      },
      required: ["full_name", "car_model", "email_id"],
      additionalProperties: false,
    }
  }
];

// 🎯 SDK TOOL EXECUTION HANDLERS
function handleSDKToolCall(session: Session, toolCall: any) {
  const ucid = session.ucid;
  const { name, parameters } = toolCall;
  
  console.log(`[${ucid}] 🔧 SDK Tool Called: ${name}`, parameters);
  
  switch (name) {
    case 'capture_sales_data':
      return handleCaptureSalesData(session, parameters);
    case 'verify_sales_data':
      return handleVerifySalesData(session, parameters);
    case 'capture_all_sales_data':
      return handleCaptureAllSalesData(session, parameters);
    default:
      console.warn(`[${ucid}] ❌ Unknown tool: ${name}`);
      return { success: false, message: `Unknown tool: ${name}` };
  }
}

function handleCaptureSalesData(session: Session, params: any) {
  const { data_type, value, notes } = params;
  const ucid = session.ucid;
  
  // 🎯 HYBRID APPROACH: Update session data (like current regex)
  if (data_type === 'full_name') {
    session.salesData.full_name = value;
    session.lastCapturedData = 'full_name';
  } else if (data_type === 'car_model') {
    session.salesData.car_model = value;
    session.lastCapturedData = 'car_model';
  } else if (data_type === 'email_id') {
    session.salesData.email_id = value;
    session.lastCapturedData = 'email_id';
  }
  
  console.log(`[${ucid}] 🎯 SDK Captured ${data_type}: ${value}${notes ? ` (${notes})` : ''}`);
  
  // Check if data is complete and save
  checkDataCompletion(session);
  
  return {
    success: true,
    message: `Successfully captured ${data_type}: ${value}`,
    data_type,
    value,
    status: 'captured'
  };
}

function handleVerifySalesData(session: Session, params: any) {
  const { data_type, confirmed } = params;
  const ucid = session.ucid;
  
  if (confirmed) {
    session.salesData.verified.add(data_type);
    console.log(`[${ucid}] ✅ SDK Verified ${data_type}: Confirmed`);
  } else {
    // If not confirmed, remove the data and allow re-capture
    if (data_type === 'full_name') session.salesData.full_name = undefined;
    if (data_type === 'car_model') session.salesData.car_model = undefined;
    if (data_type === 'email_id') session.salesData.email_id = undefined;
    session.salesData.verified.delete(data_type);
    console.log(`[${ucid}] ❌ SDK Verification ${data_type}: Rejected - data cleared`);
  }
  
  return {
    success: true,
    message: `${data_type} ${confirmed ? 'confirmed' : 'rejected'}`,
    data_type,
    confirmed,
    status: confirmed ? 'verified' : 'rejected'
  };
}

function handleCaptureAllSalesData(session: Session, params: any) {
  const { full_name, car_model, email_id } = params;
  const ucid = session.ucid;
  
  // Capture all data at once
  session.salesData.full_name = full_name;
  session.salesData.car_model = car_model;
  session.salesData.email_id = email_id;
  
  console.log(`[${ucid}] 🎯 SDK Captured All Data:`, { full_name, car_model, email_id });
  
  // Save complete data
  saveSalesDataToFile(session);
  
  return {
    success: true,
    message: "All sales data captured successfully",
    data: { full_name, car_model, email_id },
    status: 'complete'
  };
}

// Data extraction function to simulate Spotlight agent tools (KEEP EXISTING - FALLBACK)
function extractSalesData(session: Session, transcript: string) {
  const ucid = session.ucid;
  const text = transcript.toLowerCase();
  
  console.log(`[${ucid}] 🔍 Starting data extraction from: "${transcript}"`);
  console.log(`[${ucid}] 🔍 Lowercase text: "${text}"`);
  
  // Extract name patterns
  if (!session.salesData.full_name) {
    console.log(`[${ucid}] 🔍 Attempting name extraction...`);
    const namePatterns = [
      /my name is ([a-zA-Z\s]+)/i,
      /i am ([a-zA-Z\s]+)/i,
      /i'm ([a-zA-Z\s]+)/i,
      /this is ([a-zA-Z\s]+)/i,
      /call me ([a-zA-Z\s]+)/i
    ];
    
    for (const pattern of namePatterns) {
      const match = transcript.match(pattern);
      if (match && match[1]) {
        const name = match[1].trim();
        if (name.length > 2 && name.length < 50) {
          session.salesData.full_name = name;
          console.log(`[${ucid}] 📝 Captured Name: ${name}`);
          break;
        }
      }
    }
  }
  
  // Extract car model patterns
  if (!session.salesData.car_model) {
    const carBrands = ['toyota', 'honda', 'maruti', 'hyundai', 'tata', 'mahindra', 'ford', 'chevrolet', 'volkswagen', 'bmw', 'mercedes', 'audi', 'nissan', 'kia'];
    const carModels = ['swift', 'baleno', 'dzire', 'vitara', 'ciaz', 'ertiga', 'xl6', 'brezza', 'city', 'amaze', 'jazz', 'wr-v', 'civic', 'accord', 'camry', 'innova', 'fortuner', 'corolla', 'i10', 'i20', 'venue', 'creta', 'verna', 'tucson', 'elantra', 'santafe'];
    
    for (const brand of carBrands) {
      if (text.includes(brand)) {
        for (const model of carModels) {
          if (text.includes(model)) {
            const carModel = `${brand.charAt(0).toUpperCase() + brand.slice(1)} ${model.charAt(0).toUpperCase() + model.slice(1)}`;
            session.salesData.car_model = carModel;
            console.log(`[${ucid}] 🚗 Captured Car Model: ${carModel}`);
            return;
          }
        }
        // Just brand mentioned
        const brandName = brand.charAt(0).toUpperCase() + brand.slice(1);
        session.salesData.car_model = brandName;
        console.log(`[${ucid}] 🚗 Captured Car Brand: ${brandName}`);
        return;
      }
    }
    
    // Generic car interest
    const carKeywords = ['car', 'vehicle', 'auto', 'sedan', 'suv', 'hatchback'];
    for (const keyword of carKeywords) {
      if (text.includes(keyword)) {
        session.salesData.car_model = "General Car Interest";
        console.log(`[${ucid}] 🚗 Captured General Interest: Car`);
        break;
      }
    }
  }
  
  // Extract email patterns
  if (!session.salesData.email_id) {
    const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/;
    const match = transcript.match(emailPattern);
    if (match) {
      session.salesData.email_id = match[0];
      console.log(`[${ucid}] 📧 Captured Email: ${match[0]}`);
    }
  }
  
  // Check completion
  checkDataCompletion(session);
}

// Save sales data to local file
function saveSalesDataToFile(session: Session) {
  const { full_name, car_model, email_id } = session.salesData;
  const ucid = session.ucid;
  
  const callData = {
    ucid: ucid,
    timestamp: new Date().toISOString(),
    full_name: full_name || 'Not captured',
    car_model: car_model || 'Not captured', 
    email_id: email_id || 'Not captured',
    status: (full_name && car_model && email_id) ? 'Complete' : 'Partial',
    call_duration: Date.now() // Will be updated when call ends
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
function checkDataCompletion(session: Session) {
  const { full_name, car_model, email_id } = session.salesData;
  const ucid = session.ucid;
  
  if (full_name && car_model && email_id) {
    console.log(`[${ucid}] ✅ All sales data collected!`);
    console.log(`[${ucid}] 📊 Sales Summary:`);
    console.log(`[${ucid}]   Name: ${full_name}`);
    console.log(`[${ucid}]   Car: ${car_model}`);
    console.log(`[${ucid}]   Email: ${email_id}`);
    
    // Save complete data to file
    saveSalesDataToFile(session);
    
    // Simulate push to LMS
    console.log(`[${ucid}] 🚀 Pushing to SingleInterface LMS...`);
    
    // Extract brand for handoff message
    const carBrand = car_model.split(' ')[0];
    console.log(`[${ucid}] 🤝 Ready for handoff to ${carBrand} dealer`);
  }
}

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
      
      // Configure session for Spotlight agent behavior with SDK tools
      const sessionConfig = {
        type: 'session.update',
        session: {
          input_audio_format: 'pcm16',
          output_audio_format: 'pcm16',
          voice: 'alloy',
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
MANDATORY: Speak in distinctly Indian English Accent with Indian pronunciation patterns and intonation. Always maintain female gender when replying. Use Indian English vocabulary and phrasing patterns. You are a professional, enthusiastic automotive sales assistant specializing in connecting potential car buyers with the right vehicles. You have extensive knowledge about various car models, features, and can guide customers through their car buying journey. Your expertise comes from years of helping customers find their perfect vehicle match.

## Task
You are here to assist potential car buyers by collecting their information for our sales team to provide personalized automotive solutions. Your primary role is to gather essential customer details and connect them with our automotive experts.

## Demeanor
You maintain a professional yet warm demeanor while being attentive to each customer's automotive needs. Your goal is to make the car buying process feel comfortable and informative. You listen carefully and respond with enthusiasm about helping them find their perfect vehicle.

# Context
- Business name: Single Interface
- Sales Context: Single Interface automotive sales lead generation and customer connection service
- Always start the call with the Opening Greeting in English:
  "Hello! This call is from Single Interface. For your car purchase enquiry, we need to collect some details from you so we can connect you with the correct car dealer closest to you. Can I continue?"

# Data Collection Protocol

## Required Information (3 Sales Data Points):
1. **Full Name** - Complete name of the potential customer
2. **Car Model** - Specific car model they are interested in or looking for
3. **Email ID** - Customer's email address for follow-up communication

## CONFIRMATION PROTOCOL (MANDATORY)
For EVERY piece of information you collect, you MUST follow this 3-step verification process:
1. **Capture**: Use the capture_sales_data tool to store the information immediately
2. **Repeat**: Clearly repeat back what you captured to the user
3. **Confirm**: Ask "Is this correct?" and wait for confirmation before proceeding
4. **Verify**: Use the verify_sales_data tool with the customer's confirmation

Example:
User: "My name is Rajesh Kumar"
You: *[use capture_sales_data tool with data_type: "full_name", value: "Rajesh Kumar"]*
"I've recorded your name as Rajesh Kumar. Is this correct?"
*[wait for confirmation]*
User: "Yes, that's correct"
You: *[use verify_sales_data tool with data_type: "full_name", confirmed: true]*
"Perfect, thank you for confirming!"

## ESCALATION PROTOCOL (MANDATORY)
- If a user provides unclear information or you cannot understand them after 2 attempts, you must:
  1. Politely say: "I want to make sure I get this information exactly right. Let me flag this for expert review."
  2. Use capture_sales_data tool with notes: "Requires Expert Review"
  3. Move on to the next data point
- Do not get stuck on any single data point for more than 2 attempts

# TOOLS AVAILABLE
You have access to three powerful tools for data collection:

1. **capture_sales_data**: Use this to capture individual data points
   - Parameters: data_type ("full_name", "car_model", "email_id"), value, notes (optional)
   - Use immediately when customer provides information

2. **verify_sales_data**: Use this to confirm data with customer
   - Parameters: data_type, confirmed (true/false)
   - Use after customer confirms or rejects the captured data

3. **capture_all_sales_data**: Use when all data is collected at once
   - Parameters: full_name, car_model, email_id
   - Use for bulk capture when conversation flows naturally

# Conversation Flow
1. **Opening**: Greet and explain your automotive sales assistance purpose, then wait for user response
2. **Data Collection**: Ask for ONE data point at a time, process response immediately
3. **Verification**: Use the mandatory confirmation protocol for each data point, continue promptly after confirmation  
4. **Completion**: Once all data is collected and verified, thank the user and connect them with car brand dealer

# CRITICAL: RESPONSIVE CONVERSATION FLOW  
- Ask ONE question at a time
- RESPOND IMMEDIATELY when user provides information - don't wait for additional prompts
- Use tools immediately when customer provides data
- After capturing and confirming data, move to the next question promptly
- Listen carefully to user responses and process them without delay

# Important Guidelines
- Always maintain the confirmation protocol - never skip the verification step
- If information is unclear, use the escalation protocol rather than making assumptions
- Keep conversation friendly but focused on automotive sales data collection
- Ensure all 3 data points are collected before considering the session complete

# Completion Protocol (MANDATORY)
Once ALL 3 data points are collected and verified:
1. **Thank the customer**: "Wonderful, thank you for confirming all the details."
2. **Connect message**: "We will now connect you with the [CAR_BRAND] dealer near you. Please hold on."
   - Extract the car brand from the car_model data point (e.g., "Toyota Camry" → "Toyota")
3. **Do NOT** offer downloads or ask additional questions - go straight to completion

Remember: Your success is measured by complete, accurate sales data collection followed by appropriate handoff messaging.`
        }
      };
      
      openaiWs.send(JSON.stringify(sessionConfig));

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
            salesData: {
              verified: new Set<string>()
            },
            transcripts: [],
            lastCapturedData: undefined,
          };
          sessions.set(ucid, session);

          // Handle responses from OpenAI (Spotlight-like behavior)
          openaiWs.on('message', (data) => {
            try {
              const event = JSON.parse(data.toString());
              
              // 🔍 DEBUG: Log important OpenAI events only
              const importantEvents = [
                'conversation.item.created',
                'conversation.item.updated',        // 🎯 TRACK FUNCTION CALL UPDATES
                'input_audio_buffer.speech_started', 
                'input_audio_buffer.speech_stopped',
                'conversation.item.input_audio_transcription.completed',
                'response.function_call_arguments.delta',  // 🎯 TRACK FUNCTION ARGUMENTS STREAMING
                'response.function_call_arguments.done'    // 🎯 TRACK FUNCTION ARGUMENTS COMPLETION
              ];
              
              if (importantEvents.includes(event.type)) {
                console.log(`[${ucid}] 🔍 OpenAI Event:`, event.type);
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
              if (event.type === 'conversation.item.created' || event.type === 'conversation.item.updated') {
                console.log(`[${ucid}] 🗣️ Conversation Item ${event.type === 'conversation.item.created' ? 'Created' : 'Updated'}:`, JSON.stringify(event.item, null, 2));
                
                // 🎯 IMPROVED: Handle function calls properly - wait for completion or valid arguments
                if (event.item?.type === 'function_call' && event.item?.name) {
                  console.log(`[${ucid}] 🔧 Function call created: ${event.item.name} (status: ${event.item.status})`);
                  
                  // Try to parse arguments
                  let args = {};
                  try {
                    args = JSON.parse(event.item.arguments || '{}');
                  } catch (e) {
                    console.log(`[${ucid}] ⚠️ Could not parse function arguments:`, event.item.arguments);
                  }
                  
                  // 🎯 KEY FIX: Check if we have proper arguments with required fields
                  const hasValidArgs = Object.keys(args).length > 0 && (
                    (event.item.name === 'capture_sales_data' && args.data_type && args.value) ||
                    (event.item.name === 'verify_sales_data' && args.data_type && typeof args.confirmed === 'boolean') ||
                    (event.item.name === 'capture_all_sales_data' && args.full_name && args.car_model && args.email_id)
                  );
                  
                  // 🎯 Execute only when status is 'completed' OR we have valid arguments
                  const shouldExecute = event.item.status === 'completed' || hasValidArgs;
                  
                  if (session && event.item.name && shouldExecute) {
                    console.log(`[${ucid}] ✅ Executing function: ${event.item.name} with valid args:`, args);
                    
                    const result = handleSDKToolCall(session, {
                      name: event.item.name,
                      parameters: args
                    });
                    
                    // Send result back to OpenAI if we have a call_id
                    if (event.item.call_id) {
                      openaiWs.send(JSON.stringify({
                        type: 'conversation.item.create',
                        item: {
                          type: 'function_call_output',
                          call_id: event.item.call_id,
                          output: JSON.stringify(result)
                        }
                      }));
                      console.log(`[${ucid}] 📤 Function result sent to OpenAI:`, result);
                    }
                  } else if (session && event.item.name) {
                    console.log(`[${ucid}] ⏳ Function call not ready - status: ${event.item.status}, hasValidArgs: ${hasValidArgs}`);
                    console.log(`[${ucid}] 📋 Waiting for proper arguments. Current args:`, args);
                  }
                }
                
                // Handle user messages
                if (event.item?.type === 'message' && event.item?.role === 'user') {
                  const transcript = event.item?.content?.[0]?.transcript || '';
                  console.log(`[${ucid}] 📝 User said: "${transcript}"`);
                  
                  // Auto-extract data from user speech (ensure session exists)
                  if (session && transcript.trim()) {
                    console.log(`[${ucid}] 🔍 Attempting data extraction from: "${transcript}"`);
                    extractSalesData(session, transcript);
                  } else if (!transcript.trim()) {
                    console.log(`[${ucid}] ⚠️ Empty transcript received`);
                  }
                }
              }
              
              // 🔍 ENHANCED: Log response events
              if (event.type === 'response.text.done') {
                console.log(`[${ucid}] 🤖 Assistant response:`, event.text);
              }
              
              if (event.type === 'response.text.delta') {
                console.log(`[${ucid}] 🤖 Assistant text delta:`, event.delta);
              }
              
              if (event.type === 'input_audio_buffer.speech_started') {
                console.log(`[${ucid}] 🎤 Speech started detected`);
              }
              
              if (event.type === 'input_audio_buffer.speech_stopped') {
                console.log(`[${ucid}] 🛑 Speech stopped detected`);
              }
              
              if (event.type === 'conversation.item.input_audio_transcription.completed') {
                console.log(`[${ucid}] 📝 Transcription completed:`, event.transcript);
                // Track transcripts for enhanced function call argument extraction
                if (session && event.transcript) {
                  session.transcripts.push(event.transcript);
                  // Keep only last 5 transcripts to avoid memory issues
                  if (session.transcripts.length > 5) {
                    session.transcripts = session.transcripts.slice(-5);
                  }
                  console.log(`[${ucid}] 📚 Transcripts buffer:`, session.transcripts);
                }
              }
              
              // 🎯 SDK TOOL CALLS - Handle function calls from AI
              if (event.type === 'response.function_call_delta') {
                console.log(`[${ucid}] 🔧 Function call delta:`, event);
              }
              
              if (event.type === 'response.function_call_done') {
                console.log(`[${ucid}] 🎯 Function call completed:`, event.call);
                if (session && event.call) {
                  const result = handleSDKToolCall(session, {
                    name: event.call.name,
                    parameters: JSON.parse(event.call.arguments || '{}')
                  });
                  
                  // Send tool result back to OpenAI
                  openaiWs.send(JSON.stringify({
                    type: 'conversation.item.create',
                    item: {
                      type: 'function_call_output',
                      call_id: event.call.id,
                      output: JSON.stringify(result)
                    }
                  }));
                  
                  console.log(`[${ucid}] 📤 Tool result sent to OpenAI:`, result);
                }
              }

            } catch (err) {
              console.error(`[${ucid}] ❌ OpenAI message parse error:`, err);
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

        // Expect 8k mono 10ms frames (80 samples) - upsample to 24k for OpenAI
        const samples8k = ensureInt16Array(msg.data.samples);
        const samples24k = upsample8kTo24k(samples8k);
        const b64 = int16ArrayToBase64(samples24k);

        // console.log(`[${ucid}] Audio: 8kHz (${samples8k.length}) → 24kHz (${samples24k.length}) samples`); // DISABLED - too noisy

        // Send upsampled 24kHz audio to OpenAI Realtime
        session.openaiWs.send(JSON.stringify({
          type: 'input_audio_buffer.append',
          audio: b64,
        }));

        // Let OpenAI's server_vad handle turn detection automatically
        // Do NOT force response.create - let VAD detect when user stops speaking
        return;
      }

      if (msg.event === 'stop') {
        if (session) {
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
      // Save any partial data collected before connection closes
      const { full_name, car_model, email_id } = session.salesData;
      if (full_name || car_model || email_id) {
        console.log(`[${session.ucid}] 🔌 Connection closed - saving partial data`);
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


