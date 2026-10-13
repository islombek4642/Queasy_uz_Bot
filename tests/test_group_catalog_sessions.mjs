// tests/test_group_catalog_sessions.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';

console.log('Testing state and catalog enhancements in endpoints...');

const liveStateContent = fs.readFileSync('tgcloud/endpoints/get_live_room_state.js', 'utf8');
const groupSessionsContent = fs.readFileSync('tgcloud/endpoints/get_group_sessions.js', 'utf8');

assert(liveStateContent.includes('hasFinished'), 'get_live_room_state must return hasFinished indicator');
assert(groupSessionsContent.includes('isPublic'), 'get_group_sessions must include isPublic flag for quizzes');
assert(groupSessionsContent.includes('ownerId, 0'), 'get_group_sessions must query public/catalog quizzes when user has < 5 quizzes');

console.log('Task 2 assertions PASS!');
