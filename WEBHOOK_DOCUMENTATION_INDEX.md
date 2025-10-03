# 📚 Webhook Documentation Index

This directory contains comprehensive documentation for the SingleInterface webhook integration.

---

## 📄 **Documentation Files**

### 1️⃣ **SINGLEINTERFACE_WEBHOOK_DETAILS.md** ⭐ **START HERE**
**The Complete Guide** - Everything you need to know about the webhook

**Contents:**
- 📊 Overview and data flow architecture
- 📡 Endpoint details and authentication
- 📦 Complete payload structure with TypeScript types
- 📋 Field-by-field descriptions
- 🎯 Real-world examples (7 scenarios)
- 🔧 Configuration and environment variables
- 📊 Data quality metrics you can calculate
- 🧪 Testing instructions
- 🚨 Troubleshooting guide
- 📚 Integration code examples (Node.js, Python)

**Best for:** Developers integrating with the webhook, understanding the complete system

---

### 2️⃣ **WEBHOOK_QUICK_REFERENCE.md** ⭐ **QUICK LOOKUP**
**The Cheat Sheet** - Fast reference when you need quick answers

**Contents:**
- 📦 Payload structure at a glance
- 🎯 The 3 data points we collect
- 📊 Status flow chart
- 🎨 Remarks status meanings
- 🚨 Dealer routing triggers
- 📉 Dropoff stages visualization
- 📊 Key metrics formulas
- 🧪 Quick test commands
- 🚀 Integration patterns

**Best for:** Quick lookups, testing, implementing specific features

---

### 3️⃣ **WEBHOOK_SAMPLE_PAYLOADS.json** ⭐ **REAL EXAMPLES**
**Sample Data** - Actual webhook payloads for different scenarios

**Contents:**
- ✅ Scenario 1: Complete success (all data collected)
- ⚠️ Scenario 2: Partial data (customer dropped off)
- 🗣️ Scenario 3: Customer requested human agent
- 🔄 Scenario 4: Understanding/communication issues
- ❌ Scenario 5: Early dropout (IVR stage)
- 📧 Scenario 6: No email provided (privacy concern)
- 🌍 Scenario 7: Multilingual conversation
- 📖 Field definitions with types and enums
- 🧪 Testing endpoints and expected responses

**Best for:** Testing your integration, understanding real data, mock data generation

---

### 4️⃣ **WEBHOOK_DEPLOYMENT.md**
**Deployment Guide** - How to deploy the webhook system

**Contents:**
- 📡 Webhook URLs (Telephony + SingleInterface)
- 🔧 Environment variables configuration
- 📊 Payload examples
- 🚀 GCP VM deployment commands
- 🔍 Testing webhook endpoints
- 🛡️ Safety features and error handling
- 📈 Monitoring with PM2 logs
- ✅ Deployment checklist

**Best for:** DevOps, deployment to production, troubleshooting in GCP VM

---

## 🎯 **Quick Start Guide**

### **For First-Time Readers:**

1. **Start with:** `SINGLEINTERFACE_WEBHOOK_DETAILS.md`
   - Read "Overview" and "Data Flow Architecture"
   - Review "Complete Webhook Payload Structure"
   - Study at least 2-3 real-world examples

2. **Then review:** `WEBHOOK_SAMPLE_PAYLOADS.json`
   - Look at the different scenarios
   - Understand the `analysis` section for each
   - Use these as test data

3. **Keep handy:** `WEBHOOK_QUICK_REFERENCE.md`
   - Bookmark this for daily reference
   - Use formulas to calculate metrics
   - Refer to integration patterns

4. **When deploying:** `WEBHOOK_DEPLOYMENT.md`
   - Follow the deployment checklist
   - Configure environment variables
   - Test endpoints after deployment

---

## 📊 **What Data Gets Sent?**

### **Top-Level Metadata:**
- ✅ Call identification (`id`, `call_ref_id`)
- ✅ Timing (`start_time`, `end_time`, `duration`)
- ✅ Vendor info (`call_vendor`, `recording_url`)

### **Customer Data:**
- ✅ Name, Car Model, Email (3 data points)
- ✅ Number of attempts for each
- ✅ Exact timestamps for each attempt
- ✅ Status: verified, not_available, or not_attempted

### **Call Analytics:**
- ✅ Language detected (English, Hindi, Tamil, etc.)
- ✅ Dealer routing decision (route or not)
- ✅ Routing reason (complete, customer request, understanding issues, etc.)
- ✅ Dropoff analysis (when and at what stage)

### **Quality Indicators:**
- ✅ Attempt counts (how many tries per question)
- ✅ Response times (calculated from attempt details)
- ✅ Communication issues detected
- ✅ Overall call quality assessment

---

## 🔄 **Data Flow (Simplified)**

