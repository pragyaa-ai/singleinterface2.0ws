import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { mockChartData } from '@/lib/admin/mockData';

interface CallData {
  ucid: string;
  timestamp: string;
  salesData: {
    status: string;
  };
}

interface ChartDataPoint {
  date: string;
  total: number;
  successful: number;
  partial: number;
  failed: number;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '7');
    
    const chartData = await getChartData(days);
    
    return NextResponse.json(chartData);
  } catch (error) {
    console.error('Chart API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch chart data' },
      { status: 500 }
    );
  }
}

async function getChartData(days: number): Promise<ChartDataPoint[]> {
  const dataDir = path.join(process.cwd(), 'data');
  const callsDir = path.join(dataDir, 'calls');
  
  // Initialize data structure for the requested number of days
  const chartData: ChartDataPoint[] = [];
  const today = new Date();
  
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateString = date.toISOString().split('T')[0];
    
    chartData.push({
      date: dateString,
      total: 0,
      successful: 0,
      partial: 0,
      failed: 0
    });
  }
  
  try {
    if (fs.existsSync(callsDir)) {
      const callFiles = fs.readdirSync(callsDir)
        .filter(file => file.startsWith('call_') && file.endsWith('.json'));
      
      for (const file of callFiles) {
        try {
          const filePath = path.join(callsDir, file);
          const fileContent = fs.readFileSync(filePath, 'utf8');
          const callData: CallData = JSON.parse(fileContent);
          
          const callDate = new Date(callData.timestamp).toISOString().split('T')[0];
          const dataPoint = chartData.find(d => d.date === callDate);
          
          if (dataPoint) {
            dataPoint.total++;
            
            switch (callData.salesData?.status?.toLowerCase()) {
              case 'complete':
                dataPoint.successful++;
                break;
              case 'partial':
                dataPoint.partial++;
                break;
              default:
                dataPoint.failed++;
                break;
            }
          }
        } catch (fileError) {
          console.error(`Error reading call file ${file}:`, fileError);
        }
      }
    }
  } catch (error) {
    console.error('Error reading calls directory:', error);
  }
  
  // If no real data found, return mock data for development
  const hasData = chartData.some(d => d.total > 0);
  if (!hasData) {
    console.log('No chart data found, returning mock data for development');
    return mockChartData;
  }
  
  return chartData;
}
