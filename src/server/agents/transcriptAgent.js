const { Agent, run, tool } = require('@openai/agents');

// Simple transcript processing agent for sales data extraction
const transcriptDataAgent = new Agent({
  name: 'TranscriptProcessor',
  instructions: `
You are a sales data extraction specialist. Your job is to extract specific information from customer transcripts.

EXTRACT ONLY THESE 3 DATA POINTS:
1. **full_name**: Customer's complete name (first and last name)
2. **car_model**: Specific car model they want (e.g., "Toyota Camry", "Honda Civic")  
3. **email_id**: Customer's email address

RULES:
- Only extract if information is clearly and explicitly mentioned
- Provide confidence score 0-1 (1.0 = completely certain)
- If information is unclear or ambiguous, set confidence < 0.7
- Don't make assumptions or infer information
- Process each transcript independently but consider previous session data

EXAMPLES:
- "My name is John Smith" → full_name: "John Smith", confidence: 0.95
- "I want a Toyota Camry" → car_model: "Toyota Camry", confidence: 0.9  
- "Email is john@gmail.com" → email_id: "john@gmail.com", confidence: 1.0
- "I think my name is..." → confidence: 0.4 (uncertain)
`,
  tools: [
    tool({
      name: 'extract_sales_data',
      description: 'Extract sales data from customer transcript with confidence scoring',
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          full_name: { 
            type: "string", 
            description: "Customer's complete name if clearly mentioned" 
          },
          car_model: { 
            type: "string", 
            description: "Specific car model if mentioned" 
          },  
          email_id: { 
            type: "string", 
            description: "Email address if provided" 
          },
          confidence: { 
            type: "number", 
            minimum: 0, 
            maximum: 1,
            description: "Overall confidence score for this extraction (0-1)" 
          },
          notes: {
            type: "string",
            description: "Any additional context or observations"
          }
        },
        required: ["confidence"]
      },
      execute: async (input) => {
        return { success: true, data: input };
      }
    })
  ]
});

/**
 * Process a transcript to extract sales data
 * @param {string} transcript - The customer transcript to process
 * @param {Object} sessionData - Current session data for context
 * @returns {Object|null} Extracted data or null if processing failed
 */
async function processTranscript(transcript, sessionData = {}) {
  try {
    console.log(`🤖 Agent processing transcript: "${transcript}"`);
    
    const context = `
CURRENT SESSION DATA:
- Name: ${sessionData.full_name || 'Not captured'}
- Car Model: ${sessionData.car_model || 'Not captured'}  
- Email: ${sessionData.email_id || 'Not captured'}

NEW TRANSCRIPT TO PROCESS: "${transcript}"

Extract any new sales data from this transcript. Use the extract_sales_data tool with appropriate confidence scores.
`;
    
    const result = await run(transcriptDataAgent, context);
    
    // Check if agent used the extraction tool
    if (result.finalOutput && result.finalOutput.includes('extract_sales_data')) {
      console.log(`✅ Agent completed processing`);
      return result;
    }
    
    return null;
    
  } catch (error) {
    console.error('❌ Agent processing failed:', error.message);
    return null;
  }
}

/**
 * Extract tool call results from agent response
 * @param {Object} agentResult - Result from agent processing
 * @returns {Object|null} Extracted tool call data
 */
function extractToolCallData(agentResult) {
  try {
    // This will depend on the actual structure of the agent result
    // We'll need to inspect the actual response format
    if (agentResult && agentResult.messages) {
      for (const message of agentResult.messages) {
        if (message.tool_calls) {
          for (const toolCall of message.tool_calls) {
            if (toolCall.function && toolCall.function.name === 'extract_sales_data') {
              return JSON.parse(toolCall.function.arguments);
            }
          }
        }
      }
    }
    return null;
  } catch (error) {
    console.error('Error extracting tool call data:', error);
    return null;
  }
}

module.exports = { 
  processTranscript,
  extractToolCallData
};
