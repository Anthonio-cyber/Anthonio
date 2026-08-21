import express from 'express';
import { db, get, all, run, logActivity } from '../db/index.js';
import { requireAuth, can } from '../lib/auth.js';
import { publicUser, selfUser, userById } from '../lib/serialize.js';
import { HttpError, wrap, clean, parsePage } from '../lib/util.js';
import { gameStats, grantAchievement } from '../lib/xp.js';
import { learnerStats } from '../lib/learn.js';
import { imageUploader, publicUrl } from '../lib/uploads.js';
import { isOnline, onlineIds } from '../realtime/hub.js';
import { notify } from '../lib/notify.js';

export const router = express.Router();
router.use(requireAuth);

/** Every badge on the platform, with the ones this member has earned. */
function achievementBoard(userId) {
  return all(`
    SELECT a.key, a.name, a.description, a.icon, ua.awarded_at
    FROM achievements a
    LEFT JOIN user_achievements ua ON ua.achievement_key = a.key AND ua.user_id = ?
    ORDER BY (ua.awarded_at IS NULL), a.name`, userId)
    .map((a) => ({ ...a, earned: !!a.awarded_at }));
}

const USER_SELECT = `
  SELECT u.*, p.avatar_url, p.cover_url, p.bio, p.class_section, p.favourite_subject,
         p.streak_days, p.show_online, r.name AS role_name
  FROM users u
  LEFT JOIN profiles p ON p.user_id = u.id
  LEFT JOIN roles r ON r.key = u.role_key`;

// ---- Class directory -------------------------------------------------------
router.get('/', wrap(async (req, res) => {
  const { limit, offset } = parsePage(req.query, 50, 200);
  const search = clean(req.query.search || '', 40);
  const like = `%${search}%`;
  const rows = search
    ? all(`${USER_SELECT} WHERE u.status = 'active' AND (u.username LIKE ? OR u.display_name LIKE ?)
           ORDER BY u.display_name LIMIT ? OFFSET ?`, like, like, limit, offset)
    : all(`${USER_SELECT} WHERE u.status = 'active' ORDER BY u.display_name LIMIT ? OFFSET ?`, limit, offset);
  res.json({ users: rows.map(publicUser) });
}));

// ---- Who is online right now ----------------------------------------------
router.get('/online', wrap(async (req, res) => {
  const ids = onlineIds().filter((id) => id !== req.user.id);
  if (!ids.length) return res.json({ users: [] });
  const marks = ids.map(() => '?').join(',');
  const rows = all(`${USER_SELECT} WHERE u.id IN (${marks}) AND u.status = 'active'`, ...ids)
    .filter((r) => r.show_online !== 0);
  return res.json({ users: rows.map(publicUser) });
}));

// ---- One profile -----------------------------------------------------------
/** The badge wall: what this member has earned and what is still to come. */
router.get('/me/achievements', wrap(async (req, res) => {
  const board = achievementBoard(req.user.id);
  res.json({
    achievements: board,
    earned: board.filter((a) => a.earned).length,
    total: board.length,
    codingStats: learnerStats(req.user.id)
  });
}));

