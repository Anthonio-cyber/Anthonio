// ==========================================================
// Admin dashboard - the Coding Hub content tools.
//
// Subjects, topics, the lesson editor (with versions and coding
// challenges), the question bank with bulk editing and import/export,
// and the learning analytics screen.
//
// Nothing here generates content. Every one of these screens is a tool
// for an administrator to write and organise their own material.
// ==========================================================
import { esc, timeAgo, debounce, delegate } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { api } from '../lib/api.js';
import { can } from '../lib/store.js';
import { emptyState } from '../components/common.js';
import { toast, modal, confirmDialog, withBusy, promptDialog } from '../lib/ui.js';
import { difficultyBadge, TYPE_LABELS, DIFFICULTY_LABELS, isChoiceQuestion } from '../components/learn.js';

const ICONS = ['code', 'zap', 'brain', 'image', 'grid', 'flag', 'book', 'target', 'star', 'keyboard'];
const COLOURS = ['violet', 'blue', 'green', 'amber', 'orange', 'red', 'cyan', 'pink'];
const BLOCK_TYPES = [
  ['heading', 'Heading'],
  ['paragraph', 'Paragraph'],
  ['code', 'Code block'],
  ['list', 'List'],
  ['table', 'Table'],
  ['note', 'Note box'],
  ['info', 'Information box'],
  ['warning', 'Warning box'],
  ['example', 'Example box'],
  ['image', 'Image'],
  ['video', 'Video'],
  ['link', 'Link']
];

const field = (label, control, hint = '') => `
  <div class="field">
    <label>${esc(label)}</label>
    ${control}
    ${hint ? `<span class="small faint">${esc(hint)}</span>` : ''}
  </div>`;

// ===========================================================================
// Subjects
// ===========================================================================
export async function subjectsSection(panel) {
  const data = await api.curriculum.subjects();
  render(data.subjects);

  function render(subjects) {
    panel.innerHTML = `
      <div class="row" style="justify-content:space-between;margin-bottom:1rem;flex-wrap:wrap;gap:.6rem">
        <p class="muted small" style="margin:0">
          ${subjects.length} subjects. Drag order with the arrows; hidden subjects are invisible to learners.
        </p>
        ${can('subjects.create') ? '<button type="button" class="btn btn-primary btn-sm" data-new>' + icon('plus', 15) + ' New subject</button>' : ''}
      </div>

      ${subjects.length ? `
        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead>
              <tr><th>Subject</th><th>Topics</th><th>Lessons</th><th>Questions</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              ${subjects.map((s, index) => `
                <tr data-id="${s.id}">
                  <td>
                    <div class="row row-tight">
                      <span class="subject-mark subject-mark-sm" data-colour="${esc(s.colour)}">${icon(s.icon, 15)}</span>
                      <div>
                        <div class="bold">${esc(s.name)}</div>
                        <div class="tiny faint">/${esc(s.slug)}</div>
                      </div>
                    </div>
                  </td>
                  <td>${s.totalTopicCount}</td>
                  <td>${s.lessonCount}</td>
                  <td>${s.questionCount}</td>
                  <td>${s.published ? '<span class="badge badge-success">Published</span>' : '<span class="badge badge-warning">Hidden</span>'}</td>
                  <td class="right nowrap">
                    <button type="button" class="icon-button" data-move="up" ${index === 0 ? 'disabled' : ''} title="Move up">${icon('arrowLeft', 14)}</button>
                    <button type="button" class="icon-button" data-move="down" ${index === subjects.length - 1 ? 'disabled' : ''} title="Move down">${icon('arrowRight', 14)}</button>
                    <a class="btn btn-xs btn-ghost" href="#/admin/topics?subject=${s.id}">Topics</a>
                    ${can('subjects.edit') ? `<button type="button" class="btn btn-xs btn-ghost" data-edit>Edit</button>` : ''}
                    ${can('subjects.edit') ? `<button type="button" class="btn btn-xs btn-ghost" data-publish>${s.published ? 'Hide' : 'Publish'}</button>` : ''}
                    ${can('subjects.delete') ? `<button type="button" class="btn btn-xs btn-danger" data-delete>Delete</button>` : ''}
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>` : emptyState({ iconName: 'book', title: 'No subjects yet', text: 'Create your first coding subject to get started.' })}
    `;

    const find = (node) => subjects.find((s) => s.id === Number(node.closest('[data-id]').dataset.id));

    panel.querySelector('[data-new]')?.addEventListener('click', () => openSubjectForm(null, reload));

    delegate(panel, 'click', '[data-edit]', (_e, node) => openSubjectForm(find(node), reload));

    delegate(panel, 'click', '[data-publish]', async (_e, node) => {
      const subject = find(node);
      try {
        await api.curriculum.updateSubject(subject.id, { published: !subject.published });
        toast(subject.published ? 'Subject hidden from learners.' : 'Subject published.', 'success');
        reload();
      } catch (err) { toast(err.message, 'error'); }
    });

    delegate(panel, 'click', '[data-delete]', async (_e, node) => {
      const subject = find(node);
      const sure = await confirmDialog({
        title: `Delete ${subject.name}?`,
        message: `This also deletes its ${subject.totalTopicCount} topics, ${subject.lessonCount} lessons and ${subject.questionCount} questions, and everyone's progress in them. This cannot be undone.`,
        confirmText: 'Delete everything',
        danger: true
      });
      if (!sure) return;
      try {
        await api.curriculum.deleteSubject(subject.id);
        toast('Subject deleted.', 'success');
        reload();
      } catch (err) { toast(err.message, 'error'); }
    });

    delegate(panel, 'click', '[data-move]', async (_e, node) => {
      const id = Number(node.closest('[data-id]').dataset.id);
      const order = subjects.map((s) => s.id);
      const from = order.indexOf(id);
      const to = node.dataset.move === 'up' ? from - 1 : from + 1;
      if (to < 0 || to >= order.length) return;
      order.splice(to, 0, order.splice(from, 1)[0]);
      try {
        await api.curriculum.reorderSubjects(order);
        reload();
      } catch (err) { toast(err.message, 'error'); }
    });
  }

  async function reload() {
    const fresh = await api.curriculum.subjects();
    render(fresh.subjects);
  }
}

function openSubjectForm(subject, onSaved) {
  const editing = !!subject;
  modal({
    title: editing ? `Edit ${subject.name}` : 'New subject',
    body: `
      ${field('Name', `<input class="input" data-name value="${esc(subject?.name || '')}" placeholder="e.g. TypeScript">`)}
      ${field('Description', `<textarea class="textarea" data-description rows="3" placeholder="What will learners get out of this subject?">${esc(subject?.description || '')}</textarea>`)}
      ${field('Icon', `<select class="select" data-icon>
        ${ICONS.map((i) => `<option value="${i}" ${subject?.icon === i ? 'selected' : ''}>${i}</option>`).join('')}
      </select>`)}
      ${field('Colour', `<select class="select" data-colour>
        ${COLOURS.map((c) => `<option value="${c}" ${subject?.colour === c ? 'selected' : ''}>${c}</option>`).join('')}
      </select>`)}
      <label class="check">
        <input type="checkbox" data-published ${!subject || subject.published ? 'checked' : ''}>
        <span>Visible to learners</span>
      </label>`,
    footer: `
      <button type="button" class="btn" data-close>Cancel</button>
      <button type="button" class="btn btn-primary" data-save>${editing ? 'Save changes' : 'Create subject'}</button>`,
    onOpen: ({ root, close }) => {
      root.querySelector('[data-save]').addEventListener('click', async (event) => {
        const payload = {
          name: root.querySelector('[data-name]').value.trim(),
          description: root.querySelector('[data-description]').value.trim(),
          icon: root.querySelector('[data-icon]').value,
          colour: root.querySelector('[data-colour]').value,
          published: root.querySelector('[data-published]').checked
        };
        if (!payload.name) { toast('Give the subject a name.', 'warning'); return; }
        await withBusy(event.currentTarget, async () => {
          try {
            if (editing) await api.curriculum.updateSubject(subject.id, payload);
            else await api.curriculum.createSubject(payload);
            close();
            toast(editing ? 'Subject saved.' : 'Subject created.', 'success');
            onSaved();
          } catch (err) { toast(err.message, 'error'); }
        }, 'Saving...');
      });
    }
  });
}

