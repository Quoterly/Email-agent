const nodemailer = require('nodemailer');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { name, company, email, phone, plan, note } = req.body || {};
  if (!name || !email) return res.status(400).json({ error: 'Chybí jméno nebo email' });

  const lines = [
    `Jméno: ${name}`,
    company ? `Firma: ${company}` : null,
    `Email: ${email}`,
    phone ? `Telefon: ${phone}` : null,
    plan ? `Způsob platby: ${plan}` : null,
    note ? `\nPoznámka:\n${note}` : null,
  ].filter(Boolean).join('\n');

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: process.env.CONTACT_EMAIL,
      pass: process.env.CONTACT_PASSWORD,
    },
  });

  await transporter.sendMail({
    from: process.env.CONTACT_EMAIL,
    to: 'info@wiseagent.cz',
    subject: `Nová objednávka — ${name}`,
    text: `Nová objednávka přes wiseagent.cz/objednat\n\n${lines}`,
  });

  try {
    await transporter.sendMail({
      from: process.env.CONTACT_EMAIL,
      to: email,
      subject: 'Wise Agent — obdrželi jsme váš dotaz',
      text: `Dobrý den ${name},\n\nděkujeme za váš zájem o Wise Agent. Váš dotaz jsme obdrželi a ozveme se vám do 24 hodin.\n\nMezitím si můžete vyzkoušet naše demo na wiseagent.cz/demo.\n\nS pozdravem\nTým Wise Agent\ninfo@wiseagent.cz | wiseagent.cz`,
    });
  } catch (_) {}

  res.status(200).json({ success: true });
};
