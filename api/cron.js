import Imap from 'imap';
import { simpleParser } from 'mailparser';
import { kv } from '@vercel/kv';

const DAILY_LIMIT = 25;

function getImapConfig() {
  return {
    user: process.env.EMAIL,
    password: process.env.EMAIL_PASSWORD,
    host: process.env.IMAP_HOST,
    port: parseInt(process.env.IMAP_PORT || '993'),
    tls: true,
    tlsOptions: { rejectUnauthorized: false }
  };
}

function fetchNewEmails() {
  return new Promise((resolve, reject) => {
    const imap = new Imap(getImapConfig());
    const emails = [];

    imap.once('ready', () => {
      imap.openBox('INBOX', false, (err) => {
        if (err) return reject(err);
        imap.search(['UNSEEN'], (err, results) => {
          if (err) return reject(err);
          if (!results || results.length === 0) { imap.end(); return resolve([]); }

          const fetch = imap.fetch(results, { bodies: '', markSeen: true });
          fetch.on('message', (msg) => {
            let uid;
            msg.on('attributes', (attrs) => { uid = attrs.uid; });
            msg.on('body', (stream) => {
              simpleParser(stream, (err, parsed) => {
                if (!err) emails.push({
                  uid: String(uid),
                  from: parsed.from?.text || '',
                  subject: parsed.subject || '(bez předmětu)',
                  text: (parsed.text || '').slice(0, 3000),
                  date: parsed.date?.toISOString() || new Date().toISOString()
                });
              });
            });
          });
          fetch.once('end', () => imap.end());
        });
      });
    });
    imap.once('end', () => resolve(emails));
    imap.once('error', reject);
    imap.connect();
  });
}

function buildSystemPrompt(config) {
  const name = config.companyName || 'naše firma';
  const signature = config.signature || `Tým zákaznické podpory, ${name}`;
  const tone = config.tone || 'přátelský a profesionální';
  const salutation = config.salutation === 'tykani' ? 'Tyká zákazníkům' : 'Vyká zákazníkům';
  const length = { kratka: 'krátká', dlouha: 'podrobná' }[config.replyLength] || 'střední';

  let prompt = `Jsi AI asistent zákaznické podpory pro firmu "${name}"${config.industry ? ` (${config.industry})` : ''}.
${config.companyDesc ? `\nO firmě: ${config.companyDesc}` : ''}
Pravidla:
- Tón: ${tone}
- Oslovení: ${salutation}
- Délka: ${length}
- Piš česky
- Podpis: "${signature}"
- Piš pouze text odpovědi bez předmětu`;

  if (config.faqs?.length > 0)
    prompt += '\n\nFAQ:\n' + config.faqs.map((f, i) => `Q${i+1}: ${f.q}\nA${i+1}: ${f.a}`).join('\n');
  if (config.escalationContact)
    prompt += `\n\nEskalace: Pokud ${config.escalationWhen || 'problém nelze vyřešit'}, přesměruj na: ${config.escalationContact}`;
  if (config.forbiddenTopics)
    prompt += `\n\nNIKDY nekomentuj: ${config.forbiddenTopics}`;

  return prompt;
}

async function generateReply(email, config) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1000,
      system: buildSystemPrompt(config),
      messages: [{ role: 'user', content: `Od: ${email.from}\nPředmět: ${email.subject}\n\n${email.text}\n\nNapiš odpověď.` }]
    })
  });
  const data = await response.json();
  return data.content?.map(b => b.text || '').join('') || '';
}

module.exports = async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const today = new Date().toISOString().split('T')[0];
    const countKey = `daily_count:${today}`;
    const count = (await kv.get(countKey)) || 0;

    if (count >= DAILY_LIMIT)
      return res.status(200).json({ message: 'Denní limit vyčerpán', count });

    const config = (await kv.get('agent_config')) || {};
    const emails = await fetchNewEmails();

    if (emails.length === 0)
      return res.status(200).json({ message: 'Žádné nové e-maily' });

    let processed = 0;
    for (const email of emails) {
      const currentCount = (await kv.get(countKey)) || 0;
      if (currentCount >= DAILY_LIMIT) break;

      const reply = await generateReply(email, config);
      const id = `email_${email.uid}_${Date.now()}`;
      const record = { id, uid: email.uid, from: email.from, subject: email.subject, body: email.text, date: email.date, reply, status: 'pending', createdAt: new Date().toISOString() };

      await kv.set(`email:${id}`, JSON.stringify(record));
      const index = (await kv.get('email_index')) || [];
      index.unshift(id);
      if (index.length > 500) index.pop();
      await kv.set('email_index', index);
      await kv.set(countKey, currentCount + 1);
      await kv.expire(countKey, 86400);
      processed++;
    }

    return res.status(200).json({ message: `Zpracováno ${processed} e-mailů`, processed });
  } catch (error) {
    console.error('Cron error:', error);
    return res.status(500).json({ error: error.message });
  }
}
