// ==========================================================
// Announcements: pinned notices first, then everything else.
// ==========================================================
import { esc, timeAgo, formatDateTime } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { api } from '../lib/api.js';
import { store, can } from '../lib/store.js';
import { setPageTitle } from '../components/shell.js';
import { avatar, emptyState, priorityBadge } from '../components/common.js';
import { toast, modal, confirmDialog, contextMenu } from '../lib/ui.js';

const CATEGORIES = [
  ['', 'All'],
  ['general', 'General'],
  ['homework', 'Homework'],
  ['test', 'Tests'],
  ['event', 'Events'],
  ['club', 'Clubs'],
  ['activity', 'Activities']
];

export default async function announcements({ mount, params }) {
  setPageTitle('Announcements');
  let category = '';
  const focusId = params.id ? Number(params.id) : null;

  mount.innerHTML = `
    <div class="page page-narrow">
      <div class="row" style="margin-bottom:1rem">
        <div>
          <h1 style="margin:0">Announcements</h1>
          <p class="muted small" style="margin:0">Notices from teachers and administrators.</p>
        </div>
        <div class="spacer"></div>
        <button class="btn btn-primary" id="new-announcement" hidden>${icon('plus', 16)} New announcement</button>
      </div>

      <div class="row" style="overflow-x:auto;margin-bottom:1.25rem" id="category-row">
        ${CATEGORIES.map(([value, label]) => `
          <button class="chip ${value === category ? 'active' : ''}" data-category="${value}">${esc(label)}</button>`).join('')}
      </div>

      <div id="announcement-list"><div class="spinner spinner-center"></div></div>
    </div>`;

  async function load() {
    const list = mount.querySelector('#announcement-list');
    list.innerHTML = '<div class="spinner spinner-center"></div>';
    try {
      const data = await api.announcements.list(category ? `?category=${category}` : '');
      mount.querySelector('#new-announcement').hidden = !data.canCreate;

      const pinned = data.announcements.filter((a) => a.pinned);
      const rest = data.announcements.filter((a) => !a.pinned);

      list.innerHTML = data.announcements.length
        ? `
          ${pinned.length ? `<div class="section-title">${icon('pin', 14)} Pinned</div>
            <div class="col" style="gap:.85rem;margin-bottom:1.25rem">${pinned.map((a) => card(a, data.canPin)).join('')}</div>` : ''}
          ${rest.length ? `${pinned.length ? `<div class="section-title">${icon('megaphone', 14)} All announcements</div>` : ''}
            <div class="col" style="gap:.85rem">${rest.map((a) => card(a, data.canPin)).join('')}</div>` : ''}`
        : `<div class="card">${emptyState({
          iconName: 'megaphone',
          title: 'No announcements yet',
          text: 'Notices from teachers and administrators will appear here.'
        })}</div>`;

      if (focusId) {
        const node = list.querySelector(`[data-announcement="${focusId}"]`);
        node?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        node?.classList.add('highlight');
        api.announcements.markRead(focusId).catch(() => {});
      }
    } catch (err) {
      list.innerHTML = `<div class="card"><p style="color:var(--danger)">${esc(err.message)}</p></div>`;
    }
  }

  mount.addEventListener('click', async (event) => {
    const chip = event.target.closest('[data-category]');
    if (chip) {
      category = chip.dataset.category;
      for (const c of mount.querySelectorAll('[data-category]')) c.classList.toggle('active', c === chip);
      await load();
      return;
    }

    if (event.target.closest('#new-announcement')) return openAnnouncementForm(null, load);

    const menu = event.target.closest('[data-announcement-menu]');
    if (menu) {
      const id = Number(menu.dataset.announcementMenu);
      const action = await contextMenu(menu, [
        ...(can('announcements.edit') ? [
          { label: 'Edit', action: 'edit', icon: 'edit' },
          { label: 'Pin or unpin', action: 'pin', icon: 'pin' }
        ] : []),
        ...(can('announcements.delete') ? ['-', { label: 'Delete', action: 'delete', icon: 'trash', danger: true }] : [])
      ]);

      if (action === 'pin') {
        try { const r = await api.announcements.pin(id); toast(r.pinned ? 'Pinned.' : 'Unpinned.', 'success'); await load(); } catch (err) { toast(err.message, 'error'); }
      }
      if (action === 'delete') {
        const yes = await confirmDialog({ title: 'Delete this announcement?', confirmText: 'Delete', danger: true });
        if (!yes) return;
        try { await api.announcements.remove(id); toast('Deleted.', 'success'); await load(); } catch (err) { toast(err.message, 'error'); }
      }
      if (action === 'edit') {
        try {
          const { announcement } = await api.announcements.one(id);
          openAnnouncementForm(announcement, load);
        } catch (err) { toast(err.message, 'error'); }
      }
    }
  });

  await load();
}

