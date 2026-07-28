import { NextRequest, NextResponse } from "next/server";
import { verifyJWT } from "@/lib/jwt";
import mammoth from "mammoth";
import { parseDocxText } from "@/utils/docxQuestionParser";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get("token")?.value;
    const payload = token ? await verifyJWT(token) : null;
    if (!payload || payload.role !== "TEACHER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const filename = file.name.toLowerCase();
    if (!filename.endsWith(".docx")) {
      return NextResponse.json({ error: "Only .docx files are allowed" }, { status: 400 });
    }

    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return NextResponse.json({ error: "File size exceeds the 5MB limit" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const mammothResult = await mammoth.extractRawText({ buffer });
    const rawText = mammothResult.value;

    const parseResult = parseDocxText(rawText);

    return NextResponse.json({
      success: true,
      questions: parseResult.questions,
      errors: parseResult.errors,
    });
  } catch (error: any) {
    console.error("DOCX question import error:", error);
    return NextResponse.json({ error: error.message || "Failed to process import" }, { status: 500 });
  }
}
