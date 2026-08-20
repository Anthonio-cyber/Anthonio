// ==========================================================
// The Homework Hub: assignments, per-student progress and
// the teacher tools for creating and tracking them.
// ==========================================================
import { esc, dueLabel, formatDate, timeAgo } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { api } from '../lib/api.js';
import { store, can } from '../lib/store.js';
import { setPageTitle } from '../components/shell.js';
import { avatar, emptyState, priorityBadge } from '../components/common.js';
import { toast, modal, confirmDialog, contextMenu, promptDialog } from '../lib/ui.js';
import { navigate } from '../lib/router.js';

const FILTERS = [
  ['outstanding', 'To do'],
  ['due_today', 'Due today'],
  ['overdue', 'Overdue'],
  ['completed', 'Completed'],
  ['all', 'Everything']
];

const STATUS = {
  not_started: { label: 'Not started', tone: '', icon: 'clock' },
  in_progress: { label: 'In progress', tone: 'warning', icon: 'edit' },
  completed: { label: 'Completed', tone: 'success', icon: 'check' }
};

export default async function homework({ mount, params }) {
  if (params.id) return homeworkDetail({ mount, id: Number(params.id) });

  setPageTitle('Homework');
  let filter = 'outstanding';
  let subject = '';

  mount.innerHTML = `
    <div class="page page-wide">
      <div class="row" style="margin-bottom:1rem">
        <div>
          <h1 style="margin:0">Homework</h1>
          <p class="muted small" style="margin:0">Everything the class has been set.</p>
        </div>
        <div class="spacer"></div>
        <button class="btn btn-primary" id="new-homework" hidden>${icon('plus', 16)} New homework</button>
      </div>

      <div id="summary" class="grid grid-4" style="margin-bottom:1.25rem"></div>

      <div class="card" style="margin-bottom:1.25rem">
        <div class="row">
          <div class="btn-group" id="filters">
            ${FILTERS.map(([value, label]) => `<button data-filter="${value}" class="${value === filter ? 'active' : ''}">${esc(label)}</button>`).join('')}
          </div>
          <div class="spacer"></div>
          <select class="select" id="subject-filter" style="width:auto;min-width:150px">
            <option value="">All subjects</option>
          </select>
        </div>
      </div>

      <div id="homework-list"><div class="spinner spinner-center"></div></div>
    </div>`;

  async function load() {
    const list = mount.querySelector('#homework-list');
    list.innerHTML = '<div class="spinner spinner-center"></div>';
    try {
      const data = await api.homework.list(`?filter=${filter}${subject ? `&subject=${encodeURIComponent(subject)}` : ''}`);
      mount.querySelector('#new-homework').hidden = !data.canCreate;
      renderSummary(mount, data.summary);

      const select = mount.querySelector('#subject-filter');
      if (select.options.length <= 1) {
        select.innerHTML = `<option value="">All subjects</option>${data.subjects.map((s) => `<option value="${esc(s)}">${esc(s)}</option>`).join('')}`;
        select.value = subject;
      }

      list.innerHTML = data.homework.length
        ? `<div class="col" style="gap:.85rem">${data.homework.map(homeworkCard).join('')}</div>`
        : `<div class="card">${emptyState({
          iconName: filter === 'completed' ? 'check' : 'book',
          title: filter === 'completed' ? 'Nothing completed yet' : 'No homework here',
          text: filter === 'outstanding' ? 'You are all caught up. Well done.' : 'Try another filter.'
        })}</div>`;
    } catch (err) {
      list.innerHTML = `<div class="card"><p style="color:var(--danger)">${esc(err.message)}</p></div>`;
    }
  }

  mount.addEventListener('click', async (event) => {
    const filterButton = event.target.closest('[data-filter]');
    if (filterButton) {
      filter = filterButton.dataset.filter;
      for (const b of mount.querySelectorAll('[data-filter]')) b.classList.toggle('active', b === filterButton);
      await load();
      return;
    }

    if (event.target.closest('#new-homework')) return openHomeworkForm(null, load);

    const statusButton = event.target.closest('[data-set-status]');
    if (statusButton) {
      const card = statusButton.closest('[data-homework]');
      const id = Number(card.dataset.homework);
      try {
        await api.homework.setStatus(id, statusButton.dataset.setStatus);
        toast(`Marked as ${STATUS[statusButton.dataset.setStatus].label.toLowerCase()}.`, 'success');
        await load();
      } catch (err) { toast(err.message, 'error'); }
    }
  });

  mount.querySelector('#subject-filter').addEventListener('change', async (event) => {
    subject = event.target.value;
    await load();
  });

  await load();
}

