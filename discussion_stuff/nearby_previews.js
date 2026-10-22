/* Small nearby mod excerpts. Uses the exact links emitted by native osu!web.
 * Never replaces the native duplicate-warning or its confirmation control.
 */
(() => {
 'use strict';
 const cache = new Map();
 const MAX = 6;
 function timeOf(s){return String(s||'').match(/\b\d{2}:\d{2}:\d{3}\b/)?.[0]||'';}
 function idsOf(url) {
   try {
     const u = new URL(url,location.href);
     return { discussionId:Number(u.pathname.match(/\/discussion\/(\d+)/)?.[1]||0),
              postId:Number(u.hash.match(/#\/(\d+)/)?.[1]||0) };
   }catch{return {discussionId:0,postId:0};}
 }
 function short(raw) {
   const cleaned=String(raw||'')
     .replace(/!\[([^\]]*)\]\([^)]+\)/g,'[image]')
     .replace(/\[([^\]]+)\]\([^)]+\)/g,'$1')
     .replace(/[`*_~>#]/g,'')
     .replace(/\s+/g,' ').trim();
   return cleaned.length>132?cleaned.slice(0,129)+'…':cleaned;
 }
 function localExcerpt(anchor){
   const {discussionId,postId}=idsOf(anchor.href);
   // React discussion rows already on the page are a better source than another API request.
   const selectors=['.beatmap-discussion-post','.beatmap-discussion','.beatmap-discussion-post__body'];
   for(const node of document.querySelectorAll(selectors.join(','))){
     if(node.closest('.kmh-nearby-list,.kmh-workspace-overlay'))continue;
     const related=[...node.querySelectorAll('a[href]')].some(a=>{
       const ids=idsOf(a.href);
       return ids.discussionId===discussionId && (!postId || ids.postId===postId || !ids.postId);
     });
     if(!related)continue;
     const text=node.querySelector('.osu-md--discussion,.beatmap-discussion-post__message,.beatmap-discussion-post__content .osu-md,.beatmap-discussion-post__message-content');
     const value=short(text?.textContent||'');
     if(value)return value;
   }
   return '';
 }
 function fetchText(anchor,sub){
   const {discussionId,postId}=idsOf(anchor.href);
   if(!discussionId)return;
   const key=discussionId+':'+postId;
   const existing=localExcerpt(anchor);
   if(existing){cache.set(key,existing);sub.textContent=existing;return;}
   if(cache.has(key)){sub.textContent=cache.get(key)||'Open discussion to read this post';return;}
   if(typeof chrome==='undefined'||!chrome.runtime?.sendMessage){sub.textContent='Open discussion to read this post';return;}
   if(cache.size>=60){sub.textContent='Open discussion to read this post';return;}
   sub.textContent='Loading preview…';
   const show=(value)=>{if(!sub.isConnected)return;const text=short(value);
     sub.textContent=text||'Open discussion to read this post';if(text)cache.set(key,text);
   };
   try{chrome.runtime.sendMessage({action:'fetchDiscussionPosts',discussionId},response=>{
     if(chrome.runtime.lastError || response?.error){
       sub.textContent=localExcerpt(anchor)||'Open discussion to read this post';return;
     }
     const posts=Array.isArray(response?.data?.posts)?response.data.posts:[];
     const p=posts.find(p=>+p.id===postId && !p.system && p.message)
          ||posts.find(p=>p.type==='first' && !p.system && p.message)
          ||posts.find(p=>!p.system && p.message);
     if(p?.message){show(p.message);return;}
     // Some clients return discussion records without posts. Try the discussion list as fallback.
     chrome.runtime.sendMessage({action:'fetchDiscussions',filters:{beatmapset_id:Number(location.pathname.match(/\/beatmapsets\/(\d+)/)?.[1])}},res=>{
       if(chrome.runtime.lastError||res?.error){sub.textContent=localExcerpt(anchor)||'Open discussion to read this post';return;}
       const d=(res?.data?.discussions||[]).find(d=>+d.id===discussionId);
       show(d?.starting_post?.message||d?.posts?.[0]?.message||localExcerpt(anchor));
     });
   });}catch{sub.textContent=localExcerpt(anchor)||'Open discussion to read this post';}
 }
 function mount(){
   if(!/\/beatmapsets\/\d+\/discussion(?:\/|$)/.test(location.pathname))return;
   for(const editor of document.querySelectorAll('.beatmap-discussion-new')){
     const notice=editor.querySelector('.beatmap-discussion-new__notice');
     if(!notice)continue;
     const links=[...notice.querySelectorAll('a.js-beatmap-discussion--jump, .beatmap-discussion-new__notice-text a[href*="/discussion/"]')]
       .filter(a=>!a.closest('.kmh-nearby-list')&&idsOf(a.href).discussionId>0);
     if(!links.length)continue;
     let host=notice.querySelector('.kmh-nearby-list');
     const sig=links.map(a=>a.href).join('|');
     if(host && host.dataset.signature===sig)continue;
     host?.remove();
     host=document.createElement('div');host.className='kmh-nearby-list';host.dataset.signature=sig;
     host.setAttribute('aria-label','Nearby discussion excerpts');
     const title=document.createElement('strong');title.className='kmh-nearby-title';title.textContent='Nearby posts';host.append(title);
     for(const link of links.slice(0,MAX)){
       const item=document.createElement('div');item.className='kmh-nearby-item';
       const editorLink=document.createElement('a');
       editorLink.href='osu://edit/'+(timeOf(link.textContent)||'00:00:000');
       editorLink.className='beatmap-discussion-timestamp-decoration kmh-nearby-edit';
       editorLink.title='Open this timestamp in osu! editor';
       editorLink.textContent=timeOf(link.textContent)||'Timestamp';
       const post=document.createElement('a');post.href=link.href;post.className='kmh-nearby-open';
       post.title='View the matching discussion on osu!web';
       post.textContent='↗';
       const excerpt=document.createElement('span');excerpt.className='kmh-nearby-excerpt';
       excerpt.textContent=localExcerpt(link)||'Open discussion to read this post'; 
       item.append(editorLink,excerpt,post);host.append(item);
       const load=()=>fetchText(link,excerpt);
       // Keep frequent React renders cheap: only load when requested.
       let loaded=false;
       const loadOnce=()=>{if(loaded)return;loaded=true;load();};
       item.addEventListener('mouseenter',loadOnce);
       item.addEventListener('focusin',loadOnce);
       if(host.childElementCount<=4 && 'IntersectionObserver' in window){
         const io=new IntersectionObserver(entries=>{
           if(entries.some(e=>e.isIntersecting)){loadOnce();io.disconnect();}
         },{rootMargin:'35px'});
         io.observe(item);
       }
     }
     if(links.length>MAX){
       const more=document.createElement('span');more.className='kmh-nearby-extra';
       more.textContent=`+${links.length-MAX} more nearby posts — see native links above`;
       host.append(more);
     }
     const text=notice.querySelector('.beatmap-discussion-new__notice-text');
     (text||notice).insertAdjacentElement('afterend',host);
   }
 }
 window.KmhNearbyPreviews={reconcile:mount};
 document.addEventListener('focusin',e=>{if(e.target.closest?.('.beatmap-discussion-new'))mount();});
 const observer=new MutationObserver(muts=>{
   if(!muts.some(m=>!m.target.closest?.('.kmh-nearby-list')))return;
   clearTimeout(observer._kmhTimer);
   observer._kmhTimer=setTimeout(mount,220);
 });
 observer.observe(document.documentElement,{subtree:true,childList:true});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)mount();});
 mount();
})();
