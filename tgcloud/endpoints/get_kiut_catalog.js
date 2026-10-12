// tgcloud/endpoints/get_kiut_catalog.js
import { db } from 'sdk';
import { eq, like, desc, and, or, sql } from 'sdk/db';
import { quizzes, questions } from '../schema.js';

export default async function (input, ctx) {
  try {
    const search = input?.search?.trim();
    const categoryPath = input?.categoryPath?.trim();

    // 1. Search Mode
    if (search && search.length >= 2) {
      const searchLower = search.toLowerCase();
      const matched = await db
        .select()
        .from(quizzes)
        .where(
          and(
            eq(quizzes.isPublic, true),
            sql`(lower(${quizzes.title}) LIKE ${'%' + searchLower + '%'} OR lower(${quizzes.category}) LIKE ${'%' + searchLower + '%'})`
          )
        )
        .limit(30)
        .all();

      const result = [];
      for (const q of matched) {
        const qCount = await db
          .select({ count: sql`count(*)` })
          .from(questions)
          .where(eq(questions.quizId, q.id))
          .get();

        result.push({
          id: q.id,
          title: q.title,
          category: q.category || '',
          timeLimit: q.timeLimit || 30,
          questionCount: Number(qCount?.count || 0),
        });
      }

      return {
        mode: 'search',
        search,
        quizzes: result,
      };
    }

    // 2. Fetch by Category Path
    if (categoryPath) {
      const prefix = `${categoryPath} / `;
      // Find all quizzes matching categoryPath exactly or starting with "categoryPath / "
      const matchingQuizzes = await db
        .select()
        .from(quizzes)
        .where(
          and(
            eq(quizzes.isPublic, true),
            or(
              eq(quizzes.category, categoryPath),
              like(quizzes.category, `${categoryPath} / %`)
            )
          )
        )
        .all();

      // Separate into subcategories vs quizzes directly under this level
      const subcategoriesMap = new Map();
      const directQuizzes = [];

      for (const q of matchingQuizzes) {
        const cat = q.category || '';
        if (cat === categoryPath) {
          // Direct quiz
          directQuizzes.push(q);
        } else if (cat.startsWith(prefix)) {
          const remainder = cat.slice(prefix.length).trim();
          const nextSegment = remainder.split(' / ')[0].trim();
          if (nextSegment) {
            subcategoriesMap.set(nextSegment, (subcategoriesMap.get(nextSegment) || 0) + 1);
          }
        }
      }

      // Format subcategories with natural numeric sorting (e.g. 1-SEMESTR, 2-SEMESTR, ...)
      const subcategories = Array.from(subcategoriesMap.entries())
        .map(([name, count]) => ({
          name,
          fullPath: `${categoryPath} / ${name}`,
          count,
        }))
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

      // Format direct quizzes with natural sorting
      const sortedDirectQuizzes = [...directQuizzes].sort((a, b) =>
        a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' })
      );

      const formattedQuizzes = [];
      for (const q of sortedDirectQuizzes.slice(0, 100)) {
        const qCount = await db
          .select({ count: sql`count(*)` })
          .from(questions)
          .where(eq(questions.quizId, q.id))
          .get();

        formattedQuizzes.push({
          id: q.id,
          title: q.title,
          category: q.category || '',
          timeLimit: q.timeLimit || 30,
          questionCount: Number(qCount?.count || 0),
        });
      }

      return {
        mode: 'category',
        categoryPath,
        subcategories,
        quizzes: formattedQuizzes,
      };
    }

    // 3. Top-Level Categories Overview
    const allPublic = await db
      .select({ category: quizzes.category })
      .from(quizzes)
      .where(eq(quizzes.isPublic, true))
      .all();

    const topMap = new Map([
      ["KUNDUZGI TA'LIM", 0],
      ["SIRTQI TA'LIM", 0],
      ["KECHKI TA'LIM", 0],
      ["MASOFAVIY TA'LIM", 0],
      ["FANLAR FARQI", 0],
      ["KUNDUZGI TA'LIM (TIBBIYOT)", 0],
    ]);

    for (const row of allPublic) {
      const topCat = (row.category || '').split(' / ')[0].trim();
      if (topCat) {
        topMap.set(topCat, (topMap.get(topCat) || 0) + 1);
      }
    }

    const categories = Array.from(topMap.entries()).map(([name, count]) => ({
      name,
      fullPath: name,
      count,
    }));

    return {
      mode: 'root',
      categories,
      totalQuizzes: allPublic.length,
    };
  } catch (error) {
    console.error('get_kiut_catalog error:', error);
    return {
      mode: 'root',
      categories: [
        { name: "KUNDUZGI TA'LIM", fullPath: "KUNDUZGI TA'LIM", count: 0 },
        { name: "SIRTQI TA'LIM", fullPath: "SIRTQI TA'LIM", count: 0 },
        { name: "KECHKI TA'LIM", fullPath: "KECHKI TA'LIM", count: 0 },
        { name: "MASOFAVIY TA'LIM", fullPath: "MASOFAVIY TA'LIM", count: 0 },
        { name: "FANLAR FARQI", fullPath: "FANLAR FARQI", count: 0 },
        { name: "KUNDUZGI TA'LIM (TIBBIYOT)", fullPath: "KUNDUZGI TA'LIM (TIBBIYOT)", count: 0 },
      ],
      totalQuizzes: 0,
      error: error.message,
    };
  }
}
