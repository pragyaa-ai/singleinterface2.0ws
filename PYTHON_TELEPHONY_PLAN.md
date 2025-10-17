# Python Telephony Service with librosa - Implementation Plan

**Branch**: `v4.3.5-python-librosa`  
**Status**: 🧪 **EXPERIMENTAL** - Parallel Implementation  
**Date**: October 17, 2025  
**Goal**: Build Python-based telephony service using librosa for superior audio quality

---

## 🎯 Objective

Create a **parallel Python implementation** of the telephony service that:
1. Uses **librosa** for audio resampling (proven to eliminate white noise)
2. Maintains **all current features** (call transfer, multilingual, webhooks)
3. Runs on **separate port (8081)** for A/B testing
4. Integrates with **existing queue processor** and webhook service

---

## ✅ Why Python + librosa?

### Proven Success:
- ✅ **You've already tested librosa** - It solved white noise issues
- ✅ **Professional audio quality** - Industry-standard resampling
- ✅ **Better audio ecosystem** - NumPy, scipy, soundfile

### vs TypeScript Attempts:
- ❌ Simple resampling - Basic quality, some noise
- ❌ libsamplerate-js - Better but still some issues
- ❌ RNNoise (Jitsi) - ES module incompatibility
- ✅ **librosa (Python)** - **PROVEN TO WORK**

---

## 📊 Architecture

### Current (TypeScript):
```
Telephony Vendor (8kHz PCM16)
    ↓
WebSocket → TypeScript Service (port 8080)
    ↓
Simple/libsamplerate resampling
    ↓
OpenAI Realtime API (24kHz)
    ↓
Queue Processor → Webhooks
```

### New (Python):
```
Telephony Vendor (8kHz PCM16)
    ↓
WebSocket → Python Service (port 8081)
    ↓
librosa resampling ✨
    ↓
OpenAI Realtime API (24kHz)
    ↓
Queue Processor → Webhooks (same as TypeScript)
```

---

## 🔧 Technical Stack

### Python Libraries:
- **`websockets`** - WebSocket server
- **`websocket-client`** - OpenAI Realtime API client
- **`librosa`** - High-quality audio resampling
- **`numpy`** - Audio data manipulation
- **`soundfile`** - Audio I/O (if needed)
- **`python-dotenv`** - Environment variables
- **`requests`** - Waybeo API calls
- **`aiohttp`** - Async HTTP (alternative)

### Python Version:
- Python 3.8+ (asyncio support)
- Compatible with Ubuntu/Debian on GCP VM

---

## 📁 Project Structure

```
src/server/
├── telephony/              # Existing TypeScript (port 8080)
│   ├── index.ts
│   └── audio.ts
│
└── telephony-python/       # NEW Python service (port 8081)
    ├── main.py             # Main entry point
    ├── audio_processor.py  # librosa resampling
    ├── openai_client.py    # OpenAI Realtime API
    ├── waybeo_client.py    # Waybeo transfer API
    ├── session_manager.py  # Session state management
    ├── config.py           # Configuration from env
    └── requirements.txt    # Python dependencies
```

---

## 🎵 Audio Processing (librosa)

### Upsampling (8kHz → 24kHz):
```python
import librosa
import numpy as np

def upsample_8k_to_24k(samples_8k: np.ndarray) -> np.ndarray:
    """
    Upsample from 8kHz to 24kHz using librosa (high quality)
    """
    # Convert int16 to float32 (-1.0 to 1.0)
    samples_float = samples_8k.astype(np.float32) / 32768.0
    
    # Resample using librosa (Kaiser windowed sinc interpolation)
    samples_24k = librosa.resample(
        samples_float,
        orig_sr=8000,
        target_sr=24000,
        res_type='kaiser_best'  # Highest quality
    )
    
    # Convert back to int16
    samples_24k_int16 = (samples_24k * 32767.0).astype(np.int16)
    
    return samples_24k_int16
```

### Downsampling (24kHz → 8kHz):
```python
def downsample_24k_to_8k(samples_24k: np.ndarray) -> np.ndarray:
    """
    Downsample from 24kHz to 8kHz using librosa (high quality)
    """
    # Convert int16 to float32
    samples_float = samples_24k.astype(np.float32) / 32768.0
    
    # Resample using librosa with anti-aliasing
    samples_8k = librosa.resample(
        samples_float,
        orig_sr=24000,
        target_sr=8000,
        res_type='kaiser_best'
    )
    
    # Convert back to int16
    samples_8k_int16 = (samples_8k * 32767.0).astype(np.int16)
    
    return samples_8k_int16
```

---

## 🔄 Feature Parity with TypeScript

