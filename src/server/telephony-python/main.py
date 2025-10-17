"""
Python Telephony Service with librosa
High-quality audio processing for VoiceAgent

This service provides the same functionality as the TypeScript version
but uses librosa for superior audio quality.

Port: 8081 (runs parallel to TypeScript on 8080)
"""
import asyncio
import websockets
import websocket
import json
import base64
import time
import uuid
import os
from datetime import datetime
from typing import Dict, Optional, List
import requests
from pathlib import Path

from config import Config
from audio_processor import get_audio_processor

# Initialize configuration
Config.validate()
Config.print_config()

# Get audio processor
audio_processor = get_audio_processor(Config.SAMPLE_RATE_TELEPHONY, Config.SAMPLE_RATE_OPENAI)

# Ensure data directory exists
Path(Config.DATA_DIR).mkdir(parents=True, exist_ok=True)


class Session:
    """Represents a single call session"""
    
    def __init__(self, ucid: str, client_ws):
        self.ucid = ucid
        self.client_ws = client_ws
        self.openai_ws = None
        self.transcripts = []
        self.rich_transcript = []
        self.start_time = time.time()
        self.connected = True
        
        print(f"[{ucid}] 📞 New session created")
    
    def add_transcript(self, text: str, role: str = "user"):
        """Add transcript entry"""
        self.transcripts.append(text)
        self.rich_transcript.append({
            "timestamp": datetime.utcnow().isoformat(),
            "role": role,
            "content": text
        })
    
    def get_duration(self) -> int:
        """Get call duration in milliseconds"""
        return int((time.time() - self.start_time) * 1000)


# Active sessions
sessions: Dict[str, Session] = {}


