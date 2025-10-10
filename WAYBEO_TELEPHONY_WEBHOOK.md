# 📞 Waybeo Telephony Webhook Integration

**Branch:** `v4.3.0-webhook-updates`  
**Date:** October 10, 2025  
**Status:** Integrated with Waybeo bot-call API

---

## 🎯 Overview

After each call is processed, the system automatically sends minimal call status information to Waybeo's bot-call endpoint. This notifies Waybeo about the call completion and data capture outcome **without sending any customer data**.

---

## 🔗 Waybeo API Details

### **Endpoint:**
```
POST https://pbx-uat.waybeo.com/bot-call
```

### **Authentication:**
```
Authorization: Bearer <JWT_TOKEN>
```

### **Payload Format:**
```json
{
  "call_id": "74lJ3xiezGf4zOo-DJXGZ",
  "command": "data_record",
  "parameters": [
    {
      "key": "bot_reference_id",
      "value": "bot_74lJ3xiezGf4zOo-DJXGZ"
    },
    {
      "key": "data_capture_status",
      "value": "complete"
    }
  ]
}
```

**That's it! Only 2 parameters are sent - no customer data.**

---

## 📊 Parameters Sent to Waybeo

### **Parameters (Always 2):**

| Key | Description | Example Value | Source |
|-----|-------------|---------------|--------|
| `bot_reference_id` | Bot identifier with call ID | `"bot_74lJ3xiezGf4zOo-DJXGZ"` | System generated (bot_ + call_id) |
| `data_capture_status` | Data capture outcome | `"complete"`, `"partial"`, `"none"` | System determined |

### **Possible data_capture_status Values:**

- `"complete"` - All 3 data points captured successfully (name, car model, email)
- `"partial"` - Some data points captured but not all
- `"none"` - No data captured or call failed early

**Note:** Customer data (name, car model, email, etc.) is **NOT** sent to the telephony webhook. All customer data is only sent to the SingleInterface webhook.

---

## ⚙️ Environment Configuration

Add these environment variables to your `.env` file on the GCP VM:

```bash
# Waybeo Telephony Webhook Configuration
WAYBEO_WEBHOOK_URL=https://pbx-uat.waybeo.com/bot-call
WAYBEO_AUTH_TOKEN=ewogICJhbGciOiAiSFMyNTYiLAogICJ0eXAiOiAiSldUIgp9.ewogICJzdWIiOiAic3RyZWFtIiwKICAiaWF0IjogMTc1OTQyNDY1MCwKICAiZXhwIjogMTc1OTQyODI1MAp9.wU4YbFUqWjmkXSkABEb3AtsP3TrVsM33C0IxWb2DpZk

# General Webhook Settings (optional)
WEBHOOKS_ENABLED=true
WEBHOOK_RETRY_ATTEMPTS=3
WEBHOOK_TIMEOUT_MS=10000
```

### **Token Note:**

⚠️ The token provided in the example will expire. Waybeo should provide you with:
- Production token for live environment
- UAT token for testing
- Token refresh mechanism or long-lived token

---

## 🔄 How It Works

### **Flow Diagram:**

```
┌─────────────────┐
│  Call Ends      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Queue Processor │ ← Processes transcript
│ (agentRunner)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ webhookService  │ ← Transforms data
│ .processWebhooks│
└────────┬────────┘
         │
         ├──────────────────┬──────────────────┐
         │                  │                  │
         ▼                  ▼                  ▼
┌────────────────┐ ┌────────────────┐ ┌──────────────────┐
│ Waybeo Webhook │ │ SingleInterface│ │  (Future webhooks)│
│ (Telephony)    │ │    Webhook     │ │                  │
└────────┬───────┘ └────────────────┘ └──────────────────┘
         │
         ▼
┌─────────────────┐
│ Waybeo API      │ ← Receives data_record
│ pbx-uat.waybeo  │
│     .com        │
└─────────────────┘
```

### **Processing Steps:**

1. **Call Ends** - Customer hangs up or agent completes conversation
2. **Transcript Saved** - Full conversation saved to `/data/transcripts/`
3. **Queue Processing** - Async processor extracts data from transcript
4. **Data Transformation** - `webhookService.transformToWaybeoFormat()` converts to Waybeo format
5. **Webhook Delivery** - POST request sent to Waybeo with Bearer token
6. **Retry Logic** - Up to 3 retries with exponential backoff on failure

---

## 📁 Files Modified

### **1. `/src/services/webhookService.js`**

**New Methods:**
- `transformToWaybeoFormat(callId, resultData, transcriptData)` - Lines 515-569
  - Transforms internal data to Waybeo's parameters array format
  - Adds only captured/available data points
  
