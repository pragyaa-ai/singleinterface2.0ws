# 🔧 HOTFIX: Transcript File & Sales Data Issues (v4.3.0)

**Date**: October 7, 2025  
**Type**: Critical Bug Fix  
**Priority**: HIGH  
**Status**: Ready for Deployment

---

## 🐛 Issues Identified

### **Issue #1: Transcript Files Not Created After Call Ends**
**Symptom:**
- When testing on GCP VM with non-Ozonetel telephony vendor
- Call logs show successful conversation
- Data is collected during call
- But transcript file is NOT created in `/data/transcripts/` after hangup
- Works fine with Ozonetel (sends proper "stop" event)

**Root Cause:**
```typescript
// BEFORE: Transcript only saved in WebSocket 'close' handler
ws.on('close', () => {
  saveTranscriptForProcessing(session); // Line 1181
});

// But if telephony vendor doesn't send proper close frame...
// Transcript is never saved!
```

**Impact:**
- Async queue processor cannot run (no transcript file)
- Webhook data extraction fails
- Call data incomplete in admin dashboard

---

### **Issue #2: Sales Data Shows as 'undefined' Despite Being Collected**
**Symptom:**
```
[CALL_ID] 🔊 Assistant: "I've noted your full name as Gulshan Mehta. Is this correct?"
[CALL_ID] 📝 Transcription completed: "Yes"
...
[CALL_ID] 🎯 capture_all_sales_data called
[CALL_ID] 📋 Available Data: { 
  full_name: undefined, 
  car_model: undefined, 
  email_id: undefined 
}
```

**Root Cause:**
```typescript
// Line 1073-1074: Real-time data extraction was DISABLED
// 🔄 DECOUPLED: Real-time processing removed - will be handled by async processor
console.log(`[${ucid}] 📤 Transcript collected for async processing`);

// extractSalesData() function exists but is NEVER CALLED
// So session.salesData remains empty!
```

**Impact:**
- `capture_all_sales_data` tool has no data to work with
- Call status shows "no_data" even when all 3 fields were collected
- Admin dashboard shows incomplete call records

---

## ✅ Fixes Applied

### **Fix #1: Save Transcript in BOTH Stop Event AND Close Event**

**File**: `src/server/telephony/index.ts`  
**Lines**: 1149-1181

**Change:**
```typescript
// BEFORE: Only saved on WebSocket close
if (msg.event === 'stop') {
  if (session) {
    // ... capture call analytics ...
    saveSalesDataToFile(session);  // Only saves basic sales data
    session.openaiWs.close();
    sessions.delete(session.ucid);
  }
}

// AFTER: Save transcript BEFORE cleanup
if (msg.event === 'stop') {
  if (session) {
    console.log(`[${session.ucid}] 🛑 Stop event received from telephony vendor`);
    
    // Capture call analytics
    if (session.callAnalytics) {
      session.callAnalytics.callEndTime = Date.now();
    }
    
    // 🔄 CRITICAL FIX: Save transcript BEFORE cleanup
    console.log(`[${session.ucid}] 💾 Saving transcript for async processing...`);
    const transcriptResult = saveTranscriptForProcessing(session);
    if (transcriptResult) {
      console.log(`[${session.ucid}] ✅ Transcript saved: ${transcriptResult.transcriptFile}`);
    }
    
    // Then save sales data and cleanup
    saveSalesDataToFile(session);
    session.openaiWs.close();
    sessions.delete(session.ucid);
  }
}
```

**Result:**
- ✅ Transcript file created when telephony vendor sends "stop" event
- ✅ Transcript file created when WebSocket closes (fallback)
- ✅ Works with ALL telephony vendors (not just Ozonetel)

---

### **Fix #2: Re-Enable Real-Time Data Extraction**

**File**: `src/server/telephony/index.ts`  
**Lines**: 1073-1076

**Change:**
```typescript
// BEFORE: Data extraction disabled
// 🔄 DECOUPLED: Real-time processing removed
console.log(`[${ucid}] 📤 Transcript collected for async processing`);

// AFTER: Re-enable real-time extraction
// 🔄 CRITICAL FIX: Re-enable real-time data extraction
// This ensures session.salesData is populated for capture_all_sales_data tool
extractSalesData(session, event.transcript);
console.log(`[${ucid}] 📤 Transcript collected for async processing`);
```

**Result:**
- ✅ `session.salesData` populated in real-time as user speaks
- ✅ `capture_all_sales_data` has access to collected data
- ✅ Call status correctly shows "complete" when all 3 fields captured
- ✅ Both real-time AND async processing work

---

## 📊 Expected Log Output (After Fix)

### **On Transcript Completion:**
```
[CALL_ID] 📝 Transcription completed: "Gulshan Mehta"
[CALL_ID] 🔍 Starting data extraction from: "Gulshan Mehta"
[CALL_ID] 📝 Captured Name: Gulshan Mehta
[CALL_ID] 📚 Transcripts buffer: ['Gulshan Mehta', ...]
[CALL_ID] 📤 Transcript collected for async processing
```

### **On Call End (Stop Event):**
```
[CALL_ID] 🛑 Stop event received from telephony vendor
[CALL_ID] ⏱️ Total call duration: 65432ms (65s)
[CALL_ID] 💾 Saving transcript for async processing...
[CALL_ID] 📄 Transcript saved: call_CALL_ID_1234567890_transcript.json
[CALL_ID] ✅ Transcript saved: call_CALL_ID_1234567890_transcript.json
[CALL_ID] 📋 Call ended - saving partial data
[CALL_ID] 💾 Sales data saved to: call_CALL_ID_1234567890.json
```

