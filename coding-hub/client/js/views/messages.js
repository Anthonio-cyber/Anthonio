// ==========================================================
// The messaging hub: conversation list on the left, thread on
// the right. On phones the thread takes over the whole screen.
// ==========================================================
import { esc, timeAgo, formatTime, formatDate, initials, scrollToBottom, debounce } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { api } from '../lib/api.js';
import { store, on, refreshCounts, can } from '../lib/store.js';
import { setPageTitle } from '../components/shell.js';
import { avatar, emptyState, openReportDialog, openUserPicker } from '../components/common.js';
import { toast, contextMenu, confirmDialog, promptDialog, modal } from '../lib/ui.js';
import { navigate } from '../lib/router.js';

const REACTIONS = ['thumb', 'heart', 'smile', 'wow', 'sad'];
const REACTION_TEXT = { thumb: '+1', heart: '<3', smile: ':)', wow: ':o', sad: ':(' };

export default async function messages({ mount, params }) {
  setPageTitle('Messages');
  const activeId = params.id ? Number(params.id) : null;

  mount.innerHTML = `
    <div class="page page-messages">
      <div class="messenger ${activeId ? 'thread-open' : ''}" id="messenger">
        <aside class="conversation-pane">
          <div class="conversation-head">
            <h2>Messages</h2>
            <button class="icon-button" id="new-chat" title="Start a new chat">${icon('plus', 19)}</button>
          </div>
          <div class="conversation-search">
            <input class="input" id="conversation-search" placeholder="Search conversations..." autocomplete="off">
          </div>
          <div class="conversation-list" id="conversation-list">
            <div class="spinner spinner-center"></div>
          </div>
        </aside>
        <section class="thread-pane" id="thread-pane">
          ${activeId ? '<div class="spinner spinner-center"></div>' : welcomePane()}
        </section>
      </div>
    </div>`;

  const state = {
    conversations: [],
    activeId,
    typingTimers: new Map(),
    sendingTyping: false
  };

  await loadConversations(mount, state);
  if (activeId) await openThread(mount, state, activeId);

  wireMessenger(mount, state);

  const offs = [
    on('message:new', ({ conversationId, message }) => {
      if (conversationId === state.activeId) {
        appendMessage(mount, message);
        api.messages.markRead(conversationId).catch(() => {});
      }
      loadConversations(mount, state);
    }),
    on('message:updated', ({ conversationId, message }) => {
      if (conversationId !== state.activeId) return;
      const node = mount.querySelector(`[data-message="${message.id}"]`);
      if (node) node.outerHTML = renderMessage(message);
    }),
    on('message:deleted', ({ conversationId, id }) => {
      if (conversationId !== state.activeId) return;
      mount.querySelector(`[data-message="${id}"]`)?.remove();
    }),
    on('typing', ({ conversationId, user, typing }) => {
      if (conversationId !== state.activeId) return;
      showTyping(mount, user, typing);
    }),
    on('conversation:bump', () => loadConversations(mount, state)),
    on('presence', () => loadConversations(mount, state))
  ];

  return { destroy: () => offs.forEach((off) => off()) };
}

function welcomePane() {
  return `
    <div class="thread-empty">
      ${emptyState({
    iconName: 'message',
    title: 'Choose a conversation',
    text: 'Pick somebody from the list, or open a profile and press Message.',
    action: '<button class="btn btn-primary" id="new-chat-empty">Start a new chat</button>'
  })}
    </div>`;
}

// ---------------------------------------------------------------------------
// Conversation list
// ---------------------------------------------------------------------------
async function loadConversations(mount, state) {
  const list = mount.querySelector('#conversation-list');
  if (!list) return;
  try {
    const { conversations } = await api.messages.conversations();
    state.conversations = conversations;
    renderConversations(mount, state);
  } catch (err) {
    list.innerHTML = `<p class="small center" style="color:var(--danger)">${esc(err.message)}</p>`;
  }
}

