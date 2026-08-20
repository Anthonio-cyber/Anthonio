import express from 'express';
import { db, get, all, run, getSetting, logActivity } from '../db/index.js';
import { requireAuth, can } from '../lib/auth.js';
import { serializeClub, userById } from '../lib/serialize.js';
import { HttpError, wrap, clean, slugify, parsePage } from '../lib/util.js';
import { imageUploader, publicUrl } from '../lib/uploads.js';
import { notify, notifyMany } from '../lib/notify.js';
import { grantAchievement } from '../lib/xp.js';

export const router = express.Router();
router.use(requireAuth);

const CLUB_ROLES = ['owner', 'admin', 'moderator', 'member'];
const ROLE_POWER = { owner: 4, admin: 3, moderator: 2, member: 1 };

export function clubRole(clubId, userId) {
  return get('SELECT club_role FROM club_members WHERE club_id = ? AND user_id = ?', clubId, userId)?.club_role || null;
}

function requireClubPower(user, clubId, minimum) {
  if (can(user, 'clubs.manage')) return 'owner';
  const role = clubRole(clubId, user.id);
  if (!role || ROLE_POWER[role] < ROLE_POWER[minimum]) {
    throw new HttpError(403, 'You do not have permission to manage this club.');
  }
  return role;
}

function loadClub(idOrHandle) {
  const club = get('SELECT * FROM clubs WHERE id = ? OR handle = ?', Number(idOrHandle) || -1, String(idOrHandle));
  if (!club) throw new HttpError(404, 'That club could not be found.');
  return club;
}

/** Every club gets its own group chat conversation. */
function ensureClubConversation(clubId) {
  const existing = get("SELECT * FROM conversations WHERE kind = 'club' AND club_id = ?", clubId);
  if (existing) return existing;
  const info = run("INSERT INTO conversations (kind, club_id) VALUES ('club', ?)", clubId);
  for (const m of all('SELECT user_id FROM club_members WHERE club_id = ?', clubId)) {
    run('INSERT OR IGNORE INTO conversation_members (conversation_id, user_id) VALUES (?, ?)', info.lastInsertRowid, m.user_id);
  }
  return get('SELECT * FROM conversations WHERE id = ?', info.lastInsertRowid);
}

function addToClubChat(clubId, userId) {
  const conv = ensureClubConversation(clubId);
  run('INSERT OR IGNORE INTO conversation_members (conversation_id, user_id) VALUES (?, ?)', conv.id, userId);
}

function removeFromClubChat(clubId, userId) {
  const conv = get("SELECT * FROM conversations WHERE kind = 'club' AND club_id = ?", clubId);
  if (conv) run('DELETE FROM conversation_members WHERE conversation_id = ? AND user_id = ?', conv.id, userId);
}

