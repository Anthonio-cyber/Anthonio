import express from 'express';
import { get, all, run, logActivity } from '../db/index.js';
import { requireAuth, requirePermission, can } from '../lib/auth.js';
import { serializeAnnouncement } from '../lib/serialize.js';
import { HttpError, wrap, clean, parsePage } from '../lib/util.js';
import { notifyMany } from '../lib/notify.js';
import { toEveryone } from '../realtime/hub.js';

export const router = express.Router();
router.use(requireAuth);

const PRIORITIES = ['normal', 'important', 'urgent'];
// Section 50: everyone, new users, specific roles or specific people.
const AUDIENCES = ['everyone', 'new_users', 'roles', 'users'];

/** Only announcements that are published, not expired and meant for this member. */
function visibleFilter(user) {
  const where = [
    'a.is_deleted = 0',
    "a.publish_at <= datetime('now')",
    "(a.expires_at IS NULL OR a.expires_at = '' OR a.expires_at > datetime('now'))"
  ];
  const params = [];
  // audience_ref holds a comma separated list of role keys or user ids.
  where.push(`(a.audience = 'everyone'
    OR (a.audience = 'roles' AND ',' || a.audience_ref || ',' LIKE '%,' || ? || ',%')
    OR (a.audience = 'users' AND ',' || a.audience_ref || ',' LIKE '%,' || ? || ',%')
    OR (a.audience = 'new_users' AND ? >= datetime('now', '-14 days')))`);
  params.push(user.role_key, String(user.id), user.created_at);
  return { where, params };
}

router.get('/', wrap(async (req, res) => {
  const { limit, offset } = parsePage(req.query, 30, 100);
  const { where, params } = visibleFilter(req.user);

  const rows = all(`
    SELECT a.* FROM announcements a
    WHERE ${where.join(' AND ')}
    ORDER BY a.pinned DESC, a.publish_at DESC LIMIT ? OFFSET ?`, ...params, limit, offset);

  res.json({
    announcements: rows.map((r) => serializeAnnouncement(r, req.user.id)),
    canCreate: can(req.user, 'announcements.create'),
    canPin: can(req.user, 'announcements.edit')
  });
}));

/** Everything the sign-in dashboard needs: the newest pinned or latest notice. */
export function latestAnnouncement(user) {
  const { where, params } = visibleFilter(user);
  const row = get(`
    SELECT a.* FROM announcements a
    WHERE ${where.join(' AND ')}
    ORDER BY a.pinned DESC, a.publish_at DESC LIMIT 1`, ...params);
  return row ? serializeAnnouncement(row, user.id) : null;
}

router.get('/:id', wrap(async (req, res) => {
  const row = get('SELECT * FROM announcements WHERE id = ? AND is_deleted = 0', Number(req.params.id));
  if (!row) throw new HttpError(404, 'That announcement could not be found.');
  res.json({ announcement: serializeAnnouncement(row, req.user.id) });
}));

/** Cleans the "who is this for" list: role keys, or user ids. */
function audienceReference(audience, value) {
  if (audience === 'roles') {
    const keys = String(value || '').split(',').map((v) => clean(v, 20)).filter(Boolean);
    return keys.join(',');
  }
  if (audience === 'users') {
    const ids = String(value || '').split(',').map((v) => Number(v)).filter(Boolean);
    return ids.join(',');
  }
  return '';
}

/** Who should be told about it now. */
function audienceMembers(audience, audienceRef) {
  if (audience === 'roles' && audienceRef) {
    const keys = audienceRef.split(',');
    const marks = keys.map(() => '?').join(',');
    return all(`SELECT id FROM users WHERE status = 'active' AND role_key IN (${marks})`, ...keys);
  }
  if (audience === 'users' && audienceRef) {
    const ids = audienceRef.split(',').map(Number).filter(Boolean);
    const marks = ids.map(() => '?').join(',');
    return all(`SELECT id FROM users WHERE status = 'active' AND id IN (${marks})`, ...ids);
  }
  if (audience === 'new_users') {
    return all("SELECT id FROM users WHERE status = 'active' AND created_at >= datetime('now', '-14 days')");
  }
  return all("SELECT id FROM users WHERE status = 'active'");
}

