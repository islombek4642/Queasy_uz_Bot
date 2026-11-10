// tests/test_performance_and_caching.mjs
// Verifies in-memory caching and response acceleration across services

import assert from 'node:assert';
import { getRequiredChannels, invalidateChannelsCache } from '../tgcloud/lib/services/channel_service.js';
import { getOrCreateUser, getUser, getUserState, setUserState, clearUserState } from '../tgcloud/lib/services/user_service.js';
import { getKiutCategoryView, invalidateKiutCatalogCache } from '../tgcloud/lib/services/kiut_catalog_service.js';

async function testPerformanceAndCaching() {
  console.log('🧪 Starting test_performance_and_caching...');

  // 1. Channel caching
  invalidateChannelsCache();
  const t0 = performance.now();
  const ch1 = await getRequiredChannels();
  const dur1 = performance.now() - t0;

  const t1 = performance.now();
  const ch2 = await getRequiredChannels();
  const dur2 = performance.now() - t1;

  assert.deepStrictEqual(ch1, ch2, 'Channel list should match between cached and raw');
  assert(dur2 < 5, `Hot channel cache should resolve in <5ms, got ${dur2.toFixed(2)}ms`);
  console.log(`  ✅ Channel caching verified: Cold = ${dur1.toFixed(1)}ms, Hot = ${dur2.toFixed(3)}ms`);

  // 2. User & State caching
  const mockUser = {
    id: 999999999,
    first_name: 'TestSpeedUser',
    last_name: 'Speed',
    username: 'test_speed_user',
    language_code: 'uz',
  };

  const user = await getOrCreateUser(mockUser);
  assert(user, 'User should be created or retrieved');

  const ut0 = performance.now();
  const cachedUser = await getUser(mockUser.id);
  const userDur = performance.now() - ut0;
  assert.strictEqual(cachedUser.telegramId, mockUser.id);
  assert(userDur < 5, `User lookup from cache should take <5ms, got ${userDur.toFixed(2)}ms`);
  console.log(`  ✅ User profile cache verified: Hot lookup = ${userDur.toFixed(3)}ms`);

  await setUserState(mockUser.id, 'WAITING_TEST', { foo: 'bar' });
  const st0 = performance.now();
  const st = await getUserState(mockUser.id);
  const stateDur = performance.now() - st0;
  assert.strictEqual(st.state, 'WAITING_TEST');
  assert.strictEqual(st.data.foo, 'bar');
  assert(stateDur < 5, `User state cache lookup should take <5ms, got ${stateDur.toFixed(2)}ms`);
  console.log(`  ✅ User state cache verified: Hot lookup = ${stateDur.toFixed(3)}ms`);

  await clearUserState(mockUser.id);
  const clearedState = await getUserState(mockUser.id);
  assert.strictEqual(clearedState.state, 'IDLE');

  // 3. KIUT Catalog navigation caching
  invalidateKiutCatalogCache();
  const kt0 = performance.now();
  const rootMenu = await getKiutCategoryView(0);
  const rootDur = performance.now() - kt0;
  assert(rootMenu.isRoot, 'Cat 0 should be root menu');
  console.log(`  ✅ KIUT Tree init & root: ${rootDur.toFixed(1)}ms`);

  const kt1 = performance.now();
  const subMenu = await getKiutCategoryView(1); // Kunduzgi
  const subDur = performance.now() - kt1;
  assert(subMenu && !subMenu.isRoot, 'Cat 1 should be Kunduzgi view');
  assert(subDur < 10, `KIUT subcategory navigation should take <10ms, got ${subDur.toFixed(2)}ms`);
  console.log(`  ✅ KIUT subcategory view: ${subDur.toFixed(3)}ms`);

  console.log('🎉 test_performance_and_caching completed successfully!');
}

testPerformanceAndCaching().catch((err) => {
  console.error('❌ test_performance_and_caching failed:', err);
  process.exit(1);
});

