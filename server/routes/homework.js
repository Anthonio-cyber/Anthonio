import express from 'express';
import { get, all, run, logActivity } from '../db/index.js';
import { requireAuth, requirePermission, can } from '../lib/auth.js';
import { serializeHomework, userById } from '../lib/serialize.js';
import { HttpError, wrap, clean, parsePage } from '../lib/util.js';
import { attachmentUploader, publicUrl } from '../lib/uploads.js';
import { notifyMany } from '../lib/notify.js';
import { awardXp, grantAchievement, xpValue } from '../lib/xp.js';

export const router = express.Router();
router.use(requireAuth);

const PRIORITIES = ['normal', 'important', 'urgent'];
const STATUSES = ['not_started', 'in_progress', 'completed'];

const activeStudentIds = () =>
  all("SELECT id FROM users WHERE status = 'active'").map((u) => u.id);

// ---------------------------------------------------------------------------
// Listing
// ---------------------------------------------------------------------------
router.get('/', wrap(async (req, res) => {
  const { limit, offset } = parsePage(req.query, 50, 100);
  const filter = clean(req.query.filter || 'all', 20);
  const subject = clean(req.query.subject || '', 40);

  const where = ['h.is_deleted = 0'];
  const params = [];
  if (subject) { where.push('h.subject = ?'); params.push(subject); }

  const rows = all(`
    SELECT h.* FROM homework h
    WHERE ${where.join(' AND ')}
    ORDER BY h.due_date ASC LIMIT ? OFFSET ?`, ...params, limit, offset);

  let list = rows.map((r) => serializeHomework(r, req.user.id));
  const today = new Date().toISOString().slice(0, 10);

  if (filter === 'due_today') list = list.filter((h) => h.dueDate.slice(0, 10) === today);
  else if (filter === 'overdue') list = list.filter((h) => h.dueDate.slice(0, 10) < today && h.myStatus !== 'completed');
  else if (filter === 'completed') list = list.filter((h) => h.myStatus === 'completed');
  else if (filter === 'outstanding') list = list.filter((h) => h.myStatus !== 'completed');

  const subjects = all('SELECT DISTINCT subject FROM homework WHERE is_deleted = 0 ORDER BY subject').map((r) => r.subject);
  res.json({ homework: list, subjects, summary: homeworkSummary(req.user.id), canCreate: can(req.user, 'homework.create') });
}));

export function homeworkSummary(userId) {
  const rows = all(`
    SELECT h.id, h.due_date, COALESCE(hs.status, 'not_started') AS status
    FROM homework h
    LEFT JOIN homework_status hs ON hs.homework_id = h.id AND hs.user_id = ?
    WHERE h.is_deleted = 0`, userId);
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  const summary = { dueToday: 0, dueTomorrow: 0, overdue: 0, completed: 0, outstanding: 0, total: rows.length };
  for (const r of rows) {
    const due = String(r.due_date).slice(0, 10);
    if (r.status === 'completed') { summary.completed += 1; continue; }
    summary.outstanding += 1;
    if (due === today) summary.dueToday += 1;
    else if (due === tomorrow) summary.dueTomorrow += 1;
    else if (due < today) summary.overdue += 1;
  }
  return summary;
}

router.get('/:id', wrap(async (req, res) => {
  const row = get('SELECT * FROM homework WHERE id = ? AND is_deleted = 0', Number(req.params.id));
  if (!row) throw new HttpError(404, 'That homework could not be found.');
  const payload = { homework: serializeHomework(row, req.user.id) };
  if (can(req.user, 'homework.stats')) payload.stats = completionStats(row.id);
  res.json(payload);
}));

function completionStats(homeworkId) {
  const total = get("SELECT COUNT(*) AS n FROM users WHERE status = 'active' AND role_key = 'student'").n;
  const rows = all('SELECT status, COUNT(*) AS n FROM homework_status WHERE homework_id = ? GROUP BY status', homeworkId);
  const counts = { not_started: 0, in_progress: 0, completed: 0 };
  for (const r of rows) counts[r.status] = r.n;
  counts.not_started = Math.max(0, total - counts.in_progress - counts.completed);
  const students = all(`
    SELECT hs.user_id, hs.status, hs.updated_at FROM homework_status hs
    WHERE hs.homework_id = ? ORDER BY hs.updated_at DESC`, homeworkId)
    .map((r) => ({ user: userById(r.user_id), status: r.status, updatedAt: r.updated_at }));
  return { total, counts, percentComplete: total ? Math.round((counts.completed / total) * 100) : 0, students };
}

// ---------------------------------------------------------------------------
// Creating and editing (teachers and admins)
// ---------------------------------------------------------------------------
router.post('/', requirePermission('homework.create'),
  attachmentUploader('homework').single('attachment'),
  wrap(async (req, res) => {
    const subject = clean(req.body.subject, 40);
    const title = clean(req.body.title, 120);
    const dueDate = clean(req.body.dueDate, 30);
    if (!subject || !title || !dueDate) throw new HttpError(400, 'Subject, title and due date are all required.');
    const priority = PRIORITIES.includes(req.body.priority) ? req.body.priority : 'normal';

    const info = run(`
      INSERT INTO homework (subject, title, description, instructions, due_date, priority, attachment_url, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    subject, title, clean(req.body.description || '', 2000), clean(req.body.instructions || '', 2000),
    dueDate, priority, req.file ? publicUrl('homework', req.file.filename) : '', req.user.id);

    notifyMany(activeStudentIds(), {
      kind: 'homework',
      title: `New ${subject} homework: ${title}`,
      body: `Due ${dueDate}`,
      link: `#/homework/${info.lastInsertRowid}`,
      actorId: req.user.id
    }, req.user.id);

    logActivity(req.user.id, 'homework.created', 'homework', info.lastInsertRowid, `${subject}: ${title}`);
    res.status(201).json({ homework: serializeHomework(get('SELECT * FROM homework WHERE id = ?', info.lastInsertRowid), req.user.id) });
  }));

