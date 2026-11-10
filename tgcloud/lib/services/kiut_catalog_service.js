// tgcloud/lib/services/kiut_catalog_service.js
// Ultra-fast in-memory tree & category navigation for KIUT Tests Center

import { db } from 'sdk';
import { eq, like, and } from 'sdk/db';
import { categories as categoriesTable, quizzes as quizzesTable } from '../../schema.js';
import { CONFIG } from '../constants/config.js';
import turso from '../turso_client.js';

let kiutCache = null;
let kiutCacheTime = 0;
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

export function invalidateKiutCatalogCache() {
  kiutCache = null;
  kiutCacheTime = 0;
}

export async function loadKiutTree() {
  const now = Date.now();
  if (kiutCache && (now - kiutCacheTime < CACHE_TTL)) {
    return kiutCache;
  }

  let categories = [];
  let quizzes = [];

  if (CONFIG.TURSO?.ENABLED) {
    try {
      const [cats, qzs] = await Promise.all([
        turso.all('SELECT id, path FROM categories'),
        turso.all('SELECT id, title, category FROM quizzes WHERE is_public = 1'),
      ]);
      categories = cats || [];
      quizzes = qzs || [];
    } catch (err) {
      console.warn('[kiut_catalog_service] Turso loadKiutTree fallback to local db:', err.message);
    }
  }

  if (categories.length === 0) {
    categories = await db.select({ id: categoriesTable.id, path: categoriesTable.path }).from(categoriesTable).all();
  }
  if (quizzes.length === 0) {
    quizzes = await db
      .select({ id: quizzesTable.id, title: quizzesTable.title, category: quizzesTable.category })
      .from(quizzesTable)
      .where(eq(quizzesTable.isPublic, true))
      .all();
  }

  const categoriesById = new Map();
  const categoriesByPath = new Map();
  for (const c of categories) {
    const id = Number(c.id);
    categoriesById.set(id, c.path);
    categoriesByPath.set(c.path, id);
  }

  const quizzesByCategory = new Map();
  for (const q of quizzes) {
    if (!q.category) continue;
    let list = quizzesByCategory.get(q.category);
    if (!list) {
      list = [];
      quizzesByCategory.set(q.category, list);
    }
    list.push({ id: Number(q.id), title: q.title });
  }

  // Pre-sort direct quizzes naturally
  for (const list of quizzesByCategory.values()) {
    list.sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' }));
  }

  kiutCache = {
    categories,
    categoriesById,
    categoriesByPath,
    quizzesByCategory,
  };
  kiutCacheTime = now;
  return kiutCache;
}

export async function getKiutCategoryView(catId) {
  const tree = await loadKiutTree();

  if (catId === 0) {
    return {
      isRoot: true,
      catPath: '',
      subList: [],
      directQuizzes: [],
      parentId: 0,
    };
  }

  const catPath = tree.categoriesById.get(Number(catId));
  if (!catPath) {
    return null;
  }

  const prefix = `${catPath} /`;
  const subMap = new Map();

  for (const c of tree.categories) {
    if (c.path.startsWith(prefix)) {
      const remainder = c.path.slice(prefix.length).trim();
      const nextSeg = remainder.split(' / ')[0].trim();
      if (nextSeg && !subMap.has(nextSeg)) {
        const fullNextPath = `${catPath} / ${nextSeg}`;
        const childId = tree.categoriesByPath.get(fullNextPath);
        if (childId) {
          subMap.set(nextSeg, childId);
        }
      }
    }
  }

  // Naturally sort subcategories (e.g. 1-SEMESTR, 2-SEMESTR, ... 10-SEMESTR)
  const sortedSubList = Array.from(subMap.entries()).sort(([a], [b]) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
  );

  const directQuizzes = (tree.quizzesByCategory.get(catPath) || []).slice(0, 60);

  // Find parent ID
  const pathParts = catPath.split(' / ');
  pathParts.pop();
  const parentPath = pathParts.join(' / ');
  const parentId = parentPath ? (tree.categoriesByPath.get(parentPath) || 0) : 0;

  return {
    isRoot: false,
    catPath,
    subList: sortedSubList,
    directQuizzes,
    parentId,
  };
}

export function findCategoryIdByPath(path) {
  if (!kiutCache || !path) return 0;
  return kiutCache.categoriesByPath.get(path) || 0;
}

export default {
  loadKiutTree,
  getKiutCategoryView,
  findCategoryIdByPath,
  invalidateKiutCatalogCache,
};
