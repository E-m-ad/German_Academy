const express = require('express');
const db = require('./db');
const { requireAdmin } = require('./auth');

const router = express.Router();
const METHODS = ['cash', 'transfer', 'card'];

// Enrollments that still owe money (feeds the payment form)
router.get('/owing', async (req, res) => {
  const { rows } = await db.query(
    `SELECT b.enrollment_id AS id, s.full_name AS student_name, cl.name AS class_name, b.remaining
       FROM enrollment_balances b
       JOIN students s ON s.id = b.student_id
       JOIN classes cl ON cl.id = b.class_id
      WHERE b.remaining > 0
      ORDER BY s.full_name, cl.name`
  );
  res.json(rows);
});

router.get('/summary', async (req, res) => {
  const { rows: [summary] } = await db.query(
    `SELECT
       (SELECT COALESCE(SUM(amount), 0) FROM payments
         WHERE date_trunc('month', paid_at) = date_trunc('month', CURRENT_DATE)) AS received_this_month,
       (SELECT COALESCE(SUM(remaining), 0) FROM enrollment_balances
         WHERE remaining > 0) AS outstanding`
  );
  res.json(summary);
});

router.get('/', async (req, res) => {
  const { rows } = await db.query(
    `SELECT p.id, p.amount, p.method, p.paid_at, p.note,
            e.student_id, s.full_name AS student_name, cl.name AS class_name, u.name AS received_by_name
       FROM payments p
       JOIN enrollments e ON e.id = p.enrollment_id
       JOIN students s ON s.id = e.student_id
       JOIN classes cl ON cl.id = e.class_id
       LEFT JOIN users u ON u.id = p.received_by
      ORDER BY p.paid_at DESC, p.id DESC`
  );
  res.json(rows);
});

router.post('/', async (req, res) => {
  const { enrollment_id, amount, method, paid_at, note } = req.body || {};
  if (!enrollment_id) return res.status(400).json({ error: 'Choose a student.' });
  if (!(Number(amount) > 0)) return res.status(400).json({ error: 'Enter an amount greater than zero.' });
  if (!METHODS.includes(method)) return res.status(400).json({ error: 'Choose a payment method.' });

  const { rows: [balance] } = await db.query(
    `SELECT remaining, remaining >= $2::numeric AS fits
       FROM enrollment_balances WHERE enrollment_id = $1`,
    [enrollment_id, String(amount)]
  );
  if (!balance) return res.status(400).json({ error: 'Choose a student.' });
  if (!balance.fits) {
    return res.status(400).json({ error: `This is more than the remaining balance (${balance.remaining}).` });
  }

  const { rows } = await db.query(
    `INSERT INTO payments (enrollment_id, amount, method, paid_at, received_by, note)
     VALUES ($1, $2, $3, COALESCE($4::date, CURRENT_DATE), $5, $6) RETURNING *`,
    [enrollment_id, String(amount), method, paid_at || null, req.user.id, note || null]
  );
  res.status(201).json(rows[0]);
});

// A wrong payment is deleted and entered again
router.delete('/:id', requireAdmin, async (req, res) => {
  const { rowCount } = await db.query('DELETE FROM payments WHERE id = $1', [req.params.id]);
  if (!rowCount) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

module.exports = router;
