import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const mimeType = file.type || "image/jpeg";
    const base64Data = buffer.toString("base64");
    const dataUrl = `data:${mimeType};base64,${base64Data}`;

    // Write file locally as a fallback or for local dev logs
    try {
      const ext = path.extname(file.name) || ".jpg";
      const filename = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}${ext}`;
      const uploadDir = path.join(process.cwd(), "public", "uploads");

      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      fs.writeFileSync(path.join(uploadDir, filename), buffer);
    } catch (fsErr) {
      console.warn("Local filesystem write skipped (normal in serverless/read-only environments):", fsErr);
    }

    return NextResponse.json({ url: dataUrl });
  } catch (err: any) {
    console.error("Upload error:", err);
    return NextResponse.json({ error: err.message || "Failed to upload file" }, { status: 500 });
  }
}
