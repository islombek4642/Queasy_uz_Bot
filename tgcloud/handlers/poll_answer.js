// tgcloud/handlers/poll_answer.js
// Handles all incoming Telegram quiz poll answers (Solo & Group multiplayer)

import { api } from 'sdk';
import { handlePollAnswer, logAppError } from '../lib/services/session_service.js';

export default async function (pollAnswer, ctx) {
  if (!pollAnswer || !pollAnswer.poll_id) return;

  try {
    console.log(`[handlers/poll_answer] Poll answer received for pollId=${pollAnswer.poll_id}, user=${pollAnswer.user?.id}`);
    await handlePollAnswer(api, pollAnswer);
  } catch (err) {
    console.error('Error handling poll answer:', err);
    await logAppError('handlers/poll_answer', err?.message || String(err), { stack: err?.stack, pollAnswer });
  }
}
