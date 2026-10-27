// ==========================================================
// The class feed: the composer plus the list of posts.
// ==========================================================
import { esc } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { api } from '../lib/api.js';
import { store, can, on } from '../lib/store.js';
import { setPageTitle } from '../components/shell.js';
import { avatar, emptyState, loadingBlock } from '../components/common.js';
import { renderPostCard, wirePostList } from '../components/post-card.js';
import { toast } from '../lib/ui.js';
import { queuePost } from '../lib/offline.js';

const FILTERS = [
  ['all', 'Everything'],
  ['homework_question', 'Homework help'],
  ['study', 'Study'],
  ['poll', 'Polls'],
  ['announcement', 'Announcements'],
  ['mine', 'My posts'],
  ['saved', 'Saved']
];

export default async function feed({ mount, query }) {
  setPageTitle('Class Feed');
  let filter = query.filter || 'all';

  mount.innerHTML = `
    <div class="page">
      <div class="with-rail">
        <div class="col" style="gap:1.25rem">
          <div id="composer"></div>
          <div class="row" style="overflow-x:auto;padding-bottom:2px" id="filters">
            ${FILTERS.map(([value, label]) => `
              <button class="chip ${value === filter ? 'active' : ''}" data-filter="${value}">${esc(label)}</button>`).join('')}
          </div>
          <div id="post-list" class="col" style="gap:1rem">${loadingBlock(3)}</div>
        </div>
        <aside class="rail">
          <div class="card">
            <div class="card-header">
              <span class="card-title-icon">${icon('info', 17)}</span>
              <h3>Feed rules</h3>
            </div>
            <ul class="rule-list small muted">
              <li>Be kind. This is our class space.</li>
              <li>No bullying, name-calling or private pictures of others.</li>
              <li>Ask for homework help - do not post full answers before a due date.</li>
              <li>Report anything that is not okay. Moderators check every report.</li>
            </ul>
          </div>
          <div class="card" id="rail-online"></div>
        </aside>
      </div>
    </div>`;

  renderComposer(mount);
  await loadPosts(mount, filter);
  await loadOnlineRail(mount);

  mount.querySelector('#filters').addEventListener('click', async (event) => {
    const button = event.target.closest('[data-filter]');
    if (!button) return;
    filter = button.dataset.filter;
    for (const chip of mount.querySelectorAll('[data-filter]')) chip.classList.toggle('active', chip === button);
    await loadPosts(mount, filter);
  });

  wirePostList(mount, { onChange: () => loadPosts(mount, filter) });

  const off = on('post:new', ({ post }) => {
    if (filter !== 'all' && filter !== post.type) return;
    if (post.author?.id === store.user.id) return;
    const list = mount.querySelector('#post-list');
    list.querySelector('.empty')?.closest('.card')?.remove();
    list.insertAdjacentHTML('afterbegin', renderPostCard(post));
  });

  return { destroy: off };
}

async function loadPosts(mount, filter) {
  const list = mount.querySelector('#post-list');
  list.innerHTML = loadingBlock(3);
  try {
    const { posts } = await api.posts.feed(`?filter=${encodeURIComponent(filter)}&limit=30`);
    list.innerHTML = posts.length
      ? posts.map(renderPostCard).join('')
      : `<div class="card">${emptyState({
        iconName: filter === 'saved' ? 'bookmark' : 'feed',
        title: filter === 'saved' ? 'Nothing saved yet' : 'No posts here yet',
        text: filter === 'saved'
          ? 'Tap Save on a post to keep it for later.'
          : 'Write the first post using the box at the top.'
      })}</div>`;
  } catch (err) {
    list.innerHTML = `<div class="card"><p style="color:var(--danger)">${esc(err.message)}</p></div>`;
  }
}

async function loadOnlineRail(mount) {
  const card = mount.querySelector('#rail-online');
  if (!card) return;
  try {
    const { users } = await api.users.online();
    card.innerHTML = `
      <div class="card-header">
        <span class="card-title-icon" style="background:var(--success-soft);color:var(--success)">${icon('users', 17)}</span>
        <h3>Online now</h3>
        <span class="badge badge-success">${users.length}</span>
      </div>
      ${users.length ? `<div class="list">${users.slice(0, 8).map((u) => `
        <a class="list-item" href="#/profile/${esc(u.username)}">
          ${avatar(u, 'sm', true)}
          <div class="meta"><div class="title">${esc(u.displayName)}</div><div class="sub">Level ${u.level}</div></div>
        </a>`).join('')}</div>`
    : '<p class="small faint center">Nobody else is online right now.</p>'}`;
  } catch { card.remove(); }
}

