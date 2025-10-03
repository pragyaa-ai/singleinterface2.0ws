# 🔍 How to Verify Webhook Data is Being Published

This guide shows you how to verify that call data is correctly being sent to the SingleInterface webhook after each call.

---

## 📊 **Method 1: Monitor Queue Processor Logs (RECOMMENDED)**

The queue processor logs show webhook activity in real-time.

### **On GCP VM:**

```bash
# Watch logs in real-time
pm2 logs voiceagent-queue-processor --lines 50

# Filter for webhook-specific logs
pm2 logs voiceagent-queue-processor --lines 100 | grep -i webhook

# Search for specific call ID
pm2 logs voiceagent-queue-processor --lines 200 | grep "18882175837982271"
```

### **What to Look For:**

```
[CALL_ID] 🚀 Processing webhooks...
[CALL_ID] 🎯 Single Interface webhook delivered successfully: 200
[CALL_ID] 📊 Delivered: 3 data points, duration: 150s
[CALL_ID] 📡 Webhook summary: 2 delivered, 0 failed
```

**Success Indicators:**
- ✅ `webhook delivered successfully: 200` (HTTP 200 = success)
- ✅ `Delivered: X data points` shows how many fields were sent
- ✅ `2 delivered, 0 failed` means both webhooks worked

**Error Indicators:**
- ❌ `Single Interface webhook failed:` followed by error message
- ❌ `Webhook summary: 1 delivered, 1 failed`

---

## 📂 **Method 2: Check Results Files**

Every processed call creates a result file that contains the exact data sent to webhooks.

### **On GCP VM:**

```bash
# List recent result files
ls -lht /opt/voiceagent/data/results/ | head -10

# View the most recent result
cat $(ls -t /opt/voiceagent/data/results/*.json | head -1) | jq .

# View specific call result
cat /opt/voiceagent/data/results/call_18882175837982271_*.json | jq .
```

### **On Local Machine:**

```bash
# List result files
ls -lht data/results/ | head -10

# View most recent with pretty formatting
cat $(ls -t data/results/*.json | head -1) | jq .

# Search for specific field
cat $(ls -t data/results/*.json | head -1) | jq '.extracted_data'
```

### **What to Look For:**

The result file contains the EXACT data that was sent to the webhook:

```json
{
  "call_id": "18882175837982271",
  "processed_at": "2025-10-02T14:30:00.000Z",
  "success": true,
  
  "extracted_data": {
    "overall_status": "complete",
    "data_points": {
      "full_name": { "value": "Rahul Sharma", "status": "verified", "attempts": 1 },
      "car_model": { "value": "Tata Nexon EV", "status": "verified", "attempts": 1 },
      "email_id": { "value": "rahul@gmail.com", "status": "verified", "attempts": 2 }
    }
  },
  
  "call_analytics": {
    "language_detected": "hindi",
    "drop_off_point": null,
    "question_answer_pairs": [...]
  }
}
```

---

## 🌐 **Method 3: Add Webhook Logging to Route Handler**

Enhance the webhook endpoint to log received data.

### **Edit: `src/app/api/webhooks/singleinterface/route.ts`**

Add detailed logging:

```typescript
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // 🆕 ADD: Detailed logging of received data
    console.log('═══════════════════════════════════════════════════');
    console.log('🎯 WEBHOOK RECEIVED - SingleInterface');
    console.log('═══════════════════════════════════════════════════');
    console.log('📋 Call ID:', body.call_ref_id);
    console.log('⏱️  Duration:', body.duration, 'seconds');
    console.log('🌍 Language:', body.language?.conversational || 'unknown');
    console.log('📞 Vendor:', body.call_vendor);
    console.log('🚨 Dealer Routing:', body.dealer_routing?.status ? 'YES' : 'NO');
    console.log('   Reason:', body.dealer_routing?.reason);
    
    if (body.response_data && body.response_data.length > 0) {
      console.log('📊 Data Points Received:', body.response_data.length);
      body.response_data.forEach((item: any) => {
        const icon = item.remarks === 'verified' ? '✅' : '⚠️';
        console.log(`   ${icon} ${item.key_value}: "${item.key_response}" (${item.attempts} attempts)`);
      });
    }
    
    if (body.dropoff?.action) {
      console.log('📉 Dropoff:', body.dropoff.action, 'at', body.dropoff.time);
    }
    
    console.log('═══════════════════════════════════════════════════');
    
    // ... rest of the handler code
  }
}
```

