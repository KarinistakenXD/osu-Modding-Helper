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
  const LIMIT = 20000; // cap live coloured DOM for responsive typing
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
  const inlineTokens = /!?\[[^\]\n]{0,250}\]\([^\s)\n]{1,2048}\)|<https?:\/\/[^\s<>]{1,2048}>|https?:\/\/[^\s<>"'`]{1,2048}|```[^`\n]{1,800}```|``[^`\n]{1,800}``|`[^`\n]{1,800}`|\*\*\*[^*\n]{1,600}\*\*\*|\*\*[^*\n]{1,600}\*\*|__[^_\n]{1,600}__|~~[^~\n]{1,600}~~|(?<![\w*])\*[^*\n]{1,600}\*(?!\w)|(?<!\w)_[^_\n]{1,600}_(?!\w)|\b\d{2}:\d{2}:\d{3}(?:\s*\([^\n)]{0,350}\))?/g;
  const blockTokens = /^\s{0,3}(?:#{1,6}[ \t]|>[ \t]?|[-+*][ \t]|\d{1,3}[.)][ \t])/;
  // A fence opener must not contain its own closing backticks in the info string.
  // Without this guard, ` ```ds``` ` is mistaken for a multi-line opener and
  // all subsequent plain text is incorrectly painted as fenced code.
  const fenceStart = /^\s{0,3}(`{3,}|~{3,})(.*)$/;
  function validFenceOpen(match) {
    return !!match && (match[1][0] !== '`' || !match[2].includes('`'));
  }
  function closesFence(match, marker) {
    return !!match && !!marker && match[1][0] === marker.char &&
      match[1].length >= marker.length && match[2].trim() === '';
  }

  // Only link/timestamp spans intercept clicks. Other mirror text remains pointer-transparent.
  // The React textarea is still the sole editable source; an Alt+click on a link places its caret.
  function safeHttpUrl(raw) {
    try {
      const u = new URL(raw);
      return /^(https?:)$/.test(u.protocol) && !u.username && !u.password && u.href.length <= 2400 ? u.href : null;
    } catch { return null; }
  }
  function timestampUrl(token) {
    const match = /^(\d{2}):(\d{2}):(\d{3})(?:\s*\([^\n)]{0,350}\))?$/.exec(token);
    if (!match || +match[2] >= 60 || +match[3] >= 1000) return null;
    return 'osu://edit/' + encodeURIComponent(token.trim())
      .replace(/%3A/gi, ':').replace(/%2C/gi, ',').replace(/%7C/gi, '|');
  }
  function openAtCaret(state) {
    const field=state.field;
    const source=field.value || '';
    const pos=field.selectionStart ?? 0;
    const links=window.KmhLinkPreview?.extract?.(source)||[];
    const match=links.find(item=>item.ranges?.some(range=>pos>=range.start&&pos<=range.end));
    if(match){ window.open(match.href,'_blank','noopener,noreferrer'); return true; }
    const times=/\b\d{2}:\d{2}:\d{3}(?:\s*\([^\n)]{0,350}\))?/g;
    let m;
    while((m=times.exec(source))){
      if(pos<m.index || pos>times.lastIndex)continue;
      const href=timestampUrl(m[0]);
      if(!href)return false;
      const a=document.createElement('a');a.href=href;document.body.append(a);a.click();a.remove();return true;
    }
    return false;
  }
  function createPart(parent,value,klass,href=null){
    if(!value)return;
    const node=create(href?'a':'span',klass);
    node.textContent=value;
    if(href){
      node.href=href;
      if(/^https?:/.test(href)){node.target='_blank';node.rel='noopener noreferrer';}
      node.classList.add('kmh-md-visit');
      // The destination tooltip is extension-owned: no duplicate browser title popup.
      node.tabIndex=-1;
    }
    parent.append(node);
  }
  function richToken(parent,value){
    // Preserve the original characters 1:1. Markdown markers are muted but
    // retained, so the React-owned textarea's selection offsets never change.
    if(value.startsWith('![')||value.startsWith('[')){
      const image=value.startsWith('!');const left=image?2:1;
      const sep=value.lastIndexOf('](');
      if(sep>=0 && value.endsWith(')')){
        const href=safeHttpUrl(value.slice(sep+2,-1));
        createPart(parent,value.slice(0,left),'kmh-md-delim');
        createPart(parent,value.slice(left,sep),image?'kmh-md-image-alt':'kmh-md-link-label',href);
        createPart(parent,'](','kmh-md-delim');
        createPart(parent,value.slice(sep+2,-1),image?'kmh-md-image-url':'kmh-md-link-url',href);
        createPart(parent,')','kmh-md-delim');return;
      }
    }
    if(value.startsWith('https://')||value.startsWith('http://')||value.startsWith('<https://')||value.startsWith('<http://')){
      const angled=value.startsWith('<');
      const unwrapped=angled?value.slice(1,-1):value;
      const clean=unwrapped.replace(/[.,;!?]+$/,'');
      const href=safeHttpUrl(clean);
      if(angled)createPart(parent,'<','kmh-md-delim');
      createPart(parent,clean,'kmh-md-bare-url',href);
      createPart(parent,unwrapped.slice(clean.length)+(angled?'>':''),'kmh-md-delim');
      return;
    }
    if(/^\d{2}:\d{2}:\d{3}/.test(value)){
      createPart(parent,value,'kmh-md-timestamp',timestampUrl(value));return;
    }
    const delimiters=['```','***','**','__','~~','``','*','_','`'];
    for(const d of delimiters){
      if(value.startsWith(d)&&value.endsWith(d)&&value.length>=d.length*2+1){
        createPart(parent,d,'kmh-md-delim');
        const klass=d==='~~'?'kmh-md-strike':d.startsWith('`')?'kmh-md-code-content':
          d==='***'?'kmh-md-bold-italic':(d==='**'||d==='__')?'kmh-md-strong-content':
          (d==='*'||d==='_')?'kmh-md-italic-content':'kmh-md-emphasis-content';
        createPart(parent,value.slice(d.length,-d.length),klass);
        createPart(parent,d,'kmh-md-delim');return;
      }
    }
    createPart(parent,value,'kmh-md-timestamp');
  }
  function highlightLine(target,line,withinFence,fence=null){
    if(withinFence){
      if(fence){const end=fence[0].length-fence[2].length;createPart(target,line.slice(0,end),'kmh-md-fence-marker');createPart(target,line.slice(end),'kmh-md-code-language');}
      else createPart(target,line,'kmh-md-code-content kmh-md-fenced-content');
      return;
    }
    const prefix=blockTokens.exec(line);
    let cursor=0;
    if(prefix){createPart(target,prefix[0],'kmh-md-block-marker');cursor=prefix[0].length;}
    inlineTokens.lastIndex=cursor;
    let match;
    while((match=inlineTokens.exec(line))!==null){
      if(match.index>cursor)createPart(target,line.slice(cursor,match.index),'kmh-md-plain-text');
      richToken(target,match[0]);cursor=inlineTokens.lastIndex;
    }
    if(cursor<line.length)createPart(target,line.slice(cursor),'kmh-md-plain-text');
  }
  function restoreNative(state) {
    if (!state) return;
    state.portal.hidden = true;
    state.field.classList.remove('kmh-md-original-transparent');
  }
  function refreshLinkInteractivity(state) {
    // The mirrored document is decorative for assistive technology, avoiding duplicate text
    // announcements. Mouse links are interactive even when the textarea is focused.
    state.portal.classList.toggle('kmh-md-editing', document.activeElement === state.field);
    state.portal.classList.toggle('kmh-md-composing', !!state.composing);
    state.portal.setAttribute('aria-hidden', 'true');
    for (const a of state.code.querySelectorAll('a.kmh-md-visit')) a.tabIndex = -1;
  }
  function hideDestination(state) {
    if (state.tooltip) state.tooltip.hidden = true;
    state.hoveredLink = null;
  }
  function showDestination(state, link, point) {
    if (!state.enabled || state.composing || !state.tooltip || !link?.isConnected) return;
    const href = link.getAttribute('href') || '';
    if (!href.startsWith('https://') && !href.startsWith('http://') && !href.startsWith('osu://edit/')) return;
    state.hoveredLink = link;
    const osu = href.startsWith('osu://edit/');
    state.tooltip.replaceChildren();
    const label = create('strong', 'kmh-md-destination-label');
    label.textContent = osu ? 'Open timestamp in osu! editor' : 'Open link in new tab';
    const destination = create('span', 'kmh-md-destination-url');
    destination.textContent = href;
    state.tooltip.append(label, destination);
    state.tooltip.hidden = false;
    const rectangles = [...link.getClientRects()];
    const nearest = rectangles.find(rect => point && point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom) || link.getBoundingClientRect();
    const b = state.tooltip.getBoundingClientRect();
    const x = Math.max(8, Math.min(innerWidth - b.width - 8, (point?.x ?? nearest.left) + 8));
    const y = nearest.top > b.height + 12 ? nearest.top - b.height - 7 : nearest.bottom + 7;
    state.tooltip.style.left = `${Math.round(x)}px`;
    state.tooltip.style.top = `${Math.round(Math.max(8, Math.min(innerHeight - b.height - 8, y)))}px`;
  }
  function placeCaretAtPoint(state, event, link) {
    // Supports a deliberate editing gesture without replacing textarea input, selection or IME.
    const point = document.caretPositionFromPoint?.(event.clientX, event.clientY);
    const rangeFromPoint = !point ? document.caretRangeFromPoint?.(event.clientX, event.clientY) : null;
    const node = point?.offsetNode ?? rangeFromPoint?.startContainer;
    const offset = point?.offset ?? rangeFromPoint?.startOffset;
    let index = -1;
    if (node && state.code.contains(node) && offset != null) {
      try {
        const before = document.createRange();
        before.setStart(state.code, 0);
        before.setEnd(node, offset);
        index = before.toString().length;
      } catch { /* Browser caret range can be outside the mirror. */ }
    }
    if (index < 0) {
      const source = state.field.value || '';
      index = source.indexOf(link.textContent || '');
      if (index < 0) index = state.field.selectionStart;
    }
    state.field.focus({preventScroll:true});
    state.field.setSelectionRange(index, index);
    hideDestination(state);
  }
  function render(state) {
    if (isReviewPage()) { detach(state); return; }
    if (!state.enabled || !state.field.isConnected || state.composing) return;
    const source = state.field.value;
    state.suspended = source.length > LIMIT;
    if (state.suspended) {
      // Never hide native text if preview is too large to process efficiently.
      restoreNative(state);
      return;
    }
    const fragment = document.createDocumentFragment();
    const lines = source.split('\n');
    let openFence = null;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const candidate = fenceStart.exec(line);
      const opening = !openFence && validFenceOpen(candidate);
      const closing = !!openFence && closesFence(candidate, openFence);
      if (opening) openFence = {char: candidate[1][0], length: candidate[1].length};
      // Only actual open/close lines get fence-marker styling. A same-line
      // triple-backtick pair is an inline code span, not a multiline fence.
      highlightLine(fragment, line, !!openFence, (opening || closing) ? candidate : null);
      if (closing) openFence = null;
      if (i < lines.length - 1) fragment.append(document.createTextNode('\n'));
    }
    if (!source || source.endsWith('\n')) fragment.append(document.createTextNode('\u200b'));
    hideDestination(state);
    state.code.replaceChildren(fragment);
    // Plain text should look exactly like the native textarea, not like a
    // highlighted token. Read its real colour without the temporary transparent
    // class, and restore that class synchronously before the next paint.
    const mirrored = state.field.classList.contains('kmh-md-original-transparent');
    if (mirrored) state.field.classList.remove('kmh-md-original-transparent');
    const nativeColour = getComputedStyle(state.field).color;
    if (mirrored) state.field.classList.add('kmh-md-original-transparent');
    if (nativeColour && nativeColour !== 'transparent' && nativeColour !== 'rgba(0, 0, 0, 0)') {
      state.portal.style.color = nativeColour;
    }
    state.needsFit = true;
    position(state);
    state.portal.scrollTop = state.field.scrollTop;
    state.portal.scrollLeft = state.field.scrollLeft;
    refreshLinkInteractivity(state);
  }
  function position(state) {
    if (isReviewPage()) { detach(state); return; }
    const field = state.field;
    if (!state.enabled || state.suspended || state.composing || !field.isConnected || document.hidden || !field.value) { restoreNative(state); return; }
    const rect = field.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2 || rect.bottom <= 0 || rect.top >= innerHeight) {
      restoreNative(state);
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
    if (right <= left || bottom <= top) { restoreNative(state); return; }
    // Fail safe when a modal or another high-priority interface covers the editor.
    // A body-level portal must never paint over Settings or My Discussions.
    const overlaySelectors='[aria-modal="true"], .kmh-mod-workspace, #mod-helper-settings-modal';
    if([...document.querySelectorAll(overlaySelectors)].some(el=>el.getClientRects().length>0 &&
       getComputedStyle(el).visibility!=='hidden' &&
       !el.closest('[hidden]'))){
      restoreNative(state);return;
    }
    const midX=Math.max(1,Math.min(innerWidth-1,(left+right)/2));
    const midY=Math.max(1,Math.min(innerHeight-1,(top+bottom)/2));
    const atop=document.elementFromPoint(midX,midY);
    if(atop && atop!==field && !field.contains(atop) && !state.portal.contains(atop) &&
       !atop.closest('.beatmap-discussion-new__message, .beatmap-discussion-post--reply, .beatmap-discussion-post--new-reply')){
      restoreNative(state);return;
    }

    const css = getComputedStyle(field);
    state.portal.hidden = false;
    state.portal.style.left = `${rect.left}px`;
    state.portal.style.top = `${rect.top}px`;
    state.portal.style.width = `${rect.width}px`;
    state.portal.style.height = `${rect.height}px`;
    state.portal.style.clipPath = `inset(${Math.max(0, top - rect.top)}px ${Math.max(0, rect.right - right)}px ${Math.max(0, rect.bottom - bottom)}px ${Math.max(0, left - rect.left)}px)`;
    for (const prop of ['fontFamily','fontSize','fontWeight','fontStyle','fontVariantLigatures','lineHeight','letterSpacing','textAlign','textIndent','tabSize','padding','borderWidth','borderStyle','borderRadius','boxSizing','wordBreak','direction']) state.portal.style[prop] = css[prop];
    // Rect dimensions include padding/borders even on content-box textareas.
    // The portal receives exact outer rect dimensions, so always use border-box.
    state.portal.style.boxSizing = 'border-box';
    // Native textarea vertical scrollbars reduce its text wrapping width.
    const borderSize=(parseFloat(css.borderLeftWidth)||0)+(parseFloat(css.borderRightWidth)||0);
    const scrollbarWidth=Math.max(0, field.offsetWidth-field.clientWidth-borderSize);
    state.portal.style.paddingRight=((parseFloat(css.paddingRight)||0)+scrollbarWidth)+'px';
    // Bold and italic glyphs have different advances from the textarea's
    // plain-text font. Compensate each complete token's width so subsequent
    // characters and line wraps remain close to the native caret geometry.
    const fontKey=[css.fontFamily,css.fontSize,css.fontWeight,css.fontStyle,css.letterSpacing].join('|');
    if(state.needsFit || state.fitFont!==fontKey){
      fitEmphasisWidths(state,css);
      state.needsFit=false;state.fitFont=fontKey;
    }
    // Portal coordinates must match the native textarea. Never make original
    // text transparent if its mirror drifted or belongs to a clipped field.
    const painted=state.portal.getBoundingClientRect();
    if(Math.abs(painted.top-rect.top)>2 || Math.abs(painted.left-rect.left)>2 || Math.abs(painted.width-rect.width)>2 || Math.abs(painted.height-rect.height)>2){restoreNative(state);return;}
    state.field.classList.add('kmh-md-original-transparent');
    refreshLinkInteractivity(state);
  }
  const measureCanvas=document.createElement('canvas');
  const measure=measureCanvas.getContext('2d');
  function fitEmphasisWidths(state,css){
    if(!measure)return;
    const originalFont=`${css.fontStyle} ${css.fontWeight} ${css.fontSize} ${css.fontFamily}`;
    const baseSpacing=parseFloat(css.letterSpacing)||0;
    // UTF-16 length is not the number of visible characters in emoji/CJK text.
    const countChars=value=>{
      try {return [...new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(value)].length;}
      catch {return Array.from(value).length;}
    };
    const tokens=state.code.querySelectorAll('.kmh-md-strong-content,.kmh-md-italic-content,.kmh-md-bold-italic');
    for(const el of tokens){
      const value=el.textContent||'';const n=countChars(value);
      if(!n)continue;
      measure.font=originalFont;
      const base=measure.measureText(value).width;
      const bold=el.classList.contains('kmh-md-strong-content')||el.classList.contains('kmh-md-bold-italic');
      const italic=el.classList.contains('kmh-md-italic-content')||el.classList.contains('kmh-md-bold-italic');
      measure.font=`${italic?'italic':css.fontStyle} ${bold?'700':css.fontWeight} ${css.fontSize} ${css.fontFamily}`;
      const styled=measure.measureText(value).width;
      const adjustment=Math.max(-2,Math.min(2,(base-styled)/n));
      el.style.setProperty('--kmh-fitted-spacing',`${baseSpacing+adjustment}px`);
    }
  }
  let raf = 0;
  function schedule() {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      for (const state of tracked) {
        hideDestination(state);
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
    for (const [type, listener] of state.portalListeners || []) state.code.removeEventListener(type, listener, type === 'click');
    state.listeners = [];
    state.resize?.disconnect();
    hideDestination(state);
    state.tooltip?.remove();
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
    state.field.classList.remove('kmh-md-original-transparent');
    if (!state.enabled) hideDestination(state);
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
    const tooltip = create('div', 'kmh-md-destination');
    tooltip.hidden = true;
    tooltip.setAttribute('aria-hidden','true');
    document.body.append(tooltip);
    const state = {field,portal,code,tooltip,enabled:false,composing:false};
    // Earlier builds assigned a title to the entire textarea, creating an intrusive
    // browser tooltip over *ordinary text*. Clear only known extension-owned titles.
    if (field.getAttribute('title') === 'Click a link or timestamp to open; Alt+click a link to edit its text' ||
        field.getAttribute('title') === 'Click links when not editing, or Ctrl/Cmd+click while typing; normal clicks edit text') {
      field.removeAttribute('title');
    }
    const overLink = event => {
      const link = event.target.closest?.('a.kmh-md-visit');
      if (link && state.hoveredLink !== link) showDestination(state, link, {x:event.clientX,y:event.clientY});
    };
    const outLink = event => {
      if (state.hoveredLink?.contains(event.relatedTarget)) return;
      const leaving = event.target.closest?.('a.kmh-md-visit');
      if (leaving === state.hoveredLink) hideDestination(state);
    };
    const editLink = event => {
      if (event.button !== 0 || !event.altKey) return;
      const link = event.target.closest?.('a.kmh-md-visit');
      if (!link) return;
      event.preventDefault();
      event.stopPropagation();
      placeCaretAtPoint(state, event, link);
    };
    const suppressAltOpen = event => {
      if (event.altKey && event.target.closest?.('a.kmh-md-visit')) {
        event.preventDefault(); event.stopPropagation();
      }
    };
    code.addEventListener('pointerover', overLink);
    code.addEventListener('pointerout', outLink);
    code.addEventListener('pointerdown', editLink);
    code.addEventListener('click', suppressAltOpen, true);
    state.portalListeners = [['pointerover',overLink],['pointerout',outLink],['pointerdown',editLink],['click',suppressAltOpen]];
    states.set(field,state); tracked.add(state);
    const onInput=()=>{ if(!state.composing) render(state); };
    const onStart=()=>{state.composing=true;restoreNative(state);refreshLinkInteractivity(state);};
    const onEnd=()=>{state.composing=false;render(state);};
    const onScroll=()=>{hideDestination(state);if(state.enabled){portal.scrollTop=field.scrollTop;portal.scrollLeft=field.scrollLeft;position(state);}};
    const onFocus=()=>refreshLinkInteractivity(state);
    const onShortcut=event=>{
      if(event.button!==0 || (!event.ctrlKey&&!event.metaKey))return;
      if(openAtCaret(state)){event.preventDefault();event.stopPropagation();}
    };
    const onBlur=()=>refreshLinkInteractivity(state);
    state.listeners=[['input',onInput],['compositionstart',onStart],['compositionend',onEnd],['scroll',onScroll],['focus',onFocus],['blur',onBlur],['click',onShortcut]];
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
  document.addEventListener('focusin',schedule,true);
  window.KmhMarkdownOverlay={reconcile,attach,toggle,locate,isEnabled:field=>!isReviewPage() && !!states.get(field)?.enabled};
})();
