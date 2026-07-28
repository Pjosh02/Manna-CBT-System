import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const classes = await prisma.class.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: { students: true, exams: true },
        },
      },
    });
    return NextResponse.json({ classes });
  } catch (error) {
    console.error("GET classes error:", error);
    return NextResponse.json({ error: "Failed to fetch classes" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name, arm, academicSession } = await request.json();

    if (!name || !arm || !academicSession) {
      return NextResponse.json(
        { error: "Name, arm, and academic session are required" },
        { status: 400 }
      );
    }

    const newClass = await prisma.class.create({
      data: { name, arm, academicSession },
    });

    return NextResponse.json({ class: newClass }, { status: 201 });
  } catch (error) {
    console.error("POST class error:", error);
    return NextResponse.json({ error: "Failed to create class" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Class ID is required" }, { status: 400 });
    }

    await prisma.class.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE class error:", error);
    return NextResponse.json({ error: "Failed to delete class" }, { status: 500 });
  }
}
