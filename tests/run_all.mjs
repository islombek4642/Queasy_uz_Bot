// tests/run_all.mjs
// Comprehensive test runner for all unit and integration test suites
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

console.log('🚀 Running all test suites for Queasy_uz_Bot...\n');

const testsDir = path.resolve('tests');
const files = fs.readdirSync(testsDir)
  .filter((f) => (f.endsWith('.mjs') || f.endsWith('.js')) && f !== 'run_all.mjs')
  .sort();

let passed = 0;
let failed = 0;
const failedFiles = [];

for (const file of files) {
  process.stdout.write(`⏳ Running tests/${file} ... `);
  const result = spawnSync(process.execPath, [path.join(testsDir, file)], {
    encoding: 'utf8',
    stdio: 'pipe',
  });

  if (result.status === 0) {
    passed++;
    console.log('✅ PASS');
  } else {
    failed++;
    failedFiles.push(file);
    console.log('❌ FAIL');
    if (result.stdout) console.log(result.stdout);
    if (result.stderr) console.error(result.stderr);
  }
}

console.log('\n========================================');
console.log(`📊 Test Summary: ${passed} passed, ${failed} failed (Total: ${files.length})`);
console.log('========================================');

if (failed > 0) {
  console.error(`\n❌ Failed test files: ${failedFiles.join(', ')}`);
  process.exit(1);
} else {
  console.log('\n🎉 ALL PROJECT TEST SUITES PASSED PERFECTLY!\n');
  process.exit(0);
}