function card(a, canPin) {
  return `
    <article class="card announcement-card priority-${a.priority} ${a.pinned ? 'pinned' : ''}" data-announcement="${a.id}">
      <div class="row" style="align-items:flex-start">
        <span class="card-title-icon" style="background:var(--${tone(a.priority)}-soft);color:var(--${tone(a.priority)})">
          ${icon(a.pinned ? 'pin' : categoryIcon(a.category), 17)}
        </span>
        <div style="flex:1;min-width:0">
          <div class="row row-tight">
            <h3 style="margin:0">${esc(a.title)}</h3>
            ${priorityBadge(a.priority)}
            ${a.category !== 'general' ? `<span class="badge badge-info">${esc(a.category)}</span>` : ''}
            ${a.audience !== 'everyone' ? `<span class="badge">${esc(a.audience)}</span>` : ''}
          </div>
          <div class="tiny faint">${esc(a.author?.displayName || 'Staff')} - ${timeAgo(a.publishAt)}${a.expiresAt ? ` - expires ${formatDateTime(a.expiresAt)}` : ''}</div>
        </div>
        ${canPin ? `<button class="icon-button" data-announcement-menu="${a.id}" aria-label="Options">${icon('more', 18)}</button>` : ''}
      </div>
      <p class="pre-wrap" style="margin:.8rem 0 0">${esc(a.message)}</p>
    </article>`;
}

const tone = (priority) => (priority === 'urgent' ? 'danger' : (priority === 'important' ? 'warning' : 'accent'));
const categoryIcon = (category) => ({
  homework: 'book', test: 'edit', event: 'calendar', club: 'users', activity: 'star'
}[category] || 'megaphone');

export function openAnnouncementForm(existing, onDone) {
  const isEdit = Boolean(existing);
  modal({
    title: isEdit ? 'Edit announcement' : 'New announcement',
    size: 'modal-lg',
    body: `
      <form id="announcement-form">
        <div class="field">
          <label>Title</label>
          <input class="input" name="title" required maxlength="120" placeholder="Science test on Friday" value="${esc(existing?.title || '')}">
        </div>
        <div class="field">
          <label>Message</label>
          <textarea class="textarea" name="message" required maxlength="3000" rows="5"
                    placeholder="The Science test covers chapters 4 and 5.">${esc(existing?.message || '')}</textarea>
        </div>
        <div class="grid grid-3" style="gap:0 1rem">
          <div class="field">
            <label>Category</label>
            <select class="select" name="category">
              ${['general', 'homework', 'test', 'event', 'club', 'activity'].map((c) => `
                <option value="${c}" ${existing?.category === c ? 'selected' : ''}>${c[0].toUpperCase()}${c.slice(1)}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label>Priority</label>
            <select class="select" name="priority">
              <option value="normal" ${existing?.priority === 'normal' ? 'selected' : ''}>Normal</option>
              <option value="important" ${existing?.priority === 'important' ? 'selected' : ''}>Important</option>
              <option value="urgent" ${existing?.priority === 'urgent' ? 'selected' : ''}>Urgent</option>
            </select>
          </div>
          <div class="field">
            <label>Audience</label>
            <select class="select" name="audience">
              <option value="everyone" ${existing?.audience === 'everyone' ? 'selected' : ''}>Everyone</option>
              <option value="students" ${existing?.audience === 'students' ? 'selected' : ''}>Students only</option>
              <option value="staff" ${existing?.audience === 'staff' ? 'selected' : ''}>Staff only</option>
            </select>
          </div>
        </div>
        <div class="grid grid-2" style="gap:0 1rem">
          <div class="field">
            <label>Publish at (leave blank for now)</label>
            <input class="input" type="datetime-local" name="publishAt">
          </div>
          <div class="field">
            <label>Expires (optional)</label>
            <input class="input" type="datetime-local" name="expiresAt">
          </div>
        </div>
        ${can('announcements.edit') ? `
        <label class="checkbox">
          <input type="checkbox" name="pinned" ${existing?.pinned ? 'checked' : ''}>
          <span>Pin this to the top of the announcements page</span>
        </label>` : ''}
      </form>`,
    footer: `<button class="btn" data-close>Cancel</button>
             <button class="btn btn-primary" id="save-announcement">${isEdit ? 'Save changes' : 'Publish'}</button>`,
    onOpen: ({ root, close }) => {
      root.querySelector('#save-announcement').addEventListener('click', async (event) => {
        const form = root.querySelector('#announcement-form');
        if (!form.reportValidity()) return;
        const button = event.currentTarget;
        button.disabled = true;
        button.textContent = 'Saving...';

        const raw = Object.fromEntries(new FormData(form));
        const payload = {
          title: raw.title,
          message: raw.message,
          category: raw.category,
          priority: raw.priority,
          audience: raw.audience,
          pinned: Boolean(raw.pinned),
          publishAt: raw.publishAt ? raw.publishAt.replace('T', ' ') : '',
          expiresAt: raw.expiresAt ? raw.expiresAt.replace('T', ' ') : ''
        };

        try {
          if (isEdit) await api.announcements.update(existing.id, payload);
          else await api.announcements.create(payload);
          close();
          toast(isEdit ? 'Announcement updated.' : 'Announcement published.', 'success');
          onDone?.();
        } catch (err) {
          toast(err.message, 'error');
          button.disabled = false;
          button.textContent = isEdit ? 'Save changes' : 'Publish';
        }
      });
    }
  });
}
