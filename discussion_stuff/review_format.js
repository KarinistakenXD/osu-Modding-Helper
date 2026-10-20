/* Contextual helper for osu!'s Slate-based New Review composer.
   Never replace or modify Slate DOM nodes. The toolbar is portaled into body.
   Review paragraphs use the built-in Slate shortcuts; embedded issue blocks
   support Markdown text via the native insertText path. */
(() => {
  'use strict';
  let panel=null, activeRoot=null, activeBlock=null, activeEditable=null, kind=null, raf=0;
  const make=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!=null)el.textContent=text;return el;};
  const slots=[
    ['bold','fa-bold','Bold'],['italic','fa-italic','Italic'],['code','fa-code','Inline code'],
    ['link','fa-link','Link'],['image','fa-image','Image'],['quote','fa-quote-left','Quote'],
    ['block','fa-file-code','Code block']
  ];
  function newReviewRoot(el){
    const root=el?.closest?.('.beatmap-discussion-new');
    return root && /^\s*New Review\b/i.test(root.querySelector('.page-title')?.textContent||'')?root:null;
  }
  function selectedTarget(){
    const selection=window.getSelection();
    const focus=selection?.focusNode;
    const element=focus?.nodeType===1?focus:focus?.parentElement;
    const focused=document.activeElement;
    let editable=(element?.closest?.('[data-slate-editor="true"],[contenteditable="true"]')||null);
    if(!editable && focused instanceof Element)editable=focused.closest('[data-slate-editor="true"],[contenteditable="true"]');
    if(!editable)return null;
    const root=newReviewRoot(editable);if(!root)return null;
    const block=element?.closest?.('.beatmap-discussion-review-post-embed-preview__message-container,.beatmap-discussion-editor__block') ||editable.closest('.beatmap-discussion-editor__block');
    if(!block || !root.contains(block))return null;
    const issue=!!block.closest('.beatmap-discussion-review-post-embed-preview__content') ||!!block.closest('.beatmap-discussion-review-post-embed-preview');
    if(!(focused===editable||editable.contains(focused)||editable===element||editable.contains(element)))return null;
    const text=(block.innerText||block.textContent||'').trim();
    if(!text)return null; // Do not show before typing; selected block only.
    return {root,block,editable,kind:issue?'issue':'paragraph'};
  }
  function position(){
    if(!panel || panel.hidden || !activeBlock?.isConnected)return;
    const rect=activeBlock.getBoundingClientRect();
    panel.style.visibility='hidden';panel.style.display='flex';
    const width=Math.min(panel.offsetWidth,window.innerWidth-16);
    const height=panel.offsetHeight;
    // Use reserved padding inside the active block instead of covering the next block.
    let top=rect.bottom-height-5;
    if(top<rect.top)top=rect.top+2;
    top=Math.max(5,Math.min(top,window.innerHeight-height-5));
    const left=Math.max(8,Math.min(rect.left,window.innerWidth-width-8));
    panel.style.left=`${left}px`;panel.style.top=`${top}px`;panel.style.visibility='visible';
  }
  function schedule(){cancelAnimationFrame(raf);raf=requestAnimationFrame(position);}
  function hide(){if(panel)panel.hidden=true;activeBlock?.classList.remove('kmh-review-block-active');activeRoot=activeBlock=activeEditable=kind=null;}
  function update(){
    const current=selectedTarget();
    if(!current){hide();return;}
    if(!panel)create();
    if(activeBlock!==current.block)activeBlock?.classList.remove('kmh-review-block-active');
    activeRoot=current.root;activeBlock=current.block;activeEditable=current.editable;kind=current.kind;
    activeBlock.classList.add('kmh-review-block-active');
    panel.hidden=false;
    panel.querySelector('.kmh-review-format-caption').textContent=kind==='issue'?'Markdown · active issue':'Review paragraph · Slate';
    panel.querySelectorAll('button[data-format]').forEach(btn=>{
      const unavailable=kind==='paragraph' && !['bold','italic'].includes(btn.dataset.format);
      btn.hidden=unavailable;
      btn.title=unavailable?'Not available in native Review paragraphs':btn.dataset.name;
    });
    schedule();
  }
  function issueMarkdown(name,selection){
    const chosen=selection.toString();
    const wrappers={bold:['**','**'],italic:['*','*'],code:['`','`'],link:['[','](URL)'],image:['![','](URL)'],quote:['> ',''],block:['```\n','\n```']};
    const [before,after]=wrappers[name]||['',''];
    const replacement=name==='quote'?' > '+chosen.replace(/\n/g,'\n> ').trimStart() : before+chosen+after;
    const node=selection.anchorNode;
    const el=node?.nodeType===1?node:node?.parentElement;
    if(!el?.closest('.beatmap-discussion-review-post-embed-preview__message-container'))return false;
    if(!document.execCommand('insertText',false,replacement)){
      // Do not manually mutate Slate-controlled DOM; let the user know.
      panel.querySelector('.kmh-review-format-caption').textContent='Formatting unavailable in this block';return false;
    }
    return true;
  }
  function format(name){
    if(!activeBlock?.isConnected || !activeEditable)return;
    const selection=window.getSelection();
    const node=selection?.focusNode;
    const el=node?.nodeType===1?node:node?.parentElement;
    if(!activeBlock.contains(el)){hide();return;}
    if(kind==='issue'){
      issueMarkdown(name,selection);
    }else if(['bold','italic'].includes(name)){
      const key=name==='bold'?'b':'i';
      const evt=new KeyboardEvent('keydown',{bubbles:true,cancelable:true,key,code:`Key${key.toUpperCase()}`,ctrlKey:!navigator.platform?.includes('Mac'),metaKey:!!navigator.platform?.includes('Mac')});
      activeEditable.dispatchEvent(evt); // handled by native Slate hotkey handler
    }
    setTimeout(update,0);
  }
  function create(){
    panel=make('div','kmh-review-format-floating');panel.hidden=true;
    panel.setAttribute('role','toolbar');panel.setAttribute('aria-label','Formatting tools for active Review block');
    panel.append(make('span','kmh-review-format-caption','Review formatting'));
    for(const [key,icon,label] of slots){
      const btn=make('button');btn.type='button';btn.dataset.format=key;btn.dataset.name=label;btn.title=label;btn.setAttribute('aria-label',label);
      btn.innerHTML=`<i aria-hidden="true" class="fas ${icon}"></i>`;
      btn.addEventListener('mousedown',event=>event.preventDefault());
      btn.addEventListener('click',()=>format(key));panel.append(btn);
    }
    const close=make('button','kmh-review-format-close','×');close.title='Hide formatting bar';close.type='button';close.addEventListener('mousedown',e=>e.preventDefault());close.onclick=hide;panel.append(close);
    document.body.append(panel);
  }
  function reconcile(){if(!panel)create();}
  document.addEventListener('focusin',event=>{if(!newReviewRoot(event.target))return;setTimeout(update,25);});
  document.addEventListener('input',event=>{if(!newReviewRoot(event.target))return;setTimeout(update,0);},true);
  document.addEventListener('keyup',event=>{if(newReviewRoot(event.target))update();});
  document.addEventListener('selectionchange',()=>{if(activeRoot||newReviewRoot(document.activeElement))scheduleSelection();});
  let timer=0;
  function scheduleSelection(){clearTimeout(timer);timer=setTimeout(update,80);}
  document.addEventListener('pointerdown',event=>{if(panel?.contains(event.target))return;if(!newReviewRoot(event.target))hide();});
  window.addEventListener('scroll',schedule,true);window.addEventListener('resize',schedule);
  window.KmhReviewFormat={reconcile,hide};
})();
