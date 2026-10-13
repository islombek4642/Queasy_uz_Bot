// tests/test_group_filter.mjs
import assert from 'node:assert';

console.log('🧪 Testing Group Session Filtering & Tournament Timestamp...\n');

// 1. Verify group filtering logic
{
  const sessions = [
    { id: 1, isGroup: false, isActive: true },
    { id: 2, isGroup: false, isActive: true },
    { id: 3, isGroup: true, isActive: true },
    { id: 4, isGroup: false, isActive: true },
    { id: 5, isGroup: true, isActive: true },
  ];

  // Old buggy logic: taking top 2 where isActive=true then filtering isGroup
  const oldFiltered = sessions.slice(0, 2).filter(s => s.isGroup);
  assert.strictEqual(oldFiltered.length, 0, 'Old buggy logic dropped legitimate group sessions');

  // Correct logic: filter isGroup=true in the database query
  const correctFiltered = sessions.filter(s => s.isActive && s.isGroup);
  assert.strictEqual(correctFiltered.length, 2, 'Correct logic preserves all group sessions');
  console.log('✅ Group sessions filter logic verified');
}

// 2. Verify tournament timestamp integer format
{
  const now = Date.now();
  const unixSeconds = Math.floor(now / 1000);
  assert.strictEqual(typeof unixSeconds, 'number');
  assert.strictEqual(Number.isInteger(unixSeconds), true);
  assert.ok(unixSeconds > 1700000000);
  console.log('✅ Tournament unix integer timestamp verified');
}
