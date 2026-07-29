import { createClient } from "@libsql/client";

async function main() {
  const client = createClient({
    url: "file:c:/Users/Administrator/Desktop/SMS/backend/database.sqlite",
  });

  try {
    const students = await client.execute("SELECT full_name, roll_number, class_id FROM students");
    console.log("=== STUDENTS IN SMS ===");
    console.log("Count:", students.rows.length);
    for (const r of students.rows) {
      console.log(`Student: ${r.full_name || r[3]} (Roll: ${r.roll_number || r[1]}, Class ID: ${r.class_id || r[4]})`);
    }
  } catch (e) {
    console.error("Error reading SMS tables:", e);
  }

  client.close();
}

main().catch(console.error);
