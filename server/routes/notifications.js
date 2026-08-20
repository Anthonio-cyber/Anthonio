import express from 'express';
import { get, all, run } from '../db/index.js';
import { requireAuth } from '../lib/auth.js';
import { userById } from '../lib/serialize.js';
import { wrap, parsePage } from '../lib/util.js';

export const router = express.Router();
router.use(requireAuth);

const shape = (row) => ({
  id: row.id,
  kind: row.kind,
  title: row.title,
  body: row.body,
  link: row.link,
  read: !!row.is_read,
  createdAt: row.created_at,
  actor: row.actor_id ? userById(row.actor_id) : null
});

router.get('/', wrap(async (req, res) => {
  const { limit, offset } = parsePage(req.query, 30, 100);
  const onlyUnread = req.query.unread === 'true';
  const rows = onlyUnread
    ? all('SELECT * FROM notifications WHERE user_id = ? AND is_read = 0 ORDER BY id DESC LIMIT ? OFFSET ?', req.user.id, limit, offset)
    : all('SELECT * FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT ? OFFSET ?', req.user.id, limit, offset);
  const unread = get('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND is_read = 0', req.user.id).n;
  res.json({ notifications: rows.map(shape), unread });
}));

router.get('/count', wrap(async (req, res) => {
  const unread = get('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND is_read = 0', req.user.id).n;
  res.json({ unread });
}));

router.post('/:id/read', wrap(async (req, res) => {
  run('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', Number(req.params.id), req.user.id);
  const unread = get('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND is_read = 0', req.user.id).n;
  res.json({ ok: true, unread });
}));

router.post('/read-all', wrap(async (req, res) => {
  run('UPDATE notifications SET is_read = 1 WHERE user_id = ?', req.user.id);
  res.json({ ok: true, unread: 0 });
}));

router.delete('/:id', wrap(async (req, res) => {
  run('DELETE FROM notifications WHERE id = ? AND user_id = ?', Number(req.params.id), req.user.id);
  res.json({ ok: true });
}));

router.delete('/', wrap(async (req, res) => {
  run('DELETE FROM notifications WHERE user_id = ?', req.user.id);
  res.json({ ok: true });
}));
