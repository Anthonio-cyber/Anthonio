import express from 'express';
import rateLimit from 'express-rate-limit';
import { db, get, run, getSetting, logActivity } from '../db/index.js';
import { hashPassword, checkPassword, issueSession, clearSession, requireAuth, loadUser } from '../lib/auth.js';
import { selfUser } from '../lib/serialize.js';
import { HttpError, wrap, clean, requireFields } from '../lib/util.js';
import { grantBadge } from '../lib/xp.js';
import { notify } from '../lib/notify.js';

export const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many sign-in attempts. Please wait a few minutes and try again.' }
});

const USERNAME_RE = /^[a-zA-Z0-9_.]{3,20}$/;

function createMember({ username, password, displayName, email, roleKey = 'user' }) {
  const insert = db.transaction(() => {
    const info = run(
      'INSERT INTO users (username, email, password_hash, display_name, role_key) VALUES (?, ?, ?, ?, ?)',
      username, email || null, hashPassword(password), displayName, roleKey
    );
    run('INSERT INTO profiles (user_id) VALUES (?)', info.lastInsertRowid);
    return info.lastInsertRowid;
  });
  const id = insert();
  grantBadge(id, 'welcome');
  return id;
}

export { createMember };

// ---- What the sign-in screen needs to know before anybody logs in ----------
router.get('/config', (_req, res) => {
  res.json({
    siteName: getSetting('site_name', 'Coding Hub'),
    description: getSetting('site_description', ''),
    tagline: getSetting('site_tagline', ''),
    welcomeMessage: getSetting('welcome_message', ''),
    registrationMode: getSetting('registration_mode', 'open'),
    maintenanceMode: getSetting('maintenance_mode', 'false') === 'true'
  });
});

router.post('/login', loginLimiter, wrap(async (req, res) => {
  requireFields(req.body, ['username', 'password']);
  const username = clean(req.body.username, 40);
  const row = get('SELECT * FROM users WHERE username = ? OR email = ?', username, username);

  if (!row || !checkPassword(req.body.password, row.password_hash)) {
    throw new HttpError(401, 'That username or password is not correct.', 'bad_credentials');
  }
  if (row.status === 'banned') {
    throw new HttpError(403, `Your account has been banned. ${row.suspend_reason || ''}`.trim(), 'account_banned');
  }
  if (row.status === 'suspended') {
    throw new HttpError(403, `Your account is suspended. ${row.suspend_reason || 'Please speak to an administrator.'}`, 'account_suspended');
  }
  if (row.status === 'deleted') {
    throw new HttpError(403, 'This account no longer exists.', 'account_deleted');
  }

  issueSession(res, row);
  run("UPDATE users SET last_seen = datetime('now') WHERE id = ?", row.id);
  logActivity(row.id, 'user.login', 'user', row.id);
  res.json({ user: selfUser(loadUser(row.id)) });
}));

// ---- Joining with an invitation code --------------------------------------
router.post('/register', loginLimiter, wrap(async (req, res) => {
  requireFields(req.body, ['username', 'password', 'displayName']);
  const mode = getSetting('registration_mode', 'open');
  if (mode === 'closed') {
    throw new HttpError(403, 'The Coding Hub is not accepting new accounts right now.', 'registration_closed');
  }

  const username = clean(req.body.username, 20);
  const displayName = clean(req.body.displayName, 40);
  const email = clean(req.body.email || '', 120).toLowerCase() || null;
  const password = String(req.body.password);
  const code = clean(req.body.code || '', 30).toUpperCase();

  if (!USERNAME_RE.test(username)) {
    throw new HttpError(400, 'Usernames need 3-20 letters, numbers, dots or underscores.', 'bad_username');
  }
  if (password.length < 8) {
    throw new HttpError(400, 'Please choose a password with at least 8 characters.', 'weak_password');
  }
  if (get('SELECT 1 AS x FROM users WHERE username = ?', username)) {
    throw new HttpError(409, 'That username is already taken.', 'username_taken');
  }
  if (email && get('SELECT 1 AS x FROM users WHERE email = ?', email)) {
    throw new HttpError(409, 'That email address is already registered.', 'email_taken');
  }

  let invitation = null;
  let roleKey = 'user';

  if (mode === 'invite') {
    if (!code) throw new HttpError(400, 'An invitation code is required to join.', 'code_required');
    invitation = get('SELECT * FROM invitations WHERE code = ?', code);
    if (!invitation) throw new HttpError(400, 'That invitation code was not recognised.', 'bad_code');
    if (invitation.revoked) throw new HttpError(400, 'That invitation code has been cancelled.', 'code_revoked');
    if (invitation.used_by) throw new HttpError(400, 'That invitation code has already been used.', 'code_used');
    if (invitation.expires_at && new Date(invitation.expires_at) < new Date()) {
      throw new HttpError(400, 'That invitation code has expired.', 'code_expired');
    }
    roleKey = invitation.role_key || 'user';
  }

  const id = createMember({ username, password, displayName, email, roleKey });

  if (invitation) {
    run("UPDATE invitations SET used_by = ?, used_at = datetime('now') WHERE id = ?", id, invitation.id);
    notify(invitation.created_by, {
      kind: 'invite_used',
      title: `${displayName} joined the Coding Hub`,
      body: `Invitation ${invitation.code} has been used.`,
      link: `#/profile/${username}`,
      actorId: id
    });
  }

  logActivity(id, 'user.register', 'user', id, invitation ? `via code ${invitation.code}` : 'open registration');
  issueSession(res, { id });
  res.status(201).json({ user: selfUser(loadUser(id)) });
}));

/** Lets the join screen check a code before the whole form is filled in. */
router.get('/invite/:code', wrap(async (req, res) => {
  const invitation = get('SELECT * FROM invitations WHERE code = ?', clean(req.params.code, 30).toUpperCase());
  if (!invitation || invitation.revoked || invitation.used_by) {
    return res.json({ valid: false, reason: 'This code cannot be used.' });
  }
  if (invitation.expires_at && new Date(invitation.expires_at) < new Date()) {
    return res.json({ valid: false, reason: 'This code has expired.' });
  }
  return res.json({ valid: true, name: invitation.name || '', email: invitation.email || '', role: invitation.role_key });
}));

router.get('/me', wrap(async (req, res) => {
  if (!req.user) return res.json({ user: null });
  return res.json({ user: selfUser(req.user) });
}));

router.post('/logout', (req, res) => {
  if (req.user) logActivity(req.user.id, 'user.logout', 'user', req.user.id);
  clearSession(res);
  res.json({ ok: true });
});

router.post('/change-password', requireAuth, wrap(async (req, res) => {
  requireFields(req.body, ['currentPassword', 'newPassword']);
  const row = get('SELECT * FROM users WHERE id = ?', req.user.id);
  if (!checkPassword(req.body.currentPassword, row.password_hash)) {
    throw new HttpError(400, 'Your current password is not correct.', 'bad_password');
  }
  if (String(req.body.newPassword).length < 8) {
    throw new HttpError(400, 'The new password needs at least 8 characters.', 'weak_password');
  }
  run('UPDATE users SET password_hash = ?, must_change_pw = 0 WHERE id = ?', hashPassword(req.body.newPassword), req.user.id);
  logActivity(req.user.id, 'user.password_changed', 'user', req.user.id);
  res.json({ ok: true });
}));
