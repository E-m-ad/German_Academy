// Student profile: classes, attendance per class, and payments
(async function () {
  await initPage('students.html');
  const root = document.getElementById('app');
  const id = new URLSearchParams(location.search).get('id');

  let data;
  try {
    data = await api(`/api/profiles/students/${encodeURIComponent(id)}`);
  } catch (err) {
    root.append(el('p', { class: 'msg' }, err.message));
    return;
  }
  const { student, enrollments, attendance, payments } = data;
  const sum = (key) => enrollments.reduce((total, e) => total + Number(e[key]), 0).toFixed(2);

  document.title = student.full_name + ' | ' + APP_NAME;
  document.getElementById('title').textContent = student.full_name;
  root.append(facts([
    ['Phone', student.phone], ['Email', student.email], ['Birth date', student.birth_date],
    ['Status', cap(student.status)], ['Total paid', sum('total_paid')], ['Still owes', sum('remaining')],
  ]));
  if (student.notes) root.append(el('p', { class: 'summary' }, student.notes));

  root.append(el('h2', { class: 'section' }, 'Classes'));
  root.append(tableOf(
    ['Class', 'Course', 'Teacher', 'Status', 'Fee', 'Paid', 'Remaining'],
    enrollments.map((e) => [e.class_name, e.course_name, e.teacher_name, badge(cap(e.status)), e.total_due, e.total_paid, e.remaining]),
    'Not enrolled in any class yet. Add an enrollment on the Enrollments page.'));

  root.append(el('h2', { class: 'section' }, 'Attendance'));
  if (!enrollments.length) root.append(el('p', { class: 'summary' }, 'Attendance appears here once the student is enrolled in a class.'));
  enrollments.forEach((e) => {
    const marks = attendance.filter((a) => a.enrollment_id === e.id);
    const count = (status) => marks.filter((a) => a.status === status).length;
    const details = el('details', { class: 'class-attendance' });
    details.append(el('summary', {},
      `${e.class_name}: ${count('present')} present, ${count('late')} late, ${count('absent')} absent, ${count('excused')} excused`));
    details.append(tableOf(['Date', 'Status'], marks.map((a) => [a.session_date, badge(cap(a.status))]), 'No attendance marked yet.'));
    root.append(details);
  });

  root.append(el('h2', { class: 'section' }, 'Payments'));
  root.append(tableOf(
    ['Date', 'Class', 'Amount', 'Method', 'Note'],
    payments.map((p) => [p.paid_at, p.class_name, p.amount, cap(p.method), p.note]),
    'No payments yet.'));
})();
