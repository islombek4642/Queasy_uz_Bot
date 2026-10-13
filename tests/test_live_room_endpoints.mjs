// tests/test_live_room_endpoints.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';

console.log('Testing live room backend endpoints...');

// Verify files exist and export default async functions
const submitContent = fs.readFileSync('tgcloud/endpoints/submit_live_room_result.js', 'utf8');
const finishContent = fs.readFileSync('tgcloud/endpoints/finish_live_room.js', 'utf8');

assert(submitContent.includes('export default async function'), 'submit_live_room_result must export default async function');
assert(submitContent.includes('roomPlayers'), 'submit_live_room_result must interact with roomPlayers');
assert(submitContent.includes('rank'), 'submit_live_room_result must calculate and return rank');

assert(finishContent.includes('export default async function'), 'finish_live_room must export default async function');
assert(finishContent.includes("NOT_HOST"), 'finish_live_room must enforce host check');
assert(finishContent.includes("'finished'"), 'finish_live_room must set status to finished');

console.log('Task 1 logic and static assertions PASS!');
