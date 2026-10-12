// tgcloud/endpoints/get_user_mistakes.js
import { db } from 'sdk';
import { eq, desc } from 'sdk/db';
import { userMistakes, quizzes } from '../schema.js';

export default async function (input, ctx) {
  const currentUserId = ctx?.initData?.user?.id;
  if (!currentUserId) {
    return { mistakes: [], count: 0, grouped: [] };
  }

  try {
    const rawMistakes = await db
      .select()
      .from(userMistakes)
      .where(eq(userMistakes.userId, currentUserId))
      .orderBy(desc(userMistakes.id))
      .limit(100)
      .all();

    if (!rawMistakes || rawMistakes.length === 0) {
      return { mistakes: [], count: 0, grouped: [] };
    }

    // 1. Fetch titles for all originalQuizIds
    const quizIds = [...new Set(rawMistakes.map((m) => m.originalQuizId).filter((id) => Boolean(id) && id > 0))];
    const quizMap = new Map();

    for (const qId of quizIds) {
      try {
        const qRow = await db.select().from(quizzes).where(eq(quizzes.id, qId)).get();
        if (qRow) {
          quizMap.set(qId, {
            title: qRow.title || 'Nomsiz test',
            category: qRow.category || '',
          });
        }
      } catch {}
    }

    // 2. Deduplicate mistakes by questionText
    const seen = new Set();
    const formattedMistakes = [];

    for (const m of rawMistakes) {
      const qText = String(m.questionText || '').trim();
      if (!qText || seen.has(qText)) continue;
      seen.add(qText);

      let parsedOptions = [];
      try {
        parsedOptions = JSON.parse(m.optionsJson);
      } catch {
        parsedOptions = ['Variant A', 'Variant B'];
      }

      const quizInfo = m.originalQuizId ? quizMap.get(m.originalQuizId) : null;
      formattedMistakes.push({
        id: m.id,
        mistakeId: m.id,
        questionText: m.questionText,
        options: parsedOptions,
        correctOptionId: m.correctOptionId,
        explanation: m.explanation || null,
        photoFileId: m.photoFileId || null,
        originalQuizId: m.originalQuizId || null,
        quizTitle: quizInfo?.title || 'Umumiy testlar',
        category: quizInfo?.category || '',
      });
    }

    // 3. Group mistakes by subject (originalQuizId)
    const groupsMap = new Map();
    for (const item of formattedMistakes) {
      const key = item.originalQuizId || 0;
      if (!groupsMap.has(key)) {
        groupsMap.set(key, {
          quizId: key,
          title: item.quizTitle,
          category: item.category,
          count: 0,
          mistakes: [],
        });
      }
      const grp = groupsMap.get(key);
      grp.count += 1;
      grp.mistakes.push(item);
    }

    const grouped = Array.from(groupsMap.values()).sort((a, b) => b.count - a.count);

    return {
      mistakes: formattedMistakes,
      count: formattedMistakes.length,
      grouped,
    };
  } catch (err) {
    console.error('get_user_mistakes error:', err);
    return { mistakes: [], count: 0, grouped: [] };
  }
}
