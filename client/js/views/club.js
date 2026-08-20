// ==========================================================
// One club: posts, members, chat, events and management.
// ==========================================================
import { esc, plural, formatDateTime, timeAgo } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { api } from '../lib/api.js';
import { store, can } from '../lib/store.js';
import { setPageTitle } from '../components/shell.js';
import { avatar, emptyState, loadingBlock, openUserPicker, openReportDialog } from '../components/common.js';
import { renderPostCard, wirePostList } from '../components/post-card.js';
import { toast, confirmDialog, contextMenu, modal, promptDialog } from '../lib/ui.js';
import { navigate } from '../lib/router.js';

const ROLE_LABEL = { owner: 'Owner', admin: 'Club Admin', moderator: 'Moderator', member: 'Member' };

export default async function club({ mount, params }) {
  const id = params.id;
  mount.innerHTML = '<div class="page page-wide"><div class="spinner spinner-center"></div></div>';

  let data;
  try {
    data = await api.clubs.one(id);
  } catch (err) {
    mount.innerHTML = `<div class="page page-narrow">${emptyState({ iconName: 'warning', title: 'Club unavailable', text: err.message })}</div>`;
    return;
  }

  const c = data.club;
  setPageTitle(c.name);
  const isMember = Boolean(c.myRole);

  mount.innerHTML = `
    <div class="page page-wide">
      <section class="club-hero">
        <div class="club-hero-cover" ${c.coverUrl ? `style="background-image:url('${esc(c.coverUrl)}')"` : ''}></div>
        <div class="club-hero-body">
          <span class="club-logo club-logo-lg">${c.logoUrl ? `<img src="${esc(c.logoUrl)}" alt="">` : esc(c.name.slice(0, 2).toUpperCase())}</span>
          <div style="flex:1;min-width:0">
            <div class="row row-tight">
              <h1 style="margin:0">${esc(c.name)}</h1>
              ${c.status !== 'approved' ? `<span class="badge badge-warning">${esc(c.status)}</span>` : ''}
              ${c.myRole ? `<span class="badge badge-accent">${esc(ROLE_LABEL[c.myRole])}</span>` : ''}
            </div>
            <div class="tiny faint">@${esc(c.handle)} - ${esc(c.category)} - ${plural(c.memberCount, 'member')}</div>
            <p class="small muted" style="margin:.5rem 0 0">${esc(c.description || '')}</p>
          </div>
          <div class="row row-tight club-hero-actions">
            ${isMember
    ? `<a class="btn btn-primary" href="#/messages/${data.conversationId}">${icon('message', 15)} Club chat</a>`
    : (c.pending === 'join'
      ? '<span class="badge badge-warning">Request sent</span>'
      : `<button class="btn btn-primary" id="join-club">${icon('plus', 15)} ${c.pending === 'invite' ? 'Accept invite' : 'Join club'}</button>`)}
            <button class="icon-button" id="club-menu" aria-label="Club options">${icon('more', 19)}</button>
          </div>
        </div>
      </section>

      <div class="btn-group" style="margin:1.25rem 0" id="club-tabs">
        <button data-tab="posts" class="active">Posts</button>
        <button data-tab="members">Members (${data.members.length})</button>
        <button data-tab="events">Events</button>
        <button data-tab="about">About</button>
        ${data.joinRequests.length ? `<button data-tab="requests">Requests (${data.joinRequests.length})</button>` : ''}
      </div>

      <div id="club-panel"></div>
    </div>`;

  const panel = mount.querySelector('#club-panel');
  await showTab('posts');

  async function showTab(tab) {
    for (const button of mount.querySelectorAll('#club-tabs button')) {
      button.classList.toggle('active', button.dataset.tab === tab);
    }

    if (tab === 'posts') {
      if (!isMember && !data.canManage) {
        panel.innerHTML = `<div class="card">${emptyState({
          iconName: 'lock', title: 'Members only', text: 'Join this club to read and write its posts.'
        })}</div>`;
        return;
      }
      panel.innerHTML = `
        <div class="with-rail">
          <div>
            <form class="card composer" id="club-composer">
              <div class="composer-top">
                ${avatar(store.user, 'sm')}
                <textarea class="textarea composer-input" name="content" rows="2"
                          placeholder="Post something in ${esc(c.name)}..." maxlength="4000"></textarea>
              </div>
              <div class="composer-actions">
                <label class="btn btn-sm">${icon('image', 15)} Picture
                  <input type="file" name="image" accept="image/*" hidden>
                </label>
                <div class="spacer"></div>
                <button class="btn btn-primary" type="submit">${icon('send', 15)} Post</button>
              </div>
            </form>
            <div id="club-posts" style="margin-top:1rem">${loadingBlock(2)}</div>
          </div>
          <aside class="rail">
            <div class="card">
              <div class="card-header"><span class="card-title-icon">${icon('users', 17)}</span><h3>Members</h3></div>
              <div class="list">
                ${data.members.slice(0, 8).map((m) => memberRow(m, data, false)).join('')}
              </div>
              ${data.members.length > 8 ? `<button class="btn btn-sm btn-block" style="margin-top:.6rem" data-tab-jump="members">See all ${data.members.length}</button>` : ''}
            </div>
          </aside>
        </div>`;

      wireComposer(mount, c.id);
      await loadPosts(mount, c.id);
      wirePostList(mount, { onChange: () => loadPosts(mount, c.id) });
      return;
    }

    if (tab === 'members') {
      panel.innerHTML = `
        <div class="card">
          <div class="card-header">
            <span class="card-title-icon">${icon('users', 17)}</span>
            <h3>${plural(data.members.length, 'member')}</h3>
            ${data.canManage ? `<button class="btn btn-sm btn-primary" id="invite-member">${icon('plus', 14)} Invite</button>` : ''}
          </div>
          <div class="list">${data.members.map((m) => memberRow(m, data, data.canManage)).join('')}</div>
        </div>`;
      return;
    }

    if (tab === 'events') {
      panel.innerHTML = `
        <div class="card">
          <div class="card-header">
            <span class="card-title-icon">${icon('calendar', 17)}</span>
            <h3>Club events</h3>
            ${data.canManage ? `<button class="btn btn-sm btn-primary" id="add-event">${icon('plus', 14)} New event</button>` : ''}
          </div>
          ${data.events.length
    ? `<div class="list">${data.events.map((e) => `
              <div class="list-item">
                <span class="date-chip">
                  <span class="tiny">${new Date(e.startsAt.replace(' ', 'T')).toLocaleDateString(undefined, { month: 'short' })}</span>
                  <span class="bold">${new Date(e.startsAt.replace(' ', 'T')).getDate()}</span>
                </span>
                <div class="meta">
                  <div class="title">${esc(e.title)}</div>
                  <div class="sub">${esc(formatDateTime(e.startsAt))}${e.location ? ` - ${esc(e.location)}` : ''}</div>
                  ${e.description ? `<div class="tiny faint clamp-2">${esc(e.description)}</div>` : ''}
                </div>
                ${data.canManage ? `<button class="btn btn-sm btn-ghost" data-delete-event="${e.id}">${icon('trash', 14)}</button>` : ''}
              </div>`).join('')}</div>`
    : emptyState({ iconName: 'calendar', title: 'No events planned', text: 'Club leaders can add the next meeting here.' })}
        </div>`;
      return;
    }

    if (tab === 'requests') {
      panel.innerHTML = `
        <div class="card">
          <div class="card-header"><span class="card-title-icon">${icon('users', 17)}</span><h3>Join requests</h3></div>
          <div class="list">
            ${data.joinRequests.map((r) => `
              <div class="list-item" data-request="${r.id}">
                ${avatar(r.user, 'sm', true)}
                <div class="meta">
                  <div class="title">${esc(r.user?.displayName || '')}</div>
                  <div class="sub">${r.message ? esc(r.message) : `Asked ${timeAgo(r.createdAt)}`}</div>
                </div>
                <div class="row row-tight">
                  <button class="btn btn-sm btn-success" data-accept-request="${r.id}">Accept</button>
                  <button class="btn btn-sm" data-reject-request="${r.id}">Decline</button>
                </div>
              </div>`).join('')}
          </div>
        </div>`;
      return;
    }

    panel.innerHTML = `
      <div class="card">
        <div class="card-header"><span class="card-title-icon">${icon('info', 17)}</span><h3>About this club</h3></div>
        <p class="pre-wrap">${esc(c.description || 'No description yet.')}</p>
        ${c.rules ? `<h4 style="margin-top:1rem">Club rules</h4><p class="pre-wrap muted">${esc(c.rules)}</p>` : ''}
        <div class="divider"></div>
        <div class="grid grid-2">
          <div><div class="tiny faint">Owner</div><div class="bold">${esc(c.owner?.displayName || '')}</div></div>
          <div><div class="tiny faint">Created</div><div class="bold">${timeAgo(c.createdAt)}</div></div>
          <div><div class="tiny faint">Category</div><div class="bold">${esc(c.category)}</div></div>
          <div><div class="tiny faint">Members</div><div class="bold">${c.memberCount}</div></div>
        </div>
      </div>`;
  }

  mount.addEventListener('click', async (event) => {
    const tabButton = event.target.closest('#club-tabs button') || event.target.closest('[data-tab-jump]');
    if (tabButton) {
      await showTab(tabButton.dataset.tab || tabButton.dataset.tabJump);
      return;
    }

    if (event.target.closest('#join-club')) {
      try {
        const result = await api.clubs.join(c.id);
        toast(result.joined ? `You joined ${c.name}.` : 'Your request has been sent to the club leaders.', 'success');
        navigate(`/clubs/${c.id}`);
        location.reload();
      } catch (err) { toast(err.message, 'error'); }
      return;
    }

    if (event.target.closest('#invite-member')) {
      openUserPicker({
        title: `Invite somebody to ${c.name}`,
        confirmText: 'Invite',
        exclude: data.members.map((m) => m.id),
        onPick: async (userId) => {
          try {
            await api.clubs.invite(c.id, userId);
            toast('Invitation sent.', 'success');
          } catch (err) { toast(err.message, 'error'); }
        }
      });
      return;
    }

    if (event.target.closest('#add-event')) return openEventDialog(c.id);

    const deleteEvent = event.target.closest('[data-delete-event]');
    if (deleteEvent) {
      const yes = await confirmDialog({ title: 'Delete this event?', confirmText: 'Delete', danger: true });
      if (!yes) return;
      try {
        await api.clubs.deleteEvent(c.id, Number(deleteEvent.dataset.deleteEvent));
        deleteEvent.closest('.list-item').remove();
      } catch (err) { toast(err.message, 'error'); }
      return;
    }

    const accept = event.target.closest('[data-accept-request]');
    const reject = event.target.closest('[data-reject-request]');
    if (accept || reject) {
      const id = Number((accept || reject).dataset.acceptRequest || (accept || reject).dataset.rejectRequest);
      try {
        await api.clubs.respondRequest(c.id, id, accept ? 'accept' : 'reject');
        (accept || reject).closest('.list-item').remove();
        toast(accept ? 'Member added.' : 'Request declined.', 'success');
      } catch (err) { toast(err.message, 'error'); }
      return;
    }

    const memberMenu = event.target.closest('[data-member-menu]');
    if (memberMenu) return handleMemberMenu(memberMenu, c, data);

    if (event.target.closest('#club-menu')) return handleClubMenu(event.target.closest('#club-menu'), c, data);
  });
}

