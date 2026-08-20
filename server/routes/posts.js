import express from 'express';
import { db, get, all, run, logActivity } from '../db/index.js';
import { requireAuth, can } from '../lib/auth.js';
import { serializePost, serializeComment } from '../lib/serialize.js';
import { HttpError, wrap, clean, parsePage } from '../lib/util.js';
import { imageUploader, publicUrl } from '../lib/uploads.js';
import { awardXp, grantAchievement, xpValue } from '../lib/xp.js';
import { notify, notifyMany } from '../lib/notify.js';
import { toEveryone, toClub } from '../realtime/hub.js';

export const router = express.Router();
router.use(requireAuth);

const POST_TYPES = ['text', 'image', 'poll', 'homework_question', 'study', 'announcement'];

const POST_SELECT = `
  SELECT p.*, c.name AS club_name, c.handle AS club_handle
  FROM posts p LEFT JOIN clubs c ON c.id = p.club_id`;

function canModerate(user) {
  return can(user, 'posts.moderate');
}

function clubRoleOf(clubId, userId) {
  return get('SELECT club_role FROM club_members WHERE club_id = ? AND user_id = ?', clubId, userId)?.club_role || null;
}

// ---- Read the feed ---------------------------------------------------------
router.get('/', wrap(async (req, res) => {
  const { limit, offset } = parsePage(req.query, 20, 50);
  const filter = clean(req.query.filter || 'all', 30);
  const clubId = req.query.clubId ? Number(req.query.clubId) : null;

  const where = ['p.is_deleted = 0'];
  const params = [];

  if (clubId) {
    if (!clubRoleOf(clubId, req.user.id) && !canModerate(req.user)) {
      throw new HttpError(403, 'Join this club to read its posts.');
    }
    where.push('p.club_id = ?');
    params.push(clubId);
  } else {
    // The main feed shows class posts plus posts from clubs you belong to.
    where.push(`(p.club_id IS NULL OR p.club_id IN (SELECT club_id FROM club_members WHERE user_id = ?))`);
    params.push(req.user.id);
  }

  if (filter === 'saved') {
    where.push('p.id IN (SELECT post_id FROM saved_posts WHERE user_id = ?)');
    params.push(req.user.id);
  } else if (filter === 'mine') {
    where.push('p.author_id = ?');
    params.push(req.user.id);
  } else if (POST_TYPES.includes(filter)) {
    where.push('p.type = ?');
    params.push(filter);
  }

  where.push('p.id NOT IN (SELECT post_id FROM hidden_posts WHERE user_id = ?)');
  params.push(req.user.id);

  const rows = all(
    `${POST_SELECT} WHERE ${where.join(' AND ')} ORDER BY p.pinned DESC, p.created_at DESC LIMIT ? OFFSET ?`,
    ...params, limit, offset
  );
  res.json({ posts: rows.map((r) => serializePost(r, req.user.id)) });
}));

router.get('/:id', wrap(async (req, res) => {
  const row = get(`${POST_SELECT} WHERE p.id = ? AND p.is_deleted = 0`, Number(req.params.id));
  if (!row) throw new HttpError(404, 'That post is no longer available.');
  res.json({ post: serializePost(row, req.user.id) });
}));

// ---- Create --------------------------------------------------------------
router.post('/', imageUploader('posts').single('image'), wrap(async (req, res) => {
  if (!req.user.can_post) throw new HttpError(403, 'An administrator has paused your posting.', 'posting_restricted');
  if (!can(req.user, 'posts.create')) throw new HttpError(403, 'You cannot create posts.');

  const type = POST_TYPES.includes(req.body.type) ? req.body.type : 'text';
  const content = clean(req.body.content, 4000);
  const subject = clean(req.body.subject || '', 40);
  const clubId = req.body.clubId ? Number(req.body.clubId) : null;

  if (type === 'announcement' && !can(req.user, 'announcements.create')) {
    throw new HttpError(403, 'Only teachers and administrators can post class announcements.');
  }
  if (clubId) {
    const role = clubRoleOf(clubId, req.user.id);
    if (!role) throw new HttpError(403, 'You are not a member of that club.');
  }

  let pollJson = '';
  if (type === 'poll') {
    let options = req.body.options;
    if (typeof options === 'string') {
      try { options = JSON.parse(options); } catch { options = options.split('\n'); }
    }
    const cleaned = (options || []).map((o) => clean(o, 80)).filter(Boolean).slice(0, 6);
    if (cleaned.length < 2) throw new HttpError(400, 'A poll needs at least two options.');
    pollJson = JSON.stringify({ question: content, options: cleaned });
  } else if (!content && !req.file) {
    throw new HttpError(400, 'Write something before you post.');
  }

  const imageUrl = req.file ? publicUrl('posts', req.file.filename) : '';
  const info = run(
    'INSERT INTO posts (author_id, club_id, type, subject, content, image_url, poll_json) VALUES (?, ?, ?, ?, ?, ?, ?)',
    req.user.id, clubId, type, subject, content, imageUrl, pollJson
  );

  awardXp(req.user.id, xpValue('xp_post', 2), 'post');
  const myPosts = get('SELECT COUNT(*) AS n FROM posts WHERE author_id = ? AND is_deleted = 0', req.user.id).n;
  if (myPosts === 1) grantAchievement(req.user.id, 'first_post');

  const row = get(`${POST_SELECT} WHERE p.id = ?`, info.lastInsertRowid);
  const post = serializePost(row, req.user.id);

  if (clubId) {
    toClub(clubId, 'post:new', { post });
    const members = all('SELECT user_id FROM club_members WHERE club_id = ?', clubId).map((m) => m.user_id);
    const club = get('SELECT name FROM clubs WHERE id = ?', clubId);
    notifyMany(members, {
      kind: 'club_post',
      title: `New post in ${club.name}`,
      body: content.slice(0, 100),
      link: `#/clubs/${clubId}`,
      actorId: req.user.id
    }, req.user.id);
  } else {
    toEveryone('post:new', { post });
  }

  res.status(201).json({ post });
}));

