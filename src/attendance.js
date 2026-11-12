const express = require('express');
const db = require('./db');

const router = express.Router();
const STATUSES = ['present', 'late', 'absent', 'excused'];

// Who is in this class, what was marked on this date, and running totals per student
router.get('/', async (req, res) => {
  const { class_id, date } = req.query;
  if (!class_id || !date) return res.status(400).json({ error: 'Choose a class and a date.' });
  const { rows } = await db.query(
    `SELECT e.id AS enrollment_id, s.full_name AS student_name, a.status,
            COUNT(*) FILTER (WHERE h.status = 'present') AS present,
            COUNT(*) FILTER (WHERE h.status = 'late')    AS late,
            COUNT(*) FILTER (WHERE h.status = 'excused') AS excused,
            COUNT(*) FILTER (WHERE h.status = 'absent')  AS absent
       FROM enrollments e
       JOIN students s ON s.id = e.student_id
       LEFT JOIN attendance a ON a.enrollment_id = e.id AND a.session_date = $2
       LEFT JOIN attendance h ON h.enrollment_id = e.id
      WHERE e.class_id = $1 AND e.status = 'active'
      GROUP BY e.id, s.full_name, a.status
      ORDER BY s.full_name`,
    [class_id, date]
  );
  res.json(rows);
});

// Save a whole day at once (creates or updates each student's mark)
router.put('/', async (req, res) => {
  const { class_id, date, records } = req.body || {};
  if (!class_id || !date || !Array.isArray(records)) {
    return res.status(400).json({ error: 'Choose a class and a date.' });
  }
  if (records.some((r) => !STATUSES.includes(r.status))) {
    return res.status(400).json({ error: 'Some marks have an invalid status.' });
  }
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    for (const r of records) {
      // The class_id check makes sure the student really belongs to this class
      await client.query(
        `INSERT INTO attendance (enrollment_id, session_date, status, marked_by)
         SELECT e.id, $2::date, $3::text, $4::int
           FROM enrollments e
          WHERE e.id = $1 AND e.class_id = $5
         ON CONFLICT (enrollment_id, session_date)
         DO UPDATE SET status = EXCLUDED.status, marked_by = EXCLUDED.marked_by`,
        [r.enrollment_id, date, r.status, req.user.id, class_id]
      );
    }
    await client.query('COMMIT');
    res.json({ saved: records.length });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

module.exports = router;
