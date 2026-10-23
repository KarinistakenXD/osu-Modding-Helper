/* Read-only rich link cards for osu! discussion, review and reply editors.
   This module never changes the text being typed and never fetches website HTML. */
(() => {
  'use strict';
  const store = new WeakMap();
  const hosts = new WeakMap();
  const activeStates = new Set();
  const fileTypes = new Set(['pdf','doc','docx','txt','md','zip','rar','7z','osz','osu','osk','json','csv','xls','xlsx','ppt','pptx','mp3','ogg','wav','mp4','webm']);
  const imageTypes = new Set(['png','jpg','jpeg','jpe','gif','webp','avif','apng','bmp','ico','svg','tif','tiff','heic','heif','jxl']);
  const make = (tag, cls, text) => { const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n; };
  const content = field => field ? (field.value ?? field.innerText ?? '') : '';
  const editorSelector = '.beatmap-discussion-new__message textarea, .beatmap-discussion-new__message [contenteditable="true"], .beatmap-discussion-post__message--editor textarea, .beatmap-discussion-post__message--editor [contenteditable="true"], .beatmap-discussion-post--new-reply textarea, .beatmap-discussion-post--new-reply [contenteditable="true"], .beatmap-discussion--review textarea, .beatmap-discussion-review textarea, .beatmap-discussion-post--reply textarea';
  function safeUrl(raw){
    try { const u=new URL(raw);return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password&&u.href.length<=2400?u:null; } catch{return null;}
  }
  function classify(url,explicitImage=false){
    if(explicitImage)return 'image'; // Markdown ![](URL) explicitly declares an image, including extensionless URLs.
    const ext=(url.pathname.split('/').pop()||'').split('.').pop().toLowerCase();
    if(imageTypes.has(ext)) return 'image';
    if(/^osu\.ppy\.sh$/i.test(url.hostname) && /^\/ss\/\d+(?:\/[a-zA-Z0-9]+)?\/?$/.test(url.pathname))return 'image';
    // s-ul.eu hosts often omit file extensions. We attempt image decoding and fall back to a link.
    if(/(^|\.)s-ul\.eu$/i.test(url.hostname) && url.pathname!=='/' && !fileTypes.has(ext))return 'image';
    if(['i.ibb.co','files.catbox.moe','litter.catbox.moe'].includes(url.hostname)&&url.pathname!=='/'&&!fileTypes.has(ext))return 'image';
    if(fileTypes.has(ext))return 'file';
    return 'web';
  }
  function labelFor(url,type,label){
    if(label?.trim())return label.trim().slice(0,130);
    if(/^osu\.ppy\.sh$/i.test(url.hostname)&&url.pathname.startsWith('/ss/'))return 'osu! screenshot';
    const end=url.pathname.split('/').filter(Boolean).pop();
    if(type==='web')return url.hostname;
    try{return decodeURIComponent(end||url.hostname).slice(0,130);}catch{return (end||url.hostname).slice(0,130);}
  }
  function extract(input){
    const used=new Set(), records=[];
    const push=(raw,label,forceImage=false)=>{
      // HTTP(S) only. Markdown link angle brackets are normalized, and URL
      // query strings are preserved (e.g. "image.gif?width=800").
      const normalized=raw.replace(/^<|>$/g,'').replace(/\\([()])/g,'$1');
      const url=safeUrl(normalized.replace(/[.,;!?]+$/,''));
      if(!url||used.has(url.href)||records.length>=24)return;
      used.add(url.href);
      const type=classify(url,forceImage);
      records.push({href:url.href,type,label:labelFor(url,type,label),host:url.hostname,origin:url.origin});
    };
    // This recognizes explicit Markdown images for *all* direct HTTP(S) URLs,
    // not just known extensions. It also recognizes ordinary Markdown links.
    const md=/(!?)\[([^\]\n]{0,512})\]\(\s*(<https?:\/\/[^>\n]+>|https?:\/\/(?:\\[()]|[^)\s])+)\s*(?:["'][^"'\n]+["'])?\s*\)/g;
    let m;while((m=md.exec(input)))push(m[3],m[2],m[1]==='!');
    const bare=/https?:\/\/[^\s<>"'\])]+/g;
    while((m=bare.exec(input)))push(m[0],null,false);
    return records;
  }
  function highlight(text,host){
    host.replaceChildren();
    const clipped=text.slice(0,8000);
    const re=/!?\[[^\]]*\]\(https?:\/\/[^\s)]+\)|https?:\/\/[^\s<>"']+|\*\*[^*\n]+\*\*|__[^_\n]+__|~~[^~\n]+~~|`[^`\n]+`|\*[^*\n]+\*|(?<=\n)#{1,6}\s+[^\n]+/g;
    let pos=0,m;while((m=re.exec(clipped))){if(m.index>pos)host.append(document.createTextNode(clipped.slice(pos,m.index)));host.append(make('mark','kmh-preview-highlight',m[0]));pos=m.index+m[0].length;}
    host.append(document.createTextNode(clipped.slice(pos)+(text.length>8000?'\n… (truncated)':'')));
  }
  function lightbox(url,label){
    const backdrop=make('div','kmh-preview-lightbox');backdrop.setAttribute('role','dialog');backdrop.setAttribute('aria-modal','true');backdrop.setAttribute('aria-label','Image preview');
    const close=make('button','kmh-preview-lightbox-close','Close ×');close.type='button';
    const image=make('img');image.src=url;image.alt=label;image.referrerPolicy='no-referrer';
    const caption=make('div','kmh-preview-lightbox-caption',label);
    const dismiss=()=>{document.removeEventListener('keydown',key);backdrop.remove();};
    const key=e=>{if(e.key==='Escape')dismiss();};
    close.onclick=dismiss;backdrop.addEventListener('click',e=>{if(e.target===backdrop)dismiss();});
    backdrop.append(close,image,caption);document.body.append(backdrop);document.addEventListener('keydown',key);close.focus();
  }
  function favicon(url) {
    const img=make('img','kmh-preview-favicon');
    img.src=url.origin+'/favicon.ico';img.alt='';img.loading='lazy';img.referrerPolicy='no-referrer';
    img.addEventListener('error',()=>{img.replaceWith(make('i','fas fa-globe'));},{once:true});
    return img;
  }
  function cardFor(it){
    const card=make('article','kmh-preview-card');
    const art=make('div','kmh-preview-art');
    if(it.type==='image'){
      const img=make('img');img.src=it.href;img.alt=it.label;img.loading='lazy';img.referrerPolicy='no-referrer';
      img.title='Enlarge image';
      img.addEventListener('click',()=>lightbox(it.href,it.label));
      img.addEventListener('error',()=>{art.replaceChildren(favicon(new URL(it.href)));card.classList.add('kmh-preview-fallback');card.querySelector('.kmh-preview-type').textContent='IMAGE LINK · PREVIEW UNAVAILABLE';},{once:true});
      art.append(img);
    } else if(it.type==='file')art.append(make('i','fas fa-file-alt'));
    else art.append(favicon(new URL(it.href)));
    const details=make('div','kmh-preview-card-body');
    details.append(make('span','kmh-preview-type',it.type==='image'?'IMAGE':it.type==='file'?'FILE LINK':'WEBSITE'),make('strong',null,it.label),make('small',null,it.host));
    const controls=make('div','kmh-preview-card-actions');
    const open=make('a',null,'Open ↗');open.href=it.href;open.target='_blank';open.rel='noopener noreferrer';open.title='Open link in new tab';
    const copy=make('button',null,'Copy');copy.type='button';copy.title='Copy URL';
    copy.onclick=async()=>{try{await navigator.clipboard.writeText(it.href);copy.textContent='Copied';}catch{copy.textContent='Copy failed';}};
    controls.append(open,copy);card.append(art,details,controls);
    return card;
  }
  function render(state){
    if(!state?.root?.isConnected)return;
    const value=content(state.field),items=extract(value);
    if (state.trigger) {
      state.trigger.hidden = items.length === 0;
      const title = state.trigger.querySelector('.kmh-link-count');
      if (title) title.textContent = `${items.length} link${items.length === 1 ? '' : 's'}`;
    }
    if (!items.length && state.visible) {
      state.visible = false;
      if (window.Kmh111Popover?.isOpen?.(state.root)) window.Kmh111Popover.close();
      state.trigger?.setAttribute('aria-pressed', 'false');
      state.trigger?.classList.remove('is-active');
    }
    state.trigger?.setAttribute('aria-label',`Toggle linked previews (${items.length})`);
    state.trigger?.setAttribute('title',`Toggle linked previews (${items.length})`);
    state.trigger?.classList.toggle('kmh-has-links',items.length>0);
    state.root.hidden=!state.visible;
    if(state.root.hidden)return;
    state.root.querySelector('.kmh111-empty-preview').hidden=items.length>0;
    state.root.querySelector('.kmh-preview-count').textContent=`${items.length} link${items.length===1?'':'s'} detected`;
    const grid=state.root.querySelector('.kmh-preview-cards');
    const fingerprint=items.map(x=>x.href+':'+x.label).join('|');
    if(state.lastItems!==fingerprint){grid.replaceChildren(...items.map(cardFor));state.lastItems=fingerprint;}
    const source=state.root.querySelector('.kmh-preview-source');
    if(!source.hidden)highlight(value,source);
  }
  function toggleState(state,force){
    if(!state)return;
    const next=typeof force==='boolean'?force:!window.Kmh111Popover?.isOpen?.(state.root);
    if(next){if(!extract(content(state.field)).length)return;render(state);if(!window.Kmh111Popover?.show?.(state.trigger,state.root,{preferred:'side',onClose:()=>{state.visible=false;state.trigger?.setAttribute('aria-pressed','false');state.trigger?.classList.remove('is-active');}}))return;state.visible=true;render(state);}
    else {state.visible=false;window.Kmh111Popover?.close?.();render(state);}
    state.trigger?.setAttribute('aria-pressed',String(state.visible));
    state.trigger?.classList.toggle('is-active', state.visible);
  }
  // Track live portals explicitly: a WeakMap alone cannot clean up a body-level
  // panel after React removes its original textarea or reply container.
  function dispose(state){
    clearTimeout(state.timer);
    state.listeners?.abort();
    if(window.Kmh111Popover?.isOpen?.(state.root))window.Kmh111Popover.close();
    if(state.contextTrigger)state.contextTrigger.remove();
    state.root.remove();
    state.trigger?.setAttribute('aria-pressed','false');
    state.trigger?.classList.remove('is-active');
    store.delete(state.field);
    hosts.delete(state.host);
    activeStates.delete(state);
  }
  function bindField(state,field){
    if(state.field===field&&state.listeners)return;
    state.listeners?.abort();
    if(state.field)store.delete(state.field);
    clearTimeout(state.timer);
    state.field=field;
    state.composing=false;
    state.lastItems='';
    state.listeners=new AbortController();
    const opts={signal:state.listeners.signal};
    field.addEventListener('compositionstart',()=>{state.composing=true;},opts);
    field.addEventListener('compositionend',()=>{state.composing=false;queue(state,200);},opts);
    field.addEventListener('input',()=>{if(!state.composing)queue(state,350);},opts);
    // React may clear a draft after posting without dispatching input.
    const owner=field.closest('.beatmap-discussion-new, .beatmap-discussion-post');
    owner?.addEventListener('click',ev=>{
      if(ev.target.closest('button')?.textContent?.trim().match(/^(?:praise|suggestion|problem|note|respond|reply|post)/i)) {
        setTimeout(()=>{if(activeStates.has(state)&&state.field.isConnected)render(state);},900);
      }
    },opts);
    store.set(field,state);
    if(state.visible)render(state);
  }
  function cleanupStale(){
    for(const state of activeStates){
      if(!state.root.isConnected||!state.host.isConnected){dispose(state);continue;}
      if(!state.field.isConnected){
        const replacement=state.host.querySelector('textarea, [contenteditable="true"]');
        if(replacement)bindField(state,replacement);
        else dispose(state);
      }
    }
  }
  function disposeAll(){for(const state of [...activeStates])dispose(state);}
  function contextualTrigger(host, compact) {
    if(compact) return null;
    const toolbar=host.querySelector('.beatmap-discussion-new__toolbar');
    const actions=toolbar?.querySelector('.kmh-editor-actions');
    if(!actions)return null;
    let trigger=actions.querySelector('.kmh-link-context');
    if(!trigger){
      trigger=make('button','kmh-editor-tool kmh-link-context');
      trigger.type='button';
      trigger.hidden=true;
      trigger.setAttribute('aria-pressed','false');
      trigger.setAttribute('aria-label','Open linked previews');
      trigger.title='Open links detected in your draft';
      trigger.innerHTML='<i class="fas fa-paperclip" aria-hidden="true"></i><span class="kmh-link-count"></span>';
      // Kept with extension controls, never injected into React's native toolbar controls.
      actions.insertBefore(trigger,actions.querySelector('[data-kmh-open-settings]'));
      trigger.addEventListener('click',()=>toggleState(hosts.get(host)));
    }
    return trigger;
  }
  function create(field,host,trigger,compact){
    if(!compact) trigger=contextualTrigger(host,false) || trigger;
    let state=store.get(field)||hosts.get(host);
    if(state&&!state.root.isConnected){dispose(state);state=null;}
    if(state){
      if(state.host!==host){hosts.delete(state.host);state.host=host;hosts.set(host,state);}
      if(state.field!==field)bindField(state,field);
      if(trigger&&state.trigger!==trigger){
        state.trigger=trigger;
        if(trigger.classList.contains('kmh-link-context'))state.contextTrigger=trigger;
        if(state.visible)window.Kmh111Popover?.reanchor?.(state.root,trigger);
      }
      render(state);
      return state;
    }
    const root=make('section','kmh-linked-preview'+(compact?' kmh-linked-preview--reply':''));
    root.hidden=true;root.setAttribute('aria-label','Link and attachment previews');
    root.innerHTML='<div class="kmh-preview-head"><strong><i class="fas fa-paperclip" aria-hidden="true"></i> Linked attachments</strong><span class="kmh-preview-count"></span><button type="button" class="kmh-preview-hide" aria-label="Hide previews">×</button></div><p class="kmh-preview-privacy">Direct images are previewed at their original URL. Websites use their favicon if available; no website HTML is fetched.</p><div class="kmh111-empty-preview">No links to preview. Paste an image URL, attachment or website link to see its card here.</div><div class="kmh-preview-cards"></div><pre class="kmh-preview-source" hidden></pre>';
    document.body.append(root);
    state={field:null,host,root,trigger,contextTrigger:!compact&&trigger?.classList.contains('kmh-link-context')?trigger:null,visible:false,timer:null,composing:false,lastItems:'',listeners:null};
    hosts.set(host,state);
    activeStates.add(state);
    root.querySelector('.kmh-preview-hide').onclick=()=>toggleState(state,false);
    bindField(state,field);
    render(state);
    return state;
  }
  function queue(state,delay=350){clearTimeout(state.timer);state.timer=setTimeout(()=>{if(activeStates.has(state))render(state);},delay);}
  function reconcile(box,trigger){
    cleanupStale();
    const field=[...box.querySelectorAll('textarea, [contenteditable="true"]')].find(n=>n.getClientRects().length>0);
    const host=box.querySelector('.beatmap-discussion-new__message');
    if(field&&host)create(field,host,trigger,false);
  }
  function reconcileReplies(){
    cleanupStale();
    document.querySelectorAll(editorSelector).forEach(field=>{
      if(field.closest('.beatmap-discussion-new'))return;
      if(!field.isConnected||!field.getClientRects().length)return;
      const parent=field.closest('.beatmap-discussion-post--new-reply, .beatmap-discussion-post__message--editor, .beatmap-discussion-post--reply, .beatmap-discussion--review, .beatmap-discussion-review');
      if(!parent)return;
      const host=field.closest('.beatmap-discussion-post__message-container')||field.parentElement;
      if(!host)return;
      let row=host.querySelector(':scope > .kmh-reply-tools');
      if(!row){
        row=make('div','kmh-reply-tools');
        const button=make('button','kmh-reply-preview-btn','↗ Preview links');
        button.hidden=true;
        button.type='button';button.title='Toggle linked attachment previews for this reply';
        row.append(button);
        host.append(row);
        button.addEventListener('click',()=>toggleState(hosts.get(host)));
      }
      const state=create(field,host,row.querySelector('button'),true);
      row.querySelector('button').setAttribute('aria-pressed',String(state.visible));
      if(row._coachField!==field){
        row._coachAbort?.abort();
        row._coachField=field;
        const out=row.querySelector('.kmh-reply-coach-results');
        if(out){out.remove();row.querySelector('.kmh-reply-coach-btn')?.setAttribute('aria-expanded','false');}
      }
      if(!row.querySelector('.kmh-reply-coach-btn')){
        const coach=make('button','kmh-reply-coach-btn','✓ Coach');
        coach.type='button';coach.title='Check the current reply text against Road to BN writing principles';
        coach.addEventListener('click',()=>{
          let out=row.querySelector('.kmh-reply-coach-results');
          if(out){row._coachAbort?.abort();clearTimeout(out._timer);out.remove();coach.setAttribute('aria-expanded','false');return;}
          out=make('div','kmh-reply-coach-results');out.setAttribute('role','status');
          row.append(out);coach.setAttribute('aria-expanded','true');
          row._coachAbort?.abort();row._coachAbort=new AbortController();
          const update=()=>{
            if(!out.isConnected)return;
            const current=row._coachField;
            const result=window.KmhCoachCore?.analyze?.(content(current),{postType:'reply'});
            out.replaceChildren();
            if(!result){out.textContent='Coach unavailable.';return;}
            out.append(make('strong',null,`${result.covered}/${result.total} reasoning elements · ${result.wordCount} words`));
            const list=make('ul');
            result.notes.slice(0,4).forEach(x=>list.append(make('li',null,x.title+': '+x.detail)));
            if(!list.childElementCount)list.append(make('li',null,'No obvious writing omissions found. Verify map context yourself.'));
            out.append(list);
          };
          update();
          row._coachField?.addEventListener('input',()=>{clearTimeout(out._timer);out._timer=setTimeout(update,900);},{signal:row._coachAbort.signal});
        });
        row.append(coach);
      }
    });
  }
  function toggle(opener){
    const box=opener?.closest('.beatmap-discussion-new');
    const field=box?.querySelector('.beatmap-discussion-new__message textarea, .beatmap-discussion-new__message [contenteditable="true"]');
    toggleState(field&&store.get(field));
  }
  window.KmhLinkPreview={reconcile,reconcileReplies,cleanupStale,disposeAll,toggle,extract,classify};
})();
