const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db');

const router = express.Router();
const COOKIE = 'token';

function requireAuth(req, res, next) {
  try {
    req.user = jwt.verify(req.cookies[COOKIE], process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Please sign in first' });
  }
}

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  const { rows } = await db.query('SELECT * FROM users WHERE email = $1', [email]);
  const user = rows[0];
  if (!user || !(await bcrypt.compare(password || '', user.password_hash))) {
    return res.status(401).json({ error: 'Wrong email or password' });
  }
  const token = jwt.sign(
    { id: user.id, name: user.name, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '12h' }
  );
  res.cookie(COOKIE, token, { httpOnly: true, sameSite: 'lax', maxAge: 12 * 3600 * 1000 });
  res.json({ name: user.name, role: user.role });
});

router.post('/logout', (req, res) => {
  res.clearCookie(COOKIE);
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => res.json(req.user));

// Only admin accounts may pass (used for deleting records)
function requireAdmin(req, res, next) {
  if (req.user && req.user.role === 'admin') return next();
  res.status(403).json({ error: 'Only an admin can delete records.' });
}

module.exports = { router, requireAuth, requireAdmin };
