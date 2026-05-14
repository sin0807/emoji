// Netlify Function - 菟丝花匹配后端
// 路径: netlify/functions/match.js

export default async function handler(req, context) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const { input, characters } = await req.json();

    // 构建 prompt
    const prompt = buildMatchPrompt(input, characters);

    // 调用 DeepSeek API
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      throw new Error('DEEPSEEK_API_KEY not configured');
    }

    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('DeepSeek API error:', err);
      throw new Error('AI API request failed');
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No response from AI');
    }

    // 解析 JSON 结果
    let result;
    try {
      // 尝试提取 JSON
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        result = JSON.parse(content);
      }
    } catch (parseErr) {
      console.error('JSON parse error:', parseErr, 'Content:', content);
      throw new Error('Failed to parse AI response');
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Match function error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

const systemPrompt = `你是一位温暖的女性文学导师，专注于从历史人物的真实经历中提取智慧。用户会输入自己的困境，你需要从人物库中找出最匹配的3个人物，按匹配度分为高度匹配、中度匹配、低度匹配。

输出要求：严格返回以下 JSON 结构，不要添加任何解释、markdown标记或多余文字：

{
  "matches": [
    {
      "id": "人物id",
      "level": "high|medium|low",
      "similarity": "一段话，说明这位人物与用户困境的相似之处（第一人称，带入感，温暖但不过度）",
      "story": "她人生故事的简短版本（3-5句话，有画面感的叙述）",
      "howSheSurvived": "她是如何走过来的（2-3句，真实可信，不鸡汤）",
      "suggestion": "给用户的一条建议（1-2句，具体、有可操作性）",
      "quote": "从她说过的话或写过的文字中，选出一句与用户经历最相关的原话"
    }
  ]
}

注意：level 中的 high/medium/low 分别对应高度匹配/中度匹配/低度匹配。优先选择匹配度高的3个人物。`;

function buildMatchPrompt(userInput, characters) {
  const charactersInfo = characters.map(c =>
    `${c.name}（${c.era}，${c.nationality}）`
  ).join('\n');

  return `用户困境：${userInput}

人物库：
${charactersInfo}

请根据用户描述的困境，从人物库中找出最匹配的3位人物，判断她们的人生经历是否有相似之处，哪怕只有一点也行。不要预设固定分类，请根据实际匹配度分配 high/medium/low。

返回格式必须是合法的JSON。`;