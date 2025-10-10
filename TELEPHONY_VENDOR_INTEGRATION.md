# 📞 Telephony Vendor Integration Guide

## WebSocket Message Format

Your telephony vendor needs to send **3 types of events** over WebSocket to properly integrate with the voice agent service.

---

## 🚀 **1. START Event (Call Initiation)**

Send this when a new call begins:

```json
{
  "event": "start",
  "ucid": "unique-call-id-123",
  "type": "text"
}
```

### Fields:
- `event`: **MUST be `"start"`** (string)
- `ucid`: Unique Call ID from your telephony system (string)
- `type`: Call type, typically `"text"` (string)

### What Happens:
- ✅ New session created with this `ucid`
- ✅ WebSocket connection established to OpenAI Realtime API
- ✅ Agent greeting starts (e.g., "Namaskar... Welcome to Dee Emm Mahindra dealer")

---

## 🎤 **2. MEDIA Event (Audio Streaming)**

Send this continuously during the call to stream audio:

```json
{
  "event": "media",
  "type": "media",
  "ucid": "unique-call-id-123",
  "data": {
    "samples": [1234, 5678, ...],  // Int16 array
    "bitsPerSample": 16,
    "sampleRate": 8000,
    "channelCount": 1,
    "numberOfFrames": 80,
    "type": "data"
  }
}
```

### Fields:
- `event`: **MUST be `"media"`** (string)
- `type`: `"media"` (string)
- `ucid`: Same Call ID from start event (string)
- `data.samples`: Audio samples as Int16 array (number[])
- `data.sampleRate`: **8000 Hz** (number) - will be upsampled to 24kHz internally
- `data.channelCount`: **1** (mono) (number)
- `data.bitsPerSample`: **16** (number)
- `data.numberOfFrames`: Number of samples, typically **80 for 10ms frames** (number)
- `data.type`: `"data"` (string)

### Audio Format Requirements:
- **Sample Rate**: 8kHz (8000 Hz) - mono
- **Format**: PCM16 (16-bit signed integer)
- **Frame Size**: 10ms chunks = 80 samples at 8kHz
- **Channels**: Mono (1 channel)

### What Happens:
- ✅ Audio is upsampled from 8kHz → 24kHz
- ✅ Forwarded to OpenAI Realtime API
- ✅ Voice Activity Detection (VAD) processes the audio
- ✅ Agent responds when user stops speaking

---

## 🛑 **3. STOP Event (Call Termination)** ⚠️ **CRITICAL**

**Send this when the call ends** (user hangs up, call disconnects, etc.):

```json
{
  "event": "stop",
  "ucid": "unique-call-id-123",
  "type": "text"
}
```

### Fields:
- `event`: **MUST be `"stop"`** (string)
- `ucid`: Same Call ID from start event (string)
- `type`: `"text"` (string)

### What Happens:
- ✅ Call analytics finalized (duration, Q&A pairs, etc.)
- ✅ **Transcript file saved** to `/data/transcripts/call_{ucid}_{timestamp}_transcript.json`
- ✅ Sales data saved to `/data/calls/call_{ucid}_{timestamp}.json`
- ✅ Queue processor triggered for async data extraction
- ✅ Webhook fired to SingleInterface API
- ✅ OpenAI connection closed gracefully
- ✅ Session cleaned up

### ⚠️ **IMPORTANT**:
If your telephony vendor **does NOT send the `stop` event**, the system will still work BUT:
- Relies on WebSocket `close` event as fallback
- If WebSocket doesn't close properly, transcript may not be saved
- **Solution**: Always send explicit `stop` event before closing WebSocket

---

## 📋 **Complete Call Flow Example**

### **Step 1: Call Starts**
```json
→ Telephony Vendor sends:
{
  "event": "start",
  "ucid": "CALL-2025-10-07-001",
  "type": "text"
}

← Voice Agent responds: (WebSocket stays open)
```

### **Step 2: Audio Streaming (continuous)**
```json
→ Telephony Vendor sends (every 10ms):
{
  "event": "media",
  "type": "media",
  "ucid": "CALL-2025-10-07-001",
  "data": {
    "samples": [/* 80 samples */],
    "sampleRate": 8000,
    "channelCount": 1,
    "bitsPerSample": 16,
    "numberOfFrames": 80,
    "type": "data"
  }
}

← Voice Agent sends back:
{
  "event": "media",
  "type": "media",
  "ucid": "CALL-2025-10-07-001",
  "data": {
    "samples": [/* 80 samples */],
    // ... (agent audio response)
  }
}
```

### **Step 3: Call Ends**
```json
→ Telephony Vendor sends:
{
  "event": "stop",
  "ucid": "CALL-2025-10-07-001",
  "type": "text"
}

← Voice Agent:
- Saves transcript file ✅
- Saves call data ✅
- Closes WebSocket ✅
```

---

## 🔍 **How to Verify Your Integration**

### **Check Logs on GCP VM:**

