import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('queasy_ready.sqlite');

console.log('--- Applying Fix for 2 and 3 option questions with = ---');

const rows = db.prepare('SELECT id, quiz_id, question_text, options_json, correct_option_id FROM questions WHERE length(options_json) > 0').all();

let count3Fixed = 0;
let count2Fixed = 0;
const updates = [];

for (const r of rows) {
  let opts;
  try {
    opts = JSON.parse(r.options_json);
  } catch (e) {
    continue;
  }

  if (opts.length === 2 || opts.length === 3) {
    if (!opts.some(o => o.includes('='))) continue;

    const newOpts = [];
    let newCorrectId = r.correct_option_id;

    for (let i = 0; i < opts.length; i++) {
      const o = opts[i];
      if (o.includes('=')) {
        const parts = o.split(/\s*=\s*/).map(p => p.trim()).filter(Boolean);
        if (parts.length > 1) {
          if (i === r.correct_option_id) {
            newCorrectId = newOpts.length;
          }
          newOpts.push(...parts);
        } else {
          if (i === r.correct_option_id) {
            newCorrectId = newOpts.length;
          }
          newOpts.push(o.replace(/=/g, '').trim());
        }
      } else {
        if (i === r.correct_option_id) {
          newCorrectId = newOpts.length;
        }
        newOpts.push(o.trim());
      }
    }

    // Only accept if strictly 4 options
    if (newOpts.length === 4) {
      if (opts.length === 3) count3Fixed++;
      if (opts.length === 2) count2Fixed++;

      updates.push({
        id: r.id,
        options_json: JSON.stringify(newOpts),
        correct_option_id: newCorrectId
      });
    }
  }
}

console.log(`Found ${updates.length} questions to fix (3-opts: ${count3Fixed}, 2-opts: ${count2Fixed}).`);

if (updates.length > 0) {
  const updateStmt = db.prepare('UPDATE questions SET options_json = ?, correct_option_id = ? WHERE id = ?');
  
  db.exec('BEGIN TRANSACTION;');
  try {
    for (const u of updates) {
      updateStmt.run(u.options_json, u.correct_option_id, u.id);
    }
    db.exec('COMMIT;');
    console.log(`Successfully updated ${updates.length} questions in SQLite!`);
  } catch (err) {
    db.exec('ROLLBACK;');
    console.error('Error during update transaction:', err);
    process.exit(1);
  }
}

// Verify updated distribution
const finalRows = db.prepare('SELECT options_json FROM questions').all();
const dist = {};
for (const r of finalRows) {
  try {
    const o = JSON.parse(r.options_json);
    dist[o.length] = (dist[o.length] || 0) + 1;
  } catch(e){}
}
console.log('New options distribution in SQLite:');
console.log(dist);

