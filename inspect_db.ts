import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const adapter = new PrismaLibSql({
  url: "file:dev.db",
});
const prisma = new PrismaClient({ adapter });

async function main() {
  const exams = await prisma.exam.findMany({
    include: {
      class: true,
      attempts: {
        include: {
          student: true
        }
      },
      results: {
        include: {
          student: true
        }
      }
    }
  });

  console.log("=== EXAMS AND ATTEMPTED STUDENTS ===");
  for (const e of exams) {
    console.log(`Exam: "${e.title}" (Class Target: ${e.class.name} ${e.class.arm}, ID: ${e.class.id})`);
    
    const uniqueAttemptStudents = Array.from(new Set(e.attempts.map(a => `${a.student.name} (Roll: ${a.student.rollNumber}, ID: ${a.student.id})`)));
    const uniqueResultStudents = Array.from(new Set(e.results.map(r => `${r.student.name} (Roll: ${r.student.rollNumber}, ID: ${r.student.id})`)));
    
    console.log(`  Attempts from:`, uniqueAttemptStudents);
    console.log(`  Results for:`, uniqueResultStudents);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
