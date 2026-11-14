// tests/test_group_host_simplified.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';

console.log('Testing Task 4: Simplified GroupHostView & Routing...');

// 1. Verify GroupHostView has single unified group launch button
const hostContent = fs.readFileSync('src/views/GroupHostView.jsx', 'utf8');
assert(!hostContent.includes('BTN_LAUNCH_BOT_POLL'), 'Outdated BTN_LAUNCH_BOT_POLL button must be removed');
assert(!hostContent.includes('BTN_GROUP_TOURNAMENT'), 'Outdated BTN_GROUP_TOURNAMENT button must be removed');
assert(hostContent.includes('handleLaunchGroupBattle') || hostContent.includes('createLiveRoom'), 'GroupHostView must launch unified group live room');

// 2. Verify App.jsx handles battle_ deep link
const appContent = fs.readFileSync('src/App.jsx', 'utf8');
assert(appContent.includes("startsWith('battle_')"), "App.jsx must parse start_param starting with 'battle_'");

// 3. Verify quizService exports fetchLiveQuestion and submitLiveAnswer
const serviceContent = fs.readFileSync('src/services/quizService.js', 'utf8');
assert(serviceContent.includes('fetchLiveQuestion'), 'quizService must export fetchLiveQuestion');
assert(serviceContent.includes('submitLiveAnswer'), 'quizService must export submitLiveAnswer');

console.log('Task 4 test assertions verified successfully!');