// ---- Edit / delete --------------------------------------------------------
router.patch('/:id', wrap(async (req, res) => {
  const row = get('SELECT * FROM posts WHERE id = ? AND is_deleted = 0', Number(req.params.id));
  if (!row) throw new HttpError(404, 'That post is no longer available.');
  const mine = row.author_id === req.user.id;
  if (!mine && !canModerate(req.user)) throw new HttpError(403, 'You can only edit your own posts.');

  const content = clean(req.body.content, 4000);
  if (!content && row.type !== 'image') throw new HttpError(400, 'A post cannot be empty.');
  run("UPDATE posts SET content = ?, edited_at = datetime('now') WHERE id = ?", content, row.id);
  if (!mine) logActivity(req.user.id, 'post.moderated_edit', 'post', row.id);

  const updated = get(`${POST_SELECT} WHERE p.id = ?`, row.id);
  res.json({ post: serializePost(updated, req.user.id) });
}));

router.delete('/:id', wrap(async (req, res) => {
  const row = get('SELECT * FROM posts WHERE id = ?', Number(req.params.id));
  if (!row) throw new HttpError(404, 'That post is no longer available.');
  const mine = row.author_id === req.user.id;
  if (!mine && !canModerate(req.user)) throw new HttpError(403, 'You can only delete your own posts.');
  run('UPDATE posts SET is_deleted = 1 WHERE id = ?', row.id);
  if (!mine) logActivity(req.user.id, 'post.deleted', 'post', row.id, 'moderation');
  toEveryone('post:deleted', { id: row.id });
  res.json({ ok: true });
}));

router.post('/:id/pin', wrap(async (req, res) => {
  if (!canModerate(req.user)) throw new HttpError(403, 'Only moderators can pin posts.');
  const row = get('SELECT * FROM posts WHERE id = ?', Number(req.params.id));
  if (!row) throw new HttpError(404, 'That post is no longer available.');
  const pinned = row.pinned ? 0 : 1;
  run('UPDATE posts SET pinned = ? WHERE id = ?', pinned, row.id);
  logActivity(req.user.id, pinned ? 'post.pinned' : 'post.unpinned', 'post', row.id);
  res.json({ pinned: !!pinned });
}));

// ---- Reactions -------------------------------------------------------------
router.post('/:id/like', wrap(async (req, res) => {
  const id = Number(req.params.id);
  const post = get('SELECT * FROM posts WHERE id = ? AND is_deleted = 0', id);
  if (!post) throw new HttpError(404, 'That post is no longer available.');

  const liked = get('SELECT 1 AS x FROM likes WHERE post_id = ? AND user_id = ?', id, req.user.id);
  if (liked) {
    run('DELETE FROM likes WHERE post_id = ? AND user_id = ?', id, req.user.id);
  } else {
    run('INSERT INTO likes (post_id, user_id) VALUES (?, ?)', id, req.user.id);
    if (post.author_id !== req.user.id) {
      notify(post.author_id, {
        kind: 'like',
        title: `${req.user.display_name} liked your post`,
        body: post.content.slice(0, 80),
        link: `#/post/${id}`,
        actorId: req.user.id
      });
    }
  }
  const likes = get('SELECT COUNT(*) AS n FROM likes WHERE post_id = ?', id).n;
  toEveryone('post:likes', { id, likes });
  res.json({ liked: !liked, likes });
}));

router.post('/:id/save', wrap(async (req, res) => {
  const id = Number(req.params.id);
  const saved = get('SELECT 1 AS x FROM saved_posts WHERE post_id = ? AND user_id = ?', id, req.user.id);
  if (saved) run('DELETE FROM saved_posts WHERE post_id = ? AND user_id = ?', id, req.user.id);
  else run('INSERT INTO saved_posts (post_id, user_id) VALUES (?, ?)', id, req.user.id);
  res.json({ saved: !saved });
}));

