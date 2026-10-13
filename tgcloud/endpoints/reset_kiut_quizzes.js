// tgcloud/endpoints/reset_kiut_quizzes.js
import { db } from 'sdk';
import { eq, inArray } from 'sdk/db';
import { quizzes, questions } from '../schema.js';
import { isUserAdmin } from '../lib/services/admin_service.js';

export default async function (input, ctx) {
  const callerId = ctx?.initData?.user?.id;
  const isAuthorizedAdmin = callerId && isUserAdmin(callerId);

  if (!isAuthorizedAdmin) {
    return { success: false, error: 'UNAUTHORIZED_ADMIN_ONLY' };
  }

  const limit = Math.min(Number(input?.limit) || 20, 30);

  // 1. Find batch of quizzes where ownerId == 0
  const kiutQuizzes = await db
    .select({ id: quizzes.id })
    .from(quizzes)
    .where(eq(quizzes.ownerId, 0))
    .limit(limit)
    .all();

  const ids = kiutQuizzes.map((q) => q.id);

  if (ids.length > 0) {
    await db.delete(questions).where(inArray(questions.quizId, ids)).run();
    await db.delete(quizzes).where(inArray(quizzes.id, ids)).run();
  }

  return { success: true, deletedCount: ids.length, hasMore: ids.length === limit };
}
