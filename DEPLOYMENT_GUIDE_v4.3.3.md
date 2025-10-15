# Deployment Guide - v4.3.3 Live Release

## 🎯 Quick Deployment to GCP VM

### Prerequisites
- GCP VM access
- Git repository access
- Environment variables configured

---

## 📦 Deploy Stable v4.3.3 to Production

### Step 1: Switch to Stable Branch

```bash
cd /opt/voiceagent
git fetch origin
git checkout v4.3.0-live
git pull origin v4.3.0-live
```

**Verify you're on the correct branch:**
```bash
git branch
# Should show: * v4.3.0-live

git log --oneline -1
# Should show: 578c6fb chore: Release v4.3.3 - Stable production release
```

### Step 2: Install Dependencies (if needed)

```bash
npm install
```

### Step 3: Build Application

```bash
npm run build
```

**Expected output:**
```
✓ Compiled successfully
✓ Checking validity of types
✓ Collecting page data
✓ Generating static pages
✓ Finalizing page optimization
```

### Step 4: Configure Environment Variables

**Check required variables:**
```bash
cat .env | grep -E "OPENAI_API_KEY|WAYBEO_AUTH_TOKEN|WAYBEO_WEBHOOK_URL"
```

**If missing, add them:**
```bash
# Add/update in .env file
echo 'OPENAI_API_KEY=<your_key>' >> .env
echo 'WAYBEO_AUTH_TOKEN=<your_jwt_token>' >> .env
echo 'WAYBEO_WEBHOOK_URL=https://pbx-uat.waybeo.com/bot-call' >> .env
```

**Export for PM2:**
```bash
export OPENAI_API_KEY="<your_key>"
export WAYBEO_AUTH_TOKEN="<your_jwt_token>"
```

### Step 5: Restart Services

```bash
# Restart telephony service
pm2 restart voiceagent-telephony --update-env

# Restart queue processor (important for webhooks)
pm2 restart voiceagent-queue-processor --update-env

# Save PM2 configuration
pm2 save
```

### Step 6: Verify Deployment

**Check services are running:**
```bash
pm2 status
```

**Expected output:**
```
┌────┬────────────────────────┬─────────┬─────────┬──────────┐
│ id │ name                   │ mode    │ status  │ cpu      │
├────┼────────────────────────┼─────────┼─────────┼──────────┤
│ 1  │ voiceagent-telephony   │ cluster │ online  │ 0%       │
│ 2  │ voiceagent-queue-…     │ fork    │ online  │ 0%       │
└────┴────────────────────────┴─────────┴─────────┴──────────┘
```

**Check model configuration:**
```bash
pm2 logs voiceagent-telephony --lines 20 | grep "Using model"
```

**Expected:**
```
🤖 Using model: gpt-realtime
```

**Check for errors:**
```bash
pm2 logs voiceagent-telephony --err --lines 50
pm2 logs voiceagent-queue-processor --err --lines 50
```

### Step 7: Test Transfer Feature

**Make a test call:**
1. Call your agent number
2. Provide Name, Car Model, Email
3. Verify transfer happens smoothly

**Monitor logs in real-time:**
```bash
# Terminal 1: Watch telephony service
pm2 logs voiceagent-telephony --lines 0

# Terminal 2: Watch queue processor
pm2 logs voiceagent-queue-processor --lines 0
```

**Look for successful transfer:**
```bash
✅ Function call completed: transfer_call
✅ Function response sent - agent can now generate speech
✅ Speech completion wait finished - executing transfer now
✅ Waybeo transfer successful
```

---

## 🔄 Rollback Procedure (if needed)

### If Issues Arise

**Option 1: Rollback to Previous Stable Tag**
```bash
cd /opt/voiceagent
git checkout v4.3.2-stable  # Last known good version
npm run build
pm2 restart voiceagent-telephony
pm2 restart voiceagent-queue-processor
```

**Option 2: Rollback to Specific Commit**
```bash
cd /opt/voiceagent
git checkout bc22c73  # v4.3.2 stable
npm run build
pm2 restart voiceagent-telephony
pm2 restart voiceagent-queue-processor
```

---

## 🧪 Testing Checklist

After deployment, verify:

### Basic Functionality
- [ ] Agent answers inbound calls
- [ ] Greeting in English works
- [ ] Language switching works (test Hindi)
- [ ] Data collection works (Name, Car Model, Email)
- [ ] Confirmation protocol works

### Transfer Feature
- [ ] Agent responds immediately after 3rd data point (no silence)
- [ ] Complete transfer message delivered
- [ ] Message says "Let me transfer you to dealer closest to you... Please hold on"
- [ ] Brief pause after message (~2-3 seconds)
- [ ] Call transfers successfully
- [ ] No "Hello" blocking issues

