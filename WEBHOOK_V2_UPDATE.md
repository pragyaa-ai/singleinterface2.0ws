# 🔄 SingleInterface Webhook v2.0 Update

**Branch:** `v4.3.0-webhook-updates`  
**Date:** October 10, 2025  
**Status:** Updated to match new requirements

---

## 📊 Updated Webhook Structure

### **Endpoint:**
`POST https://singleinterfacews.pragyaa.ai/api/webhooks/singleinterface`

### **New Payload Format (v2.0):**

```json
{
  "id": "bot_18882175837982271",
  "call_ref_id": "18882175837982271",
  "call_vendor": "Waybeo",
  "recording_url": "https://test.mp3",
  "start_time": "2025-09-22 10:00:00",
  "end_time": "2025-09-22 10:15:00",
  "Duration": 54,
  "Store_code": 10001,
  "Customer_number": 9898989898,
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
    "time": "2025-09-22 10:12:00",
    "action": "email"
  },
  "response_data": [
    {
      "key_label": "What's your name",
      "key_value": "name",
      "key_response": "Vipin",
      "attempts": 2,
      "attempts_details": [
        {
          "start_time": "2025-09-22 10:01:00",
          "end_time": "2025-09-22 10:01:05",
          "sequence": 1
        },
        {
          "start_time": "2025-09-22 10:01:10",
          "end_time": "2025-09-22 10:01:15",
          "sequence": 2
        }
      ],
      "remarks": "verified"
    },
    {
      "key_label": "Which model you are looking for",
      "key_value": "model",
      "key_response": "Sonet",
      "attempts": 1,
      "attempts_details": [
        {
          "start_time": "2025-09-22 10:02:00",
          "end_time": "2025-09-22 10:02:05",
          "sequence": 1
        }
      ],
      "remarks": "verified"
    },
    {
      "key_label": "What is your email id",
      "key_value": "email",
      "key_response": "",
      "attempts": 0,
      "attempts_details": [],
      "remarks": "Call disconnected by user"
    }
  ]
}
```

---

## ✨ What's New (v2.0 Changes)

### **1. New Fields Added:**

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| **`Store_code`** | number | Store identifier from telephony vendor | `10001` |
| **`Customer_number`** | number | Customer phone number (caller ID or DID) | `9898989898` |

### **2. Field Name Changes:**

| Old Field | New Field | Change |
|-----------|-----------|--------|
| `duration` | `Duration` | **Capital D** |

### **3. Vendor Update:**

| Old Value | New Value |
|-----------|-----------|
| `call_vendor: "Ozonetel"` | `call_vendor: "Waybeo"` |

### **4. Dealer Routing Reasons Updated:**

**New standardized reasons:**
- `"Unable to understand answers"` (was: "Unable to understand customer responses")
- `"User decided"` (was: "Customer requested to speak with dealer")
- `"call completed"` (was: "All data collected - routing to dealer")

### **5. Dropoff Actions Extended:**

**Now supports:**
- `ivr` - Dropoff during IVR/greeting
- `name` - Dropoff at name question
- `model` - Dropoff at car model question
- `email` - Dropoff at email question
- **`qq1`** - NEW: Dropoff at qualifying question 1
- **`qq2`** - NEW: Dropoff at qualifying question 2

---

## 🔧 Implementation Details

### **Store_code Extraction:**

The system tries to extract Store_code from multiple possible sources:
1. `transcriptData.store_code` or `transcriptData.Store_code`
2. `transcriptData.metadata.store_code`
3. Default: `10001` if not provided

**How to provide Store_code:**
- Pass it from telephony vendor in session metadata
- Or configure per-deployment in environment variables

### **Customer_number Extraction:**

