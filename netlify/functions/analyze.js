// Netlify Function：AI 情绪分析代理
// 浏览器里不能保存 API Key（任何人打开网页都能看到），
// 所以真实请求由这个 Serverless 函数转发给大模型服务商，Key 只存在于服务器端。

const MAX_TEXT_LENGTH = 500; // 输入长度上限：防止恶意请求消耗大量 token
const RATE_LIMIT_MAX = 10; // 每个 IP 每分钟最多请求次数
const RATE_LIMIT_WINDOW_MS = 60 * 1000;

// ---- 多模型配置表 ----
// DeepSeek / 通义千问 / 豆包都兼容 OpenAI 的 Chat Completions 接口格式，
// 所以只需要维护"地址 / 密钥环境变量名 / 默认模型名"三个字段，
// 请求代码只需要写一遍，靠环境变量切换服务商。
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

// 根据环境变量选择当前模型服务商，返回配置或错误信息。
// MODEL_PROVIDER: deepseek（默认）/ qwen / doubao
// MODEL_NAME: 可选，覆盖默认模型名（豆包建议填自己的模型名或接入点 ID ep-xxx）
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

  const cfg = getModelConfig();
  if (cfg.error) {
    console.error(cfg.error);
    return { statusCode: 500, body: JSON.stringify({ error: cfg.error }) };
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

  const payload = {
    model: cfg.model,
    temperature: 0,
    max_tokens: 120,
    messages: [
      // 指令放 system，用户输入单独放 user 消息。
      // 如果直接拼进指令，用户可以输入“忽略上面的指令”之类的话绕过约束，
      // 这就是 prompt injection（提示词注入）。
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `用户说："${text}"` }
    ]
  };
  if (cfg.jsonMode) {
    payload.response_format = { type: 'json_object' }; // 让模型保证输出合法 JSON
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
      // 上游错误只记日志，不要把原文返回给前端（可能包含敏感信息）
      const errText = await response.text();
      console.error(`AI API error: ${response.status}`, errText);
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
      body: JSON.stringify({ mood: result.mood, reply: result.reply, model: cfg.model })
    };
  } catch (error) {
    console.error(error);
    return { statusCode: 500, body: JSON.stringify({ error: '服务器内部错误' }) };
  }
};

// 额外导出纯函数，供单元测试使用
exports.parseMoodResponse = parseMoodResponse;
