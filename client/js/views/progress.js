// ==========================================================
// Coding Hub - "My progress": how far through each subject the
// learner is, their accuracy, and the topics they find hardest.
// ==========================================================
import { esc } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { api } from '../lib/api.js';
import { store } from '../lib/store.js';
import { setPageTitle } from '../components/shell.js';
import { progressBar, statTile, difficultyBadge, DIFFICULTY_LABELS } from '../components/learn.js';

export default async function progressView({ mount }) {
  setPageTitle('My progress');
  mount.innerHTML = '<div class="page page-wide"><div class="spinner spinner-center"></div></div>';

  let data;
  try {
    data = await api.learn.progress();
  } catch (err) {
    mount.innerHTML = `<div class="page page-narrow"><div class="card"><p style="color:var(--danger)">${esc(err.message)}</p></div></div>`;
    return;
  }

  const { stats, breakdown, byDifficulty, weakestTopics, continueLesson } = data;
  const overall = stats.lessonsAvailable
    ? Math.round((stats.lessonsCompleted / stats.lessonsAvailable) * 100) : 0;

  mount.innerHTML = `
    <div class="page page-wide">
      <header class="page-head">
        <div>
          <h1>My progress</h1>
          <p class="muted">Everything you have learned in the Coding Hub so far.</p>
        </div>
        <div class="row">
          <a class="btn btn-ghost" href="#/history">${icon('clock', 16)} History</a>
          <a class="btn btn-ghost" href="#/achievements">${icon('award', 16)} Badges</a>
        </div>
      </header>

      ${continueLesson ? `
        <a class="card card-hover continue-card" href="#/lesson/${continueLesson.id}">
          <span class="card-title-icon">${icon('play', 18)}</span>
          <div>
            <div class="small faint">Continue learning</div>
            <strong>${esc(continueLesson.title)}</strong>
            <div class="small muted">${esc(continueLesson.subjectName)} &middot; ${esc(continueLesson.topicName)}</div>
          </div>
          <span class="faint">${icon('arrowRight', 18)}</span>
        </a>` : ''}

      <div class="grid grid-4" style="margin:1.25rem 0">
        ${statTile({ label: 'Lessons completed', value: stats.lessonsCompleted, iconName: 'book' })}
        ${statTile({ label: 'Questions answered', value: stats.questionsAnswered, iconName: 'target' })}
        ${statTile({ label: 'Correct answers', value: stats.correctAnswers, iconName: 'check', tone: 'success' })}
        ${statTile({ label: 'Accuracy', value: `${stats.accuracy}%`, iconName: 'chart', tone: stats.accuracy >= 70 ? 'success' : (stats.accuracy ? 'warning' : '') })}
        ${statTile({ label: 'Challenges done', value: stats.challengesCompleted, iconName: 'zap' })}
        ${statTile({ label: 'Correct streak', value: stats.currentStreak, iconName: 'fire', tone: stats.currentStreak >= 5 ? 'warning' : '' })}
        ${statTile({ label: 'XP', value: store.user.xp, iconName: 'star', tone: 'accent' })}
        ${statTile({ label: 'Level', value: store.user.level, iconName: 'trophy', tone: 'accent' })}
      </div>

      <div class="card">
        <div class="card-header">
          <span class="card-title-icon">${icon('chart', 17)}</span>
          <h3>Overall course progress</h3>
        </div>
        ${progressBar(overall, `${stats.lessonsCompleted} of ${stats.lessonsAvailable} published lessons completed`)}
      </div>

      <div class="card" style="margin-top:1.25rem">
        <div class="card-header">
          <span class="card-title-icon">${icon('book', 17)}</span>
          <h3>By subject</h3>
        </div>
        ${breakdown.length ? `
          <div class="list">
            ${breakdown.map((s) => `
              <a class="list-item" href="#/subject/${esc(s.slug)}">
                <div class="meta">
                  <div class="title">${esc(s.name)}</div>
                  <div class="sub">${s.completed}/${s.lessons} lessons &middot; ${s.answered} questions &middot; ${s.accuracy}% accuracy</div>
                  ${progressBar(s.percentComplete)}
                </div>
                <span class="badge">${s.percentComplete}%</span>
              </a>`).join('')}
          </div>` : '<p class="small faint center">No subjects yet.</p>'}
      </div>

      <div class="grid grid-2" style="margin-top:1.25rem">
        <div class="card">
          <div class="card-header">
            <span class="card-title-icon">${icon('target', 17)}</span>
            <h3>By difficulty</h3>
          </div>
          ${byDifficulty.length ? `
            <div class="list">
              ${byDifficulty.map((d) => `
                <div class="list-item">
                  <div class="meta">
                    <div class="title">${difficultyBadge(d.difficulty)} ${esc(DIFFICULTY_LABELS[d.difficulty] || d.difficulty)}</div>
                    <div class="sub">${d.correct} correct out of ${d.answered}</div>
                  </div>
                  <span class="badge ${d.accuracy >= 70 ? 'badge-success' : ''}">${d.accuracy}%</span>
                </div>`).join('')}
            </div>` : '<p class="small faint center">Answer some questions to see this.</p>'}
        </div>

        <div class="card">
          <div class="card-header">
            <span class="card-title-icon" style="background:var(--warning-soft);color:var(--warning)">${icon('warning', 17)}</span>
            <h3>Worth another look</h3>
          </div>
          ${weakestTopics.length ? `
            <div class="list">
              ${weakestTopics.map((t) => `
                <a class="list-item" href="#/topic/${t.topicId}">
                  <div class="meta">
                    <div class="title">${esc(t.name)}</div>
                    <div class="sub">${esc(t.subjectName)} &middot; ${t.answered} answered</div>
                  </div>
                  <span class="badge ${t.accuracy < 50 ? 'badge-danger' : 'badge-warning'}">${t.accuracy}%</span>
                </a>`).join('')}
            </div>`
    : '<p class="small faint center">Answer at least three questions in a topic and it will show up here if you are struggling.</p>'}
        </div>
      </div>
    </div>`;
}
