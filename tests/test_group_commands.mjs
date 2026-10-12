// tests/test_group_commands.mjs
import assert from 'assert';

const parseGroupCmd = (msgText, targetBotName) => {
  if (!msgText || !msgText.startsWith('/')) return null;
  const match = msgText.trim().match(/^\/([a-zA-Z0-9_]+)(?:@([a-zA-Z0-9_]+))?(?:\s+([\s\S]*))?$/);
  if (!match) return null;
  const [, command, targetBot, rest] = match;
  if (targetBot && targetBot.toLowerCase() !== targetBotName.toLowerCase()) {
    return null;
  }
  return {
    command: command.toLowerCase(),
    argsStr: rest ? rest.trim() : '',
  };
};

const bot = 'queasy_uz_bot';

// 1. /quiz
const cmdQuiz = parseGroupCmd('/quiz', bot);
assert.strictEqual(cmdQuiz.command, 'quiz');
assert.strictEqual(cmdQuiz.argsStr, '');

// 2. /quiz 3
const cmdQuizId = parseGroupCmd('/quiz 3', bot);
assert.strictEqual(cmdQuizId.command, 'quiz');
assert.strictEqual(cmdQuizId.argsStr, '3');

// 3. /quiz_stats
const cmdQuizStats = parseGroupCmd('/quiz_stats', bot);
assert.strictEqual(cmdQuizStats.command, 'quiz_stats');
assert.notStrictEqual(cmdQuizStats.command, 'quiz');

// 4. /quiz_help
const cmdQuizHelp = parseGroupCmd('/quiz_help', bot);
assert.strictEqual(cmdQuizHelp.command, 'quiz_help');
assert.notStrictEqual(cmdQuizHelp.command, 'quiz');

// 5. /stop_quiz
const cmdStop = parseGroupCmd('/stop_quiz', bot);
assert.strictEqual(cmdStop.command, 'stop_quiz');

// 6. /create_quiz
const cmdCreate = parseGroupCmd('/create_quiz', bot);
assert.strictEqual(cmdCreate.command, 'create_quiz');

// 7. /quiz_stats@Queasy_uz_Bot
const cmdBotDirected = parseGroupCmd('/quiz_stats@Queasy_uz_Bot', bot);
assert.strictEqual(cmdBotDirected.command, 'quiz_stats');

// 8. Other bot command should be ignored
const cmdOther = parseGroupCmd('/quiz_stats@other_bot', bot);
assert.strictEqual(cmdOther, null);

console.log('✅ All group command parsing tests passed perfectly!');
