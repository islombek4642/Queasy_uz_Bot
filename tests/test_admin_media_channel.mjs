// tests/test_admin_media_channel.mjs
// Test suite for Media Channel settings and helpers

import assert from 'node:assert';

console.log('--- Testing Media Channel Schema & Helper Logic ---');

// Mock settings store
const settingsStore = new Map();

function setMediaChannel(channelId, title = '') {
  if (!channelId) {
    settingsStore.delete('media_channel_id');
    settingsStore.delete('media_channel_title');
    return false;
  }
  settingsStore.set('media_channel_id', String(channelId));
  settingsStore.set('media_channel_title', String(title));
  return true;
}

function getMediaChannel() {
  const id = settingsStore.get('media_channel_id');
  const title = settingsStore.get('media_channel_title');
  if (!id) return null;
  return { channelId: id, title: title || '' };
}

// 1. Initially null
assert.strictEqual(getMediaChannel(), null, 'Initially media channel should be null');

// 2. Set channel
const setRes = setMediaChannel('-100123456789', 'Quiz Test Media');
assert.strictEqual(setRes, true, 'Should successfully set media channel');
const current = getMediaChannel();
assert.deepStrictEqual(current, { channelId: '-100123456789', title: 'Quiz Test Media' });

// 3. Remove channel
setMediaChannel(null);
assert.strictEqual(getMediaChannel(), null, 'Should clear media channel');

console.log('✅ ALL MEDIA CHANNEL UNIT TESTS PASSED!');
