import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { mockCallData } from '@/lib/admin/mockData';

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
  call_duration?: number;
}

interface CallRecord {
  id: string;
  call_ref_id: string;
  date_time: string;
  duration: number;
  status: 'complete' | 'partial' | 'failed' | 'no_data';
  customer_name?: string;
  car_model?: string;
  email?: string;
  model_used: 'VoiceAgent Mini' | 'VoiceAgent Full';
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');
    
    const recentCalls = await getRecentCalls(limit);
    
    return NextResponse.json(recentCalls);
  } catch (error) {
    console.error('Recent calls API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recent calls' },
      { status: 500 }
    );
  }
}

async function getRecentCalls(limit: number): Promise<CallRecord[]> {
  const dataDir = path.join(process.cwd(), 'data');
  const callsDir = path.join(dataDir, 'calls');
  const calls: CallRecord[] = [];
  
  try {
    if (fs.existsSync(callsDir)) {
      const callFiles = fs.readdirSync(callsDir)
        .filter(file => file.startsWith('call_') && file.endsWith('.json'))
        .sort((a, b) => {
          // Sort by filename (which includes timestamp) in descending order
          return b.localeCompare(a);
        })
        .slice(0, limit);
      
      for (const file of callFiles) {
        try {
          const filePath = path.join(callsDir, file);
          const fileContent = fs.readFileSync(filePath, 'utf8');
          const callData: CallData = JSON.parse(fileContent);
          
          // Map status to our enum
          let status: CallRecord['status'] = 'no_data';
          switch (callData.salesData?.status?.toLowerCase()) {
            case 'complete':
              status = 'complete';
              break;
            case 'partial':
              status = 'partial';
              break;
            case 'failed':
              status = 'failed';
              break;
            default:
              status = 'no_data';
              break;
          }
          
          // Calculate duration
          const duration = callData.callAnalytics?.callDuration || 
                          callData.call_duration || 
                          0;
          
          // Determine model used (simplified logic)
          const model_used: CallRecord['model_used'] = 'VoiceAgent Full'; // Default for now
          
          calls.push({
            id: callData.ucid,
            call_ref_id: callData.ucid.substring(0, 8), // Shortened for display
            date_time: callData.timestamp,
            duration: Math.round(duration / 1000), // Convert to seconds
            status,
            customer_name: callData.salesData?.full_name,
            car_model: callData.salesData?.car_model,
            email: callData.salesData?.email_id,
            model_used
          });
        } catch (fileError) {
          console.error(`Error reading call file ${file}:`, fileError);
        }
      }
    }
  } catch (error) {
    console.error('Error reading calls directory:', error);
  }
  
  // If no real data found, return mock data for development
  if (calls.length === 0) {
    console.log('No call data found, returning mock data for development');
    return mockCallData.slice(0, limit).map(call => ({
      id: call.ucid,
      call_ref_id: call.ucid.substring(0, 8),
      date_time: call.timestamp,
      duration: Math.round((call.callAnalytics?.callDuration || 0) / 1000),
      status: call.salesData.status.toLowerCase() as any,
      customer_name: call.salesData.full_name || undefined,
      car_model: call.salesData.car_model || undefined,
      email: call.salesData.email_id || undefined,
      model_used: 'VoiceAgent Full' as any
    }));
  }
  
  return calls;
}