# Agent instructions (multilingual, same as TypeScript)
AGENT_INSTRUCTIONS = """# 🚨 CRITICAL: Tool Calling Protocol
**YOU MUST CALL THE transfer_call FUNCTION - NOT JUST SAY IT**

You are a friendly Mahindra car dealership assistant helping customers interested in purchasing vehicles.

# 🎯 YOUR ROLE
- Collect customer details: Name, Car Model, Email
- Be conversational, warm, and helpful
- Confirm each detail before moving forward

# 📋 Required Information (3 Sales Data Points)
1. **Full Name** - Complete name of the potential customer
2. **Car Model** - Specific Mahindra car model they are interested in
3. **Email ID** - Customer's email address for follow-up communication

# ❓ Question Variations (Use randomly, in customer's language)

## Hindi:
- **Name**: "कृपया अपना पूरा नाम बताएं?" / "आपका नाम क्या है जी?" / "मैं आपका नाम जान सकती हूं?"
- **Car Model**: "आप कौन सा महिंद्रा कार मॉडल चाहते हैं?" / "आप किस महिंद्रा गाड़ी में इंटरेस्टेड हैं?"
- **Email**: "कृपया अपना ईमेल आईडी बताएं?" / "आपका ईमेल एड्रेस क्या है?"

## English:
- **Name**: "May I know your full name, please?" / "What is your good name, please?"
- **Car Model**: "Which Mahindra car model are you interested in?" / "May I know the Mahindra model you have in mind?"
- **Email**: "Could you please share your email ID with me?" / "What would be your email address?"

# ✅ CONFIRMATION PROTOCOL (MANDATORY - in customer's language)
For each response, capture exactly what caller says — same to same, no assumptions.
Repeat back each detail word-for-word:  
"I've noted <caller_input>… Is this correct?" (in their language)

If the customer corrects the detail, apologize warmly before repeating in their language.

# 🎯 CRITICAL COMPLETION STEP
When you have collected Name + Car Model + Email:
1. Say the COMPLETE message: "Thank you for all the details. Let me transfer you to a Mahindra dealer closest to you.............. Please hold on."
2. **IMMEDIATELY AFTER saying the COMPLETE message, CALL transfer_call** function with {"reason": "data_collected"}

## Transfer Sequence (IMPORTANT):
1. **FIRST**: Confirm you have collected Name + Car Model + Email
2. **THEN**: Say this COMPLETE message: "Thank you for all the details. Let me transfer you to a Mahindra dealer closest to you.............. Please hold on."
3. **IMMEDIATELY AFTER saying the COMPLETE message**: Call transfer_call function with {"reason": "data_collected"}

CRITICAL: Say the COMPLETE transfer message before calling the function. Do not cut it short.
The function call MUST happen - do not skip it after speaking.

## Transfer Messages (EXACT phrases to use in each language):
After collecting all 3 details, say the COMPLETE message in customer's language:
- **English**: "Thank you for all the details. Let me transfer you to a Mahindra dealer closest to you.............. Please hold on."
- **Hindi**: "धन्यवाद सभी विवरण के लिए। मैं आपको आपके नजदीकी महिंद्रा डीलर से जोड़ती हूं.............. कृपया प्रतीक्षा करें।"
- **Marathi**: "सर्व माहितीसाठी धन्यवाद। मी तुम्हाला तुमच्या जवळच्या महिंद्रा डीलरशी जोडते.............. कृपया प्रतीक्षा करा।"
- **Telugu**: "అన్ని వివరాలకు ధన్యవాదాలు। నేను మిమ్మల్ని మీకు దగ్గరగా ఉన్న మహీంద్రా డీలర్‌కు కనెక్ట్ చేస్తాను.............. దయచేసి వేచి ఉండండి।"
- **Tamil**: "அனைத்து விவரங்களுக்கும் நன்றி। நான் உங்களை உங்களுக்கு அருகில் உள்ள மஹிந்திரா டீலருடன் இணைக்கிறேன்.............. தயவுசெய்து காத்திருங்கள்."
- **Malayalam**: "എല്ലാ വിശദാംശങ്ങൾക്കും നന്ദി। ഞാൻ നിങ്ങളെ നിങ്ങളുടെ അടുത്തുള്ള മഹീന്ദ്ര ഡീലറുമായി ബന്ധിപ്പിക്കുന്നു.............. ദയവായി കാത്തിരിക്കൂ।"

# 🌐 CRITICAL: Multilingual Support with English Start
You support the following languages: Hindi, English, Marathi, Telugu, Tamil, Malayalam

## Language Switching Protocol:
1. **START IN ENGLISH**: ALWAYS begin the conversation with English greeting
2. **Automatic Language Detection**: Listen to the customer's response and detect their language
3. **Auto-Switch**: If customer responds in Hindi/Marathi/Telugu/Tamil/Malayalam, IMMEDIATELY switch to that language
4. **Stay in Detected Language**: Continue the entire conversation in the detected language
5. **Manual Switch**: If customer explicitly requests a language change, switch immediately

## Opening Greeting (MANDATORY - Always in English):
ALWAYS start with:  
"Namaskar.............. Welcome to Dee Emm Mahindra dealer. How may I help you today?"

## Language Switching After First Response:
After the customer responds to your English greeting, detect their language and switch:
- If customer speaks **Hindi**: Switch to Hindi for all remaining conversation
- If customer speaks **Marathi**: Switch to Marathi for all remaining conversation
- If customer speaks **Telugu**: Switch to Telugu for all remaining conversation
- If customer speaks **Tamil**: Switch to Tamil for all remaining conversation
- If customer speaks **Malayalam**: Switch to Malayalam for all remaining conversation
- If customer continues in **English**: Stay in English

## Language-Specific Responses (After switching):
- **Hindi**: Continue in Hindi - "जी बिल्कुल, मैं आपकी मदद करूंगी। कृपया अपना नाम बताएं?"
- **Marathi**: Continue in Marathi - "नक्कीच, मी तुमची मदत करेन। कृपया तुमचे नाव सांगा?"
- **Telugu**: Continue in Telugu - "తప్పకుండా, నేను మీకు సహాయం చేస్తాను। దయచేసి మీ పేరు చెప్పండి?"
- **Tamil**: Continue in Tamil - "நிச்சயமாக, நான் உங்களுக்கு உதவுகிறேன். தயவுசெய்து உங்கள் பெயரை சொல்லுங்கள்?"
- **Malayalam**: Continue in Malayalam - "തീർച്ചയായും, ഞാൻ നിങ്ങളെ സഹായിക്കും। ദയവായി നിങ്ങളുടെ പേര് പറയൂ?"
- **English**: Continue in English - "Sure, I'll be happy to help. May I know your name please?"
"""

# Transfer tool definition
TRANSFER_TOOL = {
    "type": "function",
    "name": "transfer_call",
    "description": "Transfer the call to a Mahindra dealer. Use after collecting customer details OR if customer requests to speak with a human.",
    "parameters": {
        "type": "object",
        "properties": {
            "reason": {
                "type": "string",
                "enum": ["data_collected", "customer_request", "issue_resolution"],
                "description": "Reason for transfer"
            }
        },
        "required": ["reason"]
    }
}


