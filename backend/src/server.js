require('dotenv').config();
const app = require('./app');
const { initDatabase } = require('./db');

async function start() {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'development-only-change-me') {
    if (process.env.NODE_ENV === 'production') throw new Error('Set a strong JWT_SECRET in production.');
    console.warn('WARNING: Set JWT_SECRET in .env before deployment.');
  }
  await initDatabase();
  const port = Number(process.env.PORT || 4000);
  app.listen(port, () => console.log(`CredVault API listening on http://localhost:${port}`));
}
start().catch(err => { console.error('Failed to start API:', err); process.exit(1); });
