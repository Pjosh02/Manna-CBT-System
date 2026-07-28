import test from "node:test";
import assert from "node:assert";
import { parseDocxText } from "./docxQuestionParser";

test("docxQuestionParser - valid document parsing", () => {
  const documentText = `
    1. What is the capital of Nigeria?
    A. Lagos
    B. Abuja
    C. Ibadan
    D. Kano
    Answer: B

    2. Which of these is a programming language?
    A. HTML
    B. CSS
    C. JavaScript
    D. DOCX
    Answer: C
  `;

  const result = parseDocxText(documentText);

  assert.strictEqual(result.questions.length, 2);
  assert.strictEqual(result.errors.length, 0);

  assert.strictEqual(result.questions[0].docNumber, 1);
  assert.strictEqual(result.questions[0].questionText, "What is the capital of Nigeria?");
  assert.deepStrictEqual(result.questions[0].options, ["Lagos", "Abuja", "Ibadan", "Kano"]);
  assert.strictEqual(result.questions[0].correctOption, "B");

  assert.strictEqual(result.questions[1].docNumber, 2);
  assert.strictEqual(result.questions[1].questionText, "Which of these is a programming language?");
  assert.deepStrictEqual(result.questions[1].options, ["HTML", "CSS", "JavaScript", "DOCX"]);
  assert.strictEqual(result.questions[1].correctOption, "C");
});

test("docxQuestionParser - document with missing answer line", () => {
  const documentText = `
    1. Question with answer?
    A. Yes
    B. No
    Answer: A

    2. Question with missing answer line?
    A. True
    B. False
  `;

  const result = parseDocxText(documentText);

  assert.strictEqual(result.questions.length, 1);
  assert.strictEqual(result.errors.length, 1);

  assert.strictEqual(result.errors[0].questionNumber, 2);
  assert.match(result.errors[0].message, /Answer line is missing/);
});

test("docxQuestionParser - document with mismatched option count", () => {
  const documentText = `
    1. Too few options?
    A. Only one option
    Answer: A

    2. Valid options (three options)?
    A. Option one
    B. Option two
    C. Option three
    Answer: B

    3. Too many options?
    A. One
    B. Two
    C. Three
    D. Four
    E. Five
    F. Six
    G. Seven
    Answer: C
  `;

  const result = parseDocxText(documentText);

  assert.strictEqual(result.questions.length, 1); // Only question 2 is valid
  assert.strictEqual(result.errors.length, 2);   // Question 1 and 3 are invalid

  assert.strictEqual(result.errors[0].questionNumber, 1);
  assert.match(result.errors[0].message, /Must be between 2 and 6/);

  assert.strictEqual(result.errors[1].questionNumber, 3);
  assert.match(result.errors[1].message, /Must be between 2 and 6/);
});
