// ==========================================================
// Coding Hub - the dashboard (specification section 14).
// Continue learning, progress, achievements, recent activity
// and unread messages.
// ==========================================================
import { esc, timeAgo, plural } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { api } from '../lib/api.js';
import { store } from '../lib/store.js';
import { setPageTitle } from '../components/shell.js';
import { avatar, emptyState, loadingBlock } from '../components/common.js';
import { progressBar, statTile, subjectCard } from '../components/learn.js';

export default async function dashboard({ mount }) {
  setPageTitle('Dashboard');
  mount.innerHTML = `<div class="page page-wide">${loadingBlock(3)}</div>`;

  let data;
  try {
    data = await api.dashboard();
  } catch (err) {
    mount.innerHTML = `<div class="page page-narrow">${emptyState({
      iconName: 'warning', title: 'The dashboard could not load', text: err.message
    })}</div>`;
    return;
  }

  const { stats, continueLesson: lesson } = data;
  const overall = stats.lessonsAvailable
    ? Math.round((stats.lessonsCompleted / stats.lessonsAvailable) * 100) : 0;

  mount.innerHTML = `
    <div class="page page-wide">
      <section class="hero-card">
        <div class="hero-glow"></div>
        <div class="hero-content">
          <div class="hero-main">
            <h1>Welcome back, <span class="nowrap">${esc(store.user.displayName.split(' ')[0])}</span></h1>
            <p class="muted">${esc(data.tagline || 'Learn to code, one topic at a time.')}</p>
            <div class="row" style="margin-top:.9rem;flex-wrap:wrap">
              <a class="btn btn-primary" href="#/subjects">${icon('book', 16)} Subjects</a>
              <a class="btn" href="#/practice">${icon('target', 16)} Practice</a>
              <a class="btn" href="#/challenges">${icon('zap', 16)} Challenges</a>
            </div>
          </div>
          <div class="hero-level">
            ${avatar(store.user, 'lg')}
            <div style="flex:1;min-width:0">
              <div class="row row-tight" style="justify-content:space-between">
                <span class="bold">Level ${store.user.level} &middot; ${esc(store.user.levelTitle || '')}</span>
                <span class="tiny faint">${store.user.xpIntoLevel}/${store.user.xpForNextLevel} XP</span>
              </div>
              <div class="level-bar" style="margin:.35rem 0"><span style="width:${store.user.levelProgress}%"></span></div>
              <div class="tiny faint">${store.user.xp} XP in total${data.streakDays ? ` &middot; ${plural(data.streakDays, 'day')} streak` : ''}</div>
            </div>
          </div>
        </div>
      </section>

      ${lesson ? `
        <a class="card card-hover continue-card" href="#/lesson/${lesson.id}" style="margin-top:1.25rem">
          <span class="card-title-icon">${icon('play', 18)}</span>
          <div>
            <div class="small faint">${lesson.myStatus === 'opened' ? 'Continue learning' : 'Start here'}</div>
            <strong>${esc(lesson.title)}</strong>
            <div class="small muted">${esc(lesson.subjectName)} &middot; ${esc(lesson.topicName)} &middot; ${lesson.minutes} min</div>
          </div>
          <span class="faint">${icon('arrowRight', 18)}</span>
        </a>` : ''}

      <div class="grid grid-4" style="margin:1.25rem 0">
        ${statTile({ label: 'Lessons completed', value: `${stats.lessonsCompleted}/${stats.lessonsAvailable}`, iconName: 'book' })}
        ${statTile({ label: 'Questions answered', value: stats.questionsAnswered, iconName: 'target' })}
        ${statTile({ label: 'Correct answers', value: stats.correctAnswers, iconName: 'check', tone: 'success' })}
        ${statTile({ label: 'Accuracy', value: `${stats.accuracy}%`, iconName: 'chart', tone: stats.accuracy >= 70 ? 'success' : '' })}
        ${statTile({ label: 'Challenges', value: stats.challengesCompleted, iconName: 'zap' })}
        ${statTile({ label: 'Correct streak', value: stats.currentStreak, iconName: 'fire', tone: stats.currentStreak >= 5 ? 'warning' : '' })}
        ${statTile({ label: 'Unread messages', value: data.unreadMessages, iconName: 'message', link: '#/messages', tone: data.unreadMessages ? 'accent' : '' })}
        ${statTile({ label: 'Badges', value: data.badges.length, iconName: 'award', link: '#/achievements' })}
      </div>

      <div class="card">
        <div class="card-header">
          <span class="card-title-icon">${icon('chart', 17)}</span>
          <h3>Your progress</h3>
          <a class="btn btn-sm btn-ghost" href="#/progress">Details</a>
        </div>
        ${progressBar(overall, `${stats.lessonsCompleted} of ${stats.lessonsAvailable} published lessons completed`)}
      </div>

      ${data.latestAnnouncement ? `
        <a class="card card-hover" href="#/announcements/${data.latestAnnouncement.id}" style="margin-top:1.25rem;display:block;color:inherit">
          <div class="card-header">
            <span class="card-title-icon" style="background:var(--info-soft);color:var(--info)">${icon('megaphone', 17)}</span>
            <h3>${esc(data.latestAnnouncement.title)}</h3>
            ${data.latestAnnouncement.priority !== 'normal'
    ? `<span class="badge badge-${data.latestAnnouncement.priority === 'urgent' ? 'danger' : 'warning'}">${esc(data.latestAnnouncement.priority)}</span>` : ''}
          </div>
          <p class="muted small" style="margin:0">${esc(data.latestAnnouncement.message.slice(0, 200))}</p>
        </a>` : ''}

      <div class="grid grid-2" style="margin-top:1.25rem">
        <div class="card">
          <div class="card-header">
            <span class="card-title-icon">${icon('message', 17)}</span>
            <h3>Messages</h3>
            <a class="btn btn-sm btn-ghost" href="#/messages">Open</a>
          </div>
          ${data.conversations.length ? `
            <div class="list">
              ${data.conversations.map((c) => `
                <a class="list-item" href="#/messages/${c.id}">
                  ${avatar(c.other, 'sm', true)}
                  <div class="meta">
                    <div class="title">${esc(c.other?.displayName || 'Unknown')}</div>
                    <div class="sub">${esc(c.preview)} &middot; ${timeAgo(c.at)}</div>
                  </div>
                  ${c.unread ? `<span class="badge badge-accent">${c.unread}</span>` : ''}
                </a>`).join('')}
            </div>`
    : '<p class="small faint center">No conversations yet. Open somebody\'s profile and press Message.</p>'}
        </div>

        <div class="card">
          <div class="card-header">
            <span class="card-title-icon">${icon('clock', 17)}</span>
            <h3>Recent activity</h3>
            <a class="btn btn-sm btn-ghost" href="#/history">History</a>
          </div>
          ${data.recent.length ? `
            <div class="list">
              ${data.recent.map((a) => `
                <a class="list-item" href="${esc(a.link)}">
                  <span class="lesson-status ${a.kind === 'lesson_opened' ? '' : 'done'}">
                    ${icon(a.kind === 'challenge_completed' ? 'zap' : (a.kind === 'lesson_completed' ? 'check' : 'play'), 14)}
                  </span>
                  <div class="meta">
                    <div class="title">${esc(a.title)}</div>
                    <div class="sub">${esc(a.subtitle)} &middot; ${timeAgo(a.at)}</div>
                  </div>
                </a>`).join('')}
            </div>`
    : '<p class="small faint center">Open a lesson and it will show up here.</p>'}
        </div>
      </div>

      ${data.badges.length ? `
        <div class="card" style="margin-top:1.25rem">
          <div class="card-header">
            <span class="card-title-icon">${icon('award', 17)}</span>
            <h3>Achievements</h3>
            <a class="btn btn-sm btn-ghost" href="#/achievements">All badges</a>
          </div>
          <div class="badge-grid">
            ${data.badges.map((b) => `
              <div class="badge-tile earned">
                <span class="badge-mark">${icon(b.icon || 'award', 20)}</span>
                <strong>${esc(b.name)}</strong>
                <span class="small faint">${timeAgo(b.awarded_at)}</span>
              </div>`).join('')}
          </div>
        </div>` : ''}

      <div style="margin-top:1.5rem">
        <div class="row" style="justify-content:space-between;align-items:baseline;margin-bottom:.8rem">
          <h2 style="margin:0">Subjects</h2>
          <a class="btn btn-sm btn-ghost" href="#/subjects">See all</a>
        </div>
        <div class="subject-grid">${data.subjects.map(subjectCard).join('')}</div>
      </div>
    </div>`;
}
