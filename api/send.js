const nodemailer = require('nodemailer');
const { kv } = require('@vercel/kv');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST')
    return res.status(405).json({ error: 'Method not allowed' });

  const { emailId, replyText } = req.body;
  if (!emailId || !replyText)
    return res.status(400).json({ error: 'Chybí emailId nebo replyText' });

  try {
    const record = JSON.parse(await kv.get(`email:${emailId}`));
    if (!record) return res.status(404).json({ error: 'E-mail nenalezen' });
    if (record.status === 'sent') return res.status(400).json({ error: 'Už bylo odesláno' });

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '465'),
      secure: true,
      auth: {
        user: process.env.EMAIL,
        pass: process.env.EMAIL_PASSWORD
      }
    });

    await transporter.sendMail({
      from: process.env.EMAIL,
      to: record.from,
      subject: record.subject.startsWith('Re:') ? record.subject : `Re: ${record.subject}`,
      text: replyText
    });

    record.status = 'sent';
    record.sentAt = new Date().toISOString();
    record.reply = replyText;
    await kv.set(`email:${emailId}`, JSON.stringify(record));

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Send error:', error);
    return res.status(500).json({ error: error.message });
  }
}
