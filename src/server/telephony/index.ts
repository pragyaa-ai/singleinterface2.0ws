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
  };
  transcripts: string[]; // Keep for backward compatibility
  fullTranscript: TranscriptEntry[]; // 🔄 NEW: Rich transcript with timestamps
  lastCapturedData?: string;
  callAnalytics?: CallAnalytics;
}

const port = Number(process.env.TELEPHONY_WS_PORT || 8080);
const host = process.env.TELEPHONY_WS_HOST || '0.0.0.0';

const server = http.createServer();
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

// Agent definition moved to separate module for better maintainability

// Removed old agent processing - now using modular agent from ./agents/transcriptAgent

// Handle data capture from agent with analytics
// Handler functions removed - using simpler approach with modular agent

// Data extraction function to simulate Spotlight agent tools (KEEP EXISTING - FALLBACK)
function extractSalesData(session: Session, transcript: string) {
  const ucid = session.ucid;
  const text = transcript.toLowerCase();
  
  console.log(`[${ucid}] 🔍 Starting data extraction from: "${transcript}"`);
  console.log(`[${ucid}] 🔍 Lowercase text: "${text}"`);
  
  // 🔧 CRITICAL FIX: Extract name patterns (allow overwriting for repeated info)
  console.log(`[${ucid}] 🔍 Attempting name extraction...`);
  const namePatterns = [
    /my name is ([a-zA-Z\s\.]+)/i,
    /i am ([a-zA-Z\s\.]+)/i,
    /i'm ([a-zA-Z\s\.]+)/i,
    /this is ([a-zA-Z\s\.]+)/i,
    /call me ([a-zA-Z\s\.]+)/i,
    /it is ([a-zA-Z\s\.]+)/i, // 🆕 NEW: Handle "It is [name]" format
    // 🆕 NEW: Additional patterns for repeated names
    /name[:\s]+([a-zA-Z\s\.]+)/i,
    /([a-zA-Z]{2,}\.?[a-zA-Z]*\s+[a-zA-Z]{2,})/i // Two-word name pattern with optional dot
  ];
  
  for (const pattern of namePatterns) {
    const match = transcript.match(pattern);
    if (match && match[1]) {
      const name = match[1].trim();
      if (name.length > 2 && name.length < 50 && !name.includes('hello') && !name.includes('yes') && !name.includes('ok')) {
        const oldName = session.salesData.full_name;
        session.salesData.full_name = name;
        console.log(`[${ucid}] 📝 Captured Name: ${name}${oldName ? ` (updated from: ${oldName})` : ''}`);
        break;
      }
    }
  }
  
  // 🔧 CRITICAL FIX: Extract car model patterns (allow overwriting for repeated info)
  console.log(`[${ucid}] 🔍 Attempting car model extraction...`);
  const carBrands = ['toyota', 'honda', 'maruti', 'hyundai', 'tata', 'mahindra', 'ford', 'chevrolet', 'volkswagen', 'bmw', 'mercedes', 'audi', 'nissan', 'kia'];
  const carModels = ['swift', 'baleno', 'dzire', 'vitara', 'ciaz', 'ertiga', 'xl6', 'brezza', 'city', 'amaze', 'jazz', 'wr-v', 'civic', 'accord', 'camry', 'innova', 'fortuner', 'corolla', 'i10', 'i20', 'venue', 'creta', 'verna', 'tucson', 'elantra', 'santafe'];
  
  for (const brand of carBrands) {
    if (text.includes(brand)) {
      for (const model of carModels) {
        if (text.includes(model)) {
          const carModel = `${brand.charAt(0).toUpperCase() + brand.slice(1)} ${model.charAt(0).toUpperCase() + model.slice(1)}`;
          const oldModel = session.salesData.car_model;
          session.salesData.car_model = carModel;
          console.log(`[${ucid}] 🚗 Captured Car Model: ${carModel}${oldModel ? ` (updated from: ${oldModel})` : ''}`);
          checkDataCompletion(session);
          return;
        }
      }
      // Just brand mentioned
      const brandName = brand.charAt(0).toUpperCase() + brand.slice(1);
      const oldModel = session.salesData.car_model;
      session.salesData.car_model = brandName;
      console.log(`[${ucid}] 🚗 Captured Car Brand: ${brandName}${oldModel ? ` (updated from: ${oldModel})` : ''}`);
      checkDataCompletion(session);
      return;
    }
  }
  
  // Generic car interest (only if no specific car is already captured)
  if (!session.salesData.car_model) {
    const carKeywords = ['car', 'vehicle', 'auto', 'sedan', 'suv', 'hatchback'];
    for (const keyword of carKeywords) {
      if (text.includes(keyword)) {
        session.salesData.car_model = "General Car Interest";
        console.log(`[${ucid}] 🚗 Captured General Interest: Car`);
        break;
      }
    }
  }
  
  // 🔧 CRITICAL FIX: Extract email patterns (allow overwriting for repeated info)
  console.log(`[${ucid}] 🔍 Attempting email extraction...`);
  
  // Handle both "user@domain.com" and "user.name at domain.com" formats
  const emailPatterns = [
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // Standard format
    /\b([A-Za-z0-9._%+-]+)\s+at\s+([A-Za-z0-9.-]+\.[A-Z|a-z]{2,})\b/i // "name at domain.com" format
  ];
  
  for (const pattern of emailPatterns) {
    const match = transcript.match(pattern);
    if (match) {
      let email;
      if (match.length === 1) {
        // Standard email format
        email = match[0];
      } else if (match.length >= 3) {
        // "name at domain.com" format - reconstruct with @
        email = `${match[1]}@${match[2]}`;
      }
      
      if (email) {
        const oldEmail = session.salesData.email_id;
        session.salesData.email_id = email;
        console.log(`[${ucid}] 📧 Captured Email: ${email}${oldEmail ? ` (updated from: ${oldEmail})` : ''}`);
        break;
      }
    }
  }
  
  // Check completion
  checkDataCompletion(session);
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
You: *[IMMEDIATELY use capture_sales_data tool with data_type: "full_name", value: "Rajesh Kumar"]*
"I've recorded your name as Rajesh Kumar. Is this correct?"
*[wait for confirmation - DO NOT require multiple "Hello" responses]*
User: "Yes, that's correct" OR "Yes" OR "Correct" OR any positive response
You: *[IMMEDIATELY use verify_sales_data tool with data_type: "full_name", confirmed: true]*
"Perfect! Now, what car model are you interested in?"

CRITICAL: If user mentions ANY car name (like "Safari", "Toyota", "Honda"), IMMEDIATELY capture it. Do not wait for formal responses.

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

# CRITICAL: IMMEDIATE RESPONSE PROTOCOL (MANDATORY)
- NEVER wait for additional prompts after user provides information
- IMMEDIATELY use capture_sales_data tool when ANY data is mentioned
- INSTANTLY move to confirmation after capturing data
- DO NOT wait for user to say "Hello" multiple times
- Process user input on FIRST mention and respond immediately
- If user provides partial data, capture it immediately and ask for clarification
- NEVER ignore user input - always acknowledge and process immediately

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
              verified: new Set<string>(),
              processing_status: 'pending' // 🔄 NEW: Track async processing status
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

          // Handle responses from OpenAI (Spotlight-like behavior)
          openaiWs.on('message', (data) => {
            try {
              const event = JSON.parse(data.toString());
              
              // 🔍 DEBUG: Log important OpenAI events only
              const importantEvents = [
                'conversation.item.created',
                'input_audio_buffer.speech_started', 
                'input_audio_buffer.speech_stopped',
                'conversation.item.input_audio_transcription.completed',
                'response.function_call_delta',
                'response.function_call_done'
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
              if (event.type === 'conversation.item.created') {
                console.log(`[${ucid}] 🗣️ Conversation Item Created:`, JSON.stringify(event.item, null, 2));
                
                // Handle function calls when created
                if (event.item?.type === 'function_call' && event.item?.name) {
                  console.log(`[${ucid}] 🔧 Function call created: ${event.item.name}`);
                  
                  let args: any = {};
                  try {
                    // 🔧 CRITICAL FIX: Enhanced argument parsing with corruption detection
                    const rawArgs = event.item.arguments || '{}';
                    console.log(`[${ucid}] 🔍 Raw function arguments:`, rawArgs);
                    
                    args = JSON.parse(rawArgs);
                    
                    // 🔧 CRITICAL FIX: Validate parsed arguments for corruption
                    if (args.car_model && args.car_model.length < 3) {
                      console.log(`[${ucid}] ⚠️ Potential corruption detected in car_model: "${args.car_model}"`);
                      console.log(`[${ucid}] 📝 Recent transcripts for context:`, session?.transcripts || []);
                      
                      // Try to find car model from recent transcripts
                      const recentTranscripts = session?.transcripts?.join(' ') || '';
                      const carBrands = ['toyota', 'honda', 'maruti', 'hyundai', 'tata', 'mahindra', 'ford', 'chevrolet', 'volkswagen', 'bmw', 'mercedes', 'audi', 'nissan', 'kia', 'safari'];
                      const carModels = ['swift', 'baleno', 'dzire', 'vitara', 'ciaz', 'ertiga', 'xl6', 'brezza', 'city', 'amaze', 'jazz', 'wr-v', 'civic', 'accord', 'camry', 'innova', 'fortuner', 'corolla', 'i10', 'i20', 'venue', 'creta', 'verna', 'tucson', 'elantra', 'santafe', 'safari'];
                      
                      for (const model of [...carBrands, ...carModels]) {
                        if (recentTranscripts.toLowerCase().includes(model.toLowerCase())) {
                          args.car_model = model.charAt(0).toUpperCase() + model.slice(1);
                          console.log(`[${ucid}] 🔧 Corrected car_model from transcripts: "${args.car_model}"`);
                          break;
                        }
                      }
                    }
                    
                    console.log(`[${ucid}] 🎯 Parsed function arguments:`, args);
                  } catch (e) {
                    console.log(`[${ucid}] ❌ Could not parse function arguments:`, event.item.arguments);
                    console.log(`[${ucid}] ❌ Parse error:`, e);
                  }
                  
                  if (session && event.item.name) {
                    // 🔍 CRITICAL FIX: Check if arguments are meaningful before execution
                    const hasValidArgs = Object.keys(args).length > 0 && 
                                        Object.values(args).some(val => val !== null && val !== undefined && val !== '');
                    
                    if (!hasValidArgs) {
                      console.log(`[${ucid}] ⚠️ Skipping function call with empty/invalid args: ${event.item.name}`);
                      console.log(`[${ucid}] 📝 Recent transcripts for context:`, session.transcripts || []);
                      
                      // Send a failure response to OpenAI
                      if (event.item.call_id) {
                        openaiWs.send(JSON.stringify({
                          type: 'conversation.item.create',
                          item: {
                            type: 'function_call_output',
                            call_id: event.item.call_id,
                            output: JSON.stringify({
                              success: false,
                              message: `Function ${event.item.name} called with empty arguments - please provide proper parameters`,
                              error: 'empty_arguments'
                            })
                          }
                        }));
                      }
                      return; // Don't execute the function
                    }
                    
                    console.log(`[${ucid}] 🎯 Executing function: ${event.item.name} with args:`, args);
                    
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
                  }
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
              if (event.type === 'response.text.done') {
                console.log(`[${ucid}] 🤖 Assistant response:`, event.text);
                
                // 🔄 NEW: Add assistant response to rich transcript
                if (session && event.text) {
                  const assistantEntry: TranscriptEntry = {
                    timestamp: new Date().toISOString(),
                    speaker: 'assistant',
                    text: event.text,
                    event_type: 'response_text_done'
                  };
                  session.fullTranscript.push(assistantEntry);
                  console.log(`[${ucid}] 📋 Assistant response added to rich transcript`);
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


