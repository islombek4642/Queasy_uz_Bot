import fs from 'fs';
import assert from 'assert';

console.log('Testing Range Mode, KaTeX Fonts, and Results Page UX in exported HTML...');

const desktopFile = 'C:/Users/Islombek/Desktop/NAMANGAN_MATHEMATICS_FOR_ECONOMICS_2_UZ_.html';
const html = fs.existsSync(desktopFile) 
  ? fs.readFileSync(desktopFile, 'utf8') 
  : fs.readFileSync('NAMANGAN_MATHEMATICS_FOR_ECONOMICS_2_UZ_.html', 'utf8');

// 1. Fonts & KaTeX
const relativeFonts = (html.match(/url\(fonts\//g) || []).length;
console.log('Relative fonts count (must be 0):', relativeFonts);
assert.strictEqual(relativeFonts, 0, 'Must have 0 relative font URLs');

const cdnFonts = (html.match(/url\(https:\/\/cdn\.jsdelivr\.net\/npm\/katex/g) || []).length;
console.log('CDN fonts count:', cdnFonts);
assert.ok(cdnFonts >= 20, 'Must have CDN font URLs');

assert.ok(html.includes('originalIndex'), 'Must include originalIndex');
assert.ok(html.includes('Asl savol: #'), 'Must include Asl savol: # in badge');
assert.ok(html.includes('Oraliq:'), 'Must include Oraliq: in category badge');

// 2. Results Screen Optimization & Progress Line
console.log('Verifying Results Page Stats & Progress Line:');
assert.ok(html.includes('id="resultRatioText"'), 'Must have resultRatioText for 21 / 25 or 4 / 5 format');
assert.ok(html.includes('id="resultBarCorrect"'), 'Must have resultBarCorrect');
assert.ok(html.includes('id="resultBarWrong"'), 'Must have resultBarWrong');
assert.ok(html.includes('id="resultPercentCorrectText"'), 'Must have resultPercentCorrectText (e.g. 84% to\'g\'ri)');
assert.ok(html.includes('id="resultPercentWrongText"'), 'Must have resultPercentWrongText (e.g. 16% xato)');
assert.ok(html.includes('id="answersGrid"'), 'Must have answersGrid for question number tiles');
assert.ok(html.includes('max-height: 220px; overflow-y: auto;'), 'answersGrid must have max-height and overflow-y: auto for scrolling when many questions exist');

assert.ok(html.includes('id="statCorrect"'), 'Must have statCorrect');
assert.ok(html.includes('id="statWrong"'), 'Must have statWrong');
assert.ok(html.includes('id="statTotal"'), 'Must have statTotal (Jami savol)');
assert.ok(!html.includes('id="statTime"'), 'Must NOT have statTime (Vaqt removed)');
assert.ok(!html.includes('id="printBtn"'), 'Must NOT have printBtn (Chop etish removed)');
assert.ok(!html.includes('id="reconfigureBtn"'), 'Must NOT have reconfigureBtn (merged into retryQuizBtn)');

assert.ok(html.includes('id="retryQuizBtn"'), 'Must have retryQuizBtn (Qayta ishlash)');
assert.ok(html.includes('id="retryMistakesBtn"'), 'Must have retryMistakesBtn (Xatolar ustida ishlash)');
assert.ok(html.includes('id="mistakesCountLabel"'), 'Must have mistakesCountLabel');
assert.ok(html.includes('id="toggleReviewBtn"'), 'Must have toggleReviewBtn (Javoblarni batafsil ko\'rish)');
assert.ok(html.includes('id="reviewSection"'), 'Must have reviewSection');
assert.ok(html.includes('id="reviewSection" style="margin-top: 14px; display: none;'), 'reviewSection must be hidden by default');

assert.ok(html.includes("finishBtn.style.display = 'none'"), 'Must hide finishBtn on the last question to prevent duplicate finish buttons');
assert.ok(html.includes("finishBtn.style.display = 'inline-flex'"), 'Must restore finishBtn on non-last questions');

// 3. JavaScript Scope & Logic
console.log('Verifying JS Scope & Logic:');
const selectModeDeclIndex = html.indexOf('function selectMode(mode)');
const initWizardDeclIndex = html.indexOf('function initWizard()');
assert.ok(selectModeDeclIndex > 0, 'selectMode must be declared');
assert.ok(initWizardDeclIndex > 0, 'initWizard must be declared');
assert.ok(selectModeDeclIndex < initWizardDeclIndex, 'selectMode must be in outer scope BEFORE initWizard to prevent ReferenceError');

assert.ok(html.includes('data-rand="5"'), 'Must have 5 ta preset pill for random questions');
assert.ok(html.includes('retryMistakesBtn.style.display = \'none\''), 'retryMistakesBtn must hide when 0 errors');
assert.ok(html.includes('retryMistakesBtn.style.display = \'flex\''), 'retryMistakesBtn must show when > 0 errors');

// 4. iOS Safari & Auto-Advance
console.log('Verifying iPhone / iOS Safari modal responsive standards:');
assert.ok(html.includes('viewport-fit=cover'), 'HTML must include viewport-fit=cover for iPhone notch and home bar');
assert.ok(html.includes('100dvh'), 'HTML must use 100dvh for dynamic mobile viewports');
assert.ok(html.includes('touch-action: manipulation'), 'HTML must include touch-action: manipulation to eliminate mobile tap delay');
assert.ok(html.includes('font-size: 16px'), 'Input box must be at least 16px to prevent iOS Safari auto-zoom');
assert.ok(html.includes('type="button" id="wizardNextBtn"'), 'wizardNextBtn must be an explicit button');

console.log('Verifying Auto-Advance & Persistent Timer on Answer:');
assert.ok(html.includes('autoAdvanceTimeout'), 'HTML must include autoAdvanceTimeout');
assert.ok(html.includes('nextQuestion();'), 'HTML must auto-advance with nextQuestion()');
assert.ok(html.includes('1200'), 'HTML must have 1.2s delay for seamless auto-advance');

console.log('✅ ALL RANGE, FONTS, AUTO-ADVANCE, RESULTS SCREEN, AND IOS SAFARI TESTS PASSED!');
