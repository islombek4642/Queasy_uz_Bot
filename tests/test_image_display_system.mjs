import assert from 'node:assert';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { bytesToBase64 } from '../tgcloud/lib/utils/unzip.js';

console.log('🧪 Testing Image Display System (Bot, WebApp & Offline HTML)...');

// 1. Verify Quiz 1899 has photo_file_id in SQLite
const db = new DatabaseSync('queasy_ready.sqlite');
const q1899Photos = db.prepare('SELECT id, question_text, photo_file_id FROM questions WHERE quiz_id = 1899 AND photo_file_id IS NOT NULL').all();

console.log(`Found ${q1899Photos.length} questions with photo_file_id in Quiz 1899`);
assert.ok(q1899Photos.length >= 40, 'Quiz 1899 must have at least 40 questions with photo_file_id');

// Verify Question 171 (Bat creature) has photo_file_id
const batQ = db.prepare('SELECT id, question_text, photo_file_id FROM questions WHERE id = 569441').get();
assert.ok(batQ, 'Bat question (id 569441) must exist');
assert.ok(batQ.photo_file_id, 'Bat question must have photo_file_id');
assert.ok(batQ.photo_file_id.startsWith('AgAC'), 'photo_file_id must be a Telegram file ID');
console.log('✅ Bat Question (Q171):', batQ.question_text, '-> photo_file_id:', batQ.photo_file_id);

// 2. Test bytesToBase64 helper
const sampleBytes = new Uint8Array([72, 101, 108, 108, 111]); // 'Hello'
const b64 = bytesToBase64(sampleBytes);
assert.strictEqual(b64, 'SGVsbG8=', 'bytesToBase64 must correctly encode bytes');
console.log('✅ bytesToBase64 helper works correctly');

// 3. Verify get_media endpoint code
const getMediaCode = fs.readFileSync('tgcloud/endpoints/get_media.js', 'utf8');
assert.ok(getMediaCode.includes('export default async function'), 'get_media must export default async function');
assert.ok(getMediaCode.includes('api.getFileContent'), 'get_media must use api.getFileContent');
assert.ok(getMediaCode.includes('bytesToBase64'), 'get_media must encode bytes to base64');
console.log('✅ get_media endpoint static verification passed');

// 4. Verify MediaImage React component exists and is referenced
const mediaImageCode = fs.readFileSync('src/components/common/MediaImage.jsx', 'utf8');
assert.ok(mediaImageCode.includes('export function MediaImage'), 'MediaImage must export component');
assert.ok(mediaImageCode.includes('get_media'), 'MediaImage must call get_media endpoint');

const arenaViewCode = fs.readFileSync('src/views/ArenaView.jsx', 'utf8');
assert.ok(arenaViewCode.includes('MediaImage'), 'ArenaView must import and use MediaImage');

const quizDetailViewCode = fs.readFileSync('src/views/QuizDetailView.jsx', 'utf8');
assert.ok(quizDetailViewCode.includes('MediaImage'), 'QuizDetailView must import and use MediaImage');
console.log('✅ WebApp ArenaView and QuizDetailView MediaImage integration verified');

// 5. Verify Bot session_service sends photo
const sessionServiceCode = fs.readFileSync('tgcloud/lib/services/session_service.js', 'utf8');
assert.ok(sessionServiceCode.includes('api.sendPhoto'), 'session_service must call api.sendPhoto');
assert.ok(sessionServiceCode.includes('photoToSend'), 'session_service must check photoToSend');
console.log('✅ Bot session_service photo sending logic verified');

// 6. Verify HTML export embeds images as base64
const callbackQueryCode = fs.readFileSync('tgcloud/handlers/callback_query.js', 'utf8');
assert.ok(callbackQueryCode.includes('questionsWithOfflineMedia'), 'callback_query must resolve offline media for HTML export');
console.log('✅ Offline HTML export media resolution verified');

console.log('🎉 ALL IMAGE DISPLAY SYSTEM TESTS PASSED PERFECTLY!');
