// ==========================================================
// One post in the feed, plus all of the actions on it.
// ==========================================================
import { esc, timeAgo, richText, plural } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { api } from '../lib/api.js';
import { store, can } from '../lib/store.js';
import { avatar, roleBadge, openReportDialog, openUserPicker } from './common.js';
import { toast, contextMenu, confirmDialog, promptDialog } from '../lib/ui.js';

const TYPE_LABEL = {
  homework_question: { label: 'Homework question', icon: 'book', tone: 'info' },
  study: { label: 'Study discussion', icon: 'brain', tone: 'accent' },
  announcement: { label: 'Class announcement', icon: 'megaphone', tone: 'warning' },
  poll: { label: 'Poll', icon: 'poll', tone: '' },
  image: { label: '', icon: '', tone: '' },
  text: { label: '', icon: '', tone: '' }
};

export function renderPostCard(post, options = {}) {
  const type = TYPE_LABEL[post.type] || TYPE_LABEL.text;
  const mine = post.author?.id === store.user?.id;

  return `
    <article class="card post" data-post="${post.id}">
      <header class="post-head">
        <a href="#/profile/${esc(post.author?.username || '')}">${avatar(post.author, 'sm', true)}</a>
        <div class="post-who">
          <div class="row row-tight">
            <a href="#/profile/${esc(post.author?.username || '')}" class="bold" style="color:inherit">${esc(post.author?.displayName || 'Unknown')}</a>
            ${roleBadge(post.author)}
            ${post.pinned ? `<span class="badge badge-accent">${icon('pin', 11)} Pinned</span>` : ''}
          </div>
          <div class="tiny faint">
            ${timeAgo(post.createdAt)}${post.editedAt ? ' - edited' : ''}
            ${post.clubName ? ` - in <a href="#/clubs/${post.clubId}">${esc(post.clubName)}</a>` : ''}
          </div>
        </div>
        <button class="icon-button" data-post-menu="${post.id}" aria-label="More actions">${icon('more', 18)}</button>
      </header>

      ${type.label ? `<div class="post-type ${type.tone ? `badge-${type.tone}` : ''}">
        ${icon(type.icon, 12)} ${esc(type.label)}${post.subject ? ` - ${esc(post.subject)}` : ''}
      </div>` : ''}

      ${post.content && post.type !== 'poll' ? `<div class="post-body pre-wrap">${richText(post.content)}</div>` : ''}
      ${post.type === 'poll' ? renderPoll(post) : ''}
      ${post.imageUrl ? `<a href="${esc(post.imageUrl)}" target="_blank" rel="noopener" class="post-image">
        <img src="${esc(post.imageUrl)}" alt="Attached picture" loading="lazy">
      </a>` : ''}

      <footer class="post-actions">
        <button class="post-action ${post.liked ? 'active' : ''}" data-like="${post.id}" aria-pressed="${post.liked}">
          ${icon('heart', 17)}<span data-like-count>${post.likes}</span>
        </button>
        <button class="post-action" data-comments="${post.id}">
          ${icon('comment', 17)}<span data-comment-count>${post.comments}</span>
        </button>
        <button class="post-action" data-share="${post.id}">${icon('share', 17)}<span>Share</span></button>
        <button class="post-action ${post.saved ? 'active' : ''}" data-save="${post.id}" aria-pressed="${post.saved}">
          ${icon('bookmark', 17)}<span>${post.saved ? 'Saved' : 'Save'}</span>
        </button>
      </footer>

      <div class="post-comments" data-comment-box="${post.id}" hidden></div>
    </article>`;
}

function renderPoll(post) {
  const poll = post.poll;
  if (!poll) return '';
  const voted = poll.myVote !== null && poll.myVote !== undefined;
  return `
    <div class="poll">
      <div class="post-body bold" style="margin-bottom:.6rem">${esc(poll.question)}</div>
      ${poll.options.map((option, index) => `
        <button class="poll-option ${voted ? 'voted' : ''} ${poll.myVote === index ? 'mine' : ''}"
                data-vote="${post.id}" data-option="${index}" ${voted ? 'disabled' : ''}>
          <span class="poll-fill" style="width:${voted ? option.percent : 0}%"></span>
          <span class="poll-text">
            ${poll.myVote === index ? icon('check', 14) : ''}
            <span>${esc(option.text)}</span>
          </span>
          ${voted ? `<span class="poll-percent">${option.percent}%</span>` : ''}
        </button>`).join('')}
      <div class="tiny faint" style="margin-top:.4rem">${plural(poll.totalVotes, 'vote')}${voted ? '' : ' - pick an option to see the results'}</div>
    </div>`;
}

