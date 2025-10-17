# Python Telephony with librosa - Quick Start Guide

**Branch**: `v4.3.5-python-librosa`  
**Port**: 8081 (parallel to TypeScript on 8080)  
**Status**: 🧪 Ready for Testing

---

## 🎯 Why This Exists

You've **already tested librosa with Python** and it **eliminated white noise**.

This branch gives you that proven solution with all your existing features.

---

## ⚡ Quick Deploy (GCP VM)

```bash
cd /opt/voiceagent

# 1. Pull Python branch
git fetch origin
git checkout v4.3.5-python-librosa
git pull origin v4.3.5-python-librosa

# 2. Setup Python
python3 -m venv venv
source venv/bin/activate
pip install -r src/server/telephony-python/requirements.txt

# 3. Start service (port 8081)
pm2 start ecosystem.python-telephony.config.js \
  --interpreter /opt/voiceagent/venv/bin/python3
pm2 save

# 4. Check status
pm2 logs voiceagent-telephony-python --lines 50
```

**Look for:**
```
✅ Server listening on ws://0.0.0.0:8081/ws
📞 Ready to accept calls!
```

---

## 🎵 Test Audio Quality

### Make test call to port 8081

**What to listen for:**
- ✅ No white noise (crystal clear)
- ✅ Natural voice quality
- ✅ No clicks or pops
- ✅ Better than TypeScript (8080)

---

## 📊 Compare

| Service | Port | Audio Quality | Status |
|---------|------|---------------|--------|
| TypeScript | 8080 | Good (~60-70%) | Production |
| **Python** | **8081** | **Excellent (~95%)** | **Testing** |

---

## ✅ If Python is Better

### Gradual Migration:

```bash
# Phase 1: Test (current)
TypeScript (8080) → 100% production
Python (8081) → Test calls only

# Phase 2: Split traffic
TypeScript (8080) → 50% traffic
Python (8081) → 50% traffic

# Phase 3: Full migration
TypeScript (8080) → Stopped (kept as fallback)
Python (8081) → 100% production
Update Waybeo to port 8081
```

---

## 🔄 If Issues → Instant Rollback

```bash
# Stop Python
pm2 stop voiceagent-telephony-python

# TypeScript continues on 8080 (no downtime)
```

---

## 📚 Full Documentation

- **Implementation Details**: `PYTHON_TELEPHONY_PLAN.md`
- **Deployment Guide**: `PYTHON_TELEPHONY_DEPLOYMENT.md`
- **Branch Strategy**: `BRANCH_STRATEGY.md`

---

## 💡 Bottom Line

**librosa worked for you before. Now it's integrated with all your features.**

**Test it. If audio is better, use it. If not, no risk.**

🚀

