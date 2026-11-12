require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('../src/db');

const [name, email, password, role = 'staff'] = process.argv.slice(2);
if (!name || !email || !password || !['admin', 'staff'].includes(role)) {
  console.log('Usage: npm run create-user -- "Full Name" email@example.com password [admin|staff]');
  console.log('Without a role the account is created as staff (cannot delete records).');
  process.exit(1);
}

(async () => {
  const hash = await bcrypt.hash(password, 10);
  await db.query(
    'INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4)',
    [name, email, hash, role]
  );
  console.log(`${role} account created. They can sign in now.`);
  await db.end();
})().catch((e) => { console.error(e.message); process.exit(1); });
