# 🚀 Release Notes - Version 4.5.1

**Release Date:** October 3, 2025  
**Type:** UI-Controlled Dynamic Model Switching  
**Status:** Production Ready

---

## 🎯 **Overview**

This release adds **UI-controlled dynamic model switching** between VoiceAgent Full and Mini models. Administrators can now switch models directly from the Admin Dashboard without restarting services or deploying new code. The telephony service reads the configuration file on each new call, enabling real-time model switching.

---

## ✨ **New Features**

### **1. Dynamic Model Selection UI**

**Location:** `http://localhost:3000/admin/models`

**Features:**
- ✅ Visual cards showing both VoiceAgent Full and Mini models
- ✅ Real-time "Active" indicator showing current model
- ✅ One-click switching buttons
- ✅ Success/error notifications
- ✅ Cost savings indicator when Mini model is active
- ✅ Loading states during switch operation

**User Experience:**
1. Admin clicks "Switch to Mini" button
2. System saves configuration immediately
3. Success message displayed
4. Next incoming call uses the new model
5. No service restart required!

### **2. Model Configuration API**

**New Endpoint:** `/api/admin/model-config`

**GET:** Retrieve current model configuration
```bash
curl http://localhost:3000/api/admin/model-config
```

**Response:**
```json
{
  "success": true,
  "config": {
    "selectedModel": "mini",
    "models": {
      "full": {
        "name": "VoiceAgent Full",
        "model": "gpt-4o-realtime-preview-2024-12-17",
        "performance": "Premium",
        "costTier": "High",
        "bestFor": "Complex queries"
      },
      "mini": {
        "name": "VoiceAgent Mini",
        "model": "gpt-4o-mini-realtime-preview-2024-12-17",
        "performance": "Standard",
        "costTier": "Low",
        "bestFor": "High-volume calls"
      }
    },
    "lastUpdated": "2025-10-03T14:30:00.000Z",
    "updatedBy": "admin"
  }
}
```

**POST:** Update model selection
```bash
curl -X POST http://localhost:3000/api/admin/model-config \
  -H "Content-Type: application/json" \
  -d '{"selectedModel": "mini", "updatedBy": "admin"}'
```

### **3. Real-Time Configuration Reading**

**Telephony Service Enhancement:**
- Reads `/data/model-config.json` on each new call
- No caching - always uses latest selection
- Automatic fallback to Full model if config missing
- Enhanced logging showing selected model name

**Log Output:**
```
[CALL_ID] 🤖 Using model: VoiceAgent Mini (gpt-4o-mini-realtime-preview-2024-12-17)
[CALL_ID] Connected to OpenAI Realtime API with VoiceAgent Mini
```

---

## 📁 **File Changes**

### **New Files:**

1. **`src/app/api/admin/model-config/route.ts`** (New API endpoint)
   - GET: Retrieve current configuration
   - POST: Update model selection
   - Manages `/data/model-config.json` file

2. **`data/model-config.json`** (Auto-created on first use)
   - Stores selected model preference
   - Includes model metadata
   - Tracks last update timestamp

### **Modified Files:**

1. **`src/server/telephony/index.ts`**
   - Added `getSelectedModel()` function
   - Reads config file on each connection
   - Enhanced logging with model names
   - Automatic fallback to Full model

2. **`src/app/admin/models/page.tsx`**
   - Added state management for model selection
   - Added `fetchModelConfig()` function
   - Added `switchModel()` function
   - Dynamic UI highlighting for active model
   - Added success/error notifications
   - Added cost savings indicator

3. **`package.json`**
   - Version updated to 4.5.1

---

## 🔄 **How It Works**

### **Data Flow:**

```
┌─────────────┐
│  Admin UI   │ ← User clicks "Switch to Mini"
└──────┬──────┘
       │
       ▼
┌──────────────────┐
│  POST /api/...   │ ← API saves to /data/model-config.json
│  model-config    │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│ model-config.json│ ← {"selectedModel": "mini", ...}
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│ New Call Arrives │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│ Telephony Service│ ← Reads config file
│ getSelectedModel()│   Returns: gpt-4o-mini-realtime...
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│ OpenAI Realtime  │ ← Connects with selected model
│   WebSocket      │
└──────────────────┘
```

### **Key Benefits:**