router.post('/:id/hide', wrap(async (req, res) => {
  run('INSERT OR IGNORE INTO hidden_posts (post_id, user_id) VALUES (?, ?)', Number(req.params.id), req.user.id);
  res.json({ ok: true });
}));

router.post('/:id/vote', wrap(async (req, res) => {
  const id = Number(req.params.id);
  const post = get('SELECT * FROM posts WHERE id = ? AND is_deleted = 0', id);
  if (!post || post.type !== 'poll') throw new HttpError(404, 'That poll could not be found.');
  const index = Number(req.body.optionIndex);
  const poll = JSON.parse(post.poll_json || '{"options":[]}');
  if (!Number.isInteger(index) || index < 0 || index >= poll.options.length) {
    throw new HttpError(400, 'Pick one of the poll options.');
  }
  run('INSERT INTO poll_votes (post_id, user_id, option_index) VALUES (?, ?, ?) ON CONFLICT(post_id, user_id) DO UPDATE SET option_index = excluded.option_index',
    id, req.user.id, index);
  const row = get(`${POST_SELECT} WHERE p.id = ?`, id);
  res.json({ post: serializePost(row, req.user.id) });
}));

/** "Share internally" - sends the post to a classmate as a direct message. */
router.post('/:id/share', wrap(async (req, res) => {
  const postId = Number(req.params.id);
  const post = get('SELECT * FROM posts WHERE id = ? AND is_deleted = 0', postId);
  if (!post) throw new HttpError(404, 'That post is no longer available.');
  const toUserId = Number(req.body.userId);
  const { sendDirectMessage } = await import('./messages.js');
  const message = await sendDirectMessage(req.user, toUserId, {
    body: `Shared a post: ${post.content.slice(0, 120)}\n#/post/${postId}`
  });
  res.json({ ok: true, message });
}));

// ---- Comments --------------------------------------------------------------
router.get('/:id/comments', wrap(async (req, res) => {
  const rows = all('SELECT * FROM comments WHERE post_id = ? ORDER BY created_at ASC', Number(req.params.id));
  res.json({ comments: rows.map((r) => serializeComment(r, req.user.id)) });
}));

router.post('/:id/comments', wrap(async (req, res) => {
  if (!req.user.can_post) throw new HttpError(403, 'An administrator has paused your posting.', 'posting_restricted');
  const postId = Number(req.params.id);
  const post = get('SELECT * FROM posts WHERE id = ? AND is_deleted = 0', postId);
  if (!post) throw new HttpError(404, 'That post is no longer available.');
  const content = clean(req.body.content, 1000);
  if (!content) throw new HttpError(400, 'Write a comment first.');

  const info = run('INSERT INTO comments (post_id, author_id, content) VALUES (?, ?, ?)', postId, req.user.id, content);
  const row = get('SELECT * FROM comments WHERE id = ?', info.lastInsertRowid);

  if (post.author_id !== req.user.id) {
    notify(post.author_id, {
      kind: 'comment',
      title: `${req.user.display_name} commented on your post`,
      body: content.slice(0, 80),
      link: `#/post/${postId}`,
      actorId: req.user.id
    });
  }
  const comment = serializeComment(row, req.user.id);
  toEveryone('comment:new', { postId, comment });
  res.status(201).json({ comment });
}));

router.patch('/comments/:commentId', wrap(async (req, res) => {
  const row = get('SELECT * FROM comments WHERE id = ? AND is_deleted = 0', Number(req.params.commentId));
  if (!row) throw new HttpError(404, 'That comment is gone.');
  if (row.author_id !== req.user.id && !canModerate(req.user)) throw new HttpError(403, 'You can only edit your own comments.');
  const content = clean(req.body.content, 1000);
  if (!content) throw new HttpError(400, 'A comment cannot be empty.');
  run("UPDATE comments SET content = ?, edited_at = datetime('now') WHERE id = ?", content, row.id);
  res.json({ comment: serializeComment(get('SELECT * FROM comments WHERE id = ?', row.id), req.user.id) });
}));

router.delete('/comments/:commentId', wrap(async (req, res) => {
  const row = get('SELECT * FROM comments WHERE id = ?', Number(req.params.commentId));
  if (!row) throw new HttpError(404, 'That comment is gone.');
  if (row.author_id !== req.user.id && !canModerate(req.user)) throw new HttpError(403, 'You can only delete your own comments.');
  run('UPDATE comments SET is_deleted = 1 WHERE id = ?', row.id);
  if (row.author_id !== req.user.id) logActivity(req.user.id, 'comment.deleted', 'comment', row.id, 'moderation');
  res.json({ ok: true });
}));
