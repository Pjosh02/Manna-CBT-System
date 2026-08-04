import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyJWT } from "@/lib/jwt";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const exams = await prisma.exam.findMany({
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
    console.error("GET exams error:", error);
    return NextResponse.json({ error: "Failed to fetch exams" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get("token")?.value;
    const payload = token ? await verifyJWT(token) : null;
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { title, classId, startTime, endTime, durationMinutes, status, subjects } = await request.json();

    if (!title || !classId || !startTime || !endTime || !durationMinutes || !status || !subjects || !Array.isArray(subjects)) {
      return NextResponse.json(
        { error: "Title, class, start/end time, duration, status, and subjects are required" },
        { status: 400 }
      );
    }

    // Create the exam session inside a transaction
    const newExam = await prisma.$transaction(async (tx: any) => {
      const exam = await tx.exam.create({
        data: {
          title,
          classId,
          startTime: new Date(startTime),
          endTime: new Date(endTime),
          durationMinutes: parseInt(durationMinutes, 10),
          status,
          createdBy: payload.id,
        },
      });

      // Create ExamSubjects
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

    // Fetch the complete created exam
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
    console.error("POST exam error:", error);
    return NextResponse.json({ error: "Failed to create exam" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Exam ID is required" }, { status: 400 });
    }

    await prisma.exam.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE exam error:", error);
    return NextResponse.json({ error: "Failed to delete exam" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const token = request.cookies.get("token")?.value;
    const payload = token ? await verifyJWT(token) : null;
    if (!payload || payload.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, title, classId, startTime, endTime, durationMinutes, status, subjects } = await request.json();

    if (!id || !title || !classId || !startTime || !endTime || !durationMinutes || !status || !subjects || !Array.isArray(subjects)) {
      return NextResponse.json(
        { error: "Exam ID, title, class, start/end time, duration, status, and subjects are required" },
        { status: 400 }
      );
    }

    const updatedExam = await prisma.$transaction(async (tx: any) => {
      // 1. Update main exam
      const updated = await tx.exam.update({
        where: { id },
        data: {
          title,
          classId,
          startTime: new Date(startTime),
          endTime: new Date(endTime),
          durationMinutes: parseInt(durationMinutes, 10),
          status,
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
    console.error("PATCH admin exam error:", error);
    return NextResponse.json({ error: "Failed to update exam" }, { status: 500 });
  }
}
