import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('queasy_ready.sqlite');

// Clean &quot;, &apos;, &amp; in question_text and options_json
const updates = [
  ["&quot;", '"'],
  ["&apos;", "'"],
  ["&#39;", "'"],
  ["&#34;", '"'],
  ["&amp;amp;", "&"]
];

let changedQ = 0;
let changedOpt = 0;

for (const [entity, repl] of updates) {
  const qRows = db.prepare(`SELECT id, question_text FROM questions WHERE question_text LIKE ?`).all(`%${entity}%`);
  for (const r of qRows) {
    const updated = r.question_text.replaceAll(entity, repl);
    db.prepare('UPDATE questions SET question_text = ? WHERE id = ?').run(updated, r.id);
    changedQ++;
  }

  const optRows = db.prepare(`SELECT id, options_json FROM questions WHERE options_json LIKE ?`).all(`%${entity}%`);
  for (const r of optRows) {
    const updated = r.options_json.replaceAll(entity, repl);
    db.prepare('UPDATE questions SET options_json = ? WHERE id = ?').run(updated, r.id);
    changedOpt++;
  }
}

console.log(`Updated SQLite: ${changedQ} questions, ${changedOpt} options.`);

