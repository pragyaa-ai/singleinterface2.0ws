# 🎯 SingleInterface Webhook - Quick Reference Card

## 📡 **Endpoint**
```
POST https://singleinterfacews.pragyaa.ai/api/webhooks/singleinterface
```

---

## 📦 **Payload Structure (At a Glance)**

```json
{
  // WHO & WHAT
  "id": "bot_{call_id}",
  "call_ref_id": "{original_call_id}",
  "call_vendor": "Ozonetel | Waybeo",
  
  // WHEN & HOW LONG
  "start_time": "YYYY-MM-DD HH:mm:ss",
  "end_time": "YYYY-MM-DD HH:mm:ss",
  "duration": 150,  // seconds
  
  // LANGUAGE
  "language": {
    "welcome": "english",
    "conversational": "hindi|tamil|telugu|..."
  },
  
  // ROUTING DECISION
  "dealer_routing": {
    "status": true|false,
    "reason": "All data collected | Customer requested dealer | Understanding issues | ...",
    "time": "YYYY-MM-DD HH:mm:ss"
  },
  
  // DROPOFF ANALYSIS
  "dropoff": {
    "time": "YYYY-MM-DD HH:mm:ss",  // empty if completed
    "action": "ivr|name|model|email"  // empty if completed
  },
  
  // COLLECTED DATA
  "response_data": [
    {
      "key_label": "What's your name",
      "key_value": "name",
      "key_response": "Rahul Sharma",  // or empty string
      "attempts": 2,
      "attempts_details": [...],
      "remarks": "verified|not_available|not_attempted"
    }
  ]
}
```

---

## 🎯 **The 3 Data Points We Collect**

| key_value | key_label | Example Response |
|-----------|-----------|------------------|
| `name` | "What's your name" | "Rahul Sharma" |
| `model` | "Which model you are looking for" | "Tata Nexon EV" |
| `email` | "What is your email id" | "rahul@gmail.com" |

---

## 📊 **Status Flow Chart**

```
┌─────────────┐
│  Call Ends  │
└──────┬──────┘
       │
       ▼
┌─────────────────────┐
│ Queue Processor     │ ← Extracts data from transcript
│ Analyzes Call       │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ Determines Status:  │
└──────┬──────────────┘
       │
       ├─► ✅ COMPLETE (all 3 data points)
       │    └─► dealer_routing.status = true
       │        reason = "All data collected - routing to dealer"
       │
       ├─► ⚠️ PARTIAL (1-2 data points)
       │    └─► dealer_routing.status = false
       │        reason = "Partial data collected - call ended"
       │
       ├─► 🗣️ CUSTOMER REQUEST
       │    └─► dealer_routing.status = true
       │        reason = "Customer requested to speak with dealer"
       │
       ├─► 🔄 UNDERSTANDING ISSUES
       │    └─► dealer_routing.status = true
       │        reason = "Unable to understand customer responses"
       │
       └─► ❌ NO DATA
            └─► dealer_routing.status = false
                reason = "No data collected - call failed"
```

---

## 🎨 **Remarks Status Meanings**

| remarks | Meaning | What It Means |
|---------|---------|---------------|
| `verified` | ✅ Got it | Customer provided the data successfully |
| `not_available` | ⚠️ Asked but no answer | Question was asked but customer didn't provide valid answer |
| `not_attempted` | ⏭️ Never asked | Call ended before reaching this question |

---

## 🌍 **Language Detection**

**Supported Languages:**
- `english` - English responses
- `hindi` - Hindi words/Devanagari script
- `tamil` - Tamil words/Tamil script
- `telugu` - Telugu words/Telugu script
- `kannada` - Kannada words/Kannada script
- `gujarati` - Gujarati words/Gujarati script
- `punjabi` - Punjabi words/Gurmukhi script

**Detection Method:** Analyzes user messages for language-specific patterns and script characters.

---

## 🚨 **Dealer Routing Triggers**

| Trigger | Example | Status | Priority |
|---------|---------|--------|----------|
| Customer explicitly asked | "I want to talk to an agent" | `true` | HIGH |
| All data collected | Got name + model + email | `true` | MEDIUM |
| Understanding issues | 3+ reattempts or confusion detected | `true` | MEDIUM |
| Partial data | Got 1-2 data points, call ended | `false` | LOW |
| No data | Call failed early | `false` | NONE |