function renderConversations(mount, state, term = '') {
  const list = mount.querySelector('#conversation-list');
  if (!list) return;
  const filtered = term
    ? state.conversations.filter((c) => c.title.toLowerCase().includes(term.toLowerCase()))
    : state.conversations;

  list.innerHTML = filtered.length
    ? filtered.map((c) => `
      <a class="conversation-item ${c.id === state.activeId ? 'active' : ''}" href="#/messages/${c.id}" data-conversation="${c.id}">
        <span class="avatar-wrap">
          <span class="avatar avatar-md">
            ${c.avatarUrl ? `<img src="${esc(c.avatarUrl)}" alt="">` : esc(initials(c.title))}
          </span>
          ${c.kind === 'direct' ? `<span class="presence-dot ${c.online ? 'online' : ''}"></span>` : ''}
        </span>
        <span class="conversation-meta">
          <span class="conversation-top">
            <span class="title truncate">${esc(c.title)}</span>
            <span class="tiny faint nowrap">${c.lastMessage ? timeAgo(c.lastMessage.createdAt) : ''}</span>
          </span>
          <span class="conversation-bottom">
            <span class="sub truncate">
              ${c.lastMessage ? `${c.lastMessage.mine ? 'You: ' : ''}${esc(c.lastMessage.body)}` : 'No messages yet'}
            </span>
            ${c.unread ? `<span class="nav-badge">${c.unread > 99 ? '99+' : c.unread}</span>` : ''}
          </span>
        </span>
      </a>`).join('')
    : emptyState({ iconName: 'message', title: 'No conversations', text: 'Start one with the + button above.' });
}

// ---------------------------------------------------------------------------
// One thread
// ---------------------------------------------------------------------------
async function openThread(mount, state, conversationId, options = {}) {
  const pane = mount.querySelector('#thread-pane');
  state.activeId = conversationId;
  pane.innerHTML = '<div class="spinner spinner-center"></div>';
  mount.querySelector('#messenger').classList.add('thread-open');

  let data;
  try {
    data = await api.messages.thread(conversationId, options.reason ? `?reason=${encodeURIComponent(options.reason)}` : '');
  } catch (err) {
    if (err.code === 'private_conversation') {
      pane.innerHTML = `<div class="thread-empty">${emptyState({
        iconName: 'lock',
        title: 'This conversation is private',
        text: 'Only the people in a chat can read it.'
      })}</div>`;
      return;
    }
    if (err.code === 'reason_required' && can('messages.moderate')) {
      const reason = await promptDialog({
        title: 'Moderation access',
        label: 'Why do you need to read this private conversation?',
        placeholder: 'Report #12 - reported for bullying',
        confirmText: 'Open and record'
      });
      if (!reason) { navigate('/messages'); return; }
      return openThread(mount, state, conversationId, { reason });
    }
    pane.innerHTML = `<div class="thread-empty">${emptyState({ iconName: 'warning', title: 'Could not open', text: err.message })}</div>`;
    return;
  }

  const conversation = data.conversation;
  store.socket?.emit('conversation:join', conversationId);

  pane.innerHTML = `
    <header class="thread-head">
      <button class="icon-button thread-back" id="thread-back" aria-label="Back to conversations">${icon('arrowLeft', 19)}</button>
      ${conversation.kind === 'direct' && conversation.other
    ? `<a href="#/profile/${esc(conversation.other.username)}" class="thread-who">
          ${avatar(conversation.other, 'sm', true)}
          <span>
            <span class="title">${esc(conversation.title)}</span>
            <span class="tiny faint" id="presence-line">${presenceLine(conversation.other)}</span>
          </span>
        </a>`
    : `<span class="thread-who">
          <span class="avatar avatar-sm">${esc(initials(conversation.title))}</span>
          <span>
            <span class="title">${esc(conversation.title)}</span>
            <span class="tiny faint">${data.members.length} members</span>
          </span>
        </span>`}
      <div class="spacer"></div>
      <button class="icon-button" id="thread-menu" aria-label="Conversation options">${icon('more', 19)}</button>
    </header>

    ${data.readOnly ? `<div class="alert alert-warning" style="margin:.75rem">${icon('shield', 17)}
      <div>You are reading this as a moderator. This access has been recorded in the activity log and both members were told.</div></div>` : ''}

    <div class="thread-body" id="thread-body">
      ${data.messages.length
    ? renderMessageGroups(data.messages)
    : `<div class="thread-empty">${emptyState({
      iconName: 'message',
      title: 'Say hello',
      text: `This is the start of your conversation${conversation.kind === 'direct' ? ` with ${conversation.title}` : ''}.`
    })}</div>`}
      <div class="typing-line" id="typing-line" hidden></div>
    </div>

    ${data.readOnly ? '' : `
    <form class="thread-composer" id="thread-composer">
      <div class="reply-preview" id="reply-preview" hidden></div>
      <div class="composer-row">
        <label class="icon-button" title="Send a picture">
          ${icon('image', 19)}
          <input type="file" accept="image/*" hidden id="message-image">
        </label>
        <button type="button" class="icon-button" id="send-as-code" title="Send as a code snippet">
          ${icon('code', 19)}
        </button>
        <textarea class="textarea" id="message-input" rows="1" placeholder="Write a message..." maxlength="8000"></textarea>
        <button class="btn btn-primary" type="submit" aria-label="Send">${icon('send', 17)}</button>
      </div>
      <div class="composer-preview" id="message-image-preview" hidden></div>
    </form>`}`;

  const body = pane.querySelector('#thread-body');
  scrollToBottom(body);
  wireThread(mount, state, conversation, data);
  refreshCounts();
  renderConversations(mount, state);
}

