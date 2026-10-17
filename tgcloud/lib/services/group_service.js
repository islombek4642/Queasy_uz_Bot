// tgcloud/lib/services/group_service.js
// Connected groups registry and monitoring

import { db } from 'sdk';
import { eq, desc } from 'sdk/db';
import { groups } from '../../schema.js';
import { CONFIG } from '../constants/config.js';
import turso from '../turso_client.js';

export async function upsertGroup(groupId, title, username = null) {
  if (!groupId) return;
  const numId = Number(groupId);

  if (CONFIG.TURSO?.ENABLED) {
    try {
      await turso.run(
        'INSERT INTO "groups" (group_id, title, username, is_active, created_at) VALUES (?, ?, ?, 1, unixepoch()) ON CONFLICT(group_id) DO UPDATE SET title = excluded.title, username = excluded.username, is_active = 1',
        [numId, title, username]
      );
      return;
    } catch (err) {
      console.warn('[group_service] Turso upsertGroup fallback to local db:', err.message);
    }
  }

  const existing = await db
    .select()
    .from(groups)
    .where(eq(groups.groupId, numId))
    .get();


  if (existing) {
    await db
      .update(groups)
      .set({
        title,
        username,
        isActive: true,
      })
      .where(eq(groups.groupId, numId))
      .run();
  } else {
    await db
      .insert(groups)
      .values({
        groupId: numId,
        title,
        username,
        isActive: true,
      })
      .run();
  }

  // Telegram converts a basic group into a supergroup when the bot is promoted to admin.
  // Supergroup IDs start with '-100'. When a supergroup is upserted, deactivate any older
  // basic group duplicate that shares the same title or migrated ID suffix.
  const idStr = String(numId);
  if (idStr.startsWith('-100')) {
    const allActive = await db
      .select()
      .from(groups)
      .where(eq(groups.isActive, true))
      .all();

    const expectedOldId = '-' + idStr.slice(4);
    for (const g of allActive) {
      const gIdStr = String(g.groupId);
      if (!gIdStr.startsWith('-100')) {
        if (g.title === title || gIdStr === expectedOldId) {
          await db
            .update(groups)
            .set({ isActive: false })
            .where(eq(groups.groupId, g.groupId))
            .run();
        }
      }
    }
  }
}

export async function getGroup(groupId) {
  if (!groupId) return null;
  const numId = Number(groupId);

  if (CONFIG.TURSO?.ENABLED) {
    try {
      const g = await turso.get('SELECT * FROM "groups" WHERE group_id = ?', [numId]);
      if (g) {
        return {
          groupId: Number(g.group_id),
          title: g.title,
          username: g.username,
          isActive: Boolean(g.is_active),
          createdAt: g.created_at,
        };
      }
      return null;
    } catch (err) {
      console.warn('[group_service] Turso getGroup fallback to local db:', err.message);
    }
  }

  return await db
    .select()
    .from(groups)
    .where(eq(groups.groupId, numId))
    .get();
}

export async function deactivateGroup(groupId) {
  if (!groupId) return;
  const numId = Number(groupId);

  if (CONFIG.TURSO?.ENABLED) {
    try {
      await turso.run('UPDATE "groups" SET is_active = 0 WHERE group_id = ?', [numId]);
      return;
    } catch (err) {
      console.warn('[group_service] Turso deactivateGroup fallback to local db:', err.message);
    }
  }

  await db
    .update(groups)
    .set({ isActive: false })
    .where(eq(groups.groupId, numId))
    .run();
}

/**
 * Helper to deduplicate active groups so that basic groups upgraded to supergroups
 * never show up twice in the listing even if historical rows remain.
 */
function deduplicateGroups(allActiveList) {
  const supergroupTitles = new Set();
  const supergroupIdSuffixes = new Set();

  for (const g of allActiveList) {
    const s = String(g.groupId);
    if (s.startsWith('-100')) {
      supergroupTitles.add(g.title);
      supergroupIdSuffixes.add('-' + s.slice(4));
    }
  }

  return allActiveList.filter((g) => {
    const s = String(g.groupId);
    if (!s.startsWith('-100')) {
      if (supergroupTitles.has(g.title) || supergroupIdSuffixes.has(s)) {
        return false;
      }
    }
    return true;
  });
}

export async function getGroupsCount() {
  if (CONFIG.TURSO?.ENABLED) {
    try {
      const allActive = await turso.all('SELECT group_id, title FROM "groups" WHERE is_active = 1');
      return deduplicateGroups((allActive || []).map(g => ({ groupId: g.group_id, title: g.title }))).length;
    } catch (err) {
      console.warn('[group_service] Turso getGroupsCount fallback to local db:', err.message);
    }
  }

  const allActive = await db
    .select()
    .from(groups)
    .where(eq(groups.isActive, true))
    .all();

  return deduplicateGroups(allActive).length;
}

export async function listGroups(page = 0, pageSize = CONFIG.PAGINATION.GROUPS || 20) {
  const actualPageSize = pageSize > 0 ? pageSize : 20;
  const offset = page * actualPageSize;

  if (CONFIG.TURSO?.ENABLED) {
    try {
      const allActive = await turso.all('SELECT group_id, title, username, is_active, created_at FROM "groups" WHERE is_active = 1 ORDER BY created_at DESC');
      const formatted = (allActive || []).map(g => ({
        groupId: Number(g.group_id),
        title: g.title,
        username: g.username,
        isActive: Boolean(g.is_active),
        createdAt: g.created_at,
      }));
      const deduplicated = deduplicateGroups(formatted);
      return deduplicated.slice(offset, offset + actualPageSize);
    } catch (err) {
      console.warn('[group_service] Turso listGroups fallback to local db:', err.message);
    }
  }

  const allActive = await db
    .select()
    .from(groups)
    .where(eq(groups.isActive, true))
    .orderBy(desc(groups.createdAt))
    .all();

  const deduplicated = deduplicateGroups(allActive);
  return deduplicated.slice(offset, offset + actualPageSize);
}

export default {
  upsertGroup,
  deactivateGroup,
  getGroup,
  getGroupsCount,
  listGroups,
};

