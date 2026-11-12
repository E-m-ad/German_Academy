require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');

const requiredRelations = [
  'users',
  'students',
  'teachers',
  'courses',
  'classes',
  'enrollments',
  'payments',
  'expenses',
  'attendance',
  'enrollment_balances',
];

async function initializeDatabase() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required to initialize the database.');
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL });

  try {
    await client.connect();
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(hashtext('german-academy-schema-init'))");

    const { rows } = await client.query(
      `SELECT relation_name,
              to_regclass('public.' || quote_ident(relation_name)) IS NOT NULL AS present
         FROM unnest($1::text[]) AS required(relation_name)`,
      [requiredRelations]
    );
    const existingRelations = rows.filter((row) => row.present).map((row) => row.relation_name);

    if (existingRelations.length === requiredRelations.length) {
      await client.query('COMMIT');
      console.log('Database schema is already initialized.');
      return;
    }

    if (existingRelations.length > 0) {
      throw new Error(
        `Database has a partial schema (${existingRelations.join(', ')}). ` +
        'No changes were made; inspect the database before retrying.'
      );
    }

    const schemaPath = path.join(__dirname, '..', 'db', 'schema.sql');
    await client.query(fs.readFileSync(schemaPath, 'utf8'));
    await client.query('COMMIT');
    console.log('Database schema initialized successfully.');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    await client.end();
  }
}

initializeDatabase().catch((error) => {
  console.error(`Database initialization failed: ${error.message}`);
  process.exitCode = 1;
});
