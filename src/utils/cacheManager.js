// src/utils/cacheManager.js
// Ultra-fast LocalStorage caching with Stale-While-Revalidate (SWR) support

export const CACHE_KEYS = {
  INITIAL_DATA: 'queasy_cache_initial_data',
  KIUT_ROOT: 'queasy_cache_kiut_root',
  LEADERBOARD_PREFIX: 'queasy_cache_leaderboard_',
  MISTAKES: 'queasy_cache_mistakes',
  MY_QUIZZES: 'queasy_cache_my_quizzes',
};

/**
 * Retrieve cached data synchronously for instantaneous 0ms UI render
 * @param {string} key - Cache storage key
 * @param {number} maxAgeMs - Maximum validity duration in milliseconds (default: 48 hours)
 */
export function getCachedData(key, maxAgeMs = 48 * 60 * 60 * 1000) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && 'data' in parsed && 'ts' in parsed) {
      if (maxAgeMs > 0 && Date.now() - parsed.ts > maxAgeMs) {
        return null; // Expired cache
      }
      return parsed.data;
    }
    return parsed;
  } catch (err) {
    return null;
  }
}

/**
 * Save data to persistent cache with timestamp
 * @param {string} key - Cache storage key
 * @param {any} data - Data payload to store
 */
export function setCachedData(key, data) {
  try {
    if (data === null || data === undefined) return;
    localStorage.setItem(key, JSON.stringify({
      data,
      ts: Date.now()
    }));
  } catch (err) {
    // Fail-safe for storage quotas
    console.warn('[CacheManager] Quota exceeded or storage unavailable');
  }
}

/**
 * Invalidate a specific cache key
 * @param {string} key 
 */
export function removeCachedData(key) {
  try {
    localStorage.removeItem(key);
  } catch (err) {}
}