---

## 📉 **Dropoff Stages**

```
Start Call
    │
    ▼
┌──────────┐
│   IVR    │ ← dropoff.action = "ivr" (very early dropoff)
└────┬─────┘
     │
     ▼
┌──────────┐
│   NAME   │ ← dropoff.action = "name" (during name collection)
└────┬─────┘
     │
     ▼
┌──────────┐
│  MODEL   │ ← dropoff.action = "model" (during car model)
└────┬─────┘
     │
     ▼
┌──────────┐
│  EMAIL   │ ← dropoff.action = "email" (during email)
└────┬─────┘
     │
     ▼
┌──────────┐
│ COMPLETE │ ← dropoff.action = "" (no dropoff)
└──────────┘
```

---

## 🔢 **Attempt Details Explained**

```json
"attempts_details": [
  {
    "start_time": "2025-10-02 14:25:10",  // When agent asked
    "end_time": "2025-10-02 14:25:15",    // When customer answered
    "sequence": 1                          // 1st attempt
  },
  {
    "start_time": "2025-10-02 14:25:30",  // Agent asked again
    "end_time": "2025-10-02 14:25:40",    // Customer answered again
    "sequence": 2                          // 2nd attempt
  }
]
```

**Use Cases:**
- Calculate response time: `end_time - start_time`
- Identify if customer needed multiple tries
- Track conversation flow timing
- Measure customer engagement

---

## 📊 **Key Metrics You Can Calculate**

### 1️⃣ **Completion Rate**
```javascript
completionRate = (completeCount / totalCalls) * 100

where: dealer_routing.status === true 
       AND dealer_routing.reason === "All data collected..."
```

### 2️⃣ **Average Attempts per Field**
```javascript
avgAttempts = totalAttempts / totalQuestions

// Good: 1.0 - 1.5
// Needs improvement: 2.0+
```

### 3️⃣ **Dropoff Rate by Stage**
```javascript
nameDropoff = calls where dropoff.action === "name"
modelDropoff = calls where dropoff.action === "model"
emailDropoff = calls where dropoff.action === "email"
```

### 4️⃣ **Language Distribution**
```javascript
languageBreakdown = count by language.conversational
```

### 5️⃣ **Average Call Duration by Outcome**
```javascript
completeAvgDuration = avg(duration) where dealer_routing.status === true
partialAvgDuration = avg(duration) where dealer_routing.status === false
```

---

## 🧪 **Quick Test Commands**

### **Health Check**
```bash
curl https://singleinterfacews.pragyaa.ai/api/webhooks/singleinterface
```

### **Test POST**
```bash
curl -X POST https://singleinterfacews.pragyaa.ai/api/webhooks/singleinterface \
  -H "Content-Type: application/json" \
  -d '{"id":"bot_test","call_ref_id":"test","call_vendor":"Ozonetel","start_time":"2025-10-02 10:00:00","end_time":"2025-10-02 10:05:00"}'
```

### **Monitor Logs**
```bash
pm2 logs voiceagent-queue-processor | grep "webhook"
```

---

## 🛠️ **Configuration Checklist**

```bash
# .env file
WEBHOOKS_ENABLED=true
WEBHOOK_BASE_URL=https://singleinterfacews.pragyaa.ai
WEBHOOK_RETRY_ATTEMPTS=3
WEBHOOK_TIMEOUT_MS=10000

# Optional: External forwarding
SINGLEINTERFACE_WEBHOOK_URL=https://your-api.com/webhook
SINGLEINTERFACE_API_KEY=your_api_key
```

---

## 🚀 **Integration Patterns**

### **Pattern 1: Save to Database**
```javascript
// Extract key data
const name = data.response_data.find(r => r.key_value === 'name')?.key_response;
const model = data.response_data.find(r => r.key_value === 'model')?.key_response;
const email = data.response_data.find(r => r.key_value === 'email')?.key_response;

await db.leads.insert({
  call_id: data.call_ref_id,
  name, model, email,
  language: data.language.conversational,
  status: data.dealer_routing.status ? 'route_to_dealer' : 'no_action'
});
```

