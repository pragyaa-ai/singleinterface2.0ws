# 🔍 How to Verify START Event is Received Correctly

## Quick Check Commands

### **Method 1: Real-time Monitoring (Recommended)**

```bash
# SSH to GCP VM
gcloud compute ssh your-vm-name --zone=your-zone

# Monitor logs in real-time
pm2 logs voiceagent-telephony --lines 0
```

Then make a test call. You should see:

```
================================================================================
[CALL_ID] 🎬 START EVENT RECEIVED from telephony vendor
[CALL_ID] 📞 Call ID (UCID): tywTCdIB_zE84Oj48tn8Z
[CALL_ID] 📋 Full message: {
  "event": "start",
  "ucid": "tywTCdIB_zE84Oj48tn8Z",
  "type": "text"
}
================================================================================

[CALL_ID] 🔌 Initializing OpenAI connection...
[CALL_ID] ✅ OpenAI connection established successfully
[CALL_ID] Connected to OpenAI Realtime API with VoiceAgent Mini
[CALL_ID] 💾 Session stored in memory (Total active sessions: 1)
[CALL_ID] 🚀 Voice agent ready - waiting for audio stream...
```

---

### **Method 2: Grep for Start Events**

```bash
# Check recent start events
pm2 logs voiceagent-telephony --lines 200 | grep "START EVENT"

# Expected output:
[CALL_ID_1] 🎬 START EVENT RECEIVED from telephony vendor
[CALL_ID_2] 🎬 START EVENT RECEIVED from telephony vendor
[CALL_ID_3] 🎬 START EVENT RECEIVED from telephony vendor
```

---

### **Method 3: Count Active Sessions**

```bash
# Check how many sessions were created
pm2 logs voiceagent-telephony --lines 200 | grep "Total active sessions"

# Expected output:
[CALL_ID] 💾 Session stored in memory (Total active sessions: 1)
[CALL_ID] 💾 Session stored in memory (Total active sessions: 2)
```

---

### **Method 4: Check Full Start Message**

```bash
# View the full JSON message received
pm2 logs voiceagent-telephony --lines 200 | grep -A 5 "Full message"

# Expected output shows the complete start event:
[CALL_ID] 📋 Full message: {
  "event": "start",
  "ucid": "unique-call-id-123",
  "type": "text"
}
```

---

## 🎯 What to Look For

### ✅ **Success Indicators:**

1. **START EVENT RECEIVED** - Confirms telephony vendor sent the message
2. **Call ID (UCID)** - Shows unique call identifier
3. **OpenAI connection established** - Successfully connected to AI
4. **Session stored in memory** - Session created and tracked
5. **Voice agent ready** - System ready to receive audio

### ❌ **Failure Indicators:**

```bash
# If you see this, start event has issues:
[CALL_ID] ❌ START EVENT FAILED - Could not initialize session
[CALL_ID] Error details: ...
```

**Common causes:**
- Missing OPENAI_API_KEY
- Invalid API key
- Network connectivity issues
- OpenAI API down

---

## 🧪 Test Scenarios

### **Scenario 1: Normal Start Event**

**Send:**
```json
{"event": "start", "ucid": "TEST-001", "type": "text"}
```

**Expected Logs:**
```
[TEST-001] 🎬 START EVENT RECEIVED from telephony vendor
[TEST-001] 📞 Call ID (UCID): TEST-001
[TEST-001] ✅ OpenAI connection established successfully
[TEST-001] 🚀 Voice agent ready - waiting for audio stream...
```

---

### **Scenario 2: Missing UCID**

**Send:**
```json
{"event": "start", "type": "text"}
```

**Expected Logs:**
```
[] 🎬 START EVENT RECEIVED from telephony vendor
[] 📞 Call ID (UCID): 
[] ❌ START EVENT FAILED - Could not initialize session
```

**Action**: Ensure your telephony vendor always includes `ucid` field

---

### **Scenario 3: Duplicate Start Event (Same UCID)**

**Send twice:**
```json
{"event": "start", "ucid": "TEST-001", "type": "text"}
{"event": "start", "ucid": "TEST-001", "type": "text"}
```

**Expected Behavior:**
- First start: Creates new session
- Second start: Overwrites existing session (not ideal!)

**Best Practice**: Use unique UCIDs for each call

---

## 📊 Verification Checklist

After making a test call, verify:

