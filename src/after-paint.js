/* =====================================================
 * AFTER THE PAINT
 * =====================================================
 * Three.js and a scene built on it come to about 600 kB,
 * and none of it is needed to read the page. So a page
 * asks for its 3D through here: the browser paints what
 * it already has, and the scene arrives in the idle time
 * just after. Nothing on the page waits for it.
 * ===================================================== */

/** Load a scene module — `() => import('./x-scene.js')` — once the page is up. */
export function afterPaint(load) {
  let started = false;
  const go = () => {
    if (started) return;
    started = true;
    load().catch((err) => {
      // a scene that cannot load should not take the page with it
      console.error('3D failed to load', err);
    });
  };

  const start = () => {
    // one frame to lay the page out, one to put it on screen, then ask for
    // whatever time the browser has spare
    requestAnimationFrame(() => requestAnimationFrame(() => idle(go)));
    // Both of those stop in a background tab, so a page opened in one would
    // wait for ever. A timer still runs there, throttled — the floor.
    setTimeout(go, 1200);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
}

function idle(run) {
  if (typeof requestIdleCallback === 'function') requestIdleCallback(run, { timeout: 600 });
  else setTimeout(run, 80);
}

/** Run `fn` when the page has finished loading — or now, if it already has.
 *  A module that loads late can miss the `load` event altogether. */
export function onceLoaded(fn) {
  if (document.readyState === 'complete') requestAnimationFrame(fn);
  else window.addEventListener('load', fn, { once: true });
}
