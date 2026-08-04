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
      return NextResponse.json({ exams: [] });
    }

    let targetClassIds = assignedClassIds;
    if (classId) {
      if (!assignedClassIds.includes(classId)) {
        return NextResponse.json({ error: "Unauthorized class scope" }, { status: 403 });
      }
      targetClassIds = [classId];
    }

    const exams = await prisma.exam.findMany({
      where: {
        classId: { in: targetClassIds },
        createdBy: payload.id,
      },
      orderBy: { createdAt: "desc" },
      include: {
        class: true,
        examSubjects: {
          include: {
            subject: true,
          },
        },
      },
    });

    return NextResponse.json({ exams });
  } catch (error) {
    console.error("GET teacher exams error:", error);
    return NextResponse.json({ error: "Failed to fetch exams" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get("token")?.value;
    const payload = token ? await verifyJWT(token) : null;
    if (!payload || payload.role !== "TEACHER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: payload.id },
      select: { classId: true, classes: { select: { id: true } } },
    });

    const assignedClassIds = dbUser ? [dbUser.classId, ...dbUser.classes.map((c: any) => c.id)].filter(Boolean) as string[] : [];
    if (assignedClassIds.length === 0) {
      return NextResponse.json(
        { error: "You are not assigned to any class and cannot schedule exams." },
        { status: 400 }
      );
    }

    const { title, startTime, endTime, durationMinutes, status, subjects, classId: bodyClassId, assessmentType } = await request.json();
    let classId = bodyClassId;
    if (!classId && assignedClassIds.length > 0) {
      classId = assignedClassIds[0];
    }

    if (!classId || !assignedClassIds.includes(classId)) {
      return NextResponse.json(
        { error: "Invalid class scope or unauthorized." },
        { status: 400 }
      );
    }

    if (!title || !startTime || !endTime || !durationMinutes || !status || !subjects || !Array.isArray(subjects)) {
      return NextResponse.json(
        { error: "Title, start/end time, duration, status, and subjects are required" },
        { status: 400 }
      );
    }

    const newExam = await prisma.$transaction(async (tx: any) => {
      const exam = await tx.exam.create({
        data: {
          title,
          classId,
          startTime: new Date(startTime),
          endTime: new Date(endTime),
          durationMinutes: parseInt(durationMinutes, 10),
          status,
          assessmentType: assessmentType || "Exam",
          createdBy: payload.id,
        },
      });

      if (subjects.length > 0) {
        await tx.examSubject.createMany({
          data: subjects.map((sub: any) => ({
            examId: exam.id,
            subjectId: sub.subjectId,
            numberOfQuestions: parseInt(sub.numberOfQuestions, 10),
          })),
        });
      }

      return exam;
    });

    const fullExam = await prisma.exam.findUnique({
      where: { id: newExam.id },
      include: {
        class: true,
        examSubjects: {
          include: {
            subject: true,
          },
        },
      },
    });

    return NextResponse.json({ exam: fullExam }, { status: 201 });
  } catch (error) {
    console.error("POST teacher exam error:", error);
    return NextResponse.json({ error: "Failed to schedule exam" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const token = request.cookies.get("token")?.value;
    const payload = token ? await verifyJWT(token) : null;
    if (!payload || payload.role !== "TEACHER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: "Exam ID is required" }, { status: 400 });
    }

    const exam = await prisma.exam.findUnique({
      where: { id },
    });

    if (!exam || exam.createdBy !== payload.id) {
      return NextResponse.json({ error: "Exam not found or unauthorized" }, { status: 404 });
    }

    // Check if we are only toggling resultsReleased
    if ("resultsReleased" in body && Object.keys(body).length === 2) {
      const updated = await prisma.exam.update({
        where: { id },
        data: {
          resultsReleased: body.resultsReleased,
        },
        include: {
          class: true,
          examSubjects: {
            include: {
              subject: true,
            },
          },
        },
      });
      return NextResponse.json({ exam: updated });
    }

    const { title, startTime, endTime, durationMinutes, status, subjects, assessmentType } = body;

    if (!title || !startTime || !endTime || !durationMinutes || !status || !subjects || !Array.isArray(subjects)) {
      return NextResponse.json(
        { error: "Title, start/end time, duration, status, and subjects are required" },
        { status: 400 }
      );
    }

    const updatedExam = await prisma.$transaction(async (tx: any) => {
      // 1. Update main exam
      const updated = await tx.exam.update({
        where: { id },
        data: {
          title,
          startTime: new Date(startTime),
          endTime: new Date(endTime),
          durationMinutes: parseInt(durationMinutes, 10),
          status,
          assessmentType: assessmentType !== undefined ? assessmentType : undefined,
        },
      });

      // 2. Clear old subjects
      await tx.examSubject.deleteMany({
        where: { examId: id },
      });

      // 3. Insert new subjects
      if (subjects.length > 0) {
        await tx.examSubject.createMany({
          data: subjects.map((sub: any) => ({
            examId: id,
            subjectId: sub.subjectId,
            numberOfQuestions: parseInt(sub.numberOfQuestions, 10),
          })),
        });
      }

      return updated;
    });

    const fullExam = await prisma.exam.findUnique({
      where: { id: updatedExam.id },
      include: {
        class: true,
        examSubjects: {
          include: {
            subject: true,
          },
        },
      },
    });

    return NextResponse.json({ exam: fullExam });
  } catch (error) {
    console.error("PATCH teacher exam error:", error);
    return NextResponse.json({ error: "Failed to update exam" }, { status: 500 });
  }
}
