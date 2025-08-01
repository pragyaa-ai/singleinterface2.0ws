import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import fs from "fs";
import os from "os";
import path from "path";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();

    if (!url) {
      return NextResponse.json({ error: "No URL provided" }, { status: 400 });
    }

    // Validate URL format
    try {
      new URL(url);
    } catch (error) {
      return NextResponse.json({ error: "Invalid URL format" }, { status: 400 });
    }

    // Download the audio file
    const response = await fetch(url);
    if (!response.ok) {
      return NextResponse.json({ error: "Failed to download audio from URL" }, { status: 400 });
    }

    // Get file extension from URL or content-type
    const contentType = response.headers.get('content-type');
    let extension = '.mp3'; // default
    
    if (contentType?.includes('wav')) extension = '.wav';
    else if (contentType?.includes('m4a')) extension = '.m4a';
    else if (contentType?.includes('mp4')) extension = '.mp4';
    else if (contentType?.includes('mpeg')) extension = '.mp3';
    
    // Or try to get extension from URL
    const urlPath = new URL(url).pathname;
    const urlExtension = path.extname(urlPath);
    if (urlExtension) {
      extension = urlExtension;
    }

    // Create temporary file
    const tempFileName = `audio_${Date.now()}${extension}`;
    const tempFilePath = path.join(os.tmpdir(), tempFileName);
    
    // Write audio data to temporary file
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    fs.writeFileSync(tempFilePath, buffer);

    // Transcribe with OpenAI Whisper
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tempFilePath),
      model: "whisper-1",
    });

    // Clean up the temporary file
    fs.unlinkSync(tempFilePath);

    return NextResponse.json({ transcription: transcription.text });
  } catch (error) {
    console.error("Error transcribing audio from URL:", error);
    return NextResponse.json({ error: "Failed to transcribe audio" }, { status: 500 });
  }
}