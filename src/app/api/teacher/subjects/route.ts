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

    const assignedClassIds = dbUser ? [dbUser.classId, ...dbUser.classes.map(c => c.id)].filter(Boolean) as string[] : [];
    if (assignedClassIds.length === 0) {
      return NextResponse.json({ subjects: [] });
    }

    let targetClassIds = assignedClassIds;
    if (classId) {
      if (!assignedClassIds.includes(classId)) {
        return NextResponse.json({ error: "Unauthorized class scope" }, { status: 403 });
      }
      targetClassIds = [classId];
    }

    const subjects = await prisma.subject.findMany({
      where: {
        classes: {
          some: { id: { in: targetClassIds } },
        },
        OR: [
          { teacherId: null },
          { teacherId: payload.id }
        ]
      },
      orderBy: { name: "asc" },
      include: {
        classes: true,
        _count: {
          select: {
            questions: {
              where: {
                teacherId: payload.id,
              },
            },
          },
        },
      },
    });

    return NextResponse.json({ subjects });
  } catch (error: any) {
    console.error("GET teacher subjects error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch subjects" }, { status: 500 });
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

    const assignedClassIds = dbUser ? [dbUser.classId, ...dbUser.classes.map(c => c.id)].filter(Boolean) as string[] : [];
    if (assignedClassIds.length === 0) {
      return NextResponse.json(
        { error: "You are not assigned to a class. Contact Admin." },
        { status: 400 }
      );
    }

    const { name, classId: bodyClassId } = await request.json();
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
    if (!name || name.trim() === "") {
      return NextResponse.json({ error: "Subject name is required" }, { status: 400 });
    }

    const trimmedName = name.trim();

    // Check if subject exists (case-insensitive) for this teacher or is admin-created
    let subject = await prisma.subject.findFirst({
      where: {
        name: {
          equals: trimmedName,
        },
        OR: [
          { teacherId: null },
          { teacherId: payload.id }
        ]
      },
    });

    if (subject) {
      // Connect to existing subject
      subject = await prisma.subject.update({
        where: { id: subject.id },
        data: {
          classes: {
            connect: { id: classId },
          },
        },
        include: { classes: true },
      });
    } else {
      // Create new subject
      subject = await prisma.subject.create({
        data: {
          name: trimmedName,
          teacherId: payload.id,
          classes: {
            connect: { id: classId },
          },
        },
        include: { classes: true },
      });
    }

    return NextResponse.json({ subject }, { status: 201 });
  } catch (error: any) {
    console.error("POST teacher subject error:", error);
    return NextResponse.json({ error: error.message || "Failed to create subject" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const token = request.cookies.get("token")?.value;
    const payload = token ? await verifyJWT(token) : null;
    if (!payload || payload.role !== "TEACHER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Subject ID is required" }, { status: 400 });
    }

    const subject = await prisma.subject.findUnique({
      where: { id },
    });

    if (!subject) {
      return NextResponse.json({ error: "Subject not found" }, { status: 404 });
    }

    if (subject.teacherId !== payload.id) {
      return NextResponse.json(
        { error: "You can only delete subjects that you created." },
        { status: 403 }
      );
    }

    await prisma.subject.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("DELETE teacher subject error:", error);
    return NextResponse.json({ error: error.message || "Failed to delete subject" }, { status: 500 });
  }
}