- `deliverTelephonyWebhook(callId, resultData, transcriptData)` - Lines 574-599
  - Updated to send to Waybeo endpoint
  - Requires WAYBEO_AUTH_TOKEN
  - Logs parameter count sent
  
- `makeWaybeoWebhookRequest(url, payload, authToken, attempt)` - Lines 626-656
  - Specialized request handler with Bearer token
  - Retry logic with exponential backoff
  - Enhanced error reporting

**Modified Methods:**
- `processWebhooks()` - Line 707: Now passes `transcriptData` to telephony webhook

### **2. `/src/app/api/webhooks/telephony/route.ts`**

**Changes:**
- Lines 3-26: Updated documentation to reflect Waybeo integration
- Includes required environment variables
- Shows expected payload format

---

## 🧪 Testing

### **1. Test Waybeo Endpoint Directly:**

```bash
curl --location 'https://pbx-uat.waybeo.com/bot-call' \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer YOUR_TOKEN_HERE' \
  --data '{
    "call_id": "test-123",
    "command": "data_record",
    "parameters": [
      {
        "key": "bot_reference_id",
        "value": "bot_test-123"
      },
      {
        "key": "data_capture_status",
        "value": "complete"
      }
    ]
  }'
```

### **2. Make Test Call:**

```bash
# Make a test call through your system
# Monitor PM2 logs to see webhook delivery:

pm2 logs voiceagent-queue-processor --lines 100 | grep -A 5 "Waybeo"

# Expected log output:
# [CALL_ID] 📞 Waybeo webhook delivered successfully: 200
# [CALL_ID] 📊 Data capture status sent: complete
```

### **3. Verify Data Received:**

Check with Waybeo team if they received:
- Correct call_id
- command: "data_record"
- All expected parameters
- Proper authentication

---

## 🚨 Error Handling

### **Common Errors:**

#### **1. Token Not Configured:**
```
⚠️ Waybeo auth token not configured - skipping telephony webhook
```
**Fix:** Add `WAYBEO_AUTH_TOKEN` to `.env` file

#### **2. Authentication Failed:**
```
❌ Waybeo webhook failed: HTTP 401: Unauthorized
```
**Fix:** 
- Check token is correct
- Token may have expired - request new token from Waybeo
- Verify Bearer token format in request

#### **3. Endpoint Unreachable:**
```
❌ Waybeo webhook failed: fetch failed
```
**Fix:**
- Check network connectivity from GCP VM
- Verify Waybeo endpoint URL is correct
- Check firewall allows outbound HTTPS to Waybeo

#### **4. Timeout:**
```
❌ Waybeo webhook failed: timeout
```
**Fix:**
- Increase `WEBHOOK_TIMEOUT_MS` in .env
- Check Waybeo API response time
- Retry will happen automatically (up to 3 attempts)

---

## 📊 Monitoring

### **Check Webhook Delivery:**

```bash
# View queue processor logs
pm2 logs voiceagent-queue-processor --lines 50

# Look for these patterns:
# 🚀 Processing webhooks...
# 📞 Waybeo webhook delivered successfully: 200
# 📊 Data capture status sent: complete
# 📡 Webhook summary: 2 delivered, 0 failed

# Check for errors:
pm2 logs voiceagent-queue-processor --err --lines 50
```

### **Webhook Success Rate:**

Monitor the "Webhook summary" logs to track:
- Total webhooks attempted
- Successful deliveries
- Failed deliveries

Example:
```
[CALL_ID] 📡 Webhook summary: 2 delivered, 0 failed
```
Means both Waybeo and SingleInterface webhooks succeeded.

---

## 🔒 Security Considerations

### **Token Storage:**

✅ **DO:**
- Store token in `.env` file (never in code)
- Set file permissions: `chmod 600 .env`
- Use environment variables in production

❌ **DON'T:**
- Commit token to git repository
- Share token in documentation
- Log full token in application logs

### **Token Rotation:**

When Waybeo provides new token:

```bash
# 1. SSH to GCP VM
ssh your-vm

# 2. Update .env file
nano /opt/voiceagent/.env
# Update WAYBEO_AUTH_TOKEN value

# 3. Restart queue processor (reads new token)
pm2 restart voiceagent-queue-processor

# 4. Verify
pm2 logs voiceagent-queue-processor --lines 20
```

---

## 🚀 Deployment Steps

### **On GCP VM:**