### Webhooks
- [ ] SingleInterface webhook delivered
- [ ] Waybeo telephony webhook delivered
- [ ] Check queue processor logs for webhook success

### Multilingual
- [ ] Test Hindi conversation → transfer
- [ ] Test English conversation → transfer
- [ ] Verify transfer message in correct language

---

## 📊 Monitoring

### Real-Time Logs

**Watch for issues:**
```bash
# All logs
pm2 logs

# Specific service
pm2 logs voiceagent-telephony
pm2 logs voiceagent-queue-processor

# Filter for errors
pm2 logs --err

# Filter for specific call ID
pm2 logs voiceagent-telephony | grep "YOUR_CALL_ID"
```

### Key Metrics to Track

**Call Volume:**
```bash
grep -c "Connected to VoiceAgent Realtime API" ~/.pm2/logs/voiceagent-telephony-out.log
```

**Transfer Success Rate:**
```bash
# Count successful transfers
grep -c "Waybeo transfer successful" ~/.pm2/logs/voiceagent-telephony-out.log

# Count transfer function calls
grep -c "Function call completed: transfer_call" ~/.pm2/logs/voiceagent-telephony-out.log
```

**Webhook Delivery:**
```bash
# SingleInterface webhooks
grep -c "SINGLEINTERFACE WEBHOOK PAYLOAD" ~/.pm2/logs/voiceagent-queue-processor-out.log

# Waybeo webhooks
grep -c "WAYBEO WEBHOOK PAYLOAD" ~/.pm2/logs/voiceagent-queue-processor-out.log
```

---

## 🚨 Troubleshooting

### Issue: PM2 Won't Load Environment Variables

**Symptom:**
```
⚠️ Waybeo auth token not configured
```

**Fix:**
```bash
# Export in shell
export WAYBEO_AUTH_TOKEN="your_token_here"

# Restart with --update-env
pm2 restart voiceagent-queue-processor --update-env

# Verify
pm2 env 2 | grep WAYBEO_AUTH_TOKEN
```

### Issue: Build Fails

**Symptom:**
```
Error: Dynamic server usage
```

**Fix:**
```bash
# This is a Next.js warning, can be ignored
# The build still succeeds, check final output
```

### Issue: Transfer Function Not Called

**Symptom:**
```
Agent: "Thank you for all the details"
[No function call logs]
[Call just ends]
```

**Diagnosis:**
```bash
# Check if tool_choice is in code
grep "tool_choice" src/server/telephony/index.ts
# Should show: tool_choice: "auto",

# Verify commit
git log --oneline -1
# Should be: 578c6fb or later
```

**Fix:**
```bash
git pull origin v4.3.0-live
npm run build
pm2 restart voiceagent-telephony --update-env
```

---

## 📝 Post-Deployment Checklist

- [ ] Services started successfully
- [ ] No errors in logs
- [ ] Model is `gpt-realtime`
- [ ] Environment variables loaded
- [ ] Test call completed successfully
- [ ] Transfer feature working
- [ ] Webhooks delivered
- [ ] PM2 configuration saved
- [ ] Deployment documented
- [ ] Team notified

---

## 🔐 Security Notes

- ✅ API keys stored in environment variables (not in code)
- ✅ Auth tokens not logged in plaintext
- ✅ HTTPS for all external API calls
- ✅ Bearer token authentication for Waybeo

---

## 📞 Support

### If You Encounter Issues

**Check documentation:**
- `RELEASE_NOTES_v4.3.3.md` - Release details
- `BLOCKING_DELAY_FIX.md` - Non-blocking execution
- `E2E_TESTING_WITH_STANDARD_MODEL.md` - Testing guide

**Review logs:**
```bash
# Last 100 lines from telephony service
pm2 logs voiceagent-telephony --lines 100 --nostream

# Last 100 lines from queue processor
pm2 logs voiceagent-queue-processor --lines 100 --nostream
```

**Common solutions:**
1. Restart services: `pm2 restart all --update-env`
2. Rebuild application: `npm run build`
3. Check environment: `pm2 env <id>`
4. Rollback if needed (see Rollback Procedure)

---

## ✅ Success Criteria

Deployment is successful when:
- ✅ All PM2 services show "online" status
- ✅ Model logs show "gpt-realtime"
- ✅ Test call transfers successfully
- ✅ Complete transfer message delivered
- ✅ No blocking/silence issues
- ✅ Webhooks delivered to both endpoints
- ✅ No critical errors in logs

---

**Deployed Version:** v4.3.3  
**Branch:** v4.3.0-live  
**Tag:** v4.3.3-live  
**Status:** Production Ready ✅

