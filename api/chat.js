export default async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({ ok: true, hasKey: Boolean(process.env.OPENAI_API_KEY) });
  }
  if (req.method !== 'POST') return res.status(405).end();

  const key = process.env.OPENAI_API_KEY;
  if (!key) return res.status(500).json({ error: 'OPENAI_API_KEY is not set' });

  const { messages, model = 'gpt-4o-mini' } = req.body || {};
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method:'POST',
    headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${key}` },
    body: JSON.stringify({ model, messages })
  });
  res.status(r.status).json(await r.json());
}