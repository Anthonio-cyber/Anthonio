// ==========================================================
// Coding Hub - reading one lesson, doing its coding challenge
// and marking it complete.
// ==========================================================
import { esc, delegate } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { api } from '../lib/api.js';
import { can } from '../lib/store.js';
import { setPageTitle } from '../components/shell.js';
import { emptyState } from '../components/common.js';
import { toast, withBusy, confirmDialog } from '../lib/ui.js';
import { renderBlocks, difficultyBadge } from '../components/learn.js';

export default async function lessonView({ mount, params }) {
  mount.innerHTML = '<div class="page page-narrow"><div class="spinner spinner-center"></div></div>';

  let lesson;
  try {
    lesson = (await api.learn.lesson(Number(params.id))).lesson;
  } catch (err) {
    mount.innerHTML = `<div class="page page-narrow">${emptyState({
      iconName: 'search', title: 'Lesson not found', text: err.message,
      action: '<a class="btn btn-primary" href="#/subjects">Back to subjects</a>'
    })}</div>`;
    return;
  }

  setPageTitle(lesson.title);
  render();

  function render() {
    const done = lesson.myStatus === 'completed';

    mount.innerHTML = `
      <article class="page page-narrow lesson-page">
        <a class="back-link" href="#/topic/${lesson.topicId}">${icon('arrowLeft', 15)} ${esc(lesson.topicName)}</a>

        <header class="lesson-head">
          <div class="lesson-crumbs small faint">
            <a href="#/subject/${esc(lesson.subjectSlug)}">${esc(lesson.subjectName)}</a>
            <span>/</span>
            <a href="#/topic/${lesson.topicId}">${esc(lesson.topicName)}</a>
          </div>
          <h1>${esc(lesson.title)}</h1>
          <p class="muted">${esc(lesson.summary)}</p>
          <div class="lesson-meta">
            <span class="badge">${icon('clock', 12)} ${lesson.minutes} min</span>
            <span class="badge badge-accent">${icon('zap', 12)} ${lesson.xpReward} XP</span>
            ${lesson.status === 'published' ? '' : '<span class="badge badge-warning">Draft</span>'}
            ${done ? '<span class="badge badge-success">Completed</span>' : ''}
            <button type="button" class="icon-button ${lesson.bookmarked ? 'active' : ''}" data-bookmark title="Bookmark this lesson">
              ${icon('bookmark', 16)}
            </button>
            ${can('lessons.edit') ? `<a class="btn btn-xs btn-ghost" href="#/admin/lessons?edit=${lesson.id}">${icon('edit', 12)} Edit</a>` : ''}
          </div>
        </header>

        ${lesson.objectives.length ? `
          <section class="card lesson-objectives">
            <h3>${icon('target', 16)} What you will learn</h3>
            <ul>${lesson.objectives.map((o) => `<li>${esc(o)}</li>`).join('')}</ul>
          </section>` : ''}

        <section class="lesson-body">${renderBlocks(lesson.blocks)}</section>

        ${lesson.challenges.map(challengeCard).join('')}

        <section class="lesson-actions card">
          ${done
    ? `<div class="row" style="justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap">
                <p class="small" style="margin:0">${icon('check', 15)} You completed this lesson.</p>
                <button type="button" class="btn btn-ghost btn-sm" data-reopen>Mark as not finished</button>
              </div>`
    : `<button type="button" class="btn btn-primary btn-lg" data-complete>
                ${icon('check', 17)} Mark this lesson complete (+${lesson.xpReward} XP)
              </button>`}
          ${lesson.questionCount
    ? `<a class="btn btn-ghost" href="#/practice?topic=${lesson.topicId}">
                 ${icon('target', 16)} Practise ${lesson.questionCount} questions on this topic
               </a>` : ''}
        </section>

        <nav class="lesson-nav">
          ${lesson.neighbours.previous
    ? `<a class="lesson-nav-link" href="#/lesson/${lesson.neighbours.previous.id}">
                 ${icon('arrowLeft', 15)}<span><small>Previous</small>${esc(lesson.neighbours.previous.title)}</span></a>`
    : '<span></span>'}
          ${lesson.neighbours.next
    ? `<a class="lesson-nav-link next" href="#/lesson/${lesson.neighbours.next.id}">
                 <span><small>Next</small>${esc(lesson.neighbours.next.title)}</span>${icon('arrowRight', 15)}</a>`
    : '<span></span>'}
        </nav>
      </article>`;

    wire();
  }

  function challengeCard(challenge) {
    return `
      <section class="card challenge-card ${challenge.completed ? 'is-done' : ''}" data-challenge="${challenge.id}">
        <div class="card-header">
          <span class="card-title-icon" style="background:var(--warning-soft);color:var(--warning)">${icon('zap', 17)}</span>
          <h3>Coding challenge: ${esc(challenge.title)}</h3>
          ${difficultyBadge(challenge.difficulty)}
          <span class="badge badge-accent">${challenge.points} XP</span>
        </div>

        <p>${esc(challenge.description)}</p>

        ${challenge.requirements.length ? `
          <h4>Requirements</h4>
          <ul class="lesson-list">${challenge.requirements.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>` : ''}

        ${challenge.starterCode ? `
          <h4>Starter code</h4>
          <div class="code-block">
            <div class="code-block-bar"><span>starter</span>
              <button type="button" class="btn btn-xs btn-ghost" data-copy-code>Copy</button></div>
            <pre><code>${esc(challenge.starterCode)}</code></pre>
          </div>` : ''}

        ${challenge.expectedResult ? `
          <h4>Expected result</h4>
          <p class="muted">${esc(challenge.expectedResult)}</p>` : ''}

        ${challenge.hints.length ? `
          <details class="hints">
            <summary>${icon('info', 14)} ${challenge.hints.length === 1 ? 'Hint' : `Hints (${challenge.hints.length})`}</summary>
            <ul class="lesson-list">${challenge.hints.map((h) => `<li>${esc(h)}</li>`).join('')}</ul>
          </details>` : ''}

        <h4>Your solution</h4>
        <textarea class="textarea code-input" data-solution rows="8"
          placeholder="Paste or type your solution here. It is saved with your progress.">${esc(challenge.solution || challenge.starterCode || '')}</textarea>

        <div class="row" style="gap:.6rem;flex-wrap:wrap">
          ${challenge.completed
    ? `<span class="badge badge-success">${icon('check', 12)} Completed</span>
               <button type="button" class="btn btn-sm btn-ghost" data-save-challenge>Save my solution</button>
               <button type="button" class="btn btn-sm btn-ghost" data-reset-challenge>Mark as not done</button>`
    : `<button type="button" class="btn btn-primary" data-save-challenge>
                 ${icon('check', 15)} I have completed this challenge
               </button>`}
        </div>
      </section>`;
  }

  function wire() {
    delegate(mount, 'click', '[data-copy-code]', async (_event, node) => {
      const code = node.closest('.code-block')?.querySelector('code')?.textContent || '';
      try {
        await navigator.clipboard.writeText(code);
        toast('Code copied.', 'success');
      } catch {
        toast('Your browser would not let the page copy that. Select it and copy by hand.', 'warning');
      }
    });

    delegate(mount, 'click', '[data-bookmark]', async (_event, node) => {
      try {
        const result = await api.learn.toggleBookmark('lesson', lesson.id);
        lesson.bookmarked = result.bookmarked;
        node.classList.toggle('active', result.bookmarked);
        toast(result.bookmarked ? 'Lesson bookmarked.' : 'Bookmark removed.', 'success');
      } catch (err) {
        toast(err.message, 'error');
      }
    });

    delegate(mount, 'click', '[data-complete]', async (event) => {
      await withBusy(event.target.closest('button'), async () => {
        try {
          const result = await api.learn.completeLesson(lesson.id);
          lesson.myStatus = 'completed';
          if (result.xpAwarded) toast(`Lesson complete. +${result.xpAwarded} XP`, 'success', 'Well done');
          render();
        } catch (err) {
          toast(err.message, 'error');
        }
      }, 'Saving...');
    });

    delegate(mount, 'click', '[data-reopen]', async () => {
      const sure = await confirmDialog({
        title: 'Mark as not finished?',
        message: 'The XP you already earned stays with you. The lesson will show as unfinished again.',
        confirmText: 'Mark as unfinished'
      });
      if (!sure) return;
      try {
        await api.learn.reopenLesson(lesson.id);
        lesson.myStatus = 'opened';
        render();
      } catch (err) {
        toast(err.message, 'error');
      }
    });

    delegate(mount, 'click', '[data-save-challenge]', async (event, node) => {
      const section = node.closest('[data-challenge]');
      const id = Number(section.dataset.challenge);
      const solution = section.querySelector('[data-solution]').value;
      await withBusy(node, async () => {
        try {
          const result = await api.learn.completeChallenge(id, solution);
          const index = lesson.challenges.findIndex((c) => c.id === id);
          if (index >= 0) lesson.challenges[index] = result.challenge;
          if (result.xpAwarded) toast(`Challenge complete. +${result.xpAwarded} XP`, 'success', 'Nice work');
          else toast('Solution saved.', 'success');
          render();
        } catch (err) {
          toast(err.message, 'error');
        }
      }, 'Saving...');
    });

    delegate(mount, 'click', '[data-reset-challenge]', async (_event, node) => {
      const id = Number(node.closest('[data-challenge]').dataset.challenge);
      try {
        await api.learn.resetChallenge(id);
        const index = lesson.challenges.findIndex((c) => c.id === id);
        if (index >= 0) { lesson.challenges[index].completed = false; lesson.challenges[index].solution = ''; }
        render();
      } catch (err) {
        toast(err.message, 'error');
      }
    });
  }
}
