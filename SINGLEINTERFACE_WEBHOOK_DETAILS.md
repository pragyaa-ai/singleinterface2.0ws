# 🎯 SingleInterface Webhook Integration - Complete Documentation

## 📊 **Overview**

The SingleInterface webhook receives **complete call analytics data** after every call is processed by the queue processor. This webhook delivers comprehensive information about the customer conversation, collected data, call quality, and routing decisions.

---

## 🔄 **Data Flow Architecture**

```
┌─────────────────┐
│  Voice Call     │
│  (Real-time)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Telephony Agent │ ← Captures conversation transcript
│  (index.ts)     │   (No data extraction during call)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Save Transcript │ ← Saves conversation to /data/transcripts
│ & Create Queue  │   Creates processing task in /data/processing
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Queue Processor │ ← Runs asynchronously (every 5 seconds)
│ (queueProc.js)  │   - Reads transcript
└────────┬────────┘   - Extracts sales data using AI
         │             - Analyzes call quality
         │             - Saves to /data/results
         ▼
┌─────────────────┐
│ Webhook Service │ ← Transforms data to SingleInterface format
│ (webhookSvc.js) │   Sends POST request to webhook endpoint
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ SingleInterface │ ← Receives complete call data
│   Webhook API   │   https://singleinterfacews.pragyaa.ai/api/webhooks/singleinterface
└─────────────────┘
```

---

## 📡 **Webhook Endpoint Details**

### **Production URL**
```
POST https://singleinterfacews.pragyaa.ai/api/webhooks/singleinterface
```

### **Headers**
```http
Content-Type: application/json
User-Agent: VoiceAgent-Webhook/1.0
```

### **Authentication**
Currently no authentication (can be added via `SINGLEINTERFACE_API_KEY` env var)

---

## 📦 **Complete Webhook Payload Structure**

### **Top-Level Fields**

```typescript
{
  // Call Identification
  "id": string,              // Bot call ID (format: "bot_{call_ref_id}")
  "call_ref_id": string,     // Original call reference ID from telephony vendor
  
  // Call Metadata  
  "call_vendor": string,     // "Ozonetel" (testing) or "Waybeo" (production)
  "recording_url": string,   // URL to call recording (empty if not available)
  
  // Timing Information
  "start_time": string,      // Format: "YYYY-MM-DD HH:mm:ss" (no milliseconds)
  "end_time": string,        // Format: "YYYY-MM-DD HH:mm:ss"
  "duration": number,        // Call duration in seconds
  
  // Language Detection
  "language": {
    "welcome": string,         // Always "english" (greeting language)
    "conversational": string   // Detected from user responses (hindi, tamil, etc.)
  },
  
  // Dealer Routing Decision
  "dealer_routing": {
    "status": boolean,         // true = route to dealer, false = no routing
    "reason": string,          // Human-readable reason for routing decision
    "time": string            // Timestamp when routing decision made (format: "YYYY-MM-DD HH:mm:ss")
  },
  
  // Dropoff Analysis
  "dropoff": {
    "time": string,           // When customer dropped off (empty if completed)
    "action": string          // What stage: "ivr", "name", "model", "email" (empty if completed)
  },
  
  // Collected Data Points
  "response_data": [
    {
      "key_label": string,      // Question asked: "What's your name"
      "key_value": string,      // Data type: "name", "model", "email"
      "key_response": string,   // Customer's answer (empty if not provided)
      "attempts": number,       // How many times this question was asked
      "attempts_details": [     // Detailed timing for each attempt
        {
          "start_time": string,   // When question was asked
          "end_time": string,     // When answer was received
          "sequence": number      // Attempt number (1, 2, 3...)
        }
      ],
      "remarks": string         // Status: "verified", "not_available", "not_attempted"
    }
  ]
}
```

---

## 📋 **Field Descriptions & Logic**

### **1. Call Identification**

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `id` | string | Unique bot call identifier | `"bot_18882175837982271"` |
| `call_ref_id` | string | Original telephony vendor call ID | `"18882175837982271"` |

### **2. Call Vendor**

| Field | Type | Values | Description |
|-------|------|--------|-------------|
| `call_vendor` | string | `"Ozonetel"`, `"Waybeo"` | Current testing vendor is Ozonetel. Will change to Waybeo in production |

### **3. Timing Information**

