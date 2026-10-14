import assert from 'node:assert';
import { hasMathFormula, formatLatexForRender } from '../tgcloud/lib/parsers/math_engine.js';

console.log('🧪 Starting Math Engine Tests...\n');

// 1. Detection
assert.strictEqual(hasMathFormula('Natural sonlar nechta?'), false);
assert.strictEqual(hasMathFormula('Qaysi shartda $det A=0$ bo\'ladi?'), true);
assert.strictEqual(hasMathFormula('Quyidagini hisoblang: \\frac{a+b}{c}'), true);
assert.strictEqual(hasMathFormula('Tenglamani yeching: x^2 + 2x - 3 = 0'), true);
assert.strictEqual(hasMathFormula('Integralni hisoblang: \\int_0^1 x dx'), true);
console.log('✅ Math detection passed');

// 2. formatLatexForRender
const mixed = "Agar $A= (5214)$ va $B= (-315-2)$ bo'lsa, $A+2B$ ni toping.";
const formatted = formatLatexForRender(mixed);
assert.ok(formatted.includes('\\text{Agar }'));
assert.ok(formatted.includes('A= (5214)'));
assert.ok(formatted.includes('\\text{ va }'));
assert.ok(formatted.includes('A+2B'));
console.log('✅ Mixed text/math formatting passed:', formatted);

const pure = "x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}";
const pureFormatted = formatLatexForRender(pure);
assert.ok(pureFormatted.includes('\\frac'));
console.log('✅ Pure formula formatting passed:', pureFormatted);

console.log('\n🎉 ALL MATH ENGINE TESTS PASSED!');
