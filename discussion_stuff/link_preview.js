/* Read-only rich link cards for osu! discussion, review and reply editors.
   This module never changes the text being typed and never fetches website HTML. */
(() => {
  'use strict';
  const store = new WeakMap();
  const fileTypes = new Set(['pdf','doc','docx','txt','md','zip','rar','7z','osz','osu','osk','json','csv','xls','xlsx','ppt','pptx','mp3','ogg','wav','mp4','webm']);
  const imageTypes = new Set(['png','jpg','jpeg','gif','webp','avif','bmp']);
  const make = (tag, cls, text) => { const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n; };
  const content = field => field ? (field.value ?? field.innerText ?? '') : '';
  const editorSelector = '.beatmap-discussion-new__message textarea, .beatmap-discussion-new__message [contenteditable="true"], .beatmap-discussion-post__message--editor textarea, .beatmap-discussion-post__message--editor [contenteditable="true"], .beatmap-discussion-post--new-reply textarea, .beatmap-discussion-post--new-reply [contenteditable="true"], .beatmap-discussion--review textarea, .beatmap-discussion-review textarea, .beatmap-discussion-post--reply textarea';
  function safeUrl(raw){
    try { const u=new URL(raw);return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password&&u.href.length<=2400?u:null; } catch{return null;}
  }
  function classify(url){
    const ext=(url.pathname.split('/').pop()||'').split('.').pop().toLowerCase();
    if(imageTypes.has(ext)) return 'image';
    if(/^osu\.ppy\.sh$/i.test(url.hostname) && /^\/ss\/\d+(?:\/[a-zA-Z0-9]+)?\/?$/.test(url.pathname))return 'image';
    // s-ul.eu hosts often omit file extensions. We attempt image decoding and fall back to a link.
    if(/(^|\.)s-ul\.eu$/i.test(url.hostname) && url.pathname!=='/' && !fileTypes.has(ext))return 'image';
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
    const push=(raw,label)=>{
      const url=safeUrl(raw.replace(/[.,;!?]+$/,''));if(!url||used.has(url.href)||records.length>=12)return;
      used.add(url.href);
      const type=classify(url);
      records.push({href:url.href,type,label:labelFor(url,type,label),host:url.hostname,origin:url.origin});
    };
    const md=/!?\[([^\]]*)\]\((https?:\/\/[^\s)]+)(?:\s+"[^"]*")?\)/g;
    let m;while((m=md.exec(input)))push(m[2],m[1]);
    const bare=/https?:\/\/[^\s<>"'\])]+/g;
    while((m=bare.exec(input)))push(m[0]);
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
    state.trigger?.setAttribute('aria-label',`Toggle linked previews (${items.length})`);
    state.trigger?.setAttribute('title',`Toggle linked previews (${items.length})`);
    state.trigger?.classList.toggle('kmh-has-links',items.length>0);
    state.root.hidden=!state.visible||!items.length;
    if(state.root.hidden)return;
    state.root.querySelector('.kmh-preview-count').textContent=`${items.length} link${items.length===1?'':'s'} detected`;
    const grid=state.root.querySelector('.kmh-preview-cards');
    const fingerprint=items.map(x=>x.href+':'+x.label).join('|');
    if(state.lastItems!==fingerprint){grid.replaceChildren(...items.map(cardFor));state.lastItems=fingerprint;}
    const source=state.root.querySelector('.kmh-preview-source');
    if(!source.hidden)highlight(value,source);
  }
  function toggleState(state,force){
    if(!state)return;
    state.visible=typeof force==='boolean'?force:!state.visible;
    state.trigger?.setAttribute('aria-pressed',String(state.visible));
    render(state);
  }
  function create(field,host,trigger,compact){
    let state=store.get(field);
    if(state?.root.isConnected){state.trigger=trigger||state.trigger;return state;}
    const root=make('section','kmh-linked-preview'+(compact?' kmh-linked-preview--reply':''));
    root.hidden=true;root.setAttribute('aria-label','Link and attachment previews');
    root.innerHTML='<div class="kmh-preview-head"><strong><i class="fas fa-paperclip" aria-hidden="true"></i> Linked attachments</strong><span class="kmh-preview-count"></span><button type="button" class="kmh-preview-source-toggle">Toggle editor highlighting</button><button type="button" class="kmh-preview-hide" aria-label="Hide previews">×</button></div><p class="kmh-preview-privacy">Direct images are previewed at their original URL. Websites use their favicon if available; no website HTML is fetched.</p><div class="kmh-preview-cards"></div><pre class="kmh-preview-source" hidden></pre>';
    host.append(root);
    state={field,root,trigger,visible:true,timer:null,composing:false,lastItems:''};store.set(field,state);
    root.querySelector('.kmh-preview-hide').onclick=()=>toggleState(state,false);
    root.querySelector('.kmh-preview-source-toggle').onclick=()=>{
      // Highlight the ORIGINAL editable textarea; don't show a disconnected copy.
      window.KmhMarkdownOverlay?.toggle?.(field);
    };
    field.addEventListener('compositionstart',()=>{state.composing=true;});
    field.addEventListener('compositionend',()=>{state.composing=false;queue(state,200);});
    field.addEventListener('input',()=>{if(!state.composing)queue(state,350);});
    render(state);
    return state;
  }
  function queue(state,delay=350){clearTimeout(state.timer);state.timer=setTimeout(()=>render(state),delay);}
  function reconcile(box,trigger){
    const field=[...box.querySelectorAll('textarea, [contenteditable="true"]')].find(n=>n.getClientRects().length>0);
    const host=box.querySelector('.beatmap-discussion-new__message');
    if(field&&host)create(field,host,trigger,false);
  }
  function reconcileReplies(){
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
        button.type='button';button.title='Toggle linked attachment previews for this reply';
        row.append(button);
        host.append(row);
        button.addEventListener('click',()=>toggleState(store.get(field)));
      }
      const state=create(field,host,row.querySelector('button'),true);
      row.querySelector('button').setAttribute('aria-pressed',String(state.visible));
      if(!row.querySelector('.kmh-reply-coach-btn')){
        const coach=make('button','kmh-reply-coach-btn','✓ Coach');
        coach.type='button';coach.title='Check the current reply text against Road to BN writing principles';
        coach.addEventListener('click',()=>{
          let out=row.querySelector('.kmh-reply-coach-results');
          if(out){out.remove();coach.setAttribute('aria-expanded','false');return;}
          out=make('div','kmh-reply-coach-results');out.setAttribute('role','status');
          row.append(out);coach.setAttribute('aria-expanded','true');
          const update=()=>{
            if(!out.isConnected)return;
            const result=window.KmhCoachCore?.analyze?.(content(field),{postType:'reply'});
            out.replaceChildren();
            if(!result){out.textContent='Coach unavailable.';return;}
            out.append(make('strong',null,`${result.covered}/${result.total} reasoning elements · ${result.wordCount} words`));
            const list=make('ul');
            result.notes.slice(0,4).forEach(x=>list.append(make('li',null,x.title+': '+x.detail)));
            if(!list.childElementCount)list.append(make('li',null,'No obvious writing omissions found. Verify map context yourself.'));
            out.append(list);
          };
          update();
          field.addEventListener('input',()=>{clearTimeout(out._timer);out._timer=setTimeout(update,900);},{signal:row._coachAbort?.signal});
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
  window.KmhLinkPreview={reconcile,reconcileReplies,toggle,extract,classify};
})();
