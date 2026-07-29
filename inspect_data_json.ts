import fs from "fs";

async function main() {
  const dataPath = "c:/Users/Administrator/Desktop/SMS/backend/data.json";
  if (!fs.existsSync(dataPath)) {
    console.error("data.json not found in SMS backend");
    return;
  }

  const content = fs.readFileSync(dataPath, "utf8");
  const data = JSON.parse(content);

  console.log("=== JSON DATA KEYS ===");
  console.log(Object.keys(data));

  if (data.students && Array.isArray(data.students)) {
    console.log(`\n=== STUDENTS IN JSON (${data.students.length}) ===`);
    for (const s of data.students.slice(0, 10)) {
      console.log(s);
    }
  }

  if (data.classes && Array.isArray(data.classes)) {
    console.log(`\n=== CLASSES IN JSON (${data.classes.length}) ===`);
    for (const c of data.classes) {
      console.log(c);
    }
  }
}

main().catch(console.error);
