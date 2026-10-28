// ==========================================================
// Practice: pick a subject, answer questions, see why.
// ==========================================================
import { esc, plural } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { api } from '../lib/api.js';
import { store, can } from '../lib/store.js';
import { setPageTitle } from '../components/shell.js';
import { emptyState, loadingBlock } from '../components/common.js';
import { toast, modal } from '../lib/ui.js';

export default async function practice({ mount, query }) {
  setPageTitle('Practice');

  if (query.subject) return runSession(mount, Number(query.subject), query.mode || 'all');
  return showSubjects(mount);
}

// ---------------------------------------------------------------------------
// Choosing a subject
// ---------------------------------------------------------------------------
async function showSubjects(mount) {
  mount.innerHTML = `<div class="page page-wide">${loadingBlock(2)}</div>`;

  let data;
  try {
    data = await api.practice.subjects();
  } catch (err) {
    mount.innerHTML = `<div class="page page-narrow">${emptyState({
      iconName: 'warning', title: 'Practice could not load', text: err.message
    })}</div>`;
    return {};
  }

  mount.innerHTML = `
    <div class="page page-wide">
      <section class="hero-card">
        <div class="hero-glow"></div>
        <div class="hero-content">
          <div class="hero-main">
            <h1>Practice</h1>
            <p class="muted">Answer questions by subject, see why each answer is right, and earn XP for every new one you get correct.</p>
          </div>
          <div class="grid grid-3" style="min-width:min(100%,320px)">
            <div class="stat"><div class="stat-body">
              <div class="stat-value">${data.overall.answered}</div><div class="stat-label">Answered</div></div></div>
            <div class="stat"><div class="stat-body">
              <div class="stat-value">${data.overall.correct}</div><div class="stat-label">Correct</div></div></div>
            <div class="stat"><div class="stat-body">
              <div class="stat-value">${data.overall.accuracy}%</div><div class="stat-label">Accuracy</div></div></div>
          </div>
        </div>
      </section>

      ${data.canManage ? `
        <div class="row" style="margin-top:1rem">
          <button class="btn btn-sm btn-primary" id="add-question">${icon('plus', 14)} Add a question</button>
          <button class="btn btn-sm" id="add-subject">${icon('book', 14)} Add a subject</button>
          <button class="btn btn-sm" id="manage-questions">${icon('edit', 14)} Manage questions</button>
        </div>` : ''}

      <div class="section-title" style="margin-top:1.5rem">${icon('book', 14)} Subjects</div>
      <div class="grid grid-3">
        ${data.subjects.map(subjectCard).join('')}
      </div>
    </div>`;

  mount.querySelector('#add-question')?.addEventListener('click', () => openQuestionForm(data.subjects, mount));
  mount.querySelector('#add-subject')?.addEventListener('click', () => openSubjectForm(mount));
  mount.querySelector('#manage-questions')?.addEventListener('click', () => openQuestionManager(data.subjects, mount));
  return {};
}

function subjectCard(subject) {
  const p = subject.progress;
  const done = p.total ? Math.round((p.attempted / p.total) * 100) : 0;
  return `
    <article class="card card-hover">
      <div class="row" style="align-items:flex-start;gap:.7rem">
        <span class="card-title-icon">${icon(subject.icon || 'book', 18)}</span>
        <div style="flex:1;min-width:0">
          <h3 style="margin:0">${esc(subject.name)}</h3>
          <div class="tiny faint">${plural(p.total, 'question')}</div>
        </div>
      </div>
      <p class="small muted clamp-2" style="margin:.6rem 0 .7rem">${esc(subject.description || '')}</p>

      <div class="row row-tight tiny faint" style="justify-content:space-between">
        <span>${p.attempted} of ${p.total} tried</span>
        <span>${p.correct} correct</span>
      </div>
      <div class="level-bar" style="margin:.35rem 0 .9rem"><span style="width:${done}%"></span></div>

      <div class="row row-tight">
        <a class="btn btn-primary btn-sm" href="#/practice?subject=${subject.id}">${icon('play', 14)} Practise</a>
        ${p.attempted < p.total ? `<a class="btn btn-sm" href="#/practice?subject=${subject.id}&mode=new">New only</a>` : ''}
        ${p.attempted > p.correct ? `<a class="btn btn-sm" href="#/practice?subject=${subject.id}&mode=wrong">My mistakes</a>` : ''}
      </div>
    </article>`;
}

