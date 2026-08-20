import { get, all } from '../db/index.js';
import { levelFromXp } from './util.js';
import { isOnline } from '../realtime/hub.js';

/** The shape of a member as the browser sees it. Never includes the password. */
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
    avatarUrl: row.avatar_url || '',
    coverUrl: row.cover_url || '',
    bio: row.bio || '',
    classSection: row.class_section || 'Grade 8',
    favouriteSubject: row.favourite_subject || '',
    xp: row.xp || 0,
    level: lvl.level,
    levelProgress: lvl.progress,
    xpIntoLevel: lvl.intoLevel,
    xpForNextLevel: lvl.needed,
    joinedAt: row.created_at,
    lastSeen: row.last_seen,
    online: row.show_online === 0 ? false : isOnline(row.id),
    streakDays: row.streak_days || 0
  };
}

/** Everything the signed-in member needs about themselves. */
export function selfUser(row) {
  return {
    ...publicUser(row),
    email: row.email,
    permissions: row.permissions || [],
    canMessage: !!row.can_message,
    canPost: !!row.can_post,
    theme: row.theme || 'dark',
    accent: row.accent || 'violet',
    showOnline: row.show_online !== 0,
    mustChangePassword: !!row.must_change_pw
  };
}

export function userById(id) {
  const row = get(`
    SELECT u.*, p.avatar_url, p.cover_url, p.bio, p.class_section, p.favourite_subject,
           p.streak_days, p.show_online, r.name AS role_name
    FROM users u
    LEFT JOIN profiles p ON p.user_id = u.id
    LEFT JOIN roles r ON r.key = u.role_key
    WHERE u.id = ?`, id);
  return publicUser(row);
}

export function usersByIds(ids) {
  if (!ids.length) return [];
  const marks = ids.map(() => '?').join(',');
  return all(`
    SELECT u.*, p.avatar_url, p.cover_url, p.bio, p.class_section, p.favourite_subject,
           p.streak_days, p.show_online, r.name AS role_name
    FROM users u
    LEFT JOIN profiles p ON p.user_id = u.id
    LEFT JOIN roles r ON r.key = u.role_key
    WHERE u.id IN (${marks})`, ...ids).map(publicUser);
}

export function serializePost(row, viewerId) {
  const author = userById(row.author_id);
  const likes = get('SELECT COUNT(*) AS n FROM likes WHERE post_id = ?', row.id).n;
  const comments = get('SELECT COUNT(*) AS n FROM comments WHERE post_id = ? AND is_deleted = 0', row.id).n;
  const liked = viewerId ? !!get('SELECT 1 AS x FROM likes WHERE post_id = ? AND user_id = ?', row.id, viewerId) : false;
  const saved = viewerId ? !!get('SELECT 1 AS x FROM saved_posts WHERE post_id = ? AND user_id = ?', row.id, viewerId) : false;

  let poll = null;
  if (row.type === 'poll' && row.poll_json) {
    try {
      const parsed = JSON.parse(row.poll_json);
      const votes = all('SELECT option_index, COUNT(*) AS n FROM poll_votes WHERE post_id = ? GROUP BY option_index', row.id);
      const counts = {};
      let total = 0;
      for (const v of votes) { counts[v.option_index] = v.n; total += v.n; }
      const myVote = viewerId
        ? get('SELECT option_index FROM poll_votes WHERE post_id = ? AND user_id = ?', row.id, viewerId)?.option_index
        : undefined;
      poll = {
        question: parsed.question || '',
        options: (parsed.options || []).map((text, i) => ({
          text,
          votes: counts[i] || 0,
          percent: total ? Math.round(((counts[i] || 0) / total) * 100) : 0
        })),
        totalVotes: total,
        myVote: myVote === undefined ? null : myVote
      };
    } catch { poll = null; }
  }

  return {
    id: row.id,
    type: row.type,
    subject: row.subject || '',
    content: row.content,
    imageUrl: row.image_url || '',
    poll,
    pinned: !!row.pinned,
    createdAt: row.created_at,
    editedAt: row.edited_at,
    clubId: row.club_id,
    clubName: row.club_name || null,
    clubHandle: row.club_handle || null,
    author,
    likes,
    comments,
    liked,
    saved
  };
}

export function serializeComment(row, viewerId) {
  return {
    id: row.id,
    postId: row.post_id,
    content: row.is_deleted ? '[deleted]' : row.content,
    deleted: !!row.is_deleted,
    createdAt: row.created_at,
    editedAt: row.edited_at,
    author: userById(row.author_id),
    mine: viewerId === row.author_id
  };
}

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
        body: parent.is_deleted ? '[deleted]' : parent.body.slice(0, 140),
        author: userById(parent.sender_id)
      };
    }
  }
  return {
    id: row.id,
    conversationId: row.conversation_id,
    body: row.is_deleted ? '' : row.body,
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

export function serializeClub(row, viewerId) {
  const memberCount = get('SELECT COUNT(*) AS n FROM club_members WHERE club_id = ?', row.id).n;
  const membership = viewerId
    ? get('SELECT club_role FROM club_members WHERE club_id = ? AND user_id = ?', row.id, viewerId)
    : null;
  const pendingRequest = viewerId
    ? get("SELECT status, kind FROM club_requests WHERE club_id = ? AND user_id = ? AND status = 'pending'", row.id, viewerId)
    : null;
  return {
    id: row.id,
    name: row.name,
    handle: row.handle,
    description: row.description || '',
    category: row.category || 'General',
    rules: row.rules || '',
    logoUrl: row.logo_url || '',
    coverUrl: row.cover_url || '',
    status: row.status,
    createdAt: row.created_at,
    owner: userById(row.owner_id),
    memberCount,
    myRole: membership?.club_role || null,
    pending: pendingRequest ? pendingRequest.kind : null
  };
}

export function serializeHomework(row, viewerId) {
  const status = viewerId
    ? get('SELECT status FROM homework_status WHERE homework_id = ? AND user_id = ?', row.id, viewerId)?.status
    : null;
  return {
    id: row.id,
    subject: row.subject,
    title: row.title,
    description: row.description || '',
    instructions: row.instructions || '',
    dueDate: row.due_date,
    priority: row.priority,
    attachmentUrl: row.attachment_url || '',
    createdAt: row.created_at,
    createdBy: userById(row.created_by),
    myStatus: status || 'not_started'
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
    category: row.category,
    priority: row.priority,
    audience: row.audience,
    clubId: row.club_id,
    pinned: !!row.pinned,
    publishAt: row.publish_at,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    author: userById(row.author_id),
    read
  };
}