```
Call Ends
    ↓
Transcript Saved (/data/transcripts)
    ↓
Queue Picks Up (every 5 seconds)
    ↓
AI Extracts Data
    ↓
Results Saved (/data/results)
    ↓
🎯 WEBHOOK SENT ← You are here
    ↓
Your System Receives Data
```

**Timing:** ~5-15 seconds after call ends

---

## 🧪 **Testing the Webhook**

### **Check Health:**
```bash
curl https://singleinterfacews.pragyaa.ai/api/webhooks/singleinterface
```

### **Send Test Data:**
```bash
curl -X POST https://singleinterfacews.pragyaa.ai/api/webhooks/singleinterface \
  -H "Content-Type: application/json" \
  -d @WEBHOOK_SAMPLE_PAYLOADS.json
```

### **Monitor Logs (on GCP VM):**
```bash
pm2 logs voiceagent-queue-processor | grep "webhook"
```

---

## 🚨 **Common Questions**

### **Q: When is the webhook sent?**
**A:** Automatically sent 5-15 seconds after call ends, once the queue processor finishes extracting data.

### **Q: What if the webhook fails?**
**A:** System automatically retries 3 times with exponential backoff. Failures don't affect call processing.

### **Q: Do I always get all 3 data points?**
**A:** No. You get whatever the customer provided. Use `remarks` field to check status:
- `"verified"` = got the data
- `"not_available"` = asked but customer didn't provide
- `"not_attempted"` = never asked (call ended early)

### **Q: How do I know if call was successful?**
**A:** Check `dealer_routing.status === true` AND `dealer_routing.reason === "All data collected..."`

### **Q: What languages are supported?**
**A:** English, Hindi, Tamil, Telugu, Kannada, Gujarati, Punjabi. Auto-detected from customer responses.

### **Q: Can I test locally?**
**A:** Yes! The webhook endpoints work locally on `http://localhost:3001/api/webhooks/singleinterface` when running `npm run dev`.

---

## 📈 **Key Metrics to Track**

Use webhook data to calculate these important metrics:

1. **Completion Rate** = (Complete calls / Total calls) × 100
2. **Dropoff Rate** = Count by `dropoff.action` stage
3. **Average Attempts** = Average of all `attempts` fields
4. **Language Distribution** = Count by `language.conversational`
5. **Routing Reasons** = Count by `dealer_routing.reason`
6. **Call Duration** = Average `duration` by outcome
7. **Response Time** = Calculate from `attempts_details` timestamps

See `WEBHOOK_QUICK_REFERENCE.md` for formulas and examples.

---

## 🛠️ **Configuration**

### **Required Environment Variables:**
```bash
WEBHOOKS_ENABLED=true
WEBHOOK_BASE_URL=https://singleinterfacws.pragyaa.ai
```

### **Optional (for external forwarding):**
```bash
SINGLEINTERFACE_WEBHOOK_URL=https://your-api.com/webhook
SINGLEINTERFACE_API_KEY=your_secret_key
WEBHOOK_RETRY_ATTEMPTS=3
WEBHOOK_TIMEOUT_MS=10000
```

---

## 🔗 **Related Documentation**

- **E2E Testing Plan:** `E2E_TESTING_PLAN.md`
- **Admin Dashboard:** `ADMIN_DASHBOARD_README.md`
- **UI Dashboard Plan:** `UI_DASHBOARD_PLAN.md`
- **Release Notes:** `RELEASE_NOTES_v4.4.0.md`, `RELEASE_NOTES_v4.4.1.md`

---

## 💡 **Pro Tips**

1. **Start with mock data:** Use `WEBHOOK_SAMPLE_PAYLOADS.json` to build your integration before testing with real calls.

2. **Monitor attempts:** High `attempts` counts (3+) indicate communication issues - route to human agent.

3. **Language routing:** Use `language.conversational` to route to language-specific dealers.

4. **Priority scoring:** Combine multiple factors (completion, attempts, duration) to score lead quality.

5. **Dropoff analysis:** Track `dropoff.action` to identify where customers are struggling most.

6. **Response time tracking:** Use `attempts_details` timestamps to calculate how long customers take to respond.

7. **Error handling:** Always handle cases where fields are empty or missing - not all calls complete successfully.

---

## 📞 **Need Help?**

1. **First:** Check `SINGLEINTERFACE_WEBHOOK_DETAILS.md` troubleshooting section
2. **Then:** Review `WEBHOOK_SAMPLE_PAYLOADS.json` for similar scenarios
3. **Still stuck?** Check PM2 logs:
   ```bash
   pm2 logs voiceagent-queue-processor --lines 100
   ```

---

**Last Updated:** October 2, 2025  
**Version:** 4.4.3  
**Webhook Endpoint:** https://singleinterfacws.pragyaa.ai/api/webhooks/singleinterface
