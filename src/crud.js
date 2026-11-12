const express = require('express');
const db = require('./db');
const { requireAdmin } = require('./auth');

// Builds list / create / update / delete routes for a simple table.
// `fields` is the whitelist of columns the browser is allowed to write.
// `listSql` (optional) replaces the default "select everything" query.
module.exports = function crud(table, fields, listSql) {
  const router = express.Router();

  const pick = (body = {}) =>
    fields
      .filter((f) => body[f] !== undefined)
      .map((f) => [f, body[f] === '' ? null : body[f]]);

  router.get('/', async (req, res) => {
    const { rows } = await db.query(listSql || `SELECT * FROM ${table} ORDER BY id DESC`);
    res.json(rows);
  });

  router.post('/', async (req, res) => {
    const data = pick(req.body);
    if (!data.length) return res.status(400).json({ error: 'No data received' });
    const cols = data.map(([f]) => f).join(', ');
    const marks = data.map((_, i) => `$${i + 1}`).join(', ');
    const { rows } = await db.query(
      `INSERT INTO ${table} (${cols}) VALUES (${marks}) RETURNING *`,
      data.map(([, v]) => v)
    );
    res.status(201).json(rows[0]);
  });

  router.put('/:id', async (req, res) => {
    const data = pick(req.body);
    if (!data.length) return res.status(400).json({ error: 'No data received' });
    const sets = data.map(([f], i) => `${f} = $${i + 1}`).join(', ');
    const { rows } = await db.query(
      `UPDATE ${table} SET ${sets} WHERE id = $${data.length + 1} RETURNING *`,
      [...data.map(([, v]) => v), req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  });

  router.delete('/:id', requireAdmin, async (req, res) => {
    const { rowCount } = await db.query(`DELETE FROM ${table} WHERE id = $1`, [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  });

  return router;
};
