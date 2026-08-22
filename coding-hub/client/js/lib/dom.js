// ==========================================================
// Small helpers for building the interface without a framework.
// ==========================================================

/** Escapes text so user content can never inject HTML. */
export function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Tagged template that escapes every interpolated value. */
export function html(strings, ...values) {
  return strings.reduce((out, part, i) => {
    if (i === 0) return part;
    const value = values[i - 1];
    const text = Array.isArray(value) ? value.join('') : (value ?? '');
    return out + (value?.__raw ? value.value : esc(text)) + part;
  }, '');
}

/** Marks a string as already-safe HTML for use inside html``. */
export const raw = (value) => ({ __raw: true, value: String(value ?? '') });

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'class') node.className = value;
    else if (key === 'html') node.innerHTML = value;
    else if (key === 'text') node.textContent = value;
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2).toLowerCase(), value);
    else if (value !== null && value !== undefined && value !== false) node.setAttribute(key, value);
  }
  for (const child of [].concat(children)) {
    if (child === null || child === undefined) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

/** Attaches one delegated handler for a whole container. */
export function delegate(root, eventName, selector, handler) {
  root.addEventListener(eventName, (event) => {
    const match = event.target.closest(selector);
    if (match && root.contains(match)) handler(event, match);
  });
}

// ---------- Dates ----------
export function timeAgo(value) {
  if (!value) return '';
  const then = parseDate(value);
  const seconds = Math.floor((Date.now() - then.getTime()) / 1000);
  if (seconds < 45) return 'just now';
  if (seconds < 90) return 'a minute ago';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} week${days < 14 ? '' : 's'} ago`;
  return formatDate(then);
}

/** SQLite stores "YYYY-MM-DD HH:MM:SS" in UTC. */
export function parseDate(value) {
  if (value instanceof Date) return value;
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(text)) return new Date(`${text.replace(' ', 'T')}Z`);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return new Date(`${text}T12:00:00`);
  return new Date(text);
}

export function formatDate(value, options = { day: 'numeric', month: 'short', year: 'numeric' }) {
  const date = parseDate(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, options);
}

export function formatTime(value) {
  const date = parseDate(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function formatDateTime(value) {
  return `${formatDate(value)} at ${formatTime(value)}`;
}

/** "Due Friday, 21 August" style text plus how urgent it is. */
export function dueLabel(value) {
  const date = parseDate(value);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due = new Date(date); due.setHours(0, 0, 0, 0);
  const days = Math.round((due - today) / 86_400_000);

  let text;
  if (days === 0) text = 'Due today';
  else if (days === 1) text = 'Due tomorrow';
  else if (days === -1) text = 'Due yesterday';
  else if (days < 0) text = `${Math.abs(days)} days overdue`;
  else if (days < 7) text = `Due ${date.toLocaleDateString(undefined, { weekday: 'long' })}`;
  else text = `Due ${formatDate(date)}`;

  const tone = days < 0 ? 'danger' : (days === 0 ? 'warning' : (days === 1 ? 'info' : ''));
  return { text, tone, days, full: date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }) };
}

export function initials(name) {
  return String(name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || '?';
}

export function plural(count, singular, pluralForm) {
  return `${count} ${count === 1 ? singular : (pluralForm || `${singular}s`)}`;
}

/** Turns line breaks and internal #/links into safe HTML. */
export function richText(text) {
  const escaped = esc(text);
  return escaped
    .replace(/(#\/[\w/?=&.-]+)/g, '<a href="$1">$1</a>')
    .replace(/\n/g, '<br>');
}

export function debounce(fn, wait = 250) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

export function scrollToBottom(node, smooth = false) {
  if (!node) return;
  node.scrollTo({ top: node.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
}
