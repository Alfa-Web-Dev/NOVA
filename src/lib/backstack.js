import { useEffect, useRef } from 'react';
// History-stack so Android hardware back / browser back closes the top-most full-screen page.
const stack = [];
let skip = 0;
let bound = false;
function onPop() {
  if (skip > 0) { skip--; return; }
  const e = stack.pop();
  if (e) { e.popped = true; e.fn(); }
}
export function useBackClose(fn) {
  const ref = useRef(fn); ref.current = fn;
  useEffect(() => {
    if (!bound) { window.addEventListener('popstate', onPop); bound = true; }
    const entry = { fn: () => ref.current(), popped: false };
    stack.push(entry);
    try { window.history.pushState({ nova: 1 }, ''); } catch { /* ignore */ }
    return () => {
      const i = stack.indexOf(entry); if (i >= 0) stack.splice(i, 1);
      if (!entry.popped) { skip++; try { window.history.back(); } catch { skip--; } }
    };
  }, []);
}
