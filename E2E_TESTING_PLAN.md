# 🧪 End-to-End Testing Plan
## Single Interface Voice Agent with Webhook Integration

---

## 📋 **Test Environment Setup**

### **Prerequisites**
- GCP VM with all services deployed (v4.4.3)
- Test phone number for Ozonetel integration
- Webhook endpoints configured for testing
- Access to logs and data directories

### **Required Services Running**
```bash
# Verify all services are running
pm2 status

# Expected services:
# ├── voiceagent-next (Next.js UI - Port 3000)
# ├── voiceagent-telephony (WebSocket - Port 8080) 
# ├── voiceagent-queue-processor (Background processing)
# └── FastAPI main.py (XML endpoint - Port 8000)
```

---

## 🎯 **Test Plan Structure**

### **Phase 1: Infrastructure Tests** ⚙️
### **Phase 2: Individual Component Tests** 🔧  
### **Phase 3: Integration Tests** 🔗
### **Phase 4: End-to-End Call Tests** 📞
### **Phase 5: Webhook Validation** 📡
### **Phase 6: Data Quality Validation** 📊

---

## ⚙️ **Phase 1: Infrastructure Tests**

### **1.1 Service Health Checks**
```bash
# Test 1: Check PM2 services
pm2 status
# ✅ Expected: All services "online" with uptime > 0

# Test 2: Check port availability  
sudo netstat -tlnp | grep -E ':(3000|8000|8080)'
# ✅ Expected: All three ports listening

# Test 3: Check disk space for data directories
df -h /opt/voiceagent/data
# ✅ Expected: Sufficient space available

# Test 4: Check log files are writable
ls -la /opt/voiceagent/data/
# ✅ Expected: All directories exist with correct permissions
```

### **1.2 Network Connectivity**
```bash
# Test 5: External SSL certificates
curl -I https://singleinterfacews.pragyaa.ai
curl -I https://ws-singleinterfacews.pragyaa.ai
# ✅ Expected: 200 OK responses

# Test 6: OpenAI API connectivity
curl -H "Authorization: Bearer $OPENAI_API_KEY" \
     https://api.openai.com/v1/models | jq '.data[0].id'
# ✅ Expected: Valid model response (gpt-realtime or similar)
```

---

## 🔧 **Phase 2: Individual Component Tests**

### **2.1 FastAPI Service (main.py)**
```bash
# Test 7: Basic XML endpoint
curl -s "http://localhost:8000/getXML_SI/?event=NewCall&cid=test123&sid=test456"
# ✅ Expected: XML response with WebSocket URL

# Test 8: Parameter handling
curl -s "http://localhost:8000/getXML_SI/?event=NewCall&outbound_sid=999&cid=111"
# ✅ Expected: XML with correct SID value

# Test 9: Error handling
curl -s "http://localhost:8000/invalid-endpoint"
# ✅ Expected: 404 or appropriate error response
```

### **2.2 WebSocket Service (Node.js)**
```bash
# Test 10: WebSocket connectivity
# Install wscat if not available: npm install -g wscat
wscat -c ws://localhost:8080/ws

# Send test message:
{"event":"start","type":"media","ucid":"test-123"}
# ✅ Expected: Connection successful, no immediate errors

# Test 11: Path validation
wscat -c ws://localhost:8080/invalid-path
# ✅ Expected: Connection refused or 404
```

### **2.3 Next.js Application**
```bash
# Test 12: Application health
curl http://localhost:3000
# ✅ Expected: HTML response (Next.js app)

# Test 13: Webhook endpoints
curl -X GET https://singleinterfacews.pragyaa.ai/api/webhooks/telephony
curl -X GET https://singleinterfacews.pragyaa.ai/api/webhooks/singleinterface
# ✅ Expected: 200 OK with success message
```

### **2.4 Queue Processor**
```bash
# Test 14: Check if processor is running
pm2 logs voiceagent-queue-processor --lines 10
# ✅ Expected: Recent activity logs, no errors

# Test 15: Create test queue file
cat > /opt/voiceagent/data/processing/test_queue.json << 'EOF'
{
  "call_id": "test_12345",
  "status": "pending",
  "transcript_file": "test_transcript.json",
  "created_at": "2025-09-30T10:00:00Z"
}
EOF

# Check if file gets processed within 30 seconds
watch -n 5 "ls -la /opt/voiceagent/data/processing/test_*"
# ✅ Expected: File disappears as it gets processed
```

