# Call Transfer Feature - V2 (Properly Implemented)

## Overview
Real-time call transfer to human agents with proper session closing to trigger async processing.

## What Changed from V1

### V1 Issues (Fixed)
1. ❌ Verbose instructions interfered with conversation flow (causing "Hello" requirement)
2. ❌ Agent didn't actually call the transfer tool (only said the phrase)
3. ❌ Call didn't close after transfer (async processing never triggered)

### V2 Improvements
1. ✅ Concise tool description and instructions
2. ✅ Clear, minimal transfer protocol
3. ✅ Properly closes both websockets after transfer
4. ✅ Removes session to trigger async processing queue
5. ✅ Maintains stable VAD settings (300ms silence_duration)

## Implementation Details

### Transfer Tool
```typescript
{
  name: "transfer_call",
  description: "Transfer call to human agent/dealer",
  parameters: {
    reason: "customer_requested" | "data_complete" | "unable_to_assist"
  }
}
```

### Transfer Handler Flow
1. Log transfer request with reason
2. Save captured data (if any) via `saveSalesDataToFile()`
3. Call Waybeo transfer API
4. **Close OpenAI WebSocket** (`session.openaiWs.close()`)
5. **Close client WebSocket** (`session.client.close()`)
6. **Remove session** (`sessions.delete(ucid)`)
7. Async processing queue picks up the transcript

### Waybeo API Integration
**Endpoint**: `https://pbx-uat.waybeo.com/bot-call`

**Payload**:
```json
{
  "command": "transfer",
  "callId": "call_id_here"
}
```

**Authentication**: Bearer token via `WAYBEO_AUTH_TOKEN`

### Agent Instructions (Minimal)
```
# Completion Protocol
Once all three details collected:
- Thank customer
- Say: "We will now connect you with the Mahindra dealer... Please hold on"
- Call transfer_call tool with reason="data_complete"

# Transfer Protocol
- Customer requests human → call transfer_call with reason="customer_requested"
- Data complete → call transfer_call with reason="data_complete"
- Unable to assist → call transfer_call with reason="unable_to_assist"
```

## Transfer Scenarios

### Scenario 1: Data Collection Complete
```
Agent: "Great, thanks for providing these details."
Agent: "We will now connect you with the Mahindra dealer near you... Please hold on."
[Calls transfer_call tool with reason="data_complete"]
[Saves data, calls Waybeo API, closes connections]
[Async processing begins]
```

### Scenario 2: Customer Requests Transfer
```
Customer: "I want to talk to a dealer"
Agent: [Calls transfer_call tool with reason="customer_requested"]
[Saves partial data, calls Waybeo API, closes connections]
[Async processing begins]
```

### Scenario 3: Unable to Assist
```
Agent: [After multiple failed attempts]
[Calls transfer_call tool with reason="unable_to_assist"]
[Saves partial data, calls Waybeo API, closes connections]
[Async processing begins]
```

## Deployment Steps

### 1. On GCP VM - Pull Latest Code
```bash
cd /opt/voiceagent
git pull origin v4.3.0-webhook-updates
```

### 2. Verify Environment Variable
```bash
cat .env | grep WAYBEO_AUTH_TOKEN
# Should show: WAYBEO_AUTH_TOKEN=your_token
```

### 3. Restart Telephony Service
```bash
pm2 restart voiceagent-telephony --update-env
```

### 4. Verify Service Started
```bash
pm2 logs voiceagent-telephony --lines 50
# Should see: "WebSocket server listening on http://0.0.0.0:8080"
```

### 5. Monitor Transfer Logs
```bash
# During a test call, monitor for transfer activity
pm2 logs voiceagent-telephony --lines 100 | grep -E "transfer|Transfer"
```

## Expected Log Output

### Successful Transfer
```
[call_id] 📞 Call transfer requested - Reason: data_complete
[call_id] 💾 Saving data before transfer: { full_name, car_model, email_id }
[call_id] 🔄 Initiating Waybeo transfer...
[call_id] 📡 Payload: {"command":"transfer","callId":"..."}
[call_id] ✅ Waybeo transfer API successful
[call_id] ✅ Call transferred successfully
[call_id] 🔌 Closing connections after transfer...
[call_id] 🏁 Session ended - async processing will begin
```

### Transfer API Failure
```
[call_id] 📞 Call transfer requested - Reason: data_complete
[call_id] 🔄 Initiating Waybeo transfer...
[call_id] ❌ Waybeo transfer API failed: HTTP 400: Bad Request
[call_id] ❌ Transfer failed: Error message
```

### Missing Auth Token
```
[call_id] 📞 Call transfer requested - Reason: customer_requested
[call_id] ❌ Waybeo auth token not configured
[call_id] ❌ Transfer failed: Waybeo auth token not configured
```

## Testing Checklist

- [ ] Pull latest code to GCP VM
- [ ] Verify WAYBEO_AUTH_TOKEN is set
- [ ] Restart telephony service
- [ ] Verify service starts without errors
- [ ] Test call with data collection complete → auto transfer
- [ ] Verify transfer logs show API call
- [ ] Verify connections close after transfer
- [ ] Verify async queue processes the call
- [ ] Verify webhooks deliver successfully
- [ ] Test customer-requested transfer ("I want to talk to dealer")
- [ ] Verify no "Hello" issue in conversation flow

## Version Info

- **Branch**: v4.3.0-webhook-updates
- **Stable Checkpoint**: v4.3.1-stable-webhooks (before transfer)
- **Current Commit**: 427213d (with proper transfer)
- **Files Modified**: src/server/telephony/index.ts

## Rollback Procedure

If issues occur, rollback to stable checkpoint:
```bash
cd /opt/voiceagent
git checkout v4.3.1-stable-webhooks
pm2 restart voiceagent-telephony --update-env
```

---

**Key Success Criteria**: 
1. Normal conversation flow without "Hello" prompts ✅
2. Transfer tool actually called when needed ✅
3. Call properly closes to trigger async processing ✅
4. Webhooks deliver after transfer ✅

