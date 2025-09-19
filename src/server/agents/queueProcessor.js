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

    // 🔧 OPTIMIZED: Clean, single-source structure without redundancy
    const resultData = {
      call_id: callId,
      processed_at: new Date().toISOString(),
      success: agentResult.success,
      
      // 📊 PRIMARY: Extracted sales data (single source of truth)
      extracted_data: agentResult.extracted_data || null,
      
      // 🎯 PROCESSING: Essential metadata only
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
