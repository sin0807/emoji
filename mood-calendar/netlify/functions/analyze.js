exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
  if (!DEEPSEEK_API_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Missing DEEPSEEK_API_KEY env' }) };
  }

  let text;
  try {
    ({ text } = JSON.parse(event.body));
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  if (!text || !text.trim()) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing text' }) };
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
        max_tokens: 100,
        messages: [{
          role: 'user',
          content: `用户说："${text}"
请分析用户的情绪状态，并给出温暖的回应。
请以JSON格式回复，只返回这一行，不要有任何多余内容：
{"mood":"happy/normal/sad","reply":"这里写你对用户的鼓励、安慰或分析，30字以内"}`
        }]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      return { statusCode: 502, body: JSON.stringify({ error: `DeepSeek API error: ${response.status}`, detail: errText }) };
    }

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content?.trim();

    if (!content) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Empty response from API' }) };
    }

    // 提取 JSON
    const jsonMatch = content.match(/\{[^}]+\}/);
    if (!jsonMatch) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Invalid JSON format', raw: content }) };
    }

    const result = JSON.parse(jsonMatch[0]);
    const mood = result.mood?.toLowerCase();

    if (mood && ['happy', 'normal', 'sad'].includes(mood)) {
      return { statusCode: 200, body: JSON.stringify({ mood, reply: result.reply }) };
    } else {
      return { statusCode: 500, body: JSON.stringify({ error: 'Invalid mood', raw: content }) };
    }
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};