// ---------------------------------------------------------------------------
// A practice session
// ---------------------------------------------------------------------------
async function runSession(mount, subjectId, mode) {
  mount.innerHTML = `<div class="page page-narrow">${loadingBlock(2)}</div>`;

  let data;
  try {
    data = await api.practice.questions(subjectId, `?limit=10${mode !== 'all' ? `&mode=${mode}` : ''}`);
  } catch (err) {
    mount.innerHTML = `<div class="page page-narrow">${emptyState({
      iconName: 'warning', title: 'Could not start', text: err.message,
      action: '<a class="btn btn-primary" href="#/practice">Back to subjects</a>'
    })}</div>`;
    return {};
  }

  if (!data.questions.length) {
    mount.innerHTML = `<div class="page page-narrow">${emptyState({
      iconName: 'check', title: 'No questions here yet',
      text: 'A teacher can add some from the Practice page.',
      action: '<a class="btn btn-primary" href="#/practice">Back to subjects</a>'
    })}</div>`;
    return {};
  }

  const state = { index: 0, right: 0, wrong: 0, xp: 0, answered: false };

  mount.innerHTML = `
    <div class="page page-narrow">
      <div class="row" style="justify-content:space-between;margin-bottom:.9rem">
        <a class="btn btn-sm btn-ghost" href="#/practice">${icon('arrowLeft', 14)} Subjects</a>
        <span class="badge badge-accent" id="p-subject">${esc(data.subject.name)}</span>
      </div>

      ${data.fellBack && mode !== 'all' ? `
        <div class="alert" style="margin-bottom:1rem">${icon('info', 16)}
          <div>Nothing left in that list, so here are questions from the whole subject instead.</div>
        </div>` : ''}

      <div class="quiz-timer" style="margin-bottom:1rem"><span id="p-progress" style="width:0%"></span></div>

      <div class="row row-tight tiny faint" style="justify-content:space-between;margin-bottom:.8rem">
        <span id="p-count">Question 1 of ${data.questions.length}</span>
        <span id="p-score">0 correct</span>
      </div>

      <div id="p-area"></div>
    </div>`;

  const area = mount.querySelector('#p-area');
  const countLabel = mount.querySelector('#p-count');
  const scoreLabel = mount.querySelector('#p-score');
  const progressBar = mount.querySelector('#p-progress');

  function show() {
    const q = data.questions[state.index];
    state.answered = false;
    countLabel.textContent = `Question ${state.index + 1} of ${data.questions.length}`;
    scoreLabel.textContent = `${state.right} correct`;
    progressBar.style.width = `${Math.round((state.index / data.questions.length) * 100)}%`;

    area.innerHTML = `
      <div class="quiz-card">
        <div class="row row-tight" style="margin-bottom:.5rem">
          ${q.topic ? `<span class="badge">${esc(q.topic)}</span>` : ''}
          <span class="badge ${q.difficulty === 'hard' ? 'badge-danger' : (q.difficulty === 'easy' ? 'badge-success' : 'badge-warning')}">
            ${esc(q.difficulty)}
          </span>
        </div>
        <h3 class="quiz-question">${esc(q.question)}</h3>
        <div class="quiz-options">
          ${q.options.map((option, i) => `
            <button class="quiz-option" data-choice="${i}">
              <span class="quiz-letter">${'ABCDEF'[i]}</span>
              <span>${esc(option)}</span>
            </button>`).join('')}
        </div>
        <div id="p-feedback"></div>
      </div>`;

    for (const button of area.querySelectorAll('[data-choice]')) {
      button.addEventListener('click', () => choose(Number(button.dataset.choice)));
    }
  }

  async function choose(chosenIndex) {
    if (state.answered) return;
    state.answered = true;
    const q = data.questions[state.index];
    const buttons = [...area.querySelectorAll('[data-choice]')];
    for (const b of buttons) b.disabled = true;

    let result;
    try {
      result = await api.practice.answer(q.id, chosenIndex);
    } catch (err) {
      toast(err.message, 'error');
      for (const b of buttons) b.disabled = false;
      state.answered = false;
      return;
    }

    buttons[result.answerIndex]?.classList.add('right');
    if (!result.correct) buttons[chosenIndex]?.classList.add('wrong');

    if (result.correct) { state.right += 1; state.xp += result.xpAwarded; }
    else state.wrong += 1;
    scoreLabel.textContent = `${state.right} correct`;

    const last = state.index === data.questions.length - 1;
    area.querySelector('#p-feedback').innerHTML = `
      <div class="alert ${result.correct ? 'alert-success' : 'alert-warning'}" style="margin-top:1rem">
        ${icon(result.correct ? 'check' : 'info', 17)}
        <div>
          <strong>${result.correct ? 'Correct' : 'Not quite'}</strong>
          ${result.xpAwarded ? ` <span class="badge badge-accent">+${result.xpAwarded} XP</span>` : ''}
          ${result.correct && result.alreadyAnswered ? ' <span class="tiny faint">(already earned before)</span>' : ''}
          ${result.explanation ? `<div class="small" style="margin-top:.35rem">${esc(result.explanation)}</div>` : ''}
        </div>
      </div>
      <button class="btn btn-primary btn-block" id="p-next" style="margin-top:.9rem">
        ${last ? 'See how you did' : 'Next question'} ${icon('arrowRight', 15)}
      </button>`;

    area.querySelector('#p-next').addEventListener('click', () => {
      if (last) return finish();
      state.index += 1;
      return show();
    });
  }

  function finish() {
    const total = state.right + state.wrong;
    const percent = total ? Math.round((state.right / total) * 100) : 0;
    progressBar.style.width = '100%';
    countLabel.textContent = 'Finished';
    area.innerHTML = `
      <div class="quiz-card center">
        <div class="quiz-final">${state.right} / ${total}</div>
        <p class="muted">
          ${percent >= 80 ? 'Excellent work.' : (percent >= 50 ? 'Good effort - go over the ones you missed.' : 'Keep practising, you will get there.')}
          ${state.xp ? `<br><span class="badge badge-accent">+${state.xp} XP earned</span>` : ''}
        </p>
        <div class="row" style="justify-content:center;margin-top:.9rem">
          <a class="btn btn-primary" href="#/practice?subject=${subjectId}&mode=${mode}">${icon('refresh', 15)} Again</a>
          ${state.wrong ? `<a class="btn" href="#/practice?subject=${subjectId}&mode=wrong">Practise my mistakes</a>` : ''}
          <a class="btn btn-ghost" href="#/practice">Other subjects</a>
        </div>
      </div>`;
  }

  show();
  return {};
}

