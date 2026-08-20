import express from 'express';
import { db, get, all, run, logActivity } from '../db/index.js';
import { requireAuth, can } from '../lib/auth.js';
import { serializeMessage, userById } from '../lib/serialize.js';
import { HttpError, wrap, clean, parsePage, pairKey } from '../lib/util.js';
import { notify } from '../lib/notify.js';
import { toUser, toConversation, isOnline } from '../realtime/hub.js';
import { imageUploader, publicUrl } from '../lib/uploads.js';

export const router = express.Router();
router.use(requireAuth);

// ---------------------------------------------------------------------------
// Guards - who may talk to whom
// ---------------------------------------------------------------------------
export function assertCanMessage(sender, targetId) {
  if (Number(targetId) === Number(sender.id)) {
    throw new HttpError(400, 'You cannot message yourself.');
  }
  if (!sender.can_message) {
    throw new HttpError(403, 'An administrator has paused your messaging.', 'messaging_restricted');
  }
  const target = get('SELECT * FROM users WHERE id = ?', targetId);
  if (!target) throw new HttpError(404, 'That member could not be found.');
  if (target.status === 'deleted') throw new HttpError(403, 'That account no longer exists.');
  if (target.status === 'suspended') throw new HttpError(403, 'That account is suspended.');
  if (!target.can_message) throw new HttpError(403, 'That member cannot receive messages at the moment.');

  const blocked = get(`
    SELECT * FROM blocked_users
    WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)`,
  sender.id, targetId, targetId, sender.id);
  if (blocked) throw new HttpError(403, 'You cannot message this person.', 'blocked');

  return target;
}

/** Finds (or opens) the private conversation between two members. */
export function directConversation(userA, userB) {
  const key = pairKey(userA, userB);
  const existing = get('SELECT * FROM conversations WHERE pair_key = ?', key);
  if (existing) return existing;
  const create = db.transaction(() => {
    const info = run("INSERT INTO conversations (kind, pair_key) VALUES ('direct', ?)", key);
    run('INSERT INTO conversation_members (conversation_id, user_id) VALUES (?, ?)', info.lastInsertRowid, userA);
    run('INSERT INTO conversation_members (conversation_id, user_id) VALUES (?, ?)', info.lastInsertRowid, userB);
    return info.lastInsertRowid;
  });
  return get('SELECT * FROM conversations WHERE id = ?', create());
}

export function isMember(conversationId, userId) {
  return !!get('SELECT 1 AS x FROM conversation_members WHERE conversation_id = ? AND user_id = ?', conversationId, userId);
}

function conversationSummary(conv, viewerId) {
  const last = get('SELECT * FROM messages WHERE conversation_id = ? ORDER BY id DESC LIMIT 1', conv.id);
  const membership = get('SELECT * FROM conversation_members WHERE conversation_id = ? AND user_id = ?', conv.id, viewerId);
  const unread = get(
    'SELECT COUNT(*) AS n FROM messages WHERE conversation_id = ? AND sender_id != ? AND created_at > ?',
    conv.id, viewerId, membership?.last_read_at || '1970-01-01 00:00:00'
  ).n;

  let title = '';
  let avatarUrl = '';
  let other = null;
  if (conv.kind === 'club') {
    const club = get('SELECT * FROM clubs WHERE id = ?', conv.club_id);
    title = club ? `${club.name}` : 'Club chat';
    avatarUrl = club?.logo_url || '';
  } else {
    const otherRow = get(
      'SELECT user_id FROM conversation_members WHERE conversation_id = ? AND user_id != ? LIMIT 1',
      conv.id, viewerId
    );
    other = otherRow ? userById(otherRow.user_id) : null;
    title = other?.displayName || 'Unknown member';
    avatarUrl = other?.avatarUrl || '';
  }

  return {
    id: conv.id,
    kind: conv.kind,
    clubId: conv.club_id,
    title,
    avatarUrl,
    other,
    unread,
    lastMessage: last
      ? {
        body: last.is_deleted ? '[deleted]' : (last.body || (last.attachment_url ? 'Sent a picture' : '')),
        createdAt: last.created_at,
        senderId: last.sender_id,
        mine: last.sender_id === viewerId
      }
      : null,
    updatedAt: last?.created_at || conv.created_at,
    online: conv.kind === 'direct' ? Boolean(other?.online) : undefined,
    lastReadAt: membership?.last_read_at
  };
}

// ---------------------------------------------------------------------------
// Conversation list
// ---------------------------------------------------------------------------
router.get('/conversations', wrap(async (req, res) => {
  const rows = all(`
    SELECT c.* FROM conversations c
    JOIN conversation_members m ON m.conversation_id = c.id
    WHERE m.user_id = ?`, req.user.id);
  const list = rows
    .map((c) => conversationSummary(c, req.user.id))
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  res.json({ conversations: list });
}));