function presenceLine(user) {
  if (!user) return '';
  if (user.online) return 'Online now';
  if (!user.lastSeen) return 'Offline';
  return `Last seen ${timeAgo(user.lastSeen)}`;
}

function renderMessageGroups(messages) {
  let lastDate = '';
  return messages.map((message) => {
    const date = formatDate(message.createdAt);
    let divider = '';
    if (date !== lastDate) {
      lastDate = date;
      divider = `<div class="day-divider"><span>${esc(date)}</span></div>`;
    }
    return divider + renderMessage(message);
  }).join('');
}

function renderMessage(message) {
  if (message.deleted) {
    return `<div class="message ${message.mine ? 'mine' : ''}" data-message="${message.id}">
      <div class="bubble deleted"><em class="small faint">This message was deleted</em></div>
    </div>`;
  }
  const reactions = message.reactions.length
    ? `<div class="reactions">${message.reactions.map((r) => `
        <button class="reaction ${r.mine ? 'mine' : ''}" data-react="${message.id}" data-emoji="${esc(r.emoji)}">
          ${esc(REACTION_TEXT[r.emoji] || r.emoji)} ${r.count}
        </button>`).join('')}</div>`
    : '';

  return `
    <div class="message ${message.mine ? 'mine' : ''}" data-message="${message.id}">
      ${message.mine ? '' : avatar(message.sender, 'xs')}
      <div class="message-column">
        ${message.mine ? '' : `<div class="tiny faint message-name">${esc(message.sender?.displayName || '')}</div>`}
        ${message.replyTo ? `<div class="reply-quote">
          <span class="tiny bold">${esc(message.replyTo.author?.displayName || '')}</span>
          <span class="tiny truncate">${esc(message.replyTo.body)}</span>
        </div>` : ''}
        <div class="bubble ${message.messageType === 'code' ? 'bubble-code' : ''}">
          ${message.body
    ? (message.messageType === 'code'
      ? `<div class="code-block">
             <div class="code-block-bar"><span>${esc(message.codeLanguage || 'code')}</span>
               <button type="button" class="btn btn-xs btn-ghost" data-copy-snippet>Copy</button></div>
             <pre><code>${esc(message.body)}</code></pre>
           </div>`
      : `<div class="pre-wrap">${esc(message.body)}</div>`)
    : ''}
          ${message.attachmentUrl ? `<a href="${esc(message.attachmentUrl)}" target="_blank" rel="noopener">
            <img src="${esc(message.attachmentUrl)}" alt="Picture" class="message-image" loading="lazy">
          </a>` : ''}
          <div class="bubble-meta tiny">
            ${formatTime(message.createdAt)}${message.editedAt ? ' - edited' : ''}
          </div>
        </div>
        ${reactions}
        <div class="message-tools">
          <button data-react-open="${message.id}" title="React">${icon('smile', 14)}</button>
          <button data-reply="${message.id}" title="Reply">${icon('reply', 14)}</button>
          <button data-message-menu="${message.id}" title="More">${icon('more', 14)}</button>
        </div>
      </div>
    </div>`;
}

