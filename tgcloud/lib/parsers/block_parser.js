// tgcloud/lib/parsers/block_parser.js
// Custom Block Format (++++ for questions, ==== for options, # for correct answer)

export function parseBlockFormat(lines) {
  const questions = [];
  const fullText = lines.join('\n');

  // Split by question delimiter: ++++ or ++++++
  const rawBlocks = fullText.split(/\+{3,}/).map((b) => b.trim()).filter((b) => b.length > 0);

  for (const block of rawBlocks) {
    // Inside block, parts are separated by ==== or =======
    const parts = block.split(/\={3,}/).map((p) => p.trim()).filter((p) => p.length > 0);
    if (parts.length < 3) continue; // At least Question + 2 options

    const questionText = parts[0];
    const rawOptions = parts.slice(1);

    const options = [];
    let correctId = -1;

    for (let i = 0; i < rawOptions.length; i++) {
      let optText = rawOptions[i];
      if (optText.startsWith('#')) {
        correctId = i;
        optText = optText.slice(1).trim();
      }
      options.push(optText);
    }

    if (options.length >= 2 && correctId !== -1) {
      questions.push({
        questionText,
        options,
        correctOptionId: correctId,
      });
    }
  }

  return questions;
}

export default { parseBlockFormat };