// ---------------------------------------------------------------------------
// Teachers adding questions
// ---------------------------------------------------------------------------
function openQuestionForm(subjects, mount) {
  modal({
    title: 'Add a practice question',
    size: 'modal-lg',
    body: `
      <div class="field">
        <label>Subject</label>
        <select class="select" data-subject>
          ${subjects.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}
        </select>
      </div>
      <div class="row">
        <div class="field" style="flex:1">
          <label>Topic (optional)</label>
          <input class="input" data-topic placeholder="Fractions">
        </div>
        <div class="field" style="flex:1">
          <label>Difficulty</label>
          <select class="select" data-difficulty>
            <option value="easy">Easy</option>
            <option value="medium" selected>Medium</option>
            <option value="hard">Hard</option>
          </select>
        </div>
      </div>
      <div class="field">
        <label>Question</label>
        <textarea class="textarea" data-question placeholder="What is 2/3 + 1/4?"></textarea>
      </div>
      <div class="field">
        <label>Answers - tick the correct one</label>
        <div class="col" data-options>
          ${[0, 1, 2, 3].map((i) => `
            <label class="row row-tight" style="gap:.5rem">
              <input type="radio" name="correct" value="${i}" ${i === 0 ? 'checked' : ''} style="width:18px;height:18px;accent-color:var(--accent)">
              <input class="input" data-option="${i}" placeholder="Answer ${'ABCD'[i]}" style="flex:1">
            </label>`).join('')}
        </div>
        <span class="hint">Leave the last ones blank if you only need two or three.</span>
      </div>
      <div class="field">
        <label>Explanation (shown after answering)</label>
        <textarea class="textarea" data-explanation placeholder="Make the bottoms match first..."></textarea>
      </div>`,
    footer: `
      <button class="btn" data-close>Cancel</button>
      <button class="btn btn-primary" data-save>Add question</button>`,
    onOpen: ({ root, close }) => {
      root.querySelector('[data-save]').addEventListener('click', async (event) => {
        const options = [...root.querySelectorAll('[data-option]')].map((i) => i.value.trim());
        const checked = Number(root.querySelector('input[name="correct"]:checked')?.value ?? 0);
        const kept = options.filter(Boolean);

        if (kept.length < 2) { toast('Give at least two answers.', 'warning'); return; }
        if (!options[checked]) { toast('The answer you ticked is empty.', 'warning'); return; }

        // The tick refers to the full list, so move it to match the kept list.
        const answerIndex = kept.indexOf(options[checked]);

        const button = event.currentTarget;
        button.disabled = true;
        try {
          await api.practice.createQuestion({
            subjectId: Number(root.querySelector('[data-subject]').value),
            topic: root.querySelector('[data-topic]').value,
            difficulty: root.querySelector('[data-difficulty]').value,
            question: root.querySelector('[data-question]').value,
            options: kept,
            answerIndex,
            explanation: root.querySelector('[data-explanation]').value
          });
          close();
          toast('Question added.', 'success');
          showSubjects(mount);
        } catch (err) {
          toast(err.message, 'error');
          button.disabled = false;
        }
      });
    }
  });
}

