// tgcloud/handlers/poll.js
// Handles all incoming Telegram Poll status updates (e.g. poll closed when open_period timer expires)

import { api } from 'sdk';
import { advanceGroupRoundByPollId, logAppError } from '../lib/services/session_service.js';

export default async function (poll, ctx) {
  const p = poll?.id ? poll : (poll?.poll || ctx?.update?.poll);
  if (!p || !p.id) return;

  // We only react when the poll is closed (e.g., time limit expired or admin closed)
  if (!p.is_closed) return;

  console.log(`[handlers/poll] Poll closed event received for pollId=${p.id}`);
  try {
    await advanceGroupRoundByPollId(api, String(p.id));
  } catch (err) {
    console.error(`Error advancing group round on poll close (${p.id}):`, err);
    await logAppError('handlers/poll', err?.message || String(err), { stack: err?.stack, pollId: p.id });
  }
}
