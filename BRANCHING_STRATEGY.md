# Branching Strategy - VoiceAgent Project

## 📋 Branch Overview

### Production Branch: `v4.3.0-live`
**Purpose:** Stable production-ready code  
**Status:** ✅ Production Ready  
**Current Version:** v4.3.3  
**Tag:** v4.3.3-live

**What's included:**
- ✅ Working call transfer feature (tested and verified)
- ✅ Non-blocking execution (no silence/agent blocking)
- ✅ Complete multilingual support (6 languages)
- ✅ Webhooks to SingleInterface and Waybeo
- ✅ All critical bugs fixed
- ✅ Model: gpt-realtime (95-99% reliability)

**Use this for:**
- Production deployments to GCP VM
- Client demonstrations
- Stable releases
- Critical hotfixes

### Development Branch: `v4.3.0-webhook-updates`
**Purpose:** Feature development and testing  
**Status:** 🧪 Development/Testing  
**Current Version:** v4.3.3 (same codebase as live, for now)

**What happens here:**
- 🧪 New feature development
- 🔬 Experimental changes
- 🧪 Testing and validation
- 📊 Performance optimizations
- 🎨 UX improvements

**Use this for:**
- Testing new features (e.g., mini model optimization)
- Experimenting with improvements
- Testing before production release
- Development iterations

---

## 🔄 Workflow

### Feature Development Flow

```
1. Develop in v4.3.0-webhook-updates
   ↓
2. Test thoroughly
   ↓
3. Verify all scenarios work
   ↓
4. Merge to v4.3.0-live
   ↓
5. Tag new version (e.g., v4.3.4-live)
   ↓
6. Deploy to production
```

### Example: Adding Mini Model Support

**Step 1: Develop in webhook-updates**
```bash
git checkout v4.3.0-webhook-updates
# Make changes to support mini model
git add .
git commit -m "feat: Add mini model optimization"
git push origin v4.3.0-webhook-updates
```

**Step 2: Test on GCP VM**
```bash
# On GCP VM
cd /opt/voiceagent
git checkout v4.3.0-webhook-updates
git pull origin v4.3.0-webhook-updates
npm run build
pm2 restart voiceagent-telephony
# Test for 5-10 calls, verify 85%+ success rate
```

**Step 3: Merge to Live (if successful)**
```bash
# On local machine
git checkout v4.3.0-live
git merge v4.3.0-webhook-updates
# Update version in package.json (e.g., 4.3.3 → 4.3.4)
git add package.json
git commit -m "chore: Release v4.3.4 - Mini model optimization"
git tag -a v4.3.4-live -m "v4.3.4 - Mini model optimization for cost savings"
git push origin v4.3.0-live
git push origin v4.3.4-live
```

**Step 4: Deploy to Production**
```bash
# On GCP VM
cd /opt/voiceagent
git checkout v4.3.0-live
git pull origin v4.3.0-live
npm run build
pm2 restart voiceagent-telephony
```

---

## 🏷️ Tagging Convention

### Format: `v<major>.<minor>.<patch>-<branch>`

**Examples:**
- `v4.3.3-live` - Production release
- `v4.3.1-stable-webhooks` - Stable checkpoint
- `v4.3.2-stable` - Previous stable version

### When to Create Tags

**Create tags for:**
- ✅ Production releases (every merge to live)
- ✅ Stable checkpoints (known good states)
- ✅ Major feature releases
- ✅ Before risky changes (safety checkpoint)

**Don't create tags for:**
- ❌ Every commit
- ❌ Minor bug fixes (unless production hotfix)
- ❌ Development experiments

---

## 📊 Current State

### v4.3.0-live (Production)
```
Latest Commit: 06a87bd
Version: 4.3.3
Tag: v4.3.3-live
Features:
  - Call transfer (working, tested)
  - Non-blocking execution
  - Multilingual support
  - Webhooks (SingleInterface + Waybeo)
  - Model: gpt-realtime
Status: PRODUCTION READY ✅
```

### v4.3.0-webhook-updates (Development)
```
Latest Commit: ee45df6
Version: 4.3.3 (same as live for now)
Tag: None (development branch)
Features:
  - Same as live branch currently
  - Ready for new feature development
Status: READY FOR DEVELOPMENT 🧪
```

---

## 🚀 Deployment Guide

### Deploy Production (v4.3.0-live)

```bash
cd /opt/voiceagent
git fetch origin
git checkout v4.3.0-live
git pull origin v4.3.0-live
npm run build
pm2 restart voiceagent-telephony
pm2 restart voiceagent-queue-processor
```

