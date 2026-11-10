import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('queasy_ready.sqlite');

console.log('--- Applying Fix for Merged Questions in 6-10 options (qIdx === 3) ---');

const rows = db.prepare('SELECT id, quiz_id, question_text, options_json, correct_option_id FROM questions WHERE length(options_json) > 0').all();

const updates = [];

for (const r of rows) {
  try {
    const opts = JSON.parse(r.options_json);
    if (opts.length >= 6 && opts.length <= 10 && opts.some(o => o.includes('?'))) {
      const qIdx = opts.findIndex(o => o.includes('?'));
      if (qIdx === 3) {
        const cleanOpt3 = opts[3].split('?')[0].trim();
        if (cleanOpt3.length > 0) {
          const newOpts = [opts[0], opts[1], opts[2], cleanOpt3];
          let newCorrect = r.correct_option_id;
          if (newCorrect >= 4) {
            newCorrect = 0; // Originally option 0 had the +
          }
          updates.push({
            id: r.id,
            options_json: JSON.stringify(newOpts),
            correct_option_id: newCorrect
          });
        }
      }
    }
  } catch(e){}
}

console.log(`Found ${updates.length} merged questions to fix.`);

if (updates.length > 0) {
  const updateStmt = db.prepare('UPDATE questions SET options_json = ?, correct_option_id = ? WHERE id = ?');
  
  db.exec('BEGIN TRANSACTION;');
  try {
    for (const u of updates) {
      updateStmt.run(u.options_json, u.correct_option_id, u.id);
    }
    db.exec('COMMIT;');
    console.log(`Successfully updated ${updates.length} merged questions in SQLite!`);
  } catch (err) {
    db.exec('ROLLBACK;');
    console.error('Error during update transaction:', err);
    process.exit(1);
  }
}

// Check new distribution
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

