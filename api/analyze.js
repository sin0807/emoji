// Vercel Function：AI 情绪分析代理（与 Netlify 版功能一致）
// Vercel 约定：api/ 目录下的 .js 文件默认导出 async (req, res) 函数

const MAX_TEXT_LENGTH = 500;
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;

const ipHits = new Map();

const SYSTEM_PROMPT = `你是一个温暖的心理陪伴助手。
用户会用一句话描述自己的心情，你需要：
1. 判断情绪：只允许 happy / normal / sad 三种
2. 用一句 30 字以内、温暖真诚的话回应
只输出一个 JSON 对象，不要输出任何其他内容，不要用 markdown 代码块，格式：
{"mood":"happy 或 normal 或 sad","reply":"你的回应"}`;

function parseMoodResponse(content) {
  const cleaned = content
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

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

// 简单的重试：上游 429（限流）或 5xx（服务器错误）时自动重试，
// 等待时间逐次翻倍（500ms → 1000ms），避免瞬时故障直接报错。
async function fetchWithRetry(url, options, maxRetries = 2) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, options);
    const retryable = response.status === 429 || response.status >= 500;
    if (!retryable || attempt === maxRetries) {
      return response;
    }
    await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
  }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  // Vercel 的 Node 函数里，访客 IP 一般在 x-forwarded-for 里（可能带端口列表）
  const ip =
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    'unknown';
  if (!checkRateLimit(ip)) {
    res.status(429).json({ error: '请求太频繁，请稍后再试' });
    return;
  }

  const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
  if (!DEEPSEEK_API_KEY) {
    console.error('Missing DEEPSEEK_API_KEY env');
    res.status(500).json({ error: '服务端未配置 DEEPSEEK_API_KEY' });
    return;
  }

  let text;
  try {
    // Vercel 有时已经把 body 解析成对象，有时还是字符串，两种情况都处理
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    text = body.text;
  } catch {
    res.status(400).json({ error: '请求格式错误' });
    return;
  }

  text = (text || '').trim();
  if (!text) {
    res.status(400).json({ error: '请输入内容' });
    return;
  }
  if (text.length > MAX_TEXT_LENGTH) {
    res.status(400).json({ error: `内容过长，最多 ${MAX_TEXT_LENGTH} 字` });
    return;
  }

  try {
    const response = await fetchWithRetry('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        response_format: { type: 'json_object' }, // 让模型保证输出合法 JSON
        temperature: 0,
        max_tokens: 120,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `用户说："${text}"` }
        ]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`DeepSeek API error: ${response.status}`, errText);
      res.status(502).json({ error: 'AI 服务暂时不可用' });
      return;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) {
      res.status(500).json({ error: 'AI 没有返回内容' });
      return;
    }

    const result = parseMoodResponse(content);
    if (!result) {
      console.error('Invalid mood response:', content);
      res.status(500).json({ error: 'AI 返回格式不正确' });
      return;
    }

    res.status(200).json({ mood: result.mood, reply: result.reply });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};