The system tries to extract Customer_number from:
1. `transcriptData.customer_number` or `transcriptData.Customer_number`
2. `transcriptData.caller_id` (caller's phone number)
3. `transcriptData.did` (dialed number from Waybeo)
4. `transcriptData.phone_number`
5. `transcriptData.metadata.customer_number`
6. Default: `9999999999` if not provided

**Auto-cleaning:** Removes any non-digit characters and ensures numeric format.

---

## 📁 Files Modified

### **1. `/src/services/webhookService.js`**

**Changes:**
- Added `extractStoreCode()` method
- Added `extractCustomerNumber()` method
- Updated `transformToSingleInterfaceFormat()` to include new fields
- Changed field name: `duration` → `Duration`
- Updated `call_vendor` from "Ozonetel" to "Waybeo"
- Updated dealer routing reasons to match v2 format
- Extended dropoff action mapping to support `qq1` and `qq2`

**Line Changes:**
- Lines 25-71: Main transformation function updated
- Lines 88-123: New extraction methods added
- Lines 144-170: Dealer routing reasons updated
- Lines 253-271: Dropoff action mapping extended

### **2. `/src/app/api/webhooks/singleinterface/route.ts`**

**Changes:**
- Updated API documentation comments to v2.0
- Updated logging to include new fields (`Store_code`, `Customer_number`, `Duration`)
- Updated health check endpoint to show v2.0 fields and supported values
- Added `api_version: '2.0'` to health check response

**Line Changes:**
- Lines 3-15: Documentation updated
- Lines 22-31: Logging updated
- Lines 93-112: Health check endpoint updated

---

## 🧪 Testing the Updated Webhook

### **1. Health Check:**

```bash
curl https://singleinterfacews.pragyaa.ai/api/webhooks/singleinterface

# Expected response:
{
  "status": "healthy",
  "endpoint": "singleinterface-webhook",
  "api_version": "2.0",
  "supported_fields": [
    "id", "call_ref_id", "call_vendor", "recording_url",
    "start_time", "end_time", "Duration", "Store_code", "Customer_number",
    "language", "dealer_routing", "dropoff", "response_data"
  ],
  "dealer_routing_reasons": [
    "Unable to understand answers", "User decided", "call completed"
  ],
  "dropoff_actions": [
    "ivr", "name", "model", "email", "qq1", "qq2"
  ]
}
```

### **2. Test Payload:**

```bash
curl -X POST https://singleinterfacews.pragyaa.ai/api/webhooks/singleinterface \
  -H "Content-Type: application/json" \
  -d '{
    "id": "bot_test123",
    "call_ref_id": "test123",
    "call_vendor": "Waybeo",
    "recording_url": "https://test.mp3",
    "start_time": "2025-10-10 10:00:00",
    "end_time": "2025-10-10 10:05:00",
    "Duration": 300,
    "Store_code": 10001,
    "Customer_number": 9898989898,
    "language": {
      "welcome": "english",
      "conversational": "hindi"
    },
    "dealer_routing": {
      "status": true,
      "reason": "call completed",
      "time": "2025-10-10 10:05:00"
    },
    "dropoff": {
      "time": "",
      "action": ""
    },
    "response_data": []
  }'
```

---

## 🚀 Deployment Steps

### **On GCP VM:**

```bash
# 1. SSH into VM
gcloud compute ssh your-vm --zone=your-zone

# 2. Navigate to project
cd /opt/voiceagent

# 3. Pull the v4.3.0-webhook-updates branch
git fetch origin
git checkout v4.3.0-webhook-updates
git pull origin v4.3.0-webhook-updates

# 4. Install dependencies (if any new ones)
npm install

# 5. Rebuild Next.js
npm run build

# 6. Restart services
pm2 restart voiceagent-next
pm2 restart voiceagent-queue-processor

# 7. Verify services
pm2 status
pm2 logs --lines 50

# 8. Test webhook endpoint
curl https://your-domain.com/api/webhooks/singleinterface
```

---

## 📋 Validation Checklist

After deployment, verify:

- [ ] **Health check returns v2.0**
  ```bash
  curl https://your-domain.com/api/webhooks/singleinterface | jq '.api_version'
  # Should return: "2.0"
  ```

- [ ] **New fields in health check**
  ```bash
  curl https://your-domain.com/api/webhooks/singleinterface | jq '.supported_fields'
  # Should include: "Duration", "Store_code", "Customer_number"
  ```

- [ ] **Make test call and check webhook payload**
  - Logs should show `Store_code` and `Customer_number`
  - Field name should be `Duration` (capital D)
  - Vendor should be `Waybeo`

- [ ] **Verify dealer routing reasons**
  - Should use: "call completed", "User decided", "Unable to understand answers"

- [ ] **Test dropoff with qq1/qq2** (if applicable)
  - Ensure qq1/qq2 values are recognized in dropoff.action

---

## 🔄 Backward Compatibility

### **Breaking Changes:**

1. **Field name**: `duration` → `Duration` (capital D)
   - **Impact:** Consumers expecting lowercase `duration` will need to update
   
2. **Call vendor**: Changed from "Ozonetel" to "Waybeo"
   - **Impact:** Systems filtering by vendor name need to update

3. **Dealer routing reasons**: Wording changed
   - **Impact:** Systems parsing reason text need to update

### **Non-Breaking Additions:**

1. **New fields**: `Store_code` and `Customer_number`
   - Added fields don't break existing consumers
   - Consumers can optionally use new fields

2. **Extended dropoff actions**: Added `qq1` and `qq2`
   - Existing actions still work
   - New actions are optional

---

## 📝 Notes for Customer Integration

### **Providing Store_code:**

**Option 1:** Pass from Waybeo webhook
```javascript
// In Waybeo webhook configuration, add custom metadata:
{
  "store_code": 10001,
  // ... other fields
}
```

**Option 2:** Configure per deployment
```bash
# In .env file:
DEFAULT_STORE_CODE=10001
```

### **Customer_number Source:**

- Will automatically extract from Waybeo's `did` field (dialed number)
- Or from `caller_id` if available
- Fallback to default `9999999999` if not provided

---

## ✅ Summary of Changes

| Change Type | Details | Status |
|-------------|---------|--------|
| New Field | `Store_code` | ✅ Added |
| New Field | `Customer_number` | ✅ Added |
| Field Rename | `duration` → `Duration` | ✅ Updated |
| Vendor Update | Ozonetel → Waybeo | ✅ Updated |
| Routing Reasons | Standardized to 3 values | ✅ Updated |
| Dropoff Actions | Added qq1, qq2 | ✅ Extended |
| API Version | 1.0 → 2.0 | ✅ Incremented |

---

## 🔗 Related Documentation

- Original webhook: `WEBHOOK_DEPLOYMENT.md`
- Service implementation: `src/services/webhookService.js`
- API endpoint: `src/app/api/webhooks/singleinterface/route.ts`

---

**Webhook v2.0 Update Complete!** 🎉

All changes are backward-compatible except for the field name changes noted above.

