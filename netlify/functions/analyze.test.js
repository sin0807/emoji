const test = require('node:test');
const assert = require('node:assert');
const { parseMoodResponse } = require('./analyze');

test('解析标准 JSON', () => {
  const result = parseMoodResponse('{"mood":"happy","reply":"太棒了，继续保持！"}');
  assert.deepStrictEqual(result, { mood: 'happy', reply: '太棒了，继续保持！' });
});

test('剥掉 markdown 代码块', () => {
  const result = parseMoodResponse(
    '```json\n{"mood":"sad","reply":"抱抱你，一切都会好起来的"}\n```'
  );
  assert.strictEqual(result.mood, 'sad');
});

test('回复里包含花括号也能解析', () => {
  const content = '好的，这是结果：{"mood":"normal","reply":"今天有点累吧？{记得休息}"}';
  const result = parseMoodResponse(content);
  assert.strictEqual(result.reply, '今天有点累吧？{记得休息}');
});

test('情绪不在枚举里则返回 null', () => {
  const result = parseMoodResponse('{"mood":"angry","reply":"hi"}');
  assert.strictEqual(result, null);
});

test('完全不是 JSON 则返回 null', () => {
  const result = parseMoodResponse('对不起，我不能回答这个问题');
  assert.strictEqual(result, null);
});
