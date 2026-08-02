import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const students = await prisma.user.findMany({
      where: { role: "STUDENT" },
      orderBy: { name: "asc" },
      include: {
        class: true,
        subjectScores: true,
      },
    });
    return NextResponse.json({ students });
  } catch (error) {
    console.error("GET students error:", error);
    return NextResponse.json({ error: "Failed to fetch students" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name, rollNumber, classId, passportUrl } = await request.json();

    if (!name || rollNumber === undefined || !classId) {
      return NextResponse.json(
        { error: "Name, roll number, and class are required" },
        { status: 400 }
      );
    }

    const rollInt = parseInt(rollNumber.toString(), 10);
    if (isNaN(rollInt) || rollInt < 1 || rollInt > 10000 || !Number.isInteger(rollInt)) {
      return NextResponse.json(
        { error: "Roll number must be an integer between 1 and 10000" },
        { status: 400 }
      );
    }

    // Check for duplicate roll number
    const existingStudent = await prisma.user.findUnique({
      where: { rollNumber: rollInt },
    });

    if (existingStudent) {
      return NextResponse.json(
        { error: "Roll number must be unique. This roll number is already assigned." },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(rollInt.toString(), 10);

    const newStudent = await prisma.user.create({
      data: {
        name,
        rollNumber: rollInt,
        passwordHash,
        role: "STUDENT",
        classId,
        passportUrl,
      },
      include: { class: true },
    });

    return NextResponse.json({ student: newStudent }, { status: 201 });
  } catch (error) {
    console.error("POST student error:", error);
    return NextResponse.json({ error: "Failed to create student" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Student ID is required" }, { status: 400 });
    }

    await prisma.user.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE student error:", error);
    return NextResponse.json({ error: "Failed to delete student" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { id, name, rollNumber, classId, passportUrl } = await request.json();

    if (!id || !name || rollNumber === undefined || !classId) {
      return NextResponse.json(
        { error: "Student ID, name, roll number, and class are required" },
        { status: 400 }
      );
    }

    const rollInt = parseInt(rollNumber.toString(), 10);
    if (isNaN(rollInt) || rollInt < 1 || rollInt > 10000 || !Number.isInteger(rollInt)) {
      return NextResponse.json(
        { error: "Roll number must be an integer between 1 and 10000" },
        { status: 400 }
      );
    }

    // Check for duplicate roll number on other students
    const existingStudent = await prisma.user.findFirst({
      where: {
        rollNumber: rollInt,
        NOT: { id: id },
      },
    });

    if (existingStudent) {
      return NextResponse.json(
        { error: "Roll number must be unique. This roll number is already assigned." },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(rollInt.toString(), 10);

    const updatedStudent = await prisma.user.update({
      where: { id },
      data: {
        name,
        rollNumber: rollInt,
        passwordHash,
        classId,
        passportUrl,
      },
      include: { class: true },
    });

    return NextResponse.json({ student: updatedStudent });
  } catch (error) {
    console.error("PATCH student error:", error);
    return NextResponse.json({ error: "Failed to update student" }, { status: 500 });
  }
}
