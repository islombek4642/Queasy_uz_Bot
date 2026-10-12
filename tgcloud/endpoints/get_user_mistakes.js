// tgcloud/endpoints/get_user_mistakes.js
import { db } from 'sdk';
import { eq, desc } from 'sdk/db';
import { userMistakes } from '../schema.js';

export default async function (input, ctx) {
  const currentUserId = ctx?.initData?.user?.id;
  if (!currentUserId) {
    return { mistakes: [], count: 0 };
  }

  try {
    const rawMistakes = await db
      .select()
      .from(userMistakes)
      .where(eq(userMistakes.userId, currentUserId))
      .orderBy(desc(userMistakes.id))
      .limit(60)
      .all();

    // Deduplicate mistakes by questionText
    const seen = new Set();
    const formattedMistakes = [];

    for (const m of (rawMistakes || [])) {
      const qText = String(m.questionText || '').trim();
      if (!qText || seen.has(qText)) continue;
      seen.add(qText);

      let parsedOptions = [];
      try {
        parsedOptions = JSON.parse(m.optionsJson);
      } catch {
        parsedOptions = ['Variant A', 'Variant B'];
      }

      formattedMistakes.push({
        id: m.id,
        mistakeId: m.id,
        questionText: m.questionText,
        options: parsedOptions,
        correctOptionId: m.correctOptionId,
        explanation: m.explanation || null,
        photoFileId: m.photoFileId || null,
        originalQuizId: m.originalQuizId || null,
      });

      if (formattedMistakes.length >= 30) break;
    }

    return {
      mistakes: formattedMistakes,
      count: formattedMistakes.length,
    };
  } catch (err) {
    console.error('get_user_mistakes error:', err);
    return { mistakes: [], count: 0 };
  }
}
