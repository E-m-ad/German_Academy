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
