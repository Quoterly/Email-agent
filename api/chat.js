const { redis } = require('./_auth');

const DAILY_LIMIT = 25;

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  // Redis-based daily counter — persists across serverless cold starts
  const today = new Date().toISOString().split('T')[0];
  const countKey = `demo_chat_count:${today}`;
  try {
    const count = (await redis.get(countKey)) || 0;
    if (count >= DAILY_LIMIT) {
      return res.status(429).json({
        error: `Denní limit ${DAILY_LIMIT} vygenerování byl vyčerpán. Zkuste to zítra.`
      });
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(req.body)
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    await redis.set(countKey, count + 1);
    await redis.expire(countKey, 86400);

    res.setHeader('X-Daily-Remaining', DAILY_LIMIT - count - 1);
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
