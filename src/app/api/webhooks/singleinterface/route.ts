import { NextRequest, NextResponse } from 'next/server';

/**
 * Single Interface Webhook Endpoint  
 * URL: https://singleinterfacews.pragyaa.ai/api/webhooks/singleinterface
 * 
 * Complete webhook matching Single Interface API requirements:
 * - Bot ID and call reference
 * - Call vendor and recording details
 * - Timing and duration information
 * - Language configuration
 * - Dealer routing status
 * - Dropoff analysis
 * - Detailed response data with attempts
 */

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    console.log('🎯 Single Interface Webhook Received:', {
      id: body.id,
      call_ref_id: body.call_ref_id,
      call_vendor: body.call_vendor,
      duration: body.duration,
      dealer_routing_status: body.dealer_routing?.status,
      response_data_count: body.response_data?.length || 0
    });

    // Validate required fields according to Single Interface API
    const requiredFields = ['id', 'call_ref_id', 'call_vendor', 'start_time', 'end_time'];
    const missingFields = requiredFields.filter(field => !body[field]);
    
    if (missingFields.length > 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Missing required fields: ${missingFields.join(', ')}`,
          timestamp: new Date().toISOString()
        },
        { status: 400 }
      );
    }

    // TODO: Implement actual webhook delivery to Single Interface
    // const webhookUrl = process.env.SINGLEINTERFACE_WEBHOOK_URL;
    // if (webhookUrl) {
    //   const response = await fetch(webhookUrl, {
    //     method: 'POST',
    //     headers: { 
    //       'Content-Type': 'application/json',
    //       'Authorization': `Bearer ${process.env.SINGLEINTERFACE_API_KEY}` // if needed
    //     },
    //     body: JSON.stringify(body),
    //     timeout: 10000 // 10 second timeout
    //   });
    //   
    //   if (!response.ok) {
    //     throw new Error(`Single Interface webhook failed: ${response.status}`);
    //   }
    // }

    // Log response data details for debugging
    if (body.response_data && Array.isArray(body.response_data)) {
      body.response_data.forEach((item: any, index: number) => {
        console.log(`  📋 Response ${index + 1}: ${item.key_value} = "${item.key_response}" (${item.attempts} attempts)`);
      });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Single Interface webhook processed successfully',
      call_ref_id: body.call_ref_id,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Single Interface webhook error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

// Health check endpoint
export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    endpoint: 'singleinterface-webhook',
    api_version: '1.0',
    supported_fields: [
      'id', 'call_ref_id', 'call_vendor', 'recording_url',
      'start_time', 'end_time', 'duration', 'language',
      'dealer_routing', 'dropoff', 'response_data'
    ],
    timestamp: new Date().toISOString()
  });
}