| Field | Type | Format | Description |
|-------|------|--------|-------------|
| `start_time` | string | `"YYYY-MM-DD HH:mm:ss"` | When call started (no milliseconds) |
| `end_time` | string | `"YYYY-MM-DD HH:mm:ss"` | When call ended |
| `duration` | number | seconds | Total call duration (calculated from timestamps) |

**Note:** All timestamps are formatted **without milliseconds** to match SingleInterface API requirements.

### **4. Language Detection**

The system automatically detects the language used during the conversation:

```javascript
"language": {
  "welcome": "english",        // Always English for initial greeting
  "conversational": "hindi"    // Auto-detected from user responses
}
```

**Supported Languages:**
- `english` - Default/English responses
- `hindi` - Detected via common Hindi words/phrases or Devanagari script
- `tamil` - Tamil script or common Tamil words
- `telugu` - Telugu script or common Telugu words
- `kannada` - Kannada script or common Kannada words
- `gujarati` - Gujarati script or common Gujarati words
- `punjabi` - Punjabi script or common Punjabi words

**Detection Logic:**
- Analyzes all customer (user) messages in the conversation
- Looks for language-specific patterns (words, phrases, script characters)
- Counts matches for each language
- Returns language with highest score (defaults to "hindi" if no clear match)

### **5. Dealer Routing Decision**

The system intelligently determines whether to route the call to a human dealer:

```javascript
"dealer_routing": {
  "status": true,
  "reason": "All data collected - routing to dealer",
  "time": "2025-10-02 14:30:45"
}
```

**Routing Logic:**

| Scenario | Status | Reason | Description |
|----------|--------|--------|-------------|
| Customer explicitly requested | `true` | `"Customer requested to speak with dealer"` | User said phrases like "talk to agent", "speak to dealer", etc. |
| All data collected | `true` | `"All data collected - routing to dealer"` | Successfully got name, model, and email |
| Understanding issues | `true` | `"Unable to understand customer responses"` | Multiple reattempts or confusion patterns detected |
| Partial data collected | `false` | `"Partial data collected - call ended"` | Got 1-2 data points but call ended |
| No data collected | `false` | `"No data collected - call failed"` | Call failed or ended before any data captured |

**Understanding Issues Detection:**
- Tracks average attempts per question (>2 attempts = issues)
- Looks for confusion patterns in assistant messages:
  - "sorry", "pardon", "didn't understand"
  - "please say again", "one more time", "repeat"
  - Hindi equivalents: "samjha nahi", "phir se"

### **6. Dropoff Analysis**

Identifies at what stage the customer dropped off (if they did):

```javascript
// Successful completion
"dropoff": {
  "time": "",
  "action": ""
}

// Dropped during email collection
"dropoff": {
  "time": "2025-10-02 14:28:30",
  "action": "email"
}
```

**Dropoff Stages:**

| Action | Description | When It Happens |
|--------|-------------|-----------------|
| `""` (empty) | No dropoff - call completed | All data collected successfully |
| `"ivr"` | Dropped during initial greeting | Customer hung up before any questions |
| `"name"` | Dropped while asking for name | Customer didn't provide name |
| `"model"` | Dropped while asking for car model | Customer didn't provide model info |
| `"email"` | Dropped while asking for email | Customer didn't provide email |

**Dropoff Detection Logic:**
1. If `overall_status === 'complete'` → No dropoff
2. Otherwise, check which data points are missing
3. Use last assistant message timestamp as dropoff time
4. Infer dropoff action from missing data or last question asked

### **7. Response Data (Collected Information)**

Each data point that was **attempted or collected** appears in the `response_data` array:

```javascript
"response_data": [
  {
    "key_label": "What's your name",
    "key_value": "name",
    "key_response": "Rahul Sharma",
    "attempts": 2,
    "attempts_details": [
      {
        "start_time": "2025-10-02 14:25:10",
        "end_time": "2025-10-02 14:25:12",
        "sequence": 1
      },
      {
        "start_time": "2025-10-02 14:25:20",
        "end_time": "2025-10-02 14:25:25",
        "sequence": 2
      }
    ],
    "remarks": "verified"
  },
  {
    "key_label": "Which model you are looking for",
    "key_value": "model",
    "key_response": "",
    "attempts": 1,
    "attempts_details": [
      {
        "start_time": "2025-10-02 14:25:30",
        "end_time": "2025-10-02 14:25:32",
        "sequence": 1
      }
    ],
    "remarks": "not_available"
  },
  {
    "key_label": "What is your email id",
    "key_value": "email",
    "key_response": "",
    "attempts": 0,
    "attempts_details": [],
    "remarks": "not_attempted"
  }
]
```

