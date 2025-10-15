import 'dotenv/config';
import http from 'http';
import WebSocket, { WebSocketServer } from 'ws';
import fs from 'fs';
import path from 'path';
import { int16ArrayToBase64, ensureInt16Array, upsample8kTo24k, downsample24kTo8k, initializeResamplers } from './audio';

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

// 🎯 Transfer Tool - Hands off call to dealer after data collection
const telephonySDKTools: any[] = [
  {
    type: "function" as const,
    name: "transfer_call",
    description: "CRITICAL: Call this function to transfer the call to a Mahindra dealer. REQUIRED after collecting all 3 customer details (name, car model, email) OR if customer asks to speak with a human. You MUST call this function, not just say you will transfer.",
    parameters: {
      type: "object",
      properties: {
        reason: {
          type: "string",
          enum: ["data_collected", "customer_request", "technical_issue"],
          description: "Why you are transferring: 'data_collected' after getting all 3 details, 'customer_request' if they ask for human, 'technical_issue' if problem occurs"
        }
      },
      required: ["reason"]
    }
  }
];

// 🔄 TRANSFER HANDLER
// Executes Waybeo transfer API to hand off call to dealer

async function executeWaybeoTransfer(callId: string, reason: string): Promise<boolean> {
  const waybeoUrl = process.env.WAYBEO_TRANSFER_URL || 'https://pbx-uat.waybeo.com/bot-call';
  const authToken = process.env.WAYBEO_AUTH_TOKEN;

  if (!authToken) {
    console.error(`[${callId}] ❌ WAYBEO_AUTH_TOKEN not configured - cannot transfer call`);
    return false;
  }

  const payload = {
    command: "transfer",
    callId: callId
  };

  console.log(`[${callId}] 🔄 Calling Waybeo Transfer API...`);
  console.log(`[${callId}] 📤 Transfer payload:`, JSON.stringify(payload, null, 2));

  try {
    const response = await fetch(waybeoUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[${callId}] ❌ Waybeo transfer failed: HTTP ${response.status} - ${errorText}`);
      return false;
    }

    const result = await response.json();
    console.log(`[${callId}] ✅ Waybeo transfer successful:`, result);
    return true;

  } catch (error) {
    console.error(`[${callId}] ❌ Waybeo transfer error:`, error);
    return false;
  }
}

async function handleTransferCall(session: Session, reason: string) {
  const ucid = session.ucid;
  
  console.log(`[${ucid}] 🔄 Transfer requested - Reason: ${reason}`);
  
  // Save any transcript data collected so far
  saveTranscriptForProcessing(session);
  console.log(`[${ucid}] 💾 Transcript saved before transfer`);
  
  // ⏰ CRITICAL: Add delay to allow agent to finish speaking before transferring
  // The function call happens while agent is still generating speech
  // We need to wait for speech to complete before calling Waybeo API
  const speechCompletionDelay = 5000; // 5 seconds - allows complete message to be heard
  console.log(`[${ucid}] ⏳ Waiting ${speechCompletionDelay}ms for agent to complete transfer message...`);
  
  await new Promise(resolve => setTimeout(resolve, speechCompletionDelay));
  
  console.log(`[${ucid}] ✅ Speech completion wait finished - executing transfer now`);
  
  // Execute transfer API call
  const transferSuccess = await executeWaybeoTransfer(ucid, reason);
  
  if (transferSuccess) {
    console.log(`[${ucid}] ✅ Transfer API call successful`);
    console.log(`[${ucid}] 🔍 OBSERVING: Waiting to see if Waybeo sends WebSocket close event...`);
    // 🧪 TESTING: We're NOT manually closing connections here
    // We want to observe if Waybeo sends a close event after transfer
    // If they don't, we'll request this feature from them
  } else {
    console.error(`[${ucid}] ❌ Transfer API failed - call will continue`);
  }
}

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

  // Configurable model - set VOICEAGENT_MODEL env var to switch models
  // Options: gpt-realtime (standard/default for testing), gpt-4o-mini-realtime-preview-2024-12-17 (mini for production)
  const model = process.env.VOICEAGENT_MODEL || 'gpt-realtime';
  console.log(`[${ucid}] 🤖 Using model: ${model}`);

  return new Promise((resolve, reject) => {
    const openaiWs = new WebSocket(`wss://api.openai.com/v1/realtime?model=${model}`, {
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
          tool_choice: "auto",
          temperature: 0.7,
          instructions: `# 🚨 CRITICAL: Tool Calling Protocol
**YOU MUST CALL THE transfer_call FUNCTION - NOT JUST SAY IT**

## When to Call transfer_call:
1. **After collecting all 3 details** (Name + Car Model + Email) → Call transfer_call with reason "data_collected"
2. **If customer requests to speak with dealer/human** → Call transfer_call with reason "customer_request"

## Transfer Sequence (CRITICAL - DO THIS IMMEDIATELY AFTER COLLECTING 3RD DETAIL):
**AS SOON AS you receive the 3rd data point (email), DO NOT ask for confirmation:**

1. **IMMEDIATELY**: Say this COMPLETE transfer message: "Thank you for all the details. Let me transfer you to a Mahindra dealer closest to you.............. Please hold on."
2. **THEN IMMEDIATELY**: Call transfer_call function with {"reason": "data_collected"}

DO NOT:
- ❌ Ask "Is this correct?" after email
- ❌ Wait for user confirmation
- ❌ Say anything else before transfer

YOU MUST:
- ✅ Say the COMPLETE transfer message
- ✅ Call transfer_call IMMEDIATELY after saying it
- ✅ Do this RIGHT AFTER collecting the 3rd data point

---

# CRITICAL: Multilingual Support with English Start
You support the following languages: Hindi, English, Marathi, Telugu, Tamil, Malayalam

## Language Switching Protocol:
- **START IN ENGLISH**: ALWAYS begin the conversation with English greeting
- **Automatic Language Detection**: Listen to the customer's response and detect their language
- **Auto-Switch**: If customer responds in Hindi/Marathi/Telugu/Tamil/Malayalam, IMMEDIATELY switch to that language
- **Stay in Detected Language**: Continue the entire conversation in the detected language
- **Manual Switch**: If customer explicitly requests a language change, switch immediately

## Opening Greeting (MANDATORY - Always in English):
ALWAYS start with: "Namaskar.............. Welcome to Dee Emm Mahindra dealer. How may I help you today?"

## Language Switching After First Response:
After the customer responds to your English greeting, detect their language and switch:
- If customer speaks **Hindi**: Switch to Hindi for all remaining conversation
- If customer speaks **Marathi**: Switch to Marathi for all remaining conversation
- If customer speaks **Telugu**: Switch to Telugu for all remaining conversation
- If customer speaks **Tamil**: Switch to Tamil for all remaining conversation
- If customer speaks **Malayalam**: Switch to Malayalam for all remaining conversation
- If customer continues in **English**: Stay in English

## Language-Specific Responses (After switching):
- **Hindi**: "जी बिल्कुल, मैं आपकी मदद करूंगी। कृपया अपना नाम बताएं?"
- **Marathi**: "नक्कीच, मी तुमची मदत करेन। कृपया तुमचे नाव सांगा?"
- **Telugu**: "తప్పకుండా, నేను మీకు సహాయం చేస్తాను. దయచేసి మీ పేరు చెప్పండి?"
- **Tamil**: "நிச்சயமாக, நான் உங்களுக்கு உதவுகிறேன். தயவுசெய்து உங்கள் பெயரை சொல்லுங்கள்?"
- **Malayalam**: "തീർച്ചയായും, ഞാൻ നിങ്ങളെ സഹായിക്കും. ദയവായി നിങ്ങളുടെ പേര് പറയൂ?"
- **English**: "Sure, I'll be happy to help. May I know your name please?"

## Transfer Messages (EXACT phrases to use in each language):
After collecting all 3 details, say the COMPLETE message in customer's language:
- **English**: "Thank you for all the details. Let me transfer you to a Mahindra dealer closest to you.............. Please hold on."
- **Hindi**: "सभी विवरणों के लिए धन्यवाद। मैं आपको आपके सबसे नजदीकी महिंद्रा डीलर से जोड़ती हूं.............. कृपया प्रतीक्षा करें।"
- **Marathi**: "सर्व तपशीलांसाठी धन्यवाद। मी तुम्हाला तुमच्या जवळच्या महिंद्रा डीलरशी जोडते आहे.............. कृपया प्रतीक्षा करा।"
- **Telugu**: "అన్ని వివరాలకు ధన్యవాదాలు। నేను మిమ్మల్ని మీకు దగ్గరగా ఉన్న మహీంద్రా డీలర్‌కి కనెక్ట్ చేస్తున్నాను.............. దయచేసి వేచి ఉండండి।"
- **Tamil**: "அனைத்து விவரங்களுக்கும் நன்றி। நான் உங்களை உங்களுக்கு அருகில் உள்ள மஹிந்திரா டீலரிடம் இணைக்கிறேன்.............. தயவுசெய்து காத்திருங்கள்।"
- **Malayalam**: "എല്ലാ വിശദാംശങ്ങൾക്കും നന്ദി। ഞാൻ നിങ്ങളെ നിങ്ങളുടെ അടുത്തുള്ള മഹീന്ദ്ര ഡീലറുമായി ബന്ധിപ്പിക്കുകയാണ്.............. ദയവായി കാത്തിരിക്കൂ।"

# Personality and Tone
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

## Question Variations (Multilingual - Use randomly in customer's language):

### Hindi:
- **Name**: "कृपया अपना पूरा नाम बताएं?" / "आपका नाम क्या है जी?" / "मैं आपका नाम जान सकती हूं?"
- **Car Model**: "आप कौन सा महिंद्रा कार मॉडल चाहते हैं?" / "आप किस महिंद्रा गाड़ी में इंटरेस्टेड हैं?"
- **Email**: "कृपया अपना ईमेल आईडी बताएं?" / "आपका ईमेल एड्रेस क्या है?"

### English:
- **Name**: "May I know your full name, please?" / "What is your good name, please?"
- **Car Model**: "Which Mahindra car model are you interested in?" / "May I know the Mahindra model you have in mind?"
- **Email**: "Could you please share your email ID with me?" / "What would be your email address?"

### Marathi:
- **Name**: "कृपया तुमचे पूर्ण नाव सांगा?" / "तुमचे नाव काय आहे?"
- **Car Model**: "तुम्हाला कोणते महिंद्रा कार मॉडेल हवे आहे?" / "तुम्हाला कोणत्या महिंद्रा गाडीत रस आहे?"
- **Email**: "कृपया तुमचा ईमेल आयडी द्या?" / "तुमचा ईमेल अॅड्रेस काय आहे?"

### Telugu:
- **Name**: "దయచేసి మీ పూర్తి పేరు చెప్పండి?" / "మీ పేరు ఏమిటి?"
- **Car Model**: "మీరు ఏ మహీంద్రా కార్ మోడల్ కావాలి?" / "మీకు ఏ మహీంద్రా వాహనం కావాలి?"
- **Email**: "దయచేసి మీ ఇమెయిల్ ఐడి చెప్పండి?" / "మీ ఇమెయిల్ చిరునామా ఏమిటి?"

### Tamil:
- **Name**: "உங்கள் முழு பெயரை சொல்லுங்கள்?" / "உங்கள் பெயர் என்ன?"
- **Car Model**: "நீங்கள் எந்த மஹிந்திரா கார் மாடல் வேண்டும்?" / "எந்த மஹிந்திரா வாகனத்தில் ஆர்வம் உள்ளது?"
- **Email**: "உங்கள் மின்னஞ்சல் ஐடியை சொல்லுங்கள்?" / "உங்கள் மின்னஞ்சல் முகவரி என்ன?"

### Malayalam:
- **Name**: "ദയവായി നിങ്ങളുടെ പൂർണ്ണ പേര് പറയൂ?" / "നിങ്ങളുടെ പേര് എന്താണ്?"
- **Car Model**: "നിങ്ങൾക്ക് ഏത് മഹീന്ദ്ര കാർ മോഡൽ വേണം?" / "ഏത് മഹീന്ദ്ര വാഹനത്തിൽ താൽപ്പര്യമുണ്ട്?"
- **Email**: "നിങ്ങളുടെ ഇമെയിൽ ഐഡി പറയൂ?" / "നിങ്ങളുടെ ഇമെയിൽ വിലാസം എന്താണ്?"

## CONFIRMATION PROTOCOL (MANDATORY - in customer's language):
- For each response, capture exactly what caller says — same to same, no assumptions.
- Repeat back each detail word-for-word: "I've noted <caller_input>… Is this correct?" (in their language)
- If the customer corrects the detail, apologize warmly before repeating in their language.

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

# 🎯 CRITICAL COMPLETION STEP
When you have collected Name + Car Model + Email:
1. Say the COMPLETE message: "Thank you for all the details. Let me transfer you to a Mahindra dealer closest to you.............. Please hold on."
2. **IMMEDIATELY AFTER saying the COMPLETE message, CALL transfer_call** function with {"reason": "data_collected"}

IMPORTANT: Say the COMPLETE transfer message. Do not cut it short. Then MUST call transfer_call function. Skipping either step is a failure.`
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
                
                // Handle function call items
                if (event.item?.type === 'function_call' && event.item?.name) {
                  console.log(`[${ucid}] 🔧 Function call item: ${event.item.name}`);
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
              
              if (event.type === 'response.function_call_arguments.done') {
                const functionName = event.name;
                const callId = event.call_id;
                
                console.log(`[${ucid}] 🔧 Function call completed: ${functionName}`);
                console.log(`[${ucid}] 📋 Arguments:`, event.arguments);
                
                if (functionName === 'transfer_call') {
                  if (!session) {
                    console.error(`[${ucid}] ❌ No session found for transfer_call`);
                    return;
                  }
                  
                  try {
                    const args = JSON.parse(event.arguments);
                    const reason = args.reason || 'data_collected';
                    
                    console.log(`[${ucid}] 🔄 Processing transfer_call - Reason: ${reason}`);
                    
                    // CRITICAL FIX: Send function response IMMEDIATELY (don't wait for transfer)
                    // This allows agent to generate speech response without blocking
                    if (session && session.openaiWs && session.openaiWs.readyState === WebSocket.OPEN) {
                      session.openaiWs.send(JSON.stringify({
                        type: 'conversation.item.create',
                        item: {
                          type: 'function_call_output',
                          call_id: callId,
                          output: JSON.stringify({ 
                            success: true, 
                            message: 'Transfer initiated successfully'
                          })
                        }
                      }));
                      
                      // Trigger response - agent can now speak
                      session.openaiWs.send(JSON.stringify({ type: 'response.create' }));
                      
                      console.log(`[${ucid}] ✅ Function response sent - agent can now generate speech`);
                    }
                    
                    // Execute transfer in background (with delay) - doesn't block agent
                    handleTransferCall(session, reason).catch(err => {
                      console.error(`[${ucid}] ❌ Transfer execution error:`, err);
                    });
                    
                  } catch (parseError) {
                    console.error(`[${ucid}] ❌ Error parsing transfer_call arguments:`, parseError);
                  }
                }
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

  ws.on('close', (code, reason) => {
    if (session) {
      console.log(`[${session.ucid}] 🔌 Connection closed - Code: ${code}, Reason: ${reason || 'No reason provided'}`);
      console.log(`[${session.ucid}] 🔍 TESTING: This close event helps us know if Waybeo automatically closes after transfer`);
      console.log(`[${session.ucid}] 📊 Processing call data...`);
      
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

// Initialize high-quality audio resamplers before starting server
(async () => {
  console.log('🎵 Initializing high-quality audio resamplers...');
  await initializeResamplers();
  
  server.listen(port, host, () => {
    console.log(`[telephony] WebSocket server with Spotlight-like behavior listening on ws://${host}:${port}/ws`);
  });
})();


