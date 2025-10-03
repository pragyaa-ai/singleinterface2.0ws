# 🧪 Model Testing Guide - Mini vs Full Comparison

**Version:** 4.5.0  
**Testing Period:** October 3-5, 2025  
**Objective:** Evaluate gpt-4o-mini-realtime vs gpt-realtime for cost-quality tradeoff

---

## 🎯 **Quick Start: How to Compare**

### **Option 1: Parallel Deployment (Recommended)**

Run both models simultaneously on different ports:

| Instance | Model | Port | Purpose |
|----------|-------|------|---------|
| **Primary** | gpt-realtime (Full) | 3000 | Current production |
| **Test** | gpt-4o-mini-realtime | 3001 | Cost optimization test |

Route 50% of calls to each, compare results.

### **Option 2: Sequential Testing**

Test Mini model for 2-3 days, compare with historical Full model data.

---

## 📊 **Tracking Spreadsheet Template**

Copy this to Google Sheets or Excel:

### **Daily Metrics**

| Date | Model | Total Calls | Complete (%) | Partial (%) | Failed (%) | Avg Duration (s) | Avg Attempts | Daily Cost ($) | Notes |
|------|-------|-------------|--------------|-------------|------------|------------------|--------------|----------------|-------|
| Oct 3 | Full | 8 | 73% | 15% | 12% | 95 | 1.3 | 1.70 | Baseline |
| Oct 4 | Mini | | | | | | | | |
| Oct 5 | Mini | | | | | | | | |

### **Per-Call Comparison**

| Call ID | Model | Name Captured | Car Model | Email | Attempts (Name) | Attempts (Model) | Attempts (Email) | Duration | Status |
|---------|-------|---------------|-----------|-------|-----------------|------------------|------------------|----------|--------|
| 18882... | Full | ✅ | ✅ | ✅ | 1 | 1 | 2 | 142s | Complete |
| 18883... | Mini | ✅ | ✅ | ❌ | 2 | 1 | 3 | 158s | Partial |

---

## 🔍 **What to Look For**

### **✅ GOOD SIGNS (Mini Model is Working):**

1. **Data Capture:** 70%+ completion rate
2. **Attempts:** ≤1.5 average attempts per field
3. **Duration:** ≤110s average call duration
4. **Dropoff:** ≤18% dropoff rate
5. **Naturalness:** Conversations feel smooth
6. **Cost:** ~75% reduction in OpenAI costs

### **⚠️ WARNING SIGNS (Quality Issues):**

1. **Attempts:** >2 average attempts per field
2. **Duration:** >120s average (too many retries)
3. **Dropoff:** >20% (customers hanging up)
4. **Accuracy:** Frequent wrong captures
5. **Complaints:** Customers mention "not understanding"
6. **Escalations:** More "need expert review" flags

### **🚨 RED FLAGS (Stop Test, Revert):**

1. **Capture Rate:** Drops below 65%
2. **Attempts:** >2.5 average per field
3. **Dropoff:** >25% of calls
4. **Customer Complaints:** Multiple complaints in 1 day
5. **System Errors:** Model timeouts or failures

---

## 📋 **Quality Assessment Checklist**

### **After 10 Calls with Mini Model:**

- [ ] Data capture rate ≥70%
- [ ] Average attempts ≤1.5 per field
- [ ] Average duration ≤110s
- [ ] No major customer complaints
- [ ] Conversations sound natural (listen to 2-3 recordings)
- [ ] Email spelling accuracy maintained
- [ ] Complex Indian names handled well
- [ ] Cost reduced by ~70%

**If 7/8 boxes checked:** Continue testing  
**If <6/8 boxes checked:** Consider reverting or adjusting

---

## 🎧 **Manual Quality Review**

Listen to 3-5 sample calls and rate:

### **Conversation Naturalness (1-5)**

| Aspect | Full Model | Mini Model | Notes |
|--------|------------|------------|-------|
| **Voice Quality** | 5 | ? | Clear, warm, Indian accent |
| **Phrasing** | 5 | ? | Natural sentence structure |
| **Confirmations** | 5 | ? | Smooth "Is this correct?" flow |
| **Greetings** | 5 | ? | "Namaskar" delivery |
| **Transitions** | 5 | ? | Moving between questions |
| **Overall Feel** | 5 | ? | Human-like conversation |

**Rating Scale:**
- **5** = Excellent, indistinguishable from Full model
- **4** = Good, minor differences
- **3** = Acceptable, noticeable but not problematic
- **2** = Poor, quality degradation
- **1** = Unacceptable, needs immediate revert

**Pass Criteria:** Average ≥4.0 across all aspects

---

## 💰 **Cost Comparison Calculator**

### **Daily Cost Breakdown**

| Component | Full Model | Mini Model | Formula |
|-----------|------------|------------|---------|
| **Cached Input** | $1.635 | $0.408 | (Tokens × Rate × Calls) |
| **Text Output** | $0.048 | $0.012 | (Tokens × Rate × Calls) |
| **Audio Input** | $X | $X | Same for both |
| **Audio Output** | $Y | $Y | Same for both |
| **Total** | ~$1.70 | ~$0.45 | Sum of all |

### **Monthly Projection**

```
Full Model Monthly:  $1.70 × 30 = $51.00
Mini Model Monthly:  $0.45 × 30 = $13.50
Monthly Savings:     $51.00 - $13.50 = $37.50
Annual Savings:      $37.50 × 12 = $450.00
```

**ROI Calculation:**
- If quality maintained → **$450/year savings** ✅
- If hybrid needed → **$225/year savings** (50% Mini usage) ⚠️
- If full revert → **$0 savings, optimize instructions instead** ❌

---

## 📊 **Statistical Significance**

