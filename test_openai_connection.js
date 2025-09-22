#!/usr/bin/env node

// Test OpenAI Realtime API connection
import 'dotenv/config';
import WebSocket from 'ws';

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  console.error('❌ OPENAI_API_KEY not found');
  process.exit(1);
}

console.log('🔑 API Key found:', apiKey.substring(0, 20) + '...');

const openaiWs = new WebSocket('wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2025-06-03', {
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'OpenAI-Beta': 'realtime=v1'
  }
});

openaiWs.on('open', () => {
  console.log('✅ Connected to OpenAI Realtime API');
  
  // Send session config
  const sessionConfig = {
    type: 'session.update',
    session: {
      input_audio_format: 'pcm16',
      output_audio_format: 'pcm16',
      voice: 'alloy',
      instructions: 'Say hello and introduce yourself briefly.'
    }
  };
  
  openaiWs.send(JSON.stringify(sessionConfig));
  console.log('📤 Session config sent');
  
  // Test with a simple text input
  setTimeout(() => {
    openaiWs.send(JSON.stringify({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text: 'Hello, can you hear me?' }]
      }
    }));
    
    openaiWs.send(JSON.stringify({ type: 'response.create' }));
    console.log('📤 Test message sent');
  }, 1000);
});

openaiWs.on('message', (data) => {
  try {
    const event = JSON.parse(data.toString());
    console.log('📨 OpenAI Event:', event.type);
    
    if (event.type === 'response.audio.delta') {
      console.log('🎵 Audio delta received:', event.delta ? 'YES' : 'NO');
    }
    
    if (event.type === 'response.done') {
      console.log('✅ Response completed');
      openaiWs.close();
    }
  } catch (err) {
    console.error('❌ Parse error:', err);
  }
});

openaiWs.on('error', (err) => {
  console.error('❌ OpenAI connection error:', err);
});

openaiWs.on('close', () => {
  console.log('🔌 OpenAI connection closed');
  process.exit(0);
});

// Timeout after 10 seconds
setTimeout(() => {
  console.log('⏰ Test timeout');
  openaiWs.close();
}, 10000);