function renderSummary(mount, summary) {
  const holder = mount.querySelector('#summary');
  if (!holder) return;
  const tiles = [
    { label: 'Due today', value: summary.dueToday, icon: 'clock', tone: summary.dueToday ? 'warning' : '' },
    { label: 'Due tomorrow', value: summary.dueTomorrow, icon: 'calendar', tone: '' },
    { label: 'Overdue', value: summary.overdue, icon: 'warning', tone: summary.overdue ? 'danger' : '' },
    { label: 'Completed', value: summary.completed, icon: 'check', tone: 'success' }
  ];
  holder.innerHTML = tiles.map((t) => `
    <div class="stat">
      <div class="stat-icon" ${t.tone ? `style="background:var(--${t.tone}-soft);color:var(--${t.tone})"` : ''}>${icon(t.icon, 19)}</div>
      <div class="stat-body">
        <div class="stat-value">${t.value}</div>
        <div class="stat-label">${esc(t.label)}</div>
      </div>
    </div>`).join('');
}

function homeworkCard(h) {
  const due = dueLabel(h.dueDate);
  const status = STATUS[h.myStatus];
  return `
    <article class="card homework-card priority-${h.priority}" data-homework="${h.id}">
      <div class="row" style="align-items:flex-start">
        <span class="subject-dot">${esc(h.subject.slice(0, 2).toUpperCase())}</span>
        <div style="flex:1;min-width:0">
          <div class="row row-tight">
            <a href="#/homework/${h.id}" class="bold" style="color:inherit;font-size:1.02rem">${esc(h.title)}</a>
            ${priorityBadge(h.priority)}
            <span class="badge ${status.tone ? `badge-${status.tone}` : ''}">${icon(status.icon, 11)} ${status.label}</span>
          </div>
          <div class="tiny faint">${esc(h.subject)} - set by ${esc(h.createdBy?.displayName || 'staff')}</div>
          ${h.description ? `<p class="small muted clamp-2" style="margin:.5rem 0 0">${esc(h.description)}</p>` : ''}
        </div>
        <div class="col" style="align-items:flex-end;gap:.4rem">
          <span class="badge ${due.tone ? `badge-${due.tone}` : ''}">${esc(due.text)}</span>
          <span class="tiny faint nowrap">${esc(formatDate(h.dueDate))}</span>
        </div>
      </div>
      <div class="row row-tight" style="margin-top:.75rem">
        ${Object.entries(STATUS).map(([key, value]) => `
          <button class="chip ${h.myStatus === key ? 'active' : ''}" data-set-status="${key}">
            ${icon(value.icon, 12)} ${value.label}
          </button>`).join('')}
        <div class="spacer"></div>
        <a class="btn btn-sm btn-ghost" href="#/homework/${h.id}">Open</a>
      </div>
    </article>`;
}

