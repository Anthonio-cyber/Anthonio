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

  if (query.subject) return runSession(mount, Number(query.subject), query.mode || 'all', query.topic ? Number(query.topic) : null);
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
    // Topics belong to a subject, so fetch them all at once for the grid.
    const topicLists = await Promise.all(data.subjects.map((s) => api.practice.topics(s.id).catch(() => ({ topics: [] }))));
    data.subjects.forEach((subject, i) => { subject.topics = topicLists[i].topics; });
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
          <button class="btn btn-sm" id="manage-topics">${icon('grid', 14)} Topics</button>
          <button class="btn btn-sm" id="manage-questions">${icon('edit', 14)} Manage questions</button>
        </div>` : ''}

      <div class="section-title" style="margin-top:1.5rem">${icon('book', 14)} Subjects</div>
      <div class="grid grid-3">
        ${data.subjects.map(subjectCard).join('')}
      </div>
    </div>`;

  mount.querySelector('#add-question')?.addEventListener('click', () => openQuestionForm(data.subjects, mount));
  mount.querySelector('#add-subject')?.addEventListener('click', () => openSubjectForm(mount));
  mount.querySelector('#manage-topics')?.addEventListener('click', () => openTopicManager(data.subjects, mount));
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

      ${subject.topics?.length ? `
        <div class="topic-row">
          ${subject.topics.filter((t) => t.questionCount).map((t) => `
            <a class="topic-chip" href="#/practice?subject=${subject.id}&topic=${t.id}" title="${esc(t.description || '')}">
              ${esc(t.name)} <span class="count">${t.correct}/${t.questionCount}</span>
            </a>`).join('')}
        </div>` : ''}

      <div class="row row-tight" style="margin-top:.8rem">
        <a class="btn btn-primary btn-sm" href="#/practice?subject=${subject.id}">${icon('play', 14)} Practise</a>
        ${p.attempted < p.total ? `<a class="btn btn-sm" href="#/practice?subject=${subject.id}&mode=new">New only</a>` : ''}
        ${p.attempted > p.correct ? `<a class="btn btn-sm" href="#/practice?subject=${subject.id}&mode=wrong">My mistakes</a>` : ''}
      </div>
    </article>`;
}

// ---------------------------------------------------------------------------
// A practice session
// ---------------------------------------------------------------------------
async function runSession(mount, subjectId, mode, topicId = null) {
  mount.innerHTML = `<div class="page page-narrow">${loadingBlock(2)}</div>`;

  let data;
  try {
    data = await api.practice.questions(subjectId, `?limit=10${mode !== 'all' ? `&mode=${mode}` : ''}${topicId ? `&topicId=${topicId}` : ''}`);
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

    const isBlank = q.kind === 'fill_blank';
    area.innerHTML = `
      <div class="quiz-card">
        <div class="row row-tight" style="margin-bottom:.5rem">
          ${q.topic ? `<span class="badge">${esc(q.topic)}</span>` : ''}
          <span class="badge badge-info">${esc(q.kindLabel || 'Question')}</span>
          <span class="badge ${q.difficulty === 'hard' ? 'badge-danger' : (q.difficulty === 'easy' ? 'badge-success' : 'badge-warning')}">
            ${esc(q.difficulty)}
          </span>
        </div>
        <h3 class="quiz-question">${esc(q.question)}</h3>

        ${q.codeSnippet ? `<pre class="code-block"><code>${esc(q.codeSnippet)}</code></pre>` : ''}

        ${isBlank ? `
          <div class="row" style="margin-top:.4rem">
            <input class="input" id="p-typed" placeholder="Type your answer" autocomplete="off" autocapitalize="off" spellcheck="false" style="flex:1">
            <button class="btn btn-primary" id="p-submit">Check</button>
          </div>
          <p class="tiny faint" style="margin:.4rem 0 0">Spelling matters, but capital letters and full stops do not.</p>
        ` : `
          <div class="quiz-options">
            ${q.options.map((option, i) => `
              <button class="quiz-option" data-choice="${i}">
                <span class="quiz-letter">${q.kind === 'true_false' ? (i === 0 ? 'T' : 'F') : 'ABCDEF'[i]}</span>
                <span>${esc(option)}</span>
              </button>`).join('')}
          </div>
        `}
        <div id="p-feedback"></div>
      </div>`;

    if (isBlank) {
      const input = area.querySelector('#p-typed');
      const submit = () => choose(null, input.value);
      area.querySelector('#p-submit').addEventListener('click', submit);
      input.addEventListener('keydown', (event) => { if (event.key === 'Enter') submit(); });
      input.focus();
    } else {
      for (const button of area.querySelectorAll('[data-choice]')) {
        button.addEventListener('click', () => choose(Number(button.dataset.choice)));
      }
    }
  }

  async function choose(chosenIndex, typedText) {
    if (state.answered) return;
    const q = data.questions[state.index];
    const isBlank = q.kind === 'fill_blank';

    if (isBlank && !String(typedText || '').trim()) {
      toast('Type your answer first.', 'warning');
      return;
    }

    state.answered = true;
    const buttons = [...area.querySelectorAll('[data-choice]')];
    const typedInput = area.querySelector('#p-typed');
    const submitButton = area.querySelector('#p-submit');
    for (const b of buttons) b.disabled = true;
    if (typedInput) typedInput.disabled = true;
    if (submitButton) submitButton.disabled = true;

    let result;
    try {
      result = await api.practice.answer(q.id, chosenIndex, typedText);
    } catch (err) {
      toast(err.message, 'error');
      for (const b of buttons) b.disabled = false;
      if (typedInput) typedInput.disabled = false;
      if (submitButton) submitButton.disabled = false;
      state.answered = false;
      return;
    }

    if (isBlank) {
      typedInput?.classList.add(result.correct ? 'answer-right' : 'answer-wrong');
    } else {
      buttons[result.answerIndex]?.classList.add('right');
      if (!result.correct) buttons[chosenIndex]?.classList.add('wrong');
    }

    if (result.correct) { state.right += 1; state.xp += result.xpAwarded; }
    else state.wrong += 1;
    scoreLabel.textContent = `${state.right} correct`;

    const last = state.index === data.questions.length - 1;
    area.querySelector('#p-feedback').innerHTML = `
      <div class="alert ${result.correct ? 'alert-success' : 'alert-warning'}" style="margin-top:1rem">
        ${icon(result.correct ? 'check' : 'info', 17)}
        <div>
          <strong>${result.correct ? 'Correct' : 'Not quite'}</strong>
          ${!result.correct && q.kind === 'fill_blank' && result.expected
    ? ` - the answer was <strong>${esc(result.expected)}</strong>` : ''}
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
          <a class="btn btn-primary" href="#/practice?subject=${subjectId}&mode=${mode}${topicId ? `&topic=${topicId}` : ''}">${icon('refresh', 15)} Again</a>
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
  const KINDS = [
    ['multiple_choice', 'Multiple choice', 'Several answers, one right.'],
    ['true_false', 'True or false', 'A statement that is true or false.'],
    ['fill_blank', 'Fill in the blank', 'They type the missing word. Put ___ where the gap goes.'],
    ['find_bug', 'Find the bug', 'Show code and ask what is wrong.'],
    ['output', 'What is the output', 'Show code and ask what it prints.']
  ];

  modal({
    title: 'Add a practice question',
    size: 'modal-lg',
    body: `
      <div class="row">
        <div class="field" style="flex:1">
          <label>Subject</label>
          <select class="select" data-subject>
            ${subjects.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}
          </select>
        </div>
        <div class="field" style="flex:1">
          <label>Topic</label>
          <select class="select" data-topic><option value="">No topic</option></select>
        </div>
      </div>

      <div class="field">
        <label>Kind of question</label>
        <select class="select" data-kind>
          ${KINDS.map(([value, label]) => `<option value="${value}">${esc(label)}</option>`).join('')}
        </select>
        <span class="hint" data-kind-hint>${esc(KINDS[0][2])}</span>
      </div>

      <div class="field">
        <label>Difficulty</label>
        <select class="select" data-difficulty>
          <option value="easy">Easy</option>
          <option value="medium" selected>Medium</option>
          <option value="hard">Hard</option>
        </select>
      </div>

      <div class="field">
        <label>Question</label>
        <textarea class="textarea" data-question placeholder="What is 2/3 + 1/4?"></textarea>
      </div>

      <div class="field" data-code-field hidden>
        <label>Code to show</label>
        <textarea class="textarea" data-code rows="6" spellcheck="false"
          style="font-family:var(--font-mono);font-size:.86rem"
          placeholder="for (let i = 1; i < 5; i++) {&#10;  print(i);&#10;}"></textarea>
      </div>

      <div class="field" data-options-field>
        <label data-options-label>Answers - tick the correct one</label>
        <div class="col" data-options>
          ${[0, 1, 2, 3].map((i) => `
            <label class="row row-tight" style="gap:.5rem">
              <input type="radio" name="correct" value="${i}" ${i === 0 ? 'checked' : ''} style="width:18px;height:18px;accent-color:var(--accent)">
              <input class="input" data-option="${i}" placeholder="Answer ${'ABCD'[i]}" style="flex:1">
            </label>`).join('')}
        </div>
        <span class="hint">Leave the last ones blank if you only need two or three.</span>
      </div>

      <div class="field" data-accepted-field hidden>
        <label>Answers to accept</label>
        <div class="col" data-accepted>
          ${[0, 1, 2].map((i) => `
            <input class="input" data-accept="${i}" placeholder="${i === 0 ? 'The answer' : 'Another way of writing it (optional)'}">`).join('')}
        </div>
        <span class="hint">Capital letters and full stops are ignored when marking.</span>
      </div>

      <div class="field">
        <label>Explanation (shown after answering)</label>
        <textarea class="textarea" data-explanation placeholder="Make the bottoms match first..."></textarea>
      </div>`,
    footer: `
      <button class="btn" data-close>Cancel</button>
      <button class="btn btn-primary" data-save>Add question</button>`,
    onOpen: ({ root, close }) => {
      const subjectSelect = root.querySelector('[data-subject]');
      const topicSelect = root.querySelector('[data-topic]');
      const kindSelect = root.querySelector('[data-kind]');
      const optionsField = root.querySelector('[data-options-field]');
      const acceptedField = root.querySelector('[data-accepted-field]');
      const codeField = root.querySelector('[data-code-field]');
      const optionsLabel = root.querySelector('[data-options-label]');

      // Topics depend on the subject, so reload them whenever it changes.
      const loadTopics = async () => {
        topicSelect.innerHTML = '<option value="">No topic</option>';
        try {
          const { topics } = await api.practice.topics(Number(subjectSelect.value));
          for (const t of topics) {
            const option = document.createElement('option');
            option.value = t.id;
            option.textContent = t.name;
            topicSelect.append(option);
          }
        } catch { /* a topic is optional anyway */ }
      };
      subjectSelect.addEventListener('change', loadTopics);
      loadTopics();

      const applyKind = () => {
        const kind = kindSelect.value;
        const meta = KINDS.find(([k]) => k === kind);
        root.querySelector('[data-kind-hint]').textContent = meta ? meta[2] : '';

        const isBlank = kind === 'fill_blank';
        const isTrueFalse = kind === 'true_false';
        const needsCode = kind === 'find_bug' || kind === 'output';

        acceptedField.hidden = !isBlank;
        optionsField.hidden = isBlank || isTrueFalse;
        codeField.hidden = !needsCode;

        if (isTrueFalse) {
          optionsField.hidden = false;
          optionsLabel.textContent = 'Is the statement true or false?';
          const rows = [...root.querySelectorAll('[data-option]')];
          rows[0].value = 'True'; rows[1].value = 'False';
          rows[0].disabled = true; rows[1].disabled = true;
          rows[2].value = ''; rows[3].value = '';
          rows[2].closest('label').hidden = true;
          rows[3].closest('label').hidden = true;
        } else {
          optionsLabel.textContent = 'Answers - tick the correct one';
          for (const row of root.querySelectorAll('[data-option]')) {
            row.disabled = false;
            row.closest('label').hidden = false;
          }
        }
      };
      kindSelect.addEventListener('change', applyKind);
      applyKind();

      root.querySelector('[data-save]').addEventListener('click', async (event) => {
        const kind = kindSelect.value;
        const payload = {
          subjectId: Number(subjectSelect.value),
          topicId: topicSelect.value ? Number(topicSelect.value) : null,
          kind,
          difficulty: root.querySelector('[data-difficulty]').value,
          question: root.querySelector('[data-question]').value,
          explanation: root.querySelector('[data-explanation]').value,
          codeSnippet: root.querySelector('[data-code]').value
        };

        if (kind === 'fill_blank') {
          payload.accepted = [...root.querySelectorAll('[data-accept]')].map((i) => i.value.trim()).filter(Boolean);
          if (!payload.accepted.length) { toast('Give at least one answer to accept.', 'warning'); return; }
        } else {
          const all = [...root.querySelectorAll('[data-option]')].map((i) => i.value.trim());
          const checked = Number(root.querySelector('input[name="correct"]:checked')?.value ?? 0);
          const kept = all.filter(Boolean);
          if (kept.length < 2) { toast('Give at least two answers.', 'warning'); return; }
          if (!all[checked]) { toast('The answer you ticked is empty.', 'warning'); return; }
          payload.options = kept;
          // The tick refers to the full list, so move it to match the kept list.
          payload.answerIndex = kept.indexOf(all[checked]);
        }

        const button = event.currentTarget;
        button.disabled = true;
        try {
          await api.practice.createQuestion(payload);
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

/** Teachers adding and removing the topics inside a subject. */
function openTopicManager(subjects, mount) {
  modal({
    title: 'Topics',
    size: 'modal-lg',
    body: `
      <div class="field">
        <label>Subject</label>
        <select class="select" data-subject>
          ${subjects.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}
        </select>
      </div>

      <div class="field">
        <label>Add a topic</label>
        <div class="row">
          <input class="input" data-new-topic placeholder="Fractions" style="flex:1" maxlength="60">
          <button class="btn btn-primary" data-add>Add</button>
        </div>
        <input class="input" data-new-description placeholder="Short description (optional)" style="margin-top:.4rem" maxlength="200">
      </div>

      <div class="divider"></div>
      <div data-list style="max-height:40vh;overflow-y:auto">
        <div class="spinner spinner-center"></div>
      </div>`,
    footer: `<button class="btn" data-close>Done</button>`,
    onOpen: ({ root }) => {
      const subjectSelect = root.querySelector('[data-subject]');
      const list = root.querySelector('[data-list]');

      const load = async () => {
        list.innerHTML = '<div class="spinner spinner-center"></div>';
        try {
          const { topics } = await api.practice.topics(Number(subjectSelect.value));
          list.innerHTML = topics.length
            ? `<div class="list">${topics.map((t) => `
                <div class="list-item" data-row="${t.id}">
                  <div class="meta">
                    <div class="title">${esc(t.name)}</div>
                    <div class="sub">${t.questionCount} question${t.questionCount === 1 ? '' : 's'}${t.description ? ` - ${esc(t.description)}` : ''}</div>
                  </div>
                  <button class="btn btn-sm btn-danger" data-remove="${t.id}">Delete</button>
                </div>`).join('')}</div>`
            : emptyState({ iconName: 'grid', title: 'No topics yet', text: 'Add the first one above.' });
        } catch (err) {
          list.innerHTML = `<p class="small" style="color:var(--danger)">${esc(err.message)}</p>`;
        }
      };

      subjectSelect.addEventListener('change', load);

      root.querySelector('[data-add]').addEventListener('click', async (event) => {
        const input = root.querySelector('[data-new-topic]');
        const descriptionInput = root.querySelector('[data-new-description]');
        const name = input.value.trim();
        if (!name) { toast('Give the topic a name.', 'warning'); return; }
        const button = event.currentTarget;
        button.disabled = true;
        try {
          await api.practice.createTopic(Number(subjectSelect.value), {
            name, description: descriptionInput.value.trim()
          });
          input.value = '';
          descriptionInput.value = '';
          toast(`"${name}" added.`, 'success');
          await load();
          showSubjects(mount);
        } catch (err) {
          toast(err.message, 'error');
        } finally {
          button.disabled = false;
        }
      });

      list.addEventListener('click', async (event) => {
        const button = event.target.closest('[data-remove]');
        if (!button) return;
        button.disabled = true;
        try {
          await api.practice.deleteTopic(Number(button.dataset.remove));
          list.querySelector(`[data-row="${button.dataset.remove}"]`)?.remove();
          toast('Topic removed. Its questions were kept.', 'success');
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
