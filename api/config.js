const { kv } = require('@vercel/kv');

module.exports = async function handler(req, res) {
  if (req.method === 'GET') {
    const config = (await kv.get('agent_config')) || {};
    return res.status(200).json(config);
  }

  if (req.method === 'POST') {
    await kv.set('agent_config', req.body);
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
