import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const reports = await prisma.questionReport.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        student: {
          select: { name: true, email: true, rollNumber: true },
        },
        question: {
          include: {
            subject: true,
          },
        },
      },
    });
    return NextResponse.json({ reports });
  } catch (error) {
    console.error("GET reports error:", error);
    return NextResponse.json({ error: "Failed to fetch reports" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { id, status } = await request.json();

    if (!id || !status) {
      return NextResponse.json({ error: "Report ID and status are required" }, { status: 400 });
    }

    const updatedReport = await prisma.questionReport.update({
      where: { id },
      data: { status },
    });

    return NextResponse.json({ report: updatedReport });
  } catch (error) {
    console.error("PATCH report error:", error);
    return NextResponse.json({ error: "Failed to update report" }, { status: 500 });
  }
}
