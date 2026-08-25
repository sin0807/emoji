const test = require('node:test');
const assert = require('node:assert');
const { handler, parseMoodResponse } = require('../netlify/functions/analyze');

// handler 会先检查 DEEPSEEK_API_KEY 是否存在，测试环境里没有真实密钥，
// 所以先塞一个假值，让它走完整个流程（真实请求已被 mock 拦截，不会真的花钱）。
process.env.DEEPSEEK_API_KEY = 'test-key';

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

// ---------- 以下是接口级（handler）测试：模拟 DeepSeek 的返回 ----------

function mockFetchResponse(status, body) {
  global.fetch = async () =>
    new Response(typeof body === 'string' ? body : JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' }
    });
}

function callHandler(body = { text: '今天很开心' }, ip = '10.0.0.1') {
  return handler({
    httpMethod: 'POST',
    body: JSON.stringify(body),
    headers: { 'x-nf-client-connection-ip': ip }
  });
}

test('GET 请求被拒绝（405）', async () => {
  const res = await handler({ httpMethod: 'GET', body: null, headers: {} });
  assert.strictEqual(res.statusCode, 405);
});

test('正常请求返回情绪和回应', async () => {
  mockFetchResponse(200, {
    choices: [{ message: { content: '{"mood":"happy","reply":"太好了，继续保持！"}' } }]
  });
  const res = await callHandler({ text: '今天升职了' }, '10.0.0.2');
  assert.strictEqual(res.statusCode, 200);
  const data = JSON.parse(res.body);
  assert.strictEqual(data.mood, 'happy');
  assert.ok(data.reply.length > 0);
});

test('上游返回 5xx 时对用户返回 502', async () => {
  mockFetchResponse(500, 'upstream exploded');
  const res = await callHandler({ text: '今天有点累' }, '10.0.0.3');
  assert.strictEqual(res.statusCode, 502);
});

test('AI 返回无法解析的内容时返回 500', async () => {
  mockFetchResponse(200, { choices: [{ message: { content: '抱歉，我无法回答' } }] });
  const res = await callHandler({ text: '今天天气不错' }, '10.0.0.4');
  assert.strictEqual(res.statusCode, 500);
});

test('输入为空返回 400', async () => {
  const res = await callHandler({ text: '   ' }, '10.0.0.5');
  assert.strictEqual(res.statusCode, 400);
});

test('同一 IP 请求过快返回 429', async () => {
  mockFetchResponse(200, {
    choices: [{ message: { content: '{"mood":"normal","reply":"嗯，平平常常"}' } }]
  });
  for (let i = 0; i < 10; i++) {
    await callHandler({ text: `第${i}次` }, '10.0.0.9');
  }
  const res = await callHandler({ text: '第11次' }, '10.0.0.9');
  assert.strictEqual(res.statusCode, 429);
});