To make a confident decision, collect:

**Minimum Sample Size:**
- **Quick Decision (1-2 days):** 20+ calls per model
- **Confident Decision (3-5 days):** 50+ calls per model
- **High Confidence (1 week):** 100+ calls per model

**Statistical Test:**
Compare completion rates using:
```
Difference threshold: ±5%
Confidence level: 95%
```

If Mini model within ±5% of Full model → **Statistically equivalent** ✅

---

## 🔄 **Decision Matrix**

After testing, use this matrix to decide:

| Completion Rate | Avg Attempts | Cost Savings | Decision |
|-----------------|--------------|--------------|----------|
| ≥70% | ≤1.5 | 75% | ✅ **Deploy Mini permanently** |
| 65-70% | 1.5-2.0 | 75% | ⚠️ **Optimize instructions, retest** |
| 60-65% | 2.0-2.5 | 75% | 🔄 **Implement hybrid approach** |
| <60% | >2.5 | 75% | ❌ **Revert to Full model** |

---

## 🚀 **Next Actions Based on Results**

### **Scenario A: Mini Model Passes (Most Likely)**

**Quality:** ✅ Meets all criteria  
**Cost:** ✅ ~75% savings

**Actions:**
1. ✅ Make v4.5.0 permanent
2. ✅ Update production to Mini model
3. ✅ Further optimize instructions (~5-10% additional savings)
4. ✅ Document best practices
5. ✅ Monitor for 1 week, then consider complete

**Total Savings:** ~80% (~$40/month)

---

### **Scenario B: Mini Model Needs Tweaking**

**Quality:** ⚠️ Close but slightly below threshold  
**Cost:** ✅ ~75% savings potential

**Actions:**
1. 🔧 Optimize system instructions
2. 🔧 Simplify confirmation protocols
3. 🔧 Add more examples in tool descriptions
4. 🔧 Retest with optimized instructions
5. 🔧 Re-evaluate after changes

**Total Savings:** ~70-75% with instruction optimization

---

### **Scenario C: Hybrid Approach Needed**

**Quality:** ⚠️ Mixed results - some calls great, some struggle  
**Cost:** ✅ Partial savings possible

**Actions:**
1. 🔄 Implement intelligent model selection
2. 🔄 Use Mini for:
   - Simple names (English-sounding)
   - Common car models (Scorpio, XUV700, Thar)
   - Standard email domains (@gmail, @yahoo)
3. 🔄 Use Full for:
   - Complex Indian names
   - Multiple reattempts detected
   - Customer frustration indicators
4. 🔄 Track hybrid performance

**Total Savings:** ~40-50% (assuming 60% Mini usage)

**Implementation:**
```typescript
function selectModel(callContext) {
  // Start with Mini
  let model = 'gpt-4o-mini-realtime-preview-2024-12-17';
  
  // Upgrade to Full if needed
  if (callContext.complexName || callContext.reattempts > 2) {
    model = 'gpt-realtime';
    console.log('Upgrading to Full model due to complexity');
  }
  
  return model;
}
```

---

### **Scenario D: Mini Model Fails**

**Quality:** ❌ Below acceptable threshold  
**Cost:** ✅ Savings not worth quality loss

**Actions:**
1. ❌ Revert to v4.4.3 (Full model)
2. ✅ Optimize system instructions only (~35% savings)
3. ✅ Consider other cost optimizations:
   - Reduce instruction verbosity
   - Remove redundant examples
   - Simplify tool descriptions
4. ✅ Monitor Full model costs
5. ✅ Re-evaluate Mini model in 3-6 months (may improve)

**Total Savings:** ~35% with instruction optimization only

---

## 📈 **Long-Term Monitoring**

Even after deploying Mini model permanently, track:

**Weekly Check:**
- Completion rate trend
- Average attempts trend
- Cost per call
- Customer complaints

**Monthly Review:**
- Compare with Full model baseline
- Evaluate if quality degrading over time
- Check OpenAI model updates
- Consider re-testing Full model sample

---

## 🛠️ **Tools & Commands**

### **Check Current Model in Logs:**
```bash
pm2 logs voiceagent-telephony --lines 100 | grep "🤖 Using model"
```

### **Count Successful Captures:**
```bash
# Full model instance
pm2 logs voiceagent-telephony --lines 500 | grep "capture_all_sales_data" | grep "complete" | wc -l

# Mini model instance  
pm2 logs voiceagent-telephony-mini --lines 500 | grep "capture_all_sales_data" | grep "complete" | wc -l
```

### **Calculate Average Attempts:**
```bash
# Extract attempt counts from logs
pm2 logs voiceagent-telephony --lines 500 | grep "attempts:" | awk '{sum+=$NF; count++} END {print sum/count}'
```

### **Monitor Cost in Real-Time:**
Check OpenAI dashboard: https://platform.openai.com/usage

---

## 📞 **Customer Feedback Collection**

Optional: Ask dealers for feedback after 1 week:

**Questions:**
1. Have you noticed any change in call quality?
2. Are customers mentioning issues with the voice agent?
3. Is data capture accuracy maintained?
4. Any increase in manual corrections needed?

---

## ✅ **Final Checklist Before Permanent Deployment**

- [ ] Tested with 20+ calls
- [ ] Completion rate ≥70%
- [ ] Average attempts ≤1.5
- [ ] Average duration ≤110s
- [ ] Listened to 3-5 sample calls
- [ ] No major customer complaints
- [ ] Cost reduced by ~70%
- [ ] Team approved quality level
- [ ] Rollback plan documented
- [ ] Monitoring set up for post-deployment

**If all checked:** Deploy v4.5.0 permanently! 🎉

---

**Ready to Test?** Start collecting data and fill in the tracking spreadsheet! 📊

