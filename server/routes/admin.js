import express from 'express';
import { db, get, all, run, getSetting, setSetting, allSettings, logActivity } from '../db/index.js';
import { requireAuth, requirePermission, can, outranks, hashPassword } from '../lib/auth.js';
import { publicUser, userById, serializeClub } from '../lib/serialize.js';
import { HttpError, wrap, clean, parsePage, inviteCode } from '../lib/util.js';
import { ROLES, ROLE_KEYS, PERMISSIONS } from '../lib/permissions.js';
import { notify } from '../lib/notify.js';
import { awardXp, grantAchievement } from '../lib/xp.js';
import { onlineIds } from '../realtime/hub.js';
import { createMember } from './auth.js';

export const router = express.Router();
router.use(requireAuth, requirePermission('admin.access'));

// ---------------------------------------------------------------------------
// Dashboard statistics
// ---------------------------------------------------------------------------
router.get('/stats', wrap(async (req, res) => {
  const n = (sql, ...p) => get(sql, ...p).n;
  res.json({
    stats: {
      totalStudents: n("SELECT COUNT(*) AS n FROM users WHERE status = 'active'"),
      suspended: n("SELECT COUNT(*) AS n FROM users WHERE status = 'suspended'"),
      onlineStudents: onlineIds().length,
      totalPosts: n('SELECT COUNT(*) AS n FROM posts WHERE is_deleted = 0'),
      totalComments: n('SELECT COUNT(*) AS n FROM comments WHERE is_deleted = 0'),
      totalMessages: n('SELECT COUNT(*) AS n FROM messages WHERE is_deleted = 0'),
      totalClubs: n("SELECT COUNT(*) AS n FROM clubs WHERE status = 'approved'"),
      totalGamesPlayed: n('SELECT COUNT(*) AS n FROM game_scores'),
      pendingClubRequests: n("SELECT COUNT(*) AS n FROM clubs WHERE status = 'pending'"),
      pendingReports: n("SELECT COUNT(*) AS n FROM reports WHERE status IN ('open','reviewing')"),
      homeworkAssignments: n('SELECT COUNT(*) AS n FROM homework WHERE is_deleted = 0'),
      announcements: n('SELECT COUNT(*) AS n FROM announcements WHERE is_deleted = 0'),
      openInvitations: n('SELECT COUNT(*) AS n FROM invitations WHERE used_by IS NULL AND revoked = 0')
    },
    recentActivity: all(`
      SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT 10`)
      .map((l) => ({ id: l.id, actor: l.actor_id ? userById(l.actor_id) : null, action: l.action, targetType: l.target_type, targetId: l.target_id, details: l.details, createdAt: l.created_at }))
  });
}));

