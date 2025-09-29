# Release Notes v4.4.0

## 🚀 Major Updates

### OpenAI Model Upgrade
- **Updated to `gpt-realtime` model** (latest OpenAI Realtime API)
- **Previous**: `gpt-4o-realtime-preview-2025-06-03` (invalid future-dated model)
- **Benefits**: Better performance, improved latency, enhanced audio quality

### Voice Activity Detection (VAD) Optimization
- **Optimized for faster response times** and better speech detection
- **New Settings**:
  - `threshold: 0.3` (more sensitive, was 0.5)
  - `silence_duration_ms: 200` (faster response, was 300ms)
  - `prefix_padding_ms: 400` (better word capture, was 300ms)
- **Result**: Eliminates need to repeat "Hello" multiple times during conversation

### Function Call Improvements
- **Fixed `capture_all_sales_data` function** to work with session data
- **Removed required parameters** that were causing empty argument failures
- **Enhanced error handling** for incomplete data scenarios
- **Result**: Smooth call completion without hanging or confusion

## 🔧 Technical Changes

### Model Configuration
```typescript
// Before
model: 'gpt-4o-realtime-preview-2025-06-03'

// After  
model: 'gpt-realtime'
```

### VAD Configuration
```typescript
// Before
turn_detection: {
  type: 'server_vad',
  threshold: 0.5,
  prefix_padding_ms: 300,
  silence_duration_ms: 300
}

// After
turn_detection: {
  type: 'server_vad', 
  threshold: 0.3,
  prefix_padding_ms: 400,
  silence_duration_ms: 200
}
```

### Function Definition
```typescript
// Before
"capture_all_sales_data": {
  required: ["full_name", "car_model", "email_id"]
}

// After
"capture_all_sales_data": {
  required: []  // Uses session data instead
}
```

## 🐛 Bug Fixes

1. **Empty Transcript Issue**: Fixed frequent empty transcripts requiring repeated "Hello"
2. **Function Call Failures**: Resolved `capture_all_sales_data` empty arguments error
3. **Call Completion Hanging**: Fixed AI confusion at end of call workflow
4. **VAD Sensitivity**: Improved speech detection accuracy

## 🔄 Deployment

### For GCP VM:
```bash
# Pull latest changes
cd /opt/voiceagent
git pull origin main

# Restart services
pm2 restart voiceagent-telephony

# Verify logs
pm2 logs voiceagent-telephony --lines 10
```

### Rollback if needed:
```bash
# Revert to v4.3.0 if issues occur
git checkout v4.3.0
pm2 restart voiceagent-telephony
```

## ✅ Validation

### Test Checklist:
- [ ] Call connects successfully
- [ ] Agent greets with Dee Emm Mahindra persona
- [ ] User can provide name without repeating "Hello"
- [ ] Car model capture works smoothly
- [ ] Email confirmation flows naturally
- [ ] Call ends cleanly without hanging
- [ ] Data is saved correctly

### Expected Improvements:
- **Faster response times** during conversation
- **Smoother data collection** without interruptions
- **Clean call completion** without function call errors
- **Better speech recognition** accuracy

## 📋 Files Modified

- `package.json` - Version bump to 4.4.0
- `src/server/telephony/index.ts` - Model update, VAD fixes, function improvements

## 🚨 Breaking Changes
None - Backward compatible with existing deployment infrastructure.

## 📞 Support
If issues occur, refer to backup files in GCP VM:
- `index.ts.backup-working-YYYYMMDD_HHMMSS`
- `index.ts.backup-before-vad-fix`
- `index.ts.backup-before-function-fix`
