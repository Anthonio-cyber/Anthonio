// ==========================================================
// Coding Hub - accounts, profiles, connections and blocking.
// ==========================================================
import express from 'express';
import { get, all, run, getSetting, logActivity } from '../db/index.js';
import { requireAuth, can } from '../lib/auth.js';
import { publicUser, selfUser, userById, USER_SELECT } from '../lib/serialize.js';
import { HttpError, wrap, clean, parsePage } from '../lib/util.js';
import { imageUploader, publicUrl } from '../lib/uploads.js';
import { onlineIds } from '../realtime/hub.js';
import { notify } from '../lib/notify.js';
import { grantBadge } from '../lib/xp.js';
import { learnerStats, subjectBreakdown } from '../lib/learn.js';

export const router = express.Router();
router.use(requireAuth);

const USERNAME_RE = /^[a-zA-Z0-9_.]{3,20}$/;

// ---- The member directory --------------------------------------------------
router.get('/', wrap(async (req, res) => {
  const { limit, offset } = parsePage(req.query, 30, 100);
  const search = clean(req.query.search || '', 40);
  const rows = search
    ? all(`${USER_SELECT} WHERE u.status = 'active' AND (u.username LIKE ? OR u.display_name LIKE ?)
           ORDER BY u.display_name LIMIT ? OFFSET ?`, `%${search}%`, `%${search}%`, limit, offset)
    : all(`${USER_SELECT} WHERE u.status = 'active' ORDER BY u.xp DESC LIMIT ? OFFSET ?`, limit, offset);
  res.json({ users: rows.map(publicUser) });
}));

router.get('/online', wrap(async (_req, res) => {
  res.json({ users: onlineIds().map(userById).filter((u) => u && u.online) });
}));

/** The leaderboards from section 33 of the specification. */
router.get('/leaderboard/:category', wrap(async (req, res) => {
  if (getSetting('leaderboards_enabled', 'true') !== 'true') {
    return res.json({ enabled: false, entries: [] });
  }
  const category = clean(req.params.category, 20);
  const queries = {
    xp: `SELECT u.id, u.xp AS score FROM users u WHERE u.status = 'active' ORDER BY u.xp DESC LIMIT 25`,
    questions: `SELECT u.id, COUNT(qa.id) AS score FROM users u
                JOIN question_attempts qa ON qa.user_id = u.id
                WHERE u.status = 'active' GROUP BY u.id ORDER BY score DESC LIMIT 25`,
    accuracy: `SELECT u.id, ROUND(100.0 * SUM(qa.correct) / COUNT(qa.id)) AS score FROM users u
               JOIN question_attempts qa ON qa.user_id = u.id
               WHERE u.status = 'active' GROUP BY u.id HAVING COUNT(qa.id) >= 20
               ORDER BY score DESC LIMIT 25`,
    lessons: `SELECT u.id, COUNT(lp.lesson_id) AS score FROM users u
              JOIN lesson_progress lp ON lp.user_id = u.id AND lp.status = 'completed'
              WHERE u.status = 'active' GROUP BY u.id ORDER BY score DESC LIMIT 25`,
    weekly: `SELECT u.id, COALESCE(SUM(qa.points_awarded), 0) AS score FROM users u
             JOIN question_attempts qa ON qa.user_id = u.id
             WHERE u.status = 'active' AND qa.created_at >= datetime('now', '-7 days')
             GROUP BY u.id ORDER BY score DESC LIMIT 25`
  };
  const sql = queries[category] || queries.xp;
  return res.json({
    enabled: true,
    category: queries[category] ? category : 'xp',
    entries: all(sql).map((r, index) => ({ rank: index + 1, user: userById(r.id), score: r.score || 0 }))
  });
}));

