/* Markdown syntax highlighting for osu! discussion/reply textareas.
 * IMPORTANT: Native React textarea DOM remains untouched (no wrapping, sibling
 * insertion, replacing, or contentEditable changes). Mirroring happens in a
 * separate, pointer-transparent portal under document.body.
 * The original textarea remains the only editor and submit source.
 */
(() => {
  'use strict';
  const states = new WeakMap();
  const tracked = new Set();
  const selector = '.beatmap-discussion-new__message textarea, .beatmap-discussion-post--new-reply textarea, .beatmap-discussion-post__message--editor textarea, .beatmap-discussion-post--reply textarea';
  const LIMIT = 30000;
  // New Review is a Slate editor, not an ordinary Markdown textarea. Never
  // install a source-colouring overlay anywhere on its page, even if osu! adds
  // a matching textarea for an embed, inline reply, or future editor widget.
  // This is deliberately independent of the global highlighting preference.
  function isReviewPage() {
    if (/\/discussion\/(?:-\/)?reviews(?:\/|$)/i.test(location.pathname)) return true;
    return [...document.querySelectorAll('.beatmap-discussion-new .page-title')]
      .some(title => /^\s*New Review\b/i.test(title.textContent || ''));
  }
  const create = (tag, classes = '') => {
    const el = document.createElement(tag);
    el.className = classes;
    return el;
  };
  // Deliberately bounded patterns. Do not run a Markdown parser on each keystroke.
  // Priority: images/links, code, strong/emphasis, timestamps, bare URLs.
  const inlineTokens = /!?\[[^\]\n]{0,250}\]\([^\s)\n]{1,2048}\)|<https?:\/\/[^\s<>]{1,2048}>|https?:\/\/[^\s<>"'`]{1,2048}|`{1,2}[^`\n]{1,800}`{1,2}|\*\*\*[^*\n]{1,600}\*\*\*|\*\*[^*\n]{1,600}\*\*|__[^_\n]{1,600}__|~~[^~\n]{1,600}~~|(?<![\w*])\*[^*\n]{1,600}\*(?!\w)|(?<!\w)_[^_\n]{1,600}_(?!\w)|\b\d{2}:\d{2}:\d{3}(?:\s*\([^\n)]{0,350}\))?/g;
  const blockTokens = /^\s{0,3}(?:#{1,6}[ \t]|>[ \t]?|[-+*][ \t]|\d{1,3}[.)][ \t])/;
  const fenceStart = /^\s{0,3}(`{3,}|~{3,})/;

  function kind(token) {
    if (/^!?\[/.test(token) || /^https?:\/\//.test(token) || /^<https?:/.test(token)) return 'kmh-md-link';
    if (/^`/.test(token)) return 'kmh-md-code-token';
    if (/^\d{2}:\d{2}:\d{3}/.test(token)) return 'kmh-md-timestamp';
    return 'kmh-md-emphasis';
  }
  function mark(target, value, type) {
    const span = create('span', `kmh-md-token ${type}`);
    span.textContent = value;
    target.append(span);
  }
  function highlightLine(target, line, withinFence) {
    if (withinFence) { mark(target, line, 'kmh-md-code-token'); return; }
    const prefix = blockTokens.exec(line);
    let cursor = 0;
    if (prefix) {
      mark(target, prefix[0], 'kmh-md-block');
      cursor = prefix[0].length;
    }
    inlineTokens.lastIndex = cursor;
    let m;
    while ((m = inlineTokens.exec(line)) !== null) {
      if (m.index > cursor) target.append(document.createTextNode(line.slice(cursor, m.index)));
      mark(target, m[0], kind(m[0]));
      cursor = inlineTokens.lastIndex;
    }
    if (cursor < line.length) target.append(document.createTextNode(line.slice(cursor)));
  }
  function render(state) {
    if (isReviewPage()) { detach(state); return; }
    if (!state.enabled || !state.field.isConnected) return;
    const source = state.field.value;
    state.suspended = source.length > LIMIT;
    if (state.suspended) {
      // Never hide native text if preview is too large to process efficiently.
      state.portal.hidden = true;
      state.field.classList.remove('kmh-md-original-transparent');
      return;
    }
    const fragment = document.createDocumentFragment();
    const lines = source.split('\n');
    let fenceChar = null;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const fenceMarker = fenceStart.exec(line);
      const wasInFence = fenceChar !== null;
      if (!wasInFence && fenceMarker) fenceChar = fenceMarker[1][0];
      highlightLine(fragment, line, fenceChar !== null);
      if (wasInFence && fenceMarker && fenceMarker[1][0] === fenceChar) fenceChar = null;
      if (i < lines.length - 1) fragment.append(document.createTextNode('\n'));
    }
    if (!source || source.endsWith('\n')) fragment.append(document.createTextNode('\u200b'));
    state.code.replaceChildren(fragment);
    state.field.classList.add('kmh-md-original-transparent');
    position(state);
    state.portal.scrollTop = state.field.scrollTop;
    state.portal.scrollLeft = state.field.scrollLeft;
  }
  function position(state) {
    if (isReviewPage()) { detach(state); return; }
    const field = state.field;
    if (!state.enabled || state.suspended || !field.isConnected || document.hidden) { state.portal.hidden = true; return; }
    const rect = field.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2 || rect.bottom <= 0 || rect.top >= innerHeight) {
      state.portal.hidden = true;
      return;
    }
    let left = Math.max(0, rect.left), top = Math.max(0, rect.top);
    let right = Math.min(innerWidth, rect.right), bottom = Math.min(innerHeight, rect.bottom);
    // Respect clipping of native scroll containers (e.g. the discussion panel).
    let parent = field.parentElement;
    while (parent && parent !== document.body) {
      const style = getComputedStyle(parent);
      if (/(auto|scroll|hidden|clip)/.test(style.overflowX + style.overflowY)) {
        const bounds = parent.getBoundingClientRect();
        left = Math.max(left, bounds.left);
        right = Math.min(right, bounds.right);
        top = Math.max(top, bounds.top);
        bottom = Math.min(bottom, bounds.bottom);
      }
      parent = parent.parentElement;
    }
    if (right <= left || bottom <= top) { state.portal.hidden = true; return; }
    const css = getComputedStyle(field);
    state.portal.hidden = false;
    state.portal.style.left = `${rect.left}px`;
    state.portal.style.top = `${rect.top}px`;
    state.portal.style.width = `${rect.width}px`;
    state.portal.style.height = `${rect.height}px`;
    state.portal.style.clipPath = `inset(${Math.max(0, top - rect.top)}px ${Math.max(0, rect.right - right)}px ${Math.max(0, rect.bottom - bottom)}px ${Math.max(0, left - rect.left)}px)`;
    for (const prop of ['fontFamily','fontSize','fontWeight','fontStyle','lineHeight','letterSpacing','textAlign','textIndent','tabSize','padding','borderWidth','borderStyle','borderRadius','boxSizing','wordBreak','direction']) state.portal.style[prop] = css[prop];
  }
  let raf = 0;
  function schedule() {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      for (const state of tracked) {
        if (!state.field.isConnected) { detach(state); continue; }
        if (state.enabled) position(state);
      }
    });
  }
  function detach(state) {
    tracked.delete(state);
    states.delete(state.field); // allow a surviving textarea to attach again after leaving Reviews
    state.enabled = false;
    state.listeners?.forEach(([type, listener]) => state.field.removeEventListener(type, listener));
    state.listeners = [];
    state.resize?.disconnect();
    state.portal.remove();
    state.field.classList.remove('kmh-md-original-transparent');
  }
  function toggle(field, forced) {
    if (isReviewPage()) {
      const old = states.get(field);
      if (old) detach(old);
      return false;
    }
    const state = states.get(field) ?? attach(field);
    if (!state) return false;
    state.enabled = typeof forced === 'boolean' ? forced : !state.enabled;
    state.field.classList.toggle('kmh-md-original-transparent', state.enabled);
    state.portal.hidden = !state.enabled;
    for (const button of document.querySelectorAll('[data-kmh-toggle-markdown]')) {
      if (button._kmhField !== field) continue;
      button.setAttribute('aria-pressed', String(state.enabled));
      button.classList.toggle('is-active', state.enabled);
      button.title = state.enabled ? 'Turn off Markdown highlighting' : 'Highlight Markdown in editor';
    }
    if (state.enabled) render(state);
    if (typeof forced !== 'boolean') {
      try { chrome.storage.local.set({kmhMarkdownHighlight:state.enabled}); } catch {}
    }
    return state.enabled;
  }
  let preference = true;
  try {
    chrome.storage.local.get({kmhMarkdownHighlight:true}, opts => {
      if (chrome.runtime.lastError) return;
      preference = opts.kmhMarkdownHighlight !== false;
      for (const state of tracked) toggle(state.field, preference);
    });
  } catch { /* Default on in environments without extension storage. */ }
  function attach(field) {
    if (isReviewPage()) return null;
    if (states.has(field)) return states.get(field);
    if (field.closest('.beatmap-discussion-editor')) return null; // Slate Review editor is not a textarea
    const portal = create('div', 'kmh-md-portal');
    const code = create('div', 'kmh-md-code');
    portal.setAttribute('aria-hidden', 'true');
    portal.append(code);
    // Outside React-owned markup. React can now rerender its textarea safely.
    document.body.append(portal);
    const state = {field,portal,code,enabled:false,composing:false};
    states.set(field,state); tracked.add(state);
    const onInput=()=>{ if(!state.composing) render(state); };
    const onStart=()=>{state.composing=true;};
    const onEnd=()=>{state.composing=false;render(state);};
    const onScroll=()=>{if(state.enabled){portal.scrollTop=field.scrollTop;portal.scrollLeft=field.scrollLeft;}};
    state.listeners=[['input',onInput],['compositionstart',onStart],['compositionend',onEnd],['scroll',onScroll]];
    for (const [type, listener] of state.listeners) field.addEventListener(type,listener,{passive:type==='scroll'});
    if (typeof ResizeObserver !== 'undefined') { state.resize = new ResizeObserver(schedule); state.resize.observe(field); }
    toggle(field,preference);
    return state;
  }
  function locate(node) {
    const host = node?.closest?.('.beatmap-discussion-new, .beatmap-discussion-post--new-reply, .beatmap-discussion-post--reply, .beatmap-discussion-post__message--editor');
    const field = host?.querySelector('textarea');
    return field && states.has(field) ? field : null;
  }
  function reconcile() {
    if (isReviewPage()) {
      for (const state of [...tracked]) detach(state);
      return;
    }
    document.querySelectorAll(selector).forEach(field=>attach(field));
    for (const state of tracked) if(!state.field.isConnected)detach(state);
  }
  window.addEventListener('resize',schedule,{passive:true});
  window.addEventListener('scroll',schedule,{capture:true,passive:true});
  document.addEventListener('visibilitychange',schedule);
  window.KmhMarkdownOverlay={reconcile,attach,toggle,locate,isEnabled:field=>!isReviewPage() && !!states.get(field)?.enabled};
})();
