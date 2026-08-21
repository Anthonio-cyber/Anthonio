// ==========================================================
// Coding Hub - pieces shared by the learning screens.
// Lesson blocks, question cards, progress bars and badges.
// ==========================================================
import { esc } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { emptyState } from './common.js';

export const DIFFICULTY_LABELS = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced'
};

export const TYPE_LABELS = {
  multiple_choice: 'Multiple choice',
  true_false: 'True or false',
  fill_blank: 'Fill in the blank',
  code: 'Code',
  output: 'What is the output?',
  debug: 'Find the bug',
  scenario: 'Scenario'
};

/** Question types where the learner picks one of the listed options. */
const CHOICE_TYPES = new Set(['multiple_choice', 'output', 'debug', 'scenario']);
export const isChoiceQuestion = (type) => CHOICE_TYPES.has(type);

export function difficultyBadge(difficulty) {
  const tone = { beginner: 'success', intermediate: 'warning', advanced: 'danger' }[difficulty] || '';
  return `<span class="badge ${tone ? `badge-${tone}` : ''}">${esc(DIFFICULTY_LABELS[difficulty] || difficulty)}</span>`;
}

export function progressBar(percent, label = '') {
  const value = Math.max(0, Math.min(100, Number(percent) || 0));
  return `
    <div class="learn-progress" role="progressbar" aria-valuenow="${value}" aria-valuemin="0" aria-valuemax="100">
      <div class="learn-progress-track"><div class="learn-progress-fill" style="width:${value}%"></div></div>
      ${label ? `<span class="learn-progress-label">${esc(label)}</span>` : ''}
    </div>`;
}

export function statTile({ label, value, iconName = 'chart', tone = '', link = '' }) {
  const inner = `
    <div class="stat-icon" ${tone ? `style="background:var(--${tone}-soft);color:var(--${tone})"` : ''}>${icon(iconName, 19)}</div>
    <div class="stat-body"><div class="stat-value">${esc(String(value))}</div><div class="stat-label">${esc(label)}</div></div>`;
  return link
    ? `<a class="stat card-hover" href="${link}" style="color:inherit;text-decoration:none">${inner}</a>`
    : `<div class="stat">${inner}</div>`;
}

export function subjectCard(subject) {
  return `
    <a class="subject-card card-hover" href="#/subject/${esc(subject.slug)}" data-colour="${esc(subject.colour)}">
      <span class="subject-mark">${icon(subject.icon || 'code', 22)}</span>
      <div class="subject-body">
        <h3>${esc(subject.name)}${subject.published ? '' : ' <span class="badge badge-warning">Draft</span>'}</h3>
        <p class="muted small">${esc(subject.description)}</p>
        <div class="subject-meta small faint">
          ${subject.topicCount} topics &middot; ${subject.lessonCount} lessons &middot; ${subject.questionCount} questions
        </div>
        ${progressBar(subject.percentComplete, `${subject.lessonsCompleted} of ${subject.lessonCount} lessons done`)}
      </div>
    </a>`;
}

// ---------------------------------------------------------------------------
// Lesson blocks
// ---------------------------------------------------------------------------
/** Renders the blocks an administrator wrote in the lesson editor. */
export function renderBlocks(blocks) {
  if (!Array.isArray(blocks) || !blocks.length) {
    return `<p class="muted">This lesson has no content yet.</p>`;
  }
  return blocks.map(renderBlock).join('');
}

