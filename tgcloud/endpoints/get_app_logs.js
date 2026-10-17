import { db } from 'sdk';
import { sql } from 'sdk/db';
import turso from '../lib/turso_client.js';

export default async function (input, ctx) {
  const status = { ok: true, timestamp: Math.floor(Date.now() / 1000), turso: false };
  try {
    const tRes = await turso.get('SELECT count(*) as count FROM quizzes');
    status.turso = true;
    status.totalQuizzes = tRes?.count;
  } catch (err) {
    status.tursoError = err.message;
  }
  return status;
}















