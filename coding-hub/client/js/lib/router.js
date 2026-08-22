// ==========================================================
// Hash based router. Every screen registers a pattern such as
// "/clubs/:id" and receives { params, query, mount }.
// ==========================================================

const routes = [];
let current = null;
let notFound = null;
let beforeEach = null;
let rootMount = null;

export function route(pattern, loader) {
  const keys = [];
  const regex = new RegExp(`^${pattern
    .replace(/\/:([^/]+)/g, (_m, key) => { keys.push(key); return '/([^/]+)'; })
    .replace(/\*/g, '.*')}$`);
  routes.push({ pattern, regex, keys, loader });
}

export function setNotFound(loader) { notFound = loader; }
export function setGuard(fn) { beforeEach = fn; }

export function navigate(path, { replace = false } = {}) {
  const target = path.startsWith('#') ? path : `#${path}`;
  if (replace) window.location.replace(target);
  else window.location.hash = target;
}

export function currentPath() {
  const hash = window.location.hash.slice(1) || '/';
  return hash.startsWith('/') ? hash : `/${hash}`;
}

function parse(fullPath) {
  const [path, queryString = ''] = fullPath.split('?');
  const query = Object.fromEntries(new URLSearchParams(queryString));
  return { path: path.replace(/\/+$/, '') || '/', query, full: fullPath };
}

/**
 * Swaps the mount for an empty copy of itself.
 * Views attach delegated listeners to their mount, so reusing the same
 * element between screens would stack a new listener on every navigation
 * and fire each handler more than once.
 */
function freshMount() {
  const replacement = rootMount.cloneNode(false);
  rootMount.replaceWith(replacement);
  rootMount = replacement;
  return replacement;
}

export async function resolve() {
  const { path, query, full } = parse(currentPath());

  if (beforeEach) {
    const redirect = await beforeEach({ path, query });
    if (redirect) { navigate(redirect, { replace: true }); return; }
  }

  for (const entry of routes) {
    const match = entry.regex.exec(path);
    if (!match) continue;
    const params = Object.fromEntries(entry.keys.map((key, i) => [key, decodeURIComponent(match[i + 1])]));
    current?.destroy?.();
    current = null;
    const mount = freshMount();
    const view = await entry.loader({ params, query, path, full, mount });
    current = view || null;
    window.scrollTo(0, 0);
    return;
  }

  current?.destroy?.();
  current = null;
  await notFound?.({ path, mount: freshMount() });
}

/** Starts listening for hash changes. */
export function startRouter(mount) {
  rootMount = mount;
  const run = () => resolve().catch((err) => {
    console.error('[router]', err);
    rootMount.innerHTML = `<div class="page page-narrow"><div class="card">
      <h2>Something went wrong</h2>
      <p class="muted">${err.message}</p>
      <button class="btn btn-primary" onclick="location.reload()">Reload the page</button>
    </div></div>`;
  });
  window.addEventListener('hashchange', run);
  run();
  return run;
}

export const reload = () => resolve();
