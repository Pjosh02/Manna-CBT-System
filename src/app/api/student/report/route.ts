import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyJWT } from "@/lib/jwt";

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get("token")?.value;
    const payload = token ? await verifyJWT(token) : null;
    if (!payload || payload.role !== "STUDENT") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { questionId, reason } = await request.json();

    if (!questionId || !reason) {
      return NextResponse.json({ error: "Question ID and reason are required" }, { status: 400 });
    }

    const report = await prisma.questionReport.create({
      data: {
        questionId,
        studentId: payload.id,
        reason,
        status: "OPEN",
      },
    });

    return NextResponse.json({ success: true, report }, { status: 201 });
  } catch (error) {
    console.error("POST student report error:", error);
    return NextResponse.json({ error: "Failed to submit report" }, { status: 500 });
  }
}
