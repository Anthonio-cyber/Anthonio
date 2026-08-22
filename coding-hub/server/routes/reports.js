import express from 'express';
import { get, all, run, logActivity } from '../db/index.js';
import { requireAuth, requirePermission } from '../lib/auth.js';
import { userById } from '../lib/serialize.js';
import { HttpError, wrap, clean, parsePage } from '../lib/util.js';
import { notify } from '../lib/notify.js';

export const router = express.Router();
router.use(requireAuth);

const TARGETS = ['message', 'user', 'profile', 'question', 'lesson'];
const REASONS = ['spam', 'harassment', 'scam', 'inappropriate', 'threatening', 'other'];

/** Anybody can report; the details go straight to the moderation queue. */
router.post('/', wrap(async (req, res) => {
  const targetType = String(req.body.targetType || '');
  const targetId = Number(req.body.targetId);
  const reason = String(req.body.reason || '');
  if (!TARGETS.includes(targetType)) throw new HttpError(400, 'That cannot be reported.');
  if (!REASONS.includes(reason)) throw new HttpError(400, 'Choose one of the listed reasons.');
  if (!targetId) throw new HttpError(400, 'The report is missing what it refers to.');

  const duplicate = get(
    "SELECT 1 AS x FROM reports WHERE reporter_id = ? AND target_type = ? AND target_id = ? AND status IN ('open','reviewing')",
    req.user.id, targetType, targetId
  );
  if (duplicate) return res.json({ ok: true, alreadyReported: true });

  const info = run('INSERT INTO reports (reporter_id, target_type, target_id, reason, details) VALUES (?, ?, ?, ?, ?)',
    req.user.id, targetType, targetId, reason, clean(req.body.details || '', 800));

  const moderators = all(`
    SELECT DISTINCT u.id FROM users u
    JOIN role_permissions rp ON rp.role_key = u.role_key
    WHERE rp.permission_key = 'reports.view' AND u.status = 'active'`);
  for (const m of moderators) {
    notify(m.id, {
      kind: 'report',
      title: `New ${reason} report on a ${targetType}`,
      body: 'Open the moderation queue to review it.',
      link: '#/admin/reports',
      actorId: req.user.id
    });
  }

  return res.status(201).json({ ok: true, id: info.lastInsertRowid });
}));

// ---------------------------------------------------------------------------
// The moderation queue
// ---------------------------------------------------------------------------
router.get('/', requirePermission('reports.view'), wrap(async (req, res) => {
  const { limit, offset } = parsePage(req.query, 30, 100);
  const status = clean(req.query.status || 'open', 20);
  const rows = status === 'all'
    ? all('SELECT * FROM reports ORDER BY created_at DESC LIMIT ? OFFSET ?', limit, offset)
    : all('SELECT * FROM reports WHERE status = ? ORDER BY created_at DESC LIMIT ? OFFSET ?', status, limit, offset);

  res.json({
    reports: rows.map((r) => ({
      id: r.id,
      targetType: r.target_type,
      targetId: r.target_id,
      reason: r.reason,
      details: r.details,
      status: r.status,
      resolution: r.resolution,
      createdAt: r.created_at,
      resolvedAt: r.resolved_at,
      reporter: userById(r.reporter_id),
      resolvedBy: r.resolved_by ? userById(r.resolved_by) : null,
      preview: previewTarget(r.target_type, r.target_id)
    })),
    counts: {
      open: get("SELECT COUNT(*) AS n FROM reports WHERE status = 'open'").n,
      reviewing: get("SELECT COUNT(*) AS n FROM reports WHERE status = 'reviewing'").n,
      resolved: get("SELECT COUNT(*) AS n FROM reports WHERE status = 'resolved'").n
    }
  });
}));

/**
 * A short, safe preview of what was reported.
 * Private message bodies are never included here - a moderator has to open
 * the conversation on purpose, which is logged separately.
 */
function previewTarget(type, id) {
  if (type === 'post') {
    const p = get('SELECT content, author_id, is_deleted FROM posts WHERE id = ?', id);
    return p ? { text: p.content.slice(0, 200), author: userById(p.author_id), removed: !!p.is_deleted, link: `#/post/${id}` } : null;
  }
  if (type === 'comment') {
    const c = get('SELECT content, author_id, post_id, is_deleted FROM comments WHERE id = ?', id);
    return c ? { text: c.content.slice(0, 200), author: userById(c.author_id), removed: !!c.is_deleted, link: `#/post/${c.post_id}` } : null;
  }
  if (type === 'user' || type === 'profile') {
    const u = userById(id);
    return u ? { text: u.bio || '', author: u, link: `#/profile/${u.username}` } : null;
  }
  if (type === 'club') {
    const c = get('SELECT name, description, owner_id FROM clubs WHERE id = ?', id);
    return c ? { text: `${c.name} — ${c.description}`.slice(0, 200), author: userById(c.owner_id), link: `#/clubs/${id}` } : null;
  }
  if (type === 'message') {
    const m = get('SELECT conversation_id, sender_id FROM messages WHERE id = ?', id);
    return m
      ? {
        text: 'Private message. Opening the conversation is recorded in the activity log.',
        author: userById(m.sender_id),
        conversationId: m.conversation_id,
        requiresAuthorisation: true
      }
      : null;
  }
  return null;
}

router.post('/:id/resolve', requirePermission('reports.resolve'), wrap(async (req, res) => {
  const report = get('SELECT * FROM reports WHERE id = ?', Number(req.params.id));
  if (!report) throw new HttpError(404, 'That report could not be found.');
  const action = String(req.body.action || 'resolve');
  const status = action === 'dismiss' ? 'dismissed' : (action === 'review' ? 'reviewing' : 'resolved');
  const resolution = clean(req.body.resolution || '', 500);

  run(`UPDATE reports SET status = ?, resolution = ?, resolved_by = ?,
       resolved_at = CASE WHEN ? IN ('resolved','dismissed') THEN datetime('now') ELSE NULL END
       WHERE id = ?`, status, resolution, req.user.id, status, report.id);

  // Optional follow-up action on the reported item.
  const followUp = String(req.body.followUp || 'none');
  if (followUp === 'remove_content') {
    if (report.target_type === 'post') run('UPDATE posts SET is_deleted = 1 WHERE id = ?', report.target_id);
    if (report.target_type === 'comment') run('UPDATE comments SET is_deleted = 1 WHERE id = ?', report.target_id);
    if (report.target_type === 'message') run('UPDATE messages SET is_deleted = 1 WHERE id = ?', report.target_id);
    logActivity(req.user.id, 'moderation.content_removed', report.target_type, report.target_id, `report ${report.id}`);
  }

  notify(report.reporter_id, {
    kind: 'report',
    title: `Your report was ${status}`,
    body: resolution || 'Thank you for helping keep the hub safe.',
    link: '#/notifications'
  });

  logActivity(req.user.id, `report.${status}`, 'report', report.id, resolution);
  res.json({ ok: true, status });
}));

/** The log of every time a moderator opened a private conversation. */
router.get('/message-access-log', requirePermission('logs.view'), wrap(async (req, res) => {
  const rows = all('SELECT * FROM message_access_logs ORDER BY created_at DESC LIMIT 100');
  res.json({
    entries: rows.map((r) => ({
      id: r.id,
      moderator: userById(r.moderator_id),
      conversationId: r.conversation_id,
      reportId: r.report_id,
      reason: r.reason,
      createdAt: r.created_at
    }))
  });
}));