function memberRow(member, data, manage) {
  return `
    <div class="list-item">
      <a href="#/profile/${esc(member.username)}" style="display:flex;gap:.7rem;align-items:center;flex:1;min-width:0;color:inherit">
        ${avatar(member, 'sm', true)}
        <span class="meta">
          <span class="title">${esc(member.displayName)}</span>
          <span class="sub">${esc(ROLE_LABEL[member.clubRole] || 'Member')} - Level ${member.level}</span>
        </span>
      </a>
      ${member.clubRole === 'owner' ? `<span class="badge badge-accent">${icon('crown', 11)} Owner</span>` : ''}
      ${manage && member.clubRole !== 'owner'
    ? `<button class="icon-button" data-member-menu="${member.id}" data-role="${member.clubRole}" aria-label="Manage member">${icon('more', 17)}</button>`
    : ''}
    </div>`;
}

async function loadPosts(mount, clubId) {
  const holder = mount.querySelector('#club-posts');
  if (!holder) return;
  try {
    const { posts } = await api.posts.feed(`?clubId=${clubId}&limit=30`);
    holder.innerHTML = posts.length
      ? posts.map(renderPostCard).join('')
      : `<div class="card">${emptyState({ iconName: 'feed', title: 'No club posts yet', text: 'Say hello to the other members.' })}</div>`;
  } catch (err) {
    holder.innerHTML = `<div class="card"><p style="color:var(--danger)">${esc(err.message)}</p></div>`;
  }
}