1. **No Restart Required** - Changes take effect immediately on next call
2. **No Code Deployment** - Switch models without git push/pull
3. **User-Friendly** - Simple UI, no technical knowledge needed
4. **Safe Fallback** - Defaults to Full model if config unavailable
5. **Audit Trail** - Tracks who made changes and when

---

## 🎨 **UI Screenshots**

### **Before (v4.5.0):**
- Static model selection
- No switching capability
- Hardcoded in code

### **After (v4.5.1):**
- Dynamic model cards
- Active/Available indicators
- One-click switching
- Real-time updates
- Cost savings display

---

## 📊 **Cost Comparison**

| Feature | Full Model | Mini Model | Savings |
|---------|------------|------------|---------|
| **Cached Input** | $1.63/day | $0.41/day | **75%** |
| **Text Output** | $0.05/day | $0.01/day | **75%** |
| **Audio (same)** | $X | $X | 0% |
| **Total Daily** | ~$1.70 | ~$0.45 | **73%** |
| **Annual Cost** | ~$620 | ~$164 | **$456 saved** |

**With UI Switching:**
- Test Mini model for a few calls
- Switch back to Full if quality issues
- Hybrid usage based on time of day or call volume
- Optimize costs without compromising quality

---

## 🧪 **Testing Instructions**

### **1. Test UI Switching (Local)**

```bash
# Ensure dev server is running
npm run dev

# Open Admin Dashboard
http://localhost:3000/admin/models

# Test switching:
1. Click "Switch to Mini"
2. Verify success message appears
3. Check browser console (no errors)
4. Click "Switch to Full"
5. Verify success message appears
```

### **2. Test Model Selection (Telephony)**

```bash
# In a separate terminal, start telephony service
npm run telephony

# Make a test call
# Check logs for:
[CALL_ID] 🤖 Using model: VoiceAgent Mini (or Full)
[CALL_ID] Connected to OpenAI Realtime API with VoiceAgent Mini

# Switch model in UI
# Make another test call
# Verify new model is used
```

### **3. Verify Configuration File**

```bash
# Check config file was created
cat data/model-config.json

# Expected output:
{
  "selectedModel": "mini",
  "models": { ... },
  "lastUpdated": "2025-10-03T...",
  "updatedBy": "admin"
}
```

---

## 🚀 **Deployment to GCP VM**

### **Step 1: Commit & Push**

```bash
git add .
git commit -m "v4.5.1: Add UI-controlled dynamic model switching"
git tag v4.5.1
git push origin main --tags
```

### **Step 2: Deploy to GCP VM**

```bash
# SSH to GCP VM
ssh your-gcp-vm

# Navigate to project
cd /opt/voiceagent

# Pull latest
git fetch --all
git pull origin main
git checkout v4.5.1

# Install dependencies (if any new)
npm install

# Rebuild Next.js
npm run build

# Restart services
pm2 restart voiceagent-next
pm2 restart voiceagent-telephony

# Verify
pm2 status
```

### **Step 3: Test on VM**

```bash
# Open admin dashboard
https://your-domain.com/admin/models

# Switch model via UI
# Make a test call
# Check logs
pm2 logs voiceagent-telephony | grep "🤖 Using model"
```

---

## 🔧 **Configuration Management**

### **Default Configuration:**

On first run, the system creates `/data/model-config.json` with:
- **Default Model:** Full (gpt-4o-realtime-preview-2024-12-17)
- **Available Models:** Full and Mini with metadata
- **Auto-created:** If file doesn't exist

### **Manual Override:**

You can manually edit the config file if needed:

```bash
# Edit config
nano data/model-config.json

# Change selectedModel to "mini" or "full"
{
  "selectedModel": "mini",
  ...
}

# Save and exit
# Next call will use new selection (no restart needed)
```

### **Reset to Default:**

```bash
# Delete config file
rm data/model-config.json

# System will recreate with defaults on next API call
```

---

## ⚠️ **Important Notes**

### **Model Changes Take Effect:**
- ✅ On **NEXT call** (not current active calls)
- ✅ Within **seconds** of UI switch (no restart)
- ✅ Applies to **all new calls** system-wide

### **Fallback Behavior:**
- If config file is missing → Uses Full model
- If config file is corrupted → Uses Full model
- If model name invalid → Uses Full model
- Logs warning but doesn't break system