**Data Point Fields:**

| Field | Type | Description | Possible Values |
|-------|------|-------------|-----------------|
| `key_label` | string | The question asked to customer | "What's your name", "Which model you are looking for", "What is your email id" |
| `key_value` | string | Short identifier for the data type | `"name"`, `"model"`, `"email"` |
| `key_response` | string | Customer's actual response | Customer's answer or `""` if not provided |
| `attempts` | number | How many times question was asked | `0` = not asked, `1+` = number of attempts |
| `attempts_details` | array | Timing details for each attempt | Array of attempt objects with timestamps |
| `remarks` | string | Status of this data point | `"verified"`, `"not_available"`, `"not_attempted"` |

**Remarks Values:**

| Status | Meaning | Example Scenario |
|--------|---------|------------------|
| `"verified"` | Data successfully collected | Customer provided name: "Rahul Sharma" |
| `"not_available"` | Question asked but no valid answer | Customer said "I don't know" or unclear response |
| `"not_attempted"` | Question was never asked | Call ended before reaching this question |

**Attempt Details:**

Each attempt includes precise timing:
- `start_time`: When agent asked the question
- `end_time`: When customer finished responding
- `sequence`: Attempt number (1st try, 2nd try, etc.)

This allows you to:
- Calculate response time per attempt
- Identify if multiple attempts were needed
- Track conversation flow timing

---

## 🎯 **Real-World Examples**

### **Example 1: Successful Complete Call**

```json
{
  "id": "bot_18882175837982271",
  "call_ref_id": "18882175837982271",
  "call_vendor": "Ozonetel",
  "recording_url": "",
  "start_time": "2025-10-02 14:25:00",
  "end_time": "2025-10-02 14:27:30",
  "duration": 150,
  "language": {
    "welcome": "english",
    "conversational": "hindi"
  },
  "dealer_routing": {
    "status": true,
    "reason": "All data collected - routing to dealer",
    "time": "2025-10-02 14:27:30"
  },
  "dropoff": {
    "time": "",
    "action": ""
  },
  "response_data": [
    {
      "key_label": "What's your name",
      "key_value": "name",
      "key_response": "Rahul Sharma",
      "attempts": 1,
      "attempts_details": [
        {
          "start_time": "2025-10-02 14:25:10",
          "end_time": "2025-10-02 14:25:15",
          "sequence": 1
        }
      ],
      "remarks": "verified"
    },
    {
      "key_label": "Which model you are looking for",
      "key_value": "model",
      "key_response": "Tata Nexon EV",
      "attempts": 1,
      "attempts_details": [
        {
          "start_time": "2025-10-02 14:26:00",
          "end_time": "2025-10-02 14:26:05",
          "sequence": 1
        }
      ],
      "remarks": "verified"
    },
    {
      "key_label": "What is your email id",
      "key_value": "email",
      "key_response": "rahul.sharma@gmail.com",
      "attempts": 2,
      "attempts_details": [
        {
          "start_time": "2025-10-02 14:26:30",
          "end_time": "2025-10-02 14:26:35",
          "sequence": 1
        },
        {
          "start_time": "2025-10-02 14:26:50",
          "end_time": "2025-10-02 14:27:00",
          "sequence": 2
        }
      ],
      "remarks": "verified"
    }
  ]
}
```

**Analysis:**
- ✅ All 3 data points collected
- ✅ Conversation was in Hindi (detected automatically)
- ✅ Email needed 2 attempts (common for email addresses)
- ✅ Total duration: 2 minutes 30 seconds
- ✅ Routing to dealer approved

---

### **Example 2: Partial Data - Customer Dropped Off**

