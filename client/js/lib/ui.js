// ==========================================================
// Toasts, modals and confirmation dialogs.
// ==========================================================
import { icon } from './icons.js';
import { esc } from './dom.js';

const stack = () => document.getElementById('toast-stack');
const modalRoot = () => document.getElementById('modal-root');

/** Small message in the corner. type: info | success | error | warning */
export function toast(message, type = 'info', title = '') {
  const node = document.createElement('div');
  node.className = `toast ${type}`;
  const iconName = { success: 'check', error: 'warning', warning: 'warning', info: 'info' }[type] || 'info';
  node.innerHTML = `
    <span style="color:var(--${type === 'info' ? 'accent' : type}); flex:0 0 auto; margin-top:1px">${icon(iconName, 17)}</span>
    <div class="toast-body">
      ${title ? `<div class="toast-title">${esc(title)}</div>` : ''}
      <div class="toast-text">${esc(message)}</div>
    </div>
    <button type="button" aria-label="Dismiss">${icon('close', 14)}</button>`;

  node.querySelector('button').addEventListener('click', () => remove());
  stack().append(node);

  const timer = setTimeout(remove, type === 'error' ? 6500 : 4000);
  function remove() {
    clearTimeout(timer);
    node.style.opacity = '0';
    node.style.transform = 'translateY(6px)';
    node.style.transition = 'all 160ms ease';
    setTimeout(() => node.remove(), 170);
  }
  return remove;
}

/**
 * Opens a modal.
 * `render` receives { close, body } and returns HTML for the body.
 */
export function modal({ title, body, footer = '', size = '', onOpen, closeOnBackdrop = true }) {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal ${size}" role="dialog" aria-modal="true" aria-label="${esc(title || 'Dialog')}">
      ${title ? `<div class="modal-header">
        <h2>${esc(title)}</h2>
        <button type="button" class="icon-button" data-close aria-label="Close">${icon('close', 18)}</button>
      </div>` : ''}
      <div class="modal-body">${body}</div>
      ${footer ? `<div class="modal-footer">${footer}</div>` : ''}
    </div>`;

  const close = () => {
    document.removeEventListener('keydown', onKey);
    backdrop.remove();
  };
  function onKey(event) { if (event.key === 'Escape') close(); }

  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop && closeOnBackdrop) close();
    if (event.target.closest('[data-close]')) close();
  });
  document.addEventListener('keydown', onKey);
  modalRoot().append(backdrop);

  const dialog = backdrop.querySelector('.modal');
  onOpen?.({ close, root: dialog });

  const focusTarget = dialog.querySelector('input, textarea, select, button:not([data-close])');
  focusTarget?.focus();

  return { close, root: dialog };
}

/** Yes/no dialog. Resolves to true when the member confirms. */
export function confirmDialog({ title = 'Are you sure?', message = '', confirmText = 'Confirm', danger = false }) {
  return new Promise((resolve) => {
    const { close } = modal({
      title,
      body: `<p class="muted" style="margin:0">${esc(message)}</p>`,
      footer: `
        <button type="button" class="btn" data-cancel>Cancel</button>
        <button type="button" class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-confirm>${esc(confirmText)}</button>`,
      onOpen: ({ root }) => {
        root.querySelector('[data-cancel]').addEventListener('click', () => { close(); resolve(false); });
        root.querySelector('[data-confirm]').addEventListener('click', () => { close(); resolve(true); });
      }
    });
  });
}

/** Single-question prompt. Resolves to the typed text, or null. */
export function promptDialog({ title, label, placeholder = '', value = '', multiline = false, confirmText = 'Save', required = true }) {
  return new Promise((resolve) => {
    const field = multiline
      ? `<textarea class="textarea" data-input placeholder="${esc(placeholder)}">${esc(value)}</textarea>`
      : `<input class="input" data-input value="${esc(value)}" placeholder="${esc(placeholder)}">`;
    const { close } = modal({
      title,
      body: `<div class="field"><label>${esc(label)}</label>${field}</div>`,
      footer: `
        <button type="button" class="btn" data-cancel>Cancel</button>
        <button type="button" class="btn btn-primary" data-confirm>${esc(confirmText)}</button>`,
      onOpen: ({ root }) => {
        const input = root.querySelector('[data-input]');
        const submit = () => {
          const text = input.value.trim();
          if (required && !text) { input.focus(); return; }
          close();
          resolve(text);
        };
        root.querySelector('[data-cancel]').addEventListener('click', () => { close(); resolve(null); });
        root.querySelector('[data-confirm]').addEventListener('click', submit);
        input.addEventListener('keydown', (event) => {
          if (event.key === 'Enter' && !multiline) submit();
        });
      }
    });
  });
}

/** Opens a small menu anchored to a button. */
export function contextMenu(anchor, items) {
  document.querySelector('.menu')?.remove();

  const menu = document.createElement('div');
  menu.className = 'menu';
  menu.innerHTML = items.map((item) => {
    if (item === '-') return '<hr>';
    return `<button type="button" data-action="${esc(item.action)}" class="${item.danger ? 'danger' : ''}">
      ${item.icon ? icon(item.icon, 15) : ''}<span>${esc(item.label)}</span>
    </button>`;
  }).join('');

  document.body.append(menu);

  const rect = anchor.getBoundingClientRect();
  const width = menu.offsetWidth;
  const height = menu.offsetHeight;
  let left = rect.right - width + window.scrollX;
  let top = rect.bottom + 6 + window.scrollY;
  if (left < 8) left = 8;
  if (rect.bottom + height + 12 > window.innerHeight) top = rect.top - height - 6 + window.scrollY;
  menu.style.left = `${left}px`;
  menu.style.top = `${Math.max(8, top)}px`;

  return new Promise((resolve) => {
    const cleanup = () => {
      menu.remove();
      document.removeEventListener('click', onDocClick, true);
      document.removeEventListener('keydown', onKey);
    };
    function onDocClick(event) {
      const button = event.target.closest('.menu button');
      if (button && menu.contains(button)) {
        event.preventDefault();
        event.stopPropagation();
        cleanup();
        resolve(button.dataset.action);
        return;
      }
      cleanup();
      resolve(null);
    }
    function onKey(event) { if (event.key === 'Escape') { cleanup(); resolve(null); } }
    setTimeout(() => {
      document.addEventListener('click', onDocClick, true);
      document.addEventListener('keydown', onKey);
    }, 0);
  });
}

/** Shows a spinner while an async job runs, and reports failures as a toast. */
export async function withBusy(button, job, busyText = 'Working...') {
  if (!button) return job();
  const original = button.innerHTML;
  button.disabled = true;
  button.innerHTML = `<span class="spinner" style="width:15px;height:15px"></span> ${esc(busyText)}`;
  try {
    return await job();
  } finally {
    button.disabled = false;
    button.innerHTML = original;
  }
}
