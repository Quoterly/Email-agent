const { kv } = require('@vercel/kv');

module.exports = async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const index = (await kv.get('email_index')) || [];
      const emails = [];
      for (const id of index.slice(0, 50)) {
        const raw = await kv.get(`email:${id}`);
        if (raw) emails.push(JSON.parse(raw));
      }
      return res.status(200).json(emails);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  if (req.method === 'PATCH') {
    // Update status to 'ignored'
    const { emailId, status } = req.body;
    try {
      const record = JSON.parse(await kv.get(`email:${emailId}`));
      if (!record) return res.status(404).json({ error: 'Nenalezeno' });
      record.status = status;
      await kv.set(`email:${emailId}`, JSON.stringify(record));
      return res.status(200).json({ success: true });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