Then monitor Next.js logs:

```bash
# On GCP VM
pm2 logs voiceagent-next | grep "WEBHOOK RECEIVED"

# Locally
# Check your npm run dev terminal output
```

---

## 🧪 **Method 4: Test with Sample Call**

Make a test call and trace it through the entire pipeline.

### **Step 1: Make Test Call**

Call your Ozonetel number and complete a conversation.

### **Step 2: Track the Call ID**

Note the call ID from telephony logs:

```bash
pm2 logs voiceagent-telephony | grep "WebSocket connected" | tail -1
```

Output will show: `[CALL_ID] 🔌 WebSocket connected`

### **Step 3: Wait for Processing**

Wait 10-20 seconds for queue processor to pick it up.

### **Step 4: Search Logs for That Call ID**

```bash
# Replace with your actual call ID
CALL_ID="18882175837982271"

# Search across all logs
pm2 logs --lines 500 | grep "$CALL_ID"

# Or search specific service
pm2 logs voiceagent-queue-processor --lines 200 | grep "$CALL_ID"
```

### **Step 5: Verify Result File**

```bash
ls -lh /opt/voiceagent/data/results/ | grep "$CALL_ID"
cat /opt/voiceagent/data/results/call_${CALL_ID}_*.json | jq .
```

---

## 📊 **Method 5: Compare Against Sample Payloads**

Use the sample payloads file to verify structure.

### **Step 1: Get Latest Result**

```bash
cat $(ls -t data/results/*.json | head -1) > latest_result.json
```

### **Step 2: Extract Webhook Payload Structure**

The webhook service transforms the result data. Check the transformation:

```bash
# View the webhook service code
cat src/services/webhookService.js | grep -A 50 "transformToSingleInterfaceFormat"
```

### **Step 3: Compare Fields**

```bash
# Check if result has all required fields
cat latest_result.json | jq 'keys'

# Compare with sample
cat WEBHOOK_SAMPLE_PAYLOADS.json | jq '.samples.scenario_1_complete_success.payload | keys'
```

---

## 🔬 **Method 6: Enable Webhook Request Logging**

Capture the actual HTTP request being sent.

### **Edit: `src/services/webhookService.js`**

Add request logging in `makeWebhookRequest`:

```javascript
async makeWebhookRequest(url, payload, attempt = 1) {
  try {
    // 🆕 ADD: Log the exact request being sent
    console.log('\n🔹 WEBHOOK REQUEST DETAILS:');
    console.log('   URL:', url);
    console.log('   Method: POST');
    console.log('   Payload size:', JSON.stringify(payload).length, 'bytes');
    console.log('   Payload preview:', JSON.stringify(payload, null, 2).substring(0, 500) + '...');
    
    const { default: fetch } = await import('node-fetch');
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'VoiceAgent-Webhook/1.0'
      },
      body: JSON.stringify(payload),
      timeout: this.timeout
    });

    // 🆕 ADD: Log the response
    console.log('   ✅ Response:', response.status, response.statusText);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response;
  } catch (error) {
    console.log('   ❌ Error:', error.message);
    // ... rest of retry logic
  }
}
```

---

## 📝 **Method 7: Create a Webhook Logger Script**

Create a simple script that saves all webhook data to a file.

### **Create: `webhook-logger.js`**

```javascript
const fs = require('fs');
const path = require('path');

// Create logs directory
const logsDir = path.join(__dirname, 'webhook-logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

// Export for use in webhook route
module.exports = function logWebhook(payload) {
  const timestamp = new Date().toISOString().replace(/:/g, '-');
  const filename = `webhook_${payload.call_ref_id}_${timestamp}.json`;
  const filepath = path.join(logsDir, filename);
  
  const logEntry = {
    received_at: new Date().toISOString(),
    payload: payload,
    validation: {
      has_id: !!payload.id,
      has_call_ref_id: !!payload.call_ref_id,
      has_vendor: !!payload.call_vendor,
      has_timing: !!(payload.start_time && payload.end_time),
      has_language: !!payload.language,
      has_routing: !!payload.dealer_routing,
      has_response_data: Array.isArray(payload.response_data),
      response_data_count: payload.response_data?.length || 0
    }
  };
  
  fs.writeFileSync(filepath, JSON.stringify(logEntry, null, 2));
  console.log(`📝 Webhook logged to: ${filename}`);
  
  return logEntry.validation;
};
```

