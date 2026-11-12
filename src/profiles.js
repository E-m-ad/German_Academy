const express = require('express');
const db = require('./db');

const router = express.Router();

// Everything about one student: classes, attendance marks and payments
router.get('/students/:id', async (req, res) => {
  const { id } = req.params;
  const { rows: [student] } = await db.query('SELECT * FROM students WHERE id = $1', [id]);
  if (!student) return res.status(404).json({ error: 'Student not found' });

  const [enrollments, attendance, payments] = await Promise.all([
    db.query(
      `SELECT e.id, e.status, e.enrolled_at, cl.name AS class_name, c.name AS course_name,
              t.full_name AS teacher_name, b.total_due, b.total_paid, b.remaining
         FROM enrollments e
         JOIN classes cl ON cl.id = e.class_id
         JOIN courses c ON c.id = cl.course_id
         LEFT JOIN teachers t ON t.id = cl.teacher_id
         JOIN enrollment_balances b ON b.enrollment_id = e.id
        WHERE e.student_id = $1
        ORDER BY e.enrolled_at DESC, e.id DESC`, [id]),
    db.query(
      `SELECT a.enrollment_id, a.session_date, a.status
         FROM attendance a JOIN enrollments e ON e.id = a.enrollment_id
        WHERE e.student_id = $1
        ORDER BY a.session_date DESC`, [id]),
    db.query(
      `SELECT p.id, p.paid_at, p.amount, p.method, p.note, cl.name AS class_name
         FROM payments p
         JOIN enrollments e ON e.id = p.enrollment_id
         JOIN classes cl ON cl.id = e.class_id
        WHERE e.student_id = $1
        ORDER BY p.paid_at DESC, p.id DESC`, [id]),
  ]);

  res.json({
    student,
    enrollments: enrollments.rows,
    attendance: attendance.rows,
    payments: payments.rows,
  });
});

// One course: its classes and every student enrolled in them
router.get('/courses/:id', async (req, res) => {
  const { id } = req.params;
  const { rows: [course] } = await db.query('SELECT * FROM courses WHERE id = $1', [id]);
  if (!course) return res.status(404).json({ error: 'Course not found' });

  const [classes, students] = await Promise.all([
    db.query(
      `SELECT cl.id, cl.name, cl.days_of_week, cl.start_date, cl.status, t.full_name AS teacher_name,
              (SELECT count(*) FROM enrollments e
                WHERE e.class_id = cl.id AND e.status = 'active') AS active_students
         FROM classes cl
         LEFT JOIN teachers t ON t.id = cl.teacher_id
        WHERE cl.course_id = $1
        ORDER BY cl.start_date DESC NULLS LAST, cl.id DESC`, [id]),
    db.query(
      `SELECT s.id, s.full_name, s.phone, cl.name AS class_name, e.status, b.remaining
         FROM enrollments e
         JOIN students s ON s.id = e.student_id
         JOIN classes cl ON cl.id = e.class_id
         JOIN enrollment_balances b ON b.enrollment_id = e.id
        WHERE cl.course_id = $1
        ORDER BY s.full_name, cl.name`, [id]),
  ]);

  res.json({ course, classes: classes.rows, students: students.rows });
});

module.exports = router;
