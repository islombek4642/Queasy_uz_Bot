// tests/test_math_engine.mjs
import assert from 'node:assert';
import {
  hasMathFormula,
  ommlToLatex,
  normalizeLatex,
  generateLatexImageUrl,
  renderAndUploadFormula,
} from '../tgcloud/lib/parsers/math_engine.js';

console.log('Testing Math & Formula Engine...');

// 1. Detection
{
  assert.strictEqual(hasMathFormula('Oddiy matn bu yerda hech qanday formula yoq'), false);
  assert.strictEqual(hasMathFormula('Tenglama: $$x^2 + y^2 = 1$$'), true);
  assert.strictEqual(hasMathFormula('Integral hisoblash: \\int_0^1 x dx'), true);
  assert.strictEqual(hasMathFormula('Kasr: \\frac{a+b}{c}'), true);
  assert.strictEqual(hasMathFormula('Ildiz: \\sqrt{16} = 4'), true);
  assert.strictEqual(hasMathFormula('<m:oMath><m:f><m:num><m:t>1</m:t></m:num><m:den><m:t>2</m:t></m:den></m:f></m:oMath>'), true);
  assert.strictEqual(hasMathFormula('Funksiya f(x) = x^2'), true);
}

// 2. Normalization
{
  assert.strictEqual(normalizeLatex('$$ \\frac{1}{2} $$'), '\\frac{1}{2}');
  assert.strictEqual(normalizeLatex('$ x + y $'), 'x + y');
  assert.strictEqual(normalizeLatex('2 × 3 ± 1'), '2 \\times 3 \\pm 1');
}

// 3. OMML to LaTeX
{
  const ommlFraction = '<m:oMath><m:f><m:num><m:t>x + 1</m:t></m:num><m:den><m:t>y - 2</m:t></m:den></m:f></m:oMath>';
  const latex = ommlToLatex(ommlFraction);
  assert.strictEqual(latex.includes('\\frac{x + 1}{y - 2}'), true);

  const ommlSqrt = '<m:rad><m:e><m:t>25</m:t></m:e></m:rad>';
  const sqrtLatex = ommlToLatex(ommlSqrt);
  assert.strictEqual(sqrtLatex.includes('\\sqrt{25}'), true);

  const ommlSup = '<m:sSup><m:e><m:t>x</m:t></m:e><m:sup><m:t>2</m:t></m:sup></m:sSup>';
  const supLatex = ommlToLatex(ommlSup);
  assert.strictEqual(supLatex.includes('{x}^{2}'), true);
}

// 4. Image URL Generation (300 DPI)
{
  const url = generateLatexImageUrl('\\frac{a}{b}', 300);
  assert.strictEqual(url.includes('latex.codecogs.com'), true);
  const decoded = decodeURIComponent(url);
  assert.strictEqual(decoded.includes('\\dpi{300}'), true);
  assert.strictEqual(decoded.includes('\\bg{white}'), true);
}

// 5. Mock upload fallback
{
  const mockApi = {
    async sendPhoto({ chat_id, photo }) {
      return {
        photo: [{ file_id: 'small_id' }, { file_id: 'high_res_file_id_123' }],
      };
    },
  };

  const fileId = await renderAndUploadFormula({
    api: mockApi,
    mediaChannelId: '-100123456789',
    latexFormula: 'E = mc^2',
  });
  assert.strictEqual(fileId, 'high_res_file_id_123');

  // Fallback when no media channel
  const fallbackUrl = await renderAndUploadFormula({
    api: null,
    mediaChannelId: null,
    latexFormula: 'E = mc^2',
  });
  assert.strictEqual(fallbackUrl.includes('latex.codecogs.com'), true);
}

console.log('✅ All Math Engine tests passed successfully!');