// ---------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------
router.get('/users', requirePermission('users.view'), wrap(async (req, res) => {
  const { limit, offset } = parsePage(req.query, 50, 200);
  const search = clean(req.query.search || '', 40);
  const status = clean(req.query.status || '', 20);
  const where = ['1 = 1'];
  const params = [];
  if (search) { where.push('(u.username LIKE ? OR u.display_name LIKE ? OR u.email LIKE ?)'); params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
  if (status) { where.push('u.status = ?'); params.push(status); }

  const rows = all(`
    SELECT u.*, p.avatar_url, p.bio, p.class_section, p.streak_days, p.show_online, r.name AS role_name
    FROM users u
    LEFT JOIN profiles p ON p.user_id = u.id
    LEFT JOIN roles r ON r.key = u.role_key
    WHERE ${where.join(' AND ')} ORDER BY u.display_name LIMIT ? OFFSET ?`, ...params, limit, offset);

  res.json({
    users: rows.map((r) => ({
      ...publicUser(r),
      email: r.email,
      canMessage: !!r.can_message,
      canPost: !!r.can_post,
      suspendReason: r.suspend_reason
    })),
    total: get(`SELECT COUNT(*) AS n FROM users u WHERE ${where.join(' AND ')}`, ...params).n,
    roles: ROLES.map((role) => ({ key: role.key, name: role.name, rank: role.rank }))
  });
}));

router.get('/users/:id', requirePermission('users.view'), wrap(async (req, res) => {
  const id = Number(req.params.id);
  const user = userById(id);
  if (!user) throw new HttpError(404, 'That member could not be found.');
  res.json({
    user,
    activity: all('SELECT * FROM activity_logs WHERE actor_id = ? ORDER BY created_at DESC LIMIT 25', id)
      .map((l) => ({ action: l.action, details: l.details, createdAt: l.created_at })),
    counts: {
      posts: get('SELECT COUNT(*) AS n FROM posts WHERE author_id = ? AND is_deleted = 0', id).n,
      comments: get('SELECT COUNT(*) AS n FROM comments WHERE author_id = ? AND is_deleted = 0', id).n,
      messages: get('SELECT COUNT(*) AS n FROM messages WHERE sender_id = ?', id).n,
      clubs: get('SELECT COUNT(*) AS n FROM club_members WHERE user_id = ?', id).n,
      games: get('SELECT COUNT(*) AS n FROM game_scores WHERE user_id = ?', id).n,
      reportsAgainst: get("SELECT COUNT(*) AS n FROM reports WHERE target_type IN ('user','profile') AND target_id = ?", id).n
    },
    permissions: all('SELECT permission_key, granted FROM user_permissions WHERE user_id = ?', id)
  });
}));

router.post('/users', requirePermission('users.edit'), wrap(async (req, res) => {
  const username = clean(req.body.username, 20);
  const displayName = clean(req.body.displayName, 40) || username;
  const password = String(req.body.password || '');
  const roleKey = ROLE_KEYS.includes(req.body.role) ? req.body.role : 'student';

  if (!/^[a-zA-Z0-9_.]{3,20}$/.test(username)) throw new HttpError(400, 'Usernames need 3-20 letters, numbers, dots or underscores.');
  if (password.length < 8) throw new HttpError(400, 'Give the new account a password of at least 8 characters.');
  if (get('SELECT 1 AS x FROM users WHERE username = ?', username)) throw new HttpError(409, 'That username is already taken.');
  if (!can(req.user, 'users.roles') && roleKey !== 'student') throw new HttpError(403, 'You can only create student accounts.');

  const id = createMember({
    username,
    password,
    displayName,
    email: clean(req.body.email || '', 120).toLowerCase() || null,
    roleKey
  });
  run('UPDATE users SET must_change_pw = 1 WHERE id = ?', id);
  logActivity(req.user.id, 'user.created', 'user', id, `${username} as ${roleKey}`);
  res.status(201).json({ user: userById(id) });
}));

router.patch('/users/:id', requirePermission('users.edit'), wrap(async (req, res) => {
  const target = get('SELECT * FROM users WHERE id = ?', Number(req.params.id));
  if (!target) throw new HttpError(404, 'That member could not be found.');
  if (!outranks(req.user, target)) throw new HttpError(403, 'You cannot edit somebody at or above your own level.');

  const updates = [];
  const params = [];
  if (req.body.displayName !== undefined) { updates.push('display_name = ?'); params.push(clean(req.body.displayName, 40)); }
  if (req.body.email !== undefined) { updates.push('email = ?'); params.push(clean(req.body.email, 120).toLowerCase() || null); }
  if (updates.length) run(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, ...params, target.id);
  if (req.body.bio !== undefined) run('UPDATE profiles SET bio = ? WHERE user_id = ?', clean(req.body.bio, 400), target.id);

  logActivity(req.user.id, 'user.edited', 'user', target.id, target.username);
  res.json({ user: userById(target.id) });
}));

router.post('/users/:id/role', requirePermission('users.roles'), wrap(async (req, res) => {
  const target = get('SELECT * FROM users WHERE id = ?', Number(req.params.id));
  if (!target) throw new HttpError(404, 'That member could not be found.');
  const roleKey = String(req.body.role || '');
  if (!ROLE_KEYS.includes(roleKey)) throw new HttpError(400, 'Choose a valid role.');
  if (!outranks(req.user, target)) throw new HttpError(403, 'You cannot change the role of somebody at or above your own level.');
  const { roleRank } = await import('../lib/permissions.js');
  if (roleRank(roleKey) >= roleRank(req.user.role_key) && req.user.role_key !== 'super_admin') {
    throw new HttpError(403, 'You cannot give somebody a role at or above your own.');
  }

  run('UPDATE users SET role_key = ? WHERE id = ?', roleKey, target.id);
  logActivity(req.user.id, 'user.role_changed', 'user', target.id, `${target.role_key} -> ${roleKey}`);
  notify(target.id, { kind: 'moderation', title: `Your role is now ${roleKey.replace('_', ' ')}`, link: '#/profile', actorId: req.user.id });
  res.json({ user: userById(target.id) });
}));

router.post('/users/:id/suspend', requirePermission('users.suspend'), wrap(async (req, res) => {
  const target = get('SELECT * FROM users WHERE id = ?', Number(req.params.id));
  if (!target) throw new HttpError(404, 'That member could not be found.');
  if (target.id === req.user.id) throw new HttpError(400, 'You cannot suspend yourself.');
  if (!outranks(req.user, target)) throw new HttpError(403, 'You cannot suspend somebody at or above your own level.');

  const suspend = req.body.suspend !== false;
  const reason = clean(req.body.reason || '', 300);
  run('UPDATE users SET status = ?, suspend_reason = ? WHERE id = ?', suspend ? 'suspended' : 'active', suspend ? reason : '', target.id);
  logActivity(req.user.id, suspend ? 'user.suspended' : 'user.unsuspended', 'user', target.id, reason);
  if (!suspend) notify(target.id, { kind: 'moderation', title: 'Your account has been reactivated', link: '#/', actorId: req.user.id });
  res.json({ status: suspend ? 'suspended' : 'active' });
}));

router.post('/users/:id/restrict', requirePermission('users.restrict'), wrap(async (req, res) => {
  const target = get('SELECT * FROM users WHERE id = ?', Number(req.params.id));
  if (!target) throw new HttpError(404, 'That member could not be found.');
  if (!outranks(req.user, target)) throw new HttpError(403, 'You cannot restrict somebody at or above your own level.');

  const updates = [];
  const params = [];
  if (req.body.canMessage !== undefined) { updates.push('can_message = ?'); params.push(req.body.canMessage ? 1 : 0); }
  if (req.body.canPost !== undefined) { updates.push('can_post = ?'); params.push(req.body.canPost ? 1 : 0); }
  if (!updates.length) throw new HttpError(400, 'Nothing to change.');
  run(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, ...params, target.id);

  const details = [
    req.body.canMessage !== undefined ? `messaging ${req.body.canMessage ? 'on' : 'off'}` : '',
    req.body.canPost !== undefined ? `posting ${req.body.canPost ? 'on' : 'off'}` : ''
  ].filter(Boolean).join(', ');
  logActivity(req.user.id, 'user.restricted', 'user', target.id, details);
  notify(target.id, { kind: 'moderation', title: 'An administrator updated your account permissions', body: details, link: '#/settings', actorId: req.user.id });
  res.json({ ok: true, details });
}));

router.post('/users/:id/reset-password', requirePermission('users.edit'), wrap(async (req, res) => {
  const target = get('SELECT * FROM users WHERE id = ?', Number(req.params.id));
  if (!target) throw new HttpError(404, 'That member could not be found.');
  if (!outranks(req.user, target)) throw new HttpError(403, 'You cannot reset that account.');
  const password = String(req.body.password || '');
  if (password.length < 8) throw new HttpError(400, 'The temporary password needs at least 8 characters.');
  run('UPDATE users SET password_hash = ?, must_change_pw = 1 WHERE id = ?', hashPassword(password), target.id);
  logActivity(req.user.id, 'user.password_reset', 'user', target.id, target.username);
  res.json({ ok: true });
}));

router.delete('/users/:id', requirePermission('users.delete'), wrap(async (req, res) => {
  const target = get('SELECT * FROM users WHERE id = ?', Number(req.params.id));
  if (!target) throw new HttpError(404, 'That member could not be found.');
  if (target.id === req.user.id) throw new HttpError(400, 'You cannot delete your own account here.');
  if (!outranks(req.user, target)) throw new HttpError(403, 'You cannot delete somebody at or above your own level.');

  if (req.body?.hard === true) {
    run('DELETE FROM users WHERE id = ?', target.id);
    logActivity(req.user.id, 'user.deleted_permanently', 'user', target.id, target.username);
  } else {
    run("UPDATE users SET status = 'deleted', can_message = 0, can_post = 0 WHERE id = ?", target.id);
    logActivity(req.user.id, 'user.deleted', 'user', target.id, target.username);
  }
  res.json({ ok: true });
}));

router.post('/users/:id/xp', requirePermission('users.xp'), wrap(async (req, res) => {
  const target = get('SELECT * FROM users WHERE id = ?', Number(req.params.id));
  if (!target) throw new HttpError(404, 'That member could not be found.');
  const delta = Math.round(Number(req.body.delta) || 0);
  if (!delta) throw new HttpError(400, 'Enter how much XP to add or remove.');
  const result = awardXp(target.id, delta, 'admin adjustment');
  logActivity(req.user.id, 'user.xp_adjusted', 'user', target.id, `${delta > 0 ? '+' : ''}${delta} XP`);
  res.json({ xp: result?.xp ?? target.xp });
}));

router.post('/users/:id/badge', requirePermission('users.xp'), wrap(async (req, res) => {
  const target = get('SELECT * FROM users WHERE id = ?', Number(req.params.id));
  if (!target) throw new HttpError(404, 'That member could not be found.');
  const key = String(req.body.key || '');
  if (!get('SELECT 1 AS x FROM achievements WHERE key = ?', key)) throw new HttpError(400, 'That badge does not exist.');
  if (req.body.remove) {
    run('DELETE FROM user_achievements WHERE user_id = ? AND achievement_key = ?', target.id, key);
    logActivity(req.user.id, 'user.badge_removed', 'user', target.id, key);
  } else {
    grantAchievement(target.id, key, req.user.id);
    logActivity(req.user.id, 'user.badge_awarded', 'user', target.id, key);
  }
  res.json({ ok: true });
}));

router.get('/badges', wrap(async (_req, res) => {
  res.json({ badges: all('SELECT * FROM achievements ORDER BY name') });
}));

// ---------------------------------------------------------------------------
// Clubs
// ---------------------------------------------------------------------------
router.get('/clubs', requirePermission('clubs.approve'), wrap(async (req, res) => {
  const status = clean(req.query.status || '', 20);
  const rows = status
    ? all('SELECT * FROM clubs WHERE status = ? ORDER BY created_at DESC', status)
    : all('SELECT * FROM clubs ORDER BY CASE status WHEN \'pending\' THEN 0 ELSE 1 END, created_at DESC');
  res.json({
    clubs: rows.map((c) => ({
      ...serializeClub(c, req.user.id),
      members: all('SELECT user_id, club_role FROM club_members WHERE club_id = ?', c.id)
        .map((m) => ({ ...userById(m.user_id), clubRole: m.club_role }))
    }))
  });
}));

router.post('/clubs/:id/status', requirePermission('clubs.approve'), wrap(async (req, res) => {
  const club = get('SELECT * FROM clubs WHERE id = ?', Number(req.params.id));
  if (!club) throw new HttpError(404, 'That club could not be found.');
  const status = ['approved', 'rejected', 'suspended', 'pending'].includes(req.body.status) ? req.body.status : null;
  if (!status) throw new HttpError(400, 'Choose approved, rejected, suspended or pending.');
  const note = clean(req.body.note || '', 300);

  run('UPDATE clubs SET status = ?, reject_note = ? WHERE id = ?', status, note, club.id);
  logActivity(req.user.id, `club.${status}`, 'club', club.id, `${club.name}${note ? ` (${note})` : ''}`);
  notify(club.owner_id, {
    kind: 'club',
    title: `Your club "${club.name}" was ${status}`,
    body: note,
    link: `#/clubs/${club.id}`,
    actorId: req.user.id
  });
  res.json({ status });
}));

router.delete('/clubs/:id', requirePermission('clubs.delete'), wrap(async (req, res) => {
  const club = get('SELECT * FROM clubs WHERE id = ?', Number(req.params.id));
  if (!club) throw new HttpError(404, 'That club could not be found.');
  run('DELETE FROM clubs WHERE id = ?', club.id);
  logActivity(req.user.id, 'club.deleted', 'club', club.id, club.name);
  res.json({ ok: true });
}));

// ---------------------------------------------------------------------------
// Invitations
// ---------------------------------------------------------------------------
router.get('/invitations', requirePermission('users.invite'), wrap(async (req, res) => {
  const rows = all('SELECT * FROM invitations ORDER BY created_at DESC LIMIT 200');
  res.json({
    invitations: rows.map((i) => ({
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
  const roleKey = ROLE_KEYS.includes(req.body.role) ? req.body.role : 'student';
  const { roleRank } = await import('../lib/permissions.js');
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
// Settings, roles and the activity log
// ---------------------------------------------------------------------------
router.get('/settings', requirePermission('settings.manage'), wrap(async (_req, res) => {
  res.json({ settings: allSettings() });
}));

const EDITABLE_SETTINGS = new Set([
  'registration_mode', 'club_creation', 'leaderboard_enabled', 'multiplayer_enabled', 'games_enabled',
  'community_name', 'class_name', 'welcome_message', 'xp_win', 'xp_challenge', 'xp_tournament',
  'xp_post', 'xp_homework_complete'
]);

router.patch('/settings', requirePermission('settings.manage'), wrap(async (req, res) => {
  const changed = [];
  for (const [key, value] of Object.entries(req.body || {})) {
    if (!EDITABLE_SETTINGS.has(key)) continue;
    setSetting(key, clean(String(value), 400));
    changed.push(key);
  }
  if (changed.length) logActivity(req.user.id, 'settings.updated', 'settings', '', changed.join(', '));
  res.json({ settings: allSettings(), changed });
}));

router.get('/roles', wrap(async (_req, res) => {
  res.json({
    roles: ROLES.map((role) => ({
      key: role.key,
      name: role.name,
      rank: role.rank,
      description: role.description,
      permissions: all('SELECT permission_key FROM role_permissions WHERE role_key = ?', role.key).map((r) => r.permission_key)
    })),
    permissions: Object.entries(PERMISSIONS).map(([key, description]) => ({ key, description }))
  });
}));

router.post('/users/:id/permissions', requirePermission('settings.manage'), wrap(async (req, res) => {
  const target = get('SELECT * FROM users WHERE id = ?', Number(req.params.id));
  if (!target) throw new HttpError(404, 'That member could not be found.');
  const key = String(req.body.permission || '');
  if (!Object.keys(PERMISSIONS).includes(key)) throw new HttpError(400, 'That permission does not exist.');
  if (req.body.reset) {
    run('DELETE FROM user_permissions WHERE user_id = ? AND permission_key = ?', target.id, key);
  } else {
    run(`INSERT INTO user_permissions (user_id, permission_key, granted) VALUES (?, ?, ?)
         ON CONFLICT(user_id, permission_key) DO UPDATE SET granted = excluded.granted`,
    target.id, key, req.body.granted ? 1 : 0);
  }
  logActivity(req.user.id, 'user.permission_changed', 'user', target.id, `${key}=${req.body.reset ? 'default' : (req.body.granted ? 'allow' : 'deny')}`);
  res.json({ ok: true });
}));

router.get('/logs', requirePermission('logs.view'), wrap(async (req, res) => {
  const { limit, offset } = parsePage(req.query, 50, 200);
  const search = clean(req.query.search || '', 40);
  const rows = search
    ? all('SELECT * FROM activity_logs WHERE action LIKE ? OR details LIKE ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
      `%${search}%`, `%${search}%`, limit, offset)
    : all('SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT ? OFFSET ?', limit, offset);
  res.json({
    logs: rows.map((l) => ({
      id: l.id,
      actor: l.actor_id ? userById(l.actor_id) : null,
      action: l.action,
      targetType: l.target_type,
      targetId: l.target_id,
      details: l.details,
      createdAt: l.created_at
    })),
    total: get('SELECT COUNT(*) AS n FROM activity_logs').n
  });
}));
