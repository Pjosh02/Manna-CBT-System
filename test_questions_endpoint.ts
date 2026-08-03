import { prisma } from "./src/lib/db";

async function testQuery(classId: string | undefined) {
  const teacherId = "7b592c61-22d1-4a6f-a612-c2cff8456193";
  const questions = await prisma.question.findMany({
    where: {
      teacherId,
      subject: classId ? {
        classes: {
          some: { id: classId }
        }
      } : undefined,
    },
  });
  console.log(`Query classId = ${classId ? `"${classId}"` : "undefined"} -> returned ${questions.length} questions`);
}

async function main() {
  await testQuery("78e6caf8-5ada-48a0-b3c0-7a3bd1db5944");
  await testQuery("d87842b7-acb6-4555-af3f-7fa5d9336e8c");
  await testQuery(undefined);
  await testQuery("");
}

main().catch(console.error);
