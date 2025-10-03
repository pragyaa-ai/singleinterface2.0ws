# 🚀 Release Notes - Version 4.5.0

**Release Date:** October 3, 2025  
**Type:** Cost Optimization Testing Release  
**Status:** Testing Phase - Parallel Deployment

---

## 🎯 **Overview**

This release switches the OpenAI Realtime API model from `gpt-realtime` to `gpt-4o-mini-realtime-preview-2024-12-17` for cost optimization testing. This is a **testing release** designed to evaluate the quality-cost tradeoff of using the Mini model for voice agent interactions.

---

## 📊 **Key Changes**

### **1. Model Switch**

**Before (v4.4.3):**
```typescript
model: 'gpt-realtime'
// General production endpoint, uses latest full model
```

**After (v4.5.0):**
```typescript
model: 'gpt-4o-mini-realtime-preview-2024-12-17'
// Mini model optimized for cost efficiency
```

### **2. Expected Cost Savings**

| Metric | Full Model (v4.4.3) | Mini Model (v4.5.0) | Savings |
|--------|---------------------|---------------------|---------|
| **Cached Input** | ~$1.63/day | ~$0.40/day | **~75%** |
| **Text Output** | ~$0.05/day | ~$0.01/day | **~75%** |
| **Audio** | Same | Same | 0% |
| **Total Estimated** | ~$1.70/day | ~$0.45/day | **~73%** |

**Projected Monthly Savings:** ~$37.50/month (based on current usage)

### **3. Logging Enhancement**

Added model logging for better visibility:
```typescript
console.log(`[${ucid}] 🤖 Using model: ${model}`);
console.log(`[${ucid}] Connected to OpenAI Realtime API with ${model}`);
```

---

## 🧪 **Testing Plan**

### **Phase 1: Parallel Deployment (Now)**

Deploy v4.5.0 as a **second parallel instance** on GCP VM:

**Current Setup:**
- **Port 3000** (existing): Running v4.4.3 with `gpt-realtime` (Full model)
- **Port 3001** (new): Running v4.5.0 with Mini model

**Comparison Method:**
1. Route 50% of calls to each instance
2. Monitor quality metrics
3. Compare customer experience
4. Track cost reduction

### **Phase 2: Data Collection (2-3 days)**

Collect metrics on:
- ✅ Data capture accuracy (name, car model, email)
- ✅ Conversation naturalness
- ✅ Number of confirmation attempts needed
- ✅ Call duration
- ✅ Customer satisfaction (indirect - dropoff rate)
- ✅ Cost per call

### **Phase 3: Decision (After Testing)**

**If Mini model quality is acceptable:**
- ✅ Switch all traffic to Mini model (v4.5.0)
- ✅ Decommission Full model instance
- ✅ Enjoy ~73% cost savings
- ✅ Consider instruction optimization for additional savings

**If Mini model quality drops:**
- 🔄 Revert to Full model (v4.4.3)
- 🔄 Or implement hybrid approach (Mini for simple calls, Full for complex)
- 🔄 Or optimize instructions only (~35% savings)

---

## 📋 **Quality Metrics to Track**

### **Critical Metrics (Must Maintain):**

| Metric | Current (Full Model) | Target (Mini Model) | Pass Criteria |
|--------|---------------------|---------------------|---------------|
| **Data Capture Rate** | ~73% complete | ≥70% | Within 3% drop |
| **First-attempt Success** | ~85% | ≥80% | Within 5% drop |
| **Avg Attempts per Field** | ~1.3 | ≤1.5 | Max 0.2 increase |
| **Call Dropoff Rate** | ~15% | ≤18% | Within 3% increase |
| **Avg Call Duration** | ~95s | ≤110s | Within 15s increase |

### **Secondary Metrics (Monitor):**

- Conversation naturalness (subjective review of recordings)
- Accent/pronunciation handling
- Email spelling accuracy
- Complex name handling
- Customer frustration indicators (repeat requests, hang-ups)

---

## 🔧 **Technical Implementation**

### **File Changes:**

**1. `src/server/telephony/index.ts`**
- Line 599-600: Added model selection with comments
- Line 603: Updated WebSocket connection to use variable model
- Line 611: Enhanced connection logging

**2. `package.json`**
- Version updated from `4.4.3` to `4.5.0`

### **Configuration:**

No environment variable changes needed. The model is hardcoded for this testing phase.

**To revert to Full model:**
```typescript
const model = 'gpt-realtime'; // Change this line back
```

---

## 🚀 **Deployment Instructions**

### **For Parallel Testing on GCP VM:**

