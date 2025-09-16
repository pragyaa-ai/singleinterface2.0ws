// Standalone ES module runner for OpenAI Agent
import { Agent, run, tool } from '@openai/agents';
import { z } from 'zod';

const extractTool = tool({
  name: 'extract_sales_data',
  description: 'Extract sales data',
  parameters: z.object({
    full_name: z.string().nullable(),
    car_model: z.string().nullable(), 
    email_id: z.string().nullable(),
    confidence: z.number().min(0).max(1).default(0.8)
  }),
  execute: async (input) => {
    return { success: true, data: input };
  }
});

const agent = new Agent({
  name: 'TranscriptProcessor',
  instructions: 'Extract sales data from transcript. Use extract_sales_data tool.',
  tools: [extractTool]
});

// Get transcript from command line args
const transcript = process.argv[2] || '';

if (transcript) {
  try {
    const result = await run(agent, `Extract sales data from: "${transcript}"`);
    console.log(JSON.stringify(result));
  } catch (error) {
    console.error(JSON.stringify({ error: error.message }));
  }
} else {
  console.error(JSON.stringify({ error: 'No transcript provided' }));
}
