# ⏰ Temporary Timeout Workaround for Waybeo

## Problem
Waybeo doesn't send stop event OR close WebSocket, so transcripts never get saved.

## Workaround (Not Recommended for Production)

Add a timeout that force-saves transcript after call inactivity:

### Changes to `src/server/telephony/index.ts`

#### 1. Add timeout to session (line ~838):

```typescript
session = {
  ucid,
  client: ws,
  openaiWs,
  receivedFirstPacket: false,
  inputFrameBuffer: [],
  // ... other fields ...
  
  // ⏰ WORKAROUND: Add inactivity timeout for Waybeo
  lastActivityTime: Date.now(),
  inactivityTimeout: null as NodeJS.Timeout | null,
};

// Start inactivity monitor
session.inactivityTimeout = setInterval(() => {
  const inactiveFor = Date.now() - session.lastActivityTime;
  const TIMEOUT_MS = 60000; // 60 seconds of inactivity
  
  if (inactiveFor > TIMEOUT_MS) {
    console.log(`[${ucid}] ⏰ TIMEOUT: No activity for ${inactiveFor}ms`);
    console.log(`[${ucid}] 💾 Force-saving transcript due to inactivity...`);
    
    // Save transcript
    const transcriptResult = saveTranscriptForProcessing(session);
    if (transcriptResult) {
      console.log(`[${ucid}] ✅ Transcript saved via timeout`);
    }
    
    // Cleanup
    if (session.openaiWs) session.openaiWs.close();
    if (session.inactivityTimeout) clearInterval(session.inactivityTimeout);
    sessions.delete(ucid);
    ws.close();
  }
}, 10000); // Check every 10 seconds
```

#### 2. Update lastActivityTime on each media event (line ~1138):

```typescript
if (msg.event === 'media' && msg.data) {
  // Update activity timestamp
  if (session) {
    session.lastActivityTime = Date.now();
  }
  
  // ... rest of media handling ...
}
```

#### 3. Clear timeout in stop event handler (line ~1195):

```typescript
if (msg.event === 'stop') {
  if (session) {
    // Clear inactivity timeout
    if (session.inactivityTimeout) {
      clearInterval(session.inactivityTimeout);
      session.inactivityTimeout = null;
    }
    
    // ... rest of stop handling ...
  }
}
```

#### 4. Clear timeout in close handler (line ~1215):

```typescript
ws.on('close', () => {
  if (session) {
    // Clear inactivity timeout
    if (session.inactivityTimeout) {
      clearInterval(session.inactivityTimeout);
      session.inactivityTimeout = null;
    }
    
    // ... rest of close handling ...
  }
});
```

---

## ⚠️ Why This is NOT Recommended

1. **Wastes Resources**: Session stays in memory for 60 seconds unnecessarily
2. **Delayed Processing**: Transcript not saved immediately after call ends
3. **Not a Real Fix**: Doesn't solve the root cause
4. **Memory Leaks**: If many calls hang, memory usage increases
5. **Complexity**: Adds more code to maintain

---

## ✅ Better Solution

**Tell Waybeo to fix their implementation properly:**

Minimum fix:
```javascript
// When call ends
websocket.close();
```

Proper fix:
```javascript
// When call ends
websocket.send(JSON.stringify({
  event: 'stop',
  ucid: callId,
  type: 'text'
}));

setTimeout(() => websocket.close(), 500);
```

---

## 📊 Comparison

| Solution | Latency | Resource Usage | Reliability | Maintainability |
|----------|---------|----------------|-------------|-----------------|
| **Timeout Workaround** | 60s delay | High | Medium | Complex |
| **Vendor Fix (Close)** | Instant | Low | High | Simple |
| **Vendor Fix (Stop Event)** | Instant | Low | High | Simple |

---

## Recommendation

**Don't implement the timeout workaround.**

Instead:
1. ✅ Deploy your current code changes (they're correct)
2. ✅ Contact Waybeo with specific requirements
3. ✅ Test with Ozonetel in the meantime (it works!)
4. ✅ Wait for Waybeo to implement proper fix

The proper fix is 5 lines of code on their end. The workaround is 50+ lines on yours.


