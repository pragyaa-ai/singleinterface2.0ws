import { NextRequest, NextResponse } from 'next/server';

/**
 * Telephony Vendor Webhook Endpoint (Waybeo Integration)
 * URL: https://singleinterfacews.pragyaa.ai/api/webhooks/telephony
 * 
 * Delivers minimal call status to Waybeo's bot-call endpoint:
 * 
 * Waybeo Endpoint: https://pbx-uat.waybeo.com/bot-call
 * Format: {
 *   "call_id": "74lJ3xiezGf4zOo-DJXGZ",
 *   "command": "data_record",
 *   "parameters": [
 *     {"key": "bot_reference_id", "value": "bot_74lJ3xiezGf4zOo-DJXGZ"},
 *     {"key": "data_capture_status", "value": "complete"}
 *   ]
 * }
 * 
 * Data capture status values:
 * - "none" - No data captured or call failed
 * - "partial" - Some data captured but not all
 * - "complete" - All data points captured successfully
 * 
 * Requires environment variables:
 * - WAYBEO_WEBHOOK_URL (default: https://pbx-uat.waybeo.com/bot-call)
 * - WAYBEO_AUTH_TOKEN (Bearer token for authorization)
 */

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    console.log('📞 Telephony Webhook Received:', {
      call_id: body.call_id,
      processed_at: body.processed_at,
      success: body.success,
      overall_status: body.overall_status
    });

    // Here you would typically send this data to the actual telephony vendor
    // For now, we'll just log it and return success
    
    // TODO: Implement actual webhook delivery to telephony vendor
    // const webhookUrl = process.env.TELEPHONY_VENDOR_WEBHOOK_URL;
    // if (webhookUrl) {
    //   await fetch(webhookUrl, {
    //     method: 'POST',
    //     headers: { 'Content-Type': 'application/json' },
    //     body: JSON.stringify(body)
    //   });
    // }

    return NextResponse.json({ 
      success: true, 
      message: 'Telephony webhook processed successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Telephony webhook error:', error);
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
    endpoint: 'telephony-webhook',
    timestamp: new Date().toISOString()
  });
}
