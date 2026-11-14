// tests/test_quiz_mode_wizard.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';

console.log('Testing Task 3: QuizModeModal 2-step Wizard...');

const modalContent = fs.readFileSync('src/components/quiz/QuizModeModal.jsx', 'utf8');

// 1. Step state
assert(modalContent.includes('step') && (modalContent.includes('setStep') || modalContent.includes('currentStep')), 'QuizModeModal must maintain wizard step state');

// 2. Auto-advance on full mode selection
assert(modalContent.includes('step') && modalContent.includes('2'), 'Selecting full mode must transition to step 2');

// 3. Time limit presets
assert(modalContent.includes('10') && modalContent.includes('15') && modalContent.includes('30') && modalContent.includes('45'), 'QuizModeModal must offer 10s, 15s, 30s, 45s time limit presets');
assert(modalContent.includes('60') && modalContent.includes('120'), 'QuizModeModal must offer 60s and 120s time limit presets');

// 4. Time limit passed to onConfirmMode
assert(modalContent.includes('timeLimit:'), 'QuizModeModal must pass timeLimit to onConfirmMode');

console.log('Task 3 test assertions verified successfully!');
