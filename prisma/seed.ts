import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import bcrypt from "bcryptjs";

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding started...");

  // Clear existing data (in order of dependency)
  await prisma.questionReport.deleteMany();
  await prisma.result.deleteMany();
  await prisma.studentAttempt.deleteMany();
  await prisma.examSubject.deleteMany();
  await prisma.exam.deleteMany();
  await prisma.question.deleteMany();
  await prisma.user.deleteMany();
  await prisma.subject.deleteMany();
  await prisma.class.deleteMany();

  console.log("Existing data cleared.");

  // 1. Create Class
  const targetClass = await prisma.class.create({
    data: {
      name: "SS3",
      arm: "Gold",
      academicSession: "2025/2026",
    },
  });
  console.log("Class created:", targetClass.name, targetClass.arm);

  // 2. Create Subjects
  const math = await prisma.subject.create({
    data: {
      name: "Mathematics",
      classes: { connect: { id: targetClass.id } },
    },
  });

  const english = await prisma.subject.create({
    data: {
      name: "English Language",
      classes: { connect: { id: targetClass.id } },
    },
  });

  const physics = await prisma.subject.create({
    data: {
      name: "Physics",
      classes: { connect: { id: targetClass.id } },
    },
  });

  const chemistry = await prisma.subject.create({
    data: {
      name: "Chemistry",
      classes: { connect: { id: targetClass.id } },
    },
  });

  console.log("Subjects created:", [math.name, english.name, physics.name, chemistry.name].join(", "));

  // Hash passwords
  const adminPasswordHash = await bcrypt.hash("admin123", 10);
  const teacherPasswordHash = await bcrypt.hash("teacher123", 10);
  const studentPasswordHash = await bcrypt.hash("101", 10);

  // 3. Create Users
  const admin = await prisma.user.create({
    data: {
      name: "School Administrator",
      email: "admin@school.com",
      passwordHash: adminPasswordHash,
      role: "ADMIN",
    },
  });

  const teacher = await prisma.user.create({
    data: {
      name: "Mr. John Doe",
      email: "teacher@school.com",
      passwordHash: teacherPasswordHash,
      role: "TEACHER",
      classId: targetClass.id,
    },
  });

  const student = await prisma.user.create({
    data: {
      name: "Chinedu Okafor",
      rollNumber: 101,
      passwordHash: studentPasswordHash,
      role: "STUDENT",
      classId: targetClass.id,
    },
  });

  console.log("Users created:", admin.email, teacher.email, `Student Roll No: ${student.rollNumber}`);

  // 4. Create Mathematics Questions
  const mathQuestions = [
    {
      questionText: "Solve for x in the equation: 3x - 7 = 5x + 9",
      optionA: "x = 8",
      optionB: "x = -8",
      optionC: "x = 1",
      optionD: "x = -1",
      correctOption: "B",
    },
    {
      questionText: "Find the sum of the first 20 terms of the arithmetic progression: 3, 7, 11, 15, ...",
      optionA: "820",
      optionB: "840",
      optionC: "780",
      optionD: "910",
      correctOption: "A",
    },
    {
      questionText: "Calculate the area of a circle with a radius of 7 cm. (Take pi = 22/7)",
      optionA: "44 cm²",
      optionB: "154 cm²",
      optionC: "98 cm²",
      optionD: "308 cm²",
      correctOption: "B",
    },
    {
      questionText: "If log 2 = 0.3010 and log 3 = 0.4771, evaluate log 1.2 without tables.",
      optionA: "0.0791",
      optionB: "0.1791",
      optionC: "0.0891",
      optionD: "0.0691",
      correctOption: "A",
    },
    {
      questionText: "In a right-angled triangle, the hypotenuse is 13 cm and one side is 5 cm. What is the length of the third side?",
      optionA: "8 cm",
      optionB: "10 cm",
      optionC: "12 cm",
      optionD: "14 cm",
      correctOption: "C",
    },
  ];

  for (const q of mathQuestions) {
    await prisma.question.create({
      data: {
        subjectId: math.id,
        teacherId: teacher.id,
        questionText: q.questionText,
        optionA: q.optionA,
        optionB: q.optionB,
        optionC: q.optionC,
        optionD: q.optionD,
        correctOption: q.correctOption,
      },
    });
  }

  // 5. Create English Language (Passage & Regular) Questions
  const passageTitle = "The Power of Diligence";
  const passageText = "Diligence is the mother of good luck, and God gives all things to industry. Then plough deep while sluggards sleep, and you shall have corn to sell and to keep. Work while it is called today, for you know not how much you may be hindered tomorrow. One today is worth two tomorrows; never leave that till tomorrow which you can do today.";

  const englishQuestions = [
    {
      questionText: "According to the passage, who is the mother of good luck?",
      passageTitle,
      passageText,
      optionA: "Diligence",
      optionB: "Knowledge",
      optionC: "Wealth",
      optionD: "Honesty",
      correctOption: "A",
    },
    {
      questionText: "What does the writer suggest by 'plough deep while sluggards sleep'?",
      passageTitle,
      passageText,
      optionA: "Farming should be done at night",
      optionB: "One should work hard while others idle around",
      optionC: "Sleeping too much makes someone a good farmer",
      optionD: "Ploughing deep makes the soil sleep",
      correctOption: "B",
    },
    {
      questionText: "What is the equivalent value of 'one today' according to the text?",
      passageTitle,
      passageText,
      optionA: "Half of tomorrow",
      optionB: "Two tomorrows",
      optionC: "Three tomorrows",
      optionD: "A single yesterday",
      correctOption: "B",
    },
    {
      questionText: "Choose the option nearest in meaning to the bold word: The teacher gave a **lucid** explanation of the poem.",
      optionA: "vague",
      optionB: "clear",
      optionC: "complicated",
      optionD: "noisy",
      correctOption: "B",
    },
    {
      questionText: "Identify the antonym of the word: **Arrogant**",
      optionA: "Humble",
      optionB: "Proud",
      optionC: "Selfish",
      optionD: "Ignorant",
      correctOption: "A",
    },
  ];

  for (const q of englishQuestions) {
    await prisma.question.create({
      data: {
        subjectId: english.id,
        teacherId: teacher.id,
        questionText: q.questionText,
        passageTitle: q.passageTitle || null,
        passageText: q.passageText || null,
        optionA: q.optionA,
        optionB: q.optionB,
        optionC: q.optionC,
        optionD: q.optionD,
        correctOption: q.correctOption,
      },
    });
  }

  console.log("Questions created for Mathematics and English Language.");

  // 6. Create a Live Exam Session
  const exam = await prisma.exam.create({
    data: {
      classId: targetClass.id,
      createdBy: admin.id,
      title: "SS3 Mock Examination (2026)",
      startTime: new Date(Date.now() - 30 * 60 * 1000), // Started 30 mins ago
      endTime: new Date(Date.now() + 2 * 60 * 60 * 1000), // Ends in 2 hours
      durationMinutes: 45,
      status: "LIVE",
    },
  });

  // Assign subjects and question counts to the exam
  await prisma.examSubject.createMany({
    data: [
      {
        examId: exam.id,
        subjectId: math.id,
        numberOfQuestions: 5,
      },
      {
        examId: exam.id,
        subjectId: english.id,
        numberOfQuestions: 5,
      },
    ],
  });

  console.log("Exam created & assigned to subjects.");
  console.log("Seeding completed successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
