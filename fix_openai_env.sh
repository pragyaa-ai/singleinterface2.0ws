#!/bin/bash

echo "🔍 Checking OpenAI API Key Environment Setup..."
echo ""

echo "1. Checking if PM2 has OPENAI_API_KEY:"
pm2 env 1 | grep OPENAI
echo ""

echo "2. Checking if .env file has OPENAI_API_KEY:"
grep OPENAI_API_KEY .env
echo ""

echo "3. Loading environment variables from .env:"
source .env
echo "✅ Environment variables loaded"
echo ""

echo "4. Restarting telephony service with updated environment:"
pm2 restart voiceagent-telephony --update-env
echo ""

echo "5. Checking logs after restart:"
echo "Looking for 'Connected to OpenAI' message..."
sleep 3
pm2 logs voiceagent-telephony --lines 15
echo ""

echo "🎯 Script completed! Now make a test call and check if it connects properly."
echo "   You should see 'Connected to OpenAI' messages when a call comes in."
