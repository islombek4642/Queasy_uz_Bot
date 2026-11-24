import turso from '../tgcloud/lib/turso_client.js';

async function main() {
  console.log('Cleaning Turso entities...');
  await turso.run(`UPDATE questions SET question_text = REPLACE(question_text, '&quot;', '"') WHERE question_text LIKE '%&quot;%'`);
  await turso.run(`UPDATE questions SET question_text = REPLACE(question_text, '&apos;', "'") WHERE question_text LIKE '%&apos;%'`);
  await turso.run(`UPDATE questions SET options_json = REPLACE(options_json, '&quot;', '"') WHERE options_json LIKE '%&quot;%'`);
  await turso.run(`UPDATE questions SET options_json = REPLACE(options_json, '&apos;', "'") WHERE options_json LIKE '%&apos;%'`);
  console.log('✅ Turso entities cleaned successfully!');
}

main().catch(console.error);
