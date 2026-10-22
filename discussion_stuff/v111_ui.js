/* v1.1.1 presentation on mapset and discussion pages; DOM-only, no privileged role inference. */
(() => {
 'use strict';
 const $=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
 const getData=()=>{try{return JSON.parse(document.getElementById('json-beatmapset')?.textContent||'null');}catch{return null;}};
 const mapPage=()=>/^\/beatmapsets\/\d+/.test(location.pathname);
 const discussion=()=>/\/discussion(?:\/|$)/.test(location.pathname);
 function openInspector(set){document.getElementById('kmh111-inspector')?.remove();const shade=$('div','kmh111-modal-backdrop');shade.id='kmh111-inspector';shade.setAttribute('role','dialog');shade.setAttribute('aria-modal','true');shade.setAttribute('aria-label','Beatmap metadata inspector');
  const modal=$('section','kmh111-inspector');const header=$('header','kmh111-inspector-head');header.append($('strong',null,'Metadata inspector'));
  const close=$('button','kmh111-inspector-close','×');close.type='button';close.setAttribute('aria-label','Close inspector');header.append(close);modal.append(header);
  const m=window.Kmh111Download?.metadata?.(set)||{};
  const rows=$('dl','kmh111-inspector-grid');const items=[['Artist (romanised)',m.artist?.romanised],['Artist (original)',m.artist?.original],['Title (romanised)',m.title?.romanised],['Title (original)',m.title?.original],['Source',m.source],['Genre',m.genre||'Not available'],['Language',m.language||'Not available'],['Tags (unaltered)',m.tags_raw]];
  for(const [key,val] of items){const dt=$('dt',null,key),dd=$('dd',null,val||'—');rows.append(dt,dd);}modal.append(rows);
  const foot=$('footer','kmh111-inspector-actions');const copy=$('button',null,'Copy everything'),json=$('button',null,'Download JSON');[copy,json].forEach(x=>x.type='button');copy.onclick=async()=>{try{await navigator.clipboard.writeText(JSON.stringify(m,null,2));copy.textContent='Copied!';}catch{copy.textContent='Clipboard unavailable';}};json.onclick=()=>window.Kmh111Download?.exportMetadata?.(set,'json');foot.append(copy,json);modal.append(foot);shade.append(modal);document.body.append(shade);
  const dismiss=()=>{document.removeEventListener('keydown',key);shade.remove();};const key=e=>{if(e.key==='Escape')dismiss();};shade.addEventListener('click',e=>{if(e.target===shade)dismiss();});close.onclick=dismiss;document.addEventListener('keydown',key);close.focus();
 }
 function sourceRow(){
   const container=document.querySelector('.beatmapset-info__box, .beatmapset-info__scrollable, .beatmapset-info');
   if(!container) return null;
   const rows=[...container.querySelectorAll('.beatmapset-info__row')];
   // Source is a semantic header; never select Description or a matching tag.
   let row=rows.find(r=>[...r.querySelectorAll('h3, h4, dt')]
     .some(h=>/^source$/i.test(h.textContent.trim())));
   if(row)return row;
   // Missing Source does not mean the inspector should disappear.
   row=container.querySelector('.kmh111-source-fallback');
   if(!row){
     row=$('div','beatmapset-info__row kmh111-source-fallback');
     row.append($('h3','beatmapset-info__header','Source'),$('span','kmh111-empty-source','Not specified'));
     const first=rows[0];if(first)first.insertAdjacentElement('beforebegin',row);
     else (container.querySelector('.beatmapset-info__scrollable')||container).prepend(row);
   }
   return row;
 }
 function inspectorButton(){
  if(!mapPage()||discussion())return;
  const set=getData();if(!set?.id)return;
  const row=sourceRow();if(!row)return;
  // Remove stale legacy instances including ones stranded at Description.
  document.querySelectorAll('.kmh111-inspect-entry').forEach(button=>{if(button.parentElement!==row)button.remove();});
  let button=row.querySelector(':scope > .kmh111-inspect-entry');
  if(!button){
    button=$('button','kmh111-inspect-entry btn-circle');button.type='button';
    button.setAttribute('aria-label','Inspect and copy beatmap metadata');
    button.title='Inspect metadata';
    button.innerHTML='<span class="btn-circle__content"><span class="fas fa-search" aria-hidden="true"></span></span>';
    row.append(button);
  }
  button.onclick=()=>openInspector(set);
 }
 function stylePostTypes(){document.querySelectorAll('.beatmap-discussion-new__footer button').forEach(button=>{const value=String(button.textContent||button.title||'').toLowerCase();const type=['praise','suggestion','problem','note'].find(x=>value.includes(x));if(type)button.dataset.kmh111Type=type;});}
 const peekCache=new Map(),lookupBudget={count:0};
 function signalNearby(){
   const root=document.querySelector('.beatmap-discussion-new');
   if(!root)return;
   const links=root.querySelectorAll('a[href*="discussion"], a[href*="/#/"]');
   links.forEach(link=>{
     if(link.dataset.kmh111Peek)return;
     link.dataset.kmh111Peek='1';
     let timer;
     const dismiss=()=>{clearTimeout(timer);link._kmh111Peek?.remove();link._kmh111Peek=null;};
     link.addEventListener('mouseenter',()=>{
       timer=setTimeout(()=>{
         if(!link.isConnected)return;
         const href=link.href;
         const id=href.match(/#\/(\d+)/)?.[1]||href.match(/discussion[s]?\/(\d+)/)?.[1];
         const candidates=[...(document.querySelectorAll('[data-discussion-id],[data-kmh-discussion-id],.beatmap-discussion-post,.beatmap-discussion'))];
         const match=candidates.find(item=>(id && (item.dataset.discussionId===id || item.dataset.kmhDiscussionId===id || item.id===id)) ||
              (!!id && !!item.querySelector('a[href*="#/'+id+'"]')));
         let post=match?.querySelector('.beatmap-discussion-post__message, .beatmap-discussion-post__content, .kmh-row-message, .beatmap-discussion__message');
         const text=(post?.innerText||post?.textContent||'').trim();
         const bubble=$('div','kmh111-timestamp-peek');bubble.setAttribute('role','tooltip');
         if(text)bubble.append($('strong',null,'Nearby post'),$('p',null,text.slice(0,320)+(text.length>320?'…':'')));
         else bubble.append($('strong',null,'Nearby discussion'),$('p',null,'Preview is unavailable until the discussion loads. Open it to see the full mod and replies.'));
         const goto=$('a',null,'Open discussion ↗');goto.href=href;goto.target='_blank';goto.rel='noopener noreferrer';bubble.append(goto);
         document.body.append(bubble);
         const r=link.getBoundingClientRect();bubble.style.left=Math.max(8,Math.min(innerWidth-300,r.left))+'px';
         bubble.style.top=Math.max(8,Math.min(innerHeight-bubble.offsetHeight-8,r.bottom+6))+'px';
         link._kmh111Peek=bubble;
         // Optional authenticated lookup: read the exact starting post, no
         // hidden page scraping. Bounded and cached to avoid API abuse.
         if(!text && id && Number.isSafeInteger(+id) && ++lookupBudget.count<=10 && typeof chrome!=='undefined' && chrome.runtime?.sendMessage){
           if(peekCache.has(id)){
             const cached=peekCache.get(id);
             if(cached)bubble.querySelector('p').textContent=cached;
           }else{
             peekCache.set(id,'');
             bubble.querySelector('p').textContent='Looking up the discussion…';
             try{chrome.runtime.sendMessage({action:'fetchDiscussionPosts',discussionId:Number(id)},response=>{
               if(!bubble.isConnected)return;
               const raw=(response?.data?.posts||[]).find(post=>!post.system&&post.message)?.message;
               const safe=typeof raw==='string'?raw.trim().slice(0,330):'';
               if(safe){peekCache.set(id,safe);bubble.querySelector('p').textContent=safe;}
               else bubble.querySelector('p').textContent='Full text unavailable here. Open the discussion to view its context.';
             });}catch{bubble.querySelector('p').textContent='Open the discussion to see the full mod.';}
           }
         }
       },250);
     });
     link.addEventListener('mouseleave',dismiss);link.addEventListener('blur',dismiss);
   });
 }
 function roles(){const set=getData();if(!set?.id)return;const known=new Map();const add=(id,label)=>{if(Number.isFinite(+id))known.set(String(id),label);};add(set.user_id||set.user?.id,'Mapset host');for(const b of set.beatmaps||[])if(b.user_id&&b.user_id!==(set.user_id||set.user?.id))add(b.user_id,'Guest difficulty mapper');
  document.querySelectorAll('.beatmapset-discussion .user-card, .beatmap-discussion-post .user-card, .beatmap-discussion-post__user, .comment__user').forEach(card=>{
    const anchor=card.querySelector('a[href*="/users/"]')||card.closest('a[href*="/users/"]');const id=anchor?.href.match(/\/users\/(\d+)/)?.[1];const role=known.get(id);if(!role||card.querySelector('.kmh111-role'))return;
    const badge=$('span','kmh111-role',role);badge.title='Derived from beatmapset host or difficulty owner information';card.append(badge);
  });
 }
 // Public usergroup badges: only official API-reported groups, never inferred from avatars or names.
 const groupCache=new Map();const groupInflight=new Set();let outstanding=0;
 function publicGroupData(groups){
   // The API returns memberships, playmodes, short_name and is_probationary.
   // Never infer a role from a username, comment, staff-UI mock, or avatar.
   return (Array.isArray(groups)?groups:[]).filter(g=>window.KmhGroupBadges?.eligible?.(g)).slice(0,6);
 }
 function findCommentAuthor(card){
   const header=card.querySelector('.comment__row--header,.beatmap-discussion-post__header,.user-card');
   const a=header?.querySelector('a[data-user-id], a.js-usercard[href*="/users/"],a[href*="/users/"]')
      || card.querySelector('.comment__row--header>a[href*="/users/"], .beatmap-discussion-post__user a[href*="/users/"]');
   const id=String(a?.dataset.userId||a?.getAttribute('href')?.match(/\/users\/(\d+)/)?.[1]||'');
   return /^\d+$/.test(id)?{id,a}:null;
 }
 function attachOfficialRole(anchor,groups){
   window.KmhGroupBadges?.insertNearAuthor?.(anchor,groups);
 }
 function publicGroups(){
   const cards=[...document.querySelectorAll('.comment.comment--page-extra,.comment,.beatmap-discussion-post')];
   const candidates=new Map();
   for(const card of cards){const info=findCommentAuthor(card);if(!info)continue;
     if(groupCache.has(info.id))attachOfficialRole(info.a,groupCache.get(info.id));
     else if(!groupInflight.has(info.id))candidates.set(info.id,info.a);
   }
   if(!chrome?.runtime?.sendMessage)return;
   for(const [id] of candidates){
     if(outstanding>=3||groupCache.size>=100)break;
     groupInflight.add(id);outstanding++;
     try{chrome.runtime.sendMessage({action:'fetchPublicUser',userId:id},response=>{
       outstanding--;groupInflight.delete(id);
       if(chrome.runtime.lastError||!response?.data)return;
       const roles=publicGroupData(response.data.groups);groupCache.set(id,roles);
       cards.forEach(card=>{const info=findCommentAuthor(card);if(info?.id===id)attachOfficialRole(info.a,roles);});
       if(candidates.size>3)setTimeout(publicGroups,350);
     });}catch{outstanding--;groupInflight.delete(id);}
   }
 }
 window.addEventListener('mod-helper-osu-auth-changed',()=>{groupInflight.clear();setTimeout(publicGroups,250);});
 // Shared toolbar and modal controls are mounted outside the react-owned original editor controls.
 function workspaceStyling(){document.querySelectorAll('.kmh-mod-workspace [data-connect]').forEach(btn=>{btn.classList.add('kmh111-account-control');});}
 function cleanupIfChanged(){if(!mapPage()){document.getElementById('kmh111-inspector')?.remove();window.Kmh111Popover?.close?.();document.querySelectorAll('.kmh111-dl-mount,.kmh111-dl-menu,.kmh111-dl-toggle').forEach(x=>x.remove());}}
 function reconcile(){cleanupIfChanged();if(!mapPage())return;window.Kmh111Download?.reconcile?.();inspectorButton();signalNearby();publicGroups();workspaceStyling();}
 let scheduled=0;function queue(){if(scheduled)return;scheduled=setTimeout(()=>{scheduled=0;reconcile();},180);}
 new MutationObserver(records=>{if(records.some(r=>!r.target.closest?.('.kmh111-dl-mount,.kmh111-inspector,.kmh111-modal-backdrop,.kmh111-timestamp-peek,.kmh111-role')))queue();}).observe(document.documentElement,{childList:true,subtree:true});
 window.addEventListener('popstate',queue);window.addEventListener('pageshow',queue);document.addEventListener('visibilitychange',()=>{if(!document.hidden)queue();});setInterval(()=>{if(!document.hidden)reconcile();},20000);reconcile();
 window.Kmh111UI={reconcile,openInspector};
})();