```json
{
  "id": "bot_18882175837982272",
  "call_ref_id": "18882175837982272",
  "call_vendor": "Ozonetel",
  "recording_url": "",
  "start_time": "2025-10-02 15:10:00",
  "end_time": "2025-10-02 15:11:20",
  "duration": 80,
  "language": {
    "welcome": "english",
    "conversational": "english"
  },
  "dealer_routing": {
    "status": false,
    "reason": "Partial data collected - call ended",
    "time": ""
  },
  "dropoff": {
    "time": "2025-10-02 15:11:15",
    "action": "email"
  },
  "response_data": [
    {
      "key_label": "What's your name",
      "key_value": "name",
      "key_response": "Priya Mehta",
      "attempts": 1,
      "attempts_details": [
        {
          "start_time": "2025-10-02 15:10:15",
          "end_time": "2025-10-02 15:10:18",
          "sequence": 1
        }
      ],
      "remarks": "verified"
    },
    {
      "key_label": "Which model you are looking for",
      "key_value": "model",
      "key_response": "Hyundai Creta",
      "attempts": 1,
      "attempts_details": [
        {
          "start_time": "2025-10-02 15:10:40",
          "end_time": "2025-10-02 15:10:45",
          "sequence": 1
        }
      ],
      "remarks": "verified"
    },
    {
      "key_label": "What is your email id",
      "key_value": "email",
      "key_response": "",
      "attempts": 1,
      "attempts_details": [
        {
          "start_time": "2025-10-02 15:11:10",
          "end_time": "2025-10-02 15:11:15",
          "sequence": 1
        }
      ],
      "remarks": "not_available"
    }
  ]
}
```

**Analysis:**
- ⚠️ 2 out of 3 data points collected (name, model)
- ❌ Email not provided - customer hung up during email question
- ⚠️ Dropoff detected at "email" stage
- ❌ Not routing to dealer (partial data)
- 📊 Short duration: 1 minute 20 seconds

---

### **Example 3: Customer Requested Human Agent**

```json
{
  "id": "bot_18882175837982273",
  "call_ref_id": "18882175837982273",
  "call_vendor": "Ozonetel",
  "recording_url": "",
  "start_time": "2025-10-02 16:00:00",
  "end_time": "2025-10-02 16:01:45",
  "duration": 105,
  "language": {
    "welcome": "english",
    "conversational": "hindi"
  },
  "dealer_routing": {
    "status": true,
    "reason": "Customer requested to speak with dealer",
    "time": "2025-10-02 16:01:30"
  },
  "dropoff": {
    "time": "",
    "action": ""
  },
  "response_data": [
    {
      "key_label": "What's your name",
      "key_value": "name",
      "key_response": "Amit Kumar",
      "attempts": 1,
      "attempts_details": [
        {
          "start_time": "2025-10-02 16:00:20",
          "end_time": "2025-10-02 16:00:25",
          "sequence": 1
        }
      ],
      "remarks": "verified"
    },
    {
      "key_label": "Which model you are looking for",
      "key_value": "model",
      "key_response": "",
      "attempts": 0,
      "attempts_details": [],
      "remarks": "not_attempted"
    },
    {
      "key_label": "What is your email id",
      "key_value": "email",
      "key_response": "",
      "attempts": 0,
      "attempts_details": [],
      "remarks": "not_attempted"
    }
  ]
}
```