### **On capture_all_sales_data Call:**
```
[CALL_ID] 🎯 capture_all_sales_data called - signaling call completion
[CALL_ID] 🎯 SDK Finalizing Data - Status: complete
[CALL_ID] 📋 Available Data: { 
  full_name: "Gulshan Mehta", 
  car_model: "Scorpio", 
  email_id: "gulshan.mehta@gmail.com" 
}
[CALL_ID] 💾 Sales data saved to: call_CALL_ID_1234567890.json
```

---

## 🚀 Deployment Instructions

### **Step 1: Backup Current Version**
```bash
# SSH to GCP VM
gcloud compute ssh your-vm-name --zone=your-zone

# Create backup
cd /opt/voiceagent
cp src/server/telephony/index.ts src/server/telephony/index.ts.backup-$(date +%Y%m%d_%H%M%S)

# Verify backup
ls -lh src/server/telephony/*.backup*
```

### **Step 2: Pull Latest Changes**
```bash
# Fetch and pull from main branch
git fetch origin
git pull origin main

# Or if you created a hotfix branch:
git fetch origin
git checkout hotfix/transcript-sales-data
git pull origin hotfix/transcript-sales-data
```

### **Step 3: Restart Telephony Service**
```bash
# Restart only telephony service (no Next.js rebuild needed)
pm2 restart voiceagent-telephony

# Monitor logs
pm2 logs voiceagent-telephony --lines 50
```

### **Step 4: Verify Fix**
```bash
# Make a test call
# During call, monitor logs:
pm2 logs voiceagent-telephony | grep "📝 Captured"

# After call, check transcript file created:
ls -lth /opt/voiceagent/data/transcripts/call_*_transcript.json | head -3

# Check sales data populated:
cat /opt/voiceagent/data/calls/call_*.json | tail -1 | jq '.salesData'
```

---

## ✅ Validation Checklist

After deployment, verify:

- [ ] **Test Call Made**
  - Call your test number
  - Provide: Name, Car Model, Email
  - Agent confirms each field
  - Hang up naturally

- [ ] **Logs Show Data Extraction**
  ```bash
  pm2 logs voiceagent-telephony | grep "📝 Captured"
  # Should show: Name, Car Model, Email captured
  ```

- [ ] **Transcript File Created**
  ```bash
  ls -lth /opt/voiceagent/data/transcripts/call_*_transcript.json | head -1
  # Should show file created within last 5 minutes
  ```

- [ ] **Sales Data Shows in File**
  ```bash
  cat /opt/voiceagent/data/calls/call_*.json | tail -1 | jq '.salesData'
  # Should show:
  # {
  #   "full_name": "...",
  #   "car_model": "...",
  #   "email_id": "...",
  #   "status": "Complete"
  # }
  ```

- [ ] **Queue Processor Runs**
  ```bash
  ls -lth /opt/voiceagent/data/processing/*.json | head -3
  # Should show queue entry created
  ```

- [ ] **Results File Generated**
  ```bash
  ls -lth /opt/voiceagent/data/results/*.json | head -1
  # Should show result file after ~30 seconds
  ```

---

## 🔄 Rollback Instructions

If issues occur:

```bash
# Restore backup
cd /opt/voiceagent
cp src/server/telephony/index.ts.backup-YYYYMMDD_HHMMSS src/server/telephony/index.ts

# Restart service
pm2 restart voiceagent-telephony

# Verify rollback
pm2 logs voiceagent-telephony --lines 20
```

---

## 📋 Files Modified

**Single File Change:**
- `src/server/telephony/index.ts`
  - Line 1160-1167: Added `saveTranscriptForProcessing` call in stop event
  - Line 1073-1076: Re-enabled `extractSalesData` call on transcription

**No Database Changes**  
**No Configuration Changes**  
**No Dependencies Added**

---

## 🎯 Impact Assessment

**Risk Level**: LOW
- Single file modification
- No breaking changes
- Backward compatible
- Only adds missing functionality

**Testing**: 
- ✅ Local testing completed
- ✅ Linting passed
- ✅ No TypeScript errors

**Performance**:
- No performance impact
- `extractSalesData` already existed (just re-enabled)
- `saveTranscriptForProcessing` called once per call (negligible)

---

## 📞 Support

**If Issues Occur:**
1. Check logs: `pm2 logs voiceagent-telephony --err`
2. Verify files exist: `ls -lh /opt/voiceagent/data/`
3. Check permissions: `ls -ld /opt/voiceagent/data/`
4. Contact: gulshan@pragyaa.ai

**Common Issues:**
- **Transcript file still not created**: Check disk space `df -h`
- **Sales data still undefined**: Verify `extractSalesData` function is being called in logs
- **Service won't restart**: Check for syntax errors `pm2 logs --err`

---

## ✅ Summary

**Before Fix:**
- ❌ Transcript files not created with non-Ozonetel vendors
- ❌ Sales data shows as undefined
- ❌ Async processing cannot run
- ❌ Admin dashboard incomplete

**After Fix:**
- ✅ Transcript files created for ALL vendors
- ✅ Sales data populated in real-time
- ✅ Async processing works correctly
- ✅ Admin dashboard shows complete data

**Deploy Now!** 🚀


