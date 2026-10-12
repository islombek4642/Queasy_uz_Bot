import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const full = path.join(dir, file);
    const stat = fs.statSync(full);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(full));
    } else if (file.endsWith('.js')) {
      results.push(full);
    }
  }
  return results;
}

const files = walk('./tgcloud');
console.log(`Checking syntax of ${files.length} files...`);

for (const f of files) {
  try {
    execSync(`node --check "${f}"`, { stdio: 'pipe' });
  } catch (err) {
    console.error(`Syntax error in ${f}:`, err.message);
    process.exit(1);
  }
}

console.log('✅ All tgcloud files passed syntax check perfectly!');
