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
      new Date(transcriptData.call_start_time).toLocaleString('sv-SE').replace('T', ' ') :
      new Date().toLocaleString('sv-SE').replace('T', ' ');
    
    const endTime = transcriptData?.call_end_time ? 
      new Date(transcriptData.call_end_time).toLocaleString('sv-SE').replace('T', ' ') :
      new Date().toLocaleString('sv-SE').replace('T', ' ');
    
    const duration = Math.round((transcriptData?.call_duration || 0) / 1000); // Convert to seconds
    
    // Determine overall routing status
    const overallStatus = resultData.extracted_data?.overall_status || 'incomplete';
    const dealerRoutingStatus = overallStatus === 'complete';
    const dealerRoutingReason = overallStatus === 'complete' ? 'call completed' : 
      overallStatus === 'partial' ? 'some data missing' : 'unable to collect data';

    // Handle dropoff information
    const dropoffInfo = this.extractDropoffInfo(resultData, transcriptData);

    // Transform response data
    const responseData = this.transformResponseData(resultData, transcriptData);

    return {
      id: `bot_${callId}`,
      call_ref_id: callId,
      call_vendor: "Ozonetel",
      recording_url: `${this.baseUrl}/recordings/call_${callId}.mp3`, // Placeholder
      start_time: startTime,
      end_time: endTime,
      duration: duration,
      language: {
        welcome: "english",
        conversational: "hindi" // Default, could be enhanced based on actual detection
      },
      dealer_routing: {
        status: dealerRoutingStatus,
        reason: dealerRoutingReason,
        time: endTime
      },
      dropoff: dropoffInfo,
      response_data: responseData
    };
  }

  /**
   * Extract dropoff information from call data
   */
  extractDropoffInfo(resultData, transcriptData) {
    const dropoffPoint = resultData.call_analytics?.drop_off_point;
    
    if (!dropoffPoint) {
      return {
        time: "",
        action: ""
      };
    }

    // Map internal dropoff events to Single Interface actions
    const actionMap = {
      'name_request': 'name',
      'model_request': 'model', 
      'email_request': 'email',
      'greeting': 'ivr'
    };

    return {
      time: new Date(dropoffPoint.timestamp).toLocaleString('sv-SE').replace('T', ' '),
      action: actionMap[dropoffPoint.lastEvent] || dropoffPoint.lastEvent || ""
    };
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
            start_time: new Date(question.timestamp).toLocaleString('sv-SE').replace('T', ' '),
            end_time: new Date(answer.timestamp).toLocaleString('sv-SE').replace('T', ' '),
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