---

## 🔗 **Phase 3: Integration Tests**

### **3.1 XML to WebSocket Flow**
```bash
# Test 16: Complete Ozonetel simulation
# Step 1: Call XML endpoint
XML_RESPONSE=$(curl -s "http://localhost:8000/getXML_SI/?event=NewCall&cid=test123&sid=test456")
echo "$XML_RESPONSE"

# Step 2: Extract WebSocket URL from XML
WS_URL=$(echo "$XML_RESPONSE" | grep -o "wss://[^']*")
echo "WebSocket URL: $WS_URL"

# Step 3: Test WebSocket connection
wscat -c "$WS_URL"
# ✅ Expected: Successful connection to extracted URL
```

### **3.2 Transcript to Queue Flow**
```bash
# Test 17: Create test transcript
cat > /opt/voiceagent/data/transcripts/test_transcript_12345.json << 'EOF'
{
  "call_id": "test_12345",
  "call_start_time": "2025-09-30T10:00:00Z",
  "call_end_time": "2025-09-30T10:05:00Z",
  "conversation": [
    {
      "timestamp": "2025-09-30T10:01:00Z",
      "speaker": "user",
      "text": "Hello, my name is John Smith"
    },
    {
      "timestamp": "2025-09-30T10:01:30Z", 
      "speaker": "assistant",
      "text": "Thank you John. Which car model interests you?"
    },
    {
      "timestamp": "2025-09-30T10:02:00Z",
      "speaker": "user", 
      "text": "I'm interested in XUV700"
    },
    {
      "timestamp": "2025-09-30T10:02:30Z",
      "speaker": "assistant",
      "text": "Great! Could you share your email address?"
    },
    {
      "timestamp": "2025-09-30T10:03:00Z",
      "speaker": "user",
      "text": "It's john.smith@gmail.com"
    }
  ],
  "simple_transcripts": ["Hello, my name is John Smith", "I'm interested in XUV700", "It's john.smith@gmail.com"]
}
EOF

# Create corresponding queue entry
cat > /opt/voiceagent/data/processing/queue_test_12345.json << 'EOF'
{
  "call_id": "test_12345",
  "status": "pending",
  "transcript_file": "test_transcript_12345.json",
  "created_at": "2025-09-30T10:00:00Z"
}
EOF

# Monitor processing
echo "Watching for results..."
timeout 60 bash -c 'while [ ! -f /opt/voiceagent/data/results/result_test_12345.json ]; do sleep 2; done'

# Check results
if [ -f /opt/voiceagent/data/results/result_test_12345.json ]; then
    echo "✅ Result file created"
    cat /opt/voiceagent/data/results/result_test_12345.json | jq '.extracted_data'
else
    echo "❌ Result file not created within timeout"
fi
```

---

## 📞 **Phase 4: End-to-End Call Tests**

### **4.1 Complete Call Scenario Test**

**Test 18: Full Data Collection Call**
```bash
# Preparation
echo "📞 Starting end-to-end call test..."
echo "Call Ozonetel test number and follow this script:"

# Expected call flow:
# 1. Agent: "Namaskar... Welcome to Dee Emm Mahindra dealer. How may I help you today?"
# 2. User: "I'm interested in buying a car"
# 3. Agent: "May I know your name please?"
# 4. User: "My name is John Smith"
# 5. Agent: "Which Mahindra car model are you interested in?"
# 6. User: "XUV700"
# 7. Agent: "Could you share your email address?"
# 8. User: "john.smith@gmail.com"
# 9. Agent: "Thank you... We will connect you with the dealer..."

# Monitor call in real-time
echo "Monitor logs during call:"
pm2 logs voiceagent-telephony --lines 0 &
PM2_LOG_PID=$!

echo "Make your test call now. Press Enter when call is complete..."
read

# Stop log monitoring
kill $PM2_LOG_PID

# Check if files were created
echo "Checking for call files..."
LATEST_TRANSCRIPT=$(ls -t /opt/voiceagent/data/transcripts/call_*.json 2>/dev/null | head -1)
LATEST_QUEUE=$(ls -t /opt/voiceagent/data/processing/call_*.json 2>/dev/null | head -1)

if [ -n "$LATEST_TRANSCRIPT" ]; then
    echo "✅ Transcript created: $LATEST_TRANSCRIPT"
    CALL_ID=$(basename "$LATEST_TRANSCRIPT" | sed 's/call_\(.*\)_.*\.json/\1/')
    echo "Call ID: $CALL_ID"
else
    echo "❌ No transcript file found"
    exit 1
fi

# Wait for queue processing
echo "Waiting for queue processing..."
timeout 120 bash -c "while [ ! -f /opt/voiceagent/data/results/result_${CALL_ID}_*.json ]; do sleep 3; done"

LATEST_RESULT=$(ls -t /opt/voiceagent/data/results/result_${CALL_ID}_*.json 2>/dev/null | head -1)
if [ -n "$LATEST_RESULT" ]; then
    echo "✅ Result created: $LATEST_RESULT"
else
    echo "❌ No result file found within timeout"
    exit 1
fi
```

