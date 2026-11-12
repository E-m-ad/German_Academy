// Course page: its classes and the students enrolled in them
(async function () {
  await initPage('courses.html');
  const root = document.getElementById('app');
  const id = new URLSearchParams(location.search).get('id');

  let data;
  try {
    data = await api(`/api/profiles/courses/${encodeURIComponent(id)}`);
  } catch (err) {
    root.append(el('p', { class: 'msg' }, err.message));
    return;
  }
  const { course, classes, students } = data;

  document.title = course.name + ' | ' + APP_NAME;
  document.getElementById('title').textContent = course.name;
  root.append(facts([
    ['Level', course.level], ['Hours', course.total_hours ? String(course.total_hours) : ''], ['Price', course.price],
  ]));

  root.append(el('h2', { class: 'section' }, 'Classes'));
  root.append(tableOf(
    ['Class', 'Teacher', 'Days', 'Starts', 'Status', 'Active students'],
    classes.map((c) => [c.name, c.teacher_name, c.days_of_week, c.start_date, badge(cap(c.status)), c.active_students]),
    'No classes for this course yet. Add one on the Classes page.'));

  root.append(el('h2', { class: 'section' }, 'Enrolled students'));
  root.append(tableOf(
    ['Student', 'Phone', 'Class', 'Enrollment', 'Remaining'],
    students.map((s) => [el('a', { href: '/student.html?id=' + s.id }, s.full_name), s.phone, s.class_name, badge(cap(s.status)), s.remaining]),
    'No students enrolled in this course yet.'));
})();
