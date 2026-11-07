/* Independent Review attachment workspace.
 * Never observes, edits, intercepts events from, or invokes commands on Slate.
 * Uploads and URLs are staged here; users paste copied Markdown themselves.
 */
(() => {
  'use strict';

  const make = (tag, cls, text) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  };
  const query = (root, selector) => root?.querySelector?.(selector) || null;
  const roots = () => {
    const candidates = [...document.querySelectorAll('.beatmap-discussion-new, .beatmap-discussion-review, .beatmap-discussion-new-float__content')]
      .filter(root => /^\s*New Review\b/i.test(query(root, '.page-title')?.textContent || ''));
    return candidates.filter(root => !candidates.some(other => other !== root && other.contains(root)));
  };
  const editorFor = root => query(root, '.beatmap-discussion-editor'); // Geometry only. No queries inside Slate.
  const allowedURL = raw => {
    try {
      const parsed = new URL(raw.trim());
      if (!['https:', 'http:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.href.length > 2400) return null;
      return parsed;
    } catch { return null; }
  };
  const escapeMarkdownURL = url => url.replace(/\\/g, '%5C').replace(/\(/g, '%28').replace(/\)/g, '%29').replace(/</g, '%3C').replace(/>/g, '%3E');
  const autoCopyKey = 'kmh-review-autocopy-image-markdown';
  const readAutoCopy = () => { try { return localStorage.getItem(autoCopyKey) !== 'off'; } catch { return true; } };
  const setAutoCopy = value => { try { localStorage.setItem(autoCopyKey, value ? 'on' : 'off'); } catch { /* Optional preference. */ } };

  function attach(root) {
    const previous = root._kmhReviewWorkspace;
    if (previous?.isConnected) { root._kmhReviewWorkspacePosition?.(); return; }
    const title = query(root, '.page-title');
    if (!title || !editorFor(root)) return;

    const controller = new AbortController(), { signal } = controller;
    const entries = [], uploadQueue = [];
    let uploading = false, galleryExpanded = false, workspaceOpen = false, deleted = false;
    const uploadedThisBatch = new Set();
    const workspace = make('section', 'kmh-review-workspace');
    workspace.setAttribute('aria-label', 'Review attachment uploader');
    const header = make('div', 'kmh-review-workspace-head');
    const toggle = make('button', 'kmh-review-workspace-toggle');
    toggle.type = 'button';
    toggle.setAttribute('aria-expanded', 'false');
    toggle.title = 'Show image uploader';
    toggle.append(make('i', 'fas fa-images'), make('span', null, 'Image uploads'), make('i', 'fas fa-chevron-down kmh-review-workspace-chevron'));
    const utility = make('div', 'kmh-review-workspace-secondary');
    const smallButton = (icon, label, callback) => {
      const button = make('button', 'kmh-review-workspace-icon');
      button.type = 'button';button.title = label;button.setAttribute('aria-label', label);
      const glyph = make('i', `fas ${icon}`);glyph.setAttribute('aria-hidden', 'true');button.append(glyph);
      button.addEventListener('click', callback, { signal });
      return button;
    };
    utility.append(
      smallButton('fa-book', 'Ranking Criteria', () => window.KmhOpenRC?.()),
      smallButton('fa-cog', 'Modding Helper settings', () => window.KmhOpenSettings?.())
    );
    header.append(toggle, utility);
    const body = make('div', 'kmh-review-workspace-body');body.id = `kmh-review-workspace-body-${Math.random().toString(36).slice(2)}`;body.hidden = true;
    toggle.setAttribute('aria-controls', body.id);

    const drop = make('button', 'kmh-review-workspace-drop');
    drop.type = 'button';drop.title = 'Choose image files or drag them onto this box';
    const dropSymbol = make('i', 'fas fa-cloud-upload-alt');dropSymbol.setAttribute('aria-hidden', 'true');
    const dropText = make('span', null, 'Drop images here or browse');
    drop.append(dropSymbol, dropText);
    const picker = make('input', 'kmh-review-workspace-picker');
    picker.type = 'file';picker.multiple = true;picker.hidden = true;
    picker.accept = 'image/png,image/jpeg,image/gif,image/webp,image/avif,image/bmp,image/apng';
    picker.setAttribute('aria-label', 'Select images for attachment upload');
    const hint = make('span', 'kmh-review-workspace-hint', 'Images only · upload, then paste the copied Markdown into Review.');

    const actions = make('div', 'kmh-review-workspace-actions');
    const autoLabel = make('label', 'kmh-review-workspace-auto');
    const autoInput = make('input');autoInput.type = 'checkbox';autoInput.checked = readAutoCopy();
    autoLabel.append(autoInput, make('span', null, 'Auto-copy after upload'));
    autoLabel.title = 'Replace clipboard text with generated Markdown when a batch finishes. Browser permission may block this.';
    const markdownButton = make('button', 'kmh-review-workspace-source-copy');markdownButton.type='button';markdownButton.hidden=true;markdownButton.title='Copy all uploaded image Markdown';markdownButton.setAttribute('aria-label','Copy uploaded image Markdown');
    const clear = make('button', 'kmh-review-workspace-action kmh-review-workspace-action--subtle', 'Clear');clear.type = 'button';clear.disabled = true;
    actions.append(autoLabel, clear);

    const galleryRow = make('div','kmh-review-workspace-gallery-row');
    const gallery = make('div', 'kmh-review-workspace-previews');
    gallery.setAttribute('aria-label', 'Prepared attachments');
    const overflow = make('button','kmh-review-workspace-overflow');overflow.type='button';overflow.hidden=true;
    overflow.title='Show additional attachments';overflow.setAttribute('aria-expanded','false');
    galleryRow.append(gallery,overflow);
    const source = make('textarea', 'kmh-review-workspace-copy-fallback');
    source.readOnly = true;source.rows = 2;source.hidden = true;
    source.setAttribute('aria-label', 'Select and copy Markdown if clipboard access is blocked');
    const feedback = make('div', 'kmh-review-workspace-feedback');
    feedback.setAttribute('role', 'status');feedback.setAttribute('aria-live', 'polite');
    const guide = make('div', 'kmh-review-markdown-guide');
    guide.append(make('strong', null, 'Markdown quick reference'));
    const guideGrid = make('div', 'kmh-review-markdown-grid');
    for (const [label, syntax] of [
      ['Bold', '**text**'], ['Italic', '*text*'], ['Inline code', '`code`'],
      ['Code block', '```\ncode\n```'], ['Image', '![](image-url)'], ['Link', '[label](https://example.com)']
    ]) {
      const item = make('div', 'kmh-review-markdown-item');
      item.append(make('span', null, label), make('code', null, syntax));
      guideGrid.append(item);
    }
    guide.append(guideGrid, make('small', null, 'In Reviews, use osu!web’s native text selection controls for bold and italic.'));
    body.append(drop, picker, hint, galleryRow, markdownButton, actions, source, feedback, guide);
    workspace.append(header, body);
    document.body.append(workspace);
    root.classList.add('kmh-review-workspace-host');
    root._kmhReviewWorkspace = workspace;

    const setStatus = (message, isError = false) => {
      feedback.textContent = message;
      feedback.classList.toggle('kmh-review-workspace-error', isError);
    };
    const valid = () => entries.filter(entry => entry.state === 'ready' && entry.markdown);
    const markdown = () => valid().map(entry => entry.markdown).join('\n');
    const safeName = filename => String(filename || 'image').slice(0, 120);
    const isImage = item => item.type === 'image';
    const cardURL = item => item.href || item.localURL || '';

    function position() {
      if (deleted || !workspace.isConnected || !root.isConnected || !title.isConnected) return;
      const editor = editorFor(root);
      if (!editor) return;
      const titleBounds = title.getBoundingClientRect();
      const editorBounds = editor.getBoundingClientRect();
      // Absolute portal follows document scrolling without covering Slate.
      workspace.style.left = `${Math.round(editorBounds.left + window.scrollX)}px`;
      workspace.style.top = `${Math.round(titleBounds.bottom + window.scrollY + 7)}px`;
      workspace.style.width = `${Math.round(editorBounds.width)}px`;
      root.style.setProperty('--kmh-review-space', `${Math.ceil(workspace.offsetHeight + 15)}px`);
    }
    root._kmhReviewWorkspacePosition = position;
    const schedulePosition = () => requestAnimationFrame(position);

    async function copyValue(value) {
      if (!value) return false;
      try {
        if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable');
        await navigator.clipboard.writeText(value);
        source.hidden = true;
        setStatus('Copied. Paste into Review with Ctrl+V.');
        return true;
      } catch {
        source.hidden = false;
        source.value = value;
        source.focus();source.select();
        setStatus('Clipboard unavailable. Press Ctrl+C to copy the selected Markdown.', true);
        schedulePosition();
        return false;
      }
    }

    function createCard(entry) {
      const card = make('div', 'kmh-review-workspace-card');
      const href = cardURL(entry);
      const anchor = make('a', 'kmh-review-workspace-thumb');
      if (entry.state === 'ready' && allowedURL(entry.href)) {
        anchor.href = entry.href;anchor.target = '_blank';anchor.rel = 'noopener noreferrer';
      } else {
        anchor.removeAttribute('href');anchor.setAttribute('aria-disabled', 'true');
      }
      anchor.title = entry.state === 'ready' ? entry.href : entry.state === 'failed' ? 'Upload failed' : 'Uploading…';
      if (isImage(entry) && href) {
        const img = make('img');img.src = href;img.alt = entry.label || 'Image';img.referrerPolicy = 'no-referrer';img.loading = 'lazy';
        img.addEventListener('error', () => { anchor.replaceChildren(make('span', 'kmh-review-workspace-broken', 'No preview')); }, {once:true});
        anchor.append(img);
      } else if (entry.type === 'web' && entry.state === 'ready' && window.KmhLinkPreview?.createFavicon) {
        anchor.append(window.KmhLinkPreview.createFavicon({ href: entry.href, host: entry.host, origin: entry.origin }));
      } else anchor.append(make('i', 'fas fa-link'));
      const label = make('span', 'kmh-review-workspace-caption', entry.label || entry.host || 'Attachment');
      label.title = entry.label || '';
      card.append(anchor, label);
      if (entry.state === 'ready') {
        const cp = make('button', 'kmh-review-workspace-mini', 'Copy');cp.type = 'button';cp.title = 'Copy this attachment Markdown';
        cp.addEventListener('click', () => copyValue(entry.markdown), { signal });card.append(cp);
      } else {
        card.append(make('span','kmh-review-workspace-state',entry.state === 'failed' ? 'Failed' : 'Uploading'));
      }
      const remove = make('button', 'kmh-review-workspace-remove', '×');remove.type = 'button';
      remove.title = 'Remove prepared attachment';remove.setAttribute('aria-label',`Remove ${entry.label || 'attachment'}`);
      remove.addEventListener('click', () => {
        entry.removed = true;
        const index = entries.indexOf(entry);if (index >= 0) entries.splice(index, 1);
        if (entry.localURL) URL.revokeObjectURL(entry.localURL);
        render();
      }, { signal });
      card.append(remove);
      return card;
    }

    function render() {
      if (deleted) return;
      gallery.replaceChildren();
      if (!entries.length) {
        gallery.append(make('span','kmh-review-workspace-placeholder','Uploaded images and added links appear here.'));
      } else {
        const count = galleryExpanded ? entries.length : Math.min(entries.length, 5);
        for (let i = 0;i < count;i++) gallery.append(createCard(entries[i]));
        overflow.hidden = entries.length <= 5;
        overflow.textContent = galleryExpanded ? 'Less' : `+${entries.length - 5}`;overflow.setAttribute('aria-expanded',String(galleryExpanded));
        overflow.title = galleryExpanded ? 'Collapse gallery' : 'Show all attachments';
      }
      if (!entries.length) overflow.hidden = true;
      const current = markdown();
      markdownButton.hidden = !current;
      markdownButton.textContent = current ? `Copy Markdown · ${current}` : '';
      if (source.value !== current) {source.value = current; source.hidden = true;}
      clear.disabled = !entries.length;
      drop.classList.toggle('is-uploading', uploading);
      schedulePosition();
    }

    async function uploadNext() {
      if (uploading || deleted) return;
      const entry = uploadQueue.shift();
      if (!entry) {
        if (autoInput.checked && uploadedThisBatch.size) {
          const fresh = [...uploadedThisBatch].filter(entry => !entry.removed && entry.state === 'ready');
          uploadedThisBatch.clear();
          if (fresh.length) await copyValue(fresh.map(entry => entry.markdown).join('\n'));
        } else uploadedThisBatch.clear();
        render();return;
      }
      if (entry.removed) {uploadNext();return;}
      if (!window.KmhReviewUpload?.upload) {
        entry.state = 'failed';setStatus('Review uploader unavailable; reload the extension.',true);render();uploadNext();return;
      }
      uploading = true;entry.state = 'uploading';render();
      setStatus(`Uploading ${entry.label}… (${uploadQueue.length} queued)`);
      try {
        window.KmhReviewUpload.upload(entry.file, result => {
          if (result?.pending) return;
          uploading = false;
          if (!deleted && !entry.removed) {
            if (result?.error || !allowedURL(result?.url || '')) {
              entry.state = 'failed';setStatus(result?.error || 'Upload did not return a usable link.',true);
            } else {
              entry.state = 'ready';entry.href = result.url;
              entry.markdown = `![](${escapeMarkdownURL(result.url)})`;
              uploadedThisBatch.add(entry);
              setStatus(`${entry.label} uploaded. ${uploadQueue.length} remaining.`);
            }
            if (entry.localURL) {URL.revokeObjectURL(entry.localURL);entry.localURL = '';}
          }
          render();uploadNext();
        });
      } catch (error) {
        uploading = false;entry.state = 'failed';setStatus(`Upload error: ${error.message}`,true);render();uploadNext();
      }
    }
    function addFiles(files) {
      const incoming = [...(files || [])];
      const images = incoming.filter(file => /^image\//i.test(file.type));
      if (!images.length) {setStatus('Drop image files onto the uploader, not the Review editor.',true);return;}
      if (images.length !== incoming.length) setStatus('Non-image files were skipped.');
      // Prevent unexpectedly huge batches from consuming excessive memory.
      for (const file of images.slice(0, 20)) {
        const entry = {state:'queued',type:'image',label:safeName(file.name),file,removed:false,localURL:URL.createObjectURL(file)};
        entries.push(entry);uploadQueue.push(entry);
      }
      if (images.length > 20) setStatus('Limited to 20 images per batch.');
      render();uploadNext();
    }

    toggle.addEventListener('click', () => {
      workspaceOpen = !workspaceOpen;body.hidden = !workspaceOpen;
      toggle.setAttribute('aria-expanded', String(workspaceOpen));
      toggle.title = workspaceOpen ? 'Hide image uploader' : 'Show image uploader';
      workspace.classList.toggle('is-expanded', workspaceOpen);
      schedulePosition();
    }, {signal});
    drop.addEventListener('click', () => picker.click(), {signal});
    picker.addEventListener('change', () => {if (picker.files?.length) addFiles(picker.files);picker.value='';},{signal});
    autoInput.addEventListener('change', () => {setAutoCopy(autoInput.checked);setStatus(autoInput.checked ? 'New uploads will attempt to replace clipboard contents.' : 'Automatic copying disabled. Use Copy Markdown when ready.');}, {signal});
    markdownButton.addEventListener('click', () => copyValue(markdown()),{signal});
    overflow.addEventListener('click', () => {galleryExpanded = !galleryExpanded;render();},{signal});
    clear.addEventListener('click', () => {entries.forEach(e=>{e.removed=true;if(e.localURL)URL.revokeObjectURL(e.localURL);});entries.length=0;uploadQueue.length=0;galleryExpanded=false;render();setStatus('Prepared attachments cleared. Review content was not changed.');},{signal});

    // Only uploader-area drops are captured. No listener on the Review editor or page.
    let dragDepth = 0;
    const containsFiles = event => [...(event.dataTransfer?.types || [])].includes('Files');
    body.addEventListener('dragenter',event=>{if(!containsFiles(event))return;event.preventDefault();dragDepth++;workspace.classList.add('is-dragging');},{signal});
    body.addEventListener('dragover',event=>{if(!containsFiles(event))return;event.preventDefault();event.dataTransfer.dropEffect='copy';},{signal});
    body.addEventListener('dragleave',event=>{if(!containsFiles(event))return;dragDepth=Math.max(0,dragDepth-1);if(!dragDepth)workspace.classList.remove('is-dragging');},{signal});
    body.addEventListener('drop',event=>{if(!containsFiles(event))return;event.preventDefault();event.stopPropagation();dragDepth=0;workspace.classList.remove('is-dragging');addFiles(event.dataTransfer.files);},{signal});
    window.addEventListener('resize',schedulePosition,{signal});
    window.addEventListener('scroll',schedulePosition,{passive:true,signal});
    const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(schedulePosition) : null;
    resizeObserver?.observe(workspace);

    const cleanup = () => {
      if (deleted) return;deleted = true;
      controller.abort();resizeObserver?.disconnect();rootObserver.disconnect();
      entries.forEach(entry=>{if(entry.localURL)URL.revokeObjectURL(entry.localURL);});
      workspace.remove();root.classList.remove('kmh-review-workspace-host');root.style.removeProperty('--kmh-review-space');
      delete root._kmhReviewWorkspace;delete root._kmhReviewWorkspacePosition;
    };
    const rootObserver = new MutationObserver(() => {if (!root.isConnected) cleanup();});
    rootObserver.observe(document.documentElement,{childList:true,subtree:true});
    render();position();
  }

  window.KmhReviewTools = {reconcile() {roots().forEach(attach);}};
})();
