import express from 'express';
import { get, all, getSetting } from '../db/index.js';
import { requireAuth, can } from '../lib/auth.js';
import { serializePost, serializeAnnouncement, serializeHomework, serializeClub, userById } from '../lib/serialize.js';
import { wrap } from '../lib/util.js';
import { homeworkSummary } from './homework.js';
import { gameStats } from '../lib/xp.js';
import { onlineIds } from '../realtime/hub.js';

export const router = express.Router();
router.use(requireAuth);

/** Everything the home screen shows, in one request. */
router.get('/', wrap(async (req, res) => {
  const me = req.user;
  const staff = can(me, 'announcements.create') ? 1 : 0;

  const announcements = all(`
    SELECT a.* FROM announcements a
    WHERE a.is_deleted = 0 AND a.publish_at <= datetime('now')
      AND (a.expires_at IS NULL OR a.expires_at = '' OR a.expires_at > datetime('now'))
      AND (a.audience = 'everyone'
        OR (a.audience = 'students' AND ? = 0)
        OR (a.audience = 'staff' AND ? = 1)
        OR (a.audience = 'club' AND a.club_id IN (SELECT club_id FROM club_members WHERE user_id = ?)))
    ORDER BY a.pinned DESC, a.publish_at DESC LIMIT 5`, staff, staff, me.id)
    .map((a) => serializeAnnouncement(a, me.id));

  const homework = all(`
    SELECT h.* FROM homework h
    LEFT JOIN homework_status hs ON hs.homework_id = h.id AND hs.user_id = ?
    WHERE h.is_deleted = 0 AND COALESCE(hs.status, 'not_started') != 'completed'
    ORDER BY h.due_date ASC LIMIT 5`, me.id)
    .map((h) => serializeHomework(h, me.id));

  const posts = all(`
    SELECT p.*, c.name AS club_name, c.handle AS club_handle
    FROM posts p LEFT JOIN clubs c ON c.id = p.club_id
    WHERE p.is_deleted = 0
      AND (p.club_id IS NULL OR p.club_id IN (SELECT club_id FROM club_members WHERE user_id = ?))
      AND p.id NOT IN (SELECT post_id FROM hidden_posts WHERE user_id = ?)
    ORDER BY p.pinned DESC, p.created_at DESC LIMIT 5`, me.id, me.id)
    .map((p) => serializePost(p, me.id));

  const myClubs = all(`
    SELECT c.* FROM club_members cm JOIN clubs c ON c.id = cm.club_id
    WHERE cm.user_id = ? AND c.status = 'approved' ORDER BY c.name LIMIT 8`, me.id)
    .map((c) => serializeClub(c, me.id));

  const popularClubs = all(`
    SELECT c.*, COUNT(cm.user_id) AS members FROM clubs c
    LEFT JOIN club_members cm ON cm.club_id = c.id
    WHERE c.status = 'approved' AND c.id NOT IN (SELECT club_id FROM club_members WHERE user_id = ?)
    GROUP BY c.id ORDER BY members DESC LIMIT 4`, me.id)
    .map((c) => serializeClub(c, me.id));

  const events = all(`
    SELECT e.*, c.name AS club_name FROM events e
    LEFT JOIN clubs c ON c.id = e.club_id
    WHERE e.starts_at >= datetime('now', '-1 day')
      AND (e.club_id IS NULL OR e.club_id IN (SELECT club_id FROM club_members WHERE user_id = ?))
    ORDER BY e.starts_at ASC LIMIT 5`, me.id)
    .map((e) => ({ id: e.id, title: e.title, description: e.description, location: e.location, startsAt: e.starts_at, clubName: e.club_name }));

  const onlineNow = onlineIds()
    .filter((id) => id !== me.id)
    .map((id) => userById(id))
    .filter((u) => u && u.online)
    .slice(0, 12);

  const conversationRows = all(`
    SELECT c.id, m.last_read_at FROM conversations c
    JOIN conversation_members m ON m.conversation_id = c.id
    WHERE m.user_id = ?`, me.id);
  let unreadMessages = 0;
  for (const c of conversationRows) {
    unreadMessages += get('SELECT COUNT(*) AS n FROM messages WHERE conversation_id = ? AND sender_id != ? AND created_at > ?',
      c.id, me.id, c.last_read_at).n;
  }

  const pendingInvites = all(`
    SELECT gi.id, gi.game_key, g.name AS game_name, gi.from_user
    FROM game_invites gi JOIN games g ON g.key = gi.game_key
    WHERE gi.to_user = ? AND gi.status = 'pending'`, me.id)
    .map((i) => ({ id: i.id, gameKey: i.game_key, gameName: i.game_name, from: userById(i.from_user) }));

  const activeMatches = all(`
    SELECT COUNT(*) AS n FROM game_matches WHERE status = 'active' AND (player_x = ? OR player_o = ?)`, me.id, me.id)[0].n;

  const leaderboardEnabled = getSetting('leaderboard_enabled', 'true') === 'true';
  const topPlayers = leaderboardEnabled
    ? all("SELECT id FROM users WHERE status = 'active' ORDER BY xp DESC LIMIT 5").map((u) => userById(u.id))
    : [];

  res.json({
    greeting: `Welcome back, ${me.display_name}`,
    communityName: getSetting('community_name', 'Grade 8 Hub'),
    cards: {
      homework: homeworkSummary(me.id),
      unreadMessages,
      unreadNotifications: get('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND is_read = 0', me.id).n,
      clubCount: myClubs.length,
      streakDays: me.streak_days || 0,
      gameStats: gameStats(me.id),
      pendingGameInvites: pendingInvites.length,
      activeMatches
    },
    latestAnnouncement: announcements[0] || null,
    announcements,
    homework,
    posts,
    myClubs,
    popularClubs,
    events,
    onlineNow,
    gameInvites: pendingInvites,
    topPlayers,
    leaderboardEnabled
  });
}));
