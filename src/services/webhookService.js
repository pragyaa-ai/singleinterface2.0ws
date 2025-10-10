const fs = require('fs');
const path = require('path');

/**
 * Webhook Service for delivering call results to external systems
 * 
 * Handles:
 * - Telephony vendor notifications (simple)
 * - Single Interface API integration (complete data)
 * - Error handling and retry logic
 * - Async delivery to avoid blocking call processing
 */

class WebhookService {
  constructor() {
    this.baseUrl = process.env.WEBHOOK_BASE_URL || 'https://singleinterfacews.pragyaa.ai';
    this.enabled = process.env.WEBHOOKS_ENABLED !== 'false'; // Default enabled
    this.retryAttempts = parseInt(process.env.WEBHOOK_RETRY_ATTEMPTS || '3');
    this.timeout = parseInt(process.env.WEBHOOK_TIMEOUT_MS || '10000');
  }

  /**
   * Transform results data into Single Interface API format
   */
  transformToSingleInterfaceFormat(callId, resultData, transcriptData) {
    const startTime = transcriptData?.call_start_time ? 
      this.formatTimestamp(transcriptData.call_start_time) :
      this.formatTimestamp(new Date());
    
    const endTime = transcriptData?.call_end_time ? 
      this.formatTimestamp(transcriptData.call_end_time) :
      this.formatTimestamp(new Date());
    
    const duration = Math.round((transcriptData?.call_duration || 0) / 1000); // Convert to seconds
    
    // Extract Store_code and Customer_number from session data
    const storeCode = this.extractStoreCode(transcriptData);
    const customerNumber = this.extractCustomerNumber(transcriptData);
    
    // Determine dealer routing status and reason
    const routingInfo = this.determineDealerRouting(resultData, transcriptData);

    // Handle dropoff information
    const dropoffInfo = this.extractDropoffInfo(resultData, transcriptData);

    // Transform response data
    const responseData = this.transformResponseData(resultData, transcriptData);

    return {
      id: `bot_${callId}`,
      call_ref_id: callId,
      call_vendor: "Waybeo", // Updated to Waybeo as per new requirements
      recording_url: "", // No recording available currently
      start_time: startTime,
      end_time: endTime,
      Duration: duration, // Capital D as per new format
      Store_code: storeCode, // NEW: Store identifier
      Customer_number: customerNumber, // NEW: Customer phone number
      language: {
        welcome: "english", // Always starts in English
        conversational: this.detectConversationalLanguage(transcriptData)
      },
      dealer_routing: {
        status: routingInfo.status,
        reason: routingInfo.reason,
        time: routingInfo.time
      },
      dropoff: dropoffInfo,
      response_data: responseData
    };
  }

