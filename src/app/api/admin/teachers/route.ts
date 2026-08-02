import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const teachers = await prisma.user.findMany({
      where: { role: "TEACHER" },
      orderBy: { name: "asc" },
      include: {
        class: true,
        classes: true,
      },
    });
    return NextResponse.json({ teachers });
  } catch (error) {
    console.error("GET teachers error:", error);
    return NextResponse.json({ error: "Failed to fetch teachers" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name, email, password, classId, classIds } = await request.json();

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Name, email, and password are required" },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email address format" },
        { status: 400 }
      );
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json(
        { error: "A teacher with this email already exists" },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);

    let targetClassIds: string[] = [];
    if (Array.isArray(classIds)) {
      targetClassIds = classIds;
    } else if (classId) {
      targetClassIds = [classId];
    }

    const newTeacher = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: "TEACHER",
        classId: targetClassIds[0] || null,
        classes: {
          connect: targetClassIds.map((id) => ({ id })),
        },
      },
      include: { class: true, classes: true },
    });

    return NextResponse.json({ teacher: newTeacher }, { status: 201 });
  } catch (error) {
    console.error("POST teacher error:", error);
    return NextResponse.json({ error: "Failed to create teacher" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Teacher ID is required" }, { status: 400 });
    }

    await prisma.user.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE teacher error:", error);
    return NextResponse.json({ error: "Failed to delete teacher" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { id, name, email, password, classId, classIds } = await request.json();

    if (!id || !name || !email) {
      return NextResponse.json(
        { error: "Teacher ID, name, and email are required" },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email address format" },
        { status: 400 }
      );
    }

    // Check for duplicate email on other users
    const existingUser = await prisma.user.findFirst({
      where: {
        email: email,
        NOT: { id: id },
      },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "A teacher with this email already exists" },
        { status: 400 }
      );
    }

    let targetClassIds: string[] = [];
    if (Array.isArray(classIds)) {
      targetClassIds = classIds;
    } else if (classId) {
      targetClassIds = [classId];
    }

    const dataUpdate: any = {
      name,
      email,
      classId: targetClassIds[0] || null,
      classes: {
        set: targetClassIds.map((id) => ({ id })),
      },
    };

    if (password && password.trim() !== "") {
      dataUpdate.passwordHash = await bcrypt.hash(password, 10);
    }

    const updatedTeacher = await prisma.user.update({
      where: { id },
      data: dataUpdate,
      include: { class: true, classes: true },
    });

    return NextResponse.json({ teacher: updatedTeacher });
  } catch (error) {
    console.error("PATCH teacher error:", error);
    return NextResponse.json({ error: "Failed to update teacher" }, { status: 500 });
  }
}