// ===========================================================================
// Topics
// ===========================================================================
export async function topicsSection(panel, query = {}) {
  let subjectId = query.subject || '';
  await load();

  async function load() {
    const data = await api.curriculum.topics(subjectId ? `?subject=${subjectId}` : '');
    render(data);
  }

  function render({ topics, subjects }) {
    panel.innerHTML = `
      <div class="row" style="justify-content:space-between;margin-bottom:1rem;flex-wrap:wrap;gap:.6rem">
        <select class="select" data-filter style="max-width:260px">
          <option value="">Every subject</option>
          ${subjects.map((s) => `<option value="${s.id}" ${String(subjectId) === String(s.id) ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}
        </select>
        ${can('topics.create') ? '<button type="button" class="btn btn-primary btn-sm" data-new>' + icon('plus', 15) + ' New topic</button>' : ''}
      </div>

      ${topics.length ? `
        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead><tr><th>#</th><th>Topic</th><th>Subject</th><th>Lessons</th><th>Questions</th><th>Status</th><th></th></tr></thead>
            <tbody>
              ${topics.map((t, index) => `
                <tr data-id="${t.id}">
                  <td class="faint">${t.position + 1}</td>
                  <td><a href="#/topic/${t.id}" class="bold" style="color:inherit">${esc(t.name)}</a></td>
                  <td class="small faint">${esc(t.subjectName)}</td>
                  <td>${t.totalLessonCount}</td>
                  <td>
                    ${t.totalQuestionCount}
                    ${t.totalQuestionCount < 100 ? `<span class="tiny faint">(${100 - t.totalQuestionCount} to reach 100)</span>` : ''}
                  </td>
                  <td>${t.published ? '<span class="badge badge-success">Published</span>' : '<span class="badge badge-warning">Hidden</span>'}</td>
                  <td class="right nowrap">
                    <button type="button" class="icon-button" data-move="up" ${index === 0 ? 'disabled' : ''}>${icon('arrowLeft', 14)}</button>
                    <button type="button" class="icon-button" data-move="down" ${index === topics.length - 1 ? 'disabled' : ''}>${icon('arrowRight', 14)}</button>
                    <a class="btn btn-xs btn-ghost" href="#/admin/questions?topic=${t.id}">Questions</a>
                    ${can('topics.edit') ? '<button type="button" class="btn btn-xs btn-ghost" data-edit>Edit</button>' : ''}
                    ${can('topics.edit') ? `<button type="button" class="btn btn-xs btn-ghost" data-publish>${t.published ? 'Hide' : 'Publish'}</button>` : ''}
                    ${can('topics.delete') ? '<button type="button" class="btn btn-xs btn-danger" data-delete>Delete</button>' : ''}
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>` : emptyState({ iconName: 'grid', title: 'No topics here yet', text: 'Add the first topic to this subject.' })}
    `;

    const find = (node) => topics.find((t) => t.id === Number(node.closest('[data-id]').dataset.id));

    panel.querySelector('[data-filter]').addEventListener('change', (event) => {
      subjectId = event.target.value;
      load();
    });

    panel.querySelector('[data-new]')?.addEventListener('click', () => openTopicForm(null, subjects, subjectId, load));
    delegate(panel, 'click', '[data-edit]', (_e, node) => openTopicForm(find(node), subjects, subjectId, load));

    delegate(panel, 'click', '[data-publish]', async (_e, node) => {
      const topic = find(node);
      try {
        await api.curriculum.updateTopic(topic.id, { published: !topic.published });
        load();
      } catch (err) { toast(err.message, 'error'); }
    });

    delegate(panel, 'click', '[data-delete]', async (_e, node) => {
      const topic = find(node);
      const sure = await confirmDialog({
        title: `Delete ${topic.name}?`,
        message: `Its ${topic.totalLessonCount} lessons and ${topic.totalQuestionCount} questions go with it. This cannot be undone.`,
        confirmText: 'Delete topic',
        danger: true
      });
      if (!sure) return;
      try {
        await api.curriculum.deleteTopic(topic.id);
        toast('Topic deleted.', 'success');
        load();
      } catch (err) { toast(err.message, 'error'); }
    });

    delegate(panel, 'click', '[data-move]', async (_e, node) => {
      const id = Number(node.closest('[data-id]').dataset.id);
      const order = topics.map((t) => t.id);
      const from = order.indexOf(id);
      const to = node.dataset.move === 'up' ? from - 1 : from + 1;
      if (to < 0 || to >= order.length) return;
      order.splice(to, 0, order.splice(from, 1)[0]);
      try {
        await api.curriculum.reorderTopics(order);
        load();
      } catch (err) { toast(err.message, 'error'); }
    });
  }
}

function openTopicForm(topic, subjects, defaultSubject, onSaved) {
  const editing = !!topic;
  modal({
    title: editing ? `Edit ${topic.name}` : 'New topic',
    body: `
      ${field('Subject', `<select class="select" data-subject>
        ${subjects.map((s) => {
    const selected = editing ? topic.subjectId === s.id : String(defaultSubject) === String(s.id);
    return `<option value="${s.id}" ${selected ? 'selected' : ''}>${esc(s.name)}</option>`;
  }).join('')}
      </select>`)}
      ${field('Name', `<input class="input" data-name value="${esc(topic?.name || '')}" placeholder="e.g. Arrays">`)}
      ${field('Description', `<textarea class="textarea" data-description rows="3">${esc(topic?.description || '')}</textarea>`)}
      <label class="check">
        <input type="checkbox" data-published ${!topic || topic.published ? 'checked' : ''}>
        <span>Visible to learners</span>
      </label>`,
    footer: `
      <button type="button" class="btn" data-close>Cancel</button>
      <button type="button" class="btn btn-primary" data-save>${editing ? 'Save changes' : 'Create topic'}</button>`,
    onOpen: ({ root, close }) => {
      root.querySelector('[data-save]').addEventListener('click', async (event) => {
        const payload = {
          subjectId: Number(root.querySelector('[data-subject]').value),
          name: root.querySelector('[data-name]').value.trim(),
          description: root.querySelector('[data-description]').value.trim(),
          published: root.querySelector('[data-published]').checked
        };
        if (!payload.name) { toast('Give the topic a name.', 'warning'); return; }
        await withBusy(event.currentTarget, async () => {
          try {
            if (editing) await api.curriculum.updateTopic(topic.id, payload);
            else await api.curriculum.createTopic(payload);
            close();
            toast(editing ? 'Topic saved.' : 'Topic created.', 'success');
            onSaved();
          } catch (err) { toast(err.message, 'error'); }
        }, 'Saving...');
      });
    }
  });
}

// ===========================================================================
// Lessons
// ===========================================================================
export async function lessonsSection(panel, query = {}) {
  const filters = { subject: query.subject || '', status: '', search: '' };
  await load();

  if (query.edit) {
    try {
      const { lesson } = await api.curriculum.lesson(Number(query.edit));
      openLessonEditor(lesson, load);
    } catch { /* the list is still usable */ }
  }

  async function load() {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) if (value) search.set(key, value);
    const data = await api.curriculum.lessons(`?${search.toString()}`);
    render(data);
  }

  function render({ lessons, total, subjects }) {
    panel.innerHTML = `
      <div class="admin-filters">
        <input class="input" data-search placeholder="Search lessons..." value="${esc(filters.search)}">
        <select class="select" data-subject>
          <option value="">Every subject</option>
          ${subjects.map((s) => `<option value="${s.id}" ${String(filters.subject) === String(s.id) ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}
        </select>
        <select class="select" data-status>
          <option value="">Any status</option>
          <option value="published" ${filters.status === 'published' ? 'selected' : ''}>Published</option>
          <option value="draft" ${filters.status === 'draft' ? 'selected' : ''}>Draft</option>
        </select>
        ${can('lessons.create') ? '<button type="button" class="btn btn-primary btn-sm" data-new>' + icon('plus', 15) + ' Write a lesson</button>' : ''}
      </div>

      <p class="small faint">${total} lessons match.</p>

      ${lessons.length ? `
        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead><tr><th>Lesson</th><th>Subject / topic</th><th>Length</th><th>Version</th><th>Status</th><th></th></tr></thead>
            <tbody>
              ${lessons.map((l) => `
                <tr data-id="${l.id}">
                  <td>
                    <div class="bold">${esc(l.title)}</div>
                    <div class="tiny faint">${esc(l.summary.slice(0, 80))}</div>
                  </td>
                  <td class="small faint">${esc(l.subjectName)}<br>${esc(l.topicName)}</td>
                  <td class="small">${l.minutes} min<br><span class="tiny faint">${l.xpReward} XP</span></td>
                  <td class="small">v${l.version}</td>
                  <td>${l.status === 'published' ? '<span class="badge badge-success">Published</span>' : '<span class="badge badge-warning">Draft</span>'}</td>
                  <td class="right nowrap">
                    <a class="btn btn-xs btn-ghost" href="#/lesson/${l.id}">View</a>
                    ${can('lessons.edit') ? '<button type="button" class="btn btn-xs btn-ghost" data-edit>Edit</button>' : ''}
                    ${can('lessons.edit') ? `<button type="button" class="btn btn-xs btn-ghost" data-publish>${l.status === 'published' ? 'Unpublish' : 'Publish'}</button>` : ''}
                    ${can('lessons.create') ? '<button type="button" class="btn btn-xs btn-ghost" data-duplicate>Duplicate</button>' : ''}
                    ${can('lessons.delete') ? '<button type="button" class="btn btn-xs btn-danger" data-delete>Delete</button>' : ''}
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>` : emptyState({ iconName: 'book', title: 'No lessons match', text: 'Change the filters, or write a new lesson.' })}
    `;

    const idOf = (node) => Number(node.closest('[data-id]').dataset.id);

    panel.querySelector('[data-search]').addEventListener('input', debounce((event) => {
      filters.search = event.target.value.trim();
      load();
    }, 300));
    panel.querySelector('[data-subject]').addEventListener('change', (event) => { filters.subject = event.target.value; load(); });
    panel.querySelector('[data-status]').addEventListener('change', (event) => { filters.status = event.target.value; load(); });

    panel.querySelector('[data-new]')?.addEventListener('click', () => openLessonEditor(null, load));

    delegate(panel, 'click', '[data-edit]', async (_e, node) => {
      try {
        const { lesson } = await api.curriculum.lesson(idOf(node));
        openLessonEditor(lesson, load);
      } catch (err) { toast(err.message, 'error'); }
    });

    delegate(panel, 'click', '[data-publish]', async (_e, node) => {
      const lesson = lessons.find((l) => l.id === idOf(node));
      try {
        await api.curriculum.updateLesson(lesson.id, {
          status: lesson.status === 'published' ? 'draft' : 'published',
          versionNote: lesson.status === 'published' ? 'Unpublished' : 'Published'
        });
        toast(lesson.status === 'published' ? 'Lesson unpublished.' : 'Lesson published.', 'success');
        load();
      } catch (err) { toast(err.message, 'error'); }
    });

    delegate(panel, 'click', '[data-duplicate]', async (_e, node) => {
      try {
        await api.curriculum.duplicateLesson(idOf(node));
        toast('Duplicated as a new draft.', 'success');
        load();
      } catch (err) { toast(err.message, 'error'); }
    });

    delegate(panel, 'click', '[data-delete]', async (_e, node) => {
      const lesson = lessons.find((l) => l.id === idOf(node));
      const sure = await confirmDialog({
        title: `Delete "${lesson.title}"?`,
        message: 'Its challenges and everyone\'s progress on it go too. This cannot be undone.',
        confirmText: 'Delete lesson',
        danger: true
      });
      if (!sure) return;
      try {
        await api.curriculum.deleteLesson(lesson.id);
        toast('Lesson deleted.', 'success');
        load();
      } catch (err) { toast(err.message, 'error'); }
    });
  }
}

/** The lesson editor: details, a block-by-block body, challenges and versions. */
async function openLessonEditor(lesson, onSaved) {
  const editing = !!lesson;
  let topics = [];
  try {
    topics = (await api.curriculum.topics()).topics;
  } catch (err) {
    toast(err.message, 'error');
    return;
  }

  let blocks = editing ? [...(lesson.blocks || [])] : [{ type: 'paragraph', text: '' }];
  let versions = [];
  if (editing) {
    try { versions = (await api.curriculum.lesson(lesson.id)).versions; } catch { versions = []; }
  }

  const dialog = modal({
    title: editing ? `Edit: ${lesson.title}` : 'Write a lesson',
    size: 'modal-lg',
    body: '<div data-editor></div>',
    footer: `
      <button type="button" class="btn" data-close>Cancel</button>
      ${editing ? '<button type="button" class="btn btn-ghost" data-save-draft>Save as draft</button>' : ''}
      <button type="button" class="btn btn-primary" data-save>${editing ? 'Save changes' : 'Create lesson'}</button>`,
    onOpen: ({ root, close }) => {
      const editor = root.querySelector('[data-editor]');
      renderEditor(editor);

      const collect = (status) => ({
        topicId: Number(editor.querySelector('[data-topic]').value),
        title: editor.querySelector('[data-title]').value.trim(),
        summary: editor.querySelector('[data-summary]').value.trim(),
        objectives: editor.querySelector('[data-objectives]').value,
        minutes: Number(editor.querySelector('[data-minutes]').value) || 10,
        xpReward: Number(editor.querySelector('[data-xp]').value) || 25,
        blocks: readBlocks(editor),
        status: status || (editor.querySelector('[data-status]').value),
        versionNote: editor.querySelector('[data-note]')?.value.trim() || ''
      });

      const save = async (button, status) => {
        const payload = collect(status);
        if (!payload.title) { toast('The lesson needs a title.', 'warning'); return; }
        if (!payload.topicId) { toast('Choose a topic.', 'warning'); return; }
        await withBusy(button, async () => {
          try {
            if (editing) await api.curriculum.updateLesson(lesson.id, payload);
            else await api.curriculum.createLesson(payload);
            close();
            toast(editing ? 'Lesson saved.' : 'Lesson created.', 'success');
            onSaved();
          } catch (err) { toast(err.message, 'error'); }
        }, 'Saving...');
      };

      root.querySelector('[data-save]').addEventListener('click', (event) => save(event.currentTarget, null));
      root.querySelector('[data-save-draft]')?.addEventListener('click', (event) => save(event.currentTarget, 'draft'));

      // ---- block editing ----
      delegate(editor, 'click', '[data-add-block]', () => {
        blocks = readBlocks(editor);
        blocks.push({ type: 'paragraph', text: '' });
        renderEditor(editor);
      });
      delegate(editor, 'click', '[data-remove-block]', (_e, node) => {
        blocks = readBlocks(editor);
        blocks.splice(Number(node.closest('[data-block]').dataset.block), 1);
        renderEditor(editor);
      });
      delegate(editor, 'click', '[data-move-block]', (_e, node) => {
        blocks = readBlocks(editor);
        const from = Number(node.closest('[data-block]').dataset.block);
        const to = node.dataset.moveBlock === 'up' ? from - 1 : from + 1;
        if (to < 0 || to >= blocks.length) return;
        blocks.splice(to, 0, blocks.splice(from, 1)[0]);
        renderEditor(editor);
      });
      delegate(editor, 'change', '[data-block-type]', (_e, node) => {
        blocks = readBlocks(editor);
        const index = Number(node.closest('[data-block]').dataset.block);
        blocks[index] = { ...blocks[index], type: node.value };
        renderEditor(editor);
      });

      // ---- challenges ----
      delegate(editor, 'click', '[data-new-challenge]', () => {
        if (!editing) { toast('Save the lesson first, then add a challenge.', 'info'); return; }
        openChallengeForm(lesson.id, null, async () => {
          const fresh = await api.curriculum.lesson(lesson.id);
          lesson.challenges = fresh.lesson.challenges;
          renderEditor(editor);
        });
      });
      delegate(editor, 'click', '[data-edit-challenge]', (_e, node) => {
        const challenge = lesson.challenges.find((c) => c.id === Number(node.dataset.editChallenge));
        openChallengeForm(lesson.id, challenge, async () => {
          const fresh = await api.curriculum.lesson(lesson.id);
          lesson.challenges = fresh.lesson.challenges;
          renderEditor(editor);
        });
      });
      delegate(editor, 'click', '[data-delete-challenge]', async (_e, node) => {
        const sure = await confirmDialog({ title: 'Delete this challenge?', confirmText: 'Delete', danger: true });
        if (!sure) return;
        try {
          await api.curriculum.deleteChallenge(Number(node.dataset.deleteChallenge));
          const fresh = await api.curriculum.lesson(lesson.id);
          lesson.challenges = fresh.lesson.challenges;
          renderEditor(editor);
        } catch (err) { toast(err.message, 'error'); }
      });

      // ---- versions ----
      delegate(editor, 'click', '[data-restore]', async (_e, node) => {
        const version = Number(node.dataset.restore);
        const sure = await confirmDialog({
          title: `Restore version ${version}?`,
          message: 'The wording you have now is kept as its own version first, so nothing is lost.',
          confirmText: 'Restore'
        });
        if (!sure) return;
        try {
          const result = await api.curriculum.restoreVersion(lesson.id, version);
          blocks = result.lesson.blocks;
          Object.assign(lesson, result.lesson);
          versions = (await api.curriculum.lesson(lesson.id)).versions;
          renderEditor(editor);
          toast('Version restored.', 'success');
          onSaved();
        } catch (err) { toast(err.message, 'error'); }
      });
    }
  });

  function renderEditor(editor) {
    editor.innerHTML = `
      <div class="lesson-editor">
        <div class="grid grid-2">
          ${field('Topic', `<select class="select" data-topic>
            ${topics.map((t) => `<option value="${t.id}" ${lesson?.topicId === t.id ? 'selected' : ''}>${esc(t.subjectName)} — ${esc(t.name)}</option>`).join('')}
          </select>`)}
          ${field('Status', `<select class="select" data-status>
            <option value="draft" ${lesson?.status !== 'published' ? 'selected' : ''}>Draft</option>
            <option value="published" ${lesson?.status === 'published' ? 'selected' : ''}>Published</option>
          </select>`)}
        </div>

        ${field('Title', `<input class="input" data-title value="${esc(lesson?.title || '')}" placeholder="e.g. Arrays: storing a list of values">`)}
        ${field('Summary', `<textarea class="textarea" data-summary rows="2" placeholder="One or two lines describing the lesson.">${esc(lesson?.summary || '')}</textarea>`)}
        ${field('Learning objectives', `<textarea class="textarea" data-objectives rows="4" placeholder="One per line">${esc((lesson?.objectives || []).join('\n'))}</textarea>`, 'One objective per line.')}

        <div class="grid grid-2">
          ${field('Reading time (minutes)', `<input class="input" type="number" min="1" max="240" data-minutes value="${lesson?.minutes || 10}">`)}
          ${field('XP for completing', `<input class="input" type="number" min="0" max="500" data-xp value="${lesson?.xpReward ?? 25}">`)}
        </div>

        <h4>Lesson content</h4>
        <p class="small faint">
          Blocks are shown to learners in this order. Inside paragraphs, lists and boxes you can use
          <code>\`code\`</code> for inline code and <code>*emphasis*</code>.
        </p>
        <div class="block-list">${blocks.map(blockEditor).join('')}</div>
        <button type="button" class="btn btn-sm btn-ghost" data-add-block>${icon('plus', 14)} Add a block</button>

        ${editing ? `
          <h4>Coding challenges</h4>
          ${lesson.challenges?.length ? `
            <div class="list">
              ${lesson.challenges.map((c) => `
                <div class="list-item">
                  <div class="meta">
                    <div class="title">${esc(c.title)}</div>
                    <div class="sub">${esc(DIFFICULTY_LABELS[c.difficulty] || c.difficulty)} &middot; ${c.points} XP</div>
                  </div>
                  <button type="button" class="btn btn-xs btn-ghost" data-edit-challenge="${c.id}">Edit</button>
                  <button type="button" class="btn btn-xs btn-danger" data-delete-challenge="${c.id}">Delete</button>
                </div>`).join('')}
            </div>` : '<p class="small faint">No challenge on this lesson yet.</p>'}
          <button type="button" class="btn btn-sm btn-ghost" data-new-challenge>${icon('plus', 14)} Add a challenge</button>

          ${field('Note for this save (optional)', `<input class="input" data-note placeholder="e.g. Fixed the flexbox example">`, 'Stored with the previous version so you can find it again.')}

          ${versions.length ? `
            <h4>Earlier versions</h4>
            <div class="list">
              ${versions.map((v) => `
                <div class="list-item">
                  <div class="meta">
                    <div class="title">Version ${v.version}${v.note ? ` — ${esc(v.note)}` : ''}</div>
                    <div class="sub">${esc(v.savedBy?.displayName || 'Unknown')} &middot; ${timeAgo(v.createdAt)}</div>
                  </div>
                  <button type="button" class="btn btn-xs btn-ghost" data-restore="${v.version}">Restore</button>
                </div>`).join('')}
            </div>` : ''}
        ` : '<p class="small faint">Save the lesson and you will be able to add a coding challenge to it.</p>'}
      </div>`;
  }
}

function blockEditor(block, index) {
  const controls = `
    <div class="block-controls">
      <select class="select select-sm" data-block-type>
        ${BLOCK_TYPES.map(([value, label]) => `<option value="${value}" ${block.type === value ? 'selected' : ''}>${label}</option>`).join('')}
      </select>
      <button type="button" class="icon-button" data-move-block="up" title="Move up">${icon('arrowLeft', 13)}</button>
      <button type="button" class="icon-button" data-move-block="down" title="Move down">${icon('arrowRight', 13)}</button>
      <button type="button" class="icon-button" data-remove-block title="Remove">${icon('trash', 13)}</button>
    </div>`;

  let fields = '';
  switch (block.type) {
    case 'heading':
      fields = `<input class="input" data-text placeholder="Heading text" value="${esc(block.text || '')}">`;
      break;
    case 'code':
      fields = `
        <input class="input" data-language placeholder="Language, e.g. javascript" value="${esc(block.language || '')}">
        <textarea class="textarea code-input" data-code rows="6" placeholder="Your code sample">${esc(block.code || '')}</textarea>`;
      break;
    case 'list':
      fields = `
        <label class="check"><input type="checkbox" data-ordered ${block.ordered ? 'checked' : ''}><span>Numbered list</span></label>
        <textarea class="textarea" data-items rows="4" placeholder="One item per line">${esc((block.items || []).join('\n'))}</textarea>`;
      break;
    case 'table':
      fields = `
        <input class="input" data-headers placeholder="Column headings, separated by |" value="${esc((block.headers || []).join(' | '))}">
        <textarea class="textarea" data-rows rows="4" placeholder="One row per line, cells separated by |">${esc((block.rows || []).map((r) => r.join(' | ')).join('\n'))}</textarea>`;
      break;
    case 'image':
    case 'video':
    case 'link':
      fields = `
        <input class="input" data-url placeholder="URL" value="${esc(block.url || '')}">
        <input class="input" data-text placeholder="${block.type === 'link' ? 'Link text' : 'Caption'}" value="${esc(block.text || '')}">`;
      break;
    case 'note':
    case 'info':
    case 'warning':
    case 'example':
      fields = `
        <input class="input" data-title placeholder="Box title (optional)" value="${esc(block.title || '')}">
        <textarea class="textarea" data-text rows="3" placeholder="What should this box say?">${esc(block.text || '')}</textarea>`;
      break;
    default:
      fields = `<textarea class="textarea" data-text rows="4" placeholder="Write the paragraph here.">${esc(block.text || '')}</textarea>`;
  }

  return `<div class="block-item" data-block="${index}">${controls}<div class="block-fields">${fields}</div></div>`;
}

/** Reads the blocks back out of the editor DOM. */
function readBlocks(editor) {
  return [...editor.querySelectorAll('[data-block]')].map((node) => {
    const type = node.querySelector('[data-block-type]').value;
    const value = (selector) => node.querySelector(selector)?.value ?? '';
    const block = { type };

    if (type === 'code') {
      block.language = value('[data-language]');
      block.code = value('[data-code]');
    } else if (type === 'list') {
      block.ordered = node.querySelector('[data-ordered]')?.checked || false;
      block.items = value('[data-items]').split('\n').map((i) => i.trim()).filter(Boolean);
    } else if (type === 'table') {
      block.headers = value('[data-headers]').split('|').map((h) => h.trim()).filter(Boolean);
      block.rows = value('[data-rows]').split('\n').map((line) => line.split('|').map((c) => c.trim()))
        .filter((row) => row.some(Boolean));
    } else if (['image', 'video', 'link'].includes(type)) {
      block.url = value('[data-url]');
      block.text = value('[data-text]');
    } else if (['note', 'info', 'warning', 'example'].includes(type)) {
      block.title = value('[data-title]');
      block.text = value('[data-text]');
    } else {
      block.text = value('[data-text]');
    }
    return block;
  });
}

function openChallengeForm(lessonId, challenge, onSaved) {
  const editing = !!challenge;
  modal({
    title: editing ? 'Edit challenge' : 'New coding challenge',
    size: 'modal-lg',
    body: `
      ${field('Title', `<input class="input" data-title value="${esc(challenge?.title || '')}">`)}
      ${field('Problem description', `<textarea class="textarea" data-description rows="3">${esc(challenge?.description || '')}</textarea>`)}
      ${field('Requirements', `<textarea class="textarea" data-requirements rows="4">${esc((challenge?.requirements || []).join('\n'))}</textarea>`, 'One requirement per line.')}
      ${field('Starter code', `<textarea class="textarea code-input" data-starter rows="6">${esc(challenge?.starterCode || '')}</textarea>`)}
      ${field('Expected result', `<textarea class="textarea" data-expected rows="2">${esc(challenge?.expectedResult || '')}</textarea>`)}
      ${field('Hints', `<textarea class="textarea" data-hints rows="3">${esc((challenge?.hints || []).join('\n'))}</textarea>`, 'One hint per line.')}
      <div class="grid grid-2">
        ${field('Difficulty', `<select class="select" data-difficulty>
          ${Object.entries(DIFFICULTY_LABELS).map(([value, label]) =>
    `<option value="${value}" ${challenge?.difficulty === value ? 'selected' : ''}>${label}</option>`).join('')}
        </select>`)}
        ${field('XP', `<input class="input" type="number" min="0" max="200" data-points value="${challenge?.points ?? 20}">`)}
      </div>`,
    footer: `
      <button type="button" class="btn" data-close>Cancel</button>
      <button type="button" class="btn btn-primary" data-save>${editing ? 'Save changes' : 'Add challenge'}</button>`,
    onOpen: ({ root, close }) => {
      root.querySelector('[data-save]').addEventListener('click', async (event) => {
        const payload = {
          title: root.querySelector('[data-title]').value.trim(),
          description: root.querySelector('[data-description]').value.trim(),
          requirements: root.querySelector('[data-requirements]').value,
          starterCode: root.querySelector('[data-starter]').value,
          expectedResult: root.querySelector('[data-expected]').value.trim(),
          hints: root.querySelector('[data-hints]').value,
          difficulty: root.querySelector('[data-difficulty]').value,
          points: Number(root.querySelector('[data-points]').value) || 20
        };
        if (!payload.title) { toast('The challenge needs a title.', 'warning'); return; }
        await withBusy(event.currentTarget, async () => {
          try {
            if (editing) await api.curriculum.updateChallenge(challenge.id, payload);
            else await api.curriculum.createChallenge(lessonId, payload);
            close();
            toast('Challenge saved.', 'success');
            onSaved();
          } catch (err) { toast(err.message, 'error'); }
        }, 'Saving...');
      });
    }
  });
}

// ===========================================================================
// The question bank
// ===========================================================================
export async function questionsSection(panel, query = {}) {
  const filters = {
    subject: query.subject || '',
    topic: query.topic || '',
    difficulty: '',
    type: '',
    status: '',
    search: ''
  };
  let offset = 0;
  const selected = new Set();
  let topics = [];

  try {
    topics = (await api.curriculum.topics()).topics;
  } catch { topics = []; }

  await load();

  function queryString(extra = {}) {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries({ ...filters, ...extra })) if (value) search.set(key, value);
    return `?${search.toString()}`;
  }

  async function load() {
    const data = await api.curriculum.questions(queryString({ limit: 25, offset }));
    render(data);
  }

  function render({ questions, total, subjects, types, difficulties, counts }) {
    const pages = Math.max(1, Math.ceil(total / 25));
    const page = Math.floor(offset / 25) + 1;

    panel.innerHTML = `
      <div class="admin-filters">
        <input class="input" data-search placeholder="Search prompts and tags..." value="${esc(filters.search)}">
        <select class="select" data-subject>
          <option value="">Every subject</option>
          ${subjects.map((s) => `<option value="${s.id}" ${String(filters.subject) === String(s.id) ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}
        </select>
        <select class="select" data-topic>
          <option value="">Every topic</option>
          ${topics
    .filter((t) => !filters.subject || String(t.subjectId) === String(filters.subject))
    .map((t) => `<option value="${t.id}" ${String(filters.topic) === String(t.id) ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}
        </select>
        <select class="select" data-difficulty>
          <option value="">Any difficulty</option>
          ${difficulties.map((d) => `<option value="${d}" ${filters.difficulty === d ? 'selected' : ''}>${esc(DIFFICULTY_LABELS[d] || d)}</option>`).join('')}
        </select>
        <select class="select" data-type>
          <option value="">Every type</option>
          ${types.map((t) => `<option value="${t}" ${filters.type === t ? 'selected' : ''}>${esc(TYPE_LABELS[t] || t)}</option>`).join('')}
        </select>
        <select class="select" data-status>
          <option value="">Any status</option>
          <option value="published" ${filters.status === 'published' ? 'selected' : ''}>Published</option>
          <option value="unpublished" ${filters.status === 'unpublished' ? 'selected' : ''}>Unpublished</option>
        </select>
      </div>

      <div class="row" style="justify-content:space-between;flex-wrap:wrap;gap:.6rem;margin-bottom:.8rem">
        <p class="small faint" style="margin:0">
          ${total} match &middot; ${counts.published} published of ${counts.total} in the bank
        </p>
        <div class="row" style="gap:.4rem;flex-wrap:wrap">
          ${can('questions.create') ? `<button type="button" class="btn btn-sm btn-primary" data-new>${icon('plus', 14)} New question</button>` : ''}
          ${can('questions.create') ? `<button type="button" class="btn btn-sm btn-ghost" data-write-many>${icon('edit', 14)} Write a set</button>` : ''}
          ${can('questions.import') ? `<button type="button" class="btn btn-sm btn-ghost" data-import>${icon('upload', 14)} Import</button>` : ''}
          ${can('questions.import') ? `<button type="button" class="btn btn-sm btn-ghost" data-export>${icon('link', 14)} Export</button>` : ''}
        </div>
      </div>

      <div class="bulk-bar" ${selected.size ? '' : 'hidden'}>
        <strong data-count>${selected.size} selected</strong>
        <button type="button" class="btn btn-xs btn-ghost" data-bulk="publish">Publish</button>
        <button type="button" class="btn btn-xs btn-ghost" data-bulk="unpublish">Unpublish</button>
        <button type="button" class="btn btn-xs btn-ghost" data-bulk="difficulty">Change difficulty</button>
        <button type="button" class="btn btn-xs btn-ghost" data-bulk="points">Change points</button>
        <button type="button" class="btn btn-xs btn-ghost" data-bulk="move">Move to a topic</button>
        ${can('questions.delete') ? '<button type="button" class="btn btn-xs btn-danger" data-bulk="delete">Delete</button>' : ''}
        <button type="button" class="btn btn-xs btn-ghost" data-clear>Clear</button>
      </div>

      ${questions.length ? `
        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead>
              <tr>
                <th style="width:2rem"><input type="checkbox" data-select-all></th>
                <th>Question</th><th>Topic</th><th>Type</th><th>Difficulty</th><th>Pts</th><th>Status</th><th></th>
              </tr>
            </thead>
            <tbody>
              ${questions.map((q) => `
                <tr data-id="${q.id}">
                  <td><input type="checkbox" data-select ${selected.has(q.id) ? 'checked' : ''}></td>
                  <td>
                    <div class="bold" style="white-space:normal">${esc(q.prompt.slice(0, 110))}${q.prompt.length > 110 ? '...' : ''}</div>
                    <div class="tiny faint">${esc(answerSummary(q))}</div>
                  </td>
                  <td class="small faint">${esc(q.subjectName)}<br>${esc(q.topicName)}</td>
                  <td class="small">${esc(TYPE_LABELS[q.type] || q.type)}</td>
                  <td>${difficultyBadge(q.difficulty)}</td>
                  <td>${q.points}</td>
                  <td>${q.published ? '<span class="badge badge-success">Live</span>' : '<span class="badge badge-warning">Off</span>'}</td>
                  <td class="right nowrap">
                    ${can('questions.edit') ? '<button type="button" class="btn btn-xs btn-ghost" data-edit>Edit</button>' : ''}
                    ${can('questions.create') ? '<button type="button" class="btn btn-xs btn-ghost" data-duplicate>Copy</button>' : ''}
                    ${can('questions.delete') ? '<button type="button" class="btn btn-xs btn-danger" data-delete>Delete</button>' : ''}
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>

        <div class="row" style="justify-content:center;gap:.6rem;margin-top:1rem">
          <button type="button" class="btn btn-sm btn-ghost" data-page="prev" ${page === 1 ? 'disabled' : ''}>Previous</button>
          <span class="small faint">Page ${page} of ${pages}</span>
          <button type="button" class="btn btn-sm btn-ghost" data-page="next" ${page >= pages ? 'disabled' : ''}>Next</button>
        </div>
      ` : emptyState({ iconName: 'target', title: 'No questions match', text: 'Change the filters, or add some questions.' })}
    `;

    wire(questions, subjects);
  }

  function wire(questions, subjects) {
    const idOf = (node) => Number(node.closest('[data-id]').dataset.id);
    const setFilter = (key) => (event) => { filters[key] = event.target.value; offset = 0; load(); };

    panel.querySelector('[data-search]').addEventListener('input', debounce((event) => {
      filters.search = event.target.value.trim();
      offset = 0;
      load();
    }, 300));
    panel.querySelector('[data-subject]').addEventListener('change', (event) => {
      filters.subject = event.target.value;
      filters.topic = '';
      offset = 0;
      load();
    });
    for (const key of ['topic', 'difficulty', 'type', 'status']) {
      panel.querySelector(`[data-${key}]`).addEventListener('change', setFilter(key));
    }

    delegate(panel, 'click', '[data-page]', (_e, node) => {
      offset = node.dataset.page === 'next' ? offset + 25 : Math.max(0, offset - 25);
      load();
    });

    // ---- selection ----
    const refreshBulkBar = () => {
      const bar = panel.querySelector('.bulk-bar');
      bar.hidden = selected.size === 0;
      bar.querySelector('[data-count]').textContent = `${selected.size} selected`;
    };
    delegate(panel, 'change', '[data-select]', (_e, node) => {
      const id = idOf(node);
      if (node.checked) selected.add(id); else selected.delete(id);
      refreshBulkBar();
    });
    panel.querySelector('[data-select-all]')?.addEventListener('change', (event) => {
      for (const node of panel.querySelectorAll('[data-select]')) {
        node.checked = event.target.checked;
        const id = Number(node.closest('[data-id]').dataset.id);
        if (event.target.checked) selected.add(id); else selected.delete(id);
      }
      refreshBulkBar();
    });
    panel.querySelector('[data-clear]')?.addEventListener('click', () => {
      selected.clear();
      load();
    });

    delegate(panel, 'click', '[data-bulk]', (_e, node) => runBulk(node.dataset.bulk));

    // ---- single question actions ----
    panel.querySelector('[data-new]')?.addEventListener('click', () => openQuestionForm(null, topics, filters.topic, load));
    delegate(panel, 'click', '[data-edit]', (_e, node) => {
      const question = questions.find((q) => q.id === idOf(node));
      openQuestionForm(question, topics, filters.topic, load);
    });
    delegate(panel, 'click', '[data-duplicate]', async (_e, node) => {
      try {
        await api.curriculum.duplicateQuestion(idOf(node));
        toast('Copied as an unpublished question.', 'success');
        load();
      } catch (err) { toast(err.message, 'error'); }
    });
    delegate(panel, 'click', '[data-delete]', async (_e, node) => {
      const sure = await confirmDialog({ title: 'Delete this question?', message: 'Everyone\'s attempts at it go too.', confirmText: 'Delete', danger: true });
      if (!sure) return;
      try {
        await api.curriculum.deleteQuestion(idOf(node));
        toast('Question deleted.', 'success');
        load();
      } catch (err) { toast(err.message, 'error'); }
    });

    panel.querySelector('[data-write-many]')?.addEventListener('click', () => openBatchWriter(topics, filters.topic, load));
    panel.querySelector('[data-import]')?.addEventListener('click', () => openImport(topics, load));
    panel.querySelector('[data-export]')?.addEventListener('click', doExport);
  }

  async function runBulk(action) {
    if (!selected.size) return;
    const ids = [...selected];
    const payload = { ids, action };

    if (action === 'delete') {
      const sure = await confirmDialog({
        title: `Delete ${ids.length} questions?`,
        message: 'This cannot be undone.',
        confirmText: 'Delete them',
        danger: true
      });
      if (!sure) return;
    }
    if (action === 'difficulty') {
      const choice = await chooseDialog('Change difficulty to', Object.entries(DIFFICULTY_LABELS));
      if (!choice) return;
      payload.difficulty = choice;
    }
    if (action === 'points') {
      const value = await promptDialog({ title: 'Change points', label: 'How many points is each question worth?', value: '10' });
      if (value === null) return;
      payload.points = Number(value) || 0;
    }
    if (action === 'move') {
      const choice = await chooseDialog('Move to topic', topics.map((t) => [String(t.id), `${t.subjectName} — ${t.name}`]));
      if (!choice) return;
      payload.topicId = Number(choice);
    }

    try {
      const result = await api.curriculum.bulkQuestions(payload);
      toast(`${result.changed} questions updated.`, 'success');
      selected.clear();
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  async function doExport() {
    try {
      const data = await api.curriculum.exportQuestions(queryString());
      const text = JSON.stringify(data, null, 2);
      modal({
        title: `Export: ${data.questions.length} questions`,
        size: 'modal-lg',
        body: `
          <p class="small muted">Copy this and keep it somewhere safe. The Import button reads exactly this format.</p>
          <textarea class="textarea code-input" rows="16" readonly>${esc(text)}</textarea>`,
        footer: `
          <button type="button" class="btn" data-close>Close</button>
          <button type="button" class="btn btn-primary" data-copy>Copy to clipboard</button>`,
        onOpen: ({ root }) => {
          root.querySelector('[data-copy]').addEventListener('click', async () => {
            try {
              await navigator.clipboard.writeText(text);
              toast('Copied.', 'success');
            } catch {
              toast('Select the text and copy it by hand.', 'warning');
            }
          });
        }
      });
    } catch (err) { toast(err.message, 'error'); }
  }
}

function answerSummary(question) {
  if (isChoiceQuestion(question.type)) {
    const index = Number(question.answer);
    return `Answer: ${String.fromCharCode(65 + index)}. ${String(question.options[index] || '').slice(0, 50)}`;
  }
  return `Answer: ${String(question.answer).slice(0, 60)}`;
}

/** A tiny "pick one from a list" dialog used by the bulk actions. */
function chooseDialog(title, options) {
  return new Promise((resolve) => {
    const { close } = modal({
      title,
      body: `<div class="field"><select class="select" data-choice>
        ${options.map(([value, label]) => `<option value="${esc(value)}">${esc(label)}</option>`).join('')}
      </select></div>`,
      footer: `
        <button type="button" class="btn" data-cancel>Cancel</button>
        <button type="button" class="btn btn-primary" data-confirm>Apply</button>`,
      onOpen: ({ root }) => {
        root.querySelector('[data-cancel]').addEventListener('click', () => { close(); resolve(null); });
        root.querySelector('[data-confirm]').addEventListener('click', () => {
          const value = root.querySelector('[data-choice]').value;
          close();
          resolve(value);
        });
      }
    });
  });
}

function questionFormBody(question, topics, defaultTopic) {
  const type = question?.type || 'multiple_choice';
  const options = question?.options?.length ? question.options : ['', '', '', ''];
  return `
    ${field('Topic', `<select class="select" data-topic>
      ${topics.map((t) => {
    const selected = question ? question.topicId === t.id : String(defaultTopic) === String(t.id);
    return `<option value="${t.id}" ${selected ? 'selected' : ''}>${esc(t.subjectName)} — ${esc(t.name)}</option>`;
  }).join('')}
    </select>`)}

    ${field('Question type', `<select class="select" data-type>
      ${Object.entries(TYPE_LABELS).map(([value, label]) =>
    `<option value="${value}" ${type === value ? 'selected' : ''}>${label}</option>`).join('')}
    </select>`)}

    ${field('Question', `<textarea class="textarea" data-prompt rows="3" placeholder="What are you asking?">${esc(question?.prompt || '')}</textarea>`)}
    ${field('Code sample (optional)', `<textarea class="textarea code-input" data-code rows="5" placeholder="Shown above the answers, in a code box.">${esc(question?.code || '')}</textarea>`)}

    <div data-answer-area>${answerArea(type, options, question?.answer)}</div>

    ${field('Explanation', `<textarea class="textarea" data-explanation rows="3" placeholder="Shown after answering. Explain why the answer is right.">${esc(question?.explanation || '')}</textarea>`)}

    <div class="grid grid-3">
      ${field('Difficulty', `<select class="select" data-difficulty>
        ${Object.entries(DIFFICULTY_LABELS).map(([value, label]) =>
    `<option value="${value}" ${question?.difficulty === value ? 'selected' : ''}>${label}</option>`).join('')}
      </select>`)}
      ${field('Points', `<input class="input" type="number" min="0" max="200" data-points value="${question?.points ?? 10}">`)}
      ${field('Tags', `<input class="input" data-tags value="${esc(question?.tags || '')}" placeholder="comma, separated">`)}
    </div>

    <label class="check">
      <input type="checkbox" data-published ${!question || question.published ? 'checked' : ''}>
      <span>Published (learners can be given this question)</span>
    </label>`;
}

function answerArea(type, options, answer) {
  if (isChoiceQuestion(type)) {
    return `
      <label>Options — choose the correct one</label>
      <div class="option-editor">
        ${options.map((option, i) => `
          <div class="option-edit-row">
            <input type="radio" name="correct" value="${i}" data-correct ${String(answer) === String(i) ? 'checked' : ''}>
            <span class="option-key">${String.fromCharCode(65 + i)}</span>
            <input class="input" data-option value="${esc(option)}" placeholder="Option ${String.fromCharCode(65 + i)}">
          </div>`).join('')}
      </div>
      <button type="button" class="btn btn-xs btn-ghost" data-add-option>Add another option</button>`;
  }
  if (type === 'true_false') {
    return `
      <label>Correct answer</label>
      <select class="select" data-answer>
        <option value="true" ${String(answer) === 'true' ? 'selected' : ''}>True</option>
        <option value="false" ${String(answer) !== 'true' ? 'selected' : ''}>False</option>
      </select>`;
  }
  return field('Correct answer', `<input class="input" data-answer value="${esc(answer || '')}" placeholder="e.g. &lt;/p&gt;">`,
    'Separate several acceptable answers with a vertical bar: foo|bar. Marking ignores capitals and surrounding spaces.');
}

function readQuestionForm(root) {
  const type = root.querySelector('[data-type]').value;
  const payload = {
    topicId: Number(root.querySelector('[data-topic]').value),
    type,
    prompt: root.querySelector('[data-prompt]').value.trim(),
    code: root.querySelector('[data-code]').value,
    explanation: root.querySelector('[data-explanation]').value.trim(),
    difficulty: root.querySelector('[data-difficulty]').value,
    points: Number(root.querySelector('[data-points]').value) || 10,
    tags: root.querySelector('[data-tags]').value.trim(),
    published: root.querySelector('[data-published]').checked
  };

  if (isChoiceQuestion(type)) {
    payload.options = [...root.querySelectorAll('[data-option]')].map((node) => node.value.trim());
    const chosen = root.querySelector('[data-correct]:checked');
    payload.answer = chosen ? chosen.value : '';
  } else {
    payload.answer = root.querySelector('[data-answer]').value.trim();
  }
  return payload;
}

/** Re-renders the answer area when the question type changes. */
function wireQuestionForm(root) {
  root.querySelector('[data-type]').addEventListener('change', (event) => {
    const area = root.querySelector('[data-answer-area]');
    area.innerHTML = answerArea(event.target.value, ['', '', '', ''], '');
  });

  root.addEventListener('click', (event) => {
    if (!event.target.closest('[data-add-option]')) return;
    const rows = root.querySelector('.option-editor');
    const index = rows.children.length;
    if (index >= 10) return;
    const row = document.createElement('div');
    row.className = 'option-edit-row';
    row.innerHTML = `
      <input type="radio" name="correct" value="${index}" data-correct>
      <span class="option-key">${String.fromCharCode(65 + index)}</span>
      <input class="input" data-option placeholder="Option ${String.fromCharCode(65 + index)}">`;
    rows.append(row);
  });
}

function openQuestionForm(question, topics, defaultTopic, onSaved) {
  const editing = !!question;
  modal({
    title: editing ? 'Edit question' : 'New question',
    size: 'modal-lg',
    body: questionFormBody(question, topics, defaultTopic),
    footer: `
      <button type="button" class="btn" data-close>Cancel</button>
      <button type="button" class="btn btn-primary" data-save>${editing ? 'Save changes' : 'Add question'}</button>`,
    onOpen: ({ root, close }) => {
      wireQuestionForm(root);
      root.querySelector('[data-save]').addEventListener('click', async (event) => {
        const payload = readQuestionForm(root);
        if (!payload.prompt) { toast('Write the question first.', 'warning'); return; }
        await withBusy(event.currentTarget, async () => {
          try {
            if (editing) await api.curriculum.updateQuestion(question.id, payload);
            else await api.curriculum.createQuestion(payload);
            close();
            toast(editing ? 'Question saved.' : 'Question added.', 'success');
            onSaved();
          } catch (err) { toast(err.message, 'error'); }
        }, 'Saving...');
      });
    }
  });
}

/**
 * "Write a set" - the tool for filling out a topic quickly.
 * The administrator chooses a topic, difficulty and type, then types
 * however many questions they want in one sitting. Nothing is generated:
 * every word is theirs.
 */
function openBatchWriter(topics, defaultTopic, onSaved) {
  let count = 5;
  const drafts = [];

  const dialog = modal({
    title: 'Write a set of questions',
    size: 'modal-lg',
    body: '<div data-batch></div>',
    footer: `
      <button type="button" class="btn" data-close>Cancel</button>
      <button type="button" class="btn btn-primary" data-save>Save the set</button>`,
    onOpen: ({ root, close }) => {
      const area = root.querySelector('[data-batch]');
      renderBatch(area);

      root.addEventListener('click', (event) => {
        if (event.target.closest('[data-add-row]')) {
          drafts.push(readBatch(area)[drafts.length] || {});
          count += 1;
          renderBatch(area, readBatch(area));
        }
      });

      root.querySelector('[data-save]').addEventListener('click', async (event) => {
        const rows = readBatch(area).filter((r) => r.prompt);
        if (!rows.length) { toast('Write at least one question.', 'warning'); return; }
        await withBusy(event.currentTarget, async () => {
          try {
            const result = await api.curriculum.createQuestions({
              topicId: Number(area.querySelector('[data-topic]').value),
              questions: rows
            });
            close();
            if (result.failed.length) {
              toast(`${result.created} saved, ${result.failed.length} could not be: ${result.failed[0].error}`, 'warning');
            } else {
              toast(`${result.created} questions added.`, 'success');
            }
            onSaved();
          } catch (err) { toast(err.message, 'error'); }
        }, 'Saving...');
      });
    }
  });

  function renderBatch(area, existing = []) {
    area.innerHTML = `
      <div class="grid grid-3">
        ${field('Topic', `<select class="select" data-topic>
          ${topics.map((t) => `<option value="${t.id}" ${String(defaultTopic) === String(t.id) ? 'selected' : ''}>${esc(t.subjectName)} — ${esc(t.name)}</option>`).join('')}
        </select>`)}
        ${field('Default difficulty', `<select class="select" data-default-difficulty>
          ${Object.entries(DIFFICULTY_LABELS).map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}
        </select>`)}
        ${field('Default type', `<select class="select" data-default-type>
          ${Object.entries(TYPE_LABELS).map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}
        </select>`)}
      </div>

      <p class="small faint">
        Type each question and its four options, then mark which one is right.
        Leave a row blank to skip it.
      </p>

      <div class="batch-rows">
        ${Array.from({ length: count }, (_, i) => batchRow(i, existing[i])).join('')}
      </div>
      <button type="button" class="btn btn-sm btn-ghost" data-add-row>${icon('plus', 14)} Another question</button>`;
  }

  function batchRow(index, draft = {}) {
    const options = draft.options || ['', '', '', ''];
    return `
      <div class="batch-row" data-row="${index}">
        <div class="batch-number">${index + 1}</div>
        <div class="batch-fields">
          <input class="input" data-prompt value="${esc(draft.prompt || '')}" placeholder="Question ${index + 1}">
          <div class="option-editor">
            ${options.map((option, i) => `
              <div class="option-edit-row">
                <input type="radio" name="correct-${index}" value="${i}" data-correct ${String(draft.answer) === String(i) ? 'checked' : ''}>
                <span class="option-key">${String.fromCharCode(65 + i)}</span>
                <input class="input input-sm" data-option value="${esc(option)}" placeholder="Option ${String.fromCharCode(65 + i)}">
              </div>`).join('')}
          </div>
          <input class="input input-sm" data-explanation value="${esc(draft.explanation || '')}" placeholder="Explanation (shown after answering)">
        </div>
      </div>`;
  }

  function readBatch(area) {
    const difficulty = area.querySelector('[data-default-difficulty]').value;
    const type = area.querySelector('[data-default-type]').value;
    return [...area.querySelectorAll('[data-row]')].map((row) => {
      const chosen = row.querySelector('[data-correct]:checked');
      return {
        type,
        difficulty,
        prompt: row.querySelector('[data-prompt]').value.trim(),
        options: [...row.querySelectorAll('[data-option]')].map((node) => node.value.trim()),
        answer: chosen ? chosen.value : '0',
        explanation: row.querySelector('[data-explanation]').value.trim()
      };
    });
  }
}

function openImport(topics, onSaved) {
  modal({
    title: 'Import questions',
    size: 'modal-lg',
    body: `
      <p class="small muted">
        Paste a file produced by Export, or your own JSON array. Each question needs at least
        <code>prompt</code>, <code>answer</code> and (for choice questions) <code>options</code>.
        Entries that carry <code>subject</code> and <code>topic</code> slugs go to the right place
        automatically; anything else lands in the topic you pick below.
      </p>
      ${field('Fallback topic', `<select class="select" data-topic>
        ${topics.map((t) => `<option value="${t.id}">${esc(t.subjectName)} — ${esc(t.name)}</option>`).join('')}
      </select>`)}
      <label class="check">
        <input type="checkbox" data-skip checked>
        <span>Skip questions that already exist in that topic</span>
      </label>
      ${field('JSON', '<textarea class="textarea code-input" data-json rows="12" placeholder=\'{ "questions": [ ... ] }\'></textarea>')}`,
    footer: `
      <button type="button" class="btn" data-close>Cancel</button>
      <button type="button" class="btn btn-primary" data-save>Import</button>`,
    onOpen: ({ root, close }) => {
      root.querySelector('[data-save]').addEventListener('click', async (event) => {
        let parsed;
        try {
          parsed = JSON.parse(root.querySelector('[data-json]').value);
        } catch {
          toast('That is not valid JSON. Check for a missing comma or bracket.', 'error');
          return;
        }
        const questions = Array.isArray(parsed) ? parsed : parsed.questions;
        if (!Array.isArray(questions) || !questions.length) {
          toast('No questions found in that file.', 'warning');
          return;
        }
        await withBusy(event.currentTarget, async () => {
          try {
            const result = await api.curriculum.importQuestions({
              questions,
              topicId: Number(root.querySelector('[data-topic]').value),
              skipDuplicates: root.querySelector('[data-skip]').checked
            });
            close();
            toast(`${result.created} imported, ${result.skipped} skipped, ${result.failed.length} failed.`,
              result.failed.length ? 'warning' : 'success');
            onSaved();
          } catch (err) { toast(err.message, 'error'); }
        }, 'Importing...');
      });
    }
  });
}

// ===========================================================================
// Learning analytics
// ===========================================================================
export async function learningSection(panel) {
  const data = await api.curriculum.analytics();
  const t = data.totals;

  const tile = (label, value, iconName, tone = '') => `
    <div class="stat">
      <div class="stat-icon" ${tone ? `style="background:var(--${tone}-soft);color:var(--${tone})"` : ''}>${icon(iconName, 19)}</div>
      <div class="stat-body"><div class="stat-value">${value}</div><div class="stat-label">${esc(label)}</div></div>
    </div>`;

  panel.innerHTML = `
    <div class="grid grid-4">
      ${tile('Subjects', `${t.publishedSubjects}/${t.subjects}`, 'book')}
      ${tile('Topics', t.topics, 'grid')}
      ${tile('Lessons published', t.publishedLessons, 'book', 'success')}
      ${tile('Lessons in draft', t.draftLessons, 'edit', t.draftLessons ? 'warning' : '')}
      ${tile('Questions', t.publishedQuestions, 'target')}
      ${tile('Challenges', t.challenges, 'zap')}
      ${tile('Learners', t.learners, 'users')}
      ${tile('Average accuracy', `${data.averageAccuracy}%`, 'chart', data.averageAccuracy >= 70 ? 'success' : '')}
      ${tile('Lessons completed', t.lessonsCompleted, 'check')}
      ${tile('Questions answered', t.questionsAnswered, 'target')}
      ${tile('Challenges completed', t.challengesCompleted, 'zap')}
      ${tile('Question bank total', t.questions, 'grid')}
    </div>

    <div class="grid grid-2" style="margin-top:1.25rem">
      <div class="card">
        <div class="card-header"><span class="card-title-icon">${icon('warning', 17)}</span><h3>Hardest topics</h3></div>
        ${data.hardestTopics.length ? `
          <div class="list">
            ${data.hardestTopics.map((t2) => `
              <div class="list-item">
                <div class="meta">
                  <div class="title">${esc(t2.name)}</div>
                  <div class="sub">${esc(t2.subject_name)} &middot; ${t2.answered} attempts</div>
                </div>
                <span class="badge ${t2.accuracy < 50 ? 'badge-danger' : 'badge-warning'}">${t2.accuracy}%</span>
              </div>`).join('')}
          </div>` : '<p class="small faint center">Not enough attempts yet.</p>'}
      </div>

      <div class="card">
        <div class="card-header"><span class="card-title-icon">${icon('chart', 17)}</span><h3>Most studied subjects</h3></div>
        ${data.popularSubjects.length ? `
          <div class="list">
            ${data.popularSubjects.map((s) => `
              <div class="list-item">
                <div class="meta"><div class="title">${esc(s.name)}</div></div>
                <span class="badge">${s.opens} lesson opens</span>
              </div>`).join('')}
          </div>` : '<p class="small faint center">Nothing studied yet.</p>'}
      </div>

      <div class="card">
        <div class="card-header"><span class="card-title-icon">${icon('edit', 17)}</span><h3>Topics that need content</h3></div>
        <p class="small faint">Published topics with the fewest questions. The specification aims for 100 per topic.</p>
        <div class="list">
          ${data.thinnestTopics.map((t2) => `
            <a class="list-item" href="#/admin/questions?topic=${t2.id}">
              <div class="meta">
                <div class="title">${esc(t2.name)}</div>
                <div class="sub">${esc(t2.subject_name)} &middot; ${t2.lessons} lessons</div>
              </div>
              <span class="badge ${t2.questions ? '' : 'badge-danger'}">${t2.questions} questions</span>
            </a>`).join('')}
        </div>
      </div>

      <div class="card">
        <div class="card-header"><span class="card-title-icon">${icon('trophy', 17)}</span><h3>Top learners</h3></div>
        ${data.topLearners.length ? `
          <div class="list">
            ${data.topLearners.map((l) => `
              <a class="list-item" href="#/profile/${esc(l.user?.username || '')}">
                <div class="meta">
                  <div class="title">${esc(l.user?.displayName || 'Unknown')}</div>
                  <div class="sub">${l.questionsAnswered} questions answered</div>
                </div>
                <span class="badge badge-accent">${l.lessonsCompleted} lessons</span>
              </a>`).join('')}
          </div>` : '<p class="small faint center">Nobody has finished a lesson yet.</p>'}
      </div>
    </div>

    <div class="card" style="margin-top:1.25rem">
      <div class="card-header"><span class="card-title-icon">${icon('clock', 17)}</span><h3>Latest answers</h3></div>
      ${data.recentAttempts.length ? `
        <div class="list">
          ${data.recentAttempts.map((a) => `
            <div class="list-item">
              <span class="attempt-mark ${a.correct ? 'correct' : 'wrong'}">${icon(a.correct ? 'check' : 'close', 13)}</span>
              <div class="meta">
                <div class="title" style="white-space:normal">${esc(a.prompt.slice(0, 90))}</div>
                <div class="sub">${esc(a.user?.displayName || 'Someone')} &middot; ${esc(a.topicName)} &middot; ${timeAgo(a.createdAt)}</div>
              </div>
            </div>`).join('')}
        </div>` : '<p class="small faint center">No questions answered yet.</p>'}
    </div>`;
}
