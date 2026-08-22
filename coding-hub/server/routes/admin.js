// ==========================================================
// Coding Hub - the administration API (specification 36-52).
//
// Every route states the permission it needs. A member without that
// permission is refused here, on the server, whatever the browser
// shows or sends. Nobody becomes an administrator by editing a page.
// ==========================================================
import express from 'express';
import { db, get, all, run, getSetting, setSetting, allSettings, logActivity } from '../db/index.js';
import { requireAuth, requirePermission, can, outranks, hashPassword } from '../lib/auth.js';
import { publicUser, userById, USER_SELECT } from '../lib/serialize.js';
import { HttpError, wrap, clean, parsePage, inviteCode } from '../lib/util.js';
import { ROLES, ROLE_KEYS, PERMISSIONS, roleRank, DEFAULT_SETTINGS } from '../lib/permissions.js';
import { notify } from '../lib/notify.js';
import { awardXp, grantBadge } from '../lib/xp.js';
import { learnerStats } from '../lib/learn.js';
import { onlineIds } from '../realtime/hub.js';
import { createMember } from './auth.js';

export const router = express.Router();
router.use(requireAuth, requirePermission('admin.access'));

// ---------------------------------------------------------------------------
// Overview (section 37)
// ---------------------------------------------------------------------------
router.get('/stats', wrap(async (_req, res) => {
  const n = (sql, ...p) => get(sql, ...p).n;
  res.json({
    stats: {
      totalUsers: n("SELECT COUNT(*) AS n FROM users WHERE status != 'deleted'"),
      activeUsers: n("SELECT COUNT(*) AS n FROM users WHERE status = 'active'"),
      onlineUsers: onlineIds().length,
      newUsers: n("SELECT COUNT(*) AS n FROM users WHERE created_at >= datetime('now', '-7 days')"),
      suspended: n("SELECT COUNT(*) AS n FROM users WHERE status IN ('suspended','banned')"),

      subjects: n('SELECT COUNT(*) AS n FROM subjects'),
      topics: n('SELECT COUNT(*) AS n FROM topics'),
      lessons: n("SELECT COUNT(*) AS n FROM lessons WHERE status = 'published'"),
      draftLessons: n("SELECT COUNT(*) AS n FROM lessons WHERE status = 'draft'"),
      questions: n('SELECT COUNT(*) AS n FROM questions WHERE published = 1'),
      challenges: n('SELECT COUNT(*) AS n FROM challenges'),

      questionsAnswered: n('SELECT COUNT(*) AS n FROM question_attempts'),
      lessonsCompleted: n("SELECT COUNT(*) AS n FROM lesson_progress WHERE status = 'completed'"),
      challengesCompleted: n('SELECT COUNT(*) AS n FROM challenge_completions'),

      conversations: n('SELECT COUNT(*) AS n FROM conversations'),
      activeConversations: n("SELECT COUNT(DISTINCT conversation_id) AS n FROM messages WHERE created_at >= datetime('now', '-7 days')"),
      messagesSent: n('SELECT COUNT(*) AS n FROM messages WHERE is_deleted = 0'),

      openReports: n("SELECT COUNT(*) AS n FROM reports WHERE status IN ('open','reviewing')"),
      announcements: n('SELECT COUNT(*) AS n FROM announcements WHERE is_deleted = 0'),
      openInvitations: n('SELECT COUNT(*) AS n FROM invitations WHERE used_by IS NULL AND revoked = 0'),
      badges: n('SELECT COUNT(*) AS n FROM badges')
    },
    recentActivity: all('SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT 10')
      .map(serializeLog)
  });
}));

const serializeLog = (l) => ({
  id: l.id,
  actor: l.actor_id ? userById(l.actor_id) : null,
  action: l.action,
  targetType: l.target_type,
  targetId: l.target_id,
  details: l.details,
  createdAt: l.created_at
});

