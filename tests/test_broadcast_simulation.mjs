// tests/test_broadcast_simulation.mjs
import assert from 'node:assert';
import { broadcastMessage } from '../tgcloud/lib/services/admin_service.js';

async function testBroadcast() {
  console.log('🧪 Starting broadcastMessage test simulation...');

  // Mock API
  const sentMessages = [];
  const copiedMessages = [];

  const mockApi = {
    async sendMessage(params) {
      sentMessages.push(params);
      return { message_id: 1000 + sentMessages.length };
    },
    async copyMessage(params) {
      if (params.chat_id === 999999999) {
        const err = new Error('Forbidden: bot was blocked by the user');
        err.code = 403;
        throw err;
      }
      copiedMessages.push(params);
      return { message_id: 2000 + copiedMessages.length };
    }
  };

  // Test 1: broadcast text
  const payload1 = '<b>Yangi funksiya!</b> HTML test ishlash imkoniyati qo\'shildi.';
  console.log('  Testing string payload...');
  const res1 = await broadcastMessage(mockApi, payload1);
  assert(res1.total > 0, 'Should find users in Turso');
  assert(res1.success > 0, 'Should successfully send messages');
  console.log(`  ✅ String broadcast: total=${res1.total}, success=${res1.success}, fail=${res1.fail}`);

  // Test 2: broadcast copyMessage payload
  const payload2 = {
    fromChatId: 8826149564,
    messageId: 456
  };
  console.log('  Testing copyMessage payload...');
  const res2 = await broadcastMessage(mockApi, payload2);
  assert(res2.success > 0, 'Should successfully copy messages');
  console.log(`  ✅ CopyMessage broadcast: total=${res2.total}, success=${res2.success}, fail=${res2.fail}`);

  console.log('🎉 broadcastMessage simulation passed completely!');
}

testBroadcast().catch(err => {
  console.error('❌ Broadcast simulation failed:', err);
  process.exit(1);
});