/** Every badge on the platform, with the ones this member has earned. */
router.get('/me/badges', wrap(async (req, res) => {
  const board = all(`
    SELECT b.key, b.name, b.description, b.icon, ub.awarded_at
    FROM badges b
    LEFT JOIN user_badges ub ON ub.badge_key = b.key AND ub.user_id = ?
    ORDER BY (ub.awarded_at IS NULL), b.name`, req.user.id)
    .map((b) => ({ ...b, earned: !!b.awarded_at }));
  res.json({
    badges: board,
    earned: board.filter((b) => b.earned).length,
    total: board.length,
    stats: learnerStats(req.user.id)
  });
}));

router.get('/me/connections', wrap(async (req, res) => {
  const rows = all(`
    SELECT * FROM connections
    WHERE (requester_id = ? OR addressee_id = ?) ORDER BY created_at DESC`, req.user.id, req.user.id);
  res.json({
    connections: rows.map((c) => ({
      id: c.id,
      status: c.status,
      incoming: c.addressee_id === req.user.id,
      user: userById(c.requester_id === req.user.id ? c.addressee_id : c.requester_id)
    }))
  });
}));

router.get('/me/blocked', wrap(async (req, res) => {
  const rows = all('SELECT blocked_id, created_at FROM blocked_users WHERE blocker_id = ?', req.user.id);
  res.json({ blocked: rows.map((r) => ({ user: userById(r.blocked_id), since: r.created_at })) });
}));

// ---- One profile -----------------------------------------------------------
router.get('/:username', wrap(async (req, res) => {
  const key = clean(req.params.username, 40);
  const row = get(`${USER_SELECT} WHERE u.username = ? OR u.id = ?`, key, Number(key) || -1);
  if (!row || row.status === 'deleted') throw new HttpError(404, 'That member could not be found.');

  const badges = all(`
    SELECT b.key, b.name, b.description, b.icon, ub.awarded_at
    FROM user_badges ub JOIN badges b ON b.key = ub.badge_key
    WHERE ub.user_id = ? ORDER BY ub.awarded_at DESC`, row.id);

  const connection = get(`
    SELECT * FROM connections
    WHERE (requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?)`,
  req.user.id, row.id, row.id, req.user.id);

  res.json({
    user: publicUser(row),
    stats: learnerStats(row.id),
    breakdown: subjectBreakdown(row.id),
    badges,
    recent: recentActivity(row.id),
    connection: connection
      ? { status: connection.status, incoming: connection.addressee_id === req.user.id, id: connection.id }
      : null,
    blocked: !!get('SELECT 1 AS x FROM blocked_users WHERE blocker_id = ? AND blocked_id = ?', req.user.id, row.id),
    canMessage: mayMessage(req.user, row).allowed,
    isSelf: row.id === req.user.id
  });
}));

/** Recent learning activity, shown on a profile. */
function recentActivity(userId, limit = 8) {
  return all(`
    SELECT lp.status, lp.opened_at, lp.completed_at, l.id, l.title, s.name AS subject_name
    FROM lesson_progress lp
    JOIN lessons l ON l.id = lp.lesson_id
    JOIN topics t ON t.id = l.topic_id
    JOIN subjects s ON s.id = t.subject_id
    WHERE lp.user_id = ? ORDER BY COALESCE(lp.completed_at, lp.opened_at) DESC LIMIT ?`, userId, limit)
    .map((r) => ({
      kind: r.status === 'completed' ? 'lesson_completed' : 'lesson_opened',
      at: r.completed_at || r.opened_at,
      title: r.title,
      subtitle: r.subject_name,
      link: `#/lesson/${r.id}`
    }));
}

/**
 * Section 28: who is allowed to message whom.
 * Used by the profile screen and enforced again when a message is sent.
 */
