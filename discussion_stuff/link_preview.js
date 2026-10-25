/* Local, inline attachment previews for osu! discussion and reply editors.
   The original draft remains React-owned. No website HTML or OpenGraph data is fetched. */
(() => {
  'use strict';
  const byField = new WeakMap();
  const byHost = new WeakMap();
  const states = new Set();
  const overlays = new Set();
  const fileTypes = new Set(['pdf','doc','docx','txt','md','zip','rar','7z','osz','osu','osk','json','csv','xls','xlsx','ppt','pptx','mp3','ogg','wav','mp4','webm']);
  const imageTypes = new Set(['png','jpg','jpeg','jpe','gif','webp','avif','apng','bmp','ico','svg','tif','tiff','heic','heif','jxl']);
  const editorSelector = '.beatmap-discussion-new__message textarea, .beatmap-discussion-new__message [contenteditable="true"], .beatmap-discussion-post__message--editor textarea, .beatmap-discussion-post__message--editor [contenteditable="true"], .beatmap-discussion-post--new-reply textarea, .beatmap-discussion--review textarea, .beatmap-discussion-review textarea, .beatmap-discussion-post--reply textarea';
  const make = (tag, cls, text) => { const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n; };
  const content = field => field ? (field.value ?? field.innerText ?? '') : '';

  function safeUrl(raw) {
    try {const u=new URL(raw);return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password&&u.href.length<=2400?u:null;}
    catch {return null;}
  }
  function classify(url, explicitImage=false) {
    if(explicitImage)return 'image';
    const ext=(url.pathname.split('/').pop()||'').split('.').pop().toLowerCase();
    if(imageTypes.has(ext))return 'image';
    if(/^osu\.ppy\.sh$/i.test(url.hostname)&&/^\/ss\/\d+(?:\/[a-zA-Z0-9]+)?\/?$/.test(url.pathname))return 'image';
    if(/(^|\.)s-ul\.eu$/i.test(url.hostname)&&url.pathname!=='/'&&!fileTypes.has(ext))return 'image';
    if(['i.ibb.co','files.catbox.moe','litter.catbox.moe'].includes(url.hostname)&&url.pathname!=='/'&&!fileTypes.has(ext))return 'image';
    if(fileTypes.has(ext))return 'file';
    return 'web';
  }
  function labelFor(url,type,label) {
    if(label?.trim())return label.trim().slice(0,130);
    if(/^osu\.ppy\.sh$/i.test(url.hostname)&&url.pathname.startsWith('/ss/'))return 'osu! screenshot';
    const end=url.pathname.split('/').filter(Boolean).pop();
    if(type==='web')return url.hostname;
    try{return decodeURIComponent(end||url.hostname).slice(0,130);}catch{return (end||url.hostname).slice(0,130);}
  }
  function extract(input) {
    const records=[],found=[],byUrl=new Map();
    // Keep exact character ranges so Remove can edit the native draft, not just
    // hide a card. A Markdown attachment is one indivisible token.
    const md=/(!?)\[([^\]\n]{0,512})\]\(\s*(<https?:\/\/[^>\n]+>|https?:\/\/(?:\\[()]|[^)\s])+)\s*(?:["'][^"'\n]+["'])?\s*\)/g;
    let match;
    const markdownRanges=[];
    while((match=md.exec(input))){
      markdownRanges.push([match.index,md.lastIndex]);
      found.push({start:match.index,end:md.lastIndex,raw:match[3],label:match[2],image:match[1]==='!',priority:0});
    }
    const bare=/https?:\/\/[^\s<>"'\])]+/g;
    while((match=bare.exec(input))){
      if(markdownRanges.some(([a,b])=>match.index>=a&&match.index<b))continue;
      const clean=match[0].replace(/[.,;!?]+$/,'');
      if(clean)found.push({start:match.index,end:match.index+clean.length,raw:clean,label:null,image:false,priority:1});
    }
    found.sort((a,b)=>a.start-b.start||a.priority-b.priority);
    for(const candidate of found){
      const raw=candidate.raw.replace(/^<|>$/g,'').replace(/\\([()])/g,'$1');
      const url=safeUrl(raw.replace(/[.,;!?]+$/,''));
      if(!url)continue;
      let item=byUrl.get(url.href);
      if(!item){
        if(records.length>=24)continue;
        const type=classify(url,candidate.image);
        item={href:url.href,type,label:labelFor(url,type,candidate.label),host:url.hostname,origin:url.origin,ranges:[]};
        byUrl.set(url.href,item);records.push(item);
      } else if(candidate.image&&item.type!=='image'){
        item.type='image';item.label=labelFor(url,'image',candidate.label);
      }
      item.ranges.push({start:candidate.start,end:candidate.end});
    }
    return records;
  }
  function favicon(item) {
    const holder=make('span','kmh-attachment-favicon-box');
    const icon=make('img','kmh-attachment-favicon');
    icon.alt='';icon.loading='lazy';icon.referrerPolicy='no-referrer';icon.decoding='async';
    const host=item.host.replace(/^www\./,'');
    const paths=[];
    // Chrome MV3 favicon API uses the browser's icon database. Sites may not
    // expose their favicon at /favicon.ico, and no site HTML is fetched here.
    try {
      const runtime=globalThis.chrome?.runtime;
      if(runtime?.getURL && !/Firefox\//.test(navigator.userAgent)){
        const api=new URL(runtime.getURL('_favicon/'));
        api.searchParams.set('pageUrl',item.href);
        api.searchParams.set('size','32');
        paths.push(api.href);
      }
    } catch { /* Fall back to public paths in unsupported browsers. */ }
    paths.push(...['/favicon.ico','/favicon.png','/favicon.svg','/apple-touch-icon.png'].map(p=>item.origin+p));
    let index=0;
    // The remote favicon often lives at another conventional path. For sites
    // without one, show a domain monogram (not a dead external-link arrow).
    icon.addEventListener('error',()=>{
      if(index<paths.length){icon.src=paths[index++];return;}
      holder.replaceChildren(make('span','kmh-attachment-favicon-fallback',host.charAt(0).toUpperCase()||'W'));
    });
    icon.src=paths[index++];
    holder.append(icon);
    return holder;
  }
  function visual(item,onImageError){
    const holder=make('span','kmh-attachment-visual');
    if(item.type==='image'){
      const img=make('img','kmh-attachment-image');
      img.src=item.href;img.alt='';img.loading='lazy';img.decoding='async';img.referrerPolicy='no-referrer';
      img.addEventListener('error',()=>{
        holder.classList.add('kmh-attachment-failed');
        holder.replaceChildren(favicon(item));
        onImageError?.();
      },{once:true});
      holder.append(img);
    } else if(item.type==='file')holder.append(make('span','kmh-attachment-file-icon','▤'));
    else holder.append(favicon(item));
    return holder;
  }
  function lightbox(item,focusBack){
    const backdrop=make('div','kmh-preview-lightbox');
    backdrop.setAttribute('role','dialog');backdrop.setAttribute('aria-modal','true');
    backdrop.setAttribute('aria-label','Image preview');
    const close=make('button','kmh-preview-lightbox-close','Close ×');close.type='button';
    const img=make('img');img.src=item.href;img.alt=item.label;img.referrerPolicy='no-referrer';
    const caption=make('div','kmh-preview-lightbox-caption',item.label);
    const dismiss=()=>{document.removeEventListener('keydown',onKey);backdrop.remove();overlays.delete(dismiss);focusBack?.focus?.();};
    const onKey=e=>{if(e.key==='Escape'){e.preventDefault();dismiss();}};
    close.onclick=dismiss;backdrop.addEventListener('click',e=>{if(e.target===backdrop)dismiss();});
    backdrop.append(close,img,caption);document.body.append(backdrop);overlays.add(dismiss);document.addEventListener('keydown',onKey);close.focus();
  }
  function updateDraft(state,next) {
    const field=state?.field;
    if(!field?.isConnected)return false;
    if(field instanceof HTMLTextAreaElement || field instanceof HTMLInputElement){
      const caret=field.selectionStart;
      const descriptor=Object.getOwnPropertyDescriptor(field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,'value');
      descriptor.set.call(field,next);
      field.focus();
      const position=Math.min(caret??next.length,next.length);
      field.setSelectionRange(position,position);
    } else if(field.isContentEditable){
      field.textContent=next;
      field.focus();
    } else return false;
    field.dispatchEvent(new Event('input',{bubbles:true}));
    // Do not mutate any React-owned controls besides changing the textarea
    // through its native setter and announcing a normal input event.
    render(state);
    return true;
  }
  function removeAttachment(state,item) {
    const current=content(state.field);
    const match=extract(current).find(x=>x.href===item.href);
    if(!match?.ranges.length)return;
    let next=current;
    // One tile represents one URL. Remove each occurrence, including all
    // occurrences duplicated elsewhere in the draft.
    for(const {start,end} of [...match.ranges].sort((a,b)=>b.start-a.start)){
      const lineStart=next.lastIndexOf('\n',start-1)+1;
      const nextLine=next.indexOf('\n',end);
      const lineEnd=nextLine<0?next.length:nextLine;
      const onlyToken=!next.slice(lineStart,start).trim()&&!next.slice(end,lineEnd).trim();
      if(onlyToken){
        if(nextLine>=0)next=next.slice(0,lineStart)+next.slice(nextLine+1);
        else if(lineStart>0)next=next.slice(0,lineStart-1);
        else next='';
      } else next=next.slice(0,start)+next.slice(end);
    }
    updateDraft(state,next);
  }
  function tile(item,state){
    const isImage=item.type==='image';
    const card=make('div','kmh-attachment-card');
    const a=make('a','kmh-attachment-tile kmh-attachment-tile--'+item.type);
    a.href=item.href;a.target='_blank';a.rel='noopener noreferrer';
    a.title=(isImage?'Preview image: ':'Open link: ')+item.label;
    a.setAttribute('aria-label',(isImage?'Preview image ':'Open ')+item.label);
    a.append(visual(item,()=>a.classList.add('kmh-attachment-tile--failed')));
    a.append(make('span','kmh-attachment-label',item.label));
    if(!isImage)a.append(make('span','kmh-attachment-host',item.host));
    if(isImage)a.addEventListener('click',e=>{if(a.classList.contains('kmh-attachment-tile--failed'))return;e.preventDefault();lightbox(item,a);});
    card.append(a);
    if(state){
      const remove=make('button','kmh-attachment-remove');
      remove.type='button';remove.title='Remove link from draft';
      remove.setAttribute('aria-label','Remove '+item.label+' from draft');
      remove.append(make('span','fas fa-times'));
      remove.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();removeAttachment(state,item);});
      card.append(remove);
    }
    return card;
  }
  function openGallery(items,opener,state) {
    for(const dismiss of [...overlays])dismiss();
    const backdrop=make('div','kmh-attachment-gallery-backdrop');
    backdrop.setAttribute('role','dialog');backdrop.setAttribute('aria-modal','true');
    backdrop.setAttribute('aria-label',`${items.length} linked attachments`);
    const panel=make('section','kmh-attachment-gallery');
    const head=make('header','kmh-attachment-gallery-head');
    const label=make('strong');
    const close=make('button','kmh-attachment-gallery-close','×');close.type='button';close.setAttribute('aria-label','Close attachment gallery');
    const grid=make('div','kmh-attachment-gallery-grid');
    const dismiss=()=>{
      document.removeEventListener('keydown',onKey);
      backdrop.remove();overlays.delete(dismiss);
      if(state?.galleryRefresh===refresh)state.galleryRefresh=null;
      (opener?.isConnected?opener:state?.field)?.focus?.();
    };
    const refresh=()=>{
      const current=state?extract(content(state.field)):items;
      if(!current.length){dismiss();return;}
      label.textContent=`Linked attachments · ${current.length}`;
      grid.replaceChildren(...current.map(it=>tile(it,state)));
    };
    const onKey=e=>{if(e.key==='Escape'){e.preventDefault();dismiss();}};
    close.addEventListener('click',dismiss);
    backdrop.addEventListener('click',e=>{if(e.target===backdrop)dismiss();});
    head.append(label,close);panel.append(head,grid);backdrop.append(panel);
    document.body.append(backdrop);overlays.add(dismiss);
    if(state)state.galleryRefresh=refresh;
    refresh();document.addEventListener('keydown',onKey);close.focus();
  }
  function overflowTile(item,items,state){
    const card=make('div','kmh-attachment-card kmh-attachment-card--overflow');
    const button=make('button','kmh-attachment-tile kmh-attachment-tile--overflow');
    button.type='button';
    const hiddenCount=items.length-5;
    button.setAttribute('aria-label',`View all ${items.length} attachments, including ${hiddenCount} more`);
    button.title=`View all ${items.length} attachments`;
    button.append(visual(item));
    button.append(make('span','kmh-attachment-overflow-count',`+${hiddenCount}`));
    button.addEventListener('click',()=>openGallery(items,button,state));
    card.append(button);
    const remove=make('button','kmh-attachment-remove');
    remove.type='button';remove.title='Remove this link from draft';
    remove.setAttribute('aria-label','Remove '+item.label+' from draft');
    remove.append(make('span','fas fa-times'));
    remove.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();removeAttachment(state,item);});
    card.append(remove);
    return card;
  }
  function render(state){
    if(!state?.root?.isConnected)return;
    const items=extract(content(state.field));
    const fingerprint=items.map(it=>[it.href,it.label,it.type].join(':')).join('|');
    state.root.hidden=items.length===0;
    if(!items.length){state.lastItems='';state.grid.replaceChildren();state.galleryRefresh?.();return;}
    if(state.lastItems===fingerprint)return;
    state.grid.replaceChildren(...items.slice(0,5).map(it=>tile(it,state)));
    if(items.length>5)state.grid.append(overflowTile(items[5],items,state));
    state.root.querySelector('.kmh-attachment-counter').textContent=`${items.length} linked ${items.length===1?'attachment':'attachments'}`;
    state.lastItems=fingerprint;
    state.galleryRefresh?.();
  }
  function dispose(state){
    for(const dismiss of [...overlays])dismiss();
    clearTimeout(state.timer);state.listeners?.abort();
    state.root.remove();byField.delete(state.field);byHost.delete(state.host);states.delete(state);
  }
  function bindField(state,field){
    if(state.field===field&&state.listeners)return;
    state.listeners?.abort();if(state.field)byField.delete(state.field);clearTimeout(state.timer);
    state.field=field;state.composing=false;state.listeners=new AbortController();
    const opt={signal:state.listeners.signal};
    field.addEventListener('compositionstart',()=>{state.composing=true;},opt);
    field.addEventListener('compositionend',()=>{state.composing=false;queue(state,80);},opt);
    field.addEventListener('input',()=>{if(!state.composing)queue(state,180);},opt);
    const owner=field.closest('.beatmap-discussion-new, .beatmap-discussion-post');
    owner?.addEventListener('click',event=>{
      const label=event.target.closest('button')?.textContent?.trim();
      if(label&&/^(?:praise|suggestion|problem|note|respond|reply|post)/i.test(label))setTimeout(()=>{if(states.has(state))render(state);},500);
    },opt);
    byField.set(field,state);state.lastItems='';render(state);
  }
  function cleanupStale(){
    for(const state of [...states]){
      if(!state.host.isConnected||!state.root.isConnected){dispose(state);continue;}
      if(!state.field.isConnected){
        const field=state.host.querySelector('textarea, [contenteditable="true"]');
        if(field)bindField(state,field);else dispose(state);
      }
    }
  }
  function disposeAll(){for(const dismiss of [...overlays])dismiss();for(const state of [...states])dispose(state);}
  function create(field,host,compact){
    host.querySelectorAll('.kmh-link-context, .kmh-reply-preview-btn').forEach(n=>n.remove());
    let state=byHost.get(host)||byField.get(field);
    if(state&&!state.root.isConnected){dispose(state);state=null;}
    if(state){
      if(state.host!==host){
        byHost.delete(state.host);state.host=host;byHost.set(host,state);
        const toolbar=!compact?host.querySelector('.beatmap-discussion-new__toolbar'):null;
        if(toolbar){toolbar.insertAdjacentElement('afterend',state.root);}else host.append(state.root);
      }
      // osu!web can replace its React-managed toolbar without replacing the
      // message host. Keep the extension rail AFTER whichever toolbar is live.
      if(!compact){
        const toolbar=host.querySelector('.beatmap-discussion-new__toolbar');
        if(toolbar){if(state.root.previousElementSibling!==toolbar)toolbar.insertAdjacentElement('afterend',state.root);}
      }
      if(state.field!==field)bindField(state,field);render(state);return state;
    }
    const root=make('section','kmh-attachments-inline'+(compact?' kmh-attachments-inline--reply':''));
    root.hidden=true;root.setAttribute('aria-label','Linked attachments');
    const counter=make('div','kmh-attachment-counter');
    const grid=make('div','kmh-attachments-grid');
    root.append(counter,grid);
    const toolbar=!compact?host.querySelector('.beatmap-discussion-new__toolbar'):null;
    if(toolbar){toolbar.insertAdjacentElement('afterend',root);}else host.append(root);
    state={field:null,host,root,grid,timer:null,listeners:null,lastItems:'',composing:false,galleryRefresh:null};
    states.add(state);byHost.set(host,state);bindField(state,field);
    return state;
  }
  function queue(state,delay=180){clearTimeout(state.timer);state.timer=setTimeout(()=>{if(states.has(state))render(state);},delay);}
  function reconcile(box){
    cleanupStale();
    const host=box.querySelector('.beatmap-discussion-new__message');
    const field=host&&[...host.querySelectorAll('textarea, [contenteditable="true"]')].find(n=>n.getClientRects().length>0);
    if(host&&field)create(field,host,false);
  }
  function reconcileReplies(){
    cleanupStale();
    document.querySelectorAll(editorSelector).forEach(field=>{
      if(field.closest('.beatmap-discussion-new')||!field.isConnected||!field.getClientRects().length)return;
      const parent=field.closest('.beatmap-discussion-post--new-reply, .beatmap-discussion-post__message--editor, .beatmap-discussion-post--reply, .beatmap-discussion--review, .beatmap-discussion-review');
      if(!parent)return;
      const host=field.closest('.beatmap-discussion-post__message-container')||field.parentElement;
      if(!host)return;
      let row=host.querySelector(':scope > .kmh-reply-tools');
      if(!row){row=make('div','kmh-reply-tools');host.append(row);}
      row.querySelector('.kmh-reply-preview-btn')?.remove();
      create(field,host,true);
      if(row._coachField!==field){
        row._coachAbort?.abort();row._coachField=field;
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
            const result=window.KmhCoachCore?.analyze?.(content(row._coachField),{postType:'reply'});
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
  // Older consumers of the preview API open the full collection instead of a floating toggle.
  function toggle(opener){
    const host=opener?.closest('.beatmap-discussion-new')?.querySelector('.beatmap-discussion-new__message');
    const state=host&&byHost.get(host);
    if(state){const items=extract(content(state.field));if(items.length)openGallery(items,opener,state);}
  }
  document.addEventListener('kmh-image-uploaded',()=>{
    for(const state of states)queue(state,60);
  });
  window.KmhLinkPreview={reconcile,reconcileReplies,cleanupStale,disposeAll,toggle,extract,classify,createFavicon:favicon};
})();