/**
 * Wires every post inside a container. Call once after rendering a list.
 * `onChange` runs when a post is removed so the page can refresh itself.
 */
export function wirePostList(root, { onChange } = {}) {
  root.addEventListener('click', async (event) => {
    const likeButton = event.target.closest('[data-like]');
    if (likeButton) return handleLike(likeButton);

    const saveButton = event.target.closest('[data-save]');
    if (saveButton) return handleSave(saveButton);

    const voteButton = event.target.closest('[data-vote]');
    if (voteButton) return handleVote(voteButton);

    const commentButton = event.target.closest('[data-comments]');
    if (commentButton) return toggleComments(commentButton, root);

    const shareButton = event.target.closest('[data-share]');
    if (shareButton) return handleShare(Number(shareButton.dataset.share));

    const menuButton = event.target.closest('[data-post-menu]');
    if (menuButton) return handleMenu(menuButton, root, onChange);
  });
}

async function handleLike(button) {
  const id = Number(button.dataset.like);
  try {
    const result = await api.posts.like(id);
    button.classList.toggle('active', result.liked);
    button.setAttribute('aria-pressed', String(result.liked));
    button.querySelector('[data-like-count]').textContent = result.likes;
  } catch (err) { toast(err.message, 'error'); }
}

async function handleSave(button) {
  const id = Number(button.dataset.save);
  try {
    const result = await api.posts.save(id);
    button.classList.toggle('active', result.saved);
    button.querySelector('span').textContent = result.saved ? 'Saved' : 'Save';
    toast(result.saved ? 'Post saved.' : 'Removed from saved posts.', 'success');
  } catch (err) { toast(err.message, 'error'); }
}

async function handleVote(button) {
  const postId = Number(button.dataset.vote);
  try {
    const { post } = await api.posts.vote(postId, Number(button.dataset.option));
    const article = button.closest('[data-post]');
    article.outerHTML = renderPostCard(post);
  } catch (err) { toast(err.message, 'error'); }
}

function handleShare(postId) {
  openUserPicker({
    title: 'Share this post with a classmate',
    confirmText: 'Send',
    onPick: async (userId) => {
      try {
        await api.posts.share(postId, userId);
        toast('Post shared in a private message.', 'success');
      } catch (err) { toast(err.message, 'error'); }
    }
  });
}