export function mayMessage(sender, targetRow) {
  if (getSetting('messaging_enabled', 'true') !== 'true') {
    return { allowed: false, reason: 'Messaging is switched off at the moment.' };
  }
  if (sender.id === targetRow.id) return { allowed: true };
  if (!sender.can_message) return { allowed: false, reason: 'Your messaging has been restricted.' };
  if (targetRow.status !== 'active') return { allowed: false, reason: 'That account is not active.' };

  const blocked = get(`
    SELECT 1 AS x FROM blocked_users
    WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)`,
  sender.id, targetRow.id, targetRow.id, sender.id);
  if (blocked) return { allowed: false, reason: 'You cannot message this person.' };

  // A moderator can always reach somebody, so nobody can hide from moderation.
  if (can(sender, 'messages.moderate')) return { allowed: true };

  const setting = targetRow.who_can_message || 'everyone';
  if (setting === 'nobody') return { allowed: false, reason: 'This person is not accepting messages.' };
  if (setting === 'connections') {
    const connected = get(`
      SELECT 1 AS x FROM connections
      WHERE status = 'accepted'
        AND ((requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?))`,
    sender.id, targetRow.id, targetRow.id, sender.id);
    if (!connected) return { allowed: false, reason: 'This person only accepts messages from people they have connected with.' };
  }
  return { allowed: true };
}

router.get('/:username/progress', wrap(async (req, res) => {
  const row = get(`${USER_SELECT} WHERE u.username = ?`, clean(req.params.username, 40));
  if (!row) throw new HttpError(404, 'That member could not be found.');
  res.json({ user: publicUser(row), stats: learnerStats(row.id), breakdown: subjectBreakdown(row.id) });
}));

// ---- Editing your own account ----------------------------------------------
router.patch('/me', wrap(async (req, res) => {
  const userUpdates = [];
  const userParams = [];
  const profileUpdates = [];
  const profileParams = [];

  if (req.body.displayName !== undefined) {
    const name = clean(req.body.displayName, 40);
    if (!name) throw new HttpError(400, 'Your display name cannot be empty.');
    userUpdates.push('display_name = ?');
    userParams.push(name);
  }

  if (req.body.username !== undefined && req.body.username !== req.user.username) {
    if (getSetting('allow_username_change', 'true') !== 'true') {
      throw new HttpError(403, 'Usernames cannot be changed on this site.');
    }
    const username = clean(req.body.username, 20);
    if (!USERNAME_RE.test(username)) {
      throw new HttpError(400, 'Usernames need 3-20 letters, numbers, dots or underscores.');
    }
    if (get('SELECT 1 AS x FROM users WHERE username = ? AND id != ?', username, req.user.id)) {
      throw new HttpError(409, 'That username is already taken.');
    }
    userUpdates.push('username = ?');
    userParams.push(username);
    logActivity(req.user.id, 'user.username_changed', 'user', req.user.id, `${req.user.username} -> ${username}`);
  }

  const profileFields = {
    bio: () => clean(req.body.bio, 500),
    location: () => clean(req.body.location, 80),
    website: () => clean(req.body.website, 200),
    theme: () => (['dark', 'light'].includes(req.body.theme) ? req.body.theme : 'dark'),
    accent: () => clean(req.body.accent, 20),
    who_can_message: () => (['everyone', 'registered', 'connections', 'nobody'].includes(req.body.whoCanMessage)
      ? req.body.whoCanMessage : 'everyone'),
    show_online: () => (req.body.showOnline ? 1 : 0),
    show_last_seen: () => (req.body.showLastSeen ? 1 : 0),
    read_receipts: () => (req.body.readReceipts ? 1 : 0)
  };
  const bodyKeys = {
    bio: 'bio', location: 'location', website: 'website', theme: 'theme', accent: 'accent',
    who_can_message: 'whoCanMessage', show_online: 'showOnline',
    show_last_seen: 'showLastSeen', read_receipts: 'readReceipts'
  };
  for (const [column, fn] of Object.entries(profileFields)) {
    if (req.body[bodyKeys[column]] !== undefined) {
      profileUpdates.push(`${column} = ?`);
      profileParams.push(fn());
    }
  }

  if (userUpdates.length) run(`UPDATE users SET ${userUpdates.join(', ')} WHERE id = ?`, ...userParams, req.user.id);
  if (profileUpdates.length) run(`UPDATE profiles SET ${profileUpdates.join(', ')} WHERE user_id = ?`, ...profileParams, req.user.id);

  const { loadUser } = await import('../lib/auth.js');
  res.json({ user: selfUser(loadUser(req.user.id)) });
}));

