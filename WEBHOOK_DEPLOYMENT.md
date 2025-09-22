# 🚀 Webhook System Deployment Guide

## 📡 **Webhook URLs Available:**

### **1. Telephony Vendor Webhook**
- **URL:** `https://singleinterfacews.pragyaa.ai/api/webhooks/telephony`
- **Method:** POST
- **Purpose:** Simple notifications for telephony vendor

### **2. Single Interface Webhook**  
- **URL:** `https://singleinterfacws.pragyaa.ai/api/webhooks/singleinterface`
- **Method:** POST
- **Purpose:** Complete call analytics matching Single Interface API

## 🔧 **Environment Variables to Add:**

Add these to your `.env` file on the GCP VM:

```bash
# Webhook Configuration
WEBHOOKS_ENABLED=true
WEBHOOK_BASE_URL=https://singleinterfacws.pragyaa.ai
WEBHOOK_RETRY_ATTEMPTS=3
WEBHOOK_TIMEOUT_MS=10000

# External Webhook URLs (configure with actual endpoints)
TELEPHONY_VENDOR_WEBHOOK_URL=https://your-telephony-vendor.com/webhook
SINGLEINTERFACE_WEBHOOK_URL=https://your-singleinterface-api.com/webhook
SINGLEINTERFACE_API_KEY=your_api_key_here
```

## 📊 **Webhook Payloads:**

### **Telephony Vendor Payload (Simple):**
```json
{
  "call_id": "18882175837982271",
  "processed_at": "2025-09-21T10:30:00Z",
  "success": true,
  "overall_status": "complete"
}
```

### **Single Interface Payload (Complete - Matches Their API):**
```json
{
  "id": "bot_18882175837982271",
  "call_ref_id": "18882175837982271",
  "call_vendor": "Ozonetel",
  "recording_url": "https://singleinterfacws.pragyaa.ai/recordings/call_18882175837982271.mp3",
  "start_time": "2025-09-22 10:00:00",
  "end_time": "2025-09-22 10:15:00",
  "duration": 900,
  "language": {
    "welcome": "english",
    "conversational": "hindi"
  },
  "dealer_routing": {
    "status": true,
    "reason": "call completed",
    "time": "2025-09-22 10:15:00"
  },
  "dropoff": {
    "time": "",
    "action": ""
  },
  "response_data": [
    {
      "key_label": "What's your name",
      "key_value": "name",
      "key_response": "John Smith",
      "attempts": 1,
      "attempts_details": [
        {
          "start_time": "2025-09-22 10:01:00",
          "end_time": "2025-09-22 10:01:05",
          "sequence": 1
        }
      ],
      "remarks": "verified"
    }
  ]
}
```

## 🚀 **Deployment Commands for GCP VM:**

```bash
# 1. Navigate to project directory
cd /opt/voiceagent

# 2. Pull latest webhook implementation
git pull origin main

# 3. Install new dependency (node-fetch)
npm install

# 4. Build Next.js with new webhook endpoints
npm run build

# 5. Restart services to apply webhook integration
pm2 restart voiceagent-queue-processor
pm2 restart voiceagent-next

# 6. Verify services are running
pm2 status

# 7. Test webhook endpoints
curl -X GET https://singleinterfacws.pragyaa.ai/api/webhooks/telephony
curl -X GET https://singleinterfacws.pragyaa.ai/api/webhooks/singleinterface
```

## 🔍 **Testing Webhooks:**

### **1. Test Telephony Webhook:**
```bash
curl -X POST https://singleinterfacws.pragyaa.ai/api/webhooks/telephony \
  -H "Content-Type: application/json" \
  -d '{
    "call_id": "test123",
    "processed_at": "2025-09-22T10:00:00Z",
    "success": true,
    "overall_status": "complete"
  }'
```

### **2. Test Single Interface Webhook:**
```bash
curl -X POST https://singleinterfacws.pragyaa.ai/api/webhooks/singleinterface \
  -H "Content-Type: application/json" \
  -d '{
    "id": "bot_test123",
    "call_ref_id": "test123",
    "call_vendor": "Ozonetel",
    "start_time": "2025-09-22 10:00:00",
    "end_time": "2025-09-22 10:05:00"
  }'
```

## 🛡️ **Safety Features:**

- ✅ **Non-blocking**: Webhooks run in background, won't affect call processing
- ✅ **Error isolation**: Webhook failures don't break call processing  
- ✅ **Retry logic**: 3 automatic retries with exponential backoff
- ✅ **Timeout protection**: 10-second timeout prevents hanging
- ✅ **Optional execution**: Can be disabled via `WEBHOOKS_ENABLED=false`

## 📈 **Monitoring:**

Monitor webhook delivery in PM2 logs:
```bash
# Watch queue processor logs for webhook activity
pm2 logs voiceagent-queue-processor --lines 50

# Look for these log patterns:
# 🚀 Processing webhooks...
# 📞 Telephony webhook delivered successfully
# 🎯 Single Interface webhook delivered successfully  
# 📡 Webhook summary: 2 delivered, 0 failed
```

## 🔧 **Configuration Notes:**

1. **WEBHOOK_BASE_URL**: Used for internal webhook routing and recording URLs
2. **External URLs**: Configure actual endpoints where you want data delivered
3. **API Keys**: Add authentication tokens for external services
4. **Retry Logic**: Configurable attempts and timeout for reliability

## ✅ **Deployment Checklist:**

- [ ] Code pulled and npm install completed
- [ ] Environment variables configured
- [ ] Services restarted with PM2
- [ ] Webhook endpoints accessible via curl
- [ ] First test call processed with webhook delivery
- [ ] External webhook URLs configured (when ready)
- [ ] Monitoring set up for webhook delivery logs

The webhook system is now ready and will automatically trigger after each call is processed! 🎉
