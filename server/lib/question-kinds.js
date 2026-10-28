// ==========================================================
// The kinds of practice question, and how each one is marked.
//
// Marking always happens on the server. The browser is told what
// kind of question it is so it can draw the right input, but never
// what the answer is until the student has answered.
// ==========================================================

export const KINDS = {
  multiple_choice: {
    label: 'Multiple choice',
    hint: 'Several answers, one of them right.',
    needsOptions: true,
    needsCode: false
  },
  true_false: {
    label: 'True or false',
    hint: 'A statement that is either true or false.',
    needsOptions: false,          // the two options are fixed
    needsCode: false,
    fixedOptions: ['True', 'False']
  },
  fill_blank: {
    label: 'Fill in the blank',
    hint: 'The student types the missing word. Use ___ in the question to show the gap.',
    needsOptions: false,
    needsCode: false,
    needsAccepted: true
  },
  find_bug: {
    label: 'Find the bug',
    hint: 'Show some code and ask what is wrong with it.',
    needsOptions: true,
    needsCode: true
  },
  output: {
    label: 'What is the output',
    hint: 'Show some code and ask what it prints.',
    needsOptions: true,
    needsCode: true
  }
};

export const KIND_KEYS = Object.keys(KINDS);
export const isKind = (value) => KIND_KEYS.includes(value);

/** Answers typed by hand are compared forgivingly, not character by character. */
export function normaliseText(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
    // Tidy spacing first, so trailing punctuation is really at the end.
    .replace(/[.,!?;:]+$/g, '')
    .trim();
}

/**
 * Marks one answer.
 * `given` is the chosen option number, or the typed text for a blank.
 * Returns { correct, expected } where `expected` is only used to show
 * the student the right answer afterwards.
 */
export function markAnswer(row, given) {
  const kind = isKind(row.kind) ? row.kind : 'multiple_choice';

  if (kind === 'fill_blank') {
    let accepted = [];
    try { accepted = JSON.parse(row.accepted_json || '[]'); } catch { accepted = []; }
    const typed = normaliseText(given);
    if (!typed) return { correct: false, expected: accepted[0] || '' };
    const correct = accepted.some((a) => normaliseText(a) === typed);
    return { correct, expected: accepted[0] || '' };
  }

  // Everything else is "pick one of the options".
  let options = [];
  try { options = JSON.parse(row.options_json || '[]'); } catch { options = []; }
  const chosen = Number(given);
  if (!Number.isInteger(chosen) || chosen < 0 || chosen >= options.length) {
    return { correct: false, expected: options[row.answer_index], invalid: true };
  }
  return { correct: chosen === row.answer_index, expected: options[row.answer_index] };
}

/**
 * Checks a question a teacher is trying to save, and returns the
 * values ready to store. Throws a readable message when something
 * is missing, so the teacher is told exactly what to fix.
 */
export function prepareQuestion(input, fail) {
  const kind = isKind(input.kind) ? input.kind : 'multiple_choice';
  const spec = KINDS[kind];
  const out = {
    kind,
    options_json: '[]',
    answer_index: 0,
    accepted_json: '',
    code_snippet: spec.needsCode ? String(input.codeSnippet || '').slice(0, 2000) : ''
  };

  if (spec.needsCode && !out.code_snippet.trim()) {
    fail('Paste the code the question is about.');
  }

  if (kind === 'fill_blank') {
    const accepted = (input.accepted || [])
      .map((a) => String(a || '').trim())
      .filter(Boolean)
      .slice(0, 10);
    if (!accepted.length) fail('Give at least one answer that should be accepted.');
    out.accepted_json = JSON.stringify(accepted);
    return out;
  }

  const options = spec.fixedOptions
    ? [...spec.fixedOptions]
    : (input.options || []).map((o) => String(o || '').trim()).filter(Boolean).slice(0, 6);

  if (options.length < 2) fail('Give at least two answers to choose from.');

  const answerIndex = Number(input.answerIndex);
  if (!Number.isInteger(answerIndex) || answerIndex < 0 || answerIndex >= options.length) {
    fail('Mark which answer is the right one.');
  }

  out.options_json = JSON.stringify(options);
  out.answer_index = answerIndex;
  return out;
}
