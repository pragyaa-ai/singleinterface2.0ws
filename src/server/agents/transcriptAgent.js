const { Agent, run, tool } = require('@openai/agents');
const { z } = require('zod');

// Sales data extraction tool following OpenAI SDK patterns
const extractSalesDataTool = tool({
  name: 'extract_sales_data',
  description: 'Extract sales data from customer transcript with confidence scoring',
  parameters: z.object({
    full_name: z.string().optional().describe('Customer complete name if clearly mentioned'),
    car_model: z.string().optional().describe('Specific car model if mentioned'),
    email_id: z.string().optional().describe('Email address if provided'),
    confidence: z.number().min(0).max(1).describe('Overall confidence score for this extraction (0-1)'),
    notes: z.string().optional().describe('Additional context or observations')
  }),
  execute: async (input) => {
    console.log('🎯 Tool executed with:', input);
    return { success: true, data: input };
  }
});

// Simple transcript processing agent
const transcriptDataAgent = new Agent({
  name: 'TranscriptProcessor',
  instructions: `
You are a sales data extraction specialist. Extract these specific data points from customer transcripts:

1. **full_name**: Customer's complete name (first and last name)
2. **car_model**: Specific car model they want (e.g., "Toyota Camry", "Honda Civic")  
3. **email_id**: Customer's email address

RULES:
- Only extract if information is clearly and explicitly mentioned
- Provide confidence score 0-1 (1.0 = completely certain)
- If information is unclear or ambiguous, set confidence < 0.7
- Don't make assumptions or infer information

Use the extract_sales_data tool when you find any sales information.
`,
  tools: [extractSalesDataTool]
});

/**
 * Process a transcript to extract sales data
 * @param {string} transcript - The customer transcript to process
 * @param {Object} sessionData - Current session data for context
 * @returns {Promise<Object|null>} Extracted data or null if processing failed
 */
async function processTranscript(transcript, sessionData = {}) {
  try {
    console.log(`🤖 Agent processing: "${transcript}"`);
    
    const context = `
Previous data: Name=${sessionData.full_name || 'none'}, Car=${sessionData.car_model || 'none'}, Email=${sessionData.email_id || 'none'}
New transcript: "${transcript}"

Extract any new sales data from this transcript using the extract_sales_data tool with appropriate confidence scores.
`;
    
    const result = await run(transcriptDataAgent, context);
    console.log('✅ Agent result:', result.finalOutput);
    
    return result;
    
  } catch (error) {
    console.error('❌ Agent processing failed:', error.message);
    return null;
  }
}

module.exports = { 
  processTranscript
};