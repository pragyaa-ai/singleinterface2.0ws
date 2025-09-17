// Bridge to load ES module OpenAI Agent
const { spawn } = require('child_process');
const path = require('path');

async function processTranscript(transcript, sessionData = {}) {
  return new Promise((resolve) => {
    try {
      console.log(`🤖 Running OpenAI Agent: "${transcript}"`);
      
      const agentPath = path.join(__dirname, 'agentRunner.mjs');
      const child = spawn('node', [agentPath, transcript], {
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      let output = '';
      let errorOutput = '';
      
      child.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      child.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });
      
      child.on('close', (code) => {
        if (code === 0 && output) {
          try {
            const result = JSON.parse(output);
            console.log(`✅ OpenAI Agent result:`, result);
            resolve(result);
          } catch (e) {
            console.log(`🔄 Agent output parse failed, using fallback`);
            resolve(null);
          }
        } else {
          console.log(`🔄 Agent process failed (code: ${code}), using fallback`);
          if (errorOutput) {
            console.log(`🔄 Agent error:`, errorOutput.trim());
          }
          resolve(null);
        }
      });
      
      // Timeout after 30 seconds (increased for better OpenAI response time)
      setTimeout(() => {
        child.kill();
        console.log(`🔄 Agent timeout, using fallback`);
        resolve(null);
      }, 30000);
      
    } catch (error) {
      console.log(`🔄 Agent spawn failed: ${error.message}`);
      resolve(null);
    }
  });
}

module.exports = { 
  processTranscript
};