function wireComposer(mount, clubId) {
  const form = mount.querySelector('#club-composer');
  if (!form) return;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const textarea = form.querySelector('textarea');
    const fileInput = form.querySelector('input[type="file"]');
    const content = textarea.value.trim();
    const file = fileInput.files?.[0];
    if (!content && !file) return;

    const data = new FormData();
    data.append('type', file ? 'image' : 'text');
    data.append('content', content);
    data.append('clubId', String(clubId));
    if (file) data.append('image', file);

    try {
      const { post } = await api.posts.create(data);
      const holder = mount.querySelector('#club-posts');
      holder.querySelector('.empty')?.closest('.card')?.remove();
      holder.insertAdjacentHTML('afterbegin', renderPostCard(post));
      form.reset();
    } catch (err) { toast(err.message, 'error'); }
  });
}

async function handleMemberMenu(button, c, data) {
  const userId = Number(button.dataset.memberMenu);
  const currentRole = button.dataset.role;
  const items = [
    { label: 'View profile', action: 'profile', icon: 'user' },
    { label: 'Send a message', action: 'message', icon: 'message' },
    '-',
    ...(currentRole !== 'admin' ? [{ label: 'Make club admin', action: 'admin', icon: 'shield' }] : []),
    ...(currentRole !== 'moderator' ? [{ label: 'Make moderator', action: 'moderator', icon: 'shield' }] : []),
    ...(currentRole !== 'member' ? [{ label: 'Set back to member', action: 'member', icon: 'user' }] : []),
    ...(c.owner?.id === store.user.id ? [{ label: 'Transfer ownership', action: 'transfer', icon: 'crown' }] : []),
    '-',
    { label: 'Remove from club', action: 'remove', icon: 'trash', danger: true }
  ];

  const action = await contextMenu(button, items);
  if (!action) return;

  const member = data.members.find((m) => m.id === userId);

  if (action === 'profile') return navigate(`/profile/${member.username}`);
  if (action === 'message') {
    try {
      const { conversation } = await api.messages.openWith(userId);
      navigate(`/messages/${conversation.id}`);
    } catch (err) { toast(err.message, 'error'); }
    return;
  }
  if (['admin', 'moderator', 'member'].includes(action)) {
    try {
      await api.clubs.setRole(c.id, userId, action);
      toast('Role updated.', 'success');
      location.reload();
    } catch (err) { toast(err.message, 'error'); }
    return;
  }
  if (action === 'transfer') {
    const yes = await confirmDialog({
      title: `Make ${member.displayName} the owner?`,
      message: 'You will become a club admin instead. This cannot be undone by you.',
      confirmText: 'Transfer',
      danger: true
    });
    if (!yes) return;
    try {
      await api.clubs.transfer(c.id, userId);
      toast('Ownership transferred.', 'success');
      location.reload();
    } catch (err) { toast(err.message, 'error'); }
    return;
  }
  if (action === 'remove') {
    const yes = await confirmDialog({
      title: `Remove ${member.displayName}?`,
      message: 'They will lose access to the club chat and posts.',
      confirmText: 'Remove',
      danger: true
    });
    if (!yes) return;
    try {
      await api.clubs.removeMember(c.id, userId);
      toast('Member removed.', 'success');
      location.reload();
    } catch (err) { toast(err.message, 'error'); }
  }
}

