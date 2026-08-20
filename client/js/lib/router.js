// ==========================================================
// Hash based router. Every screen registers a pattern such as
// "/clubs/:id" and receives { params, query, mount }.
// ==========================================================

const routes = [];
let current = null;
let notFound = null;
let beforeEach = null;

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

export async function resolve(mount) {
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
    mount.innerHTML = '';
    const view = await entry.loader({ params, query, path, full, mount });
    current = view || null;
    document.querySelector('.page')?.scrollTo?.(0, 0);
    window.scrollTo(0, 0);
    return;
  }

  current?.destroy?.();
  current = null;
  mount.innerHTML = '';
  await notFound?.({ path, mount });
}

/** Starts listening for hash changes. */
export function startRouter(mount) {
  const run = () => resolve(mount).catch((err) => {
    console.error('[router]', err);
    mount.innerHTML = `<div class="page page-narrow"><div class="card">
      <h2>Something went wrong</h2>
      <p class="muted">${err.message}</p>
      <button class="btn btn-primary" onclick="location.reload()">Reload the page</button>
    </div></div>`;
  });
  window.addEventListener('hashchange', run);
  run();
  return run;
}

export const reload = (mount) => resolve(mount);