router.post('/', requirePermission('announcements.create'), wrap(async (req, res) => {
  const title = clean(req.body.title, 120);
  const message = clean(req.body.message, 3000);
  if (!title || !message) throw new HttpError(400, 'An announcement needs a title and a message.');

  const priority = PRIORITIES.includes(req.body.priority) ? req.body.priority : 'normal';
  const audience = AUDIENCES.includes(req.body.audience) ? req.body.audience : 'everyone';
  const audienceRef = audienceReference(audience, req.body.audienceRef);
  if ((audience === 'roles' || audience === 'users') && !audienceRef) {
    throw new HttpError(400, 'Choose who this announcement is for.');
  }

  const publishAt = clean(req.body.publishAt || '', 30) || new Date().toISOString().slice(0, 19).replace('T', ' ');
  const expiresAt = clean(req.body.expiresAt || '', 30) || null;
  const pinned = req.body.pinned && can(req.user, 'announcements.edit') ? 1 : 0;

  const info = run(`
    INSERT INTO announcements (title, message, author_id, priority, audience, audience_ref, pinned, publish_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  title, message, req.user.id, priority, audience, audienceRef, pinned, publishAt, expiresAt);

  const scheduled = new Date(publishAt.replace(' ', 'T')) > new Date();
  if (!scheduled) {
    const recipients = audienceMembers(audience, audienceRef);
    notifyMany(recipients.map((r) => r.id), {
      kind: 'announcement',
      title: priority === 'urgent' ? `URGENT: ${title}` : title,
      body: message.slice(0, 120),
      link: `#/announcements/${info.lastInsertRowid}`,
      actorId: req.user.id
    }, req.user.id);
    toEveryone('announcement:new', { id: info.lastInsertRowid, title, priority });
  }

  logActivity(req.user.id, 'announcement.created', 'announcement', info.lastInsertRowid, title);
  res.status(201).json({ announcement: serializeAnnouncement(get('SELECT * FROM announcements WHERE id = ?', info.lastInsertRowid), req.user.id) });
}));

router.patch('/:id', requirePermission('announcements.edit'), wrap(async (req, res) => {
  const row = get('SELECT * FROM announcements WHERE id = ? AND is_deleted = 0', Number(req.params.id));
  if (!row) throw new HttpError(404, 'That announcement could not be found.');

  const updates = [];
  const params = [];
  const push = (column, value) => { updates.push(`${column} = ?`); params.push(value); };

  if (req.body.title !== undefined) push('title', clean(req.body.title, 120));
  if (req.body.message !== undefined) push('message', clean(req.body.message, 3000));
  if (req.body.priority !== undefined && PRIORITIES.includes(req.body.priority)) push('priority', req.body.priority);
  if (req.body.audience !== undefined && AUDIENCES.includes(req.body.audience)) {
    push('audience', req.body.audience);
    push('audience_ref', audienceReference(req.body.audience, req.body.audienceRef));
  }
  if (req.body.expiresAt !== undefined) push('expires_at', clean(req.body.expiresAt, 30) || null);
  if (req.body.publishAt !== undefined) push('publish_at', clean(req.body.publishAt, 30));
  if (req.body.pinned !== undefined) push('pinned', req.body.pinned ? 1 : 0);

  if (updates.length) run(`UPDATE announcements SET ${updates.join(', ')} WHERE id = ?`, ...params, row.id);
  logActivity(req.user.id, 'announcement.edited', 'announcement', row.id, row.title);
  res.json({ announcement: serializeAnnouncement(get('SELECT * FROM announcements WHERE id = ?', row.id), req.user.id) });
}));

router.post('/:id/pin', requirePermission('announcements.edit'), wrap(async (req, res) => {
  const row = get('SELECT * FROM announcements WHERE id = ?', Number(req.params.id));
  if (!row) throw new HttpError(404, 'That announcement could not be found.');
  const pinned = row.pinned ? 0 : 1;
  run('UPDATE announcements SET pinned = ? WHERE id = ?', pinned, row.id);
  logActivity(req.user.id, pinned ? 'announcement.pinned' : 'announcement.unpinned', 'announcement', row.id, row.title);
  res.json({ pinned: !!pinned });
}));

router.delete('/:id', requirePermission('announcements.delete'), wrap(async (req, res) => {
  const row = get('SELECT * FROM announcements WHERE id = ?', Number(req.params.id));
  if (!row) throw new HttpError(404, 'That announcement could not be found.');
  run('UPDATE announcements SET is_deleted = 1 WHERE id = ?', row.id);
  logActivity(req.user.id, 'announcement.deleted', 'announcement', row.id, row.title);
  res.json({ ok: true });
}));

router.post('/:id/read', wrap(async (req, res) => {
  run('INSERT OR IGNORE INTO announcement_reads (announcement_id, user_id) VALUES (?, ?)', Number(req.params.id), req.user.id);
  res.json({ ok: true });
}));
