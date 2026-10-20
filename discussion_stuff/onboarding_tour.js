/* One-time guided tutorial: DOM-anchored, resilient to responsive osu!web layouts. */
(() => {
  'use strict';
  const KEY='kmhOnboardingCompletedV147';
  const steps=[
    {selector:'.custom-metadata-block',title:'Metadata and account status',body:'Source and tags are available from the page. Genre and language use the osu! API; if they cannot load, this area explains whether you need to connect or retry.'},
    {selector:'.beatmap-discussion-new__toolbar',title:'Native editor and helper tools',body:'The original osu! Markdown formatting buttons are kept. Extension features appear in the same formatting area without replacing the editor.'},
    {selector:'[data-kmh-open-preview]',title:'Linked previews',body:'Paste a Markdown image, file link or website URL. The extension shows read-only attachment cards and an optional syntax-highlighted source view. Only image thumbnails load from their hosts.'},
    {selector:'[data-kmh-open-preview]',title:'Website icons and osu! screenshots',body:'Pasted osu! /ss/ and s-ul.eu image URLs get image previews when the host serves an image. Ordinary websites show a favicon if available. If a preview fails, the original link still works.'},
    {selector:'.beatmap-discussion-new__message-area',title:'Paste URLs and drop screenshots',body:'Paste a standalone screenshot or direct image URL and it becomes a Markdown image link. Drag in or paste an actual image file to upload it through your configured s-ul.eu key. No image is uploaded without your action.'},
    {selector:'.kmh-reply-tools',title:'Reviews and replies',body:'When a review or reply editor is open, its own Preview links and Coach actions appear beside that editor. Both read the current text without posting for you.'},
    {selector:'[data-kmh-open-coach]',title:'Draft Coach',body:'Open a local reasoning check based on Karin’s Road to BN guide. When open, it updates after you pause typing. It never submits or silently edits a post.'},
    {selector:'[data-kmh-open-rc]',title:'Ranking Criteria',body:'Quick access to the relevant osu! Ranking Criteria. The guide and Coach are educational; always verify actual requirements against the current official rules.'},
    {selector:'[data-kmh-open-finder]',title:'My discussions',body:'Find your discussion history and follow-ups. Personal history requires an osu! OAuth connection, which you can configure in Settings.'},
    {selector:'[data-kmh-open-settings]',title:'Settings and connections',body:'Choose enabled features, connect your osu! account, and configure optional s-ul.eu image uploads. You can replay this tour any time from Settings or the popup.'}
  ];
  let state=null,hasChecked=false;
  function position(){
    if(!state)return;
    const step=steps[state.index];let target=document.querySelector(step.selector);
    if(target && (!target.isConnected||target.closest('[hidden]')))target=null;
    if(target && !state.scrolled){state.scrolled=true;target.scrollIntoView({behavior:'instant',block:'nearest',inline:'nearest'});}
    const vw=innerWidth,vh=innerHeight,gap=7,rect=target?.getBoundingClientRect();
    const anchor=rect&&rect.width>0&&rect.height>0?{
      left:Math.max(gap,Math.min(rect.left-gap,vw-gap)),
      top:Math.max(gap,Math.min(rect.top-gap,vh-gap)),
      right:Math.max(gap,Math.min(rect.right+gap,vw-gap)),
      bottom:Math.max(gap,Math.min(rect.bottom+gap,vh-gap))
    }:null;
    const r=anchor||{left:vw/2,top:vh/2,right:vw/2,bottom:vh/2};
    const boxes=[[0,0,vw,r.top],[0,r.bottom,vw,vh-r.bottom],[0,r.top,r.left,r.bottom-r.top],[r.right,r.top,vw-r.right,r.bottom-r.top]];
    for(let i=0;i<4;i++){const el=state.shades[i],[x,y,w,h]=boxes[i];Object.assign(el.style,{left:`${x}px`,top:`${y}px`,width:`${Math.max(0,w)}px`,height:`${Math.max(0,h)}px`});}
    Object.assign(state.outline.style,{display:anchor?'block':'none',left:`${r.left}px`,top:`${r.top}px`,width:`${r.right-r.left}px`,height:`${r.bottom-r.top}px`});
    const bubble=state.bubble;
    const maxW=Math.min(360,vw-24);bubble.style.width=`${maxW}px`;
    const bh=bubble.offsetHeight||230;
    let by=anchor?.bottom+12??Math.max(12,(vh-bh)/2);
    if(by+bh>vh-12)by=(anchor?.top??vh/2)-bh-12;
    by=Math.max(12,Math.min(by,vh-bh-12));
    let bx=anchor?.left??(vw-maxW)/2;bx=Math.max(12,Math.min(bx,vw-maxW-12));
    Object.assign(bubble.style,{top:`${by}px`,left:`${bx}px`});
    const status=bubble.querySelector('.kmh-tour-location');status.textContent=anchor?'':'This control is not currently visible; you can continue to the next step.';
  }
  function show(){
    if(!state)return;state.scrolled=false;const step=steps[state.index];
    state.bubble.querySelector('.kmh-tour-index').textContent=`STEP ${state.index+1} OF ${steps.length}`;
    state.bubble.querySelector('h2').textContent=step.title;
    state.bubble.querySelector('.kmh-tour-desc').textContent=step.body;
    state.bubble.querySelector('.kmh-tour-prev').disabled=state.index===0;
    state.bubble.querySelector('.kmh-tour-next').textContent=state.index===steps.length-1?'Finish':'Next →';
    requestAnimationFrame(position);
  }
  function stop(markComplete){
    if(!state)return;const s=state;state=null;
    window.removeEventListener('resize',position);window.removeEventListener('scroll',position,true);document.removeEventListener('keydown',s.keydown,true);
    s.shades.forEach(n=>n.remove());s.outline.remove();s.bubble.remove();
    if(markComplete)chrome.storage.local.set({[KEY]:true});
    s.previous?.focus?.();
  }
  function start(force=false){
    if(state)return;
    if(!force && !/^\/beatmapsets\/\d+\/discussion(?:\/|$)/.test(location.pathname))return;
    const shades=Array.from({length:4},()=>{const n=document.createElement('div');n.className='kmh-tour-shade';document.body.append(n);return n;});
    const outline=document.createElement('div');outline.className='kmh-tour-outline';document.body.append(outline);
    const bubble=document.createElement('section');bubble.className='kmh-tour-bubble';bubble.setAttribute('role','dialog');bubble.setAttribute('aria-modal','true');bubble.setAttribute('aria-label','Modding Helper introduction');
    bubble.innerHTML='<span class="kmh-tour-index"></span><h2></h2><p class="kmh-tour-desc"></p><p class="kmh-tour-location" aria-live="polite"></p><div class="kmh-tour-nav"><button type="button" class="kmh-tour-skip">Skip tour</button><button type="button" class="kmh-tour-prev">← Back</button><button type="button" class="kmh-tour-next">Next →</button></div>';
    document.body.append(bubble);
    state={index:0,shades,outline,bubble,scrolled:false,previous:document.activeElement,keydown:e=>{if(e.key==='Escape'){e.preventDefault();stop(true);}if(e.key==='ArrowRight'){e.preventDefault();next();}if(e.key==='ArrowLeft'){e.preventDefault();previous();}}};
    bubble.querySelector('.kmh-tour-skip').addEventListener('click',()=>stop(true));
    bubble.querySelector('.kmh-tour-prev').addEventListener('click',previous);
    bubble.querySelector('.kmh-tour-next').addEventListener('click',next);
    document.addEventListener('keydown',state.keydown,true);
    window.addEventListener('resize',position);window.addEventListener('scroll',position,true);
    show();bubble.querySelector('.kmh-tour-next').focus();
  }
  function next(){if(!state)return;if(state.index===steps.length-1){stop(true);return;}state.index++;show();}
  function previous(){if(!state||!state.index)return;state.index--;show();}
  function maybeStart(){
    if(hasChecked || !document.querySelector('.beatmap-discussion-new__toolbar'))return;
    hasChecked=true;
    chrome.storage.local.get([KEY],result=>{if(chrome.runtime.lastError)return;if(!result[KEY])start();});
  }
  window.KmhTour={start,stop,maybeStart};
})();
