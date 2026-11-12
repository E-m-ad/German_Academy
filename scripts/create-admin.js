require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('../src/db');

const [name, email, password] = process.argv.slice(2);
if (!name || !email || !password) {
  console.log('Usage: npm run create-admin -- "Full Name" email@example.com password');
  process.exit(1);
}

(async () => {
  const hash = await bcrypt.hash(password, 10);
  await db.query(
    "INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, 'admin')",
    [name, email, hash]
  );
  console.log('Admin created. You can sign in now.');
  await db.end();
})().catch((e) => { console.error(e.message); process.exit(1); });