async function handleClubMenu(button, c, data) {
  const items = [];
  if (data.canManage) items.push({ label: 'Edit club details', action: 'edit', icon: 'edit' });
  if (c.myRole && c.myRole !== 'owner') items.push({ label: 'Leave club', action: 'leave', icon: 'logout', danger: true });
  items.push({ label: 'Report this club', action: 'report', icon: 'flag', danger: true });
  if (c.owner?.id === store.user.id || can('clubs.delete')) {
    items.push('-');
    items.push({ label: 'Delete club', action: 'delete', icon: 'trash', danger: true });
  }

  const action = await contextMenu(button, items);
  if (action === 'report') return openReportDialog('club', c.id, 'club');

  if (action === 'leave') {
    const yes = await confirmDialog({ title: `Leave ${c.name}?`, confirmText: 'Leave', danger: true });
    if (!yes) return;
    try { await api.clubs.leave(c.id); toast('You left the club.', 'success'); navigate('/clubs'); } catch (err) { toast(err.message, 'error'); }
    return;
  }

  if (action === 'delete') {
    const yes = await confirmDialog({
      title: `Delete ${c.name}?`,
      message: 'Every post, event and chat message in this club will be removed.',
      confirmText: 'Delete for ever',
      danger: true
    });
    if (!yes) return;
    try { await api.clubs.remove(c.id); toast('Club deleted.', 'success'); navigate('/clubs'); } catch (err) { toast(err.message, 'error'); }
    return;
  }

  if (action === 'edit') openEditClub(c);
}

