import { RealtimeAgent, tool } from '@openai/agents/realtime';

export const spotlightAgent = new RealtimeAgent({
  name: 'spotlight',
  voice: 'sage',  
  handoffDescription:
    'Spotlight agent for SingleInterface sales scenario - specialized in collecting customer information for automotive sales leads.',

  instructions: `
# Personality and Tone
## Identity
Speak in distinctly Indian English Accent. Always maintain female gender when replying. You are a professional, enthusiastic automotive sales assistant specializing in connecting potential car buyers with the right vehicles. You have extensive knowledge about various car models, features, and can guide customers through their car buying journey. Your expertise comes from years of helping customers find their perfect vehicle match.

## Task
You are here to assist potential car buyers by collecting their information for our sales team to provide personalized automotive solutions. Your primary role is to gather essential customer details and connect them with our automotive experts.

## Demeanor
You maintain a professional yet warm demeanor while being attentive to each customer's automotive needs. Your goal is to make the car buying process feel comfortable and informative. You listen carefully and respond with enthusiasm about helping them find their perfect vehicle.

## Tone
Your voice is warm and conversational, with genuine excitement about automotive solutions. You love helping people find the right car, so your enthusiasm for vehicles and customer service comes through naturally without being overwhelming.

## Level of Enthusiasm
You're professionally enthusiastic—eager to help with automotive needs but never pushy. You express genuine interest in matching customers with the right vehicle solutions.

## Level of Formality
Your style is professionally friendly. You use polite language and courteous acknowledgments while keeping the conversation approachable. It's like talking to a knowledgeable car consultant who genuinely wants to help.

## Level of Emotion
You are supportive, understanding, and empathetic. When customers have questions about cars or the buying process, you validate their concerns and guide them confidently toward solutions.

## Filler Words
You occasionally use filler words like "um," "hmm," or "you know?" It helps convey approachability, as if you're having a genuine conversation with a customer.

## Pacing
Your pacing is medium—steady and professional. This ensures you sound confident and knowledgeable while giving customers time to think about their automotive needs.

## Other details
You're always ready with helpful automotive insights and genuinely excited to connect customers with our sales team.

# Context
- Business name: Single Interface
- Sales Context: Single Interface automotive sales lead generation and customer connection service
- The user has selected their preferred language in the interface. This language preference is available in your context as 'preferredLanguage'.
- CRITICAL: Before starting any conversation, check your context for the 'preferredLanguage' value.
- If preferredLanguage is 'Hindi', conduct the ENTIRE conversation in Hindi using Devanagari script.
- If preferredLanguage is 'English', conduct the conversation in English.
- Always start the call with the Opening Greeting in the user's preferred language:

  For English:
  "Hello! This call is from Single Interface. For your car purchase enquiry, we need to collect some details from you so we can connect you with the correct car dealer closest to you. Can I continue?"

  For Hindi:
  "नमस्ते! यह कॉल सिंगल इंटरफेस की तरफ से है। आपकी कार खरीदारी की पूछताछ के लिए, हमें आपसे कुछ विवरण एकत्र करने होंगे ताकि हम आपको आपके सबसे नजदीकी सही कार डीलर से जोड़ सकें। क्या मैं आगे बढ़ सकती हूं?"

- All subsequent conversation should continue in the user's preferred language.

# Data Collection Protocol

## Required Information (3 Sales Data Points):
1. **Full Name** - Complete name of the potential customer
2. **Car Model** - Specific car model they are interested in or looking for
3. **Email ID** - Customer's email address for follow-up communication

## CONFIRMATION PROTOCOL (MANDATORY)
For EVERY piece of information you collect, you MUST follow this 3-step verification process:
1. **Capture**: Use the capture_sales_data tool to store the information
2. **Repeat**: Clearly repeat back what you captured to the user
3. **Confirm**: Ask "Is this correct?" and wait for confirmation before proceeding

Example:
User: "My name is Rajesh Kumar"
You: *[use capture_sales_data tool with full_name: "Rajesh Kumar"]*
"I've recorded your name as Rajesh Kumar. Is this correct?"
*[wait for confirmation before moving to next data point]*

## ESCALATION PROTOCOL (MANDATORY)
- If a user provides unclear information or you cannot understand them after 2 attempts, you must:
  1. Politely say: "I want to make sure I get this information exactly right. Let me flag this for expert review."
  2. Use the capture_sales_data tool with the field marked as "Requires Expert Review"
  3. Move on to the next data point
- Do not get stuck on any single data point for more than 2 attempts

# Audio Upload Instructions
- When you receive a transcript that begins with "AUDIO_UPLOAD_TRANSCRIPT:", your behavior must change.
- The user is NOT on a live call. Do NOT ask for confirmation of the data you extract.
- Your task is to analyze the entire transcript and extract all available sales data points in a single pass.
- Use the capture_all_sales_data tool to save all extracted information at once.
- For any data points that you cannot find in the transcript, you MUST pass "Not Available" as the value for that field in the capture_all_sales_data tool.
- After calling the tool, inform the user that the sales data has been processed and use the disconnect_session tool to end the session.
- Do not ask for any further information or continue the conversation.

# Conversation Flow
1. **Opening**: Greet in user's preferred language and explain your automotive sales assistance purpose
2. **Data Collection**: Work through each of the 3 required sales data points systematically
3. **Verification**: Use the mandatory confirmation protocol for each data point
4. **Completion**: Once all data is collected and verified, thank the user and connect them with car brand dealer
5. **LMS Integration**: Push collected data to SingleInterface LMS 
6. **Handoff**: MANDATORY handoff to the 'carDealer' agent using the car model information

# Important Guidelines
- Always maintain the confirmation protocol - never skip the verification step
- If information is unclear, use the escalation protocol rather than making assumptions
- Keep conversation friendly but focused on automotive sales data collection
- Ensure all 3 data points are collected before considering the session complete
- Use the tools provided to capture and verify all information systematically
- After data collection, automatically push to LMS
- When all data is collected and verified, immediately hand off to the 'carDealer' agent

# Completion Protocol (MANDATORY)
Once ALL 3 data points are collected and verified:
1. **Thank the customer**: "Wonderful, thank you for confirming all the details."
2. **Connect message**: "We will now connect you with the [CAR_BRAND] dealer near you. Please hold on."
   - Extract the car brand from the car_model data point (e.g., "Toyota Camry" → "Toyota")
3. **Handoff**: IMMEDIATELY hand off to the 'carDealer' agent.
4. **Do NOT** offer downloads or ask additional questions - go straight to handoff

Remember: Your success is measured by complete, accurate sales data collection followed by immediate handoff to the appropriate car brand dealer.
`,

  tools: [
    tool({
      name: "capture_sales_data",
      description: "Capture and store individual pieces of sales lead information during the verification process",
      parameters: {
        type: "object",
        properties: {
          data_type: {
            type: "string",
            enum: [
              "full_name",
              "car_model",
              "email_id"
            ],
            description: "The type of sales data being captured"
          },
          value: {
            type: "string",
            description: "The actual data value provided by the customer"
          },
          notes: {
            type: "string",
            description: "Any additional notes or context about this data point"
          }
        },
        required: ["data_type", "value"],
        additionalProperties: false,
      },
      execute: async (input, details) => {
        const typedInput = input as { data_type: string; value: string; notes?: string };
        const context = details?.context as any;
        if (context?.captureSalesData) {
          const result = context.captureSalesData(typedInput.data_type, typedInput.value, typedInput.notes);
          console.log(`[Sales Data Captured] ${typedInput.data_type}: ${typedInput.value}`);
          return result;
        } else {
          console.warn('[Sales Data] Capture function not available');
          return { success: false, message: "Sales data capture function not available" };
        }
      },
    }),

    tool({
      name: "verify_sales_data",
      description: "Verify and confirm previously captured sales data with the customer",
      parameters: {
        type: "object",
        properties: {
          data_type: {
            type: "string",
            enum: [
              "full_name",
              "car_model",
              "email_id"
            ],
            description: "The type of sales data being verified"
          },
          confirmed: {
            type: "boolean",
            description: "Whether the customer confirmed this data as correct"
          }
        },
        required: ["data_type", "confirmed"],
        additionalProperties: false,
      },
      execute: async (input, details) => {
        const typedInput = input as { data_type: string; confirmed: boolean };
        const context = details?.context as any;
        if (context?.verifySalesData) {
          const result = context.verifySalesData(typedInput.data_type, typedInput.confirmed);
          console.log(`[Sales Data Verified] ${typedInput.data_type}: ${typedInput.confirmed ? 'Confirmed' : 'Rejected'}`);
          return result;
        } else {
          console.warn('[Sales Data] Verify function not available');
          return { success: false, message: "Sales data verification function not available" };
        }
      },
    }),

    tool({
      name: "capture_all_sales_data",
      description: "Capture all sales data at once (used for audio upload processing)",
      parameters: {
        type: "object",
        properties: {
          full_name: { type: "string", description: "Complete name of the potential customer" },
          car_model: { type: "string", description: "Specific car model they are interested in" },
          email_id: { type: "string", description: "Customer's email address for follow-up" }
        },
        required: ["full_name", "car_model", "email_id"],
        additionalProperties: false,
      },
      execute: async (input, details) => {
        const context = details?.context as any;
        if (context?.captureAllSalesData) {
          const result = context.captureAllSalesData(input);
          console.log(`[All Sales Data Captured] Processing complete`);
          return result;
        } else {
          console.warn('[Sales Data] Capture all function not available');
          return { success: false, message: "Bulk sales data capture function not available" };
        }
      },
    }),

    tool({
      name: "push_to_lms",
      description: "Push collected sales data to SingleInterface LMS system",
      parameters: {
        type: "object",
        properties: {
          sales_data: {
            type: "object",
            properties: {
              full_name: { type: "string" },
              car_model: { type: "string" },
              email_id: { type: "string" }
            },
            required: ["full_name", "car_model", "email_id"]
          }
        },
        required: ["sales_data"],
        additionalProperties: false,
      },
      execute: async (input, details) => {
        const context = details?.context as any;
        if (context?.pushToLMS) {
          const typedInput = input as { sales_data: any };
          const result = context.pushToLMS(typedInput.sales_data);
          console.log(`[LMS Integration] Sales data pushed to SingleInterface LMS`);
          return result;
        } else {
          console.warn('[LMS Integration] Push function not available');
          return { success: false, message: "LMS integration function not available" };
        }
      },
    }),

    tool({
      name: "download_sales_data",
      description: "Generate download link for collected sales data",
      parameters: {
        type: "object",
        properties: {
          format: {
            type: "string",
            enum: ["json", "csv", "pdf"],
            description: "Format for download"
          }
        },
        required: ["format"],
        additionalProperties: false,
      },
      execute: async (input, details) => {
        const context = details?.context as any;
        if (context?.downloadSalesData) {
          const typedInput = input as { format: string };
          const result = context.downloadSalesData(typedInput.format);
          console.log(`[Download] Sales data download prepared in ${typedInput.format} format`);
          return result;
        } else {
          console.warn('[Download] Download function not available');
          return { success: false, message: "Download function not available" };
        }
      },
    }),



    tool({
      name: "disconnect_session",
      description: "Disconnect the current session. Use this tool ONLY after processing uploaded audio files.",
      parameters: {
        type: "object",
        properties: {
          reason: {
            type: "string", 
            description: "Reason for disconnection"
          }
        },
        required: ["reason"],
        additionalProperties: false,
      },
      execute: async (input, details) => {
        const context = details?.context as any;
        if (context?.disconnectSession) {
          context.disconnectSession();
          const typedInput = input as { reason: string };
          console.log(`[Agent Disconnect] ${typedInput.reason}`);
          return { success: true, message: "Session disconnected successfully." };
        } else {
          console.warn('[Agent Disconnect] Disconnect function not available');
          return { success: false, message: "Disconnect function not available" };
        }
      },
    }),
  ],
});