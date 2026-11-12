// Take attendance for one class on one date. The totals columns cover all dates.
(async function () {
  await initPage();

  const STATUSES = [['present', 'Present'], ['late', 'Late'], ['absent', 'Absent'], ['excused', 'Excused']];
  const classSelect = document.getElementById('class');
  const dateInput = document.getElementById('date');
  const tbody = document.getElementById('rows');
  const msg = document.getElementById('msg');

  function show(text, ok) {
    msg.className = ok ? 'ok' : 'msg';
    msg.textContent = text;
  }

  function emptyRow(text) {
    const tr = el('tr');
    tr.append(el('td', { colspan: 6, class: 'empty' }, text));
    tbody.append(tr);
  }

  const classes = await api('/api/classes');
  classes.forEach((c) => classSelect.append(new Option(`${c.name} (${c.course_name})`, c.id)));
  dateInput.value = new Date().toLocaleDateString('en-CA'); // today, as YYYY-MM-DD

  async function load() {
    show('', true);
    tbody.replaceChildren();
    if (!classSelect.value) return emptyRow('No classes yet. Add a class first, then enroll students.');
    if (!dateInput.value) return;
    const rows = await api(
      `/api/attendance?class_id=${encodeURIComponent(classSelect.value)}&date=${encodeURIComponent(dateInput.value)}`);
    if (!rows.length) return emptyRow('No active students in this class yet. Add them on the Enrollments page.');
    rows.forEach((r) => {
      const tr = el('tr', { 'data-enrollment': r.enrollment_id });
      tr.append(el('td', {}, r.student_name));
      const choices = el('td');
      STATUSES.forEach(([value, label]) => {
        const wrap = el('label', { class: 'seg' });
        const radio = el('input', { type: 'radio', name: 's' + r.enrollment_id, value });
        radio.checked = r.status === value;
        wrap.append(radio, document.createTextNode(label));
        choices.append(wrap);
      });
      tr.append(choices);
      ['present', 'late', 'excused', 'absent'].forEach((k) => tr.append(el('td', {}, r[k])));
      tbody.append(tr);
    });
  }

  document.getElementById('all').onclick = () => {
    tbody.querySelectorAll('input[value="present"]').forEach((r) => (r.checked = true));
  };

  document.getElementById('save').onclick = async () => {
    const records = [];
    tbody.querySelectorAll('tr[data-enrollment]').forEach((tr) => {
      const picked = tr.querySelector('input:checked');
      if (picked) records.push({ enrollment_id: tr.dataset.enrollment, status: picked.value });
    });
    if (!records.length) return show('Mark at least one student first.', false);
    try {
      await api('/api/attendance', 'PUT', { class_id: classSelect.value, date: dateInput.value, records });
      await load();
      show(`Saved attendance for ${records.length} student${records.length === 1 ? '' : 's'}.`, true);
    } catch (err) {
      show(err.message, false);
    }
  };

  classSelect.onchange = load;
  dateInput.onchange = load;
  await load();
})();
