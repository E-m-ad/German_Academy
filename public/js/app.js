// Shared helpers used by every page
const APP_NAME = 'Deutsch Prima';

const PAGES = [
  ['students.html', 'Students'],
  ['classes.html', 'Classes'],
  ['enrollments.html', 'Enrollments'],
  ['payments.html', 'Payments'],
  ['expenses.html', 'Expenses'],
  ['attendance.html', 'Attendance'],
  ['courses.html', 'Courses'],
  ['teachers.html', 'Teachers'],
];

// Create a DOM element. Text is set with textContent, so user data can never inject HTML.
function el(tag, attrs = {}, text) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value != null) node.setAttribute(key, value);
  }
  if (text != null) node.textContent = text;
  return node;
}

// Call the server. Throws an Error with a readable message when something fails.
async function api(url, method = 'GET', body) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const onLoginPage = location.pathname === '/' || location.pathname.endsWith('/index.html');
  if (res.status === 401 && !onLoginPage) {
    location.href = '/';
    return new Promise(() => {}); // stop here while the browser redirects
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// Check the user is signed in and draw the top bar
async function initPage(activeHref) {
  const me = await api('/api/auth/me');
  const nav = document.getElementById('nav');
  if (!document.title.includes(APP_NAME)) document.title += ' | ' + APP_NAME;

  const brand = el('a', { class: 'brand', href: 'students.html' });
  brand.append(el('img', { src: '/img/mark.png', alt: '' }), el('span', {}, APP_NAME));

  // Links and sign-out share one container so they can fold into a dropdown on small screens
  const menu = el('div', { class: 'menu', id: 'nav-menu' });
  PAGES.forEach(([href, label]) => {
    const link = el('a', { href }, label);
    if (location.pathname.endsWith(href) || href === activeHref) link.className = 'active';
    menu.append(link);
  });
  menu.append(el('span', { class: 'spacer' }));
  const logout = el('button', { type: 'button', class: 'signout' }, `Sign out (${me.name})`);
  logout.onclick = async () => {
    await api('/api/auth/logout', 'POST');
    location.href = '/';
  };
  menu.append(logout);

  const toggle = el('button', {
    type: 'button', class: 'menu-toggle', 'aria-label': 'Menu',
    'aria-expanded': 'false', 'aria-controls': 'nav-menu',
  });
  for (let i = 0; i < 3; i++) toggle.append(el('span', { class: 'menu-bar' }));

  nav.append(brand, menu, el('span', { class: 'flag-cap', 'aria-hidden': 'true' }), toggle);

  function setOpen(open) {
    nav.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', String(open));
  }

  // Switch to the menu button as soon as the links no longer fit in one row
  function fitNav() {
    nav.classList.remove('collapsed');
    const collapse = nav.scrollWidth > nav.clientWidth + 1;
    nav.classList.toggle('collapsed', collapse);
    if (!collapse) setOpen(false);
  }

  toggle.onclick = () => setOpen(!nav.classList.contains('open'));
  document.addEventListener('click', (e) => { if (!nav.contains(e.target)) setOpen(false); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && nav.classList.contains('open')) {
      setOpen(false);
      toggle.focus();
    }
  });
  let frame;
  window.addEventListener('resize', () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(fitNav);
  });
  fitNav();
  return me; // { name, role } of the signed-in user
}

// ---- Helpers for read-only profile pages ----
const cap = (v) => (v ? v.charAt(0).toUpperCase() + v.slice(1) : '');

// A table from arrays. Each cell is text or a DOM node (for links).
function tableOf(headers, rows, emptyText) {
  const wrap = el('div', { class: 'table-wrap' });
  const thead = el('thead');
  const headRow = el('tr');
  headers.forEach((h) => headRow.append(el('th', {}, h)));
  thead.append(headRow);
  const tbody = el('tbody');
  if (!rows.length) {
    const tr = el('tr');
    tr.append(el('td', { colspan: headers.length, class: 'empty' }, emptyText));
    tbody.append(tr);
  }
  rows.forEach((cells) => {
    const tr = el('tr');
    cells.forEach((cell) => {
      const td = el('td');
      if (cell instanceof Node) td.append(cell);
      else td.textContent = cell ?? '';
      tr.append(td);
    });
    tbody.append(tr);
  });
  const table = el('table');
  table.append(thead, tbody);
  wrap.append(table);
  return wrap;
}

// A row of "Label value" facts; empty values are skipped
function facts(pairs) {
  const box = el('div', { class: 'facts' });
  pairs.filter(([, value]) => value).forEach(([label, value]) => {
    const item = el('span');
    item.append(el('strong', {}, label + ' '), document.createTextNode(value));
    box.append(item);
  });
  return box;
}

// A small colored label for statuses (Active, Planned, Present ...)
const BADGE_TONES = {
  active: 'ok', running: 'ok', yes: 'ok', present: 'ok',
  planned: 'warn', late: 'warn',
  completed: 'neutral', inactive: 'neutral', finished: 'neutral', no: 'neutral', excused: 'neutral',
  dropped: 'bad', cancelled: 'bad', absent: 'bad',
};
function badge(text) {
  return el('span', { class: 'badge ' + (BADGE_TONES[String(text).toLowerCase()] || 'neutral') }, text);
}
