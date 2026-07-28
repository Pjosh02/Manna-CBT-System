import { prisma } from "./src/lib/db";

async function main() {
  const questions = await prisma.question.findMany({
    include: {
      subject: true,
    },
  });

  console.log("QUESTIONS LIST:");
  questions.forEach((q) => {
    console.log(`Question ID: ${q.id}`);
    console.log(`Text: ${q.questionText}`);
    console.log(`Subject ID: ${q.subjectId}`);
    console.log(`Subject:`, q.subject ? { id: q.subject.id, name: q.subject.name } : "NULL");
    console.log("---");
  });
}

main().catch(console.error);
