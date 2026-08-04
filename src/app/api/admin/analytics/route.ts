import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // 1. Get average scores by exam
    const results = await prisma.result.findMany({
      include: {
        exam: {
          include: {
            class: true,
          },
        },
        student: true,
      },
    });

    const examAverages: Record<string, { title: string; class: string; total: number; sum: number }> = {};
    const topPerformers: Record<
      string,
      { name: string; email: string | null; rollNumber: number | null; totalScore: number; count: number }
    > = {};

    results.forEach((res: any) => {
      // Exam breakdown
      if (!examAverages[res.examId]) {
        examAverages[res.examId] = {
          title: res.exam.title,
          class: `${res.exam.class.name} ${res.exam.class.arm}`,
          total: 0,
          sum: 0,
        };
      }
      examAverages[res.examId].total += 1;
      examAverages[res.examId].sum += res.score;

      // Student performance
      if (!topPerformers[res.studentId]) {
        topPerformers[res.studentId] = {
          name: res.student.name,
          email: res.student.email,
          rollNumber: res.student.rollNumber,
          totalScore: 0,
          count: 0,
        };
      }
      topPerformers[res.studentId].totalScore += res.score;
      topPerformers[res.studentId].count += 1;
    });

    const examsList = Object.keys(examAverages).map((id) => ({
      id,
      title: examAverages[id].title,
      class: examAverages[id].class,
      averageScore: Math.round((examAverages[id].sum / examAverages[id].total) * 10) / 10,
      totalAttempts: examAverages[id].total,
    }));

    const studentsList = Object.keys(topPerformers)
      .map((id) => ({
        id,
        name: topPerformers[id].name,
        email: topPerformers[id].email,
        rollNumber: topPerformers[id].rollNumber,
        averageScore: Math.round((topPerformers[id].totalScore / topPerformers[id].count) * 10) / 10,
        examsTaken: topPerformers[id].count,
      }))
      .sort((a, b) => b.averageScore - a.averageScore)
      .slice(0, 10); // top 10

    // 2. Fetch all student attempts to calculate question failure statistics
    const attempts = await prisma.studentAttempt.findMany({
      include: {
        question: {
          include: {
            subject: true,
          },
        },
      },
    });

    const questionStats: Record<
      string,
      { text: string; subject: string; totalAttempts: number; incorrectCount: number }
    > = {};

    attempts.forEach((att: any) => {
      const qId = att.questionId;
      if (!questionStats[qId]) {
        questionStats[qId] = {
          text: att.question.questionText,
          subject: att.question.subject.name,
          totalAttempts: 0,
          incorrectCount: 0,
        };
      }
      questionStats[qId].totalAttempts += 1;
      if (att.selectedOption !== att.question.correctOption) {
        questionStats[qId].incorrectCount += 1;
      }
    });

    const missedQuestionsList = Object.keys(questionStats)
      .map((id) => {
        const stats = questionStats[id];
        return {
          id,
          questionText: stats.text,
          subject: stats.subject,
          totalAttempts: stats.totalAttempts,
          incorrectAttempts: stats.incorrectCount,
          failureRate:
            stats.totalAttempts > 0
              ? Math.round((stats.incorrectCount / stats.totalAttempts) * 100)
              : 0,
        };
      })
      .sort((a, b) => b.failureRate - a.failureRate || b.incorrectAttempts - a.incorrectAttempts)
      .slice(0, 5); // top 5 most missed

    // General counters
    const counts = {
      classes: await prisma.class.count(),
      subjects: await prisma.subject.count(),
      teachers: await prisma.user.count({ where: { role: "TEACHER" } }),
      students: await prisma.user.count({ where: { role: "STUDENT" } }),
      exams: await prisma.exam.count(),
      reports: await prisma.questionReport.count({ where: { status: "OPEN" } }),
    };

    return NextResponse.json({
      counts,
      exams: examsList,
      topStudents: studentsList,
      mostMissedQuestions: missedQuestionsList,
    });
  } catch (error) {
    console.error("GET analytics error:", error);
    return NextResponse.json({ error: "Failed to load analytics" }, { status: 500 });
  }
}
