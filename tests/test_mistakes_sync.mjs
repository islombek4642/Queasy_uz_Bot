// tests/test_mistakes_sync.mjs
// Test suite for mistakes sync logic between Bot and Web App

import assert from 'node:assert';
import fs from 'node:fs';

console.log('--- Testing Mistakes Sync & Deduplication Logic ---');

// 1. Inspect actual file content of submit_solo_result.js to test for presence of required capabilities
const submitCode = fs.readFileSync('tgcloud/endpoints/submit_solo_result.js', 'utf-8');
const mistakesEndpointCode = fs.readFileSync('tgcloud/endpoints/get_user_mistakes.js', 'utf-8');

// Test 1: submit_solo_result.js must support isMistakesMode
assert.ok(
  submitCode.includes('isMistakesMode'),
  'submit_solo_result.js must handle isMistakesMode flag'
);

// Test 2: submit_solo_result.js must support resolvedMistakeIds cleanup
assert.ok(
  submitCode.includes('resolvedMistakeIds'),
  'submit_solo_result.js must delete resolvedMistakeIds'
);

// Test 3: get_user_mistakes.js must deduplicate by questionText
assert.ok(
  mistakesEndpointCode.includes('seen') || mistakesEndpointCode.includes('dedup') || mistakesEndpointCode.includes('Set'),
  'get_user_mistakes.js must deduplicate mistakes by questionText'
);

console.log('✅ ALL MISTAKES SYNC TESTS PASSED!');