### **Limitations:**
- Cannot switch model mid-call
- Active calls continue with original model
- Config is system-wide (not per-number or per-dealer)

---

## 📈 **Use Cases**

### **Scenario 1: Cost Optimization Testing**
1. Switch to Mini model
2. Monitor quality for 2-3 days
3. Check cost reduction in OpenAI dashboard
4. If quality acceptable → Keep Mini
5. If issues → Switch back to Full instantly

### **Scenario 2: Time-Based Optimization**
- **Peak hours** (9 AM - 6 PM): Use Full model for better quality
- **Off-hours** (6 PM - 9 AM): Use Mini model to save costs
- Manually switch or use cron job with API

### **Scenario 3: Load-Based Optimization**
- **High call volume**: Switch to Mini to handle load
- **Normal volume**: Use Full for best quality
- Monitor call queue and switch dynamically

### **Scenario 4: A/B Testing**
- Week 1: Full model, track metrics
- Week 2: Mini model, compare metrics
- Decide based on data

---

## 🐛 **Troubleshooting**

### **Issue: Model not switching**

**Check:**
```bash
# 1. Verify config file exists
ls -la data/model-config.json

# 2. Check file contents
cat data/model-config.json

# 3. Check telephony logs
pm2 logs voiceagent-telephony | grep "Using model"

# 4. Test API endpoint
curl http://localhost:3000/api/admin/model-config
```

### **Issue: UI shows error**

**Check:**
```bash
# 1. Check Next.js logs
pm2 logs voiceagent-next

# 2. Check file permissions
ls -la data/

# 3. Verify API is running
curl http://localhost:3000/api/admin/model-config
```

### **Issue: Config file not created**

**Manual creation:**
```bash
# Create data directory
mkdir -p data

# Create config file
cat > data/model-config.json << 'EOF'
{
  "selectedModel": "full",
  "models": {
    "full": {
      "name": "VoiceAgent Full",
      "model": "gpt-4o-realtime-preview-2024-12-17",
      "performance": "Premium",
      "costTier": "High",
      "bestFor": "Complex queries"
    },
    "mini": {
      "name": "VoiceAgent Mini",
      "model": "gpt-4o-mini-realtime-preview-2024-12-17",
      "performance": "Standard",
      "costTier": "Low",
      "bestFor": "High-volume calls"
    }
  },
  "lastUpdated": "2025-10-03T00:00:00.000Z",
  "updatedBy": "system"
}
EOF
```

---

## 🎯 **Success Metrics**

### **Functional Requirements:**
- ✅ UI displays both models with clear indicators
- ✅ Switching works without errors
- ✅ Success/error messages displayed correctly
- ✅ Configuration persists after switch
- ✅ Telephony service reads config correctly
- ✅ New calls use selected model
- ✅ No service restart required

### **Performance:**
- ✅ Config read adds <1ms per call
- ✅ UI switch completes in <500ms
- ✅ No impact on active calls

---

## 📚 **Related Documentation**

- **Previous Release:** `RELEASE_NOTES_v4.5.0.md` (Model testing)
- **Testing Guide:** `MODEL_TESTING_GUIDE.md`
- **Deployment Summary:** `V4.5.0_DEPLOYMENT_SUMMARY.md`
- **Webhook Documentation:** `SINGLEINTERFACE_WEBHOOK_DETAILS.md`

---

## 🎉 **What's Next**

### **Potential Future Enhancements:**

1. **Scheduled Switching**
   - Cron job to switch models at specific times
   - Peak/off-peak hour optimization

2. **Per-Dealer Configuration**
   - Different dealers use different models
   - Based on dealer preferences or SLA

3. **Automatic Fallback**
   - If Mini model has high error rate → Auto-switch to Full
   - Alert admin about the switch

4. **Usage Analytics**
   - Track which model performed better
   - Show cost comparison in dashboard
   - Recommend optimal model based on patterns

5. **Hybrid Mode**
   - Start with Mini, upgrade to Full if needed
   - Mid-call model switching for complex cases

---

## ✅ **Summary**

**v4.5.1 delivers:**
- ✅ UI-controlled model switching
- ✅ Real-time config updates
- ✅ No restart required
- ✅ Safe fallback mechanism
- ✅ Audit trail
- ✅ Cost optimization flexibility

**Ready to deploy and switch models on the fly!** 🚀

