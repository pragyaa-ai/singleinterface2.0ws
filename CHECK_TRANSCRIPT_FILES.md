# 🔍 How to Check Today's Transcript Files

## SSH to Your GCP VM First

```bash
gcloud compute ssh your-vm-name --zone=your-zone
```

---

## 📋 Commands to Check Transcript Files

### 1. List Only Today's Transcript Files

```bash
# List today's transcripts sorted by time (newest first)
ls -lth /opt/voiceagent/data/transcripts/call_*_$(date +%Y%m%d)*.json 2>/dev/null | head -10

# Or if files have different naming, just show all recent ones
ls -lth /opt/voiceagent/data/transcripts/*.json | head -10
```

**Look for:** File size - should NOT be 0 bytes

---

### 2. Count Today's Transcript Files

```bash
# Count transcripts from today
find /opt/voiceagent/data/transcripts -name "*.json" -newermt "today" | wc -l
```

---

### 3. View Most Recent Transcript File

```bash
# Show most recent transcript file
ls -t /opt/voiceagent/data/transcripts/*.json | head -1 | xargs cat | jq '.'
```

**What to look for:**
- `conversation`: Array of exchanges
- `simple_transcripts`: Array of user inputs
- `current_sales_data`: Should have captured data
- `analytics`: Call statistics

---

### 4. Check if Files are Empty

```bash
# Find empty transcript files from today
find /opt/voiceagent/data/transcripts -name "*.json" -newermt "today" -size 0
```

If this returns files, they're **empty** (0 bytes)!

---

### 5. Check Specific Call Transcript

From your logs, the call ID was: `9tSEponTlSZHK9dBIZ_7z`

```bash
# Find transcript for specific call
ls -lh /opt/voiceagent/data/transcripts/call_9tSEponTlSZHK9dBIZ_7z*.json

# View its contents
cat /opt/voiceagent/data/transcripts/call_9tSEponTlSZHK9dBIZ_7z*.json | jq '.'
```

---

### 6. Check Conversation Details in Transcript

```bash
# Check conversation array
cat /opt/voiceagent/data/transcripts/call_9tSEponTlSZHK9dBIZ_7z*.json | jq '.conversation'

# Check simple transcripts
cat /opt/voiceagent/data/transcripts/call_9tSEponTlSZHK9dBIZ_7z*.json | jq '.simple_transcripts'

# Check if current_sales_data exists
cat /opt/voiceagent/data/transcripts/call_9tSEponTlSZHK9dBIZ_7z*.json | jq '.current_sales_data'
```

---

## 🔍 What Each Field Should Contain

### Expected Transcript Structure:

```json
{
  "call_id": "9tSEponTlSZHK9dBIZ_7z",
  "timestamp": "2025-01-07T...",
  "call_start_time": 1759916133128,
  "call_end_time": 1759916215009,
  "call_duration": 81881,
  
  // THIS IS KEY - Your conversation should be here!
  "conversation": [
    {
      "timestamp": "2025-01-07T10:30:45.123Z",
      "speaker": "assistant",
      "text": "Namaskar... Welcome to Dee Emm Mahindra dealer...",
      "confidence": 0.9,
      "event_type": "assistant_response"
    },
    {
      "timestamp": "2025-01-07T10:30:50.456Z",
      "speaker": "user",
      "text": "Scorpio",
      "confidence": 0.9,
      "event_type": "transcription_completed"
    },
    // ... more exchanges
  ],
  
  // Backward compatibility
  "simple_transcripts": [
    "Yes.",
    "بلش مهبا",
    "Yes.",
    "gulshan.mehta at gmail.com",
    "Yes.",
    "Hello."
  ],
  
  "current_sales_data": {
    "full_name": null,
    "car_model": null,
    "email_id": null,
    "verified_fields": [],
    "processing_status": "pending"
  },
  
  "analytics": {
    "total_exchanges": 16,
    "user_messages": 8,
    "assistant_messages": 8,
    "question_answer_pairs": 0,
    "parameters_attempted": [],
    "parameters_captured": []
  }
}
```

---

## 🐛 Common Issues & Diagnosis

### Issue 1: File is Empty (0 bytes)

```bash
# Check file size
ls -lh /opt/voiceagent/data/transcripts/call_9tSEponTlSZHK9dBIZ_7z*.json
# If shows "0" in size column = EMPTY!
```

**Cause:** `saveTranscriptForProcessing()` function failed to write

**Check logs for errors:**
```bash
pm2 logs voiceagent-telephony | grep -A 5 "Failed to save transcript"
```

---

### Issue 2: File Exists but conversation[] is Empty

```bash
# Check conversation array
cat /opt/voiceagent/data/transcripts/call_9tSEponTlSZHK9dBIZ_7z*.json | jq '.conversation | length'
# If returns 0 = No conversation data!
```

**Cause:** `session.fullTranscript` was empty when file was saved

**Check:** Did transcription events complete before file was saved?

---

### Issue 3: simple_transcripts[] is Empty

```bash
# Check simple transcripts
cat /opt/voiceagent/data/transcripts/call_9tSEponTlSZHK9dBIZ_7z*.json | jq '.simple_transcripts | length'
# If returns 0 = No transcripts!
```

**Cause:** `session.transcripts` was empty

---

### Issue 4: File Has Data but Results File is Empty