### **Pattern 2: Send Email Notification**
```javascript
if (data.dealer_routing.status && data.dealer_routing.reason.includes('All data collected')) {
  sendEmail({
    to: 'sales@company.com',
    subject: `New Lead: ${name} interested in ${model}`,
    body: `Contact: ${email} | Language: ${data.language.conversational}`
  });
}
```

### **Pattern 3: Real-time Dashboard Update**
```javascript
// Push to websocket for live dashboard
websocket.emit('new_call', {
  call_id: data.call_ref_id,
  status: data.dealer_routing.status ? 'complete' : 'partial',
  duration: data.duration,
  language: data.language.conversational,
  dropoff_stage: data.dropoff.action || 'none'
});
```

---

## ⏱️ **Timing Expectations**

| Event | Typical Time |
|-------|--------------|
| Call ends → Transcript saved | Immediate |
| Transcript saved → Queue picks up | 0-5 seconds |
| Queue processes → AI extracts data | 3-10 seconds |
| Results saved → Webhook sent | Immediate |
| **Total: Call End → Webhook Received** | **5-15 seconds** |

---

## 🛡️ **Error Handling**

- **Non-blocking:** Webhook failures don't affect call processing
- **Auto-retry:** 3 attempts with exponential backoff (1s, 2s, 3s)
- **Timeout:** 10-second timeout per attempt
- **Logging:** All errors logged to PM2 logs

```bash
# Check webhook errors
pm2 logs voiceagent-queue-processor --err | grep "webhook"
```

---

## 📞 **Common Scenarios**

### ✅ **Happy Path (Complete)**
- 3/3 data points collected
- `dealer_routing.status = true`
- `dropoff.action = ""`
- All `remarks = "verified"`

### ⚠️ **Partial Collection**
- 1-2 data points collected
- `dealer_routing.status = false`
- `dropoff.action = "model" or "email"`
- Mixed `remarks`: some `"verified"`, some `"not_available"`

### 🗣️ **Customer Escalation**
- Customer asked for human agent
- `dealer_routing.status = true`
- `dealer_routing.reason = "Customer requested..."`
- May have partial or no data

### 🔄 **Communication Issues**
- Multiple reattempts (3+)
- `dealer_routing.status = true`
- `dealer_routing.reason = "Unable to understand..."`
- High `attempts` count in response_data

### ❌ **Early Dropout**
- No data collected
- `dealer_routing.status = false`
- `dropoff.action = "ivr" or "name"`
- All `remarks = "not_attempted"`

---

## 📋 **Response Data Array - Always 3 Items**

The `response_data` array **always includes** entries for attempted or partially attempted data points:

```javascript
// Always present if question was asked (even if no answer)
response_data.length // Can be 0, 1, 2, or 3

// Name entry present if name was asked
response_data[0].key_value === "name"

// Model entry present if model was asked
response_data[1].key_value === "model"

// Email entry present if email was asked
response_data[2].key_value === "email"
```

**Note:** If a question was **never asked**, it won't appear in the array at all.

---

## 🎯 **Priority Lead Scoring**

Use webhook data to score leads:

```javascript
let score = 0;

// Complete data = high priority
if (data.response_data.filter(r => r.remarks === 'verified').length === 3) {
  score += 100;
}

// Low attempts = engaged customer
const avgAttempts = data.response_data.reduce((sum, r) => sum + r.attempts, 0) / data.response_data.length;
if (avgAttempts <= 1.5) score += 50;

// Quick response time = engaged
if (data.duration < 120) score += 30; // Under 2 minutes

// Customer requested dealer = hot lead
if (data.dealer_routing.reason.includes('Customer requested')) {
  score += 75;
}

// Return priority
if (score >= 150) return 'HOT';
if (score >= 100) return 'WARM';
return 'COLD';
```

---

## 📚 **Additional Resources**

- **Full Documentation:** `SINGLEINTERFACE_WEBHOOK_DETAILS.md`
- **Deployment Guide:** `WEBHOOK_DEPLOYMENT.md`
- **E2E Testing Plan:** `E2E_TESTING_PLAN.md`
- **API Routes:** `src/app/api/webhooks/singleinterface/route.ts`
- **Webhook Service:** `src/services/webhookService.js`
- **Queue Processor:** `src/server/agents/queueProcessor.js`

---

**Questions?** Check the comprehensive guide in `SINGLEINTERFACE_WEBHOOK_DETAILS.md` 📖

