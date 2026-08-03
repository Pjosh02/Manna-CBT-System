import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { verifyJWT } from "@/lib/jwt";
import { formatPassportUrl } from "@/lib/utils";

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("token")?.value;
    const payload = token ? await verifyJWT(token) : null;
    if (!payload || payload.role !== "TEACHER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    let classId = searchParams.get("classId");

    const dbUser = await prisma.user.findUnique({
      where: { id: payload.id },
      select: { classId: true, classes: { select: { id: true } } },
    });

    const assignedClassIds = dbUser ? [dbUser.classId, ...dbUser.classes.map(c => c.id)].filter(Boolean) as string[] : [];
    if (assignedClassIds.length === 0) {
      return NextResponse.json({ students: [] });
    }

    if (!classId || !assignedClassIds.includes(classId)) {
      classId = assignedClassIds[0];
    }

    const students = await prisma.user.findMany({
      where: {
        role: "STUDENT",
        classId: classId,
      },
      include: {
        subjectScores: true,
      },
      orderBy: { name: "asc" },
    });

    const formattedStudents = students.map((s) => ({
      ...s,
      passportUrl: formatPassportUrl(s.id, s.passportUrl),
    }));
    return NextResponse.json({ students: formattedStudents });
  } catch (error) {
    console.error("GET teacher students error:", error);
    return NextResponse.json({ error: "Failed to fetch student roster" }, { status: 500 });
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
        { error: "You are not assigned to any class. Contact Admin." },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const body = await request.json();

    let classId = body.classId || searchParams.get("classId");
    if (!classId && assignedClassIds.length > 0) {
      classId = assignedClassIds[0];
    }

    if (!classId || !assignedClassIds.includes(classId)) {
      return NextResponse.json(
        { error: "Invalid class scope or unauthorized." },
        { status: 400 }
      );
    }

    // Check if it's bulk upload (array of students)
    if (Array.isArray(body)) {
      const addedStudents = [];
      const errors = [];

      for (const row of body) {
        const { name, rollNumber } = row;
        if (!name || rollNumber === undefined) {
          errors.push(`Missing fields for student: ${name || "unknown"}`);
          continue;
        }

        const rollInt = parseInt(rollNumber.toString(), 10);
        if (isNaN(rollInt) || rollInt < 1 || rollInt > 10000 || !Number.isInteger(rollInt)) {
          errors.push(`Invalid roll number for student ${name}: ${rollNumber}. Must be integer between 1 and 10000.`);
          continue;
        }

        const existing = await prisma.user.findUnique({ where: { rollNumber: rollInt } });
        if (existing) {
          errors.push(`Roll number already exists: ${rollInt} (Student: ${name})`);
          continue;
        }

        const passwordHash = await bcrypt.hash(rollInt.toString(), 10);
        const student = await prisma.user.create({
          data: {
            name,
            rollNumber: rollInt,
            passwordHash,
            role: "STUDENT",
            classId,
          },
        });
        addedStudents.push(student);
      }

      const formattedAddedStudents = addedStudents.map((s) => ({
        ...s,
        passportUrl: formatPassportUrl(s.id, s.passportUrl),
      }));
      return NextResponse.json({
        success: true,
        count: addedStudents.length,
        students: formattedAddedStudents,
        errors,
      });
    }

    // Single student upload
    const { name, rollNumber, passportUrl } = body;
    if (!name || rollNumber === undefined) {
      return NextResponse.json({ error: "Name and roll number are required" }, { status: 400 });
    }

    const rollInt = parseInt(rollNumber.toString(), 10);
    if (isNaN(rollInt) || rollInt < 1 || rollInt > 10000 || !Number.isInteger(rollInt)) {
      return NextResponse.json(
        { error: "Roll number must be an integer between 1 and 10000" },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({ where: { rollNumber: rollInt } });
    if (existing) {
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
    });

    const formattedStudent = {
      ...newStudent,
      passportUrl: formatPassportUrl(newStudent.id, newStudent.passportUrl),
    };

    return NextResponse.json({ student: formattedStudent }, { status: 201 });
  } catch (error) {
    console.error("POST teacher students error:", error);
    return NextResponse.json({ error: "Failed to add student" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
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
        { error: "You are not assigned to any class. Contact Admin." },
        { status: 400 }
      );
    }

    const { id, name, rollNumber, passportUrl } = await request.json();

    if (!id || !name || rollNumber === undefined) {
      return NextResponse.json(
        { error: "ID, name, and roll number are required" },
        { status: 400 }
      );
    }

    const studentToUpdate = await prisma.user.findUnique({ where: { id } });
    if (!studentToUpdate || !studentToUpdate.classId || !assignedClassIds.includes(studentToUpdate.classId)) {
      return NextResponse.json(
        { error: "Student not found or unauthorized to manage this student." },
        { status: 404 }
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
        passportUrl,
      },
    });

    const formattedStudent = {
      ...updatedStudent,
      passportUrl: formatPassportUrl(updatedStudent.id, updatedStudent.passportUrl),
    };

    return NextResponse.json({ student: formattedStudent });
  } catch (error) {
    console.error("PATCH teacher student error:", error);
    return NextResponse.json({ error: "Failed to update student" }, { status: 500 });
  }
}
