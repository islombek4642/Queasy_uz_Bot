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
      .limit(30)
      .all();

    const formattedMistakes = (rawMistakes || []).map((m) => {
      let parsedOptions = [];
      try {
        parsedOptions = JSON.parse(m.optionsJson);
      } catch {
        parsedOptions = ['Variant A', 'Variant B'];
      }

      return {
        id: m.id,
        questionText: m.questionText,
        options: parsedOptions,
        correctOptionId: m.correctOptionId,
        explanation: m.explanation || null,
        photoFileId: m.photoFileId || null,
        originalQuizId: m.originalQuizId || null,
      };
    });

    return {
      mistakes: formattedMistakes,
      count: formattedMistakes.length,
    };
  } catch (err) {
    console.error('get_user_mistakes error:', err);
    return { mistakes: [], count: 0 };
  }
}
