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

    const { examId } = await request.json();
    if (!examId) {
      return NextResponse.json({ error: "Exam ID is required" }, { status: 400 });
    }

    const session = await prisma.examSession.findUnique({
      where: {
        examId_studentId: {
          examId,
          studentId: payload.id,
        },
      },
    });

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Update lastPing timestamp
    const updatedSession = await prisma.examSession.update({
      where: { id: session.id },
      data: {
        lastPing: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      status: updatedSession.status,
      tabSwitches: updatedSession.tabSwitches,
    });
  } catch (error: any) {
    console.error("Student test ping error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