async def execute_waybeo_transfer(ucid: str, reason: str) -> bool:
    """
    Execute Waybeo transfer API call
    
    Args:
        ucid: Unique call ID
        reason: Reason for transfer
        
    Returns:
        True if successful, False otherwise
    """
    if not Config.ENABLE_CALL_TRANSFER:
        print(f"[{ucid}] ⚠️  Call transfer disabled")
        return False
    
    try:
        print(f"[{ucid}] 📞 Initiating Waybeo transfer (reason: {reason})")
        
        # Wait 5 seconds for agent to finish speaking
        await asyncio.sleep(5)
        
        payload = {
            "command": "transfer",
            "callId": ucid
        }
        
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {Config.WAYBEO_AUTH_TOKEN}"
        }
        
        response = requests.post(
            Config.WAYBEO_WEBHOOK_URL,
            json=payload,
            headers=headers,
            timeout=10
        )
        
        if response.status_code == 200:
            print(f"[{ucid}] ✅ Waybeo transfer successful")
            return True
        else:
            print(f"[{ucid}] ❌ Waybeo transfer failed: HTTP {response.status_code} - {response.text}")
            return False
            
    except Exception as e:
        print(f"[{ucid}] ❌ Waybeo transfer error: {e}")
        return False


def save_transcript(session: Session):
    """
    Save transcript and queue entry for async processing
    
    Args:
        session: Session object
    """
    ucid = session.ucid
    timestamp = int(time.time() * 1000)
    
    # Transcript file
    transcript_file = f"{Config.DATA_DIR}/call_{ucid}_{timestamp}_transcript.json"
    transcript_data = {
        "ucid": ucid,
        "timestamp": timestamp,
        "duration_ms": session.get_duration(),
        "transcripts": session.transcripts,
        "rich_transcript": session.rich_transcript
    }
    
    with open(transcript_file, 'w') as f:
        json.dump(transcript_data, f, indent=2)
    
    print(f"[{ucid}] 📄 Transcript saved: {transcript_file}")
    
    # Queue entry file
    queue_file = f"{Config.DATA_DIR}/call_{ucid}_{timestamp}_queue.json"
    queue_data = {
        "ucid": ucid,
        "timestamp": timestamp,
        "transcript_file": transcript_file,
        "status": "pending"
    }
    
    with open(queue_file, 'w') as f:
        json.dump(queue_data, f, indent=2)
    
    print(f"[{ucid}] 📋 Processing queue entry created: {queue_file}")


async def handle_transfer_call(session: Session, reason: str):
    """
    Handle transfer_call tool invocation
    
    Args:
        session: Session object
        reason: Transfer reason
    """
    ucid = session.ucid
    print(f"[{ucid}] 🔄 Transfer call requested: {reason}")
    
    # Execute transfer in background (with 5-second delay)
    asyncio.create_task(execute_waybeo_transfer(ucid, reason))
    
    # Return function output immediately (don't block agent)
    return {
        "success": True,
        "message": "Transfer initiated"
    }


