const { Redis } = require('@upstash/redis');

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

module.exports = async function handler(req, res) {
  const auth = req.headers['x-admin-secret'];
  if (auth !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method === 'GET') {
    try {
      const { clientId } = req.query;
      const indexKey = clientId ? `email_index:${clientId}` : 'email_index';
      const index = (await redis.get(indexKey)) || [];
      const emails = [];
      for (const id of index.slice(0, 100)) {
        const raw = await redis.get(`email:${id}`);
        if (raw) emails.push(raw);
      }
      return res.status(200).json(emails);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === 'PATCH') {
    try {
      const { emailId, status } = req.body;
      const record = await redis.get(`email:${emailId}`);
      if (!record) return res.status(404).json({ error: 'Nenalezeno' });
      record.status = status;
      await redis.set(`email:${emailId}`, record);
      return res.status(200).json({ success: true });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