### **4.2 Partial Data Call Test**

**Test 19: Partial Data Collection**
```bash
# Call script for partial data:
# 1. Agent: "Namaskar... Welcome to Dee Emm Mahindra dealer..."
# 2. User: "Hi, I'm interested in cars"
# 3. Agent: "May I know your name?"
# 4. User: "My name is Jane Doe"
# 5. Agent: "Which Mahindra model interests you?"
# 6. User: "Hang up before answering"

# Expected result: Only name should be captured
```

### **4.3 No Data Call Test**

**Test 20: Early Hangup**
```bash
# Call script:
# 1. Agent: "Namaskar... Welcome to Dee Emm Mahindra dealer..."
# 2. User: "Hang up immediately"

# Expected result: No data captured, but call logged
```

---

## 📡 **Phase 5: Webhook Validation**

### **5.1 Webhook Endpoint Tests**
```bash
# Test 21: Telephony webhook endpoint
curl -X POST https://singleinterfacews.pragyaa.ai/api/webhooks/telephony \
  -H "Content-Type: application/json" \
  -d '{
    "call_id": "test_webhook_123",
    "processed_at": "2025-09-30T10:00:00Z",
    "success": true,
    "overall_status": "complete"
  }'
# ✅ Expected: {"success":true,"message":"Telephony webhook processed successfully"}

# Test 22: Single Interface webhook endpoint  
curl -X POST https://singleinterfacws.pragyaa.ai/api/webhooks/singleinterface \
  -H "Content-Type: application/json" \
  -d '{
    "id": "bot_test_webhook_123",
    "call_ref_id": "test_webhook_123",
    "call_vendor": "Ozonetel",
    "start_time": "2025-09-30 10:00:00",
    "end_time": "2025-09-30 10:05:00",
    "duration": 300
  }'
# ✅ Expected: {"success":true,"message":"Single Interface webhook processed successfully"}
```

### **5.2 Real Call Webhook Delivery**
```bash
# Test 23: Monitor webhook delivery after real call
echo "After making a test call, monitor webhook delivery:"

# Watch queue processor logs for webhook activity
pm2 logs voiceagent-queue-processor --lines 0 | grep -E "webhook|📞|🎯|📡"

# Look for these patterns:
# 🚀 Processing webhooks for call: [CALL_ID]
# 📞 Telephony webhook delivered successfully
# 🎯 Single Interface webhook delivered successfully  
# 📡 Webhook summary: 2 delivered, 0 failed
```

### **5.3 Webhook Payload Validation**
```bash
# Test 24: Capture and validate webhook payloads
# Set up a simple webhook receiver for testing

# Create test webhook receiver
node -e "
const http = require('http');
const server = http.createServer((req, res) => {
  if (req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      console.log('Webhook received:', JSON.stringify(JSON.parse(body), null, 2));
      res.writeHead(200, {'Content-Type': 'application/json'});
      res.end('{\"status\":\"received\"}');
    });
  }
});
server.listen(9999, () => console.log('Test webhook server running on port 9999'));
" &

WEBHOOK_SERVER_PID=$!

# Update .env temporarily to point to test server
echo "Update TELEPHONY_WEBHOOK_URL to http://localhost:9999/telephony in .env"
echo "Update SINGLEINTERFACE_WEBHOOK_URL to http://localhost:9999/singleinterface in .env" 
echo "Restart queue processor and make a test call"

# Cleanup
read -p "Press Enter when testing complete..."
kill $WEBHOOK_SERVER_PID
```

