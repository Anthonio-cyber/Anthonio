// ==========================================================
// Coding Hub - turning database rows into what the browser sees.
//
// A password hash never leaves this file, and the privacy settings
// in section 28 of the specification are applied here, so no route
// can accidentally leak somebody's online status or last seen time.
// ==========================================================
import { get, all } from '../db/index.js';
import { levelFromXp } from './util.js';
import { isOnline } from '../realtime/hub.js';

/** The shape of a member as everybody else sees them. */
export function publicUser(row) {
  if (!row) return null;
  const lvl = levelFromXp(row.xp || 0);
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    role: row.role_key,
    roleName: row.role_name || row.role_key,
    status: row.status,
    verified: !!row.verified,
    avatarUrl: row.avatar_url || '',
    coverUrl: row.cover_url || '',
    bio: row.bio || '',
    location: row.location || '',
    website: row.website || '',
    xp: row.xp || 0,
    level: lvl.level,
    levelTitle: levelTitle(lvl.level),
    levelProgress: lvl.progress,
    xpIntoLevel: lvl.intoLevel,
    xpForNextLevel: lvl.needed,
    joinedAt: row.created_at,
    // Privacy: hidden unless the member allows it.
    online: row.show_online === 0 ? false : isOnline(row.id),
    lastSeen: row.show_last_seen === 0 ? null : row.last_seen,
    streakDays: row.streak_days || 0
  };
}

/** Level names from section 31 of the specification. */
export function levelTitle(level) {
  if (level >= 50) return 'Expert';
  if (level >= 25) return 'Developer';
  if (level >= 10) return 'Coder';
  if (level >= 5) return 'Learner';
  return 'Beginner';
}

/** Everything the signed-in member needs about themselves. */
export function selfUser(row) {
  return {
    ...publicUser(row),
    email: row.email,
    permissions: row.permissions || [],
    canMessage: !!row.can_message,
    theme: row.theme || 'dark',
    accent: row.accent || 'violet',
    // Their own settings are always visible to them.
    online: true,
    lastSeen: row.last_seen,
    privacy: {
      whoCanMessage: row.who_can_message || 'everyone',
      showOnline: row.show_online !== 0,
      showLastSeen: row.show_last_seen !== 0,
      readReceipts: row.read_receipts !== 0
    },
    mustChangePassword: !!row.must_change_pw
  };
}

const USER_SELECT = `
  SELECT u.*, p.avatar_url, p.cover_url, p.bio, p.location, p.website,
         p.streak_days, p.show_online, p.show_last_seen, p.who_can_message,
         p.read_receipts, r.name AS role_name
  FROM users u
  LEFT JOIN profiles p ON p.user_id = u.id
  LEFT JOIN roles r ON r.key = u.role_key`;

export { USER_SELECT };

export function userById(id) {
  return publicUser(get(`${USER_SELECT} WHERE u.id = ?`, id));
}

export function usersByIds(ids) {
  if (!ids.length) return [];
  const marks = ids.map(() => '?').join(',');
  return all(`${USER_SELECT} WHERE u.id IN (${marks})`, ...ids).map(publicUser);
}

/**
 * One message, as the given viewer is allowed to see it.
 * Read receipts are only reported when the *sender* has them switched on.
 */
export function serializeMessage(row, viewerId) {
  const reactions = all('SELECT emoji, user_id FROM message_reactions WHERE message_id = ?', row.id);
  const grouped = {};
  for (const r of reactions) {
    grouped[r.emoji] = grouped[r.emoji] || { emoji: r.emoji, count: 0, mine: false };
    grouped[r.emoji].count += 1;
    if (r.user_id === viewerId) grouped[r.emoji].mine = true;
  }

  let replyTo = null;
  if (row.reply_to_id) {
    const parent = get('SELECT id, body, sender_id, is_deleted FROM messages WHERE id = ?', row.reply_to_id);
    if (parent) {
      replyTo = {
        id: parent.id,
        body: parent.is_deleted ? '[deleted]' : String(parent.body).slice(0, 140),
        author: userById(parent.sender_id)
      };
    }
  }

  return {
    id: row.id,
    conversationId: row.conversation_id,
    body: row.is_deleted ? '' : row.body,
    messageType: row.message_type || 'text',
    codeLanguage: row.code_language || '',
    deleted: !!row.is_deleted,
    attachmentUrl: row.is_deleted ? '' : (row.attachment_url || ''),
    createdAt: row.created_at,
    editedAt: row.edited_at,
    senderId: row.sender_id,
    sender: userById(row.sender_id),
    mine: row.sender_id === viewerId,
    reactions: Object.values(grouped),
    replyTo
  };
}

export function serializeAnnouncement(row, viewerId) {
  const read = viewerId
    ? !!get('SELECT 1 AS x FROM announcement_reads WHERE announcement_id = ? AND user_id = ?', row.id, viewerId)
    : false;
  return {
    id: row.id,
    title: row.title,
    message: row.message,
    priority: row.priority,
    audience: row.audience,
    audienceRef: row.audience_ref || '',
    pinned: !!row.pinned,
    publishAt: row.publish_at,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    author: userById(row.author_id),
    read
  };
}