async def handle_openai_connection(session: Session):
    """
    Handle OpenAI Realtime API WebSocket connection
    
    Args:
        session: Session object
    """
    ucid = session.ucid
    
    try:
        # Connect to OpenAI Realtime API
        openai_url = f"wss://api.openai.com/v1/realtime?model={Config.VOICEAGENT_MODEL}"
        headers = {
            "Authorization": f"Bearer {Config.OPENAI_API_KEY}",
            "OpenAI-Beta": "realtime=v1"
        }
        
        session.openai_ws = await websockets.connect(openai_url, extra_headers=headers)
        print(f"[{ucid}] 🤖 Connected to VoiceAgent Realtime API")
        
        # Send session configuration
        session_config = {
            "type": "session.update",
            "session": {
                "modalities": ["text", "audio"],
                "instructions": AGENT_INSTRUCTIONS,
                "voice": "alloy",
                "input_audio_format": "pcm16",
                "output_audio_format": "pcm16",
                "input_audio_transcription": {
                    "model": "whisper-1"
                },
                "turn_detection": {
                    "type": "server_vad",
                    "threshold": Config.VAD_THRESHOLD,
                    "prefix_padding_ms": Config.VAD_PREFIX_PADDING_MS,
                    "silence_duration_ms": Config.VAD_SILENCE_DURATION_MS
                },
                "tools": [TRANSFER_TOOL],
                "tool_choice": "auto",
                "temperature": 0.7
            }
        }
        
        await session.openai_ws.send(json.dumps(session_config))
        print(f"[{ucid}] 📤 Session configuration sent")
        
        # Handle OpenAI messages
        async for message in session.openai_ws:
            if not session.connected:
                break
            
            try:
                event = json.loads(message)
                event_type = event.get("type")
                
                # Transcription completed
                if event_type == "conversation.item.input_audio_transcription.completed":
                    transcript = event.get("transcript", "")
                    if transcript:
                        print(f"[{ucid}] 📝 User said: {transcript}")
                        session.add_transcript(transcript, "user")
                
                # Assistant audio response
                elif event_type == "response.audio.delta":
                    audio_b64 = event.get("delta")
                    if audio_b64 and session.client_ws:
                        # Process audio: 24kHz → 8kHz with librosa
                        samples_8k = audio_processor.process_output_audio(audio_b64)
                        
                        # Send to telephony client
                        payload = {
                            "event": "media",
                            "data": {
                                "samples": samples_8k
                            }
                        }
                        
                        await session.client_ws.send(json.dumps(payload))
                
                # Assistant transcript
                elif event_type == "response.audio_transcript.delta":
                    transcript = event.get("delta", "")
                    if transcript:
                        session.add_transcript(transcript, "assistant")
                
                # Function call
                elif event_type == "response.function_call_arguments.done":
                    function_name = event.get("name")
                    arguments = event.get("arguments", "{}")
                    
                    if function_name == "transfer_call":
                        args = json.loads(arguments)
                        reason = args.get("reason", "data_collected")
                        
                        # Handle transfer
                        result = await handle_transfer_call(session, reason)
                        
                        # Send function output to OpenAI
                        function_output = {
                            "type": "conversation.item.create",
                            "item": {
                                "type": "function_call_output",
                                "call_id": event.get("call_id"),
                                "output": json.dumps(result)
                            }
                        }
                        
                        await session.openai_ws.send(json.dumps(function_output))
                        
                        # Trigger response
                        await session.openai_ws.send(json.dumps({"type": "response.create"}))
                
            except json.JSONDecodeError:
                print(f"[{ucid}] ⚠️  Invalid JSON from OpenAI")
            except Exception as e:
                print(f"[{ucid}] ❌ Error processing OpenAI event: {e}")
                
    except Exception as e:
        print(f"[{ucid}] ❌ OpenAI connection error: {e}")
    finally:
        if session.openai_ws:
            await session.openai_ws.close()


async def handle_client(websocket, path):
    """
    Handle incoming WebSocket connection from telephony client
    
    Args:
        websocket: WebSocket connection
        path: Request path
    """
    ucid = str(uuid.uuid4())
    session = Session(ucid, websocket)
    sessions[ucid] = session
    
    try:
        # Start OpenAI connection
        openai_task = asyncio.create_task(handle_openai_connection(session))
        
        # Handle client messages
        async for message in websocket:
            try:
                msg = json.loads(message)
                event = msg.get("event")
                
                if event == "start":
                    ucid = msg.get("data", {}).get("ucid", ucid)
                    session.ucid = ucid
                    sessions[ucid] = session
                    print(f"[{ucid}] 🎬 Call started")
                
                elif event == "media" and msg.get("data"):
                    samples = msg["data"].get("samples", [])
                    if samples and session.openai_ws:
                        # Process audio: 8kHz → 24kHz with librosa
                        samples_array = audio_processor.samples_to_array(samples)
                        audio_b64 = audio_processor.process_input_audio(samples_array)
                        
                        # Send to OpenAI
                        await session.openai_ws.send(json.dumps({
                            "type": "input_audio_buffer.append",
                            "audio": audio_b64
                        }))
                
            except json.JSONDecodeError:
                print(f"[{ucid}] ⚠️  Invalid JSON from client")
            except Exception as e:
                print(f"[{ucid}] ❌ Error processing client message: {e}")
        
    except websockets.exceptions.ConnectionClosed:
        print(f"[{ucid}] 🔌 Connection closed")
    finally:
        # Cleanup
        session.connected = False
        print(f"[{ucid}] ⏱️  Total call duration: {session.get_duration()}ms")
        
        # Save transcript
        if session.transcripts:
            save_transcript(session)
        
        # Remove from sessions
        if ucid in sessions:
            del sessions[ucid]
        
        print(f"[{ucid}] ✅ Session cleaned up")


async def main():
    """Main entry point"""
    print("\n🐍 Starting Python Telephony Service with librosa...")
    print(f"🚀 WebSocket server starting on ws://{Config.HOST}:{Config.PORT}/ws\n")
    
    async with websockets.serve(handle_client, Config.HOST, Config.PORT):
        print(f"✅ Server listening on ws://{Config.HOST}:{Config.PORT}/ws")
        print("📞 Ready to accept calls!\n")
        await asyncio.Future()  # Run forever


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n👋 Shutting down gracefully...")

