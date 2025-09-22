// 🔄 Queue Processor - Watches for new transcripts and triggers async processing
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

class QueueProcessor {
  constructor() {
    this.processingDir = path.join(process.cwd(), 'data', 'processing');
    this.transcriptsDir = path.join(process.cwd(), 'data', 'transcripts');
    this.resultsDir = path.join(process.cwd(), 'data', 'results');
    this.isProcessing = false;
    this.pollInterval = 5000; // Check every 5 seconds
    
    // 🔧 Ensure directories exist
    this.ensureDirectories();
    
    console.log('🔄 Queue Processor initialized');
    console.log('📁 Processing dir:', this.processingDir);
    console.log('📁 Transcripts dir:', this.transcriptsDir);
    console.log('📁 Results dir:', this.resultsDir);
  }

  // Ensure all required directories exist
  ensureDirectories() {
    const dirs = [this.processingDir, this.transcriptsDir, this.resultsDir];
    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`📁 Created directory: ${dir}`);
      }
    });
  }

  // Start watching for new queue entries
  start() {
    console.log('🚀 Starting queue processor...');
    this.processQueue();
    
    // Set up periodic polling
    setInterval(() => {
      if (!this.isProcessing) {
        this.processQueue();
      }
    }, this.pollInterval);
  }

  // Process all pending queue entries
  async processQueue() {
    try {
      // Ensure directories exist before processing
      this.ensureDirectories();
      
      // Get all pending queue files
      let queueFiles;
      try {
        queueFiles = fs.readdirSync(this.processingDir)
          .filter(file => file.endsWith('_queue.json'))
          .sort(); // Process in order
      } catch (readError) {
        if (readError.code === 'ENOENT') {
          console.log('📁 Processing directory not found, creating...');
          this.ensureDirectories();
          return; // Try again next cycle
        }
        throw readError;
      }

      if (queueFiles.length === 0) {
        return; // No work to do
      }

      // Note: Will filter for pending entries in processQueueEntry()
      console.log(`📋 Found ${queueFiles.length} queue entries to check`);
      this.isProcessing = true;

      for (const queueFile of queueFiles) {
        await this.processQueueEntry(queueFile);
      }

    } catch (error) {
      console.error('❌ Error processing queue:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  // Process a single queue entry
  async processQueueEntry(queueFilename) {
    const queuePath = path.join(this.processingDir, queueFilename);
    
    try {
      // Read queue entry
      const queueData = JSON.parse(fs.readFileSync(queuePath, 'utf8'));
      const { call_id, transcript_file, status } = queueData;

      // Skip if already processing or completed
      if (status !== 'pending') {
        return;
      }

      console.log(`[${call_id}] 🔄 Processing queue entry: ${queueFilename}`);

      // Update queue status to processing
      queueData.status = 'processing';
      queueData.processing_started_at = new Date().toISOString();
      fs.writeFileSync(queuePath, JSON.stringify(queueData, null, 2));

      // Get transcript file path
      const transcriptPath = path.join(this.transcriptsDir, transcript_file);
      
      if (!fs.existsSync(transcriptPath)) {
        throw new Error(`Transcript file not found: ${transcript_file}`);
      }

      // Process with async agent
      const result = await this.runAsyncAgent(transcriptPath, call_id);

      // Save result and update queue
      if (result.success) {
        await this.saveProcessingResult(call_id, result, queueData);
        
        // Mark queue entry as completed
        queueData.status = 'completed';
        queueData.completed_at = new Date().toISOString();
        queueData.result_file = `call_${call_id}_${Date.now()}_result.json`;
        
        console.log(`[${call_id}] ✅ Processing completed successfully`);
      } else {
        // Mark as failed
        queueData.status = 'failed';
        queueData.failed_at = new Date().toISOString();
        queueData.error = result.error;
        
        console.log(`[${call_id}] ❌ Processing failed:`, result.error);
      }

      // Update queue file
      fs.writeFileSync(queuePath, JSON.stringify(queueData, null, 2));

      // Optional: Clean up old queue files after success
      if (result.success) {
        // Keep for audit trail, but could delete after some time
        console.log(`[${call_id}] 📋 Queue entry marked as completed`);
      }

    } catch (error) {
      console.error(`❌ Error processing queue entry ${queueFilename}:`, error);
      
      // Mark queue entry as failed
      try {
        const queueData = JSON.parse(fs.readFileSync(queuePath, 'utf8'));
        queueData.status = 'failed';
        queueData.failed_at = new Date().toISOString();
        queueData.error = error.message;
        fs.writeFileSync(queuePath, JSON.stringify(queueData, null, 2));
      } catch (updateError) {
        console.error('❌ Failed to update queue entry status:', updateError);
      }
    }
  }

  // Run the async OpenAI Agent processor
  async runAsyncAgent(transcriptPath, callId) {
    return new Promise((resolve) => {
      console.log(`[${callId}] 🤖 Running async OpenAI Agent...`);
      
      const agentPath = path.join(__dirname, 'asyncAgentProcessor.mjs');
      const child = spawn('node', [agentPath, transcriptPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { 
          ...process.env, 
          OPENAI_API_KEY: process.env.OPENAI_API_KEY 
        }
      });

      let output = '';
      let errorOutput = '';

      child.stdout.on('data', (data) => {
        output += data.toString();
      });

      child.stderr.on('data', (data) => {
        errorOutput += data.toString();
        console.log(`[${callId}] 🤖 Agent stderr:`, data.toString().trim());
      });

      child.on('close', (code) => {
        if (code === 0 && output) {
          try {
            const result = JSON.parse(output);
            console.log(`[${callId}] ✅ Agent completed successfully`);
            resolve(result);
          } catch (parseError) {
            console.log(`[${callId}] ❌ Failed to parse agent output:`, parseError);
            resolve({
              success: false,
              error: 'Failed to parse agent output',
              raw_output: output
            });
          }
        } else {
          console.log(`[${callId}] ❌ Agent process failed (code: ${code})`);
          if (errorOutput) {
            console.log(`[${callId}] ❌ Agent error:`, errorOutput.trim());
          }
          resolve({
            success: false,
            error: `Agent process failed with code ${code}`,
            stderr: errorOutput,
            stdout: output
          });
        }
      });

      // Timeout after 120 seconds
      setTimeout(() => {
        child.kill();
        console.log(`[${callId}] ⏰ Agent timeout after 120s`);
        resolve({
          success: false,
          error: 'Agent processing timeout (120s)'
        });
      }, 120000);
    });
  }

  // Save processing result to results directory
  async saveProcessingResult(callId, agentResult, queueData) {
    const timestamp = Date.now();
    const resultFilename = `call_${callId}_${timestamp}_result.json`;
    const resultPath = path.join(this.resultsDir, resultFilename);

    // Load original transcript to get call analytics
    const transcriptPath = path.join(this.processingDir, queueData.transcript_file);
    let transcriptData = null;
    try {
      transcriptData = JSON.parse(fs.readFileSync(transcriptPath, 'utf8'));
    } catch (error) {
      console.log(`[${callId}] ⚠️ Could not load transcript file for enhanced analytics`);
    }

    // Extract analytics from transcript data
    const analytics = transcriptData?.analytics || {};
    const conversation = transcriptData?.conversation || [];

    // 🔧 ENHANCED: Complete data structure with all required fields
    const resultData = {
      call_id: callId,
      processed_at: new Date().toISOString(),
      success: agentResult.success,
      
      // 📊 PRIMARY: Extracted sales data with enhanced status
      extracted_data: {
        ...agentResult.extracted_data,
        // NEW: Individual data point status
        data_points: {
          full_name: {
            value: agentResult.extracted_data?.full_name || null,
            status: this.getDataPointStatus(agentResult.extracted_data?.full_name, agentResult.extracted_data?.confidence_scores?.full_name),
            confidence: agentResult.extracted_data?.confidence_scores?.full_name || 0,
            attempts: analytics.parameters_attempted?.includes('full_name') ? 1 : 0,
            timestamps: this.extractTimestamps(conversation, 'full_name')
          },
          car_model: {
            value: agentResult.extracted_data?.car_model || null,
            status: this.getDataPointStatus(agentResult.extracted_data?.car_model, agentResult.extracted_data?.confidence_scores?.car_model),
            confidence: agentResult.extracted_data?.confidence_scores?.car_model || 0,
            attempts: analytics.parameters_attempted?.includes('car_model') ? 1 : 0,
            timestamps: this.extractTimestamps(conversation, 'car_model')
          },
          email_id: {
            value: agentResult.extracted_data?.email_id || null,
            status: this.getDataPointStatus(agentResult.extracted_data?.email_id, agentResult.extracted_data?.confidence_scores?.email_id),
            confidence: agentResult.extracted_data?.confidence_scores?.email_id || 0,
            attempts: analytics.parameters_attempted?.includes('email_id') ? 1 : 0,
            timestamps: this.extractTimestamps(conversation, 'email_id')
          }
        },
        // NEW: Overall call status
        overall_status: this.getOverallCallStatus(agentResult.extracted_data)
      },
      
      // 🎯 ENHANCED: Call analytics with new required fields
      call_analytics: {
        call_length: transcriptData?.call_duration || 0,
        call_start_time: transcriptData?.call_start_time || null,
        call_end_time: transcriptData?.call_end_time || null,
        
        // Enhanced Q&A tracking
        question_answer_pairs: this.enhanceQuestionAnswerPairs(conversation, analytics.question_answer_pairs || 0),
        
        // Parameter tracking
        total_parameters_attempted: analytics.parameters_attempted?.length || 0,
        total_parameters_captured: analytics.parameters_captured?.length || 0,
        parameters_attempted: analytics.parameters_attempted || [],
        parameters_captured: analytics.parameters_captured || [],
        
        // Drop-off analysis  
        drop_off_point: analytics.drop_off_point || null,
        
        // Conversation metrics
        total_exchanges: analytics.total_exchanges || 0,
        user_messages: analytics.user_messages || 0,
        assistant_messages: analytics.assistant_messages || 0
      },
      
      // 🎯 PROCESSING: Essential metadata
      processing: {
        method: agentResult.processing_metadata?.processing_method || 'openai_agents_sdk',
        conversation_entries: agentResult.processing_metadata?.conversation_entries || 0,
        conversation_length: agentResult.processing_metadata?.conversation_length || 0,
        processing_time_ms: agentResult.processing_metadata?.processing_time_ms || null,
        transcript_file: queueData.transcript_file,
        started_at: queueData.processing_started_at,
        completed_at: new Date().toISOString()
      },
      
      // 🔍 OPTIONAL: Debug info (minimal, only if needed)
      debug: process.env.NODE_ENV === 'development' ? {
        agent_trace_id: agentResult.processing_metadata?.agent_result?.state?.trace?.id || null,
        token_usage: agentResult.processing_metadata?.agent_result?.state?.context?.usage || null
      } : undefined
    };

    try {
      fs.writeFileSync(resultPath, JSON.stringify(resultData, null, 2));
      console.log(`[${callId}] 💾 Result saved: ${resultFilename}`);
      
      // Also update the original call file with processed data
      await this.updateOriginalCallFile(callId, agentResult.extracted_data);
      
      return resultFilename;
    } catch (error) {
      console.error(`[${callId}] ❌ Failed to save result:`, error);
      throw error;
    }
  }

  // Update the original call JSON file with extracted data
  async updateOriginalCallFile(callId, extractedData) {
    try {
      const callsDir = path.join(process.cwd(), 'data', 'calls');
      const callFiles = fs.readdirSync(callsDir)
        .filter(file => file.startsWith(`call_${callId}_`) && file.endsWith('.json'))
        .sort()
        .reverse(); // Get the most recent

      if (callFiles.length === 0) {
        console.log(`[${callId}] ⚠️ No original call file found to update`);
        return;
      }

      const callFile = callFiles[0];
      const callPath = path.join(callsDir, callFile);
      const callData = JSON.parse(fs.readFileSync(callPath, 'utf8'));

      // Update with extracted data
      if (extractedData) {
        if (extractedData.full_name) {
          callData.salesData.full_name = extractedData.full_name;
        }
        if (extractedData.car_model) {
          callData.salesData.car_model = extractedData.car_model;
        }
        if (extractedData.email_id) {
          callData.salesData.email_id = extractedData.email_id;
        }
        
        // Update status
        const hasAllData = callData.salesData.full_name && 
                          callData.salesData.car_model && 
                          callData.salesData.email_id;
        callData.salesData.status = hasAllData ? 'Complete' : 'Partial';
        
        // Add processing metadata
        callData.salesData.processing_status = 'completed';
        callData.salesData.processed_at = new Date().toISOString();
        callData.salesData.confidence_scores = extractedData.confidence_scores;
        callData.salesData.extraction_method = 'openai_agents_sdk_async';
      }

      fs.writeFileSync(callPath, JSON.stringify(callData, null, 2));
      console.log(`[${callId}] 📝 Updated original call file: ${callFile}`);

    } catch (error) {
      console.error(`[${callId}] ❌ Failed to update original call file:`, error);
    }
  }

  // NEW: Helper method to determine data point status
  getDataPointStatus(value, confidence) {
    if (!value) return 'not_captured';
    
    if (confidence >= 0.9) return 'verified';
    if (confidence >= 0.7) return 'captured';
    if (confidence >= 0.5) return 'captured';
    return 'needs_to_be_validated';
  }

  // NEW: Helper method to determine overall call status
  getOverallCallStatus(extractedData) {
    const hasName = extractedData?.full_name;
    const hasModel = extractedData?.car_model;
    const hasEmail = extractedData?.email_id;
    
    if (hasName && hasModel && hasEmail) return 'complete';
    if (hasName || hasModel || hasEmail) return 'partial';
    return 'incomplete';
  }

  // NEW: Extract timestamps for specific data points from conversation
  extractTimestamps(conversation, dataType) {
    const relatedEntries = conversation.filter(entry => 
      entry.text && (
        (dataType === 'full_name' && /name|my name is|i am|this is/i.test(entry.text)) ||
        (dataType === 'car_model' && /car|model|vehicle|toyota|honda|ford|mahindra/i.test(entry.text)) ||
        (dataType === 'email_id' && /email|mail|gmail|yahoo|hotmail|@/i.test(entry.text))
      )
    );

    return {
      first_attempt: relatedEntries.length > 0 ? new Date(relatedEntries[0].timestamp).getTime() : null,
      last_attempt: relatedEntries.length > 0 ? new Date(relatedEntries[relatedEntries.length - 1].timestamp).getTime() : null,
      verified_at: null // This would be set when customer confirms the data
    };
  }

  // NEW: Enhance question-answer pairs with detailed timestamps and durations
  enhanceQuestionAnswerPairs(conversation, qaCount) {
    const pairs = [];
    
    // Simple implementation - in real scenario, this would be more sophisticated
    // to match actual Q&A pairs from the conversation
    let questionCount = 0;
    
    for (let i = 0; i < conversation.length - 1; i++) {
      const current = conversation[i];
      const next = conversation[i + 1];
      
      if (current.speaker === 'assistant' && next.speaker === 'user') {
        questionCount++;
        const questionTime = new Date(current.timestamp).getTime();
        const answerTime = new Date(next.timestamp).getTime();
        
        pairs.push({
          question: current.text,
          answer: next.text,
          question_timestamp: current.timestamp,
          answer_timestamp: next.timestamp,
          question_duration: current.text.length * 50, // Rough estimate based on text length
          answer_duration: answerTime - questionTime,
          total_duration: answerTime - questionTime,
          data_type: this.inferDataType(current.text),
          reattempts: 0 // Would need more logic to detect reattempts
        });
      }
    }
    
    return pairs;
  }

  // NEW: Infer what type of data a question is asking for
  inferDataType(questionText) {
    if (/name/i.test(questionText)) return 'full_name';
    if (/car|model|vehicle/i.test(questionText)) return 'car_model';
    if (/email|mail/i.test(questionText)) return 'email_id';
    return 'other';
  }
}

// If run directly, start the processor
if (require.main === module) {
  console.log('🚀 Starting Queue Processor Service...');
  
  const processor = new QueueProcessor();
  processor.start();
  
  // Keep the process running
  process.on('SIGINT', () => {
    console.log('🛑 Queue Processor shutting down...');
    process.exit(0);
  });
}

module.exports = QueueProcessor;