router.get('/unread-count', wrap(async (req, res) => {
  const rows = all(`
    SELECT c.id, m.last_read_at FROM conversations c
    JOIN conversation_members m ON m.conversation_id = c.id
    WHERE m.user_id = ?`, req.user.id);
  let total = 0;
  for (const r of rows) {
    total += get('SELECT COUNT(*) AS n FROM messages WHERE conversation_id = ? AND sender_id != ? AND created_at > ?',
      r.id, req.user.id, r.last_read_at).n;
  }
  res.json({ unread: total });
}));

/** Opens (or creates) a private chat with one classmate. */
router.post('/conversations/with/:userId', wrap(async (req, res) => {
  const target = assertCanMessage(req.user, Number(req.params.userId));
  const conv = directConversation(req.user.id, target.id);
  res.json({ conversation: conversationSummary(conv, req.user.id) });
}));

// ---------------------------------------------------------------------------
// Reading a conversation
// ---------------------------------------------------------------------------
router.get('/conversations/:id/messages', wrap(async (req, res) => {
  const convId = Number(req.params.id);
  const conv = get('SELECT * FROM conversations WHERE id = ?', convId);
  if (!conv) throw new HttpError(404, 'That conversation could not be found.');

  if (!isMember(convId, req.user.id)) {
    // Section 7: moderators need an explicit reason, and every look is recorded.
    if (!can(req.user, 'messages.moderate')) {
      throw new HttpError(403, 'This is a private conversation.', 'private_conversation');
    }
    const reason = clean(req.query.reason || '', 200);
    const reportId = req.query.reportId ? Number(req.query.reportId) : null;
    if (!reason) {
      throw new HttpError(400, 'Moderation access needs a written reason (usually a report number).', 'reason_required');
    }
    run('INSERT INTO message_access_logs (moderator_id, conversation_id, report_id, reason) VALUES (?, ?, ?, ?)',
      req.user.id, convId, reportId, reason);
    logActivity(req.user.id, 'messages.moderation_access', 'conversation', convId, reason);
    for (const m of all('SELECT user_id FROM conversation_members WHERE conversation_id = ?', convId)) {
      notify(m.user_id, {
        kind: 'moderation',
        title: 'A moderator reviewed a reported conversation',
        body: 'This access was recorded in the administration log.',
        link: '#/messages'
      });
    }
  }

  const { limit } = parsePage(req.query, 50, 200);
  const before = req.query.before ? Number(req.query.before) : null;
  const rows = before
    ? all('SELECT * FROM messages WHERE conversation_id = ? AND id < ? ORDER BY id DESC LIMIT ?', convId, before, limit)
    : all('SELECT * FROM messages WHERE conversation_id = ? ORDER BY id DESC LIMIT ?', convId, limit);

  const messages = rows.reverse().map((m) => serializeMessage(m, req.user.id));

  if (isMember(convId, req.user.id)) {
    run("UPDATE conversation_members SET last_read_at = datetime('now') WHERE conversation_id = ? AND user_id = ?", convId, req.user.id);
    toConversation(convId, 'message:read', { conversationId: convId, userId: req.user.id, at: new Date().toISOString() });
  }

  const members = all(`
    SELECT user_id, last_read_at FROM conversation_members WHERE conversation_id = ?`, convId)
    .map((m) => ({ user: userById(m.user_id), lastReadAt: m.last_read_at }));

  res.json({
    conversation: conversationSummary(conv, req.user.id),
    messages,
    members,
    readOnly: !isMember(convId, req.user.id)
  });
}));

// ---------------------------------------------------------------------------
// Sending
// ---------------------------------------------------------------------------
export function createMessage(sender, conversationId, { body = '', attachmentUrl = '', replyToId = null }) {
  const text = clean(body, 4000);
  if (!text && !attachmentUrl) throw new HttpError(400, 'Type a message first.');

  const info = run(
    'INSERT INTO messages (conversation_id, sender_id, body, attachment_url, reply_to_id) VALUES (?, ?, ?, ?, ?)',
    conversationId, sender.id, text, attachmentUrl, replyToId || null
  );
  const row = get('SELECT * FROM messages WHERE id = ?', info.lastInsertRowid);
  const message = serializeMessage(row, sender.id);

  toConversation(conversationId, 'message:new', { conversationId, message });

  const conv = get('SELECT * FROM conversations WHERE id = ?', conversationId);
  const others = all('SELECT user_id FROM conversation_members WHERE conversation_id = ? AND user_id != ?', conversationId, sender.id);
  for (const o of others) {
    toUser(o.user_id, 'conversation:bump', { conversationId });
    const title = conv.kind === 'club'
      ? `New message in ${get('SELECT name FROM clubs WHERE id = ?', conv.club_id)?.name || 'a club'}`
      : `New message from ${sender.display_name}`;
    notify(o.user_id, {
      kind: 'message',
      title,
      body: text.slice(0, 90) || 'Sent a picture',
      link: `#/messages/${conversationId}`,
      actorId: sender.id
    });
  }
  return message;
}

/** Used by the feed's "share internally" button. */
export async function sendDirectMessage(sender, targetId, payload) {
  const target = assertCanMessage(sender, targetId);
  const conv = directConversation(sender.id, target.id);
  return createMessage(sender, conv.id, payload);
}