```bash
# 1. Monitor telephony logs in real-time
pm2 logs voiceagent-telephony

# 2. When call starts, you should see:
[CALL_ID] 🎤 New call started (UCID: ...)
[CALL_ID] Connected to OpenAI Realtime API

# 3. During call, you should see:
[CALL_ID] 📝 Transcription completed: "Gulshan Mehta"
[CALL_ID] 🔍 Starting data extraction from: "Gulshan Mehta"

# 4. When call ends, you MUST see:
[CALL_ID] 🛑 Stop event received from telephony vendor  ← THIS IS KEY!
[CALL_ID] ⏱️ Total call duration: 65432ms (65s)
[CALL_ID] 💾 Saving transcript for async processing...
[CALL_ID] ✅ Transcript saved: call_CALL_ID_1234_transcript.json
```

### **Check Files Created:**

```bash
# 1. Transcript file should exist
ls -lth /opt/voiceagent/data/transcripts/call_*_transcript.json | head -1

# 2. Call data file should exist
ls -lth /opt/voiceagent/data/calls/call_*.json | head -1

# 3. Verify transcript content
cat /opt/voiceagent/data/transcripts/call_*_transcript.json | jq '.conversation | length'
# Should show number of conversation exchanges (e.g., 15)
```

---

## ⚠️ **Common Issues**

### **Issue 1: Transcript File Not Created**

**Symptom**: Logs show conversation but no transcript file
**Cause**: Telephony vendor not sending `stop` event
**Solution**: 
```javascript
// Add this to your telephony vendor integration:
function onCallEnd(callId) {
  websocket.send(JSON.stringify({
    event: 'stop',
    ucid: callId,
    type: 'text'
  }));
}
```

### **Issue 2: WebSocket Closes But No Stop Event**

**Symptom**: Connection drops without proper cleanup
**Cause**: Network issue or improper disconnect
**Solution**: Our system now handles BOTH:
- ✅ `stop` event (preferred)
- ✅ WebSocket `close` event (fallback)

### **Issue 3: Sales Data Shows Undefined**

**Symptom**: Call completes but data fields are empty
**Cause**: Real-time extraction not running
**Solution**: Already fixed in latest hotfix (line 1075)

---

## 📡 **WebSocket Connection Details**

### **Production URL:**
```
wss://ws.singleinterfacews.pragyaa.ai/ws
```

### **Test URL (GCP VM):**
```
wss://your-domain.com/ws
```

### **Connection Protocol:**
1. Open WebSocket connection
2. Send `start` event
3. Stream `media` events (bidirectional)
4. Send `stop` event
5. Wait for WebSocket close confirmation

---

## 🧪 **Testing Your Integration**

### **Manual WebSocket Test:**

```bash
# Install wscat
npm install -g wscat

# Connect to WebSocket
wscat -c wss://ws.singleinterfacews.pragyaa.ai/ws

# Send start event
{"event":"start","ucid":"TEST-001","type":"text"}

# Wait for greeting from agent
# (You'll receive media events with agent audio)

# Send stop event
{"event":"stop","ucid":"TEST-001","type":"text"}

# Connection should close
```

### **Automated Test Script:**

```javascript
const WebSocket = require('ws');

const ws = new WebSocket('wss://ws.singleinterfacews.pragyaa.ai/ws');

ws.on('open', () => {
  console.log('✅ Connected');
  
  // Send start
  ws.send(JSON.stringify({
    event: 'start',
    ucid: 'TEST-' + Date.now(),
    type: 'text'
  }));
  
  // Wait 5 seconds, then stop
  setTimeout(() => {
    ws.send(JSON.stringify({
      event: 'stop',
      ucid: 'TEST-' + Date.now(),
      type: 'text'
    }));
  }, 5000);
});

ws.on('message', (data) => {
  console.log('← Received:', data.toString().substring(0, 100));
});

ws.on('close', () => {
  console.log('✅ Connection closed');
});
```

---

## 📞 **Support**

If you're still having issues:

1. **Enable verbose logging** on your telephony vendor side
2. **Capture WebSocket traffic** using browser DevTools or Wireshark
3. **Share logs** with us:
   - Your telephony vendor's sent messages
   - Our server's response logs (`pm2 logs voiceagent-telephony`)
4. **Contact**: gulshan@pragyaa.ai

---

## ✅ **Integration Checklist**

- [ ] Telephony vendor sends `start` event with unique `ucid`
- [ ] Telephony vendor streams `media` events at 8kHz, PCM16, mono
- [ ] Telephony vendor receives and plays `media` events from agent
- [ ] **Telephony vendor sends `stop` event when call ends** ⚠️ CRITICAL
- [ ] Transcript files are created in `/data/transcripts/`
- [ ] Call data files are created in `/data/calls/`
- [ ] Sales data shows correctly (not undefined)
- [ ] Admin dashboard displays call records

---

**Last Updated**: October 7, 2025  
**Version**: v4.3.0 + Hotfix