```bash
# 1. SSH into VM
gcloud compute ssh your-vm --zone=your-zone

# 2. Navigate to project
cd /opt/voiceagent

# 3. Pull webhook updates branch
git fetch origin
git checkout v4.3.0-webhook-updates
git pull origin v4.3.0-webhook-updates

# 4. Configure Waybeo credentials
nano .env
# Add:
# WAYBEO_WEBHOOK_URL=https://pbx-uat.waybeo.com/bot-call
# WAYBEO_AUTH_TOKEN=your_token_here

# 5. Restart queue processor (reads webhookService.js)
pm2 restart voiceagent-queue-processor

# 6. Verify service is running
pm2 status

# 7. Make test call and monitor logs
pm2 logs voiceagent-queue-processor --lines 100
```

---

## 📋 Deployment Checklist

- [ ] **Branch checked out**: `v4.3.0-webhook-updates`
- [ ] **Environment variables set**:
  - [ ] `WAYBEO_WEBHOOK_URL` configured
  - [ ] `WAYBEO_AUTH_TOKEN` configured (from Waybeo team)
- [ ] **Services restarted**:
  - [ ] `pm2 restart voiceagent-queue-processor`
- [ ] **Token tested**: Direct curl to Waybeo endpoint succeeds
- [ ] **Test call made**: Full end-to-end test
- [ ] **Logs verified**: Webhook delivery successful in logs
- [ ] **Waybeo confirms**: Data received on their end

---

## 🔄 Payload Examples

### **Example 1: Complete Call**

All 3 data points captured:

```json
{
  "call_id": "18882175837982271",
  "command": "data_record",
  "parameters": [
    {
      "key": "bot_reference_id",
      "value": "bot_18882175837982271"
    },
    {
      "key": "data_capture_status",
      "value": "complete"
    }
  ]
}
```

### **Example 2: Partial Call**

Only some data captured:

```json
{
  "call_id": "18882175837982272",
  "command": "data_record",
  "parameters": [
    {
      "key": "bot_reference_id",
      "value": "bot_18882175837982272"
    },
    {
      "key": "data_capture_status",
      "value": "partial"
    }
  ]
}
```

### **Example 3: Failed Call**

No data captured or early dropoff:

```json
{
  "call_id": "18882175837982273",
  "command": "data_record",
  "parameters": [
    {
      "key": "bot_reference_id",
      "value": "bot_18882175837982273"
    },
    {
      "key": "data_capture_status",
      "value": "none"
    }
  ]
}
```

---

## 🤝 Waybeo Coordination

### **Information to Share with Waybeo:**

1. **Webhook Endpoint**: They don't need to call us - we call them at their bot-call endpoint
2. **Minimal Data**: We only send call_id, bot_reference_id, and data_capture_status
3. **No Customer Data**: Customer information (name, email, etc.) is NOT sent to telephony webhook
4. **Parameters**: Only 2 parameters sent (bot_reference_id, data_capture_status)
5. **Authentication**: Using their Bearer token in Authorization header
6. **Payload Format**: Share example payloads (see above)
7. **Retry Logic**: We retry 3 times with exponential backoff on failure

### **Information to Get from Waybeo:**

1. **Production Endpoint**: URL for live environment
2. **UAT Endpoint**: URL for testing (currently using pbx-uat.waybeo.com)
3. **Bearer Token**: 
   - Production token
   - UAT token
   - Token expiry/refresh mechanism
4. **Rate Limits**: Any API rate limiting we should be aware of
5. **Response Format**: What they send back on success/failure
6. **Error Codes**: Specific error codes and their meanings
7. **Webhook Receipt Confirmation**: How can we verify they received the data

---

## ✅ Summary

**What Was Implemented:**

✅ Waybeo-specific payload format with parameters array  
✅ Bearer token authentication  
✅ Automatic data transformation from internal format  
✅ Retry logic with exponential backoff  
✅ Comprehensive error handling and logging  
✅ Environment-based configuration  
✅ Conditional parameter inclusion (only send captured data)  

**What's Sent:**

- Bot reference ID (always) - Format: `bot_{call_id}`
- Data capture status (always) - Values: `none`, `partial`, `complete`

**What's NOT Sent:**

- Customer name, email, phone number
- Car model or other collected data
- Call duration or timing details
- Conversation language
- Any personally identifiable information (PII)

**All customer data is only sent to SingleInterface webhook, not to telephony webhook.**

**Next Steps:**

1. Deploy to GCP VM with v4.3.0-webhook-updates branch
2. Configure WAYBEO_AUTH_TOKEN in environment
3. Make test calls
4. Verify data received by Waybeo team
5. Monitor logs for any delivery issues

---

**Waybeo Telephony Webhook Integration Complete!** 🎉

