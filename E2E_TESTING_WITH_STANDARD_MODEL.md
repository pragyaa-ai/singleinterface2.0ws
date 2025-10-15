# End-to-End Testing with Standard Model (gpt-realtime)

## Strategy

**Phase 1: Test with Standard Model** (Current)
- ✅ Verify transfer feature works reliably
- ✅ Establish baseline metrics
- ✅ Validate complete flow: conversation → data collection → transfer → webhooks

**Phase 2: Optimize with Mini Model** (After validation)
- Switch to `gpt-4o-mini-realtime-preview-2024-12-17`
- Apply optimizations (already implemented)
- Compare metrics against baseline

---

## Current Configuration (Commit: 4276bd7)

### Model Default: `gpt-realtime`
```typescript
const model = process.env.VOICEAGENT_MODEL || 'gpt-realtime';
```

### Optimizations Applied:
- ✅ Transfer protocol at TOP of instructions
- ✅ Explicit "MUST CALL" language
- ✅ Temperature: 0.7
- ✅ Enhanced tool description
- ✅ Concise instructions

---

## Deploy to GCP VM

### Step 1: Pull Latest Code
```bash
cd /opt/voiceagent
git pull origin v4.3.0-webhook-updates
```

### Step 2: Verify Model Configuration
```bash
# Check if VOICEAGENT_MODEL is set in .env
grep VOICEAGENT_MODEL .env

# If it exists and is set to mini, remove it to use default (gpt-realtime)
# Or explicitly set it:
# echo 'VOICEAGENT_MODEL=gpt-realtime' >> .env
```

### Step 3: Build and Restart
```bash
npm run build
pm2 restart voiceagent-telephony

# Verify the model being used
pm2 logs voiceagent-telephony --lines 50 | grep "Using model"
```

**Expected output:**
```
[ucid] 🤖 Using model: gpt-realtime
```

---

## Test Scenarios

### Scenario 1: Complete Data Collection → Auto Transfer

**Test Flow:**
1. Call the number: `+12695750613`
2. Agent greets in English
3. Provide name: "Rohit Sharma"
4. Provide car model: "XUV700"
5. Provide email: "rohit.sharma@gmail.com"
6. **Expected**: Agent confirms and says transfer message
7. **Expected**: Call transfers to dealer

**Success Criteria:**
```bash
# Check logs for these patterns (replace ucid with actual call ID)
pm2 logs voiceagent-telephony | grep "YOUR_CALL_ID" | grep -E "(Function call completed|Transfer requested|Waybeo transfer)"

# Expected log sequence:
✅ 🔧 Function call completed: transfer_call
✅ 📋 Arguments: {"reason":"data_collected"}
✅ 🔄 Processing transfer_call - Reason: data_collected
✅ 🔄 Transfer requested - Reason: data_collected
✅ 💾 Transcript saved before transfer
✅ ✅ Waybeo transfer successful: {"status":"success"}
✅ 🔍 OBSERVING: Waiting to see if Waybeo sends WebSocket close event...
```

### Scenario 2: Customer Requests Human → Immediate Transfer

**Test Flow:**
1. Call the number
2. When agent asks for details, say: **"I want to speak to a dealer"** or **"मुझे डीलर से बात करनी है"**
3. **Expected**: Agent immediately transfers

**Success Criteria:**
```bash
✅ 🔧 Function call completed: transfer_call
✅ 📋 Arguments: {"reason":"customer_request"}
✅ 🔄 Processing transfer_call - Reason: customer_request
```

### Scenario 3: Multilingual Support

**Test Flow:**
1. Call the number
2. Agent greets in English: "Namaskar... Welcome to Dee Emm Mahindra dealer..."
3. Respond in Hindi: **"हाँ, मुझे XUV700 के बारे में जानना है"**
4. **Expected**: Agent switches to Hindi for rest of conversation
5. Complete data collection in Hindi
6. **Expected**: Transfer happens after data collection

---

## Monitoring & Validation

### Real-time Log Monitoring
```bash
# Watch for transfer events
pm2 logs voiceagent-telephony --lines 0 | grep -E "(Function call|Transfer|Waybeo)"

# Watch for webhook delivery
pm2 logs voiceagent-queue-processor --lines 0 | grep -E "(WEBHOOK|SingleInterface|Waybeo)"
```

### Post-Call Verification

#### 1. Check Transfer Function Called
```bash
# Replace with your actual call ID
CALL_ID="uEhGZR2KTQKErDv-KUG8O"

pm2 logs voiceagent-telephony --lines 500 | grep "$CALL_ID" | grep "Function call completed: transfer_call"
```

#### 2. Check Waybeo Transfer API Success
```bash
pm2 logs voiceagent-telephony --lines 500 | grep "$CALL_ID" | grep "Waybeo transfer successful"
```

#### 3. Check WebSocket Close Event
```bash
pm2 logs voiceagent-telephony --lines 500 | grep "$CALL_ID" | grep "Connection closed"
# Note: Check if Waybeo sends close event after transfer
```

#### 4. Check Transcript Processing
```bash
pm2 logs voiceagent-queue-processor --lines 200 | grep "$CALL_ID"
# Should show: transcript processing → data extraction → webhook delivery
```

#### 5. Check Webhook Delivery
```bash
# SingleInterface webhook
pm2 logs voiceagent-queue-processor --lines 200 | grep "$CALL_ID" | grep "SINGLEINTERFACE WEBHOOK"

# Waybeo webhook
pm2 logs voiceagent-queue-processor --lines 200 | grep "$CALL_ID" | grep "WAYBEO WEBHOOK"
```

