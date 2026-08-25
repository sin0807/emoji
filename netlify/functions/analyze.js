// Netlify Function：AI 情绪分析代理
// 浏览器里不能保存 API Key（任何人打开网页都能看到），
// 所以真实请求由这个 Serverless 函数转发给 DeepSeek，Key 只存在于服务器端。

const MAX_TEXT_LENGTH = 500; // 输入长度上限：防止恶意请求消耗大量 token
const RATE_LIMIT_MAX = 10; // 每个 IP 每分钟最多请求次数
const RATE_LIMIT_WINDOW_MS = 60 * 1000;

// 简单的内存限流表。注意：Serverless 可能同时跑多个实例，
// 每个实例各自维护这张表，所以它是“基础防护”，不是严格的全局限流。
const ipHits = new Map();

const SYSTEM_PROMPT = `你是一个温暖的心理陪伴助手。
用户会用一句话描述自己的心情，你需要：
1. 判断情绪：只允许 happy / normal / sad 三种
2. 用一句 30 字以内、温暖真诚的话回应
只输出一个 JSON 对象，不要输出任何其他内容，不要用 markdown 代码块，格式：
{"mood":"happy 或 normal 或 sad","reply":"你的回应"}`;

// 从模型返回的内容中提取 JSON 并校验。
// 写成纯函数（不依赖外部状态）是为了方便用 node --test 写单元测试。
function parseMoodResponse(content) {
  // 模型有时会自作主张包一层 ```json ... ```，先剥掉
  const cleaned = content
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  // 先尝试整体解析；失败再抓取第一个 { 到最后一个 } 之间的内容
  let result = null;
  try {
    result = JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        result = JSON.parse(match[0]);
      } catch {
        result = null;
      }
    }
  }

  if (!result || typeof result !== 'object') {
    return null;
  }

  const mood = String(result.mood || '').toLowerCase();
  if (!['happy', 'normal', 'sad'].includes(mood)) {
    return null;
  }

  return {
    mood,
    reply: String(result.reply || '').trim()
  };
}

function checkRateLimit(ip) {
  const now = Date.now();
  const hits = (ipHits.get(ip) || []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (hits.length >= RATE_LIMIT_MAX) {
    ipHits.set(ip, hits);
    return false;
  }
  hits.push(now);
  ipHits.set(ip, hits);
  return true;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  // Netlify 会把访客 IP 放在这个请求头里
  const ip =
    event.headers['x-nf-client-connection-ip'] ||
    event.headers['client-ip'] ||
    'unknown';
  if (!checkRateLimit(ip)) {
    return { statusCode: 429, body: JSON.stringify({ error: '请求太频繁，请稍后再试' }) };
  }

  const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
  if (!DEEPSEEK_API_KEY) {
    console.error('Missing DEEPSEEK_API_KEY env');
    return { statusCode: 500, body: JSON.stringify({ error: '服务端未配置 DEEPSEEK_API_KEY' }) };
  }

  let text;
  try {
    ({ text } = JSON.parse(event.body || '{}'));
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: '请求格式错误' }) };
  }

  text = (text || '').trim();
  if (!text) {
    return { statusCode: 400, body: JSON.stringify({ error: '请输入内容' }) };
  }
  if (text.length > MAX_TEXT_LENGTH) {
    return { statusCode: 400, body: JSON.stringify({ error: `内容过长，最多 ${MAX_TEXT_LENGTH} 字` }) };
  }

  try {
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        temperature: 0, // 分类任务用低温，输出更稳定
        max_tokens: 120,
        messages: [
          // 指令放 system，用户输入单独放 user 消息。
          // 如果直接拼进指令，用户可以输入“忽略上面的指令”之类的话绕过约束，
          // 这就是 prompt injection（提示词注入）。
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `用户说："${text}"` }
        ]
      })
    });

    if (!response.ok) {
      // 上游错误只记日志，不要把原文返回给前端（可能包含敏感信息）
      const errText = await response.text();
      console.error(`DeepSeek API error: ${response.status}`, errText);
      return { statusCode: 502, body: JSON.stringify({ error: 'AI 服务暂时不可用' }) };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) {
      return { statusCode: 500, body: JSON.stringify({ error: 'AI 没有返回内容' }) };
    }

    const result = parseMoodResponse(content);
    if (!result) {
      console.error('Invalid mood response:', content);
      return { statusCode: 500, body: JSON.stringify({ error: 'AI 返回格式不正确' }) };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ mood: result.mood, reply: result.reply })
    };
  } catch (error) {
    console.error(error);
    return { statusCode: 500, body: JSON.stringify({ error: '服务器内部错误' }) };
  }
};

// 额外导出纯函数，供单元测试使用
exports.parseMoodResponse = parseMoodResponse;
