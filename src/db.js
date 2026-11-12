require('dotenv').config();
const { Pool, types } = require('pg');

// Keep DATE columns as plain 'YYYY-MM-DD' strings (avoids timezone shifts)
types.setTypeParser(1082, (value) => value);

module.exports = new Pool({ connectionString: process.env.DATABASE_URL });
