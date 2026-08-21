// ==========================================================
// Coding Hub - the practice screen.
// Pick filters, work through a set of questions, get the answer
// and an explanation the moment each one is submitted.
// ==========================================================
import { esc, delegate } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { api } from '../lib/api.js';
import { setPageTitle } from '../components/shell.js';
import { emptyState } from '../components/common.js';
import { toast } from '../lib/ui.js';
import { questionCard, TYPE_LABELS, DIFFICULTY_LABELS } from '../components/learn.js';

export default async function practiceView({ mount, query }) {
  setPageTitle('Practice');

  const filters = {
    subject: query.subject || '',
    topic: query.topic || '',
    difficulty: query.difficulty || '',
    type: query.type || '',
    count: query.count || '10',
    unseen: query.unseen === '1'
  };

  // What the learner has answered in this session, keyed by question id.
  const results = new Map();
  let questions = [];
  let available = 0;
  let options = { subjects: [], difficulties: [], types: [] };

  mount.innerHTML = '<div class="page page-narrow"><div class="spinner spinner-center"></div></div>';
  await load();

  async function load() {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value && value !== false) search.set(key, value === true ? '1' : value);
    }
    try {
      const data = await api.learn.practice(`?${search.toString()}`);
      questions = data.questions;
      available = data.available;
      options = data.filters;
      results.clear();
      render();
    } catch (err) {
      mount.innerHTML = `<div class="page page-narrow"><div class="card"><p style="color:var(--danger)">${esc(err.message)}</p></div></div>`;
    }
  }

  function scoreLine() {
    const answered = results.size;
    const correct = [...results.values()].filter((r) => r.correct).length;
    if (!answered) return `${questions.length} questions in this set.`;
    return `${correct} of ${answered} correct (${Math.round((correct / answered) * 100)}%)`;
  }

  function render() {
    mount.innerHTML = `
      <div class="page page-narrow">
        <header class="page-head">
          <div>
            <h1>Practice</h1>
            <p class="muted">Answer a question and you will see straight away whether you were right, and why.</p>
          </div>
          <a class="btn btn-ghost" href="#/subjects">${icon('book', 16)} Subjects</a>
        </header>

        <form class="card practice-filters" id="filters">
          <div class="field">
            <label for="f-subject">Subject</label>
            <select class="select" id="f-subject" name="subject">
              <option value="">Every subject</option>
              ${options.subjects.map((s) => `
                <option value="${esc(s.slug)}" ${filters.subject === s.slug ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label for="f-difficulty">Difficulty</label>
            <select class="select" id="f-difficulty" name="difficulty">
              <option value="">Any difficulty</option>
              ${options.difficulties.map((d) => `
                <option value="${d}" ${filters.difficulty === d ? 'selected' : ''}>${esc(DIFFICULTY_LABELS[d] || d)}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label for="f-type">Question type</label>
            <select class="select" id="f-type" name="type">
              <option value="">Every type</option>
              ${options.types.map((t) => `
                <option value="${t}" ${filters.type === t ? 'selected' : ''}>${esc(TYPE_LABELS[t] || t)}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label for="f-count">How many</label>
            <select class="select" id="f-count" name="count">
              ${[5, 10, 15, 20, 30].map((n) => `
                <option value="${n}" ${String(filters.count) === String(n) ? 'selected' : ''}>${n} questions</option>`).join('')}
            </select>
          </div>
          <label class="check">
            <input type="checkbox" name="unseen" ${filters.unseen ? 'checked' : ''}>
            <span>Only questions I have never seen</span>
          </label>
          <button type="submit" class="btn btn-primary">${icon('refresh', 15)} New set</button>
        </form>

        ${questions.length ? `
          <div class="practice-score card">
            <strong>${esc(scoreLine())}</strong>
            <span class="small faint">${available} questions match these filters</span>
          </div>

          <div class="question-stack">
            ${questions.map((q, i) => questionCard(q, i, results.get(q.id) || null)).join('')}
          </div>

          <div class="center" style="margin:1.5rem 0">
            <button type="button" class="btn btn-primary" data-again>${icon('refresh', 15)} Another set</button>
          </div>
        ` : emptyState({
    iconName: 'target',
    title: 'No questions match',
    text: filters.unseen
      ? 'You have already answered every question that matches. Try turning off the "never seen" filter.'
      : 'Try a different subject or difficulty.'
  })}
      </div>`;

    wire();
  }

  function wire() {
    const form = mount.querySelector('#filters');
    form?.addEventListener('submit', (event) => {
      event.preventDefault();
      const data = new FormData(form);
      filters.subject = data.get('subject') || '';
      filters.difficulty = data.get('difficulty') || '';
      filters.type = data.get('type') || '';
      filters.count = data.get('count') || '10';
      filters.unseen = data.get('unseen') === 'on';
      filters.topic = '';   // a manual filter change clears the topic link
      load();
    });

    delegate(mount, 'click', '[data-again]', () => load());

    delegate(mount, 'click', '[data-option]', (_event, node) => {
      const card = node.closest('[data-question]');
      submit(Number(card.dataset.question), node.dataset.option);
    });

    delegate(mount, 'click', '[data-submit-typed]', (_event, node) => {
      const card = node.closest('[data-question]');
      const value = card.querySelector('[data-typed]').value.trim();
      if (!value) { toast('Type an answer first.', 'warning'); return; }
      submit(Number(card.dataset.question), value);
    });

    delegate(mount, 'keydown', '[data-typed]', (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      const card = event.target.closest('[data-question]');
      const value = event.target.value.trim();
      if (value) submit(Number(card.dataset.question), value);
    });

    delegate(mount, 'click', '[data-bookmark]', async (_event, node) => {
      const id = Number(node.closest('[data-question]').dataset.question);
      try {
        const result = await api.learn.toggleBookmark('question', id);
        node.classList.toggle('active', result.bookmarked);
        const question = questions.find((q) => q.id === id);
        if (question) question.bookmarked = result.bookmarked;
      } catch (err) {
        toast(err.message, 'error');
      }
    });
  }

  /** Sends the answer to the server, which is the only thing that marks it. */
  async function submit(questionId, answer) {
    if (results.has(questionId)) return;
    const question = questions.find((q) => q.id === questionId);
    if (!question) return;

    try {
      const result = await api.learn.answer(questionId, answer);
      results.set(questionId, { ...result, submitted: answer });

      const index = questions.indexOf(question);
      const card = mount.querySelector(`[data-question="${questionId}"]`);
      if (card) {
        card.outerHTML = questionCard(question, index, results.get(questionId));
      }
      const score = mount.querySelector('.practice-score strong');
      if (score) score.textContent = scoreLine();

      if (result.correct && result.pointsAwarded) toast(`Correct. +${result.pointsAwarded} XP`, 'success');
    } catch (err) {
      toast(err.message, 'error');
    }
  }
}