router.get('/:username', wrap(async (req, res) => {
  const key = clean(req.params.username, 40);
  const row = get(`${USER_SELECT} WHERE u.username = ? OR u.id = ?`, key, Number(key) || -1);
  if (!row || row.status === 'deleted') throw new HttpError(404, 'That member could not be found.');

  const profile = publicUser(row);
  const clubs = all(`
    SELECT c.*, cm.club_role FROM club_members cm
    JOIN clubs c ON c.id = cm.club_id
    WHERE cm.user_id = ? AND c.status = 'approved'`, row.id)
    .map((c) => ({ id: c.id, name: c.name, handle: c.handle, logoUrl: c.logo_url, category: c.category, role: c.club_role }));

  const achievements = all(`
    SELECT a.key, a.name, a.description, a.icon, ua.awarded_at
    FROM user_achievements ua JOIN achievements a ON a.key = ua.achievement_key
    WHERE ua.user_id = ? ORDER BY ua.awarded_at DESC`, row.id);

  const postCount = get('SELECT COUNT(*) AS n FROM posts WHERE author_id = ? AND is_deleted = 0', row.id).n;
  const connection = get(`
    SELECT * FROM connections
    WHERE (requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?)`,
  req.user.id, row.id, row.id, req.user.id);

  const blocked = !!get('SELECT 1 AS x FROM blocked_users WHERE blocker_id = ? AND blocked_id = ?', req.user.id, row.id);

  res.json({
    user: profile,
    stats: { posts: postCount, ...gameStats(row.id) },
    codingStats: learnerStats(row.id),
    clubs,
    achievements,
    connection: connection
      ? { status: connection.status, incoming: connection.addressee_id === req.user.id, id: connection.id }
      : null,
    blocked,
    isSelf: row.id === req.user.id
  });
}));

router.get('/:username/posts', wrap(async (req, res) => {
  const key = clean(req.params.username, 40);
  const row = get('SELECT id FROM users WHERE username = ? OR id = ?', key, Number(key) || -1);
  if (!row) throw new HttpError(404, 'That member could not be found.');
  const { limit, offset } = parsePage(req.query, 20, 50);
  const { serializePost } = await import('../lib/serialize.js');
  const posts = all(`
    SELECT p.*, c.name AS club_name, c.handle AS club_handle
    FROM posts p LEFT JOIN clubs c ON c.id = p.club_id
    WHERE p.author_id = ? AND p.is_deleted = 0
    ORDER BY p.created_at DESC LIMIT ? OFFSET ?`, row.id, limit, offset);
  res.json({ posts: posts.map((p) => serializePost(p, req.user.id)) });
}));

// ---- Editing your own profile ---------------------------------------------
router.patch('/me', wrap(async (req, res) => {
  const fields = {
    display_name: req.body.displayName !== undefined ? clean(req.body.displayName, 40) : undefined,
    bio: req.body.bio !== undefined ? clean(req.body.bio, 400) : undefined,
    favourite_subject: req.body.favouriteSubject !== undefined ? clean(req.body.favouriteSubject, 40) : undefined,
    class_section: req.body.classSection !== undefined ? clean(req.body.classSection, 40) : undefined,
    theme: ['dark', 'light'].includes(req.body.theme) ? req.body.theme : undefined,
    accent: ['violet', 'cyan', 'emerald', 'amber', 'rose'].includes(req.body.accent) ? req.body.accent : undefined,
    show_online: req.body.showOnline !== undefined ? (req.body.showOnline ? 1 : 0) : undefined
  };

  if (fields.display_name === '') throw new HttpError(400, 'Your display name cannot be empty.');

  db.transaction(() => {
    if (fields.display_name !== undefined) run('UPDATE users SET display_name = ? WHERE id = ?', fields.display_name, req.user.id);
    const profileFields = ['bio', 'favourite_subject', 'class_section', 'theme', 'accent', 'show_online'];
    for (const key of profileFields) {
      if (fields[key] !== undefined) run(`UPDATE profiles SET ${key} = ? WHERE user_id = ?`, fields[key], req.user.id);
    }
  })();

  const { loadUser } = await import('../lib/auth.js');
  res.json({ user: selfUser(loadUser(req.user.id)) });
}));

router.post('/me/avatar', imageUploader('avatars').single('image'), wrap(async (req, res) => {
  if (!req.file) throw new HttpError(400, 'Please choose an image first.');
  const url = publicUrl('avatars', req.file.filename);
  run('UPDATE profiles SET avatar_url = ? WHERE user_id = ?', url, req.user.id);
  res.json({ avatarUrl: url });
}));

router.post('/me/cover', imageUploader('avatars').single('image'), wrap(async (req, res) => {
  if (!req.file) throw new HttpError(400, 'Please choose an image first.');
  const url = publicUrl('avatars', req.file.filename);
  run('UPDATE profiles SET cover_url = ? WHERE user_id = ?', url, req.user.id);
  res.json({ coverUrl: url });
}));

