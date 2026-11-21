import fs from 'fs';
import assert from 'assert';

console.log('Testing Range Mode and KaTeX Fonts in exported HTML...');

const html = fs.readFileSync('NAMANGAN_MATHEMATICS_FOR_ECONOMICS_2_UZ_.html', 'utf8');

const relativeFonts = (html.match(/url\(fonts\//g) || []).length;
console.log('Relative fonts count (must be 0):', relativeFonts);
assert.strictEqual(relativeFonts, 0, 'Must have 0 relative font URLs');

const cdnFonts = (html.match(/url\(https:\/\/cdn\.jsdelivr\.net\/npm\/katex/g) || []).length;
console.log('CDN fonts count:', cdnFonts);
assert.ok(cdnFonts >= 20, 'Must have CDN font URLs');

assert.ok(html.includes('originalIndex'), 'Must include originalIndex');
assert.ok(html.includes('Asl savol: #'), 'Must include Asl savol: # in badge');
assert.ok(html.includes('Oraliq:'), 'Must include Oraliq: in category badge');

const match = html.match(/const RAW_QUIZ = (\{[\s\S]+?\});/);
assert.ok(match, 'RAW_QUIZ must exist');
const quiz = JSON.parse(match[1]);

assert.strictEqual(quiz.questions[0].originalIndex, 1);
assert.strictEqual(quiz.questions[29].originalIndex, 30);
console.log('Question 29 originalIndex:', quiz.questions[29].originalIndex);
console.log('Question 29 text:', quiz.questions[29].question.slice(0, 50));

console.log('Verifying iPhone / iOS Safari modal responsive standards:');
assert.ok(html.includes('viewport-fit=cover'), 'HTML must include viewport-fit=cover for iPhone notch and home bar');
assert.ok(html.includes('100dvh'), 'HTML must use 100dvh for dynamic mobile viewports');
assert.ok(html.includes('touch-action: manipulation'), 'HTML must include touch-action: manipulation to eliminate mobile tap delay');
assert.ok(html.includes('font-size: 16px'), 'Input box must be at least 16px to prevent iOS Safari auto-zoom');
assert.ok(html.includes('type="button" id="wizardNextBtn"'), 'wizardNextBtn must be an explicit button');

console.log('✅ ALL RANGE, FONTS, AND IOS SAFARI TESTS PASSED!');