// ---------------------------------------------------------------------------
// One assignment
// ---------------------------------------------------------------------------
async function homeworkDetail({ mount, id }) {
  mount.innerHTML = '<div class="page page-narrow"><div class="spinner spinner-center"></div></div>';
  let data;
  try {
    data = await api.homework.one(id);
  } catch (err) {
    mount.innerHTML = `<div class="page page-narrow">${emptyState({ iconName: 'warning', title: 'Homework not found', text: err.message })}</div>`;
    return;
  }

  const h = data.homework;
  setPageTitle(h.title);
  const due = dueLabel(h.dueDate);

  mount.innerHTML = `
    <div class="page page-narrow">
      <a class="btn btn-sm btn-ghost" href="#/homework" style="margin-bottom:1rem">${icon('arrowLeft', 15)} All homework</a>

      <article class="card homework-detail priority-${h.priority}">
        <div class="row" style="align-items:flex-start">
          <span class="subject-dot subject-dot-lg">${esc(h.subject.slice(0, 2).toUpperCase())}</span>
          <div style="flex:1;min-width:0">
            <div class="tiny faint" style="text-transform:uppercase;letter-spacing:.06em">${esc(h.subject)}</div>
            <h1 style="margin:.15rem 0 .35rem">${esc(h.title)}</h1>
            <div class="row row-tight">
              ${priorityBadge(h.priority)}
              <span class="badge ${due.tone ? `badge-${due.tone}` : ''}">${esc(due.text)}</span>
              <span class="tiny faint">${esc(due.full)}</span>
            </div>
          </div>
          ${can('homework.edit') ? `<button class="icon-button" id="homework-menu">${icon('more', 19)}</button>` : ''}
        </div>

        ${h.description ? `<p class="pre-wrap" style="margin-top:1rem">${esc(h.description)}</p>` : ''}
        ${h.instructions ? `
          <div class="instructions">
            <div class="section-title">${icon('info', 14)} Instructions</div>
            <p class="pre-wrap" style="margin:0">${esc(h.instructions)}</p>
          </div>` : ''}
        ${h.attachmentUrl ? `
          <a class="btn btn-sm" href="${esc(h.attachmentUrl)}" target="_blank" rel="noopener" style="margin-top:.8rem">
            ${icon('upload', 14)} Open the attachment
          </a>` : ''}

        <div class="divider"></div>
        <div class="section-title">${icon('check', 14)} Your progress</div>
        <div class="row row-tight">
          ${Object.entries(STATUS).map(([key, value]) => `
            <button class="chip ${h.myStatus === key ? 'active' : ''}" data-set-status="${key}">
              ${icon(value.icon, 12)} ${value.label}
            </button>`).join('')}
        </div>

        <div class="divider"></div>
        <div class="tiny faint">Set by ${esc(h.createdBy?.displayName || 'staff')} - ${timeAgo(h.createdAt)}</div>
      </article>

      ${data.stats ? statsCard(data.stats) : ''}
    </div>`;

  mount.addEventListener('click', async (event) => {
    const statusButton = event.target.closest('[data-set-status]');
    if (statusButton) {
      try {
        await api.homework.setStatus(id, statusButton.dataset.setStatus);
        for (const chip of mount.querySelectorAll('[data-set-status]')) chip.classList.toggle('active', chip === statusButton);
        toast('Progress saved.', 'success');
      } catch (err) { toast(err.message, 'error'); }
      return;
    }

    if (event.target.closest('#homework-menu')) {
      const action = await contextMenu(event.target.closest('#homework-menu'), [
        { label: 'Edit homework', action: 'edit', icon: 'edit' },
        { label: 'Send a reminder', action: 'remind', icon: 'megaphone' },
        '-',
        ...(can('homework.delete') ? [{ label: 'Delete homework', action: 'delete', icon: 'trash', danger: true }] : [])
      ]);

      if (action === 'edit') openHomeworkForm(h, () => location.reload());
      if (action === 'remind') {
        const message = await promptDialog({
          title: 'Send a reminder',
          label: 'Message for the class',
          value: `${h.subject} - "${h.title}" is due on ${formatDate(h.dueDate)}.`,
          multiline: true,
          confirmText: 'Send reminder'
        });
        if (!message) return;
        try {
          const result = await api.homework.remind(id, message);
          toast(`Reminder sent to ${result.remindedCount} students.`, 'success');
        } catch (err) { toast(err.message, 'error'); }
      }
      if (action === 'delete') {
        const yes = await confirmDialog({ title: 'Delete this homework?', confirmText: 'Delete', danger: true });
        if (!yes) return;
        try { await api.homework.remove(id); toast('Homework deleted.', 'success'); navigate('/homework'); } catch (err) { toast(err.message, 'error'); }
      }
    }
  });
}

