// ==========================================================
// Coding Hub - announcements (specification section 50).
// Title, message, priority, audience, publish and expiry dates.
// ==========================================================
import { esc, timeAgo, formatDateTime, delegate } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { api } from '../lib/api.js';
import { store, can } from '../lib/store.js';
import { setPageTitle } from '../components/shell.js';
import { avatar, emptyState } from '../components/common.js';
import { toast, modal, confirmDialog, withBusy } from '../lib/ui.js';

const PRIORITIES = [['', 'All'], ['urgent', 'Urgent'], ['important', 'Important'], ['normal', 'Normal']];
const AUDIENCES = [
  ['everyone', 'Everyone'],
  ['new_users', 'New members (joined in the last 14 days)'],
  ['roles', 'Specific roles'],
  ['users', 'Specific people']
];

export default async function announcements({ mount, params }) {
  setPageTitle('Announcements');
  let priority = '';

  mount.innerHTML = `
    <div class="page page-narrow">
      <header class="page-head">
        <div>
          <h1>Announcements</h1>
          <p class="muted">News from the people who run the Coding Hub.</p>
        </div>
        ${can('announcements.create')
    ? `<button type="button" class="btn btn-primary" id="new">${icon('plus', 16)} New announcement</button>` : ''}
      </header>

      <div class="admin-tabs" id="priority-row">
        ${PRIORITIES.map(([value, label]) => `
          <button type="button" class="chip ${value === '' ? 'active' : ''}" data-priority="${value}">${esc(label)}</button>`).join('')}
      </div>

      <div id="list" style="margin-top:1.25rem"><div class="spinner spinner-center"></div></div>
    </div>`;

  const list = mount.querySelector('#list');

  async function load() {
    try {
      const data = await api.announcements.list(priority ? `?priority=${priority}` : '');
      list.innerHTML = data.announcements.length
        ? data.announcements.map(card).join('')
        : emptyState({ iconName: 'megaphone', title: 'Nothing announced yet' });

      if (params.id) {
        const target = list.querySelector(`[data-announcement="${params.id}"]`);
        target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (target) target.classList.add('highlight');
      }
      for (const a of data.announcements.filter((x) => !x.read)) {
        api.announcements.markRead(a.id).catch(() => {});
      }
    } catch (err) {
      list.innerHTML = `<div class="card"><p style="color:var(--danger)">${esc(err.message)}</p></div>`;
    }
  }

  function card(a) {
    const tone = { urgent: 'danger', important: 'warning' }[a.priority] || '';
    return `
      <article class="card" data-announcement="${a.id}" style="margin-bottom:1rem">
        <div class="card-header">
          <span class="card-title-icon" ${tone ? `style="background:var(--${tone}-soft);color:var(--${tone})"` : ''}>
            ${icon(a.pinned ? 'pin' : 'megaphone', 17)}
          </span>
          <h3>${esc(a.title)}</h3>
          ${a.pinned ? '<span class="badge">Pinned</span>' : ''}
          ${a.priority !== 'normal' ? `<span class="badge badge-${tone}">${esc(a.priority)}</span>` : ''}
          ${a.audience !== 'everyone' ? `<span class="badge badge-info">${esc(audienceLabel(a.audience))}</span>` : ''}
        </div>
        <p style="white-space:pre-wrap;margin:0 0 .8rem">${esc(a.message)}</p>
        <div class="row row-tight small faint" style="flex-wrap:wrap">
          ${avatar(a.author, 'xs')}
          <span>${esc(a.author?.displayName || 'Unknown')} &middot; ${timeAgo(a.createdAt)}</span>
          ${a.expiresAt ? `<span>&middot; until ${formatDateTime(a.expiresAt)}</span>` : ''}
        </div>
        ${can('announcements.edit') || can('announcements.delete') ? `
          <div class="row" style="gap:.4rem;margin-top:.8rem">
            ${can('announcements.edit') ? `<button type="button" class="btn btn-xs btn-ghost" data-edit="${a.id}">Edit</button>` : ''}
            ${can('announcements.edit') ? `<button type="button" class="btn btn-xs btn-ghost" data-pin="${a.id}">${a.pinned ? 'Unpin' : 'Pin'}</button>` : ''}
            ${can('announcements.delete') ? `<button type="button" class="btn btn-xs btn-danger" data-delete="${a.id}">Delete</button>` : ''}
          </div>` : ''}
      </article>`;
  }

  const audienceLabel = (value) => (AUDIENCES.find(([key]) => key === value)?.[1] || value);

  delegate(mount, 'click', '[data-priority]', (_event, node) => {
    priority = node.dataset.priority;
    for (const chip of mount.querySelectorAll('[data-priority]')) chip.classList.toggle('active', chip === node);
    load();
  });

  mount.querySelector('#new')?.addEventListener('click', () => openAnnouncementForm(null, load));

  delegate(mount, 'click', '[data-edit]', async (_event, node) => {
    const { announcement } = await api.announcements.one(Number(node.dataset.edit));
    openAnnouncementForm(announcement, load);
  });

  delegate(mount, 'click', '[data-pin]', async (_event, node) => {
    try {
      await api.announcements.pin(Number(node.dataset.pin));
      load();
    } catch (err) { toast(err.message, 'error'); }
  });

  delegate(mount, 'click', '[data-delete]', async (_event, node) => {
    const sure = await confirmDialog({ title: 'Delete this announcement?', confirmText: 'Delete', danger: true });
    if (!sure) return;
    try {
      await api.announcements.remove(Number(node.dataset.delete));
      toast('Deleted.', 'success');
      load();
    } catch (err) { toast(err.message, 'error'); }
  });

  await load();
}

