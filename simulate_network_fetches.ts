import { signJWT } from "./src/lib/jwt";

async function run() {
  const teacherPayload = {
    id: "7b592c61-22d1-4a6f-a612-c2cff8456193",
    name: "Obigbesan Joshua",
    email: "obigbesamjoshua1@gmail.com",
    role: "TEACHER",
  };

  const token = await signJWT(teacherPayload);
  const cookieHeader = `token=${token}`;

  const classId1 = "78e6caf8-5ada-48a0-b3c0-7a3bd1db5944"; // SS3 (Class 1)
  const classId2 = "d87842b7-acb6-4555-af3f-7fa5d9336e8c"; // SS3 (Class 2)

  // Fetch Class 1 questions
  const res1 = await fetch(`http://localhost:3000/api/teacher/questions?classId=${classId1}`, {
    headers: {
      Cookie: cookieHeader,
    },
  });
  const data1 = await res1.json();
  console.log(`Class 1 response status: ${res1.status}, data:`, JSON.stringify(data1));

  // Fetch Class 2 questions
  const res2 = await fetch(`http://localhost:3000/api/teacher/questions?classId=${classId2}`, {
    headers: {
      Cookie: cookieHeader,
    },
  });
  const data2 = await res2.json();
  console.log(`Class 2 response status: ${res2.status}, data:`, JSON.stringify(data2));
}

run().catch(console.error);
