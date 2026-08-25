// Vercel Function：AI 情绪分析代理（与 Netlify 版功能一致）
// Vercel 约定：api/ 目录下的 .js 文件默认导出 async (req, res) 函数

const MAX_TEXT_LENGTH = 500;
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;

// ---- 多模型配置表 ----
// DeepSeek / 通义千问 / 豆包都兼容 OpenAI 的 Chat Completions 接口格式，
// 只需要维护"地址 / 密钥环境变量名 / 默认模型名"，靠环境变量切换服务商。
const PROVIDERS = {
  deepseek: {
    url: 'https://api.deepseek.com/v1/chat/completions',
    keyEnv: 'DEEPSEEK_API_KEY',
    defaultModel: 'deepseek-chat'
  },
  qwen: {
    url: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    keyEnv: 'DASHSCOPE_API_KEY',
    defaultModel: 'qwen-plus'
  },
  doubao: {
    url: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
    keyEnv: 'ARK_API_KEY',
    defaultModel: 'doubao-seed-1-6-250615'
  }
};

// MODEL_PROVIDER: deepseek（默认）/ qwen / doubao
// MODEL_NAME: 可选，覆盖默认模型名（豆包建议填模型名或接入点 ID ep-xxx）
// MODEL_JSON_MODE: 默认开启，设成 0 可关闭 JSON 模式
function getModelConfig() {
  const provider = (process.env.MODEL_PROVIDER || 'deepseek').toLowerCase();
  const p = PROVIDERS[provider];
  if (!p) {
    return { error: `未知的 MODEL_PROVIDER: ${provider}（可选 deepseek / qwen / doubao）` };
  }
  const apiKey = process.env[p.keyEnv];
  if (!apiKey) {
    return { error: `当前模型 ${provider} 缺少环境变量 ${p.keyEnv}` };
  }
  return {
    provider,
    url: p.url,
    apiKey,
    model: process.env.MODEL_NAME || p.defaultModel,
    jsonMode: process.env.MODEL_JSON_MODE !== '0'
  };
}

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

  const cfg = getModelConfig();
  if (cfg.error) {
    console.error(cfg.error);
    res.status(500).json({ error: cfg.error });
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

  const payload = {
    model: cfg.model,
    temperature: 0,
    max_tokens: 120,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `用户说："${text}"` }
    ]
  };
  if (cfg.jsonMode) {
    payload.response_format = { type: 'json_object' };
  }

  try {
    const response = await fetchWithRetry(cfg.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cfg.apiKey}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`AI API error: ${response.status}`, errText);
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

    res.status(200).json({ mood: result.mood, reply: result.reply, model: cfg.model });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};
