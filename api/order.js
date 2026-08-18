const nodemailer = require('nodemailer');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { name, company, email, phone, note } = req.body || {};
  if (!name || !email) return res.status(400).json({ error: 'Chybí jméno nebo email' });

  const lines = [
    `Jméno: ${name}`,
    company ? `Firma: ${company}` : null,
    `Email: ${email}`,
    phone ? `Telefon: ${phone}` : null,
    note ? `\nPoznámka:\n${note}` : null,
  ].filter(Boolean).join('\n');

  const transporter = nodemailer.createTransport({
    host: process.env.NOTIFY_SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.NOTIFY_SMTP_PORT || '587'),
    secure: false,
    auth: {
      user: process.env.NOTIFY_SMTP_USER,
      pass: process.env.NOTIFY_SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from: process.env.NOTIFY_SMTP_USER,
    to: process.env.NOTIFY_TO || 'vojtech.moudry.work@gmail.com',
    subject: `Nová objednávka Wise Agent${company ? ` — ${company}` : ` — ${name}`}`,
    text: `Nová objednávka přes wiseagent.cz/objednat\n\n${lines}`,
  });

  res.status(200).json({ ok: true });
};