### Must-Have Features:
- [x] WebSocket server for telephony vendors
- [x] OpenAI Realtime API integration
- [x] Audio resampling (8kHz ↔ 24kHz) with **librosa**
- [x] Call transfer to Waybeo
- [x] Multilingual support (6 languages)
- [x] Transcript collection for async processing
- [x] Session management (unique call IDs)
- [x] VAD configuration
- [x] Model selection (mini vs standard)
- [x] Environment variable configuration

### File Outputs (Same as TypeScript):
- `data/calls/call_{ucid}_{timestamp}_transcript.json`
- `data/calls/call_{ucid}_{timestamp}_queue.json`

---

## 🚀 Deployment Strategy

### Phase 1: Parallel Testing (Both Running)
```
GCP VM:
├── Port 8080 → TypeScript telephony (existing)
└── Port 8081 → Python telephony (new)

Test calls on both:
- Route test calls to port 8081
- Compare audio quality
- Verify all features work
```

### Phase 2: A/B Testing
```
50% of calls → TypeScript (8080)
50% of calls → Python (8081)

Measure:
- Audio quality feedback
- Call transfer success rate
- System stability
```

### Phase 3: Full Migration (If Python Better)
```
100% calls → Python (8081)
Keep TypeScript as fallback
```

---

## 📦 Dependencies

### `requirements.txt`:
```
websockets==12.0
websocket-client==1.7.0
librosa==0.10.1
numpy==1.24.3
soundfile==0.12.1
python-dotenv==1.0.0
requests==2.31.0
aiofiles==23.2.1
```

### System Dependencies (GCP VM):
```bash
sudo apt-get update
sudo apt-get install -y python3-pip python3-venv
sudo apt-get install -y libsndfile1  # For soundfile
```

---

## 🔧 PM2 Configuration

### `ecosystem.python-telephony.config.js`:
```javascript
module.exports = {
  apps: [{
    name: 'voiceagent-telephony-python',
    script: 'src/server/telephony-python/main.py',
    interpreter: 'python3',
    instances: 1,
    exec_mode: 'fork',
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PYTHON_PORT: '8081',
      HOST: '0.0.0.0',
      // All other env vars same as TypeScript version
    },
    error_file: './logs/telephony-python-error.log',
    out_file: './logs/telephony-python-out.log',
  }]
};
```

---

## 🧪 Testing Plan

### 1. Local Testing:
```bash
# Install dependencies
python3 -m venv venv
source venv/bin/activate
pip install -r src/server/telephony-python/requirements.txt

# Run locally
python3 src/server/telephony-python/main.py
```

### 2. GCP VM Testing:
```bash
# Deploy Python service
cd /opt/voiceagent
git pull origin v4.3.5-python-librosa

# Setup Python environment
python3 -m venv venv
source venv/bin/activate
pip install -r src/server/telephony-python/requirements.txt

# Start with PM2
pm2 start ecosystem.python-telephony.config.js
pm2 save

# Test call on port 8081
```

### 3. Audio Quality Verification:
- Make test calls to both services
- Compare background noise levels
- Verify voice clarity
- Check for clicks/pops

---

## 📊 Success Criteria

### Python Service is Better If:
1. ✅ **Audio quality significantly improved** (white noise eliminated)
2. ✅ **All features work** (transfer, multilingual, webhooks)
3. ✅ **Stable performance** (no crashes, memory leaks)
4. ✅ **CPU usage acceptable** (< 20% per call)
5. ✅ **Low latency** (< 50ms audio processing)

---

## 🔄 Rollback Plan

If Python version has issues:

```bash
# Stop Python service
pm2 stop voiceagent-telephony-python
pm2 delete voiceagent-telephony-python

# Continue using TypeScript service (port 8080)
# It's still running, no downtime
```

**Rollback time: < 1 minute** ⚡

---

## 📚 Implementation Steps

1. ✅ Create branch `v4.3.5-python-librosa`
2. [ ] Create Python project structure
3. [ ] Implement audio processor with librosa
4. [ ] Implement WebSocket server
5. [ ] Implement OpenAI Realtime API client
6. [ ] Implement Waybeo transfer client
7. [ ] Implement session management
8. [ ] Add multilingual instructions
9. [ ] Create requirements.txt
10. [ ] Create PM2 config
11. [ ] Write deployment guide
12. [ ] Test locally
13. [ ] Deploy to GCP VM
14. [ ] A/B test with TypeScript version

---

## 🎯 Expected Outcome

**Best Case:**
- Python + librosa provides **crystal-clear audio**
- All features work flawlessly
- Becomes new production standard

**Worst Case:**
- Python version has issues
- Keep TypeScript version (v4.3.0-webhook-updates)
- No downtime (parallel deployment)

---

**Let's build it!** 🐍✨