router.post('/conversations/:id/messages', imageUploader('messages').single('image'), wrap(async (req, res) => {
  const convId = Number(req.params.id);
  const conv = get('SELECT * FROM conversations WHERE id = ?', convId);
  if (!conv) throw new HttpError(404, 'That conversation could not be found.');
  if (!isMember(convId, req.user.id)) throw new HttpError(403, 'You are not part of this conversation.');
  if (!req.user.can_message) throw new HttpError(403, 'An administrator has paused your messaging.', 'messaging_restricted');

  if (conv.kind === 'direct') {
    const otherRow = get('SELECT user_id FROM conversation_members WHERE conversation_id = ? AND user_id != ? LIMIT 1', convId, req.user.id);
    if (otherRow) assertCanMessage(req.user, otherRow.user_id);
  } else if (conv.kind === 'club') {
    const club = get('SELECT * FROM clubs WHERE id = ?', conv.club_id);
    if (club?.status === 'suspended') throw new HttpError(403, 'This club is suspended.');
  }

  const message = createMessage(req.user, convId, {
    body: req.body.body,
    attachmentUrl: req.file ? publicUrl('messages', req.file.filename) : '',
    replyToId: req.body.replyToId ? Number(req.body.replyToId) : null
  });
  res.status(201).json({ message });
}));

// ---------------------------------------------------------------------------
// Editing, deleting, reacting
// ---------------------------------------------------------------------------
router.patch('/:messageId', wrap(async (req, res) => {
  const row = get('SELECT * FROM messages WHERE id = ? AND is_deleted = 0', Number(req.params.messageId));
  if (!row) throw new HttpError(404, 'That message is gone.');
  if (row.sender_id !== req.user.id) throw new HttpError(403, 'You can only edit your own messages.');
  const body = clean(req.body.body, 4000);
  if (!body) throw new HttpError(400, 'A message cannot be empty.');
  run("UPDATE messages SET body = ?, edited_at = datetime('now') WHERE id = ?", body, row.id);
  const message = serializeMessage(get('SELECT * FROM messages WHERE id = ?', row.id), req.user.id);
  toConversation(row.conversation_id, 'message:updated', { conversationId: row.conversation_id, message });
  res.json({ message });
}));

router.delete('/:messageId', wrap(async (req, res) => {
  const row = get('SELECT * FROM messages WHERE id = ?', Number(req.params.messageId));
  if (!row) throw new HttpError(404, 'That message is gone.');
  const mine = row.sender_id === req.user.id;
  let allowed = mine;
  if (!allowed) {
    const conv = get('SELECT * FROM conversations WHERE id = ?', row.conversation_id);
    if (conv?.kind === 'club') {
      const role = get('SELECT club_role FROM club_members WHERE club_id = ? AND user_id = ?', conv.club_id, req.user.id)?.club_role;
      allowed = ['owner', 'admin', 'moderator'].includes(role) || can(req.user, 'clubs.manage');
    }
  }
  if (!allowed) throw new HttpError(403, 'You can only delete your own messages.');
  run('UPDATE messages SET is_deleted = 1 WHERE id = ?', row.id);
  if (!mine) logActivity(req.user.id, 'message.deleted', 'message', row.id, 'club moderation');
  toConversation(row.conversation_id, 'message:deleted', { conversationId: row.conversation_id, id: row.id });
  res.json({ ok: true });
}));

router.post('/:messageId/react', wrap(async (req, res) => {
  const row = get('SELECT * FROM messages WHERE id = ? AND is_deleted = 0', Number(req.params.messageId));
  if (!row) throw new HttpError(404, 'That message is gone.');
  if (!isMember(row.conversation_id, req.user.id)) throw new HttpError(403, 'You are not part of this conversation.');
  const emoji = clean(req.body.emoji, 8) || 'like';
  const existing = get('SELECT 1 AS x FROM message_reactions WHERE message_id = ? AND user_id = ? AND emoji = ?', row.id, req.user.id, emoji);
  if (existing) run('DELETE FROM message_reactions WHERE message_id = ? AND user_id = ? AND emoji = ?', row.id, req.user.id, emoji);
  else run('INSERT INTO message_reactions (message_id, user_id, emoji) VALUES (?, ?, ?)', row.id, req.user.id, emoji);
  const message = serializeMessage(get('SELECT * FROM messages WHERE id = ?', row.id), req.user.id);
  toConversation(row.conversation_id, 'message:updated', { conversationId: row.conversation_id, message });
  res.json({ message });
}));

router.post('/conversations/:id/read', wrap(async (req, res) => {
  const convId = Number(req.params.id);
  if (!isMember(convId, req.user.id)) throw new HttpError(403, 'You are not part of this conversation.');
  run("UPDATE conversation_members SET last_read_at = datetime('now') WHERE conversation_id = ? AND user_id = ?", convId, req.user.id);
  toConversation(convId, 'message:read', { conversationId: convId, userId: req.user.id, at: new Date().toISOString() });
  res.json({ ok: true });
}));
