// tests/test_leaderboard.mjs
import assert from 'node:assert';

console.log('🧪 Testing Leaderboard Aggregation & Timeframe Filter...\n');

// 1. Timeframe threshold calculation
function getTimeframeThreshold(timeframe) {
  const now = Math.floor(Date.now() / 1000);
  switch (timeframe) {
    case 'today':
      return now - 86400;
    case 'week':
      return now - 7 * 86400;
    case 'month':
      return now - 30 * 86400;
    case 'all':
    default:
      return 0;
  }
}

const nowSec = Math.floor(Date.now() / 1000);
assert.ok(getTimeframeThreshold('today') > nowSec - 90000);
assert.ok(getTimeframeThreshold('week') > nowSec - 700000);
assert.strictEqual(getTimeframeThreshold('all'), 0);
console.log('✅ Timeframe thresholds verified');

// 2. Aggregate XP ranking logic
const mockSessions = [
  { userId: 101, correctCount: 8, wrongCount: 2, isActive: false, startedAt: nowSec - 100 },
  { userId: 102, correctCount: 15, wrongCount: 0, isActive: false, startedAt: nowSec - 200 },
  { userId: 101, correctCount: 5, wrongCount: 1, isActive: false, startedAt: nowSec - 300 },
  { userId: 103, correctCount: 2, wrongCount: 3, isActive: false, startedAt: nowSec - 500 },
];

function aggregateUserXP(sessions) {
  const map = new Map();
  for (const s of sessions) {
    if (s.isActive) continue;
    if (!map.has(s.userId)) {
      map.set(s.userId, { userId: s.userId, totalCorrect: 0, totalAnswered: 0, count: 0 });
    }
    const cur = map.get(s.userId);
    cur.totalCorrect += s.correctCount || 0;
    cur.totalAnswered += (s.correctCount || 0) + (s.wrongCount || 0);
    cur.count += 1;
  }

  const results = Array.from(map.values()).map(u => ({
    userId: u.userId,
    xp: u.totalCorrect * 10,
    accuracy: u.totalAnswered > 0 ? Math.round((u.totalCorrect / u.totalAnswered) * 100) : 0,
    solvedCount: u.count,
  }));

  results.sort((a, b) => b.xp - a.xp);
  return results;
}

const ranked = aggregateUserXP(mockSessions);
assert.strictEqual(ranked[0].userId, 102, 'User 102 should be 1st with 150 XP');
assert.strictEqual(ranked[0].xp, 150);
assert.strictEqual(ranked[1].userId, 101, 'User 101 should be 2nd with 130 XP');
assert.strictEqual(ranked[1].xp, 130);
assert.strictEqual(ranked[2].userId, 103, 'User 103 should be 3rd with 20 XP');
assert.strictEqual(ranked[2].xp, 20);
console.log('✅ Aggregate XP sorting verified');
