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
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    // Workaround to get the file buffer
    const tempFilePath = path.join(os.tmpdir(), file.name);
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(tempFilePath, fileBuffer);

    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tempFilePath),
      model: "whisper-1",
    });

    // Clean up the temporary file
    fs.unlinkSync(tempFilePath);

    return NextResponse.json({ transcription: transcription.text });
  } catch (error) {
    console.error("Error transcribing audio:", error);
    return NextResponse.json({ error: "Failed to transcribe audio" }, { status: 500 });
  }
}