/** Teachers adding a new subject of their own. */
function openSubjectForm(mount) {
  const icons = [
    ['book', 'Book'], ['chart', 'Chart'], ['zap', 'Science'], ['target', 'Target'],
    ['clock', 'Clock'], ['grid', 'Grid'], ['brain', 'Brain'], ['star', 'Star'],
    ['game', 'Game'], ['users', 'People']
  ];
  modal({
    title: 'Add a subject',
    body: `
      <div class="field">
        <label>Subject name</label>
        <input class="input" data-name placeholder="French" maxlength="40">
      </div>
      <div class="field">
        <label>Short description</label>
        <input class="input" data-description placeholder="Vocabulary, grammar and reading." maxlength="200">
      </div>
      <div class="field">
        <label>Icon</label>
        <select class="select" data-icon>
          ${icons.map(([value, label]) => `<option value="${value}">${esc(label)}</option>`).join('')}
        </select>
      </div>
      <p class="small muted" style="margin:0">
        The subject appears straight away. Add questions to it with
        <strong>Add a question</strong>.
      </p>`,
    footer: `
      <button class="btn" data-close>Cancel</button>
      <button class="btn btn-primary" data-save>Add subject</button>`,
    onOpen: ({ root, close }) => {
      root.querySelector('[data-save]').addEventListener('click', async (event) => {
        const name = root.querySelector('[data-name]').value.trim();
        if (!name) { toast('Give the subject a name.', 'warning'); return; }
        const button = event.currentTarget;
        button.disabled = true;
        try {
          await api.practice.createSubject({
            name,
            description: root.querySelector('[data-description]').value.trim(),
            icon: root.querySelector('[data-icon]').value
          });
          close();
          toast(`"${name}" added.`, 'success');
          showSubjects(mount);
        } catch (err) {
          toast(err.message, 'error');
          button.disabled = false;
        }
      });
    }
  });
}

/** Lets a teacher look over what is in the bank and remove anything wrong. */
function openQuestionManager(subjects, mount) {
  modal({
    title: 'Manage questions',
    size: 'modal-lg',
    body: `
      <div class="field">
        <label>Subject</label>
        <select class="select" data-filter>
          <option value="">All subjects</option>
          ${subjects.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}
        </select>
      </div>
      <div data-list style="max-height:50vh;overflow-y:auto">
        <div class="spinner spinner-center"></div>
      </div>`,
    footer: `<button class="btn" data-close>Done</button>`,
    onOpen: ({ root }) => {
      const list = root.querySelector('[data-list]');
      const filter = root.querySelector('[data-filter]');

      const load = async () => {
        list.innerHTML = '<div class="spinner spinner-center"></div>';
        try {
          const subjectId = filter.value;
          const { questions } = await api.practice.listQuestions(subjectId ? `?subjectId=${subjectId}` : '');
          list.innerHTML = questions.length
            ? `<div class="list">${questions.map((q) => `
                <div class="list-item" data-row="${q.id}">
                  <div class="meta">
                    <div class="title">${esc(q.question)}</div>
                    <div class="sub">
                      ${esc(q.subjectName)}${q.topic ? ` - ${esc(q.topic)}` : ''} - ${esc(q.difficulty)}
                      - answer: ${esc(q.options[q.answerIndex] || '?')}
                    </div>
                  </div>
                  <button class="btn btn-sm btn-danger" data-remove="${q.id}">Delete</button>
                </div>`).join('')}</div>`
            : emptyState({ iconName: 'book', title: 'No questions yet', text: 'Add one with the Add a question button.' });
        } catch (err) {
          list.innerHTML = `<p class="small" style="color:var(--danger)">${esc(err.message)}</p>`;
        }
      };

      filter.addEventListener('change', load);

      list.addEventListener('click', async (event) => {
        const button = event.target.closest('[data-remove]');
        if (!button) return;
        const id = Number(button.dataset.remove);
        button.disabled = true;
        try {
          await api.practice.deleteQuestion(id);
          list.querySelector(`[data-row="${id}"]`)?.remove();
          toast('Question removed.', 'success');
          showSubjects(mount);
        } catch (err) {
          toast(err.message, 'error');
          button.disabled = false;
        }
      });

      load();
    }
  });
}