- [ ] **START EVENT RECEIVED** appears in logs
- [ ] **Call ID (UCID)** is present and not empty
- [ ] **Full message** shows valid JSON with `event: "start"`
- [ ] **OpenAI connection established** successfully
- [ ] **Session stored in memory** with count incremented
- [ ] **Voice agent ready** message appears
- [ ] **No error messages** about failed initialization

---

## 🐛 Troubleshooting

### **Issue: No START EVENT log appears**

**Possible causes:**
1. Telephony vendor not sending start event
2. WebSocket not connected
3. Wrong WebSocket URL

**Debug steps:**
```bash
# Check if WebSocket server is running
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" \
  http://localhost:8080/

# Check if port 8080 is listening
netstat -tulpn | grep 8080

# Check telephony service status
pm2 status voiceagent-telephony
```

---

### **Issue: START EVENT received but fails**

**Possible causes:**
1. Missing OPENAI_API_KEY
2. Invalid API key
3. OpenAI API quota exceeded

**Debug steps:**
```bash
# Check environment variable
cd /opt/voiceagent
cat .env | grep OPENAI_API_KEY

# Test OpenAI connection manually
node test_openai_connection.js

# Check OpenAI API status
curl https://status.openai.com/api/v2/status.json
```

---

### **Issue: Empty UCID in logs**

**Logs show:**
```
[] 🎬 START EVENT RECEIVED from telephony vendor
[] 📞 Call ID (UCID): 
```

**Fix:** Tell telephony vendor to include `ucid` field:
```json
{
  "event": "start",
  "ucid": "MUST_INCLUDE_THIS",  ← Required!
  "type": "text"
}
```

---

## 📈 Performance Monitoring

### **Track Start Event Success Rate:**

```bash
# Count successful starts
pm2 logs voiceagent-telephony --lines 1000 | \
  grep "START EVENT RECEIVED" | wc -l

# Count failed starts
pm2 logs voiceagent-telephony --lines 1000 | \
  grep "START EVENT FAILED" | wc -l

# Calculate success rate
# Success Rate = (Successful / (Successful + Failed)) * 100%
```

### **Monitor Session Creation Time:**

```bash
# Time between START EVENT and "Voice agent ready"
pm2 logs voiceagent-telephony --lines 50 --timestamp | \
  grep -E "START EVENT|Voice agent ready"

# Typical time: 200-500ms
```

---

## 🔧 Advanced Debugging

### **Enable WebSocket Message Tracing:**

Add temporary logging to see ALL incoming messages:

```bash
# Edit telephony service (temporary)
nano /opt/voiceagent/src/server/telephony/index.ts

# Find line: ws.on('message', async (data) => {
# Add after it:
console.log('🔍 RAW WebSocket message:', data.toString());

# Restart service
pm2 restart voiceagent-telephony

# Make test call
pm2 logs voiceagent-telephony

# Remove debugging after testing!
```

---

### **Capture WebSocket Traffic:**

```bash
# Install tcpdump (if not installed)
sudo apt install tcpdump

# Capture WebSocket traffic on port 8080
sudo tcpdump -i any -A 'tcp port 8080' -w /tmp/websocket.pcap

# Make test call

# Stop capture (Ctrl+C)

# Analyze capture
tcpdump -A -r /tmp/websocket.pcap | grep -A 20 "start"
```

---

## ✅ Expected Flow (Complete)

```
1. Telephony Vendor → {"event": "start", "ucid": "123", "type": "text"}
   ↓
2. Voice Agent Logs:
   ================================================================================
   [123] 🎬 START EVENT RECEIVED from telephony vendor
   [123] 📞 Call ID (UCID): 123
   [123] 📋 Full message: {"event":"start","ucid":"123","type":"text"}
   ================================================================================
   
   [123] 🔌 Initializing OpenAI connection...
   [123] ✅ OpenAI connection established successfully
   [123] Connected to OpenAI Realtime API with VoiceAgent Mini
   [123] 💾 Session stored in memory (Total active sessions: 1)
   [123] 🚀 Voice agent ready - waiting for audio stream...
   ↓
3. Ready to receive media events!
```

---

## 📞 Support

If start events are still not working:

1. **Share logs:**
   ```bash
   pm2 logs voiceagent-telephony --lines 100 > /tmp/logs.txt
   ```

2. **Share WebSocket message from vendor:**
   - Enable logging on vendor side
   - Copy the exact JSON being sent

3. **Contact:** gulshan@pragyaa.ai

---

**Last Updated:** October 7, 2025  
**Version:** v4.3.0 + Enhanced Logging