function openEditClub(c) {
  modal({
    title: 'Edit club details',
    size: 'modal-lg',
    body: `
      <form id="edit-club-form">
        <div class="field"><label>Club name</label><input class="input" name="name" value="${esc(c.name)}" maxlength="60"></div>
        <div class="field"><label>Category</label><input class="input" name="category" value="${esc(c.category)}" maxlength="40"></div>
        <div class="field"><label>Description</label><textarea class="textarea" name="description" maxlength="600">${esc(c.description)}</textarea></div>
        <div class="field"><label>Club rules</label><textarea class="textarea" name="rules" maxlength="800">${esc(c.rules)}</textarea></div>
        <div class="grid grid-2" style="gap:0 1rem">
          <div class="field"><label>New logo</label><input class="input" type="file" name="logo" accept="image/*"></div>
          <div class="field"><label>New cover</label><input class="input" type="file" name="cover" accept="image/*"></div>
        </div>
      </form>`,
    footer: `<button class="btn" data-close>Cancel</button><button class="btn btn-primary" id="save-club">Save changes</button>`,
    onOpen: ({ root, close }) => {
      root.querySelector('#save-club').addEventListener('click', async (event) => {
        event.currentTarget.disabled = true;
        try {
          await api.clubs.update(c.id, new FormData(root.querySelector('#edit-club-form')));
          close();
          toast('Club updated.', 'success');
          location.reload();
        } catch (err) {
          toast(err.message, 'error');
          event.currentTarget.disabled = false;
        }
      });
    }
  });
}

function openEventDialog(clubId) {
  modal({
    title: 'New club event',
    body: `
      <form id="event-form">
        <div class="field"><label>Title</label><input class="input" name="title" placeholder="Coding Club: build a game" required maxlength="80"></div>
        <div class="field"><label>When</label><input class="input" name="startsAt" type="datetime-local" required></div>
        <div class="field"><label>Where</label><input class="input" name="location" placeholder="Computer room" maxlength="80"></div>
        <div class="field"><label>Details</label><textarea class="textarea" name="description" maxlength="400"></textarea></div>
      </form>`,
    footer: `<button class="btn" data-close>Cancel</button><button class="btn btn-primary" id="save-event">Create event</button>`,
    onOpen: ({ root, close }) => {
      root.querySelector('#save-event').addEventListener('click', async () => {
        const form = root.querySelector('#event-form');
        if (!form.reportValidity()) return;
        const data = Object.fromEntries(new FormData(form));
        try {
          await api.clubs.createEvent(clubId, { ...data, startsAt: data.startsAt.replace('T', ' ') });
          close();
          toast('Event created.', 'success');
          location.reload();
        } catch (err) { toast(err.message, 'error'); }
      });
    }
  });
}