async function handleMenu(button, root, onChange) {
  const id = Number(button.dataset.postMenu);
  const article = button.closest('[data-post]');
  const authorLink = article.querySelector('.post-who a');
  const mine = authorLink?.getAttribute('href') === `#/profile/${store.user.username}`;
  const moderator = can('posts.moderate');

  const items = [];
  if (mine) items.push({ label: 'Edit post', action: 'edit', icon: 'edit' });
  if (moderator && !mine) items.push({ label: 'Edit as moderator', action: 'edit', icon: 'edit' });
  if (moderator) items.push({ label: 'Pin or unpin', action: 'pin', icon: 'pin' });
  items.push({ label: 'Copy link', action: 'link', icon: 'link' });
  items.push({ label: 'Hide this post', action: 'hide', icon: 'eyeOff' });
  if (!mine) items.push({ label: 'Report post', action: 'report', icon: 'flag', danger: true });
  if (mine || moderator) {
    items.push('-');
    items.push({ label: 'Delete post', action: 'delete', icon: 'trash', danger: true });
  }

  const action = await contextMenu(button, items);
  if (!action) return;

  if (action === 'edit') {
    const body = article.querySelector('.post-body');
    const current = body ? body.innerText : '';
    const text = await promptDialog({ title: 'Edit your post', label: 'Post text', value: current, multiline: true });
    if (text === null) return;
    try {
      const { post } = await api.posts.update(id, text);
      article.outerHTML = renderPostCard(post);
      toast('Post updated.', 'success');
    } catch (err) { toast(err.message, 'error'); }
  }

  if (action === 'pin') {
    try {
      const result = await api.posts.pin(id);
      toast(result.pinned ? 'Post pinned to the top.' : 'Post unpinned.', 'success');
      onChange?.();
    } catch (err) { toast(err.message, 'error'); }
  }

  if (action === 'link') {
    const url = `${location.origin}/#/post/${id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast('Link copied.', 'success');
    } catch { toast(url, 'info', 'Post link'); }
  }

  if (action === 'hide') {
    try {
      await api.posts.hide(id);
      article.remove();
      toast('Post hidden from your feed.', 'success');
    } catch (err) { toast(err.message, 'error'); }
  }

  if (action === 'report') openReportDialog('post', id, 'post');

  if (action === 'delete') {
    const yes = await confirmDialog({
      title: 'Delete this post?',
      message: 'It will be removed from the feed for everyone.',
      confirmText: 'Delete',
      danger: true
    });
    if (!yes) return;
    try {
      await api.posts.remove(id);
      article.remove();
      toast('Post deleted.', 'success');
      onChange?.();
    } catch (err) { toast(err.message, 'error'); }
  }
}

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------
async function toggleComments(button, root) {
  const id = Number(button.dataset.comments);
  const box = root.querySelector(`[data-comment-box="${id}"]`);
  if (!box) return;

  if (!box.hidden) { box.hidden = true; return; }

  box.hidden = false;
  box.innerHTML = '<div class="spinner spinner-center"></div>';

  try {
    const { comments } = await api.posts.comments(id);
    box.innerHTML = `
      <div class="comment-list">${comments.map(renderComment).join('') || '<p class="small faint center">No comments yet. Start the conversation.</p>'}</div>
      <form class="comment-form" data-comment-form="${id}">
        ${avatar(store.user, 'xs')}
        <input class="input" name="content" placeholder="Write a comment..." autocomplete="off" maxlength="1000" required>
        <button class="btn btn-primary btn-sm" type="submit" aria-label="Send comment">${icon('send', 15)}</button>
      </form>`;

    box.querySelector('form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const input = event.currentTarget.querySelector('input');
      const content = input.value.trim();
      if (!content) return;
      input.value = '';
      try {
        const { comment } = await api.posts.comment(id, content);
        const list = box.querySelector('.comment-list');
        if (list.querySelector('p')) list.innerHTML = '';
        list.insertAdjacentHTML('beforeend', renderComment(comment));
        const counter = root.querySelector(`[data-comments="${id}"] [data-comment-count]`);
        counter.textContent = Number(counter.textContent) + 1;
      } catch (err) {
        toast(err.message, 'error');
        input.value = content;
      }
    });

    box.addEventListener('click', async (event) => {
      const del = event.target.closest('[data-delete-comment]');
      if (del) {
        const yes = await confirmDialog({ title: 'Delete this comment?', confirmText: 'Delete', danger: true });
        if (!yes) return;
        try {
          await api.posts.deleteComment(Number(del.dataset.deleteComment));
          del.closest('.comment').remove();
          const counter = root.querySelector(`[data-comments="${id}"] [data-comment-count]`);
          counter.textContent = Math.max(0, Number(counter.textContent) - 1);
        } catch (err) { toast(err.message, 'error'); }
      }
      const report = event.target.closest('[data-report-comment]');
      if (report) openReportDialog('comment', Number(report.dataset.reportComment), 'comment');
    });
  } catch (err) {
    box.innerHTML = `<p class="small" style="color:var(--danger)">${esc(err.message)}</p>`;
  }
}

function renderComment(comment) {
  const mine = comment.author?.id === store.user?.id;
  const canDelete = mine || can('posts.moderate');
  return `
    <div class="comment" data-comment="${comment.id}">
      ${avatar(comment.author, 'xs')}
      <div class="comment-body">
        <div class="comment-bubble">
          <a href="#/profile/${esc(comment.author?.username || '')}" class="bold tiny" style="color:inherit">${esc(comment.author?.displayName || 'Unknown')}</a>
          <div class="pre-wrap small">${esc(comment.content)}</div>
        </div>
        <div class="comment-meta tiny faint">
          <span>${timeAgo(comment.createdAt)}</span>
          ${canDelete ? `<button data-delete-comment="${comment.id}">Delete</button>` : ''}
          ${!mine ? `<button data-report-comment="${comment.id}">Report</button>` : ''}
        </div>
      </div>
    </div>`;
}
