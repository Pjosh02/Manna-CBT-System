import { prisma } from "./src/lib/db";

async function main() {
  console.log("=== Inspecting Teacher Classes ===");

  const teacher = await prisma.user.findFirst({
    where: { role: "TEACHER" },
    include: { classes: true },
  });

  if (!teacher) {
    console.log("No teacher found!");
    return;
  }

  console.log(`Teacher: ${teacher.name} (ID: ${teacher.id})`);
  console.log(`- classId field: ${teacher.classId}`);
  console.log(`- classes relation list:`);
  for (const c of teacher.classes) {
    console.log(`  * Class ID: ${c.id}, Name: ${c.name}`);
  }

  console.log("\n=== Checking Active Questions filter behavior ===");
  // Let's check what questions are returned when filtering by class 1
  const qClass1 = await prisma.question.findMany({
    where: {
      teacherId: teacher.id,
      subject: {
        classes: {
          some: { id: "78e6caf8-5ada-48a0-b3c0-7a3bd1db5944" }
        }
      }
    }
  });
  console.log(`Questions for Class 1 (78e6...): ${qClass1.length}`);
  for (const q of qClass1) {
    console.log(`  - Question: "${q.questionText.substring(0, 30)}..."`);
  }

  // Let's check what questions are returned when filtering by class 2
  const qClass2 = await prisma.question.findMany({
    where: {
      teacherId: teacher.id,
      subject: {
        classes: {
          some: { id: "d87842b7-acb6-4555-af3f-7fa5d9336e8c" }
        }
      }
    }
  });
  console.log(`Questions for Class 2 (d878...): ${qClass2.length}`);
  for (const q of qClass2) {
    console.log(`  - Question: "${q.questionText.substring(0, 30)}..."`);
  }

  console.log("\n=== Completed ===");
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
