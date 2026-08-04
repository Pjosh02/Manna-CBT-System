import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyJWT } from "@/lib/jwt";

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("token")?.value;
    const payload = token ? await verifyJWT(token) : null;
    if (!payload || payload.role !== "TEACHER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const classId = searchParams.get("classId");

    const dbUser = await prisma.user.findUnique({
      where: { id: payload.id },
      select: { classId: true, classes: { select: { id: true } } },
    });

    const assignedClassIds = dbUser ? [dbUser.classId, ...dbUser.classes.map((c: any) => c.id)].filter(Boolean) as string[] : [];
    if (assignedClassIds.length === 0) {
      return NextResponse.json({ results: [] });
    }

    let targetClassIds = assignedClassIds;
    if (classId) {
      if (!assignedClassIds.includes(classId)) {
        return NextResponse.json({ error: "Unauthorized class scope" }, { status: 403 });
      }
      targetClassIds = [classId];
    }

    const results = await prisma.result.findMany({
      where: {
        student: {
          classId: { in: targetClassIds },
        },
        exam: {
          createdBy: payload.id,
        },
      },
      include: {
        student: {
          select: { name: true, email: true, rollNumber: true },
        },
        exam: {
          select: { id: true, title: true, durationMinutes: true, resultsReleased: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ results });
  } catch (error) {
    console.error("GET teacher results error:", error);
    return NextResponse.json({ error: "Failed to fetch class results" }, { status: 500 });
  }
}
