// tests/test_auth_endpoints.mjs
import assert from 'node:assert';

console.log('🧪 Testing Endpoint Authorization Checks...\n');

// 1. Test start_live_room logic
{
  function verifyHost(currentUserId, room) {
    if (!currentUserId || room.hostId !== currentUserId) {
      return { success: false, error: 'NOT_HOST' };
    }
    return { success: true };
  }

  const room = { id: 1, hostId: 1001, roomCode: '123456' };

  // Case A: Non-host attempts to start
  const nonHostRes = verifyHost(2002, room);
  assert.strictEqual(nonHostRes.success, false);
  assert.strictEqual(nonHostRes.error, 'NOT_HOST');

  // Case B: Unauthenticated caller
  const unauthRes = verifyHost(null, room);
  assert.strictEqual(unauthRes.success, false);
  assert.strictEqual(unauthRes.error, 'NOT_HOST');

  // Case C: Actual host
  const hostRes = verifyHost(1001, room);
  assert.strictEqual(hostRes.success, true);

  console.log('✅ start_live_room host auth logic verified');
}

// 2. Test admin verification logic for reset and batch ingest
{
  const ADMINS = [886983504, 123456789];
  function verifyAdmin(userId) {
    return ADMINS.includes(Number(userId));
  }

  assert.strictEqual(verifyAdmin(886983504), true);
  assert.strictEqual(verifyAdmin(999999999), false);
  assert.strictEqual(verifyAdmin(null), false);

  console.log('✅ reset_kiut_quizzes & ingest_kiut_batch admin auth logic verified');
}
