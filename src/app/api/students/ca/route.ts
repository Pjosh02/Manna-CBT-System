import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyJWT } from "@/lib/jwt";

export async function PATCH(request: NextRequest) {
  try {
    const token = request.cookies.get("token")?.value;
    const payload = token ? await verifyJWT(token) : null;
    if (!payload || (payload.role !== "ADMIN" && payload.role !== "TEACHER")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    const updateCA = async (item: any) => {
      const { id, subjectId, firstCA, secondCA, examScore } = item;
      if (!id) throw new Error("Student ID is required");

      const data: any = {};
      if (firstCA !== undefined) {
        data.firstCA = firstCA === null || firstCA === "" ? null : parseFloat(firstCA);
        if (data.firstCA !== null && (isNaN(data.firstCA) || data.firstCA < 0)) {
          throw new Error("First CA score must be a positive number");
        }
      }
      if (secondCA !== undefined) {
        data.secondCA = secondCA === null || secondCA === "" ? null : parseFloat(secondCA);
        if (data.secondCA !== null && (isNaN(data.secondCA) || data.secondCA < 0)) {
          throw new Error("Second CA score must be a positive number");
        }
      }
      if (examScore !== undefined) {
        data.examScore = examScore === null || examScore === "" ? null : parseFloat(examScore);
        if (data.examScore !== null && (isNaN(data.examScore) || data.examScore < 0)) {
          throw new Error("Exam score must be a positive number");
        }
      }

      if (subjectId) {
        return await prisma.subjectScore.upsert({
          where: {
            studentId_subjectId: {
              studentId: id,
              subjectId: subjectId,
            }
          },
          update: data,
          create: {
            studentId: id,
            subjectId: subjectId,
            ...data,
          }
        });
      } else {
        return await prisma.user.update({
          where: { id },
          data,
        });
      }
    };

    if (Array.isArray(body)) {
      const results = [];
      for (const item of body) {
        results.push(await updateCA(item));
      }
      return NextResponse.json({ success: true, count: results.length });
    } else {
      const updated = await updateCA(body);
      return NextResponse.json({ success: true, student: updated });
    }
  } catch (error: any) {
    console.error("PATCH student CA error:", error);
    return NextResponse.json({ error: error.message || "Failed to update CA scores" }, { status: 500 });
  }
}