// ---- Connections (classmate list) -----------------------------------------
router.post('/:id/connect', wrap(async (req, res) => {
  const targetId = Number(req.params.id);
  if (targetId === req.user.id) throw new HttpError(400, 'You cannot connect with yourself.');
  const target = get("SELECT * FROM users WHERE id = ? AND status = 'active'", targetId);
  if (!target) throw new HttpError(404, 'That member could not be found.');

  const existing = get(`
    SELECT * FROM connections
    WHERE (requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?)`,
  req.user.id, targetId, targetId, req.user.id);

  if (existing?.status === 'accepted') throw new HttpError(409, 'You are already connected.');

  if (existing && existing.addressee_id === req.user.id) {
    run("UPDATE connections SET status = 'accepted' WHERE id = ?", existing.id);
    notify(existing.requester_id, {
      kind: 'connection',
      title: `${req.user.display_name} accepted your connection`,
      link: `#/profile/${req.user.username}`,
      actorId: req.user.id
    });
    checkSocialBadge(req.user.id);
    checkSocialBadge(existing.requester_id);
    return res.json({ status: 'accepted' });
  }
  if (existing) return res.json({ status: 'pending' });

  run('INSERT INTO connections (requester_id, addressee_id) VALUES (?, ?)', req.user.id, targetId);
  notify(targetId, {
    kind: 'connection',
    title: `${req.user.display_name} wants to connect`,
    body: 'Open their profile to accept.',
    link: `#/profile/${req.user.username}`,
    actorId: req.user.id
  });
  return res.json({ status: 'pending' });
}));

router.delete('/:id/connect', wrap(async (req, res) => {
  const targetId = Number(req.params.id);
  run(`DELETE FROM connections
       WHERE (requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?)`,
  req.user.id, targetId, targetId, req.user.id);
  res.json({ ok: true });
}));

router.get('/me/connections', wrap(async (req, res) => {
  const rows = all(`
    SELECT c.*, CASE WHEN c.requester_id = ? THEN c.addressee_id ELSE c.requester_id END AS other_id
    FROM connections c
    WHERE (c.requester_id = ? OR c.addressee_id = ?)`, req.user.id, req.user.id, req.user.id);
  res.json({
    connections: rows.map((r) => ({
      status: r.status,
      incoming: r.addressee_id === req.user.id,
      user: userById(r.other_id)
    }))
  });
}));

function checkSocialBadge(userId) {
  const n = get("SELECT COUNT(*) AS n FROM connections WHERE status = 'accepted' AND (requester_id = ? OR addressee_id = ?)", userId, userId).n;
  if (n >= 5) grantAchievement(userId, 'social');
}

// ---- Blocking --------------------------------------------------------------
router.post('/:id/block', wrap(async (req, res) => {
  const targetId = Number(req.params.id);
  if (targetId === req.user.id) throw new HttpError(400, 'You cannot block yourself.');
  const target = get('SELECT * FROM users WHERE id = ?', targetId);
  if (!target) throw new HttpError(404, 'That member could not be found.');
  run('INSERT OR IGNORE INTO blocked_users (blocker_id, blocked_id) VALUES (?, ?)', req.user.id, targetId);
  logActivity(req.user.id, 'user.blocked', 'user', targetId);
  res.json({ ok: true, blocked: true });
}));

router.delete('/:id/block', wrap(async (req, res) => {
  run('DELETE FROM blocked_users WHERE blocker_id = ? AND blocked_id = ?', req.user.id, Number(req.params.id));
  res.json({ ok: true, blocked: false });
}));

router.get('/me/blocked', wrap(async (req, res) => {
  const rows = all('SELECT blocked_id FROM blocked_users WHERE blocker_id = ?', req.user.id);
  res.json({ users: rows.map((r) => userById(r.blocked_id)).filter(Boolean) });
}));
