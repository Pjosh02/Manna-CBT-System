import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyJWT } from "@/lib/jwt";
import puppeteer from "puppeteer-core";
import fs from "fs";
import path from "path";
import katex from "katex";

// Simple hash function for deterministic question sorting
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

// Escapes raw HTML but allows specific format tags to pass through for rendering
function renderMathInText(text: string): string {
  if (!text) return "";
  
  // Escape raw HTML characters to prevent rendering injection
  let escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Restore the safe formatting tags inserted by rich toolbar editor
  escaped = escaped
    .replace(/&lt;b&gt;/g, "<b>").replace(/&lt;\/b&gt;/g, "</b>")
    .replace(/&lt;i&gt;/g, "<i>").replace(/&lt;\/i&gt;/g, "</i>")
    .replace(/&lt;sup&gt;/g, "<sup>").replace(/&lt;\/sup&gt;/g, "</sup>")
    .replace(/&lt;sub&gt;/g, "<sub>").replace(/&lt;\/sub&gt;/g, "</sub>")
    .replace(/&lt;br\s*\/*&gt;/g, "<br/>");

  // 1. Render display equations ($$ ... $$)
  escaped = escaped.replace(/\$\$([\s\S]*?)\$\$/g, (match, formula) => {
    try {
      const rawFormula = formula
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&");
      return katex.renderToString(rawFormula, { displayMode: true, throwOnError: false });
    } catch (e) {
      return match;
    }
  });

  // 2. Render inline equations ($ ... $)
  escaped = escaped.replace(/\$(.*?)\$/g, (match, formula) => {
    try {
      const rawFormula = formula
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&");
      return katex.renderToString(rawFormula, { displayMode: false, throwOnError: false });
    } catch (e) {
      return match;
    }
  });

  return escaped;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ examId: string }> }
) {
  try {
    const { examId } = await params;

    // 1. Authenticate user from JWT cookie
    const token = request.cookies.get("token")?.value;
    const payload = token ? await verifyJWT(token) : null;
    if (!payload || payload.role !== "STUDENT") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const studentId = payload.id;

    // 2. Fetch exam and verify results are released
    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      include: {
        examSubjects: {
          include: {
            subject: true,
          },
        },
      },
    });

    if (!exam) {
      return NextResponse.json({ error: "Exam not found" }, { status: 404 });
    }

    if (!exam.resultsReleased) {
      return NextResponse.json({ error: "Results have not been released for this exam." }, { status: 403 });
    }

    // 3. Verify student has a completed result record
    const result = await prisma.result.findUnique({
      where: {
        examId_studentId: {
          examId,
          studentId,
        },
      },
      include: {
        student: true,
      },
    });

    if (!result) {
      return NextResponse.json({ error: "No completed result found for this exam." }, { status: 404 });
    }

    // 4. Fetch the student attempts to overlay their selections
    const attempts = await prisma.studentAttempt.findMany({
      where: {
        examId,
        studentId,
      },
    });

    const attemptsMap = attempts.reduce((acc: Record<string, string | null>, att) => {
      acc[att.questionId] = att.selectedOption;
      return acc;
    }, {});

    // 5. Reconstruct questions list matching the deterministic student-specific shuffle
    const subjectsData = [];
    for (const es of exam.examSubjects) {
      const allSubjectQuestions = await prisma.question.findMany({
        where: {
          subjectId: es.subjectId,
          status: "PUBLISHED",
        },
      });

      const shuffled = allSubjectQuestions
        .map((q) => ({
          q,
          hash: hashString(studentId + q.id),
        }))
        .sort((a, b) => a.hash - b.hash)
        .map((item) => item.q);

      const assignedQuestions = shuffled.slice(0, es.numberOfQuestions);
      if (assignedQuestions.length > 0) {
        subjectsData.push({
          subjectName: es.subject.name,
          questions: assignedQuestions,
        });
      }
    }

    // Load local KaTeX CSS
    let katexCss = "";
    try {
      const cssPath = path.join(process.cwd(), "node_modules", "katex", "dist", "katex.min.css");
      katexCss = fs.readFileSync(cssPath, "utf8");
      // Map local relative font files to high-performance CDN URLs for high-fidelity printing
      katexCss = katexCss.replace(/url\(fonts\//g, "url(https://cdn.jsdelivr.net/npm/katex@0.18.1/dist/fonts/");
    } catch (e) {
      console.error("Error reading local KaTeX stylesheet:", e);
    }

    // Load school logo and encode as base64 Data-URI
    let logoBase64 = "";
    try {
      const logoPath = path.join(process.cwd(), "public", "logo.png");
      if (fs.existsSync(logoPath)) {
        const logoData = fs.readFileSync(logoPath);
        logoBase64 = `data:image/png;base64,${logoData.toString("base64")}`;
      }
    } catch (e) {
      console.error("Error reading logo file:", e);
    }

    const subjectListStr = exam.examSubjects.map((es) => es.subject.name).join(", ");
    const windowStr = `${new Date(exam.startTime).toLocaleDateString()} - ${new Date(exam.endTime).toLocaleDateString()}`;

    // 6. Build the rich HTML representation of the exam review
    let htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Review: ${exam.title}</title>
  <style>
    ${katexCss}

    @page {
      size: A4;
      margin: 15mm 20mm 15mm 20mm;
    }
    body {
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #1e293b;
      line-height: 1.6;
      margin: 0;
      padding: 0;
      font-size: 13px;
    }
    .header {
      border-bottom: 2.5px solid #1B2A6B;
      padding-bottom: 12px;
      margin-bottom: 20px;
    }
    .header-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .logo-container {
      display: flex;
      align-items: center;
      gap: 15px;
    }
    .logo-img {
      height: 60px;
      width: auto;
      object-fit: contain;
    }
    .school-name {
      font-size: 22px;
      margin: 0;
      color: #1B2A6B;
      font-weight: 850;
      text-transform: uppercase;
      letter-spacing: -0.2px;
      line-height: 1.1;
    }
    .exam-title-header {
      font-size: 13px;
      color: #0f172a;
      font-weight: 700;
      margin-top: 4px;
    }
    .exam-subject-header, .exam-window-header {
      font-size: 11px;
      color: #64748b;
      font-weight: 500;
      margin-top: 1px;
    }
    .grid-meta {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
      margin-top: 15px;
      padding: 12px 16px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
    }
    .meta-item {
      font-size: 11.5px;
      color: #475569;
    }
    .meta-item span {
      font-weight: 700;
      color: #0f172a;
    }
    .score-badge-container {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
    }
    .score-label {
      font-size: 10px;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
      margin-bottom: 4px;
    }
    .score-percentage {
      font-size: 28px;
      font-weight: 900;
      color: #16a34a;
      background: #f0fdf4;
      border: 1.5px solid #bbf7d0;
      border-radius: 12px;
      padding: 6px 16px;
      line-height: 1;
    }
    .subject-section {
      margin-top: 30px;
    }
    .subject-title {
      font-size: 15px;
      color: #1B2A6B;
      border-bottom: 1.5px solid #e2e8f0;
      padding-bottom: 4px;
      margin-bottom: 15px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.8px;
    }
    .question-card {
      page-break-inside: avoid;
      margin-bottom: 20px;
      padding: 16px;
      background: #ffffff;
      border: 1.5px solid #e2e8f0;
      border-radius: 12px;
      box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
    }
    .question-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
      border-bottom: 1px dashed #f1f5f9;
      padding-bottom: 8px;
    }
    .question-num {
      font-weight: 800;
      color: #1B2A6B;
      font-size: 12.5px;
    }
    .question-points {
      font-size: 10px;
      font-weight: 700;
      color: #64748b;
      background: #f1f5f9;
      padding: 2px 6px;
      border-radius: 4px;
    }
    .passage-box {
      background: #fdfbf7;
      border-left: 3.5px solid #b45309;
      padding: 10px 14px;
      margin-bottom: 14px;
      border-radius: 0 8px 8px 0;
      border-top: 1px solid #fef3c7;
      border-bottom: 1px solid #fef3c7;
      border-right: 1px solid #fef3c7;
    }
    .passage-title {
      font-weight: 700;
      color: #78350f;
      font-size: 11.5px;
      margin-bottom: 3px;
      text-transform: uppercase;
    }
    .passage-text {
      color: #451a03;
      font-size: 11px;
      white-space: pre-wrap;
      font-style: italic;
    }
    .question-text {
      font-size: 13px;
      font-weight: 600;
      margin-bottom: 15px;
      color: #0f172a;
    }
    .diagram-box {
      margin-bottom: 15px;
      text-align: center;
    }
    .diagram-img {
      max-height: 180px;
      max-width: 100%;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 3px;
      background: #fff;
    }
    .options-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 8px;
    }
    .option-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 12px;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
      background: #ffffff;
    }
    .option-item.state-correct {
      border-color: #22c55e;
      background-color: #f0fdf4;
    }
    .option-item.state-incorrect {
      border-color: #ef4444;
      background-color: #fef2f2;
    }
    .option-left {
      display: flex;
      align-items: center;
    }
    .option-letter {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: #f8fafc;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      font-size: 11px;
      margin-right: 12px;
      border: 1.5px solid #cbd5e1;
      color: #475569;
      flex-shrink: 0;
    }
    .state-correct .option-letter {
      background: #22c55e;
      color: white;
      border-color: #22c55e;
    }
    .state-incorrect .option-letter {
      background: #ef4444;
      color: white;
      border-color: #ef4444;
    }
    .option-text {
      font-size: 12px;
      font-weight: 500;
    }
    .state-incorrect .option-text {
      text-decoration: line-through;
      color: #94a3b8;
    }
    .badge {
      font-size: 9.5px;
      font-weight: 800;
      padding: 3px 8px;
      border-radius: 6px;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      flex-shrink: 0;
    }
    .badge-correct {
      background: #dcfce7;
      color: #15803d;
      border: 1px solid #bbf7d0;
    }
    .badge-incorrect {
      background: #fee2e2;
      color: #b91c1c;
      border: 1px solid #fecaca;
    }
    .badge-both {
      background: #dbeafe;
      color: #1e40af;
      border: 1px solid #bfdbfe;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-row">
      <div class="logo-container">
        ${logoBase64 ? `<img src="${logoBase64}" class="logo-img" alt="Manna Academy Logo" />` : ""}
        <div>
          <h1 class="school-name">Manna Academy</h1>
          <div class="exam-title-header">${exam.title}</div>
          <div class="exam-subject-header">Subject: ${subjectListStr}</div>
          <div class="exam-window-header">Exam Window: ${windowStr}</div>
        </div>
      </div>
      <div class="score-badge-container">
        <div class="score-label">Score Received</div>
        <div class="score-percentage">${result.score}%</div>
      </div>
    </div>
    
    <div class="grid-meta">
      <div class="meta-item">Candidate: <span>${result.student.name}</span></div>
      <div class="meta-item">Roll Number: <span>${result.student.rollNumber || "N/A"}</span></div>
      <div class="meta-item">Completion Date: <span>${new Date(result.createdAt).toLocaleString()}</span></div>
      <div class="meta-item">Duration Spent: <span>${Math.floor(result.timeSpent / 60)}m ${result.timeSpent % 60}s</span></div>
    </div>
  </div>
`;

    // 7. Loop through each subject and generate questions list
    let questionIndex = 1;
    for (const subData of subjectsData) {
      htmlContent += `
  <div class="subject-section">
    <div class="subject-title">${subData.subjectName}</div>
  </div>
`;

      for (const q of subData.questions) {
        const studentSelect = attemptsMap[q.id];
        const hasPassage = !!(q.passageTitle || q.passageText);

        // Resolve local file system path for reference diagram image
        let diagramHtml = "";
        if (q.imageUrl) {
          let imgSrc = q.imageUrl;
          if (imgSrc.startsWith("/")) {
            imgSrc = `file:///${path.join(process.cwd(), "public", imgSrc).replace(/\\/g, "/")}`;
          }
          diagramHtml = `
      <div class="diagram-box">
        <img src="${imgSrc}" class="diagram-img" alt="Diagram reference" />
      </div>
`;
        }

        // Render passage title/text if present
        let passageHtml = "";
        if (hasPassage) {
          passageHtml = `
      <div class="passage-box">
        ${q.passageTitle ? `<div class="passage-title">${renderMathInText(q.passageTitle)}</div>` : ""}
        ${q.passageText ? `<div class="passage-text">${renderMathInText(q.passageText)}</div>` : ""}
      </div>
`;
        }

        // Process options list
        const options = [
          { key: "A", text: q.optionA },
          { key: "B", text: q.optionB },
          { key: "C", text: q.optionC },
          { key: "D", val: q.optionD },
          ...(q.optionE ? [{ key: "E", val: q.optionE }] : []),
          ...(q.optionF ? [{ key: "F", val: q.optionF }] : []),
        ];

        let optionsHtml = "";
        for (const opt of options) {
          const val = "text" in opt ? opt.text : (opt as any).val;
          const isCorrect = opt.key.toUpperCase() === q.correctOption.toUpperCase();
          const isSelected = studentSelect?.toUpperCase() === opt.key.toUpperCase();

          let rowClass = "";
          let badgeHtml = "";

          if (isCorrect && isSelected) {
            rowClass = "state-correct";
            badgeHtml = `<span class="badge badge-both">✓ Correct &amp; Your Choice</span>`;
          } else if (isCorrect && !isSelected) {
            rowClass = "state-correct";
            badgeHtml = `<span class="badge badge-correct">✓ Correct Answer</span>`;
          } else if (!isCorrect && isSelected) {
            rowClass = "state-incorrect";
            badgeHtml = `<span class="badge badge-incorrect">✗ Your Choice (Incorrect)</span>`;
          }

          optionsHtml += `
        <div class="option-item ${rowClass}">
          <div class="option-left">
            <div class="option-letter">${opt.key}</div>
            <div class="option-text">${renderMathInText(val || "")}</div>
          </div>
          ${badgeHtml}
        </div>
`;
        }

        htmlContent += `
    <div class="question-card">
      <div class="question-header">
        <span class="question-num">Question ${questionIndex}</span>
        <span class="question-points">${q.points} pt(s)</span>
      </div>
      ${passageHtml}
      <div class="question-text">${renderMathInText(q.questionText)}</div>
      ${diagramHtml}
      <div class="options-grid">
        ${optionsHtml}
      </div>
    </div>
`;
        questionIndex++;
      }
    }

    htmlContent += `
</body>
</html>
`;

    // 8. Launch local browser and convert HTML to A4 PDF
    let executablePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
    if (!fs.existsSync(executablePath)) {
      executablePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
    }

    if (!fs.existsSync(executablePath)) {
      console.error("No suitable Edge or Chrome executable found on host.");
      return NextResponse.json({ error: "System browser environment missing" }, { status: 500 });
    }

    const browser = await puppeteer.launch({
      executablePath,
      args: ["--allow-file-access-from-files", "--no-sandbox", "--disable-setuid-sandbox"],
      headless: true,
    });

    const page = await browser.newPage();
    await page.setContent(htmlContent);
    
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: {
        top: "15mm",
        bottom: "15mm",
        left: "20mm",
        right: "20mm",
      },
    });

    await browser.close();

    // 9. Return the PDF byte stream to browser
    return new Response(pdfBuffer as any, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Exam_Review_${examId}.pdf"`,
      },
    });
  } catch (error) {
    console.error("GET results download review error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
