module.exports = function handler(req, res) {
  res.status(200).json({ publishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || '' });
};
