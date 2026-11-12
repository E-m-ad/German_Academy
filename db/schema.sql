-- Academy management system: starter schema (PostgreSQL)
-- Run with: psql -d academy -f schema.sql

-- Staff who log in to the system
CREATE TABLE users (
  id            INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('admin', 'staff')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE students (
  id         INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  full_name  TEXT NOT NULL,
  phone      TEXT,
  email      TEXT,
  birth_date DATE,
  notes      TEXT,
  status     TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE teachers (
  id        INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  full_name TEXT NOT NULL,
  phone     TEXT,
  email     TEXT,
  active    BOOLEAN NOT NULL DEFAULT true
);

-- What you sell: e.g. "German A1", "German A2", "Goethe B1 Prep"
CREATE TABLE courses (
  id          INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name        TEXT NOT NULL,
  level       TEXT,                        -- A1, A2, B1, B2 ...
  total_hours INT,
  price       NUMERIC(12,2) NOT NULL CHECK (price >= 0)
);

-- A running group of a course: teacher + schedule + dates
CREATE TABLE classes (
  id           INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  course_id    INT NOT NULL REFERENCES courses(id),
  teacher_id   INT REFERENCES teachers(id),
  name         TEXT NOT NULL,              -- e.g. "A1 - Evening - Nov 2026"
  days_of_week TEXT,                       -- e.g. 'Sat,Mon,Wed'
  start_time   TIME,
  end_time     TIME,
  start_date   DATE,
  end_date     DATE,
  capacity     INT,
  status       TEXT NOT NULL DEFAULT 'planned'
               CHECK (status IN ('planned', 'running', 'finished', 'cancelled'))
);

-- A student joining a class (this is where the fee lives)
CREATE TABLE enrollments (
  id          INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  student_id  INT NOT NULL REFERENCES students(id),
  class_id    INT NOT NULL REFERENCES classes(id),
  price       NUMERIC(12,2) NOT NULL CHECK (price >= 0),   -- copied from course at enrollment time
  discount    NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (discount >= 0),
  status      TEXT NOT NULL DEFAULT 'active'
              CHECK (status IN ('active', 'dropped', 'completed')),
  enrolled_at DATE NOT NULL DEFAULT CURRENT_DATE,
  UNIQUE (student_id, class_id)
);

-- Money coming in (a student can pay in installments)
CREATE TABLE payments (
  id            INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  enrollment_id INT NOT NULL REFERENCES enrollments(id),
  amount        NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  method        TEXT NOT NULL DEFAULT 'cash' CHECK (method IN ('cash', 'transfer', 'card')),
  paid_at       DATE NOT NULL DEFAULT CURRENT_DATE,
  received_by   INT REFERENCES users(id),
  note          TEXT
);

-- Money going out (rent, teacher pay, materials ...)
CREATE TABLE expenses (
  id         INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  category   TEXT NOT NULL,
  amount     NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  spent_at   DATE NOT NULL DEFAULT CURRENT_DATE,
  note       TEXT,
  created_by INT REFERENCES users(id)
);

-- How much each student still owes per enrollment
CREATE VIEW enrollment_balances AS
SELECT
  e.id AS enrollment_id,
  e.student_id,
  e.class_id,
  (e.price - e.discount)                              AS total_due,
  COALESCE(SUM(p.amount), 0)                          AS total_paid,
  (e.price - e.discount) - COALESCE(SUM(p.amount), 0) AS remaining
FROM enrollments e
LEFT JOIN payments p ON p.enrollment_id = e.id
GROUP BY e.id;

CREATE INDEX idx_enrollments_student ON enrollments(student_id);
CREATE INDEX idx_enrollments_class   ON enrollments(class_id);
CREATE INDEX idx_payments_enrollment ON payments(enrollment_id);
CREATE INDEX idx_payments_paid_at    ON payments(paid_at);

-- Attendance: one row per student (enrollment) per class day
CREATE TABLE attendance (
  id            INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  enrollment_id INT NOT NULL REFERENCES enrollments(id),
  session_date  DATE NOT NULL,
  status        TEXT NOT NULL CHECK (status IN ('present', 'late', 'absent', 'excused')),
  marked_by     INT REFERENCES users(id),
  UNIQUE (enrollment_id, session_date)
);

CREATE INDEX idx_attendance_date ON attendance(session_date);
