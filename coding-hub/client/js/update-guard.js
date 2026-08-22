/* ==========================================================
   Coding Hub - update guard.
   Runs before the application, on every page load.

   index.html always comes from the server, but the service worker
   installed by the PREVIOUS version keeps serving the JavaScript it
   cached last time. Without this, the first launch after an update
   quietly shows the OLD app: new screens look like they were never
   installed, and only a manual reload brings them in.

   So whenever the version below changes, every cached copy of the app
   is thrown away and the page reloads once. The new version is written
   to storage BEFORE the reload, so it can never loop.

   This file is loaded with ?v=<version> in the URL, so an old service
   worker has no cached copy of it and must fetch it from the server.

   When releasing a new version, change VERSION here, the ?v= in
   index.html and VERSION in public/sw.js together. "npm run build"
   checks that all three agree.
   ========================================================== */
(function () {
  var VERSION = '1.0.0';

  var show = function () { document.documentElement.style.visibility = ''; };

  try {
    if (localStorage.getItem('codinghub-app-version') === VERSION) return;

    // Written before the reload, so the reload can never repeat.
    localStorage.setItem('codinghub-app-version', VERSION);
    if (!('caches' in window)) return;

    // Hide the old app rather than let it flash up before the reload.
    document.documentElement.style.visibility = 'hidden';

    caches.keys()
      .then(function (keys) {
        // No caches means this is a first run, not an update: nothing to
        // clear, and nothing to reload. Versions installed before this
        // guard existed have no stored version but DO have caches, which
        // is exactly the case that needs clearing.
        if (!keys.length) { show(); return null; }
        return Promise.all(keys.map(function (key) { return caches.delete(key); }))
          .then(function () { location.reload(); });
      })
      .catch(show);
  } catch (error) {
    // Storage is blocked (a private window, or site data switched off).
    // The app still works; it just cannot tidy up after an update.
  }
})();