router.post('/me/avatar', imageUploader('avatars').single('image'), wrap(async (req, res) => {
  if (!req.file) throw new HttpError(400, 'Choose a picture to upload.');
  const url = publicUrl('avatars', req.file.filename);
  run('UPDATE profiles SET avatar_url = ? WHERE user_id = ?', url, req.user.id);
  res.json({ avatarUrl: url });
}));

router.post('/me/cover', imageUploader('avatars').single('image'), wrap(async (req, res) => {
  if (!req.file) throw new HttpError(400, 'Choose a picture to upload.');
  const url = publicUrl('avatars', req.file.filename);
  run('UPDATE profiles SET cover_url = ? WHERE user_id = ?', url, req.user.id);
  res.json({ coverUrl: url });
}));

// ---- Connections -----------------------------------------------------------
router.post('/:id/connect', wrap(async (req, res) => {
  const target = get('SELECT * FROM users WHERE id = ?', Number(req.params.id));
  if (!target || target.status !== 'active') throw new HttpError(404, 'That member could not be found.');
  if (target.id === req.user.id) throw new HttpError(400, 'You cannot connect with yourself.');

  const existing = get(`
    SELECT * FROM connections
    WHERE (requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?)`,
  req.user.id, target.id, target.id, req.user.id);

  if (existing) {
    if (existing.status === 'accepted') return res.json({ status: 'accepted' });
    if (existing.addressee_id === req.user.id) {
      run("UPDATE connections SET status = 'accepted' WHERE id = ?", existing.id);
      notify(existing.requester_id, {
        kind: 'connection',
        title: `${req.user.display_name} accepted your connection`,
        link: `#/profile/${req.user.username}`,
        actorId: req.user.id
      });
      countConnections(req.user.id);
      countConnections(existing.requester_id);
      return res.json({ status: 'accepted' });
    }
    return res.json({ status: 'pending' });
  }

  run('INSERT INTO connections (requester_id, addressee_id) VALUES (?, ?)', req.user.id, target.id);
  notify(target.id, {
    kind: 'connection',
    title: `${req.user.display_name} wants to connect`,
    link: `#/profile/${req.user.username}`,
    actorId: req.user.id
  });
  return res.status(201).json({ status: 'pending' });
}));

function countConnections(userId) {
  const n = get("SELECT COUNT(*) AS n FROM connections WHERE status = 'accepted' AND (requester_id = ? OR addressee_id = ?)",
    userId, userId).n;
  if (n >= 5) grantBadge(userId, 'social');
}

router.delete('/:id/connect', wrap(async (req, res) => {
  run(`DELETE FROM connections
       WHERE (requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?)`,
  req.user.id, Number(req.params.id), Number(req.params.id), req.user.id);
  res.json({ ok: true });
}));

// ---- Blocking (section 26) -------------------------------------------------
router.post('/:id/block', wrap(async (req, res) => {
  const target = get('SELECT * FROM users WHERE id = ?', Number(req.params.id));
  if (!target) throw new HttpError(404, 'That member could not be found.');
  if (target.id === req.user.id) throw new HttpError(400, 'You cannot block yourself.');

  run('INSERT OR IGNORE INTO blocked_users (blocker_id, blocked_id) VALUES (?, ?)', req.user.id, target.id);
  // Blocking also drops any connection between the two.
  run(`DELETE FROM connections
       WHERE (requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?)`,
  req.user.id, target.id, target.id, req.user.id);
  res.json({ blocked: true });
}));

router.delete('/:id/block', wrap(async (req, res) => {
  run('DELETE FROM blocked_users WHERE blocker_id = ? AND blocked_id = ?', req.user.id, Number(req.params.id));
  res.json({ blocked: false });
}));