### Test Development (v4.3.0-webhook-updates)

```bash
cd /opt/voiceagent
git fetch origin
git checkout v4.3.0-webhook-updates
git pull origin v4.3.0-webhook-updates
npm run build
pm2 restart voiceagent-telephony
pm2 restart voiceagent-queue-processor
```

---

## 🔐 Protection Rules

### v4.3.0-live Branch
**Protected:** Yes  
**Rules:**
- Only merge tested features from webhook-updates
- All commits must be working and tested
- Tag every merge
- Document changes in release notes
- Deployment guide required for breaking changes

### v4.3.0-webhook-updates Branch
**Protected:** No  
**Rules:**
- Experimental features allowed
- Breaking changes OK (as long as documented)
- Test thoroughly before merging to live
- Can force-push if needed (with caution)

---

## 📝 Commit Message Convention

### Format
```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `chore`: Maintenance, version bumps
- `refactor`: Code refactoring
- `perf`: Performance improvement
- `test`: Testing changes

### Examples

**Good:**
```
feat(transfer): Add call transfer to Waybeo

- Implement transfer_call tool
- Add 5-second delay for speech completion
- Support multilingual transfer messages

Tested with Waybeo and Ozonetel vendors.
```

**Bad:**
```
Update code
```

---

## 🧪 Testing Strategy

### Before Merging to Live

**Minimum requirements:**
- [ ] Feature works in development branch
- [ ] Tested with 5+ real calls
- [ ] No regressions (existing features still work)
- [ ] Documentation updated
- [ ] Release notes created (if major feature)
- [ ] Deployment guide updated (if needed)
- [ ] Success rate > 90% (for critical features)

### Testing Checklist

**Basic functionality:**
- [ ] Agent answers calls
- [ ] Greeting works
- [ ] Language switching works
- [ ] Data collection works
- [ ] Confirmation protocol works

**New feature:**
- [ ] Feature works as expected
- [ ] Edge cases handled
- [ ] Error handling in place
- [ ] Logs are informative

**No regressions:**
- [ ] Transfer still works (if applicable)
- [ ] Webhooks still deliver
- [ ] No new "Hello" issues
- [ ] No blocking/silence issues

---

## 🔄 Rollback Procedure

### If Issues Found in Production

**Option 1: Rollback to Previous Tag**
```bash
cd /opt/voiceagent
git checkout v4.3.2-stable  # Previous known good version
npm run build
pm2 restart all
```

**Option 2: Hotfix**
```bash
# On local machine
git checkout v4.3.0-live
# Make critical fix
git add .
git commit -m "hotfix: Fix critical issue"
git tag -a v4.3.3-hotfix-1 -m "Hotfix for critical issue"
git push origin v4.3.0-live
git push origin v4.3.3-hotfix-1

# On GCP VM
cd /opt/voiceagent
git pull origin v4.3.0-live
npm run build
pm2 restart all
```

---

## 📚 Related Documentation

- `RELEASE_NOTES_v4.3.3.md` - Current production release details
- `DEPLOYMENT_GUIDE_v4.3.3.md` - How to deploy v4.3.3
- `E2E_TESTING_WITH_STANDARD_MODEL.md` - Testing guide
- `BLOCKING_DELAY_FIX.md` - Non-blocking execution details

---

## 🎯 Future Features (Planned for webhook-updates)

### Potential Features to Test
- [ ] Mini model as default (cost optimization)
- [ ] Dynamic delay based on language
- [ ] Transfer retry logic
- [ ] Enhanced error handling
- [ ] Support for additional telephony vendors
- [ ] Call recording integration
- [ ] Real-time analytics dashboard

### Process for Each Feature
1. Develop in `v4.3.0-webhook-updates`
2. Test with 10+ real calls
3. Document thoroughly
4. If successful (>90% reliability), merge to `v4.3.0-live`
5. Tag new version
6. Deploy to production

---

## ✅ Summary

| Branch | Purpose | Status | Deploy To |
|--------|---------|--------|-----------|
| `v4.3.0-live` | Production | ✅ Ready | GCP VM Production |
| `v4.3.0-webhook-updates` | Development | 🧪 Testing | GCP VM Staging/Test |

**Current Production Version:** v4.3.3  
**Next Development Focus:** Mini model optimization or new features  
**Branching Strategy:** Develop → Test → Merge → Tag → Deploy

---

**Last Updated:** October 15, 2025  
**Maintained By:** Development Team