// ---------------------------------------------------------------------------
// Members (section 38)
// ---------------------------------------------------------------------------
router.get('/users', requirePermission('users.view'), wrap(async (req, res) => {
  const { limit, offset } = parsePage(req.query, 50, 200);
  const search = clean(req.query.search || '', 40);
  const status = clean(req.query.status || '', 20);
  const role = clean(req.query.role || '', 20);

  const where = ['1 = 1'];
  const params = [];
  if (search) {
    where.push('(u.username LIKE ? OR u.display_name LIKE ? OR u.email LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (status) { where.push('u.status = ?'); params.push(status); }
  if (role && ROLE_KEYS.includes(role)) { where.push('u.role_key = ?'); params.push(role); }

  const rows = all(`${USER_SELECT} WHERE ${where.join(' AND ')} ORDER BY u.created_at DESC LIMIT ? OFFSET ?`,
    ...params, limit, offset);

  res.json({
    users: rows.map((r) => ({
      ...publicUser(r),
      email: r.email,
      canMessage: !!r.can_message,
      suspendReason: r.suspend_reason || '',
      stats: learnerStats(r.id)
    })),
    total: get(`SELECT COUNT(*) AS n FROM users u WHERE ${where.join(' AND ')}`, ...params).n,
    roles: ROLES.map((r) => ({ key: r.key, name: r.name, rank: r.rank }))
  });
}));

router.get('/users/:id', requirePermission('users.view'), wrap(async (req, res) => {
  const row = get(`${USER_SELECT} WHERE u.id = ?`, Number(req.params.id));
  if (!row) throw new HttpError(404, 'That member could not be found.');
  res.json({
    user: { ...publicUser(row), email: row.email, canMessage: !!row.can_message, suspendReason: row.suspend_reason || '' },
    stats: learnerStats(row.id),
    badges: all(`SELECT b.key, b.name, b.icon, ub.awarded_at FROM user_badges ub
                 JOIN badges b ON b.key = ub.badge_key WHERE ub.user_id = ?`, row.id),
    permissions: all('SELECT permission_key, granted FROM user_permissions WHERE user_id = ?', row.id),
    activity: all('SELECT * FROM activity_logs WHERE actor_id = ? ORDER BY created_at DESC LIMIT 20').map(serializeLog),
    recentAttempts: get('SELECT COUNT(*) AS n FROM question_attempts WHERE user_id = ?', row.id).n
  });
}));

/** Nobody may act on somebody at or above their own level. */
function assertOutranks(actor, targetRow) {
  if (!outranks(actor, targetRow)) {
    throw new HttpError(403, 'You cannot act on somebody at or above your own level.', 'outranked');
  }
}

router.post('/users', requirePermission('users.create'), wrap(async (req, res) => {
  const username = clean(req.body.username, 20);
  const displayName = clean(req.body.displayName, 40) || username;
  const password = String(req.body.password || '');
  if (!username || password.length < 8) {
    throw new HttpError(400, 'A username and a password of at least 8 characters are required.');
  }
  if (get('SELECT 1 AS x FROM users WHERE username = ?', username)) {
    throw new HttpError(409, 'That username is already taken.');
  }
  const roleKey = ROLE_KEYS.includes(req.body.role) ? req.body.role : 'user';
  if (roleRank(roleKey) >= roleRank(req.user.role_key) && req.user.role_key !== 'super_admin') {
    throw new HttpError(403, 'You cannot create an account at or above your own level.');
  }

  const id = createMember({
    username, password, displayName,
    email: clean(req.body.email || '', 120) || null,
    roleKey
  });
  run('UPDATE users SET must_change_pw = 1 WHERE id = ?', id);
  logActivity(req.user.id, 'user.created', 'user', id, `${username} as ${roleKey}`);
  res.status(201).json({ user: userById(id) });
}));

router.patch('/users/:id', requirePermission('users.edit'), wrap(async (req, res) => {
  const target = get('SELECT * FROM users WHERE id = ?', Number(req.params.id));
  if (!target) throw new HttpError(404, 'That member could not be found.');
  assertOutranks(req.user, target);

  const updates = [];
  const params = [];
  if (req.body.displayName !== undefined) { updates.push('display_name = ?'); params.push(clean(req.body.displayName, 40)); }
  if (req.body.email !== undefined) { updates.push('email = ?'); params.push(clean(req.body.email, 120) || null); }
  if (req.body.verified !== undefined && can(req.user, 'users.verify')) {
    updates.push('verified = ?');
    params.push(req.body.verified ? 1 : 0);
  }
  if (updates.length) run(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, ...params, target.id);
  logActivity(req.user.id, 'user.edited', 'user', target.id, target.username);
  res.json({ user: userById(target.id) });
}));

router.post('/users/:id/role', requirePermission('users.roles'), wrap(async (req, res) => {
  const target = get('SELECT * FROM users WHERE id = ?', Number(req.params.id));
  if (!target) throw new HttpError(404, 'That member could not be found.');
  assertOutranks(req.user, target);

  const role = ROLE_KEYS.includes(req.body.role) ? req.body.role : null;
  if (!role) throw new HttpError(400, 'That role does not exist.');
  if (roleRank(role) >= roleRank(req.user.role_key) && req.user.role_key !== 'super_admin') {
    throw new HttpError(403, 'You cannot give somebody a role at or above your own.');
  }
  // The last super admin must not be able to lock everybody out.
  if (target.role_key === 'super_admin' && role !== 'super_admin') {
    const remaining = get("SELECT COUNT(*) AS n FROM users WHERE role_key = 'super_admin' AND status = 'active'").n;
    if (remaining <= 1) throw new HttpError(400, 'This is the last Super Admin. Give somebody else the role first.');
  }

  run('UPDATE users SET role_key = ? WHERE id = ?', role, target.id);
  logActivity(req.user.id, 'user.role_changed', 'user', target.id, `${target.username}: ${target.role_key} -> ${role}`);
  notify(target.id, { kind: 'account', title: `Your role is now ${role.replace('_', ' ')}`, actorId: req.user.id });
  res.json({ user: userById(target.id) });
}));

router.post('/users/:id/status', requirePermission('users.suspend'), wrap(async (req, res) => {
  const target = get('SELECT * FROM users WHERE id = ?', Number(req.params.id));
  if (!target) throw new HttpError(404, 'That member could not be found.');
  assertOutranks(req.user, target);

  const status = ['active', 'suspended', 'banned'].includes(req.body.status) ? req.body.status : null;
  if (!status) throw new HttpError(400, 'Choose active, suspended or banned.');
  const reason = clean(req.body.reason || '', 300);

  run('UPDATE users SET status = ?, suspend_reason = ? WHERE id = ?', status, reason, target.id);
  logActivity(req.user.id, `user.${status}`, 'user', target.id, `${target.username}${reason ? ` (${reason})` : ''}`);
  if (status === 'active') {
    notify(target.id, { kind: 'account', title: 'Your account is active again', actorId: req.user.id });
  }
  res.json({ user: userById(target.id) });
}));

router.post('/users/:id/restrict', requirePermission('users.restrict'), wrap(async (req, res) => {
  const target = get('SELECT * FROM users WHERE id = ?', Number(req.params.id));
  if (!target) throw new HttpError(404, 'That member could not be found.');
  assertOutranks(req.user, target);
  run('UPDATE users SET can_message = ? WHERE id = ?', req.body.canMessage ? 1 : 0, target.id);
  logActivity(req.user.id, req.body.canMessage ? 'user.messaging_restored' : 'user.messaging_restricted',
    'user', target.id, target.username);
  res.json({ user: userById(target.id), canMessage: !!req.body.canMessage });
}));

router.post('/users/:id/reset-password', requirePermission('users.password'), wrap(async (req, res) => {
  const target = get('SELECT * FROM users WHERE id = ?', Number(req.params.id));
  if (!target) throw new HttpError(404, 'That member could not be found.');
  assertOutranks(req.user, target);
  const password = String(req.body.password || '');
  if (password.length < 8) throw new HttpError(400, 'The new password needs at least 8 characters.');
  run('UPDATE users SET password_hash = ?, must_change_pw = 1 WHERE id = ?', hashPassword(password), target.id);
  logActivity(req.user.id, 'user.password_reset', 'user', target.id, target.username);
  res.json({ ok: true });
}));

router.post('/users/:id/xp', requirePermission('users.xp'), wrap(async (req, res) => {
  const target = get('SELECT * FROM users WHERE id = ?', Number(req.params.id));
  if (!target) throw new HttpError(404, 'That member could not be found.');
  const delta = Math.trunc(Number(req.body.delta) || 0);
  if (!delta) throw new HttpError(400, 'Give an amount to add or take away.');
  awardXp(target.id, delta, 'admin adjustment');
  logActivity(req.user.id, 'user.xp_adjusted', 'user', target.id, `${delta > 0 ? '+' : ''}${delta} XP`);
  res.json({ user: userById(target.id) });
}));

/** Wipes somebody's learning progress. Their account and messages stay. */
router.post('/users/:id/reset-progress', requirePermission('users.xp'), wrap(async (req, res) => {
  const target = get('SELECT * FROM users WHERE id = ?', Number(req.params.id));
  if (!target) throw new HttpError(404, 'That member could not be found.');
  assertOutranks(req.user, target);

  db.transaction(() => {
    run('DELETE FROM lesson_progress WHERE user_id = ?', target.id);
    run('DELETE FROM question_attempts WHERE user_id = ?', target.id);
    run('DELETE FROM challenge_completions WHERE user_id = ?', target.id);
    run('UPDATE users SET xp = 0 WHERE id = ?', target.id);
  })();

  logActivity(req.user.id, 'user.progress_reset', 'user', target.id, target.username);
  notify(target.id, { kind: 'account', title: 'Your learning progress was reset', actorId: req.user.id });
  res.json({ ok: true, user: userById(target.id) });
}));

router.post('/users/:id/badge', requirePermission('users.badges'), wrap(async (req, res) => {
  const target = get('SELECT * FROM users WHERE id = ?', Number(req.params.id));
  if (!target) throw new HttpError(404, 'That member could not be found.');
  const key = clean(req.body.key, 40);
  if (!get('SELECT 1 AS x FROM badges WHERE key = ?', key)) throw new HttpError(400, 'That badge does not exist.');

  if (req.body.remove) {
    run('DELETE FROM user_badges WHERE user_id = ? AND badge_key = ?', target.id, key);
    logActivity(req.user.id, 'user.badge_removed', 'user', target.id, key);
  } else {
    grantBadge(target.id, key, req.user.id);
    logActivity(req.user.id, 'user.badge_given', 'user', target.id, key);
  }
  res.json({ ok: true });
}));

router.delete('/users/:id', requirePermission('users.delete'), wrap(async (req, res) => {
  const target = get('SELECT * FROM users WHERE id = ?', Number(req.params.id));
  if (!target) throw new HttpError(404, 'That member could not be found.');
  assertOutranks(req.user, target);
  if (target.role_key === 'super_admin') {
    const remaining = get("SELECT COUNT(*) AS n FROM users WHERE role_key = 'super_admin' AND status = 'active'").n;
    if (remaining <= 1) throw new HttpError(400, 'This is the last Super Admin and cannot be deleted.');
  }

  if (req.body?.hard) {
    run('DELETE FROM users WHERE id = ?', target.id);
    logActivity(req.user.id, 'user.deleted_permanently', 'user', target.id, target.username);
  } else {
    run("UPDATE users SET status = 'deleted' WHERE id = ?", target.id);
    logActivity(req.user.id, 'user.deleted', 'user', target.id, target.username);
  }
  res.json({ ok: true });
}));

// ---------------------------------------------------------------------------
// Badges (section 32)
// ---------------------------------------------------------------------------
router.get('/badges', wrap(async (_req, res) => {
  res.json({
    badges: all(`
      SELECT b.*, (SELECT COUNT(*) FROM user_badges WHERE badge_key = b.key) AS awarded
      FROM badges b ORDER BY b.is_custom, b.name`)
      .map((b) => ({ ...b, isCustom: !!b.is_custom }))
  });
}));

router.post('/badges', requirePermission('badges.manage'), wrap(async (req, res) => {
  const key = clean(req.body.key, 40).toLowerCase().replace(/[^a-z0-9_]/g, '_');
  const name = clean(req.body.name, 60);
  if (!key || !name) throw new HttpError(400, 'A badge needs a key and a name.');
  if (get('SELECT 1 AS x FROM badges WHERE key = ?', key)) throw new HttpError(409, 'That badge key already exists.');

  run('INSERT INTO badges (key, name, description, icon, is_custom) VALUES (?, ?, ?, ?, 1)',
    key, name, clean(req.body.description || '', 300), clean(req.body.icon || 'award', 20));
  logActivity(req.user.id, 'badge.created', 'badge', key, name);
  res.status(201).json({ badge: get('SELECT * FROM badges WHERE key = ?', key) });
}));

router.patch('/badges/:key', requirePermission('badges.manage'), wrap(async (req, res) => {
  const badge = get('SELECT * FROM badges WHERE key = ?', clean(req.params.key, 40));
  if (!badge) throw new HttpError(404, 'That badge could not be found.');
  run('UPDATE badges SET name = ?, description = ?, icon = ? WHERE key = ?',
    clean(req.body.name || badge.name, 60), clean(req.body.description ?? badge.description, 300),
    clean(req.body.icon || badge.icon, 20), badge.key);
  logActivity(req.user.id, 'badge.edited', 'badge', badge.key, badge.name);
  res.json({ badge: get('SELECT * FROM badges WHERE key = ?', badge.key) });
}));

router.delete('/badges/:key', requirePermission('badges.manage'), wrap(async (req, res) => {
  const badge = get('SELECT * FROM badges WHERE key = ?', clean(req.params.key, 40));
  if (!badge) throw new HttpError(404, 'That badge could not be found.');
  if (!badge.is_custom) throw new HttpError(400, 'Built-in badges cannot be deleted. Rename it instead.');
  run('DELETE FROM badges WHERE key = ?', badge.key);
  logActivity(req.user.id, 'badge.deleted', 'badge', badge.key, badge.name);
  res.json({ ok: true });
}));

// ---------------------------------------------------------------------------
// Invitations
// ---------------------------------------------------------------------------
router.get('/invitations', requirePermission('users.invite'), wrap(async (_req, res) => {
  res.json({
    invitations: all('SELECT * FROM invitations ORDER BY created_at DESC LIMIT 200').map((i) => ({
      id: i.id,
      code: i.code,
      name: i.name,
      email: i.email,
      role: i.role_key,
      revoked: !!i.revoked,
      expiresAt: i.expires_at,
      createdAt: i.created_at,
      createdBy: userById(i.created_by),
      usedBy: i.used_by ? userById(i.used_by) : null,
      usedAt: i.used_at
    }))
  });
}));

router.post('/invitations', requirePermission('users.invite'), wrap(async (req, res) => {
  const roleKey = ROLE_KEYS.includes(req.body.role) ? req.body.role : 'user';
  if (roleRank(roleKey) >= roleRank(req.user.role_key) && req.user.role_key !== 'super_admin') {
    throw new HttpError(403, 'You cannot invite somebody at or above your own level.');
  }
  let code = inviteCode();
  let guard = 0;
  while (get('SELECT 1 AS x FROM invitations WHERE code = ?', code) && guard < 20) { code = inviteCode(); guard += 1; }

  const info = run('INSERT INTO invitations (code, name, email, role_key, created_by, expires_at) VALUES (?, ?, ?, ?, ?, ?)',
    code, clean(req.body.name || '', 60), clean(req.body.email || '', 120), roleKey, req.user.id,
    clean(req.body.expiresAt || '', 30) || null);
  logActivity(req.user.id, 'invitation.created', 'invitation', info.lastInsertRowid, code);
  res.status(201).json({ code, id: info.lastInsertRowid });
}));

router.post('/invitations/:id/revoke', requirePermission('users.invite'), wrap(async (req, res) => {
  const invitation = get('SELECT * FROM invitations WHERE id = ?', Number(req.params.id));
  if (!invitation) throw new HttpError(404, 'That invitation could not be found.');
  run('UPDATE invitations SET revoked = 1 WHERE id = ?', invitation.id);
  logActivity(req.user.id, 'invitation.revoked', 'invitation', invitation.id, invitation.code);
  res.json({ ok: true });
}));

// ---------------------------------------------------------------------------
// Roles, permissions, settings and the log (sections 47-49)
// ---------------------------------------------------------------------------
router.get('/roles', wrap(async (_req, res) => {
  res.json({
    roles: ROLES.map((role) => ({
      key: role.key,
      name: role.name,
      rank: role.rank,
      description: role.description,
      memberCount: get('SELECT COUNT(*) AS n FROM users WHERE role_key = ?', role.key).n,
      permissions: all('SELECT permission_key FROM role_permissions WHERE role_key = ?', role.key)
        .map((r) => r.permission_key)
    })),
    permissions: Object.entries(PERMISSIONS).map(([key, description]) => ({ key, description }))
  });
}));

router.post('/users/:id/permissions', requirePermission('permissions.manage'), wrap(async (req, res) => {
  const target = get('SELECT * FROM users WHERE id = ?', Number(req.params.id));
  if (!target) throw new HttpError(404, 'That member could not be found.');
  assertOutranks(req.user, target);
  const key = String(req.body.permission || '');
  if (!Object.keys(PERMISSIONS).includes(key)) throw new HttpError(400, 'That permission does not exist.');

  if (req.body.reset) {
    run('DELETE FROM user_permissions WHERE user_id = ? AND permission_key = ?', target.id, key);
  } else {
    run(`INSERT INTO user_permissions (user_id, permission_key, granted) VALUES (?, ?, ?)
         ON CONFLICT(user_id, permission_key) DO UPDATE SET granted = excluded.granted`,
    target.id, key, req.body.granted ? 1 : 0);
  }
  logActivity(req.user.id, 'user.permission_changed', 'user', target.id,
    `${key} = ${req.body.reset ? 'role default' : (req.body.granted ? 'allow' : 'deny')}`);
  res.json({ ok: true });
}));

router.get('/settings', requirePermission('settings.manage'), wrap(async (_req, res) => {
  res.json({ settings: allSettings(), defaults: DEFAULT_SETTINGS });
}));

const EDITABLE_SETTINGS = new Set([...Object.keys(DEFAULT_SETTINGS), 'maintenance_message']);

router.patch('/settings', requirePermission('settings.manage'), wrap(async (req, res) => {
  const changed = [];
  for (const [key, value] of Object.entries(req.body || {})) {
    if (!EDITABLE_SETTINGS.has(key)) continue;
    setSetting(key, clean(String(value), 600));
    changed.push(key);
  }
  if (changed.length) logActivity(req.user.id, 'settings.updated', 'settings', '', changed.join(', '));
  res.json({ settings: allSettings(), changed });
}));

router.get('/logs', requirePermission('logs.view'), wrap(async (req, res) => {
  const { limit, offset } = parsePage(req.query, 50, 200);
  const search = clean(req.query.search || '', 40);
  const rows = search
    ? all(`SELECT * FROM activity_logs WHERE action LIKE ? OR details LIKE ?
           ORDER BY created_at DESC LIMIT ? OFFSET ?`, `%${search}%`, `%${search}%`, limit, offset)
    : all('SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT ? OFFSET ?', limit, offset);
  res.json({
    logs: rows.map(serializeLog),
    total: get('SELECT COUNT(*) AS n FROM activity_logs').n
  });
}));

// ---------------------------------------------------------------------------
// Platform analytics (section 51)
// ---------------------------------------------------------------------------
router.get('/analytics', requirePermission('analytics.view'), wrap(async (_req, res) => {
  const n = (sql, ...p) => get(sql, ...p).n;
  const activeSince = (days) => n(
    `SELECT COUNT(DISTINCT user_id) AS n FROM question_attempts WHERE created_at >= datetime('now', ?)`,
    `-${days} days`);

  const attempts = get('SELECT COUNT(*) AS total, COALESCE(SUM(correct), 0) AS correct FROM question_attempts');

  res.json({
    activeUsers: { daily: activeSince(1), weekly: activeSince(7), monthly: activeSince(30) },
    registrations: all(`
      SELECT date(created_at) AS day, COUNT(*) AS count FROM users
      WHERE created_at >= datetime('now', '-30 days') GROUP BY day ORDER BY day`),
    totals: {
      lessonsCompleted: n("SELECT COUNT(*) AS n FROM lesson_progress WHERE status = 'completed'"),
      questionsAnswered: attempts.total,
      messagesSent: n('SELECT COUNT(*) AS n FROM messages WHERE is_deleted = 0'),
      activeConversations: n("SELECT COUNT(DISTINCT conversation_id) AS n FROM messages WHERE created_at >= datetime('now', '-7 days')")
    },
    averageAccuracy: attempts.total ? Math.round((attempts.correct / attempts.total) * 100) : 0,
    popularSubjects: all(`
      SELECT s.name, COUNT(lp.lesson_id) AS opens FROM subjects s
      JOIN topics t ON t.subject_id = s.id
      JOIN lessons l ON l.topic_id = t.id
      LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id
      GROUP BY s.id ORDER BY opens DESC LIMIT 8`),
    hardestTopics: all(`
      SELECT t.name, s.name AS subject_name, COUNT(*) AS answered, COALESCE(SUM(qa.correct), 0) AS correct
      FROM question_attempts qa
      JOIN questions q ON q.id = qa.question_id
      JOIN topics t ON t.id = q.topic_id
      JOIN subjects s ON s.id = t.subject_id
      GROUP BY t.id HAVING answered >= 5
      ORDER BY (CAST(correct AS REAL) / answered) ASC LIMIT 8`)
      .map((r) => ({ ...r, accuracy: Math.round((r.correct / r.answered) * 100) })),
    mostActive: all(`
      SELECT u.id, COUNT(qa.id) AS answered FROM users u
      JOIN question_attempts qa ON qa.user_id = u.id
      WHERE u.status = 'active' GROUP BY u.id ORDER BY answered DESC LIMIT 10`)
      .map((r) => ({ user: userById(r.id), questionsAnswered: r.answered }))
  });
}));

// ---------------------------------------------------------------------------
// Messaging moderation (section 46)
// ---------------------------------------------------------------------------
router.get('/messages/access-log', requirePermission('logs.view'), wrap(async (_req, res) => {
  res.json({
    entries: all('SELECT * FROM message_access_logs ORDER BY created_at DESC LIMIT 200').map((row) => ({
      id: row.id,
      moderator: userById(row.moderator_id),
      conversationId: row.conversation_id,
      reportId: row.report_id,
      reason: row.reason,
      createdAt: row.created_at
    }))
  });
}));

router.get('/messages/stats', requirePermission('messages.moderate'), wrap(async (_req, res) => {
  const n = (sql) => get(sql).n;
  res.json({
    conversations: n('SELECT COUNT(*) AS n FROM conversations'),
    messages: n('SELECT COUNT(*) AS n FROM messages WHERE is_deleted = 0'),
    deleted: n('SELECT COUNT(*) AS n FROM messages WHERE is_deleted = 1'),
    reported: n("SELECT COUNT(*) AS n FROM reports WHERE target_type = 'message'"),
    restricted: n('SELECT COUNT(*) AS n FROM users WHERE can_message = 0'),
    busiest: all(`
      SELECT conversation_id, COUNT(*) AS messages FROM messages
      WHERE created_at >= datetime('now', '-30 days')
      GROUP BY conversation_id ORDER BY messages DESC LIMIT 10`)
  });
}));
