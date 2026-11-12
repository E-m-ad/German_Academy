const express = require('express');
const crud = require('./crud');
const db = require('./db');

const router = express.Router();

// This month: money received (payments) against money spent (expenses)
router.get('/summary', async (req, res) => {
  const { rows: [summary] } = await db.query(
    `SELECT received, spent, received - spent AS balance
       FROM (SELECT
         (SELECT COALESCE(SUM(amount), 0) FROM payments
           WHERE date_trunc('month', paid_at) = date_trunc('month', CURRENT_DATE)) AS received,
         (SELECT COALESCE(SUM(amount), 0) FROM expenses
           WHERE date_trunc('month', spent_at) = date_trunc('month', CURRENT_DATE)) AS spent) t`
  );
  res.json(summary);
});

router.get('/', async (req, res) => {
  const { rows } = await db.query(
    `SELECT x.id, x.category, x.amount, x.spent_at, x.note, u.name AS created_by_name
       FROM expenses x
       LEFT JOIN users u ON u.id = x.created_by
      ORDER BY x.spent_at DESC, x.id DESC`
  );
  res.json(rows);
});

router.post('/', async (req, res) => {
  const { category, amount, spent_at, note } = req.body || {};
  if (!category) return res.status(400).json({ error: 'Choose a category.' });
  if (!(Number(amount) > 0)) return res.status(400).json({ error: 'Enter an amount greater than zero.' });
  const { rows } = await db.query(
    `INSERT INTO expenses (category, amount, spent_at, note, created_by)
     VALUES ($1, $2, COALESCE($3::date, CURRENT_DATE), $4, $5) RETURNING *`,
    [category, String(amount), spent_at || null, note || null, req.user.id]
  );
  res.status(201).json(rows[0]);
});

// Editing and deleting reuse the generic routes
router.use(crud('expenses', ['category', 'amount', 'spent_at', 'note']));

module.exports = router;
