import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const subjects = await prisma.subject.findMany({
      orderBy: { name: "asc" },
      include: {
        classes: true,
        _count: {
          select: { questions: true },
        },
      },
    });
    return NextResponse.json({ subjects });
  } catch (error) {
    console.error("GET subjects error:", error);
    return NextResponse.json({ error: "Failed to fetch subjects" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name, classIds } = await request.json();

    if (!name) {
      return NextResponse.json({ error: "Subject name is required" }, { status: 400 });
    }

    // Create subject and connect optional classes
    const newSubject = await prisma.subject.create({
      data: {
        name,
        classes: classIds && Array.isArray(classIds)
          ? { connect: classIds.map((id: string) => ({ id })) }
          : undefined,
      },
      include: { classes: true },
    });

    return NextResponse.json({ subject: newSubject }, { status: 201 });
  } catch (error) {
    console.error("POST subject error:", error);
    return NextResponse.json({ error: "Failed to create subject" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Subject ID is required" }, { status: 400 });
    }

    await prisma.subject.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE subject error:", error);
    return NextResponse.json({ error: "Failed to delete subject" }, { status: 500 });
  }
}
