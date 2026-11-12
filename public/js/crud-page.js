// Builds a list page for one resource from a small config object:
// a search box, a table, and an Add / Edit form that opens in a dialog.
// fields:  { name, label, type, required, wide, options | optionsFrom: { url, label (key or function) } }
// columns: { key, label, format, badge, href (function that returns a link for the row) }
// Optional: noEdit (hide Edit buttons), onLoad (called after the table is drawn)
const plural = (word) => (/(s|x|ch|sh)$/.test(word) ? word + 'es' : word + 's');

async function crudPage({ endpoint, noun, fields, columns, noEdit, onLoad }) {
  const me = await initPage();
  const canDelete = me.role === 'admin'; // only admins can delete
  const root = document.getElementById('app');
  const nouns = plural(noun);
  const inputs = {};
  const selects = []; // dropdowns whose options come from the server
  let rows = [];
  let editingId = null;

  function fillSelect(input, f, options) {
    input.replaceChildren();
    if (!f.required) input.append(new Option('None', ''));
    if (f.required && !options.length) input.append(new Option('Nothing to choose yet', ''));
    options.forEach(([value, text]) => input.append(new Option(text, value)));
  }

  async function refreshSelects() {
    for (const [f, input] of selects) {
      const list = await api(f.optionsFrom.url);
      const label = f.optionsFrom.label;
      const keep = input.value;
      fillSelect(input, f, list.map((r) => [r.id, typeof label === 'function' ? label(r) : r[label]]));
      input.value = keep;
    }
  }

  // ---- form, shown inside a dialog ----
  const heading = el('h2', { id: 'form-title', class: 'wide' }, `New ${noun}`);
  const form = el('form', { class: 'form-grid' });
  form.append(heading);
  for (const f of fields) {
    const label = el('label', { class: f.wide || f.type === 'textarea' ? 'wide' : null }, f.label);
    let input;
    if (f.type === 'select') {
      input = el('select');
      if (f.optionsFrom) selects.push([f, input]);
      else fillSelect(input, f, f.options || []);
    } else if (f.type === 'textarea') {
      input = el('textarea', { rows: 2 });
    } else {
      input = el('input', { type: f.type || 'text', step: f.type === 'number' ? 'any' : null });
    }
    input.name = f.name;
    input.required = !!f.required;
    inputs[f.name] = input;
    label.append(input);
    form.append(label);
  }
  const save = el('button', { type: 'submit', class: 'primary' }, `Add ${noun}`);
  const cancel = el('button', { type: 'button', class: 'ghost' }, 'Cancel');
  const msg = el('p', { class: 'msg', role: 'alert' });
  const actions = el('div', { class: 'actions wide' });
  actions.append(save, cancel, msg);
  form.append(actions);

  const body = el('div', { class: 'dialog-body' });
  body.append(form);
  const dialog = el('dialog', { class: 'form-dialog', 'aria-labelledby': 'form-title' });
  dialog.append(body);
  document.body.append(dialog);

  function reset() {
    form.reset();
    editingId = null;
    heading.textContent = `New ${noun}`;
    save.textContent = `Add ${noun}`;
    msg.textContent = '';
  }
  dialog.addEventListener('close', reset); // also runs on Escape
  let pressedOnBackdrop = false;
  dialog.addEventListener('mousedown', (e) => (pressedOnBackdrop = e.target === dialog));
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog && pressedOnBackdrop) dialog.close(); // click outside the form
  });
  cancel.onclick = () => dialog.close();

  function startEdit(row) {
    reset();
    editingId = row.id;
    fields.forEach((f) => (inputs[f.name].value = row[f.name] ?? ''));
    heading.textContent = `Edit ${noun}`;
    save.textContent = 'Save changes';
    dialog.showModal();
  }

  form.onsubmit = async (e) => {
    e.preventDefault();
    const data = {};
    fields.forEach((f) => (data[f.name] = inputs[f.name].value));
    try {
      await api(editingId ? `${endpoint}/${editingId}` : endpoint, editingId ? 'PUT' : 'POST', data);
      dialog.close();
      await load();
    } catch (err) {
      msg.textContent = err.message;
    }
  };

  // ---- toolbar and table ----
  const search = el('input', { type: 'search', class: 'search', placeholder: `Search ${nouns}`, 'aria-label': `Search ${nouns}` });
  const count = el('span', { class: 'count' });
  const addButton = el('button', { type: 'button', class: 'primary' }, `Add ${noun}`);
  addButton.onclick = () => {
    reset();
    dialog.showModal();
  };
  const toolbar = el('div', { class: 'toolbar' });
  toolbar.append(search, count, el('span', { class: 'grow' }), addButton);

  const table = el('table');
  const wrap = el('div', { class: 'table-wrap' });
  wrap.append(table);
  root.append(toolbar, wrap);

  // ---- "more" menu with Delete (one menu shared by all rows) ----
  const rowMenu = el('div', { class: 'row-menu', role: 'menu', hidden: '' });
  const deleteItem = el('button', { type: 'button', role: 'menuitem', class: 'danger-item' }, 'Delete');
  rowMenu.append(deleteItem);
  document.body.append(rowMenu);
  let menuButton = null;
  let menuRow = null;

  function closeRowMenu() {
    rowMenu.hidden = true;
    if (menuButton) menuButton.setAttribute('aria-expanded', 'false');
    menuButton = null;
    menuRow = null;
  }
  function openRowMenu(button, row) {
    if (menuButton === button) return closeRowMenu();
    closeRowMenu();
    menuButton = button;
    menuRow = row;
    button.setAttribute('aria-expanded', 'true');
    rowMenu.hidden = false;
    const b = button.getBoundingClientRect();
    const m = rowMenu.getBoundingClientRect();
    const fitsBelow = b.bottom + 6 + m.height <= window.innerHeight;
    rowMenu.style.top = (fitsBelow ? b.bottom + 6 : b.top - 6 - m.height) + 'px';
    rowMenu.style.left = Math.max(8, b.right - m.width) + 'px';
    deleteItem.focus();
  }
  deleteItem.onclick = () => {
    const row = menuRow;
    closeRowMenu();
    remove(row);
  };
  document.addEventListener('click', (e) => {
    if (!rowMenu.hidden && !rowMenu.contains(e.target) && !(menuButton && menuButton.contains(e.target))) closeRowMenu();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !rowMenu.hidden) {
      const button = menuButton;
      closeRowMenu();
      if (button) button.focus();
    }
  });
  window.addEventListener('scroll', closeRowMenu, true);
  window.addEventListener('resize', closeRowMenu);

  async function remove(row) {
    if (!confirm('Delete this record? This cannot be undone.')) return;
    try {
      await api(`${endpoint}/${row.id}`, 'DELETE');
      await load();
    } catch (err) {
      alert(err.message);
    }
  }

  function cellText(c, row) {
    const value = row[c.key];
    if (c.format) return c.format(value);
    return c.badge ? cap(String(value ?? '')) : value ?? '';
  }

  function render() {
    closeRowMenu();
    const q = search.value.trim().toLowerCase();
    const shown = q
      ? rows.filter((r) => columns.some((c) => String(cellText(c, r)).toLowerCase().includes(q)))
      : rows;
    count.textContent = q
      ? `${shown.length} of ${rows.length} ${nouns}`
      : `${rows.length} ${rows.length === 1 ? noun : nouns}`;

    const thead = el('thead');
    const headRow = el('tr');
    columns.forEach((c) => headRow.append(el('th', {}, c.label)));
    headRow.append(el('th'));
    thead.append(headRow);

    const tbody = el('tbody');
    if (!shown.length) {
      const tr = el('tr');
      tr.append(el('td', { colspan: columns.length + 1, class: 'empty' },
        rows.length ? `No ${nouns} match \u201c${search.value.trim()}\u201d.`
                    : `No ${nouns} yet. Click \u201cAdd ${noun}\u201d to create the first one.`));
      tbody.append(tr);
    }
    shown.forEach((row) => {
      const tr = el('tr');
      columns.forEach((c) => {
        const text = cellText(c, row);
        const content = c.badge && text !== '' ? badge(text) : document.createTextNode(text);
        const td = el('td');
        if (c.href && row[c.key]) {
          const link = el('a', { href: c.href(row) });
          link.append(content);
          td.append(link);
        } else {
          td.append(content);
        }
        tr.append(td);
      });
      const actionsCell = el('td', { class: 'row-actions' });
      if (!noEdit) {
        const edit = el('button', { type: 'button', class: 'ghost' }, 'Edit');
        edit.onclick = () => startEdit(row);
        actionsCell.append(edit);
      }
      if (canDelete) {
        const more = el('button', {
          type: 'button', class: 'ghost more-btn', 'aria-label': 'More actions',
          'aria-haspopup': 'menu', 'aria-expanded': 'false',
        });
        for (let i = 0; i < 3; i++) more.append(el('span', { class: 'more-dot' }));
        more.onclick = () => openRowMenu(more, row);
        actionsCell.append(more);
      }
      tr.append(actionsCell);
      tbody.append(tr);
    });
    table.replaceChildren(thead, tbody);
  }
  search.oninput = render;

  async function load() {
    await refreshSelects();
    rows = await api(endpoint);
    render();
    if (onLoad) await onLoad(rows);
  }

  await load();
}