**Analysis:**
- ✅ Customer explicitly asked to talk to dealer
- ✅ Routing approved immediately
- ⚠️ Only name was collected before routing
- 📝 Model and email marked as "not_attempted" (customer didn't want to continue with bot)

---

### **Example 4: Understanding Issues - High Reattempts**

```json
{
  "id": "bot_18882175837982274",
  "call_ref_id": "18882175837982274",
  "call_vendor": "Ozonetel",
  "recording_url": "",
  "start_time": "2025-10-02 17:00:00",
  "end_time": "2025-10-02 17:03:45",
  "duration": 225,
  "language": {
    "welcome": "english",
    "conversational": "tamil"
  },
  "dealer_routing": {
    "status": true,
    "reason": "Unable to understand customer responses",
    "time": "2025-10-02 17:03:20"
  },
  "dropoff": {
    "time": "",
    "action": ""
  },
  "response_data": [
    {
      "key_label": "What's your name",
      "key_value": "name",
      "key_response": "Muthu",
      "attempts": 3,
      "attempts_details": [
        {
          "start_time": "2025-10-02 17:00:30",
          "end_time": "2025-10-02 17:00:35",
          "sequence": 1
        },
        {
          "start_time": "2025-10-02 17:01:00",
          "end_time": "2025-10-02 17:01:10",
          "sequence": 2
        },
        {
          "start_time": "2025-10-02 17:01:40",
          "end_time": "2025-10-02 17:01:50",
          "sequence": 3
        }
      ],
      "remarks": "verified"
    },
    {
      "key_label": "Which model you are looking for",
      "key_value": "model",
      "key_response": "",
      "attempts": 4,
      "attempts_details": [
        {
          "start_time": "2025-10-02 17:02:00",
          "end_time": "2025-10-02 17:02:15",
          "sequence": 1
        },
        {
          "start_time": "2025-10-02 17:02:30",
          "end_time": "2025-10-02 17:02:45",
          "sequence": 2
        },
        {
          "start_time": "2025-10-02 17:03:00",
          "end_time": "2025-10-02 17:03:10",
          "sequence": 3
        },
        {
          "start_time": "2025-10-02 17:03:15",
          "end_time": "2025-10-02 17:03:20",
          "sequence": 4
        }
      ],
      "remarks": "not_available"
    },
    {
      "key_label": "What is your email id",
      "key_value": "email",
      "key_response": "",
      "attempts": 0,
      "attempts_details": [],
      "remarks": "not_attempted"
    }
  ]
}
```

**Analysis:**
- ⚠️ High number of reattempts (3 for name, 4 for model)
- ⚠️ Average attempts > 2 indicates understanding issues
- ✅ System detected confusion and decided to route to human agent
- 📝 Tamil language detected - may need better Tamil language support
- ⏱️ Long duration (3m 45s) due to multiple reattempts

---

## 🔧 **Webhook Configuration**

### **Environment Variables**

```bash
# Required
WEBHOOKS_ENABLED=true
WEBHOOK_BASE_URL=https://singleinterfacews.pragyaa.ai

# Optional - Tuning
WEBHOOK_RETRY_ATTEMPTS=3        # Number of retry attempts on failure
WEBHOOK_TIMEOUT_MS=10000        # Timeout in milliseconds (10 seconds)

# Optional - External delivery (if forwarding to another system)
SINGLEINTERFACE_WEBHOOK_URL=https://your-api.com/webhook
SINGLEINTERFACE_API_KEY=your_api_key_here
```

### **When Webhooks are Sent**

Webhooks are triggered **automatically** after:
1. ✅ Call ends and transcript is saved
2. ✅ Queue processor picks up the transcript
3. ✅ AI extracts sales data and analyzes call quality
4. ✅ Results are saved to `/data/results`
5. ✅ **Webhook is immediately sent with complete data**

**Timing:** Usually **5-15 seconds after call ends** (depends on queue processor polling interval)

### **Error Handling**

- **Non-blocking:** Webhook failures don't affect call processing
- **Retry logic:** Automatic retries with exponential backoff
- **Timeout protection:** 10-second timeout prevents hanging
- **Error logging:** All failures logged but processing continues

---

## 📊 **Data Quality Metrics You Can Track**

Using the webhook data, you can calculate:

### **1. Completion Rate**
```
Complete Calls / Total Calls
```
Where: `overall_status === 'complete'` and all 3 data points have `remarks === 'verified'`

### **2. Dropoff Rate by Stage**
```
Count of calls where dropoff.action === 'name'
Count of calls where dropoff.action === 'model'
Count of calls where dropoff.action === 'email'
```

### **3. Average Attempts per Field**
```
Average of attempts for each key_value
```
Lower is better (1.0-1.5 is ideal)

### **4. Language Distribution**
```
Count by language.conversational value
```
Helps understand your customer base

### **5. Dealer Routing Reasons**
```
Count by dealer_routing.reason
```
- How many complete successfully?
- How many request human agent?
- How many have understanding issues?

### **6. Average Call Duration by Outcome**
```
Average duration for complete vs partial vs failed calls
```

### **7. Response Time Analysis**
```
Calculate (end_time - start_time) for each attempt in attempts_details
```
Identify if customers are taking too long to respond

---

## 🧪 **Testing the Webhook**

### **1. Check Webhook Health**
```bash
curl -X GET https://singleinterfacews.pragyaa.ai/api/webhooks/singleinterface
```

Expected response:
```json
{
  "status": "healthy",
  "endpoint": "Single Interface Webhook",
  "timestamp": "2025-10-02T14:30:00.000Z"
}
```

### **2. Test with Sample Data**
```bash
curl -X POST https://singleinterfacews.pragyaa.ai/api/webhooks/singleinterface \
  -H "Content-Type: application/json" \
  -d '{
    "id": "bot_test123",
    "call_ref_id": "test123",
    "call_vendor": "Ozonetel",
    "start_time": "2025-10-02 14:00:00",
    "end_time": "2025-10-02 14:05:00",
    "duration": 300,
    "language": {
      "welcome": "english",
      "conversational": "hindi"
    },
    "dealer_routing": {
      "status": true,
      "reason": "All data collected",
      "time": "2025-10-02 14:05:00"
    },
    "dropoff": {
      "time": "",
      "action": ""
    },
    "response_data": []
  }'
```

### **3. Monitor Webhook Logs**

On GCP VM:
```bash
# Watch queue processor logs for webhook activity
pm2 logs voiceagent-queue-processor --lines 50

# Look for these patterns:
# 🚀 Processing webhooks...
# 🎯 Single Interface webhook delivered successfully
# 📊 Delivered: 3 data points, duration: 150s
```

---

## 🚨 **Troubleshooting**

### **Problem: Webhooks not being sent**

**Check 1:** Is webhook enabled?
```bash
# In .env file
WEBHOOKS_ENABLED=true
```

**Check 2:** Is queue processor running?
```bash
pm2 status voiceagent-queue-processor
```

**Check 3:** Check logs for errors
```bash
pm2 logs voiceagent-queue-processor --err
```

### **Problem: Missing data in webhook**

**Check 1:** Is the call actually being processed?
```bash
ls -la data/results/
```

**Check 2:** Is transcript being created?
```bash
ls -la data/transcripts/
```

**Check 3:** Check queue processor logs for data extraction issues
```bash
pm2 logs voiceagent-queue-processor | grep "extracted_data"
```

### **Problem: Webhook timing out**

**Increase timeout:**
```bash
# In .env file
WEBHOOK_TIMEOUT_MS=20000  # Increase to 20 seconds
```

---

## 📚 **Integration Examples**

### **Example: Save to Database (Node.js)**

```javascript
// Your webhook receiver endpoint
app.post('/api/webhooks/singleinterface', async (req, res) => {
  const data = req.body;
  
  try {
    // Save to database
    await db.calls.insert({
      call_id: data.call_ref_id,
      customer_name: data.response_data.find(r => r.key_value === 'name')?.key_response,
      car_model: data.response_data.find(r => r.key_value === 'model')?.key_response,
      email: data.response_data.find(r => r.key_value === 'email')?.key_response,
      duration: data.duration,
      language: data.language.conversational,
      status: data.dealer_routing.status ? 'routed' : 'completed',
      created_at: new Date(data.start_time)
    });
    
    res.json({ success: true, message: 'Webhook processed' });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});
```

### **Example: Forward to Another System (Python)**

```python
import requests
from flask import Flask, request, jsonify

app = Flask(__name__)

@app.route('/api/webhooks/singleinterface', methods=['POST'])
def receive_webhook():
    data = request.json
    
    # Transform to your system's format
    transformed = {
        'lead_id': data['call_ref_id'],
        'name': next((r['key_response'] for r in data['response_data'] if r['key_value'] == 'name'), None),
        'interest': next((r['key_response'] for r in data['response_data'] if r['key_value'] == 'model'), None),
        'email': next((r['key_response'] for r in data['response_data'] if r['key_value'] == 'email'), None),
        'language': data['language']['conversational'],
        'source': 'voice_bot'
    }
    
    # Forward to your CRM
    response = requests.post(
        'https://your-crm.com/api/leads',
        json=transformed,
        headers={'Authorization': 'Bearer YOUR_TOKEN'}
    )
    
    return jsonify({'success': True, 'crm_response': response.status_code})

if __name__ == '__main__':
    app.run(port=5000)
```

---

## ✅ **Summary**

### **What You Get in the Webhook:**
- ✅ Complete call metadata (ID, vendor, timing)
- ✅ All collected customer data (name, model, email)
- ✅ Detailed attempt history with timestamps
- ✅ Language detection (welcome + conversational)
- ✅ Intelligent dealer routing decision with reasoning
- ✅ Dropoff analysis (when and where)
- ✅ Call quality indicators (attempts, duration, understanding issues)

### **When You Get It:**
- ⏱️ Automatically sent 5-15 seconds after call ends
- ⏱️ After AI processes the transcript asynchronously
- ⏱️ After results are saved to `/data/results`

### **How Reliable Is It:**
- 🛡️ Non-blocking (doesn't affect call processing)
- 🛡️ Automatic retries (3 attempts with backoff)
- 🛡️ Timeout protection (10 second limit)
- 🛡️ Error isolation (webhook failures don't break processing)

### **What You Can Build With It:**
- 📊 Real-time analytics dashboards
- 📧 Automated email notifications
- 💾 CRM/LMS integrations
- 📈 Performance monitoring
- 🔔 Alert systems for high-priority leads

---

**Need Help?** Check the logs:
```bash
pm2 logs voiceagent-queue-processor --lines 100 | grep "webhook"
```

