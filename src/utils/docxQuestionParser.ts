export interface ParsedQuestion {
  qIndex: number;
  docNumber: number;
  questionText: string;
  options: string[]; // array of 2 to 6 options
  correctOption: string; // "A" - "F"
}

export interface ParseError {
  questionNumber: number;
  message: string;
  rawLines: string[];
}

export interface ParseResult {
  questions: ParsedQuestion[];
  errors: ParseError[];
}

export function parseDocxText(rawText: string): ParseResult {
  const lines = rawText.split(/\r?\n/);
  const questions: ParsedQuestion[] = [];
  const errors: ParseError[] = [];

  let currentBlock: {
    docNumber: number;
    questionText: string;
    options: { key: string; value: string }[];
    correctOption: string | null;
    rawLines: string[];
    seenOptions: boolean;
  } | null = null;

  function validateAndPushCurrentBlock() {
    if (!currentBlock) return;

    const blockErrors: string[] = [];

    // Strip HTML tags from question text
    const cleanQuestionText = currentBlock.questionText.replace(/<\/?[a-z0-9]+[^>]*>/gi, "").trim();

    if (!cleanQuestionText) {
      blockErrors.push("Question text is empty.");
    }

    if (currentBlock.options.length < 2 || currentBlock.options.length > 6) {
      blockErrors.push(`Invalid number of options: ${currentBlock.options.length}. Must be between 2 and 6.`);
    }

    if (!currentBlock.correctOption) {
      blockErrors.push("Answer line is missing or malformed.");
    } else {
      const validKeys = currentBlock.options.map((o) => o.key);
      if (!validKeys.includes(currentBlock.correctOption)) {
        blockErrors.push(`Answer "${currentBlock.correctOption}" does not match any of the available options: ${validKeys.join(", ")}.`);
      }
    }

    const questionNum = currentBlock.docNumber || (questions.length + errors.length + 1);

    if (blockErrors.length > 0) {
      errors.push({
        questionNumber: questionNum,
        message: blockErrors.join(" "),
        rawLines: currentBlock.rawLines.map(line => line.trim()).filter(line => line !== ""),
      });
    } else {
      // Sort options by key (A, B, C...) and map to their clean string values
      const sortedOptions = currentBlock.options
        .sort((a, b) => a.key.localeCompare(b.key))
        .map((o) => o.value.replace(/<\/?[a-z0-9]+[^>]*>/gi, "").trim());

      questions.push({
        qIndex: questions.length + 1,
        docNumber: currentBlock.docNumber,
        questionText: cleanQuestionText,
        options: sortedOptions,
        correctOption: currentBlock.correctOption!,
      });
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      if (currentBlock) {
        currentBlock.rawLines.push(line);
      }
      continue;
    }

    // Check if line starts a new question block (e.g. "1. What is...")
    const qMatch = trimmed.match(/^(\d+)\.\s*(.*)$/);
    if (qMatch) {
      validateAndPushCurrentBlock();
      currentBlock = {
        docNumber: parseInt(qMatch[1], 10),
        questionText: qMatch[2],
        options: [],
        correctOption: null,
        rawLines: [line],
        seenOptions: false,
      };
      continue;
    }

    // If we haven't encountered a question block yet, ignore the line
    if (!currentBlock) {
      continue;
    }

    currentBlock.rawLines.push(line);

    // Check if line matches an option (e.g. "A. Option description")
    const optMatch = trimmed.match(/^([A-Z])\.\s*(.*)$/i);
    if (optMatch) {
      currentBlock.seenOptions = true;
      currentBlock.options.push({
        key: optMatch[1].toUpperCase(),
        value: optMatch[2],
      });
      continue;
    }

    // Check if line matches the answer (e.g. "Answer: B")
    const ansMatch = trimmed.match(/^[Aa]nswer:\s*([A-Z])\s*$/i);
    if (ansMatch) {
      currentBlock.correctOption = ansMatch[1].toUpperCase();
      continue;
    }

    // Handle extra/multiline text
    if (currentBlock.seenOptions && currentBlock.options.length > 0) {
      // Append to the last option value if options are multiline
      currentBlock.options[currentBlock.options.length - 1].value += " " + trimmed;
    } else {
      // Append to the question text
      currentBlock.questionText += " " + trimmed;
    }
  }

  // Handle the last remaining question block
  validateAndPushCurrentBlock();

  return { questions, errors };
}
