export default async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({ ok: true, hasKey: Boolean(process.env.OPENAI_API_KEY) });
  }
  if (req.method !== 'POST') return res.status(405).end();

  const body = req.body || {};
  const { messages = [], model = 'gpt-4o-mini', systemPrompt, apiKey, max_tokens = 4096 } = body;
  // BYOKが来ていればそれを、なければ環境変数を使う
  const key = apiKey || process.env.OPENAI_API_KEY;  
if (!key) return res.status(500).json({ error: 'OPENAI_API_KEY is not set' });

  // systemPrompt があれば system ロールを先頭に付与
  const finalMessages = systemPrompt
  ? [{ role: 'system', content: String(systemPrompt) }, ...messages]
  : messages;
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method:'POST',
    headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${key}` },
    body: JSON.stringify({ model, messages: finalMessages, max_tokens })
  });
  res.status(r.status).json(await r.json());
}