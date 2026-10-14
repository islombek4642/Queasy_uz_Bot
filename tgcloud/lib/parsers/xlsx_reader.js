// tgcloud/lib/parsers/xlsx_reader.js
// Pure JavaScript Excel .xlsx reader

import { extractFileFromZip } from '../utils/unzip.js';
import { getMessage } from '../constants/messages.js';

const HEADER_QUESTION_KEYWORDS = ['savol', 'вопрос', 'question', 'task'];
const HEADER_ANSWER_KEYWORDS = ['javob', 'ответ', 'answer', 'variant', 'correct'];

export function extractQuestionsFromXlsx(xlsxBuffer, lang = 'UZ') {
  const sharedXml = extractFileFromZip(xlsxBuffer, 'xl/sharedStrings.xml');
  const sheetXml = extractFileFromZip(xlsxBuffer, 'xl/worksheets/sheet1.xml');

  if (!sheetXml) {
    throw new Error(getMessage('XLSX_ERR_SHEET_NOT_FOUND', lang));
  }

  // 1. Read shared strings array
  const sharedStrings = [];
  if (sharedXml) {
    const siRegex = /<si>([\s\S]*?)<\/si>/g;
    let m;
    while ((m = siRegex.exec(sharedXml)) !== null) {
      const tRegex = /<t(?:\s[^>]*)?>([^<]*)<\/t>/g;
      let textParts = [];
      let tm;
      while ((tm = tRegex.exec(m[1])) !== null) {
        textParts.push(tm[1]);
      }
      sharedStrings.push(textParts.join(''));
    }
  }

  // 2. Read sheet rows <row ...>...</row>
  const questions = [];
  const rowRegex = /<row(?:\s[^>]*)?>([\s\S]*?)<\/row>/g;
  let rowMatch;

  while ((rowMatch = rowRegex.exec(sheetXml)) !== null) {
    const rowContent = rowMatch[1];
    const cellRegex = /<c\s+r="([A-Z]+)\d+"(?:\s+t="([a-z]+)")?[^>]*>(?:<v>([^<]*)<\/v>)?<\/c>/g;
    let cellMatch;
    const cols = {};

    while ((cellMatch = cellRegex.exec(rowContent)) !== null) {
      const colLetter = cellMatch[1];
      const type = cellMatch[2];
      const val = cellMatch[3];

      let cellValue = '';
      if (type === 's' && val !== undefined) {
        cellValue = sharedStrings[parseInt(val, 10)] || '';
      } else if (val !== undefined) {
        cellValue = val;
      }
      cols[colLetter] = cellValue.trim();
    }

    const questionText = cols['A'];
    const correctAnswer = cols['B'];
    const optionC = cols['C'];
    const optionD = cols['D'];
    const optionE = cols['E'];

    if (!questionText || !correctAnswer || !optionC) continue;
    // Skip header row if it matches question/answer header keywords
    const qLower = questionText.toLowerCase();
    const aLower = correctAnswer.toLowerCase();
    const isHeaderRow = HEADER_QUESTION_KEYWORDS.some(kw => qLower.includes(kw)) &&
                        HEADER_ANSWER_KEYWORDS.some(kw => aLower.includes(kw));
    if (isHeaderRow) {
      continue;
    }

    const options = [correctAnswer, optionC];
    if (optionD) options.push(optionD);
    if (optionE) options.push(optionE);

    questions.push({
      questionText,
      options,
      correctOptionId: 0, // Column B is the correct answer
    });
  }

  return questions;
}

export default { extractQuestionsFromXlsx };