---

## Success Metrics to Collect

### Baseline Metrics (Standard Model)

| Metric | Target | How to Measure |
|--------|--------|----------------|
| **Transfer Call Success Rate** | 95%+ | Count "Function call completed: transfer_call" |
| **Waybeo API Success Rate** | 99%+ | Count "Waybeo transfer successful" |
| **Webhook Delivery Rate** | 99%+ | Count webhook success logs |
| **Conversation Quality** | No "Hello" issues | Monitor for speech_stopped without transcript |
| **Language Switching** | 100% | Test all 6 languages |

### Collect These Stats from 10 Test Calls:
```bash
# Transfer function called
grep -c "Function call completed: transfer_call" ~/.pm2/logs/voiceagent-telephony-out.log

# Waybeo API success
grep -c "Waybeo transfer successful" ~/.pm2/logs/voiceagent-telephony-out.log

# Webhook delivery
grep -c "WEBHOOK PAYLOAD" ~/.pm2/logs/voiceagent-queue-processor-out.log

# Conversation issues
grep -c "Empty transcript received" ~/.pm2/logs/voiceagent-telephony-out.log
```

---

## Troubleshooting

### Issue 1: Transfer Function Not Called
**Symptom:**
```
🔊 Assistant: धन्यवाद... हम आपको डीलर से जोड़ रहे हैं
[NO function call logs]
🔌 Connection closed
```

**Fix:**
- This should NOT happen with `gpt-realtime` standard model
- If it does, check:
  1. Model is actually `gpt-realtime` (check logs)
  2. Instructions were loaded correctly (restart PM2)
  3. OpenAI API status

### Issue 2: Waybeo Transfer API Fails
**Symptom:**
```
❌ Waybeo transfer failed: HTTP 400
```

**Fix:**
```bash
# Check auth token
cat .env | grep WAYBEO_AUTH_TOKEN

# Export and restart
export WAYBEO_AUTH_TOKEN="your_token"
pm2 restart voiceagent-queue-processor --update-env
```

### Issue 3: No Webhook Delivery
**Symptom:**
```
⚠️ Waybeo auth token not configured
```

**Fix:**
```bash
# Ensure token is in environment
pm2 env 2 | grep WAYBEO_AUTH_TOKEN

# If missing:
export WAYBEO_AUTH_TOKEN="your_token"
pm2 restart voiceagent-queue-processor --update-env
```

---

## After Successful E2E Testing

Once you've validated **10 successful test calls** with the standard model:

### Switch to Mini Model for Cost Optimization

```bash
cd /opt/voiceagent

# Set mini model
echo 'VOICEAGENT_MODEL=gpt-4o-mini-realtime-preview-2024-12-17' > .env.temp
grep -v VOICEAGENT_MODEL .env > .env.backup
cat .env.backup .env.temp > .env
rm .env.temp .env.backup

# Restart
pm2 restart voiceagent-telephony

# Verify
pm2 logs voiceagent-telephony --lines 20 | grep "Using model"
```

**Expected:**
```
🤖 Using model: gpt-4o-mini-realtime-preview-2024-12-17
```

### Compare Metrics

| Metric | Standard Model | Mini Model | Acceptable? |
|--------|---------------|------------|-------------|
| Transfer Success | 95%+ | 85%+ | ✅ Yes if >85% |
| Cost per Call | $0.24 | $0.06 | 75% cost savings |
| Conversation Quality | Excellent | Good | ✅ Yes if no "Hello" issues |

If mini model shows **< 85% transfer success rate**, consider:
1. Hybrid approach (mini → standard at transfer stage)
2. Server-side fallback (auto-trigger transfer after timeout)
3. Stay with standard model for business-critical calls

---

## Cost Analysis

### Standard Model (gpt-realtime)
- **Cost per minute**: ~$0.24
- **Average call duration**: 3-4 minutes
- **Cost per call**: ~$0.72-$0.96
- **1000 calls/month**: ~$720-$960

### Mini Model (optimized)
- **Cost per minute**: ~$0.06
- **Average call duration**: 3-4 minutes  
- **Cost per call**: ~$0.18-$0.24
- **1000 calls/month**: ~$180-$240

**Potential savings: 75% ($540-$720/month)**

---

## Quick Reference Commands

```bash
# Deploy
cd /opt/voiceagent && git pull origin v4.3.0-webhook-updates && npm run build && pm2 restart voiceagent-telephony

# Check model
pm2 logs voiceagent-telephony --lines 20 | grep "Using model"

# Monitor transfers
pm2 logs voiceagent-telephony --lines 0 | grep -E "(Function call completed|Transfer requested)"

# Check webhooks
pm2 logs voiceagent-queue-processor --lines 0 | grep "WEBHOOK"

# Get call logs
pm2 logs voiceagent-telephony --lines 500 | grep "YOUR_CALL_ID"
```

---

## Ready for Testing! 🚀

Current status:
- ✅ Code updated to use `gpt-realtime` as default
- ✅ Transfer optimizations in place
- ✅ Pushed to remote: commit `4276bd7`

**Next steps:**
1. Deploy to GCP VM (see commands above)
2. Run 5-10 test calls
3. Validate transfer works reliably
4. Check webhook delivery
5. Report results
6. Then optimize with mini model

Let me know when you're ready to deploy and test! 📞

