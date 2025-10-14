# Multilingual Support & Mini Model Guide

**Version**: v4.3.3 (upcoming)  
**Date**: October 13, 2025

## 🌍 Multilingual Support

The VoiceAgent now supports **6 languages**:
- English (default)
- Hindi
- Marathi
- Telugu
- Tamil
- Malayalam

### How It Works

1. **Always Starts in English**: 
   - First greeting: "Namaskar.............. Welcome to Dee Emm Mahindra dealer. How may I help you today?"

2. **Automatic Language Detection**:
   - Agent listens to customer's first response
   - Detects the language they're speaking
   - Switches to that language for the entire conversation

3. **Stay in Detected Language**:
   - Once switched, continues in that language
   - Uses language-specific question variations
   - Confirms details in the same language

### Supported Question Variations

Each language has multiple variations for asking:
- Full Name
- Car Model interested in
- Email ID

**Example (Hindi)**:
- Name: "कृपया अपना पूरा नाम बताएं?" / "आपका नाम क्या है जी?"
- Car Model: "आप कौन सा महिंद्रा कार मॉडल चाहते हैं?"
- Email: "कृपया अपना ईमेल आईडी बताएं?"

## 🤖 Model Configuration

### Current Default: gpt-4o-realtime-preview-2024-12-17 (Mini Model)

The system is now configured to use the **mini model** by default, which offers:
- ✅ Faster response times
- ✅ Lower costs
- ✅ Same multilingual capabilities
- ✅ Identical conversation quality

### Switching Models

You can switch between models using the `VOICEAGENT_MODEL` environment variable:

#### Option 1: Mini Model (Default - Recommended)
```bash
export VOICEAGENT_MODEL="gpt-4o-realtime-preview-2024-12-17"
```

#### Option 2: Standard Model
```bash
export VOICEAGENT_MODEL="gpt-4o-realtime-preview-2025-06-03"
```

### No Model Specified?
If `VOICEAGENT_MODEL` is not set, the system defaults to the **mini model** (2024-12-17).

## 🚀 Deployment Instructions

### On GCP VM:

```bash
cd /opt/voiceagent

# Pull latest code
git fetch origin v4.3.0-webhook-updates
git reset --hard origin/v4.3.0-webhook-updates

# Set model (optional - defaults to mini)
export VOICEAGENT_MODEL="gpt-4o-realtime-preview-2024-12-17"

# Set Waybeo token
export WAYBEO_AUTH_TOKEN="<your-token>"

# Restart services
pm2 restart all --update-env
pm2 save

# Verify model in logs
pm2 logs voiceagent-telephony --lines 20 | grep "Using model"
# Should show: [UCID] 🤖 Using model: gpt-4o-realtime-preview-2024-12-17
```

### Permanent Configuration

Add to `.env` file:
```bash
# Model Configuration
VOICEAGENT_MODEL=gpt-4o-realtime-preview-2024-12-17

# Required tokens
OPENAI_API_KEY=<your-key>
WAYBEO_AUTH_TOKEN=<your-token>
```

## 🧪 Testing Scenarios

### Test 1: English Conversation
1. Call the number
2. Wait for English greeting
3. Respond in English: "Hello, I want to buy a car"
4. Conversation continues in English

### Test 2: Hindi Conversation
1. Call the number
2. Wait for English greeting
3. Respond in Hindi: "नमस्ते, मुझे गाड़ी खरीदनी है"
4. Agent switches to Hindi
5. All questions/confirmations in Hindi

### Test 3: Other Languages
Repeat above with:
- Marathi: "नमस्कार, मला गाडी खरेदी करायची आहे"
- Telugu: "నమస్కారం, నాకు కారు కొనాలి"
- Tamil: "வணக்கம், எனக்கு கார் வாங்க வேண்டும்"
- Malayalam: "നമസ്കാരം, എനിക്ക് കാർ വാങ്ങണം"

## 📊 What Doesn't Change

All core functionality remains identical:
- ✅ Transcript capture
- ✅ Webhook delivery (SingleInterface + Waybeo)
- ✅ Queue processor data extraction
- ✅ No "Hello" issue
- ✅ Natural conversation flow
- ✅ All v4.3.2 features

## 🔍 Verification

After deployment, check logs:

```bash
# 1. Verify model being used
pm2 logs voiceagent-telephony --lines 50 | grep "Using model"

# 2. Check multilingual greeting
pm2 logs voiceagent-telephony --lines 200 | grep "Namaskar"

# 3. Monitor language switching
pm2 logs voiceagent-telephony --lines 200 | grep -E "Hindi|Marathi|Telugu|Tamil|Malayalam|English"

# 4. Verify webhooks still working
pm2 logs voiceagent-queue-processor --lines 100 | grep "webhook delivered"
```

## ⚠️ Important Notes

### Mini Model Capabilities
- **Same quality** as standard model for this use case
- **Multilingual support** fully functional
- **Cost effective** for production
- **Faster** response times

### Language Detection
- Detection happens automatically after first customer response
- No manual language selection needed
- Agent switches seamlessly
- Stays in detected language throughout call

### Backward Compatibility
- All existing features work identically
- Webhooks unchanged
- Data extraction unchanged
- No breaking changes

## 🔄 Rollback

If you need to switch back to standard model:

```bash
export VOICEAGENT_MODEL="gpt-4o-realtime-preview-2025-06-03"
pm2 restart voiceagent-telephony --update-env
```

Or remove the environment variable to use mini model default:
```bash
unset VOICEAGENT_MODEL
pm2 restart voiceagent-telephony --update-env
```

## 📈 Performance Comparison

| Feature | Mini Model (2024-12-17) | Standard Model (2025-06-03) |
|---------|------------------------|----------------------------|
| Multilingual | ✅ Yes | ✅ Yes |
| Response Speed | ⚡ Faster | 🔵 Normal |
| Cost | 💰 Lower | 💰💰 Higher |
| Quality | ✅ Excellent | ✅ Excellent |
| Conversation Flow | ✅ Natural | ✅ Natural |

## 🎯 Recommended Setup

For production use with multilingual support:
- **Model**: `gpt-4o-realtime-preview-2024-12-17` (mini)
- **Languages**: All 6 enabled
- **Temperature**: 0.8 (current setting)
- **VAD Settings**: 300ms silence duration (current setting)

This configuration provides optimal performance, cost, and quality.