  /**
   * Format timestamp to Single Interface format: YYYY-MM-DD HH:mm:ss (no milliseconds)
   */
  formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }

  /**
   * Extract Store_code from transcript data
   * Store code should be passed from telephony vendor in session metadata
   */
  extractStoreCode(transcriptData) {
    // Try to extract from multiple possible locations
    const storeCode = 
      transcriptData?.store_code || 
      transcriptData?.Store_code ||
      transcriptData?.metadata?.store_code ||
      transcriptData?.metadata?.Store_code ||
      10001; // Default store code if not provided
    
    return parseInt(storeCode);
  }

  /**
   * Extract Customer_number from transcript data
   * Customer number should be the DID (dialed number) or caller ID from telephony vendor
   */
  extractCustomerNumber(transcriptData) {
    // Try to extract from multiple possible locations
    const customerNumber = 
      transcriptData?.customer_number ||
      transcriptData?.Customer_number ||
      transcriptData?.caller_id ||
      transcriptData?.did ||
      transcriptData?.phone_number ||
      transcriptData?.metadata?.customer_number ||
      transcriptData?.metadata?.did ||
      9999999999; // Default/placeholder if not provided
    
    // Ensure it's a number (remove any non-digit characters)
    const cleaned = String(customerNumber).replace(/\D/g, '');
    return parseInt(cleaned) || 9999999999;
  }

  /**
   * Determine dealer routing status and reason
   */
  determineDealerRouting(resultData, transcriptData) {
    const conversation = transcriptData?.conversation || [];
    const overallStatus = resultData.extracted_data?.overall_status || 'incomplete';
    const dataPoints = resultData.extracted_data?.data_points || {};
    
    // Check if customer explicitly requested to speak to dealer
    const customerRequestedDealer = this.didCustomerRequestDealer(conversation);
    
    // Check if agent decided to route due to understanding issues
    const hadUnderstandingIssues = this.hadUnderstandingIssues(resultData, conversation);
    
    // Determine routing status and reason
    let status = false;
    let reason = "";
    let time = "";
    
    if (customerRequestedDealer.requested) {
      // Customer specifically asked to talk to dealer
      status = true;
      reason = "User decided";
      time = customerRequestedDealer.timestamp;
    } else if (overallStatus === 'complete') {
      // All data collected successfully - route to dealer
      status = true;
      reason = "call completed";
      time = transcriptData?.end_time ? 
        this.formatTimestamp(transcriptData.end_time) : "";
    } else if (hadUnderstandingIssues.hadIssues) {
      // Unable to understand customer responses
      status = true;
      reason = "Unable to understand answers";
      time = hadUnderstandingIssues.timestamp;
    } else if (overallStatus === 'partial') {
      // Some data collected but incomplete
      status = false;
      reason = "Partial data collected - call ended";
      time = "";
    } else {
      // No data collected or call failed
      status = false;
      reason = "No data collected - call failed";
      time = "";
    }
    
    return { status, reason, time };
  }

  /**
   * Check if customer explicitly requested to speak to a dealer
   */
  didCustomerRequestDealer(conversation) {
    const userMessages = conversation.filter(entry => entry.speaker === 'user');
    
    const dealerRequestPatterns = [
      /\b(dealer|agent|person|human|representative|sales|executive)\b/i,
      /\b(talk to|speak to|connect me|transfer me)\b/i,
      /\b(someone|anybody|koi|kisi se)\b/i,
      /\b(vyakti|insaan|dealer se|sales se)\b/i // Hindi patterns
    ];
    
    for (const message of userMessages) {
      const text = message.text.toLowerCase();
      const hasMultiplePatterns = dealerRequestPatterns.filter(pattern => pattern.test(text)).length >= 2;
      
      if (hasMultiplePatterns) {
        return {
          requested: true,
          timestamp: this.formatTimestamp(message.timestamp)
        };
      }
    }
    
    return { requested: false, timestamp: "" };
  }

  /**
   * Check if there were understanding issues during the conversation
   */
  hadUnderstandingIssues(resultData, conversation) {
    const qaCount = resultData.call_analytics?.question_answer_pairs?.length || 0;
    const totalAttempts = Object.values(resultData.extracted_data?.data_points || {})
      .reduce((sum, point) => sum + (point.attempts || 0), 0);
    
    // High reattempt ratio indicates understanding issues
    const avgAttempts = qaCount > 0 ? totalAttempts / qaCount : 0;
    
    // Look for assistant messages indicating confusion
    const assistantMessages = conversation.filter(entry => entry.speaker === 'assistant');
    const confusionPatterns = [
      /\b(sorry|pardon|didn't understand|can you repeat|samjha nahi)\b/i,
      /\b(please say again|one more time|repeat|phir se)\b/i
    ];
    
    let confusionCount = 0;
    let lastConfusionTime = "";
    
    for (const message of assistantMessages) {
      const hasConfusion = confusionPatterns.some(pattern => pattern.test(message.text));
      if (hasConfusion) {
        confusionCount++;
        lastConfusionTime = this.formatTimestamp(message.timestamp);
      }
    }
    
    // Consider understanding issues if high reattempts OR multiple confusion indicators
    const hadIssues = avgAttempts > 2 || confusionCount >= 2;
    
    return {
      hadIssues,
      timestamp: lastConfusionTime || ""
    };
  }

  /**
   * Extract dropoff information from call data
   */
  extractDropoffInfo(resultData, transcriptData) {
    const dropoffPoint = resultData.call_analytics?.drop_off_point;
    
    // If no explicit dropoff point, determine from conversation flow
    if (!dropoffPoint) {
      const dropoffInfo = this.inferDropoffFromConversation(resultData, transcriptData);
      return dropoffInfo;
    }

    // Map internal dropoff events to Single Interface actions
    // Supports: ivr, name, model, email, qq1, qq2 (qualifying questions)
    const actionMap = {
      'name_request': 'name',
      'model_request': 'model', 
      'email_request': 'email',
      'qualifying_question_1': 'qq1',
      'qualifying_question_2': 'qq2',
      'qq1': 'qq1',
      'qq2': 'qq2',
      'greeting': 'ivr',
      'initial_greeting': 'ivr',
      'welcome': 'ivr'
    };

    return {
      time: this.formatTimestamp(dropoffPoint.timestamp),
      action: actionMap[dropoffPoint.lastEvent] || dropoffPoint.lastEvent || ""
    };
  }

  /**
   * Infer dropoff stage from conversation and captured data
   */
  inferDropoffFromConversation(resultData, transcriptData) {
    const dataPoints = resultData.extracted_data?.data_points || {};
    const conversation = transcriptData?.conversation || [];
    const overallStatus = resultData.extracted_data?.overall_status;
    
    // If call completed successfully, no dropoff
    if (overallStatus === 'complete') {
      return { time: "", action: "" };
    }

    // Find the last assistant message to determine what question was being asked
    const lastAssistantMessage = conversation
      .filter(entry => entry.speaker === 'assistant')
      .pop();

    let dropoffAction = "";
    let dropoffTime = "";

    if (lastAssistantMessage) {
      dropoffTime = this.formatTimestamp(lastAssistantMessage.timestamp);
      
      // Determine dropoff stage based on what data we have and what was being asked
      if (!dataPoints.full_name?.value) {
        dropoffAction = "name";
      } else if (!dataPoints.car_model?.value) {
        dropoffAction = "model";
      } else if (!dataPoints.email_id?.value) {
        dropoffAction = "email";
      } else {
        // Check the last question being asked
        const questionText = lastAssistantMessage.text.toLowerCase();
        if (questionText.includes('name') || questionText.includes('naam')) {
          dropoffAction = "name";
        } else if (questionText.includes('model') || questionText.includes('car') || questionText.includes('vehicle')) {
          dropoffAction = "model";
        } else if (questionText.includes('email') || questionText.includes('mail')) {
          dropoffAction = "email";
        } else if (questionText.includes('qualifying') || questionText.includes('qq1')) {
          dropoffAction = "qq1";
        } else if (questionText.includes('qq2')) {
          dropoffAction = "qq2";
        } else {
          dropoffAction = "ivr";
        }
      }
    } else {
      // Very early dropoff - during IVR/greeting
      dropoffAction = "ivr";
      dropoffTime = transcriptData?.start_time || "";
    }

    return {
      time: dropoffTime,
      action: dropoffAction
    };
  }

  /**
   * Detect the conversational language based on user responses
   */
  detectConversationalLanguage(transcriptData) {
    const conversation = transcriptData?.conversation || [];
    
    // Get user messages (customer responses)
    const userMessages = conversation
      .filter(entry => entry.speaker === 'user')
      .map(entry => entry.text.toLowerCase());

    if (userMessages.length === 0) {
      return "english"; // Default if no user messages
    }

    // Language detection patterns
    const languagePatterns = {
      hindi: [
        // Common Hindi words/phrases
        /\b(haan|nahin|nahi|ji|acha|theek|samjha|samjhi|naam|kar|main|mera|meri|hai|hoon|kya|kaise|kab|kaha|kyun)\b/,
        // Hindi greetings
        /\b(namaste|namaskar|sat sri akal|adab)\b/,
        // Hindi numbers
        /\b(ek|do|teen|char|paanch|chhe|saat|aath|nau|das)\b/,
        // Devanagari script detection
        /[\u0900-\u097F]/
      ],
      tamil: [
        // Common Tamil words
        /\b(illa|irukku|naan|enna|epdi|eppadi|vanakkam)\b/,
        // Tamil script detection
        /[\u0B80-\u0BFF]/
      ],
      telugu: [
        // Common Telugu words
        /\b(ledu|undi|nenu|enti|ela|namaskaram)\b/,
        // Telugu script detection
        /[\u0C00-\u0C7F]/
      ],
      kannada: [
        // Common Kannada words
        /\b(illa|ide|naanu|yaava|hege|namaskara)\b/,
        // Kannada script detection
        /[\u0C80-\u0CFF]/
      ],
      gujarati: [
        // Common Gujarati words
        /\b(nathi|chhe|hun|shu|kevi|namaste)\b/,
        // Gujarati script detection
        /[\u0A80-\u0AFF]/
      ],
      punjabi: [
        // Common Punjabi words
        /\b(nahi|hai|main|ki|kive|sat sri akal)\b/,
        // Punjabi script detection
        /[\u0A00-\u0A7F]/
      ]
    };

    // Count matches for each language
    const languageScores = {};
    
    for (const [language, patterns] of Object.entries(languagePatterns)) {
      languageScores[language] = 0;
      
      for (const message of userMessages) {
        for (const pattern of patterns) {
          if (pattern.test(message)) {
            languageScores[language]++;
          }
        }
      }
    }

    // Find language with highest score
    const detectedLanguage = Object.entries(languageScores)
      .reduce((a, b) => languageScores[a[0]] > languageScores[b[0]] ? a : b)[0];

    // Return detected language if score > 0, otherwise default to Hindi
    return languageScores[detectedLanguage] > 0 ? detectedLanguage : "hindi";
  }

  /**
   * Transform response data into Single Interface format
   */
  transformResponseData(resultData, transcriptData) {
    const responseData = [];
    const dataPoints = resultData.extracted_data?.data_points || {};
    
    // Name field
    if (dataPoints.full_name || this.wasAttempted('full_name', resultData)) {
      responseData.push({
        key_label: "What's your name",
        key_value: "name",
        key_response: dataPoints.full_name?.value || "",
        attempts: dataPoints.full_name?.attempts || 0,
        attempts_details: this.extractAttemptDetails('full_name', transcriptData),
        remarks: dataPoints.full_name?.status || "not_attempted"
      });
    }

    // Car model field  
    if (dataPoints.car_model || this.wasAttempted('car_model', resultData)) {
      responseData.push({
        key_label: "Which model you are looking for",
        key_value: "model", 
        key_response: dataPoints.car_model?.value || "",
        attempts: dataPoints.car_model?.attempts || 0,
        attempts_details: this.extractAttemptDetails('car_model', transcriptData),
        remarks: dataPoints.car_model?.status || "not_attempted"
      });
    }

    // Email field
    if (dataPoints.email_id || this.wasAttempted('email_id', resultData)) {
      responseData.push({
        key_label: "What is your email id",
        key_value: "email",
        key_response: dataPoints.email_id?.value || "",
        attempts: dataPoints.email_id?.attempts || 0,
        attempts_details: this.extractAttemptDetails('email_id', transcriptData),
        remarks: dataPoints.email_id?.status || "not_attempted"
      });
    }

    return responseData;
  }

  /**
   * Check if a data point was attempted during the call
   */
  wasAttempted(dataType, resultData) {
    const attemptedParams = resultData.call_analytics?.parameters_attempted || [];
    return attemptedParams.includes(dataType);
  }

  /**
   * Extract attempt details with timestamps from conversation
   */
  extractAttemptDetails(dataType, transcriptData) {
    const attempts = [];
    const qaList = transcriptData?.conversation || [];
    
    // Simple implementation - look for Q&A pairs related to this data type
    let sequence = 1;
    for (let i = 0; i < qaList.length - 1; i++) {
      const question = qaList[i];
      const answer = qaList[i + 1];
      
      if (question.speaker === 'assistant' && answer.speaker === 'user') {
        const isRelevant = this.isQuestionRelevant(question.text, dataType);
        
        if (isRelevant) {
          attempts.push({
            start_time: this.formatTimestamp(question.timestamp),
            end_time: this.formatTimestamp(answer.timestamp),
            sequence: sequence++
          });
        }
      }
    }
    
    return attempts.length > 0 ? attempts : [];
  }

  /**
   * Check if a question is relevant to a specific data type
   */
  isQuestionRelevant(questionText, dataType) {
    const patterns = {
      'full_name': /name|your name|what.*name|naam/i,
      'car_model': /model|car|vehicle|gaadi|which.*looking/i,
      'email_id': /email|mail|email.*id|mail.*id/i
    };
    
    return patterns[dataType]?.test(questionText) || false;
  }

  /**
   * Deliver webhook to telephony vendor (simple format)
   */
  async deliverTelephonyWebhook(callId, resultData) {
    if (!this.enabled) {
      console.log(`[${callId}] 📞 Telephony webhook disabled by config`);
      return;
    }

    const payload = {
      call_id: callId,
      processed_at: resultData.processed_at,
      success: resultData.success,
      overall_status: resultData.extracted_data?.overall_status || 'incomplete'
    };

    try {
      const response = await this.makeWebhookRequest(`${this.baseUrl}/api/webhooks/telephony`, payload);
      console.log(`[${callId}] 📞 Telephony webhook delivered successfully:`, response.status);
    } catch (error) {
      console.error(`[${callId}] ❌ Telephony webhook failed:`, error.message);
    }
  }

  /**
   * Deliver webhook to Single Interface (complete format)
   */
  async deliverSingleInterfaceWebhook(callId, resultData, transcriptData) {
    if (!this.enabled) {
      console.log(`[${callId}] 🎯 Single Interface webhook disabled by config`);
      return;
    }

    const payload = this.transformToSingleInterfaceFormat(callId, resultData, transcriptData);

    try {
      const response = await this.makeWebhookRequest(`${this.baseUrl}/api/webhooks/singleinterface`, payload);
      console.log(`[${callId}] 🎯 Single Interface webhook delivered successfully:`, response.status);
      
      // Log summary of delivered data
      console.log(`[${callId}] 📊 Delivered: ${payload.response_data.length} data points, duration: ${payload.duration}s`);
    } catch (error) {
      console.error(`[${callId}] ❌ Single Interface webhook failed:`, error.message);
    }
  }

  /**
   * Make HTTP request with retry logic
   */
  async makeWebhookRequest(url, payload, attempt = 1) {
    try {
      // Use dynamic import for fetch in Node.js
      const { default: fetch } = await import('node-fetch');
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'VoiceAgent-Webhook/1.0'
        },
        body: JSON.stringify(payload),
        timeout: this.timeout
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response;
    } catch (error) {
      if (attempt < this.retryAttempts) {
        console.log(`🔄 Webhook retry ${attempt + 1}/${this.retryAttempts} for ${url}`);
        await this.delay(1000 * attempt); // Exponential backoff
        return this.makeWebhookRequest(url, payload, attempt + 1);
      }
      throw error;
    }
  }

  /**
   * Utility: delay function
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Process both webhooks for a completed call
   */
  async processWebhooks(callId, resultData, transcriptData) {
    console.log(`[${callId}] 🚀 Processing webhooks...`);
    
    try {
      // Deliver both webhooks in parallel (non-blocking)
      const promises = [
        this.deliverTelephonyWebhook(callId, resultData),
        this.deliverSingleInterfaceWebhook(callId, resultData, transcriptData)
      ];

      // Don't await - let webhooks execute in background
      Promise.allSettled(promises).then(results => {
        const successes = results.filter(r => r.status === 'fulfilled').length;
        const failures = results.filter(r => r.status === 'rejected').length;
        console.log(`[${callId}] 📡 Webhook summary: ${successes} delivered, ${failures} failed`);
      });

    } catch (error) {
      console.error(`[${callId}] ❌ Webhook processing error:`, error);
    }
  }
}

module.exports = WebhookService;