// ---------------------------------------------------------------------------
// Browsing
// ---------------------------------------------------------------------------
router.get('/', wrap(async (req, res) => {
  const { limit, offset } = parsePage(req.query, 40, 100);
  const search = clean(req.query.search || '', 40);
  const category = clean(req.query.category || '', 40);
  const mine = req.query.mine === 'true';

  const where = ["c.status = 'approved'"];
  const params = [];
  if (search) { where.push('(c.name LIKE ? OR c.handle LIKE ? OR c.description LIKE ?)'); params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
  if (category) { where.push('c.category = ?'); params.push(category); }
  if (mine) { where.push('c.id IN (SELECT club_id FROM club_members WHERE user_id = ?)'); params.push(req.user.id); }

  const rows = all(`SELECT c.* FROM clubs c WHERE ${where.join(' AND ')} ORDER BY c.name LIMIT ? OFFSET ?`, ...params, limit, offset);
  const clubs = rows.map((c) => serializeClub(c, req.user.id));
  const categories = all("SELECT DISTINCT category FROM clubs WHERE status = 'approved' ORDER BY category").map((r) => r.category);
  res.json({ clubs, categories, canCreate: mayCreateClub(req.user), creationMode: getSetting('club_creation', 'approval') });
}));

router.get('/popular', wrap(async (req, res) => {
  const rows = all(`
    SELECT c.*, COUNT(cm.user_id) AS members FROM clubs c
    LEFT JOIN club_members cm ON cm.club_id = c.id
    WHERE c.status = 'approved'
    GROUP BY c.id ORDER BY members DESC, c.name LIMIT 6`);
  res.json({ clubs: rows.map((c) => serializeClub(c, req.user.id)) });
}));

function mayCreateClub(user) {
  const mode = getSetting('club_creation', 'approval');
  if (mode === 'admins') return can(user, 'clubs.approve');
  return can(user, 'clubs.create');
}

// ---------------------------------------------------------------------------
// Creating
// ---------------------------------------------------------------------------
router.post('/', imageUploader('clubs').fields([{ name: 'logo', maxCount: 1 }, { name: 'cover', maxCount: 1 }]), wrap(async (req, res) => {
  if (!mayCreateClub(req.user)) throw new HttpError(403, 'Club creation is limited to administrators right now.');

  const name = clean(req.body.name, 60);
  if (!name) throw new HttpError(400, 'Give your club a name.');
  const handle = slugify(clean(req.body.handle, 40) || name);
  if (get('SELECT 1 AS x FROM clubs WHERE handle = ?', handle)) {
    throw new HttpError(409, `The handle "${handle}" is already used by another club.`);
  }

  const mode = getSetting('club_creation', 'approval');
  const autoApprove = mode === 'anyone' || can(req.user, 'clubs.approve');
  const status = autoApprove ? 'approved' : 'pending';

  const logo = req.files?.logo?.[0] ? publicUrl('clubs', req.files.logo[0].filename) : '';
  const cover = req.files?.cover?.[0] ? publicUrl('clubs', req.files.cover[0].filename) : '';

  const create = db.transaction(() => {
    const info = run(`
      INSERT INTO clubs (name, handle, description, category, rules, logo_url, cover_url, owner_id, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    name, handle, clean(req.body.description || '', 600), clean(req.body.category || 'General', 40),
    clean(req.body.rules || '', 800), logo, cover, req.user.id, status);
    run("INSERT INTO club_members (club_id, user_id, club_role) VALUES (?, ?, 'owner')", info.lastInsertRowid, req.user.id);
    return info.lastInsertRowid;
  });
  const clubId = create();
  ensureClubConversation(clubId);
  grantAchievement(req.user.id, 'club_founder');
  logActivity(req.user.id, 'club.created', 'club', clubId, `${name} (${status})`);

  if (!autoApprove) {
    const approvers = all("SELECT u.id FROM users u JOIN role_permissions rp ON rp.role_key = u.role_key WHERE rp.permission_key = 'clubs.approve' AND u.status = 'active'");
    notifyMany(approvers.map((a) => a.id), {
      kind: 'club_request',
      title: 'A club is waiting for approval',
      body: `${req.user.display_name} asked to create "${name}".`,
      link: '#/admin/clubs',
      actorId: req.user.id
    });
  }

  res.status(201).json({ club: serializeClub(get('SELECT * FROM clubs WHERE id = ?', clubId), req.user.id), status });
}));

// ---------------------------------------------------------------------------
// One club
// ---------------------------------------------------------------------------
router.get('/:id', wrap(async (req, res) => {
  const club = loadClub(req.params.id);
  const role = clubRole(club.id, req.user.id);
  if (club.status !== 'approved' && !role && !can(req.user, 'clubs.manage')) {
    throw new HttpError(403, 'This club is not available.');
  }
  const members = all(`
    SELECT cm.club_role, cm.joined_at, cm.user_id FROM club_members cm
    WHERE cm.club_id = ? ORDER BY
      CASE cm.club_role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 WHEN 'moderator' THEN 2 ELSE 3 END,
      cm.joined_at`, club.id);

  const conversation = role || can(req.user, 'clubs.manage') ? ensureClubConversation(club.id) : null;
  const events = all('SELECT * FROM events WHERE club_id = ? ORDER BY starts_at ASC LIMIT 20', club.id);
  const requests = role && ROLE_POWER[role] >= ROLE_POWER.admin
    ? all("SELECT * FROM club_requests WHERE club_id = ? AND status = 'pending' AND kind = 'join'", club.id)
      .map((r) => ({ id: r.id, user: userById(r.user_id), message: r.message, createdAt: r.created_at }))
    : [];

  res.json({
    club: serializeClub(club, req.user.id),
    members: members.map((m) => ({ ...userById(m.user_id), clubRole: m.club_role, joinedAt: m.joined_at })),
    conversationId: conversation?.id || null,
    events: events.map((e) => ({ id: e.id, title: e.title, description: e.description, location: e.location, startsAt: e.starts_at })),
    joinRequests: requests,
    canManage: Boolean(role && ROLE_POWER[role] >= ROLE_POWER.admin) || can(req.user, 'clubs.manage')
  });
}));

router.patch('/:id', imageUploader('clubs').fields([{ name: 'logo', maxCount: 1 }, { name: 'cover', maxCount: 1 }]), wrap(async (req, res) => {
  const club = loadClub(req.params.id);
  requireClubPower(req.user, club.id, 'admin');

  const updates = [];
  const params = [];
  const map = {
    name: clean(req.body.name ?? '', 60),
    description: clean(req.body.description ?? '', 600),
    category: clean(req.body.category ?? '', 40),
    rules: clean(req.body.rules ?? '', 800)
  };
  for (const [key, value] of Object.entries(map)) {
    if (req.body[key] !== undefined) { updates.push(`${key} = ?`); params.push(value); }
  }
  if (req.files?.logo?.[0]) { updates.push('logo_url = ?'); params.push(publicUrl('clubs', req.files.logo[0].filename)); }
  if (req.files?.cover?.[0]) { updates.push('cover_url = ?'); params.push(publicUrl('clubs', req.files.cover[0].filename)); }
  if (updates.length) run(`UPDATE clubs SET ${updates.join(', ')} WHERE id = ?`, ...params, club.id);

  res.json({ club: serializeClub(get('SELECT * FROM clubs WHERE id = ?', club.id), req.user.id) });
}));

router.delete('/:id', wrap(async (req, res) => {
  const club = loadClub(req.params.id);
  const isOwner = club.owner_id === req.user.id;
  if (!isOwner && !can(req.user, 'clubs.delete')) throw new HttpError(403, 'Only the club owner or an administrator can delete a club.');
  run('DELETE FROM clubs WHERE id = ?', club.id);
  logActivity(req.user.id, 'club.deleted', 'club', club.id, club.name);
  res.json({ ok: true });
}));

// ---------------------------------------------------------------------------
// Membership
// ---------------------------------------------------------------------------
router.post('/:id/join', wrap(async (req, res) => {
  const club = loadClub(req.params.id);
  if (club.status !== 'approved') throw new HttpError(403, 'This club is not open yet.');
  if (clubRole(club.id, req.user.id)) throw new HttpError(409, 'You are already a member.');

  const invited = get("SELECT * FROM club_requests WHERE club_id = ? AND user_id = ? AND kind = 'invite' AND status = 'pending'", club.id, req.user.id);
  if (invited) {
    joinClub(club.id, req.user.id);
    run("UPDATE club_requests SET status = 'accepted' WHERE id = ?", invited.id);
    return res.json({ joined: true });
  }

  run(`INSERT INTO club_requests (club_id, user_id, kind, message) VALUES (?, ?, 'join', ?)
       ON CONFLICT(club_id, user_id, kind) DO UPDATE SET status = 'pending', message = excluded.message`,
  club.id, req.user.id, clean(req.body?.message || '', 200));

  const leaders = all("SELECT user_id FROM club_members WHERE club_id = ? AND club_role IN ('owner','admin')", club.id);
  notifyMany(leaders.map((l) => l.user_id), {
    kind: 'club_join_request',
    title: `${req.user.display_name} asked to join ${club.name}`,
    link: `#/clubs/${club.id}`,
    actorId: req.user.id
  });
  return res.json({ joined: false, requested: true });
}));

function joinClub(clubId, userId, role = 'member') {
  run('INSERT OR IGNORE INTO club_members (club_id, user_id, club_role) VALUES (?, ?, ?)', clubId, userId, role);
  addToClubChat(clubId, userId);
}

router.post('/:id/requests/:requestId', wrap(async (req, res) => {
  const club = loadClub(req.params.id);
  requireClubPower(req.user, club.id, 'admin');
  const request = get('SELECT * FROM club_requests WHERE id = ? AND club_id = ?', Number(req.params.requestId), club.id);
  if (!request) throw new HttpError(404, 'That request could not be found.');
  const accept = req.body.action !== 'reject';

  run('UPDATE club_requests SET status = ? WHERE id = ?', accept ? 'accepted' : 'rejected', request.id);
  if (accept) {
    joinClub(club.id, request.user_id);
    notify(request.user_id, {
      kind: 'club_join_request',
      title: `You joined ${club.name}`,
      link: `#/clubs/${club.id}`,
      actorId: req.user.id
    });
  } else {
    notify(request.user_id, {
      kind: 'club_join_request',
      title: `Your request to join ${club.name} was declined`,
      link: '#/clubs',
      actorId: req.user.id
    });
  }
  logActivity(req.user.id, accept ? 'club.member_accepted' : 'club.member_rejected', 'club', club.id, `user ${request.user_id}`);
  res.json({ ok: true });
}));

router.post('/:id/invite', wrap(async (req, res) => {
  const club = loadClub(req.params.id);
  requireClubPower(req.user, club.id, 'moderator');
  const userId = Number(req.body.userId);
  const target = get("SELECT * FROM users WHERE id = ? AND status = 'active'", userId);
  if (!target) throw new HttpError(404, 'That member could not be found.');
  if (clubRole(club.id, userId)) throw new HttpError(409, 'They are already a member.');

  run(`INSERT INTO club_requests (club_id, user_id, kind) VALUES (?, ?, 'invite')
       ON CONFLICT(club_id, user_id, kind) DO UPDATE SET status = 'pending'`, club.id, userId);
  notify(userId, {
    kind: 'club_invite',
    title: `${req.user.display_name} invited you to ${club.name}`,
    body: 'Open the club to accept the invitation.',
    link: `#/clubs/${club.id}`,
    actorId: req.user.id
  });
  res.json({ ok: true });
}));

router.post('/:id/leave', wrap(async (req, res) => {
  const club = loadClub(req.params.id);
  const role = clubRole(club.id, req.user.id);
  if (!role) throw new HttpError(400, 'You are not a member of this club.');
  if (role === 'owner') throw new HttpError(400, 'Transfer ownership before leaving your own club.');
  run('DELETE FROM club_members WHERE club_id = ? AND user_id = ?', club.id, req.user.id);
  removeFromClubChat(club.id, req.user.id);
  res.json({ ok: true });
}));

router.delete('/:id/members/:userId', wrap(async (req, res) => {
  const club = loadClub(req.params.id);
  const myRole = requireClubPower(req.user, club.id, 'admin');
  const targetId = Number(req.params.userId);
  const targetRole = clubRole(club.id, targetId);
  if (!targetRole) throw new HttpError(404, 'That member is not in this club.');
  if (targetRole === 'owner') throw new HttpError(403, 'The club owner cannot be removed.');
  if (ROLE_POWER[targetRole] >= ROLE_POWER[myRole] && !can(req.user, 'clubs.manage')) {
    throw new HttpError(403, 'You cannot remove somebody at your level.');
  }
  run('DELETE FROM club_members WHERE club_id = ? AND user_id = ?', club.id, targetId);
  removeFromClubChat(club.id, targetId);
  notify(targetId, { kind: 'club', title: `You were removed from ${club.name}`, link: '#/clubs', actorId: req.user.id });
  logActivity(req.user.id, 'club.member_removed', 'club', club.id, `user ${targetId}`);
  res.json({ ok: true });
}));

router.patch('/:id/members/:userId', wrap(async (req, res) => {
  const club = loadClub(req.params.id);
  const myRole = requireClubPower(req.user, club.id, 'admin');
  const targetId = Number(req.params.userId);
  const newRole = String(req.body.role || '');
  if (!CLUB_ROLES.includes(newRole)) throw new HttpError(400, 'Choose a valid club role.');
  if (newRole === 'owner') throw new HttpError(400, 'Use the transfer-ownership action instead.');
  if (!clubRole(club.id, targetId)) throw new HttpError(404, 'That member is not in this club.');
  if (ROLE_POWER[newRole] >= ROLE_POWER[myRole] && !can(req.user, 'clubs.manage')) {
    throw new HttpError(403, 'You cannot promote somebody to your own level.');
  }
  run('UPDATE club_members SET club_role = ? WHERE club_id = ? AND user_id = ?', newRole, club.id, targetId);
  notify(targetId, { kind: 'club', title: `You are now ${newRole} in ${club.name}`, link: `#/clubs/${club.id}`, actorId: req.user.id });
  logActivity(req.user.id, 'club.role_changed', 'club', club.id, `user ${targetId} -> ${newRole}`);
  res.json({ ok: true });
}));

router.post('/:id/transfer', wrap(async (req, res) => {
  const club = loadClub(req.params.id);
  if (club.owner_id !== req.user.id && !can(req.user, 'clubs.manage')) {
    throw new HttpError(403, 'Only the current owner or an administrator can transfer a club.');
  }
  const newOwnerId = Number(req.body.userId);
  if (!clubRole(club.id, newOwnerId)) throw new HttpError(400, 'The new owner must already be a club member.');
  db.transaction(() => {
    run("UPDATE club_members SET club_role = 'admin' WHERE club_id = ? AND club_role = 'owner'", club.id);
    run("UPDATE club_members SET club_role = 'owner' WHERE club_id = ? AND user_id = ?", club.id, newOwnerId);
    run('UPDATE clubs SET owner_id = ? WHERE id = ?', newOwnerId, club.id);
  })();
  logActivity(req.user.id, 'club.owner_changed', 'club', club.id, `new owner ${newOwnerId}`);
  notify(newOwnerId, { kind: 'club', title: `You are now the owner of ${club.name}`, link: `#/clubs/${club.id}`, actorId: req.user.id });
  res.json({ ok: true });
}));

// ---------------------------------------------------------------------------
// Club events
// ---------------------------------------------------------------------------
router.post('/:id/events', wrap(async (req, res) => {
  const club = loadClub(req.params.id);
  requireClubPower(req.user, club.id, 'moderator');
  const title = clean(req.body.title, 80);
  const startsAt = clean(req.body.startsAt, 30);
  if (!title || !startsAt) throw new HttpError(400, 'An event needs a title and a start time.');
  const info = run('INSERT INTO events (club_id, title, description, location, starts_at, created_by) VALUES (?, ?, ?, ?, ?, ?)',
    club.id, title, clean(req.body.description || '', 400), clean(req.body.location || '', 80), startsAt, req.user.id);
  const members = all('SELECT user_id FROM club_members WHERE club_id = ?', club.id).map((m) => m.user_id);
  notifyMany(members, {
    kind: 'event',
    title: `New event in ${club.name}: ${title}`,
    link: `#/clubs/${club.id}`,
    actorId: req.user.id
  }, req.user.id);
  res.status(201).json({ id: info.lastInsertRowid });
}));

router.delete('/:id/events/:eventId', wrap(async (req, res) => {
  const club = loadClub(req.params.id);
  requireClubPower(req.user, club.id, 'moderator');
  run('DELETE FROM events WHERE id = ? AND club_id = ?', Number(req.params.eventId), club.id);
  res.json({ ok: true });
}));

export { ensureClubConversation };
