/* Native New Review is a multi-block composer, not a single textarea.
   This lightweight companion reads the current blocks without altering them. */
(() => {
  'use strict';
  const q=(selector,parent=document)=>parent.querySelector(selector);
  const make=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!=null)el.textContent=text;return el;};
  const reviewSelectors='.beatmap-discussion-new, .beatmap-discussion-review, .beatmap-discussion-new-float__content';
  function reviewRoots(){
    const all=[...document.querySelectorAll(reviewSelectors)];
    const roots=all.filter(node=>/\bNew Review\b/i.test(q('.page-title',node)?.textContent||''));
    // Prefer the smallest enclosing editor so review actions aren't mounted on nested ancestors.
    return roots.filter(node=>!roots.some(other=>other!==node && node.contains(other)));
  }
  function reviewContent(root){
    return q('.beatmap-discussion-new__content',root)||q('.beatmap-discussion-review__content',root)||root;
  }
  function readableText(root){
    const content=reviewContent(root);
    const candidates=[...content.querySelectorAll('.beatmap-discussion-review__block,.beatmap-discussion-review__item,.beatmap-discussion-review__discussion,.beatmap-discussion-review-block,[data-review-block]')];
    const targets=candidates.length?candidates: [...content.querySelectorAll('textarea,[contenteditable="true"]')];
    if(targets.length){const unique=targets.filter(n=>!targets.some(other=>other!==n&&other.contains(n)));return unique.map(x=>x.value??x.innerText??x.textContent??'').filter(Boolean).join('\n\n').slice(0,40000);}
    const copy=content.cloneNode(true);
    copy.querySelectorAll('button,.kmh-review-helper,.kmh-editor-actions,svg,input,select').forEach(node=>node.remove());
    return (copy.innerText||copy.textContent||'').trim().slice(0,40000);
  }
  function linksText(root){
    const content=reviewContent(root);
    const list=[readableText(root)];
    content.querySelectorAll('a[href^="https://"],a[href^="http://"]').forEach(a=>list.push(a.href));
    return list.join('\n');
  }
  function renderCoach(panel,text){
    const out=q('.kmh-review-output',panel);out.replaceChildren();
    const analysis=window.KmhCoachCore?.analyze?.(text,{postType:'review'});
    if(!analysis){out.textContent='Draft Coach is unavailable.';return;}
    out.append(make('strong',null,`${analysis.covered}/${analysis.total} reasoning elements · ${analysis.wordCount} words`));
    const chips=make('div','kmh-review-chips');
    for(const [key,label] of [['where','Where'],['evidence','Observation'],['why','Why'],['impact','Impact'],['solution','Repair'],['comparison','Comparison'],['alternative','Alternative']]) {
      chips.append(make('span',`kmh-review-chip ${analysis.checks[key]?'is-found':'is-missing'}`,`${analysis.checks[key]?'✓':'○'} ${label}`));
    }
    out.append(chips);
    for(const finding of analysis.notes.slice(0,6)){
      const item=make('p','kmh-review-finding');item.append(make('strong',null,finding.title+': '),document.createTextNode(finding.detail));out.append(item);
    }
    out.append(make('small',null,'Reads all visible review blocks · Karin-’s Road to BN · writing checklist, not RC validation.'));
  }
  function renderLinks(panel,text){
    const out=q('.kmh-review-output',panel);out.replaceChildren();
    const links=window.KmhLinkPreview?.extract?.(text)||[];
    if(!links.length){out.textContent='No URLs detected in visible review blocks.';return;}
    const grid=make('div','kmh-review-link-grid');
    for(const item of links){
      const card=make('article','kmh-review-link-card');
      const thumb=make('div','kmh-review-link-thumb');
      if(item.type==='image'){
        const image=make('img');image.alt='Linked image preview';image.loading='lazy';image.referrerPolicy='no-referrer';image.src=item.href;
        image.onerror=()=>{thumb.replaceChildren(make('span',null,'Image unavailable'));};
        thumb.append(image);
      }else{
        const ico=make('img');ico.alt='';ico.referrerPolicy='no-referrer';if(window.KmhLinkPreview?.createFavicon){thumb.append(window.KmhLinkPreview.createFavicon(item));}
        else {ico.src=item.origin+'/favicon.ico';ico.onerror=()=>ico.replaceWith(make('span',null,'↗'));thumb.append(ico);}
      }
      const name=make('strong',null,item.label);const a=make('a',null,'Open ↗');a.href=item.href;a.target='_blank';a.rel='noopener noreferrer';
      card.append(thumb,name,a);grid.append(card);
    }
    out.append(make('small',null,`${links.length} linked item${links.length===1?'':'s'} (up to 12 shown). Review text is not transmitted.`),grid);
  }
  function attach(root){
    if(q(':scope > .kmh-review-helper',root))return;
    const title=q('.page-title',root);if(!title)return;
    const bar=make('section','kmh-review-helper');bar.setAttribute('aria-label','Review helper');
    const actions=make('div','kmh-review-actions');
    actions.append(make('strong',null,'Review tools'));
    const mk=(text,click)=>{const b=make('button',null,text);b.type='button';b.onclick=click;actions.append(b);return b;};
    const panel=make('div','kmh-review-panel');panel.hidden=true;panel.append(make('div','kmh-review-output'));
    let mode='',timer=0;
    const update=()=>{if(panel.hidden)return;const text=mode==='links'?linksText(root):readableText(root);if(mode==='links')renderLinks(panel,text);else renderCoach(panel,text);};
    const toggle=target=>{if(mode===target&&!panel.hidden){panel.hidden=true;mode='';return;}mode=target;panel.hidden=false;update();};
    mk('✓ Coach',()=>toggle('coach')).title='Evaluate the visible review blocks after a typing pause';
    mk('↗ Preview links',()=>toggle('links')).title='Show image and URL cards detected in review blocks';
    mk('▤ RC',()=>window.KmhOpenRC?.()).title='Open Ranking Criteria';
    mk('⚙ Settings',()=>{if(window.KmhOpenSettings)window.KmhOpenSettings();else document.querySelector('.kmh-entry-main')?.click();}).title='Modding Helper settings';
    bar.append(actions,panel);title.insertAdjacentElement('afterend',bar);
    const observe=new MutationObserver(changes=>{
      if(panel.hidden||!bar.isConnected)return;
      if(!changes.some(c=>!(c.target instanceof Element && c.target.closest('.kmh-review-helper'))))return;
      clearTimeout(timer);timer=setTimeout(update,900);
    });
    observe.observe(reviewContent(root),{subtree:true,childList:true,characterData:true});
    root.addEventListener('input',()=>{if(!panel.hidden){clearTimeout(timer);timer=setTimeout(update,900);}});
    root.addEventListener('compositionend',()=>{if(!panel.hidden){clearTimeout(timer);timer=setTimeout(update,900);}});
    // Clean up observer when osu! replaces the review composer.
    const cleanup=new MutationObserver(()=>{if(!root.isConnected){observe.disconnect();cleanup.disconnect();clearTimeout(timer);}});
    cleanup.observe(root.parentElement||document.body,{childList:true});
  }
  window.KmhReviewTools={reconcile(){reviewRoots().forEach(attach);},readableText};
})();