### **Use in Route:**

```typescript
// In src/app/api/webhooks/singleinterface/route.ts
const logWebhook = require('@/webhook-logger');

export async function POST(req: NextRequest) {
  const body = await req.json();
  
  // Log the webhook
  const validation = logWebhook(body);
  console.log('✅ Validation:', validation);
  
  // ... rest of handler
}
```

Then check logs:

```bash
ls -lht webhook-logs/ | head -10
cat webhook-logs/webhook_*.json | jq .
```

---

## ✅ **Quick Verification Checklist**

After a test call, verify:

- [ ] Queue processor logs show "webhook delivered successfully"
- [ ] Result file exists in `/data/results/`
- [ ] Result file contains `extracted_data` with customer info
- [ ] Webhook logs show HTTP 200 response
- [ ] All 3 data points present (or marked as not_available)
- [ ] Language detected correctly
- [ ] Dealer routing decision matches expected logic
- [ ] Timestamps in correct format (YYYY-MM-DD HH:mm:ss)
- [ ] Duration calculated correctly

---

## 🐛 **Troubleshooting**

### **Issue: No webhook logs found**

**Check:**
```bash
# Is queue processor running?
pm2 status voiceagent-queue-processor

# Are there any result files?
ls -la /opt/voiceagent/data/results/

# Are webhooks enabled?
cat .env | grep WEBHOOKS_ENABLED
```

### **Issue: Webhook shows 500 error**

**Check:**
```bash
# View Next.js logs for errors
pm2 logs voiceagent-next --err

# Check webhook route handler
cat src/app/api/webhooks/singleinterface/route.ts
```

### **Issue: Data missing in webhook**

**Check:**
```bash
# Compare result file with webhook payload
cat data/results/call_*.json | jq '.extracted_data'

# Verify transformation logic
cat src/services/webhookService.js | grep -A 100 "transformToSingleInterfaceFormat"
```

---

## 📊 **Expected Log Flow for Successful Call**

```
[Telephony Service]
18882175837982271 🔌 WebSocket connected from Ozonetel
18882175837982271 📝 Conversation started
18882175837982271 🎯 capture_all_sales_data called
18882175837982271 📄 Transcript saved
18882175837982271 📋 Processing queue entry created

[Queue Processor - 5-10 seconds later]
📂 Found 1 file(s) to process
🔄 Processing queue file: call_18882175837982271_queue.json
📖 Reading transcript: 18882175837982271_transcript.json
🤖 Extracting sales data using AI...
✅ Extraction completed successfully
💾 Result saved: call_18882175837982271_result.json
🚀 Processing webhooks...
🎯 Single Interface webhook delivered successfully: 200
📊 Delivered: 3 data points, duration: 150s
📡 Webhook summary: 2 delivered, 0 failed

[Webhook Endpoint]
🎯 WEBHOOK RECEIVED - SingleInterface
📋 Call ID: 18882175837982271
⏱️  Duration: 150 seconds
🌍 Language: hindi
📞 Vendor: Ozonetel
🚨 Dealer Routing: YES
   Reason: All data collected - routing to dealer
📊 Data Points Received: 3
   ✅ name: "Rahul Sharma" (1 attempts)
   ✅ model: "Tata Nexon EV" (1 attempts)
   ✅ email: "rahul@gmail.com" (2 attempts)
```

---

## 🎯 **Best Practice: Continuous Monitoring**

Set up a monitoring command:

```bash
# Run this in a separate terminal to watch webhook activity
watch -n 5 'pm2 logs voiceagent-queue-processor --lines 50 --nostream | grep -A 10 "Processing webhooks"'
```

Or create an alert script:

```bash
# webhook-monitor.sh
#!/bin/bash
while true; do
  FAILED=$(pm2 logs voiceagent-queue-processor --lines 100 --nostream | grep "webhook failed" | wc -l)
  if [ $FAILED -gt 0 ]; then
    echo "⚠️  ALERT: $FAILED webhook failures detected!"
    pm2 logs voiceagent-queue-processor --lines 20 --nostream | grep "webhook failed"
  fi
  sleep 30
done
```

---

**Summary:** Use Method 1 (Queue Processor Logs) for quick checks, and Method 2 (Result Files) to verify the exact data structure being sent.
