require('dotenv').config();
const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const crud = require('./crud');
const db = require('./db');
const { router: authRouter, requireAuth } = require('./auth');

if (!process.env.JWT_SECRET || !process.env.DATABASE_URL) {
  console.error('Missing JWT_SECRET or DATABASE_URL. Copy .env.example to .env and fill it in.');
  process.exit(1);
}

const app = express();
app.use(express.json());
app.use(cookieParser());

// Railway uses this endpoint to confirm the web process has started.
app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));

app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api/auth', authRouter);

app.use('/api/students', requireAuth,
  crud('students', ['full_name', 'phone', 'email', 'birth_date', 'notes', 'status']));

app.use('/api/teachers', requireAuth,
  crud('teachers', ['full_name', 'phone', 'email', 'active']));

app.use('/api/courses', requireAuth,
  crud('courses', ['name', 'level', 'total_hours', 'price']));

app.use('/api/classes', requireAuth,
  crud('classes',
    ['course_id', 'teacher_id', 'name', 'days_of_week', 'start_time', 'end_time',
     'start_date', 'end_date', 'capacity', 'status'],
    `SELECT cl.*, c.name AS course_name, t.full_name AS teacher_name
       FROM classes cl
       JOIN courses c ON c.id = cl.course_id
       LEFT JOIN teachers t ON t.id = cl.teacher_id
      ORDER BY cl.id DESC`));

// Enrollments: a student joins a class. The fee defaults to the course price.
const enrollments = express.Router();

enrollments.get('/', async (req, res) => {
  const { rows } = await db.query(
    `SELECT e.*, s.full_name AS student_name, cl.name AS class_name,
            c.name AS course_name, t.full_name AS teacher_name,
            b.total_due, b.total_paid, b.remaining
       FROM enrollments e
       JOIN students s ON s.id = e.student_id
       JOIN classes cl ON cl.id = e.class_id
       JOIN courses c ON c.id = cl.course_id
       LEFT JOIN teachers t ON t.id = cl.teacher_id
       JOIN enrollment_balances b ON b.enrollment_id = e.id
      ORDER BY e.id DESC`
  );
  res.json(rows);
});

enrollments.post('/', async (req, res) => {
  const { student_id, class_id, price, discount, status } = req.body || {};
  const { rows: [cls] } = await db.query(
    `SELECT cl.capacity, c.price,
            (SELECT count(*) FROM enrollments e
              WHERE e.class_id = cl.id AND e.status = 'active') AS taken
       FROM classes cl JOIN courses c ON c.id = cl.course_id
      WHERE cl.id = $1`,
    [class_id || null]
  );
  if (!cls) return res.status(400).json({ error: 'Choose a class.' });
  if (cls.capacity && Number(cls.taken) >= cls.capacity) {
    return res.status(400).json({ error: 'This class is full.' });
  }
  const empty = (v) => v === undefined || v === null || v === '';
  const { rows } = await db.query(
    `INSERT INTO enrollments (student_id, class_id, price, discount, status)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [student_id || null, class_id, empty(price) ? cls.price : price,
     empty(discount) ? 0 : discount, status || 'active']
  );
  res.status(201).json(rows[0]);
});

// Editing and deleting reuse the generic routes
enrollments.use(crud('enrollments', ['student_id', 'class_id', 'price', 'discount', 'status']));

app.use('/api/enrollments', requireAuth, enrollments);

app.use('/api/attendance', requireAuth, require('./attendance'));
app.use('/api/payments', requireAuth, require('./payments'));
app.use('/api/profiles', requireAuth, require('./profiles'));
app.use('/api/expenses', requireAuth, require('./expenses'));

// Turn common database errors into messages people can read
app.use((err, req, res, next) => {
  console.error(err);
  if (err.code === '23503') {
    return res.status(400).json({ error: 'This record is linked to other data, so it cannot be changed or deleted.' });
  }
  if (err.code === '23505') {
    const msg = err.constraint === 'enrollments_student_id_class_id_key'
      ? 'This student is already enrolled in this class.'
      : 'This record already exists.';
    return res.status(400).json({ error: msg });
  }
  if (['23502', '23514', '22P02', '22007'].includes(err.code)) {
    return res.status(400).json({ error: 'Some fields are missing or have an invalid value.' });
  }
  res.status(500).json({ error: 'Something went wrong on the server.' });
});

const port = process.env.PORT || 3000;
app.listen(port, '0.0.0.0', () => console.log(`Academy system running on http://localhost:${port}`));
