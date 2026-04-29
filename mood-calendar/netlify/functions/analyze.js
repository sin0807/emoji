exports.handler = async (event) => {
 if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
 try {
 const { text } = JSON.parse(event.body);
 if (!text) return { statusCode: 400, body: JSON.stringify({ error: 'Missing text' }) };
 const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
 const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${DEEPSEEK_API_KEY}` },
 body: JSON.stringify({
 model: 'deepseek-chat',
 max_tokens: 20,
 messages: [{ role: 'user', content: `根据这句话判断情绪，只回复happy、normal或sad三个词之一：${text}` }]
 })
 });
 const data = await response.json();
 if (data.choices?.[0]) {
 return { statusCode: 200, body: JSON.stringify({ mood: data.choices[0].message.content.trim().toLowerCase() }) };
 } else throw new Error('API返回异常');
 } catch (error) {
 return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
 }
};
