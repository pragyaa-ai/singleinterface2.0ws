import { NextResponse } from "next/server";
import { streamResponse } from 'openai-realtime';

console.log('--- SESSION API ROUTE ---');
console.log(
  'Checking for OPENAI_API_KEY:',
  process.env.OPENAI_API_KEY
    ? `Exists (ends with ...${process.env.OPENAI_API_KEY.slice(-4)})`
    : '!!! NOT FOUND !!!',
);

export async function GET() {
  try {
    const response = await fetch(
      "https://api.openai.com/v1/realtime/sessions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-realtime-preview-2025-06-03",
        }),
      }
    );
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error in /session:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