export function openAnnouncementForm(existing, onSaved) {
  const editing = !!existing;
  modal({
    title: editing ? 'Edit announcement' : 'New announcement',
    size: 'modal-lg',
    body: `
      <div class="field"><label>Title</label>
        <input class="input" name="title" value="${esc(existing?.title || '')}"></div>
      <div class="field"><label>Message</label>
        <textarea class="textarea" name="message" rows="5">${esc(existing?.message || '')}</textarea></div>
      <div class="grid grid-2">
        <div class="field"><label>Priority</label>
          <select class="select" name="priority">
            ${['normal', 'important', 'urgent'].map((p) => `
              <option value="${p}" ${existing?.priority === p ? 'selected' : ''}>${p[0].toUpperCase()}${p.slice(1)}</option>`).join('')}
          </select></div>
        <div class="field"><label>Audience</label>
          <select class="select" name="audience">
            ${AUDIENCES.map(([value, label]) => `
              <option value="${value}" ${existing?.audience === value ? 'selected' : ''}>${esc(label)}</option>`).join('')}
          </select></div>
      </div>
      <div class="field" data-audience-ref ${['roles', 'users'].includes(existing?.audience) ? '' : 'hidden'}>
        <label data-ref-label>Who exactly</label>
        <input class="input" name="audienceRef" value="${esc(existing?.audienceRef || '')}"
          placeholder="user, moderator, admin">
        <span class="hint">Role keys, or member ids, separated by commas.</span>
      </div>
      <div class="grid grid-2">
        <div class="field"><label>Publish at</label>
          <input class="input" type="datetime-local" name="publishAt"></div>
        <div class="field"><label>Expires (optional)</label>
          <input class="input" type="datetime-local" name="expiresAt"></div>
      </div>
      <label class="check"><input type="checkbox" name="pinned" ${existing?.pinned ? 'checked' : ''}>
        <span>Pin to the top</span></label>`,
    footer: `
      <button type="button" class="btn" data-close>Cancel</button>
      <button type="button" class="btn btn-primary" data-save>${editing ? 'Save changes' : 'Publish'}</button>`,
    onOpen: ({ root, close }) => {
      const audience = root.querySelector('[name="audience"]');
      const refField = root.querySelector('[data-audience-ref]');
      const refLabel = root.querySelector('[data-ref-label]');
      const refInput = root.querySelector('[name="audienceRef"]');

      const syncAudience = () => {
        const value = audience.value;
        refField.hidden = !['roles', 'users'].includes(value);
        refLabel.textContent = value === 'users' ? 'Which people (member ids)' : 'Which roles';
        refInput.placeholder = value === 'users' ? '4, 12, 31' : 'user, moderator, admin';
      };
      audience.addEventListener('change', syncAudience);
      syncAudience();

      root.querySelector('[data-save]').addEventListener('click', async (event) => {
        const field = (name) => root.querySelector(`[name="${name}"]`);
        const toSql = (value) => (value ? value.replace('T', ' ') + ':00' : '');
        const payload = {
          title: field('title').value.trim(),
          message: field('message').value.trim(),
          priority: field('priority').value,
          audience: audience.value,
          audienceRef: refInput.value.trim(),
          pinned: field('pinned').checked,
          publishAt: toSql(field('publishAt').value),
          expiresAt: toSql(field('expiresAt').value)
        };
        if (!payload.title || !payload.message) {
          toast('An announcement needs a title and a message.', 'warning');
          return;
        }
        await withBusy(event.currentTarget, async () => {
          try {
            if (editing) await api.announcements.update(existing.id, payload);
            else await api.announcements.create(payload);
            close();
            toast(editing ? 'Announcement saved.' : 'Announcement published.', 'success');
            onSaved?.();
          } catch (err) { toast(err.message, 'error'); }
        }, 'Saving...');
      });
    }
  });
}