function renderBlock(block) {
  switch (block.type) {
    case 'heading':
      return `<h3 class="lesson-heading">${esc(block.text)}</h3>`;

    case 'paragraph':
      return `<p class="lesson-paragraph">${inlineText(block.text)}</p>`;

    case 'code':
      return `
        <div class="code-block">
          <div class="code-block-bar">
            <span>${esc(block.language || 'code')}</span>
            <button type="button" class="btn btn-xs btn-ghost" data-copy-code>${icon('link', 12)} Copy</button>
          </div>
          <pre><code>${esc(block.code || '')}</code></pre>
        </div>`;

    case 'list': {
      const tag = block.ordered ? 'ol' : 'ul';
      return `<${tag} class="lesson-list">${(block.items || []).map((i) => `<li>${inlineText(i)}</li>`).join('')}</${tag}>`;
    }

    case 'note':
    case 'info':
    case 'warning': {
      const tone = { note: 'accent', info: 'info', warning: 'warning' }[block.type];
      const iconName = { note: 'info', info: 'info', warning: 'warning' }[block.type];
      return `
        <div class="callout callout-${tone}">
          <span class="callout-icon">${icon(iconName, 16)}</span>
          <div>
            ${block.title ? `<strong>${esc(block.title)}</strong>` : ''}
            <p>${inlineText(block.text)}</p>
          </div>
        </div>`;
    }

    case 'example':
      return `
        <div class="callout callout-success">
          <span class="callout-icon">${icon('check', 16)}</span>
          <div>
            <strong>${esc(block.title || 'Example')}</strong>
            <p>${inlineText(block.text)}</p>
          </div>
        </div>`;

    case 'table':
      return `
        <div class="table-scroll">
          <table class="lesson-table">
            ${block.headers?.length ? `<thead><tr>${block.headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead>` : ''}
            <tbody>
              ${(block.rows || []).map((row) => `<tr>${row.map((cell) => `<td>${inlineText(cell)}</td>`).join('')}</tr>`).join('')}
            </tbody>
          </table>
        </div>`;

    case 'image':
      return block.url
        ? `<figure class="lesson-figure"><img src="${esc(block.url)}" alt="${esc(block.text || '')}" loading="lazy">
             ${block.text ? `<figcaption>${esc(block.text)}</figcaption>` : ''}</figure>`
        : '';

    case 'video':
      return block.url
        ? `<figure class="lesson-figure"><video src="${esc(block.url)}" controls></video>
             ${block.text ? `<figcaption>${esc(block.text)}</figcaption>` : ''}</figure>`
        : '';

    case 'link':
      return block.url
        ? `<p class="lesson-paragraph"><a href="${esc(block.url)}" rel="noopener">${esc(block.text || block.url)}</a></p>`
        : '';

    default:
      return '';
  }
}

/**
 * Escapes the text first, then allows a very small amount of formatting:
 * `code`, *emphasis* and internal #/ links. Nothing else can get through.
 */
function inlineText(text) {
  return esc(text || '')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
    .replace(/(#\/[\w/?=&.-]+)/g, '<a href="$1">$1</a>')
    .replace(/\n/g, '<br>');
}

// ---------------------------------------------------------------------------
// Questions
// ---------------------------------------------------------------------------
/**
 * One question, ready to answer. `result` is null until the learner has
 * answered - the correct answer only ever arrives from the server after that.
 */
export function questionCard(question, index, result = null) {
  const answered = !!result;
  const choice = isChoiceQuestion(question.type);

  const body = choice
    ? `<div class="option-list" role="group">
        ${question.options.map((option, i) => {
    const isCorrect = answered && String(result.answer) === String(i);
    const isChosen = answered && String(result.submitted) === String(i);
    const state = isCorrect ? 'correct' : (isChosen ? 'wrong' : '');
    return `
            <button type="button" class="option ${state}" data-option="${i}" ${answered ? 'disabled' : ''}>
              <span class="option-key">${String.fromCharCode(65 + i)}</span>
              <span class="option-text">${esc(option)}</span>
              ${isCorrect ? `<span class="option-mark">${icon('check', 15)}</span>` : ''}
              ${isChosen && !isCorrect ? `<span class="option-mark">${icon('close', 15)}</span>` : ''}
            </button>`;
  }).join('')}
      </div>`
    : question.type === 'true_false'
      ? `<div class="option-list option-list-row">
          ${['true', 'false'].map((value) => {
    const isCorrect = answered && String(result.answer).toLowerCase() === value;
    const isChosen = answered && String(result.submitted).toLowerCase() === value;
    const state = isCorrect ? 'correct' : (isChosen ? 'wrong' : '');
    return `<button type="button" class="option ${state}" data-option="${value}" ${answered ? 'disabled' : ''}>
              <span class="option-text">${value === 'true' ? 'True' : 'False'}</span>
            </button>`;
  }).join('')}
        </div>`
      : `<div class="field">
          <input class="input" data-typed placeholder="Type your answer" value="${esc(result?.submitted || '')}" ${answered ? 'disabled' : ''}>
          ${answered ? '' : '<button type="button" class="btn btn-primary" data-submit-typed>Check answer</button>'}
        </div>`;

  return `
    <article class="question-card ${answered ? (result.correct ? 'is-correct' : 'is-wrong') : ''}" data-question="${question.id}">
      <header class="question-head">
        <span class="question-number">${index === null ? '' : `Q${index + 1}`}</span>
        <div class="question-tags">
          ${difficultyBadge(question.difficulty)}
          <span class="badge">${esc(TYPE_LABELS[question.type] || question.type)}</span>
          <span class="badge badge-accent">${question.points} pts</span>
        </div>
        <button type="button" class="icon-button ${question.bookmarked ? 'active' : ''}" data-bookmark title="Bookmark this question">
          ${icon('bookmark', 16)}
        </button>
      </header>

      <p class="question-prompt">${inlineText(question.prompt)}</p>
      ${question.code ? `<div class="code-block"><pre><code>${esc(question.code)}</code></pre></div>` : ''}
      ${body}

      ${answered ? `
        <div class="answer-feedback ${result.correct ? 'correct' : 'wrong'}">
          <strong>${result.correct ? 'Correct' : 'Not quite'}</strong>
          ${!result.correct && !choice && question.type !== 'true_false'
    ? `<p class="small">The answer is <code>${esc(result.answer)}</code>.</p>` : ''}
          ${result.explanation ? `<p>${inlineText(result.explanation)}</p>` : ''}
          ${result.pointsAwarded ? `<p class="small faint">+${result.pointsAwarded} XP</p>` : ''}
        </div>` : ''}

      <footer class="question-foot small faint">
        ${esc(question.subjectName || '')}${question.topicName ? ` &middot; ${esc(question.topicName)}` : ''}
      </footer>
    </article>`;
}

export function noContent(title, text, action = '') {
  return emptyState({ iconName: 'book', title, text, action });
}
