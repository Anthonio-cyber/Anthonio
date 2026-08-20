// ==========================================================
// A single post on its own page (used by shared links).
// ==========================================================
import { esc } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { api } from '../lib/api.js';
import { setPageTitle } from '../components/shell.js';
import { emptyState } from '../components/common.js';
import { renderPostCard, wirePostList } from '../components/post-card.js';
import { navigate } from '../lib/router.js';

export default async function postView({ mount, params }) {
  setPageTitle('Post');
  mount.innerHTML = '<div class="page page-narrow"><div class="spinner spinner-center"></div></div>';

  try {
    const { post } = await api.posts.one(Number(params.id));
    mount.innerHTML = `
      <div class="page page-narrow">
        <a class="btn btn-sm btn-ghost" href="#/feed" style="margin-bottom:1rem">${icon('arrowLeft', 15)} Back to the feed</a>
        <div data-post-list>${renderPostCard(post)}</div>
      </div>`;
    wirePostList(mount, { onChange: () => navigate('/feed') });

    // Open the comments straight away on a shared link.
    mount.querySelector(`[data-comments="${post.id}"]`)?.click();
  } catch (err) {
    mount.innerHTML = `<div class="page page-narrow">${emptyState({
      iconName: 'feed',
      title: 'That post is not available',
      text: err.message,
      action: '<a class="btn btn-primary" href="#/feed">Back to the feed</a>'
    })}</div>`;
  }
}