```bash
# 1. SSH to GCP VM
ssh your-gcp-vm

# 2. Clone to new directory for parallel testing
cd /opt
sudo cp -r voiceagent voiceagent-mini-test

# 3. Navigate to test directory
cd /opt/voiceagent-mini-test

# 4. Pull v4.5.0 code
git fetch --all
git checkout v4.5.0  # After you create the tag

# 5. Install dependencies (if needed)
npm install

# 6. Update PM2 ecosystem for parallel deployment
# Edit ecosystem.config.js to use different ports

# 7. Start the Mini model instance
pm2 start ecosystem.config.js --only voiceagent-telephony-mini

# 8. Verify both instances running
pm2 status
# Should see:
# - voiceagent-telephony (Full model - existing)
# - voiceagent-telephony-mini (Mini model - new)

# 9. Monitor logs side by side
pm2 logs voiceagent-telephony-mini --lines 50
```

### **Alternative: Sequential Testing**

If parallel deployment is complex, test sequentially:

```bash
# 1. Update existing deployment to v4.5.0
cd /opt/voiceagent
git pull origin main
git checkout v4.5.0

# 2. Restart telephony service
pm2 restart voiceagent-telephony

# 3. Monitor for 2-3 days

# 4. Revert if needed
git checkout v4.4.3
pm2 restart voiceagent-telephony
```

---

## 📊 **Comparison Dashboard**

Track these metrics in a spreadsheet:

| Date | Model | Calls | Complete | Partial | Failed | Avg Duration | Avg Attempts | Daily Cost |
|------|-------|-------|----------|---------|--------|--------------|--------------|------------|
| Oct 3 | Full | 8 | 73% | 15% | 12% | 95s | 1.3 | $1.70 |
| Oct 4 | Mini | 8 | ? | ? | ? | ? | ? | $0.45 |
| Oct 5 | Mini | 12 | ? | ? | ? | ? | ? | $0.68 |

---

## ⚠️ **Risks & Mitigation**

### **Potential Risks:**

1. **Quality Drop:** Mini model may be less natural
   - **Mitigation:** Monitor closely, revert if needed

2. **More Confirmations Needed:** May require extra attempts
   - **Mitigation:** Track attempt count, acceptable if within 0.2 increase

3. **Accent Handling:** May struggle with Indian names/pronunciation
   - **Mitigation:** Review specific failure cases, adjust instructions if needed

4. **Customer Experience:** May feel slightly less smooth
   - **Mitigation:** Monitor dropoff rate and call duration

### **Rollback Plan:**

If quality issues detected within first 24 hours:
```bash
# Quick rollback
git checkout v4.4.3
pm2 restart voiceagent-telephony
```

No data loss, no system downtime, seamless reversion.

---

## 🎯 **Success Criteria**

**This release is considered successful if:**

1. ✅ Data capture rate remains ≥70% (within 3% of current)
2. ✅ Average attempts per field stays ≤1.5 (max 0.2 increase)
3. ✅ Call dropoff rate ≤18% (within 3% increase)
4. ✅ No significant customer complaints
5. ✅ Cost reduced by ≥70%

**If all criteria met:** Deploy Mini model permanently, save ~$450/year

**If criteria not met:** Revert or implement hybrid approach

---

## 📝 **Next Steps After Testing**

### **If Mini Model Works Well:**

1. Make v4.5.0 permanent
2. Further optimize system instructions (~10% additional savings)
3. Total cost reduction: ~80%
4. Document best practices for Mini model usage

### **If Mini Model Needs Improvement:**

1. Optimize system instructions first (~35% savings)
2. Implement hybrid model selection logic
3. Use Mini for simple calls, Full for complex calls
4. Target: 50-60% overall cost reduction

### **If Mini Model Fails:**

1. Revert to v4.4.3 (Full model)
2. Focus only on instruction optimization
3. Target: 30-35% cost reduction
4. Consider batch processing optimizations

---

## 🔍 **Monitoring Commands**

```bash
# Watch Mini model logs
pm2 logs voiceagent-telephony --lines 100 | grep "🤖 Using model"

# Count successful data captures
pm2 logs voiceagent-telephony --lines 500 | grep "✅ capture_all_sales_data" | wc -l

# Track model usage
pm2 logs voiceagent-telephony --lines 100 | grep "Connected to OpenAI"

# Monitor errors
pm2 logs voiceagent-telephony --err --lines 50
```

---

## 📚 **Related Documentation**

- **Previous Release:** `RELEASE_NOTES_v4.4.3.md`
- **Cost Analysis:** `COST_OPTIMIZATION_ANALYSIS.md` (to be created)
- **Testing Results:** `MODEL_COMPARISON_RESULTS.md` (to be created after testing)
- **Webhook Documentation:** `SINGLEINTERFACE_WEBHOOK_DETAILS.md`

---

## 👥 **Contributors**

- **Model Testing:** Gulshan Mehta
- **Implementation:** AI Assistant
- **Deployment:** DevOps Team

---

## 📞 **Contact**

For questions or issues with this release:
- Email: info@pragyaa.ai
- Monitor: PM2 logs and OpenAI dashboard

---

**Version:** 4.5.0  
**Model:** gpt-4o-mini-realtime-preview-2024-12-17  
**Status:** Testing in Progress  
**Next Review:** After 20+ calls or 2-3 days of usage