```bash
# Check if results file exists
ls -lh /opt/voiceagent/data/results/call_9tSEponTlSZHK9dBIZ_7z*.json

# View results file
cat /opt/voiceagent/data/results/call_9tSEponTlSZHK9dBIZ_7z*.json | jq '.'
```

**Cause:** Queue processor hasn't run yet or failed

**Check queue processor logs:**
```bash
# Check if queue entry was created
ls -lh /opt/voiceagent/data/processing/call_9tSEponTlSZHK9dBIZ_7z*.json

# Check queue processor logs
pm2 logs | grep "queue\|processor"
```

---

## 🔎 Diagnostic Script

Run this to get full diagnosis:

```bash
#!/bin/bash
CALL_ID="9tSEponTlSZHK9dBIZ_7z"

echo "=== DIAGNOSTIC REPORT FOR CALL: $CALL_ID ==="
echo ""

echo "1. Transcript File:"
TRANSCRIPT=$(ls /opt/voiceagent/data/transcripts/call_${CALL_ID}*.json 2>/dev/null | head -1)
if [ -f "$TRANSCRIPT" ]; then
  echo "   Found: $TRANSCRIPT"
  echo "   Size: $(ls -lh $TRANSCRIPT | awk '{print $5}')"
  echo "   Conversation count: $(cat $TRANSCRIPT | jq '.conversation | length')"
  echo "   Simple transcripts count: $(cat $TRANSCRIPT | jq '.simple_transcripts | length')"
else
  echo "   ❌ NOT FOUND!"
fi
echo ""

echo "2. Queue Entry:"
QUEUE=$(ls /opt/voiceagent/data/processing/call_${CALL_ID}*.json 2>/dev/null | head -1)
if [ -f "$QUEUE" ]; then
  echo "   Found: $QUEUE"
  echo "   Status: $(cat $QUEUE | jq -r '.status')"
else
  echo "   ❌ NOT FOUND!"
fi
echo ""

echo "3. Results File:"
RESULTS=$(ls /opt/voiceagent/data/results/call_${CALL_ID}*.json 2>/dev/null | head -1)
if [ -f "$RESULTS" ]; then
  echo "   Found: $RESULTS"
  echo "   Extracted name: $(cat $RESULTS | jq -r '.extracted_data.full_name')"
  echo "   Extracted car: $(cat $RESULTS | jq -r '.extracted_data.car_model')"
  echo "   Extracted email: $(cat $RESULTS | jq -r '.extracted_data.email_id')"
else
  echo "   ❌ NOT FOUND!"
fi
echo ""

echo "4. Call Data File:"
CALLDATA=$(ls /opt/voiceagent/data/calls/call_${CALL_ID}*.json 2>/dev/null | head -1)
if [ -f "$CALLDATA" ]; then
  echo "   Found: $CALLDATA"
  echo "   Status: $(cat $CALLDATA | jq -r '.salesData.status')"
else
  echo "   ❌ NOT FOUND!"
fi
```

Save as `check_call.sh`, make executable, and run:
```bash
chmod +x check_call.sh
./check_call.sh
```

---

## 📊 Compare With Working Call

Check an Ozonetel call that worked:

```bash
# List recent Ozonetel calls
ls -lth /opt/voiceagent/data/transcripts/*.json | grep -v "9tSEponTlSZHK9dBIZ_7z" | head -5

# Pick a working one and view it
cat /opt/voiceagent/data/transcripts/call_WORKING_CALL_ID*.json | jq '.conversation | length'
```

Compare structure with problematic Waybeo call.

---

## 🚨 If Files are Empty or Missing Data

### Check These:

1. **Permissions:**
```bash
ls -ld /opt/voiceagent/data/transcripts/
# Should be writable by the user running PM2
```

2. **Disk Space:**
```bash
df -h /opt/voiceagent/
# Should have free space
```

3. **Recent Errors:**
```bash
pm2 logs voiceagent-telephony --err | tail -50
```

4. **Session State at Save Time:**
```bash
# Look for these logs
pm2 logs voiceagent-telephony | grep "9tSEponTlSZHK9dBIZ_7z" | grep -E "Rich transcript entries|Saving transcript"
```

The logs should show:
```
[9tSEponTlSZHK9dBIZ_7z] 📋 Rich transcript entries: 16    ← Should be > 0!
[9tSEponTlSZHK9dBIZ_7z] 💾 Saving transcript...
[9tSEponTlSZHK9dBIZ_7z] ✅ Transcript saved: call_...json
```

If "Rich transcript entries: 0", that's the problem!

---

## 🎯 Quick Check for Your Call

```bash
# Replace with your actual call ID
CALL_ID="9tSEponTlSZHK9dBIZ_7z"

# 1. Does file exist?
ls -lh /opt/voiceagent/data/transcripts/call_${CALL_ID}*.json

# 2. Is it empty?
cat /opt/voiceagent/data/transcripts/call_${CALL_ID}*.json | jq '.' | head -20

# 3. How many conversation entries?
cat /opt/voiceagent/data/transcripts/call_${CALL_ID}*.json | jq '.conversation | length'

# 4. Show first few conversation entries
cat /opt/voiceagent/data/transcripts/call_${CALL_ID}*.json | jq '.conversation[0:3]'
```

---

Share the output of these commands and I can help diagnose the exact issue!