function statsCard(stats) {
  return `
    <div class="card">
      <div class="card-header">
        <span class="card-title-icon">${icon('chart', 17)}</span>
        <h3>Class progress</h3>
        <span class="badge badge-success">${stats.percentComplete}% complete</span>
      </div>
      <div class="level-bar" style="height:10px;margin-bottom:.9rem"><span style="width:${stats.percentComplete}%"></span></div>
      <div class="grid grid-3" style="margin-bottom:1rem">
        <div class="stat"><div class="stat-body"><div class="stat-value">${stats.counts.completed}</div><div class="stat-label">Completed</div></div></div>
        <div class="stat"><div class="stat-body"><div class="stat-value">${stats.counts.in_progress}</div><div class="stat-label">In progress</div></div></div>
        <div class="stat"><div class="stat-body"><div class="stat-value">${stats.counts.not_started}</div><div class="stat-label">Not started</div></div></div>
      </div>
      ${stats.students.length ? `
        <div class="list">
          ${stats.students.map((s) => `
            <div class="list-item">
              ${avatar(s.user, 'xs')}
              <div class="meta">
                <div class="title">${esc(s.user?.displayName || '')}</div>
                <div class="sub">Updated ${timeAgo(s.updatedAt)}</div>
              </div>
              <span class="badge ${STATUS[s.status].tone ? `badge-${STATUS[s.status].tone}` : ''}">${STATUS[s.status].label}</span>
            </div>`).join('')}
        </div>` : '<p class="small faint">No student has opened this yet.</p>'}
    </div>`;
}

// ---------------------------------------------------------------------------
// Create / edit
// ---------------------------------------------------------------------------
export function openHomeworkForm(existing, onDone) {
  const isEdit = Boolean(existing);
  modal({
    title: isEdit ? 'Edit homework' : 'New homework',
    size: 'modal-lg',
    body: `
      <form id="homework-form">
        <div class="grid grid-2" style="gap:0 1rem">
          <div class="field">
            <label>Subject</label>
            <input class="input" name="subject" list="subjects" required maxlength="40" value="${esc(existing?.subject || '')}">
            <datalist id="subjects">
              <option>Mathematics</option><option>English</option><option>Science</option>
              <option>History</option><option>Geography</option><option>ICT</option>
              <option>French</option><option>Art</option><option>Physical Education</option>
            </datalist>
          </div>
          <div class="field">
            <label>Due date</label>
            <input class="input" name="dueDate" type="date" required value="${esc((existing?.dueDate || '').slice(0, 10))}">
          </div>
        </div>
        <div class="field">
          <label>Title</label>
          <input class="input" name="title" required maxlength="120" placeholder="Algebra Practice" value="${esc(existing?.title || '')}">
        </div>
        <div class="field">
          <label>Short description</label>
          <textarea class="textarea" name="description" maxlength="2000" placeholder="Complete questions 1-20.">${esc(existing?.description || '')}</textarea>
        </div>
        <div class="field">
          <label>Full instructions</label>
          <textarea class="textarea" name="instructions" maxlength="2000" placeholder="Show every step of your working. Textbook page 84.">${esc(existing?.instructions || '')}</textarea>
        </div>
        <div class="grid grid-2" style="gap:0 1rem">
          <div class="field">
            <label>Priority</label>
            <select class="select" name="priority">
              <option value="normal" ${existing?.priority === 'normal' ? 'selected' : ''}>Normal</option>
              <option value="important" ${existing?.priority === 'important' ? 'selected' : ''}>Important</option>
              <option value="urgent" ${existing?.priority === 'urgent' ? 'selected' : ''}>Urgent</option>
            </select>
          </div>
          <div class="field">
            <label>Attachment (optional)</label>
            <input class="input" type="file" name="attachment" accept="image/*,.pdf,.doc,.docx,.txt">
          </div>
        </div>
      </form>`,
    footer: `<button class="btn" data-close>Cancel</button>
             <button class="btn btn-primary" id="save-homework">${isEdit ? 'Save changes' : 'Set homework'}</button>`,
    onOpen: ({ root, close }) => {
      root.querySelector('#save-homework').addEventListener('click', async (event) => {
        const form = root.querySelector('#homework-form');
        if (!form.reportValidity()) return;
        const button = event.currentTarget;
        button.disabled = true;
        button.textContent = 'Saving...';
        try {
          const data = new FormData(form);
          if (isEdit) await api.homework.update(existing.id, data);
          else await api.homework.create(data);
          close();
          toast(isEdit ? 'Homework updated.' : 'Homework set. Everybody has been told.', 'success');
          onDone?.();
        } catch (err) {
          toast(err.message, 'error');
          button.disabled = false;
          button.textContent = isEdit ? 'Save changes' : 'Set homework';
        }
      });
    }
  });
}
