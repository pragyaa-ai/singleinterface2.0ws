import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { mockDashboardStats } from '@/lib/admin/mockData';

interface CallData {
  ucid: string;
  timestamp: string;
  salesData: {
    status: string;
    full_name?: string;
    car_model?: string;
    email_id?: string;
  };
  callAnalytics?: {
    callDuration: number;
  };
}

export async function GET(request: NextRequest) {
  try {
    // Get dashboard statistics
    const stats = await getDashboardStats();
    
    return NextResponse.json(stats);
  } catch (error) {
    console.error('Dashboard API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data' },
      { status: 500 }
    );
  }
}

async function getDashboardStats() {
  const dataDir = path.join(process.cwd(), 'data');
  const callsDir = path.join(dataDir, 'calls');
  const resultsDir = path.join(dataDir, 'results');
  
  // Initialize stats
  let totalCalls = 0;
  let todaysCalls = 0;
  let successfulCalls = 0;
  let totalDuration = 0;
  
  const today = new Date().toISOString().split('T')[0];
  
  try {
    // Read call files from data/calls directory
    if (fs.existsSync(callsDir)) {
      const callFiles = fs.readdirSync(callsDir)
        .filter(file => file.startsWith('call_') && file.endsWith('.json'));
      
      totalCalls = callFiles.length;
      
      for (const file of callFiles) {
        try {
          const filePath = path.join(callsDir, file);
          const fileContent = fs.readFileSync(filePath, 'utf8');
          const callData: CallData = JSON.parse(fileContent);
          
          // Check if call is from today
          const callDate = new Date(callData.timestamp).toISOString().split('T')[0];
          if (callDate === today) {
            todaysCalls++;
          }
          
          // Count successful calls
          if (callData.salesData?.status === 'Complete') {
            successfulCalls++;
          }
          
          // Add to total duration
          if (callData.callAnalytics?.callDuration) {
            totalDuration += callData.callAnalytics.callDuration;
          }
        } catch (fileError) {
          console.error(`Error reading call file ${file}:`, fileError);
        }
      }
    }
    
    // Also check results directory for additional data
    if (fs.existsSync(resultsDir)) {
      const resultFiles = fs.readdirSync(resultsDir)
        .filter(file => file.startsWith('call_') && file.endsWith('_result.json'));
      
      // If we have more results than calls, use results count
      if (resultFiles.length > totalCalls) {
        totalCalls = resultFiles.length;
      }
    }
  } catch (error) {
    console.error('Error reading data directories:', error);
    // Return mock data for local development
    return mockDashboardStats;
  }
  
  // If no real data found, return mock data for development
  if (totalCalls === 0) {
    console.log('No call data found, returning mock data for development');
    return mockDashboardStats;
  }
  
  // Calculate metrics
  const successRate = totalCalls > 0 ? Math.round((successfulCalls / totalCalls) * 100) : 0;
  const averageDuration = totalCalls > 0 ? Math.round(totalDuration / totalCalls) : 0;
  
  // Determine active model (this would come from configuration in a real implementation)
  const activeModel = 'VoiceAgent Full'; // Default for now
  
  // System health check (simplified)
  const systemHealth = await checkSystemHealth();
  
  return {
    totalCalls,
    todaysCalls,
    successRate,
    averageDuration,
    activeModel,
    systemHealth
  };
}

async function checkSystemHealth(): Promise<'healthy' | 'warning' | 'error'> {
  try {
    // Check if key directories exist
    const dataDir = path.join(process.cwd(), 'data');
    const requiredDirs = ['calls', 'transcripts', 'results', 'processing'];
    
    for (const dir of requiredDirs) {
      const dirPath = path.join(dataDir, dir);
      if (!fs.existsSync(dirPath)) {
        return 'warning';
      }
    }
    
    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
      return 'error';
    }
    
    // Additional health checks could be added here
    // - Check PM2 processes
    // - Check webhook connectivity
    // - Check disk space
    
    return 'healthy';
  } catch (error) {
    console.error('Health check error:', error);
    return 'error';
  }
}
