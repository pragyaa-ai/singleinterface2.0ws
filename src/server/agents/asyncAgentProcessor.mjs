// 🔄 ENHANCED: Full Context OpenAI Agents SDK Processor
import { Agent, run, tool } from '@openai/agents';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';

// Enhanced extraction tool for complete conversation analysis
const extractCompleteDataTool = tool({
  name: 'extract_complete_sales_data',
  description: 'Extract all sales data from complete conversation with confidence scoring',
  parameters: z.object({
    full_name: z.string().nullable().describe('Customer\'s complete name'),
    car_model: z.string().nullable().describe('Car model or brand they are interested in'),
    email_id: z.string().nullable().describe('Customer\'s email address'),
    phone_number: z.string().nullable().describe('Customer\'s phone number (future field)'),
    location: z.string().nullable().describe('Customer\'s location/city (future field)'),
    confidence_scores: z.object({
      name_confidence: z.number().min(0).max(1).default(0.8).describe('Confidence in name extraction'),
      car_confidence: z.number().min(0).max(1).default(0.8).describe('Confidence in car model extraction'),
      email_confidence: z.number().min(0).max(1).default(0.8).describe('Confidence in email extraction')
    }).default({}),
    extraction_notes: z.string().optional().describe('Notes about extraction challenges or ambiguities'),
    conversation_quality: z.enum(['excellent', 'good', 'fair', 'poor']).default('good').describe('Overall conversation quality assessment')
  }),
  execute: async (input) => {
    return { 
      success: true, 
      extracted_data: input, 
      processed_at: new Date().toISOString(),
      processing_method: 'openai_agents_sdk'
    };
  }
});

// Create enhanced agent with detailed instructions
const fullContextAgent = new Agent({
  name: 'FullContextTranscriptProcessor',
  instructions: `You are an expert sales data extraction agent analyzing COMPLETE call conversations.

CONTEXT: You receive the full conversation transcript with timestamps showing the entire customer interaction from start to finish.

TASK: Extract sales lead information with high accuracy by analyzing the complete conversation flow.

ANALYSIS APPROACH:
1. **Read the entire conversation** - don't just look at individual messages
2. **Identify patterns** - customers often repeat or correct information
3. **Handle format variations** - "John dot Smith at gmail dot com" should become "John.Smith@gmail.com"
4. **Use context clues** - unclear responses often become clear later in conversation
5. **Prioritize latest information** - if customer corrects themselves, use the final version
6. **Assess confidence** - base confidence on clarity, repetition, and context

EXTRACTION RULES:
- **Name**: Look for "My name is...", "I am...", "This is...", "It is..." patterns
- **Email**: Handle both "user@domain.com" and "user at domain dot com" formats
- **Car Model**: Extract specific models like "Toyota Camry" or general interest like "Toyota"
- **Corrections**: If customer repeats/corrects info, use the LATEST version
- **Confidence**: 
  - 0.9-1.0: Clear, repeated, or confirmed information
  - 0.7-0.9: Clear but mentioned only once
  - 0.5-0.7: Somewhat unclear but extractable
  - 0.3-0.5: Very unclear, low confidence
  - 0.0-0.3: Not mentioned or completely unclear

CONVERSATION QUALITY ASSESSMENT:
- **excellent**: All data clear, customer responsive, good audio quality
- **good**: Most data clear, some repetition needed
- **fair**: Some unclear responses, moderate confidence in extraction
- **poor**: Very unclear, poor audio, customer unresponsive

EXAMPLES:
Input: "Hello", "It is Gulshan.Mehta at gmail.com", "Yes"
Extract: name="Gulshan Mehta", email="Gulshan.Mehta@gmail.com", confidence high

Input: "My name is John", "Actually, it's John Smith", "Toyota Camry please"
Extract: name="John Smith" (latest version), car_model="Toyota Camry"

Use the extract_complete_sales_data tool with your findings.`,
  tools: [extractCompleteDataTool]
});

// Main processing function
async function processTranscriptFile(transcriptFilePath) {
  try {
    console.log('🤖 Processing transcript file:', transcriptFilePath);
    
    // Read transcript file
    const transcriptData = JSON.parse(fs.readFileSync(transcriptFilePath, 'utf8'));
    const { call_id, conversation, simple_transcripts } = transcriptData;
    
    console.log(`[${call_id}] 📚 Processing ${conversation?.length || 0} conversation entries`);
    
    // Prepare conversation context for the agent
    let conversationText = '';
    
    if (conversation && conversation.length > 0) {
      // Use rich transcript with timestamps
      conversationText = conversation.map(entry => 
        `[${entry.timestamp}] ${entry.speaker.toUpperCase()}: ${entry.text}`
      ).join('\n');
    } else if (simple_transcripts && simple_transcripts.length > 0) {
      // Fallback to simple transcripts
      conversationText = simple_transcripts.join('\n');
    } else {
      throw new Error('No conversation data found in transcript file');
    }
    
    console.log(`[${call_id}] 📝 Conversation context prepared (${conversationText.length} chars)`);
    
    // Process with OpenAI Agent
    const agentPrompt = `Analyze this complete sales call conversation and extract all relevant customer information:

CONVERSATION TRANSCRIPT:
${conversationText}

Please extract all available sales data with confidence scores and provide notes about the conversation quality.`;

    console.log(`[${call_id}] 🚀 Running OpenAI Agent analysis...`);
    const result = await run(fullContextAgent, agentPrompt);
    
    console.log(`[${call_id}] ✅ Agent processing completed`);
    console.log(`[${call_id}] 📊 Raw result:`, JSON.stringify(result, null, 2));
    
    // Extract the tool result
    if (result && result.state && result.state.currentStep && result.state.currentStep.output) {
      const extractedData = result.state.currentStep.output;
      console.log(`[${call_id}] 🎯 Extracted data:`, extractedData);
      
      return {
        success: true,
        call_id,
        extracted_data: extractedData.extracted_data || extractedData,
        processing_metadata: {
          processed_at: new Date().toISOString(),
          processing_method: 'openai_agents_sdk_full_context',
          conversation_entries: conversation?.length || 0,
          conversation_length: conversationText.length,
          agent_result: result
        }
      };
    } else {
      console.log(`[${call_id}] ⚠️ No extraction result found in agent response`);
      return {
        success: false,
        call_id,
        error: 'No extraction result found in agent response',
        raw_result: result
      };
    }
    
  } catch (error) {
    console.error('❌ Agent processing failed:', error);
    return {
      success: false,
      error: error.message,
      stack: error.stack
    };
  }
}

// Command line interface
if (process.argv.length < 3) {
  console.error('Usage: node asyncAgentProcessor.mjs <transcript-file-path>');
  process.exit(1);
}

const transcriptFilePath = process.argv[2];

// Verify file exists
if (!fs.existsSync(transcriptFilePath)) {
  console.error('❌ Transcript file not found:', transcriptFilePath);
  process.exit(1);
}

// Process the file
processTranscriptFile(transcriptFilePath)
  .then(result => {
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.success ? 0 : 1);
  })
  .catch(error => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
