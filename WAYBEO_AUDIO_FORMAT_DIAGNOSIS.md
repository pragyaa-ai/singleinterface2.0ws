# 🔍 Waybeo Audio Format Diagnosis

## 🐛 Problem
Waybeo calls are now saving transcripts (WebSocket closes properly), but transcription quality is very poor:
- Arabic script appears: `'بلش مهبا'` instead of "Scorpio"
- Other details are captured correctly: email, "Yes", etc.
- Same setup with Ozonetel works perfectly

## 🎯 Root Cause (Suspected)
**Audio format mismatch** - Waybeo is likely sending audio in a different format than Ozonetel.

---

## 📊 Expected Audio Format

Our system expects this format (as used by Ozonetel):

```
Sample Rate: 8000 Hz (8kHz)
Bits Per Sample: 16
Channels: 1 (mono)
Format: PCM16 (signed 16-bit integers)
Frame Size: 80 samples (10ms at 8kHz)
Endianness: Little-endian
```

---

## 🔍 How to Check Waybeo's Format

### Step 1: Deploy Diagnostic Logging

I've added logging to show audio format on first packet.

```bash
# Deploy the updated code
cd /opt/voiceagent
git pull origin main
pm2 restart voiceagent-telephony
```

### Step 2: Make Test Call with Waybeo

```bash
# Monitor logs in real-time
pm2 logs voiceagent-telephony --lines 0
```

Make a test call. You should now see:

```
================================================================================
[CALL_ID] 🎵 AUDIO FORMAT DIAGNOSTIC (First Packet)
[CALL_ID] Sample Rate: ????? Hz       ← Check this!
[CALL_ID] Bits Per Sample: ???        ← Check this!
[CALL_ID] Channels: ?                 ← Check this!
[CALL_ID] Number of Samples: ???      ← Check this!
[CALL_ID] Expected: 8000 Hz, 16-bit, Mono, ~80 samples per frame
================================================================================
```

---

## 🔧 Common Audio Format Issues

### Issue 1: Different Sample Rate

**Symptoms:** Garbled/distorted transcription
**Possible Values from Waybeo:**
- 16000 Hz (16kHz) - Common for VoIP
- 48000 Hz (48kHz) - High quality
- 44100 Hz (44.1kHz) - CD quality

**If Waybeo sends 16kHz instead of 8kHz:**
- Our upsampling expects 8kHz input
- 16kHz audio processed as 8kHz = pitch/speed problems
- Results in poor transcription

**Fix:** Tell Waybeo to send 8kHz, or adjust our code to handle 16kHz

---

### Issue 2: Different Encoding

**Symptoms:** Noise, static, or completely wrong transcription
**Possible Formats:**
- G.711 µ-law (telephone standard)
- G.711 A-law (European telephone)
- Opus (modern codec)
- AAC/MP3 (compressed)

**If Waybeo sends G.711 instead of PCM16:**
- Our code expects raw PCM16 samples
- G.711 needs decoding first
- Results in garbage audio

**Fix:** Tell Waybeo to send raw PCM16, or add G.711 decoder

---

### Issue 3: Wrong Endianness

**Symptoms:** Very noisy/distorted audio
**Issue:**
- Expected: Little-endian (least significant byte first)
- If Big-endian: bytes are reversed, audio is distorted

**Fix:** Tell Waybeo to use little-endian, or swap bytes in code

---

### Issue 4: Unsigned vs Signed

**Symptoms:** Heavy distortion, clicks, pops
**Issue:**
- Expected: Signed 16-bit (-32768 to 32767)
- If Unsigned: (0 to 65535), creates DC offset

**Fix:** Tell Waybeo to use signed integers

---

## 📋 What to Check with Waybeo

Share this checklist with Waybeo:

```
Audio Format Requirements for Voice Agent Integration:

☐ Sample Rate: 8000 Hz (8kHz)
☐ Format: PCM16 (raw, uncompressed)
☐ Bit Depth: 16 bits per sample
☐ Channels: 1 (mono)
☐ Sample Type: Signed 16-bit integers
☐ Endianness: Little-endian
☐ Frame Size: 10ms (80 samples at 8kHz)

Current Testing Results:
✅ WebSocket connection: Working
✅ Start/Stop events: Working
❌ Audio transcription: Poor quality
   - Getting Arabic script instead of English words
   - Suggests audio format mismatch

Please verify your audio stream matches these specifications.
```

---

## 🔬 Advanced Diagnosis

If Waybeo claims they're sending correct format, capture actual audio data:

### Capture Audio Packets

Add temporary logging:

```typescript
// In telephony/index.ts, line ~1148
if (msg.event === 'media' && msg.data) {
  // Add this temporarily
  if (session.mediaPacketsLogged < 5) {
    console.log(`[${ucid}] 🎵 MEDIA PACKET #${session.mediaPacketsLogged}:`);
    console.log(`[${ucid}] Sample Rate: ${msg.data.sampleRate}`);
    console.log(`[${ucid}] Bits: ${msg.data.bitsPerSample}`);
    console.log(`[${ucid}] Samples: ${msg.data.samples?.length}`);
    console.log(`[${ucid}] First 10 samples:`, msg.data.samples?.slice(0, 10));
    session.mediaPacketsLogged++;
  }
  // ... rest of code
}
```

This will show:
- Actual sample rate per packet
- Actual sample values
- Can verify signed vs unsigned (negative values = signed)

---

## 🎯 Quick Comparison Test

### Ozonetel Audio (Working):
```
Sample Rate: 8000 Hz
Bits Per Sample: 16
Channels: 1
Samples per frame: ~80
Transcription: ✅ Perfect ("Scorpio", "Gulshan", etc.)
```

### Waybeo Audio (Not Working):
```
Sample Rate: ????? Hz      ← Need to check
Bits Per Sample: ?????     ← Need to check
Channels: ?                ← Need to check
Samples per frame: ???     ← Need to check
Transcription: ❌ Garbled ("بلش مهبا" instead of "Scorpio")
```

---

## ✅ Expected Solution

Once Waybeo sends correct format (8kHz, PCM16, mono):

**Before (Current):**
```
User says: "Scorpio"
Transcription: "بلش مهبا" ❌
Transcript file: Garbled text
```

**After (Fixed):**
```
User says: "Scorpio"
Transcription: "Scorpio" ✅
Transcript file: Perfect conversation details
```

---

## 🚀 Action Plan

1. **Deploy diagnostic logging** (already added)
2. **Make test call with Waybeo**
3. **Check logs for audio format**
4. **Compare with Ozonetel format**
5. **Contact Waybeo with specific mismatch**
6. **They fix their audio format**
7. **Test again - should work!**

---

## 📞 If Format is Correct but Still Garbled

Other possible issues:
1. **Packet loss** - Network dropping audio packets
2. **Timing issues** - Audio arriving out of order
3. **Codec issues** - Waybeo encoding then decoding causes artifacts
4. **Volume issues** - Audio too quiet or too loud

Check:
```bash
# Check for packet loss indicators
pm2 logs voiceagent-telephony | grep -i "error\|fail\|loss"
```

---

**Next Step:** Make a test call with Waybeo after deploying the diagnostic code, and share the audio format output!