// ---------------------------------------------------------------------------
// The composer
// ---------------------------------------------------------------------------
function renderComposer(mount) {
  const holder = mount.querySelector('#composer');
  if (!store.user.canPost) {
    holder.innerHTML = `<div class="alert alert-warning">${icon('warning', 17)}
      <div>An administrator has paused your posting. You can still read the feed and send messages.</div></div>`;
    return;
  }

  holder.innerHTML = `
    <form class="card composer" id="composer-form">
      <div class="composer-top">
        ${avatar(store.user, 'sm')}
        <textarea class="textarea composer-input" name="content" rows="2"
                  placeholder="Share something with the class, ${esc(store.user.displayName.split(' ')[0])}..."
                  maxlength="4000"></textarea>
      </div>

      <div class="composer-extra" id="poll-editor" hidden>
        <label class="small bold">Poll options</label>
        <div id="poll-options">
          <input class="input" placeholder="Option 1" data-poll-option>
          <input class="input" placeholder="Option 2" data-poll-option>
        </div>
        <button type="button" class="btn btn-sm" id="add-option">${icon('plus', 14)} Add option</button>
      </div>

      <div class="composer-extra" id="subject-row" hidden>
        <input class="input" name="subject" placeholder="Subject (for example Mathematics)" maxlength="40">
      </div>

      <div id="image-preview" hidden class="composer-preview"></div>

      <div class="composer-actions">
        <div class="row row-tight" style="flex:1">
          <select class="select composer-type" name="type" style="width:auto;min-width:150px">
            <option value="text">Post</option>
            <option value="homework_question">Homework question</option>
            <option value="study">Study discussion</option>
            <option value="poll">Poll</option>
            ${can('announcements.create') ? '<option value="announcement">Class announcement</option>' : ''}
          </select>
          <label class="btn btn-sm" title="Add a picture">
            ${icon('image', 15)}<span class="hide-sm">Picture</span>
            <input type="file" name="image" accept="image/*" hidden id="image-input">
          </label>
        </div>
        <button class="btn btn-primary" type="submit">${icon('send', 15)} Post</button>
      </div>
    </form>`;

  const form = holder.querySelector('#composer-form');
  const typeSelect = form.querySelector('.composer-type');
  const pollEditor = form.querySelector('#poll-editor');
  const subjectRow = form.querySelector('#subject-row');
  const imageInput = form.querySelector('#image-input');
  const preview = form.querySelector('#image-preview');

  typeSelect.addEventListener('change', () => {
    const type = typeSelect.value;
    pollEditor.hidden = type !== 'poll';
    subjectRow.hidden = !['homework_question', 'study'].includes(type);
    form.querySelector('.composer-input').placeholder = type === 'poll'
      ? 'Ask your poll question...'
      : `Share something with the class, ${store.user.displayName.split(' ')[0]}...`;
  });

  form.querySelector('#add-option').addEventListener('click', () => {
    const options = form.querySelectorAll('[data-poll-option]');
    if (options.length >= 6) { toast('A poll can have up to six options.', 'warning'); return; }
    const input = document.createElement('input');
    input.className = 'input';
    input.placeholder = `Option ${options.length + 1}`;
    input.setAttribute('data-poll-option', '');
    form.querySelector('#poll-options').append(input);
  });

  imageInput.addEventListener('change', () => {
    const file = imageInput.files?.[0];
    if (!file) { preview.hidden = true; return; }
    preview.hidden = false;
    preview.innerHTML = `
      <img src="${URL.createObjectURL(file)}" alt="Selected picture">
      <button type="button" class="icon-button" id="clear-image" aria-label="Remove picture">${icon('close', 16)}</button>`;
    preview.querySelector('#clear-image').addEventListener('click', () => {
      imageInput.value = '';
      preview.hidden = true;
      preview.innerHTML = '';
    });
  });

  const textarea = form.querySelector('.composer-input');
  textarea.addEventListener('input', () => {
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(240, textarea.scrollHeight)}px`;
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    const type = typeSelect.value;
    const content = textarea.value.trim();
    const file = imageInput.files?.[0];

    if (!content && !file) { toast('Write something before you post.', 'warning'); return; }

    const data = new FormData();
    data.append('type', file && type === 'text' ? 'image' : type);
    data.append('content', content);
    const subject = form.querySelector('[name="subject"]');
    if (subject && !subjectRow.hidden) data.append('subject', subject.value.trim());
    if (file) data.append('image', file);

    if (type === 'poll') {
      const options = [...form.querySelectorAll('[data-poll-option]')].map((i) => i.value.trim()).filter(Boolean);
      if (options.length < 2) { toast('A poll needs at least two options.', 'warning'); return; }
      data.append('options', JSON.stringify(options));
    }

    button.disabled = true;
    button.innerHTML = '<span class="spinner" style="width:15px;height:15px"></span> Posting';
    try {
      const { post } = await api.posts.create(data);
      const list = mount.querySelector('#post-list');
      list.querySelector('.empty')?.closest('.card')?.remove();
      list.insertAdjacentHTML('afterbegin', renderPostCard(post));
      form.reset();
      textarea.style.height = 'auto';
      preview.hidden = true;
      pollEditor.hidden = true;
      subjectRow.hidden = true;
      form.querySelector('#poll-options').innerHTML = `
        <input class="input" placeholder="Option 1" data-poll-option>
        <input class="input" placeholder="Option 2" data-poll-option>`;
      toast('Posted to the class feed.', 'success');
    } catch (err) {
      // With no connection, keep the post and send it automatically later
      // rather than losing what was written.
      const connectionProblem = !err.status || err.status === 0 || err.status >= 500;
      if (connectionProblem && type !== 'poll' && !file) {
        queuePost({ type, content, subject: subject?.value?.trim() || '', clubId: null });
        form.reset();
        textarea.style.height = 'auto';
        toast('You are offline. This will be posted as soon as you are back.', 'warning', 'Saved');
      } else {
        toast(err.message, 'error');
      }
    } finally {
      button.disabled = false;
      button.innerHTML = `${icon('send', 15)} Post`;
    }
  });
}
