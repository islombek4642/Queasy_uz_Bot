// tests/test_poll_truncation_formatting.mjs
import assert from 'node:assert';
import { truncateQuestion, truncateOption, truncateExplanation } from '../tgcloud/lib/utils/poll_helpers.js';

console.log('Testing Poll Truncation Helpers...');

// 1. Question normal length
{
  const q = truncateQuestion('[1/10]', 'Bu oddiy savol?');
  assert.strictEqual(q, '[1/10] Bu oddiy savol?');
}

// 2. Question exceeding 300 chars ending with '?'
{
  const longText = 'A'.repeat(350) + '?';
  const truncated = truncateQuestion('[1/10]', longText, 300);
  assert.strictEqual(truncated.length <= 300, true);
  assert.strictEqual(truncated.endsWith('...?'), true);
}

// 3. Question exceeding 300 chars not ending with '?'
{
  const longText = 'B'.repeat(350);
  const truncated = truncateQuestion('[1/10]', longText, 300);
  assert.strictEqual(truncated.length <= 300, true);
  assert.strictEqual(truncated.endsWith('...'), true);
  assert.strictEqual(truncated.endsWith('...?'), false);
}

// 4. Option normal length
{
  const opt = truncateOption('Variant A');
  assert.strictEqual(opt, 'Variant A');
}

// 5. Option exceeding 100 chars
{
  const longOpt = 'C'.repeat(120);
  const truncated = truncateOption(longOpt, 100);
  assert.strictEqual(truncated.length, 100);
  assert.strictEqual(truncated.endsWith('...'), true);
}

// 6. Explanation truncation (200 chars)
{
  assert.strictEqual(truncateExplanation(null), undefined);
  assert.strictEqual(truncateExplanation(''), undefined);
  const normalExp = 'To\'g\'ri javob shuki...';
  assert.strictEqual(truncateExplanation(normalExp), normalExp);

  const longExp = 'E'.repeat(250);
  const truncated = truncateExplanation(longExp, 200);
  assert.strictEqual(truncated.length, 200);
  assert.strictEqual(truncated.endsWith('...'), true);
}

// 7. Participant name formatting with links
{
  import('../tgcloud/lib/utils/poll_helpers.js').then(({ formatParticipantName }) => {
    // With username
    const formattedWithUser = formatParticipantName('Islombek Xamidullayev', 8756078762, 'islombek_dev');
    assert.strictEqual(formattedWithUser.includes('href="https://t.me/islombek_dev"'), true);
    assert.strictEqual(formattedWithUser.includes('(@islombek_dev)'), true);

    // Without username (ID only)
    const formattedIdOnly = formatParticipantName('Islombek Xamidullayev', 8756078762, null);
    assert.strictEqual(formattedIdOnly.includes('href="tg://user?id=8756078762"'), true);
  });
}

console.log('✅ All Poll Truncation tests passed successfully!');
