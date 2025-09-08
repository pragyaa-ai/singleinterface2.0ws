import { NextRequest, NextResponse } from "next/server";

// KooKoo IVR entry: returns XML pointing Ozonetel to our telephony WebSocket bridge
// Usage:
//   GET /api/ivr?ws=ws://HOST:8080/ws&sip=XYZ
//   - ws: WebSocket URL that Ozonetel will connect to (falls back to env TELEPHONY_WS_URL)
//   - sip: SIP registration number (required by Ozonetel, rendered as inner text)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const wsParam = searchParams.get("ws");
    const sip = searchParams.get("sip") || process.env.TELEPHONY_SIP_ID || "UNKNOWN";

    const wsUrl = (wsParam || process.env.TELEPHONY_WS_URL || "ws://localhost:8080/ws").trim();

    // Basic validation: must be ws:// or wss://
    if (!/^wss?:\/\//i.test(wsUrl)) {
      return new NextResponse("Invalid ws URL", { status: 400 });
    }

    const xml = `<response><stream is_sip='true' url='${wsUrl}'>${sip}</stream></response>`;

    return new NextResponse(xml, {
      status: 200,
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Error in /api/ivr:", error);
    return new NextResponse("<response></response>", { status: 500, headers: { "Content-Type": "text/xml" } });
  }
}



