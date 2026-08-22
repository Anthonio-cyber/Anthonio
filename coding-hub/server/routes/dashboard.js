// ==========================================================
// Coding Hub - the signed-in member's dashboard (section 14).
// Continue learning, progress, achievements, recent activity
// and unread messages, all in one request.
// ==========================================================
import express from 'express';
import { get, all, getSetting } from '../db/index.js';
import { requireAuth } from '../lib/auth.js';
import { userById, serializeAnnouncement } from '../lib/serialize.js';
import { wrap } from '../lib/util.js';
import { learnerStats, subjectBreakdown, continueLearning, serializeSubject } from '../lib/learn.js';

export const router = express.Router();
router.use(requireAuth);

router.get('/', wrap(async (req, res) => {
  const me = req.user;

  const announcements = all(`
    SELECT a.* FROM announcements a
    WHERE a.is_deleted = 0 AND a.publish_at <= datetime('now')
      AND (a.expires_at IS NULL OR a.expires_at = '' OR a.expires_at > datetime('now'))
      AND (a.audience = 'everyone'
        OR (a.audience = 'roles' AND ',' || a.audience_ref || ',' LIKE '%,' || ? || ',%')
        OR (a.audience = 'users'  AND ',' || a.audience_ref || ',' LIKE '%,' || ? || ',%')
        OR (a.audience = 'new_users' AND ? >= datetime('now', '-14 days')))
    ORDER BY a.pinned DESC, a.publish_at DESC LIMIT 5`,
  me.role_key, String(me.id), me.created_at)
    .map((a) => serializeAnnouncement(a, me.id));

  const conversationRows = all(`
    SELECT c.id, m.last_read_at FROM conversations c
    JOIN conversation_members m ON m.conversation_id = c.id
    WHERE m.user_id = ?`, me.id);
  let unreadMessages = 0;
  for (const c of conversationRows) {
    unreadMessages += get(
      'SELECT COUNT(*) AS n FROM messages WHERE conversation_id = ? AND sender_id != ? AND created_at > ? AND is_deleted = 0',
      c.id, me.id, c.last_read_at
    ).n;
  }

  const recentConversations = all(`
    SELECT c.id, MAX(msg.id) AS last_id
    FROM conversations c
    JOIN conversation_members cm ON cm.conversation_id = c.id AND cm.user_id = ?
    LEFT JOIN messages msg ON msg.conversation_id = c.id
    GROUP BY c.id ORDER BY last_id DESC LIMIT 5`, me.id)
    .filter((c) => c.last_id)
    .map((c) => {
      const last = get('SELECT * FROM messages WHERE id = ?', c.last_id);
      const otherRow = get('SELECT user_id FROM conversation_members WHERE conversation_id = ? AND user_id != ? LIMIT 1', c.id, me.id);
      const membership = get('SELECT last_read_at FROM conversation_members WHERE conversation_id = ? AND user_id = ?', c.id, me.id);
      return {
        id: c.id,
        other: otherRow ? userById(otherRow.user_id) : null,
        preview: last.is_deleted ? '[deleted]' : (last.message_type === 'code' ? 'Code snippet' : String(last.body).slice(0, 80)),
        at: last.created_at,
        unread: get('SELECT COUNT(*) AS n FROM messages WHERE conversation_id = ? AND sender_id != ? AND created_at > ? AND is_deleted = 0',
          c.id, me.id, membership?.last_read_at || '1970-01-01 00:00:00').n
      };
    });

  const badges = all(`
    SELECT b.key, b.name, b.description, b.icon, ub.awarded_at
    FROM user_badges ub JOIN badges b ON b.key = ub.badge_key
    WHERE ub.user_id = ? ORDER BY ub.awarded_at DESC LIMIT 8`, me.id);

  const subjects = all('SELECT * FROM subjects WHERE published = 1 ORDER BY position, id')
    .map((s) => serializeSubject(s, me.id));

  res.json({
    siteName: getSetting('site_name', 'Coding Hub'),
    tagline: getSetting('site_tagline', ''),
    greeting: `Welcome back, ${me.display_name}`,
    stats: learnerStats(me.id),
    continueLesson: continueLearning(me.id),
    subjects,
    breakdown: subjectBreakdown(me.id),
    badges,
    recent: recentActivity(me.id),
    announcements,
    latestAnnouncement: announcements[0] || null,
    unreadMessages,
    unreadNotifications: get('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND is_read = 0', me.id).n,
    conversations: recentConversations,
    streakDays: me.streak_days || 0,
    leaderboardsEnabled: getSetting('leaderboards_enabled', 'true') === 'true'
  });
}));

function recentActivity(userId, limit = 8) {
  const lessons = all(`
    SELECT lp.status, lp.opened_at, lp.completed_at, l.id, l.title, t.name AS topic_name, s.name AS subject_name
    FROM lesson_progress lp
    JOIN lessons l ON l.id = lp.lesson_id
    JOIN topics t ON t.id = l.topic_id
    JOIN subjects s ON s.id = t.subject_id
    WHERE lp.user_id = ? ORDER BY COALESCE(lp.completed_at, lp.opened_at) DESC LIMIT ?`, userId, limit)
    .map((r) => ({
      kind: r.status === 'completed' ? 'lesson_completed' : 'lesson_opened',
      at: r.completed_at || r.opened_at,
      title: r.title,
      subtitle: `${r.subject_name} - ${r.topic_name}`,
      link: `#/lesson/${r.id}`
    }));

  const challenges = all(`
    SELECT cc.completed_at, c.title, l.id AS lesson_id, s.name AS subject_name
    FROM challenge_completions cc
    JOIN challenges c ON c.id = cc.challenge_id
    JOIN lessons l ON l.id = c.lesson_id
    JOIN topics t ON t.id = l.topic_id
    JOIN subjects s ON s.id = t.subject_id
    WHERE cc.user_id = ? ORDER BY cc.completed_at DESC LIMIT ?`, userId, limit)
    .map((r) => ({
      kind: 'challenge_completed',
      at: r.completed_at,
      title: r.title,
      subtitle: `${r.subject_name} - coding challenge`,
      link: `#/lesson/${r.lesson_id}`
    }));

  return [...lessons, ...challenges]
    .sort((a, b) => String(b.at).localeCompare(String(a.at)))
    .slice(0, limit);
}