---

## 📊 **Phase 6: Data Quality Validation**

### **6.1 Data Extraction Accuracy**
```bash
# Test 25: Validate extracted data quality
LATEST_RESULT=$(ls -t /opt/voiceagent/data/results/result_*.json 2>/dev/null | head -1)

if [ -n "$LATEST_RESULT" ]; then
    echo "Analyzing data quality for: $LATEST_RESULT"
    
    # Check extracted data fields
    cat "$LATEST_RESULT" | jq '{
      call_id: .call_id,
      success: .success,
      extracted_data: .extracted_data | {
        full_name: .full_name,
        car_model: .car_model, 
        email_id: .email_id,
        confidence_scores: .confidence_scores,
        overall_status: .overall_status
      },
      data_points: .extracted_data.data_points | {
        full_name: .full_name | {value: .value, status: .status, confidence: .confidence},
        car_model: .car_model | {value: .value, status: .status, confidence: .confidence},
        email_id: .email_id | {value: .value, status: .status, confidence: .confidence}
      }
    }'
    
    # Validate data point statuses
    echo "Data point validation:"
    cat "$LATEST_RESULT" | jq -r '.extracted_data.data_points | to_entries[] | "\(.key): \(.value.status) (confidence: \(.value.confidence))"'
    
else
    echo "❌ No result files available for validation"
fi
```

### **6.2 Timestamp Accuracy**
```bash
# Test 26: Validate timestamp data
echo "Checking timestamp accuracy..."

LATEST_RESULT=$(ls -t /opt/voiceagent/data/results/result_*.json 2>/dev/null | head -1)
if [ -n "$LATEST_RESULT" ]; then
    echo "Call analytics timeline:"
    cat "$LATEST_RESULT" | jq '{
      call_start: .call_analytics.call_start_time,
      call_end: .call_analytics.call_end_time,
      duration: .call_analytics.call_length,
      exchanges: .call_analytics.total_exchanges,
      qa_pairs: .call_analytics.question_answer_pairs | length
    }'
    
    echo "Individual data point timestamps:"
    cat "$LATEST_RESULT" | jq '.extracted_data.data_points | to_entries[] | select(.value.timestamps | length > 0) | {
      field: .key,
      timestamps: .value.timestamps
    }'
fi
```

---

## 🎯 **Test Results Summary Template**

### **Test Execution Checklist**
```
Infrastructure Tests:
□ Service health checks (1.1)
□ Network connectivity (1.2)

Component Tests:
□ FastAPI service (2.1) 
□ WebSocket service (2.2)
□ Next.js application (2.3)
□ Queue processor (2.4)

Integration Tests:
□ XML to WebSocket flow (3.1)
□ Transcript to queue flow (3.2)

End-to-End Tests:
□ Complete call scenario (4.1)
□ Partial data call (4.2) 
□ No data call (4.3)

Webhook Tests:
□ Endpoint functionality (5.1)
□ Real call delivery (5.2)
□ Payload validation (5.3)

Data Quality Tests:
□ Extraction accuracy (6.1)
□ Timestamp accuracy (6.2)
```

### **Performance Benchmarks**
```
Target Metrics:
□ Call setup time: < 3 seconds
□ Agent response time: < 2 seconds
□ Queue processing time: < 30 seconds
□ Webhook delivery time: < 10 seconds
□ Data accuracy: > 95% for clear speech
□ System uptime: > 99.9%
```

### **Known Issues & Workarounds**
```
Common Issues:
1. FastAPI service not running
   → Solution: /home/info/getXML/start.sh

2. Empty data extraction
   → Check: Queue processor logs and OpenAI API key

3. Webhook delivery failures  
   → Check: Network connectivity and endpoint URLs

4. SSL certificate issues
   → Check: Certbot renewal and domain DNS
```

---

## 🚨 **Emergency Rollback Plan**

If critical issues are found:

```bash
# 1. Stop all services
pm2 stop all

# 2. Rollback to previous version
cd /opt/voiceagent
git checkout v4.4.2  # or last known good version

# 3. Rebuild and restart
npm ci
npm run build
pm2 restart all

# 4. Verify rollback success
pm2 status
curl http://localhost:3000
```

---

**This comprehensive testing plan ensures all components work correctly and data flows properly through the entire system to webhooks! 🎉**