function appendMessage(mount, message) {
  const body = mount.querySelector('#thread-body');
  if (!body) return;
  body.querySelector('.thread-empty')?.remove();
  const typing = body.querySelector('#typing-line');
  const nearBottom = body.scrollHeight - body.scrollTop - body.clientHeight < 160;
  typing.insertAdjacentHTML('beforebegin', renderMessage(message));
  if (nearBottom || message.mine) scrollToBottom(body, true);
}

function showTyping(mount, user, typing) {
  const line = mount.querySelector('#typing-line');
  if (!line) return;
  line.hidden = !typing;
  line.innerHTML = typing ? `<span class="typing-dots"><i></i><i></i><i></i></span> ${esc(user.displayName)} is typing` : '';
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------
function wireMessenger(mount, state) {
  mount.addEventListener('click', async (event) => {
    if (event.target.closest('#new-chat') || event.target.closest('#new-chat-empty')) {
      openUserPicker({
        title: 'Start a conversation',
        confirmText: 'Message',
        onPick: async (userId) => {
          try {
            const { conversation } = await api.messages.openWith(userId);
            await loadConversations(mount, state);
            navigate(`/messages/${conversation.id}`);
          } catch (err) { toast(err.message, 'error'); }
        }
      });
    }

    const item = event.target.closest('[data-conversation]');
    if (item) {
      event.preventDefault();
      const id = Number(item.dataset.conversation);
      window.history.replaceState(null, '', `#/messages/${id}`);
      await openThread(mount, state, id);
    }
  });

  const search = mount.querySelector('#conversation-search');
  search?.addEventListener('input', debounce(() => renderConversations(mount, state, search.value.trim()), 150));
}

function wireThread(mount, state, conversation, data) {
  const pane = mount.querySelector('#thread-pane');
  const body = pane.querySelector('#thread-body');

  pane.querySelector('#thread-back')?.addEventListener('click', () => {
    mount.querySelector('#messenger').classList.remove('thread-open');
    state.activeId = null;
    window.history.replaceState(null, '', '#/messages');
    pane.innerHTML = welcomePane();
    renderConversations(mount, state);
  });

  pane.querySelector('#thread-menu')?.addEventListener('click', async (event) => {
    const isDirect = conversation.kind === 'direct';
    const items = [];
    if (isDirect && conversation.other) {
      items.push({ label: 'View profile', action: 'profile', icon: 'user' });
      items.push({ label: 'Block this person', action: 'block', icon: 'block', danger: true });
      items.push({ label: 'Report this conversation', action: 'report', icon: 'flag', danger: true });
    } else {

    }
    const action = await contextMenu(event.currentTarget, items);
    if (action === 'profile') navigate(`/profile/${conversation.other.username}`);

    if (action === 'report') openReportDialog('user', conversation.other.id, 'conversation');
    if (action === 'block') {
      const yes = await confirmDialog({
        title: `Block ${conversation.title}?`,
        message: 'You will not be able to message each other until you unblock them.',
        confirmText: 'Block',
        danger: true
      });
      if (!yes) return;
      try {
        await api.users.block(conversation.other.id);
        toast('Blocked. You can unblock them from Settings.', 'success');
        navigate('/messages');
      } catch (err) { toast(err.message, 'error'); }
    }
  });

  // ---- message level actions ----
  body.addEventListener('click', async (event) => {
    const reactButton = event.target.closest('[data-react]');
    if (reactButton) {
      try {
        const { message } = await api.messages.react(Number(reactButton.dataset.react), reactButton.dataset.emoji);
        mount.querySelector(`[data-message="${message.id}"]`).outerHTML = renderMessage(message);
      } catch (err) { toast(err.message, 'error'); }
      return;
    }

    const openReact = event.target.closest('[data-react-open]');
    if (openReact) {
      const id = Number(openReact.dataset.reactOpen);
      const action = await contextMenu(openReact, REACTIONS.map((emoji) => ({
        label: `${REACTION_TEXT[emoji]}  ${emoji}`, action: emoji, icon: 'smile'
      })));
      if (!action) return;
      try {
        const { message } = await api.messages.react(id, action);
        mount.querySelector(`[data-message="${id}"]`).outerHTML = renderMessage(message);
      } catch (err) { toast(err.message, 'error'); }
      return;
    }

    const replyButton = event.target.closest('[data-reply]');
    if (replyButton) {
      const id = Number(replyButton.dataset.reply);
      const node = mount.querySelector(`[data-message="${id}"] .bubble .pre-wrap`);
      const preview = pane.querySelector('#reply-preview');
      preview.hidden = false;
      preview.dataset.replyTo = id;
      preview.innerHTML = `
        ${icon('reply', 14)}
        <span class="truncate small">${esc(node?.textContent?.slice(0, 90) || 'Picture')}</span>
        <button type="button" class="icon-button" id="cancel-reply" aria-label="Cancel reply">${icon('close', 14)}</button>`;
      preview.querySelector('#cancel-reply').addEventListener('click', () => {
        preview.hidden = true;
        delete preview.dataset.replyTo;
      });
      pane.querySelector('#message-input')?.focus();
      return;
    }

    const copyButton = event.target.closest('[data-copy-snippet]');
    if (copyButton) {
      const code = copyButton.closest('.code-block')?.querySelector('code')?.textContent || '';
      try { await navigator.clipboard.writeText(code); toast('Code copied.', 'success'); }
      catch { toast('Select the code and copy it by hand.', 'warning'); }
      return;
    }

    const menuButton = event.target.closest('[data-message-menu]');
    if (menuButton) {
      const id = Number(menuButton.dataset.messageMenu);
      const node = mount.querySelector(`[data-message="${id}"]`);
      const mine = node.classList.contains('mine');
      const items = [];
      if (mine) items.push({ label: 'Edit message', action: 'edit', icon: 'edit' });
      items.push({ label: 'Copy text', action: 'copy', icon: 'link' });
      if (!mine) items.push({ label: 'Report message', action: 'report', icon: 'flag', danger: true });
      items.push({ label: 'Delete for me', action: 'delete-me', icon: 'trash' });
      if (mine) items.push({ label: 'Delete for everyone', action: 'delete-all', icon: 'trash', danger: true });

      const action = await contextMenu(menuButton, items);
      const text = node.querySelector('.bubble .pre-wrap')?.textContent || '';

      if (action === 'edit') {
        const next = await promptDialog({ title: 'Edit message', label: 'Message', value: text, multiline: true });
        if (next === null) return;
        try {
          const { message } = await api.messages.edit(id, next);
          node.outerHTML = renderMessage(message);
        } catch (err) { toast(err.message, 'error'); }
      }
      if (action === 'copy') {
        try { await navigator.clipboard.writeText(text); toast('Copied.', 'success'); } catch { /* clipboard blocked */ }
      }
      if (action === 'report') openReportDialog('message', id, 'message');
      if (action === 'delete-me') {
        try {
          await api.messages.remove(id, false);
          node.remove();
          toast('Removed from your copy of this conversation.', 'success');
        } catch (err) { toast(err.message, 'error'); }
      }
      if (action === 'delete-all') {
        const yes = await confirmDialog({
          title: 'Delete for everyone?',
          message: 'Nobody in this conversation will be able to read it any more.',
          confirmText: 'Delete for everyone',
          danger: true
        });
        if (!yes) return;
        try { await api.messages.remove(id, true); node.remove(); } catch (err) { toast(err.message, 'error'); }
      }
    }
  });

  // ---- composing ----
  const form = pane.querySelector('#thread-composer');
  if (!form) return;

  const input = form.querySelector('#message-input');
  const fileInput = form.querySelector('#message-image');
  const preview = form.querySelector('#message-image-preview');

  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = `${Math.min(140, input.scrollHeight)}px`;
    sendTyping(state, conversation.id, true);
  });

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      form.requestSubmit();
    }
  });

  input.addEventListener('blur', () => sendTyping(state, conversation.id, false));

  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (!file) { preview.hidden = true; return; }
    preview.hidden = false;
    preview.innerHTML = `
      <img src="${URL.createObjectURL(file)}" alt="Selected picture">
      <button type="button" class="icon-button" id="clear-message-image" aria-label="Remove">${icon('close', 16)}</button>`;
    preview.querySelector('#clear-message-image').addEventListener('click', () => {
      fileInput.value = '';
      preview.hidden = true;
    });
  });

  // Sending as a code snippet keeps the indentation exactly as typed.
  let sendAsCode = false;
  const codeButton = form.querySelector('#send-as-code');
  codeButton?.addEventListener('click', () => {
    sendAsCode = !sendAsCode;
    codeButton.classList.toggle('active', sendAsCode);
    codeButton.title = sendAsCode ? 'Sending as a code snippet' : 'Send as a code snippet';
    input.placeholder = sendAsCode ? 'Paste your code...' : 'Write a message...';
    input.focus();
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const raw = input.value;
    const text = sendAsCode ? raw.replace(/\s+$/, '') : raw.trim();
    const file = fileInput.files?.[0];
    if (!text && !file) return;

    const replyPreview = form.querySelector('#reply-preview');
    const data = new FormData();
    data.append('body', text);
    data.append('messageType', sendAsCode ? 'code' : 'text');
    if (file) data.append('image', file);
    if (replyPreview?.dataset.replyTo) data.append('replyToId', replyPreview.dataset.replyTo);

    input.value = '';
    input.style.height = 'auto';
    if (sendAsCode) {
      sendAsCode = false;
      codeButton?.classList.remove('active');
      input.placeholder = 'Write a message...';
    }
    fileInput.value = '';
    preview.hidden = true;
    if (replyPreview) { replyPreview.hidden = true; delete replyPreview.dataset.replyTo; }
    sendTyping(state, conversation.id, false);

    try {
      const { message } = await api.messages.send(conversation.id, data);
      appendMessage(mount, message);
      loadConversations(mount, state);
    } catch (err) {
      toast(err.message, 'error');
      input.value = raw;
    }
  });
}

function sendTyping(state, conversationId, typing) {
  if (!store.socket) return;
  if (typing) {
    if (!state.sendingTyping) {
      store.socket.emit('typing:start', { conversationId });
      state.sendingTyping = true;
    }
    clearTimeout(state.typingTimers.get(conversationId));
    state.typingTimers.set(conversationId, setTimeout(() => {
      store.socket.emit('typing:stop', { conversationId });
      state.sendingTyping = false;
    }, 2200));
  } else {
    clearTimeout(state.typingTimers.get(conversationId));
    if (state.sendingTyping) {
      store.socket.emit('typing:stop', { conversationId });
      state.sendingTyping = false;
    }
  }
}