router.patch('/:id', requirePermission('homework.edit'),
  attachmentUploader('homework').single('attachment'),
  wrap(async (req, res) => {
    const row = get('SELECT * FROM homework WHERE id = ? AND is_deleted = 0', Number(req.params.id));
    if (!row) throw new HttpError(404, 'That homework could not be found.');

    const updates = [];
    const params = [];
    const map = {
      subject: () => clean(req.body.subject, 40),
      title: () => clean(req.body.title, 120),
      description: () => clean(req.body.description, 2000),
      instructions: () => clean(req.body.instructions, 2000),
      due_date: () => clean(req.body.dueDate, 30),
      priority: () => (PRIORITIES.includes(req.body.priority) ? req.body.priority : row.priority)
    };
    const bodyKeys = { subject: 'subject', title: 'title', description: 'description', instructions: 'instructions', due_date: 'dueDate', priority: 'priority' };
    for (const [column, fn] of Object.entries(map)) {
      if (req.body[bodyKeys[column]] !== undefined) { updates.push(`${column} = ?`); params.push(fn()); }
    }
    if (req.file) { updates.push('attachment_url = ?'); params.push(publicUrl('homework', req.file.filename)); }
    if (updates.length) run(`UPDATE homework SET ${updates.join(', ')} WHERE id = ?`, ...params, row.id);

    logActivity(req.user.id, 'homework.edited', 'homework', row.id, row.title);
    res.json({ homework: serializeHomework(get('SELECT * FROM homework WHERE id = ?', row.id), req.user.id) });
  }));

router.delete('/:id', requirePermission('homework.delete'), wrap(async (req, res) => {
  const row = get('SELECT * FROM homework WHERE id = ?', Number(req.params.id));
  if (!row) throw new HttpError(404, 'That homework could not be found.');
  run('UPDATE homework SET is_deleted = 1 WHERE id = ?', row.id);
  logActivity(req.user.id, 'homework.deleted', 'homework', row.id, row.title);
  res.json({ ok: true });
}));

/** Sends a reminder announcement + notification for one assignment. */
router.post('/:id/remind', requirePermission('homework.create'), wrap(async (req, res) => {
  const row = get('SELECT * FROM homework WHERE id = ? AND is_deleted = 0', Number(req.params.id));
  if (!row) throw new HttpError(404, 'That homework could not be found.');
  const message = clean(req.body.message || '', 500) || `${row.subject} — "${row.title}" is due on ${row.due_date}.`;

  run(`INSERT INTO announcements (title, message, author_id, category, priority, audience)
       VALUES (?, ?, ?, 'homework', 'important', 'everyone')`,
  `Homework reminder: ${row.title}`, message, req.user.id);

  const pending = all(`
    SELECT u.id FROM users u
    LEFT JOIN homework_status hs ON hs.user_id = u.id AND hs.homework_id = ?
    WHERE u.status = 'active' AND COALESCE(hs.status, 'not_started') != 'completed'`, row.id).map((u) => u.id);

  notifyMany(pending, {
    kind: 'homework_reminder',
    title: `Reminder: ${row.title}`,
    body: message,
    link: `#/homework/${row.id}`,
    actorId: req.user.id
  }, req.user.id);

  logActivity(req.user.id, 'homework.reminder_sent', 'homework', row.id, `${pending.length} students`);
  res.json({ ok: true, remindedCount: pending.length });
}));

router.get('/:id/stats', requirePermission('homework.stats'), wrap(async (req, res) => {
  res.json({ stats: completionStats(Number(req.params.id)) });
}));

// ---------------------------------------------------------------------------
// A student's own progress
// ---------------------------------------------------------------------------
router.post('/:id/status', wrap(async (req, res) => {
  const id = Number(req.params.id);
  const row = get('SELECT * FROM homework WHERE id = ? AND is_deleted = 0', id);
  if (!row) throw new HttpError(404, 'That homework could not be found.');
  const status = STATUSES.includes(req.body.status) ? req.body.status : null;
  if (!status) throw new HttpError(400, 'Choose Not started, In progress or Completed.');

  const previous = get('SELECT status FROM homework_status WHERE homework_id = ? AND user_id = ?', id, req.user.id)?.status;
  run(`INSERT INTO homework_status (homework_id, user_id, status, note, updated_at)
       VALUES (?, ?, ?, ?, datetime('now'))
       ON CONFLICT(homework_id, user_id) DO UPDATE SET status = excluded.status, note = excluded.note, updated_at = datetime('now')`,
  id, req.user.id, status, clean(req.body.note || '', 300));

  if (status === 'completed' && previous !== 'completed') {
    awardXp(req.user.id, xpValue('xp_homework_complete', 5), 'homework');
    const done = get("SELECT COUNT(*) AS n FROM homework_status WHERE user_id = ? AND status = 'completed'", req.user.id).n;
    if (done >= 10) grantAchievement(req.user.id, 'homework_hero');
  }

  res.json({ status, summary: homeworkSummary(req.user.id) });
}));
