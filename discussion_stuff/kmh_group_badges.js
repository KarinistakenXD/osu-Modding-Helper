/* Native osu!web-compatible usergroup badges; only API-reported memberships. */
(() => {
 'use strict';
 const validId = value => Number.isSafeInteger(Number(value)) && Number(value) > 0;
 const cssIdentifier = value => String(value || '').toLowerCase().replace(/[^a-z0-9_-]/g, '');
 function eligible(g) {
   if (!g || typeof g !== 'object') return false;
   const identifier=cssIdentifier(g.identifier);
   return !!identifier && !['default','user'].includes(identifier) &&
     typeof g.short_name === 'string' && !!g.short_name.trim() &&
     (validId(g.id) || typeof g.name === 'string');
 }
 function safeColour(value) {return /^#[0-9a-f]{6}$/i.test(String(value || '')) ? value : null;}
 const titleFor = g => {
   let title=String(g.name || g.short_name).trim();
   if(g.is_probationary===true && !/probationary/i.test(title))title+=' (Probationary)';
   if(Array.isArray(g.playmodes) && g.playmodes.length)title+=` (${g.playmodes.join(', ')})`;
   return title;
 };
 function make(g) {
   if (!eligible(g)) return null;
   const id=cssIdentifier(g.identifier), href=validId(g.id) ? `https://osu.ppy.sh/groups/${Number(g.id)}` : null;
   const node=(g.has_listing===true && href) ? document.createElement('a') : document.createElement('div');
   if(node.tagName==='A')node.href=href;
   node.className=`user-group-badge user-group-badge--${id}${g.is_probationary===true?' user-group-badge--probationary':''} kmh-official-group-badge`;
   node.dataset.label=String(g.short_name).trim().slice(0,32);
   node.dataset.kmhGroupId=String(g.id ?? id);
   node.dataset.kmhGroupIdentifier=id;
   node.title=titleFor(g);
   node.setAttribute('aria-label',titleFor(g));
   const colour=safeColour(g.colour);if(colour)node.style.setProperty('--group-colour',colour);
   const modes=Array.isArray(g.playmodes) ? [...new Set(g.playmodes.filter(m=>['osu','taiko','fruits','mania'].includes(m)))].slice(0,4) : [];
   if(modes.length){const bar=document.createElement('div');bar.className='user-group-badge__modes';for(const mode of modes){const icon=document.createElement('i');icon.className=`fal fa-extra-mode-${mode}`;icon.title=mode==='fruits'?'catch':mode;bar.append(icon);}node.append(bar);}
   return node;
 }
 function insertNearAuthor(anchor,groups){
   if(!anchor?.isConnected || !Array.isArray(groups))return;
   const header=anchor.closest('.comment__row--header,.beatmap-discussion-post__header,.beatmap-discussion-user-card__user-row') || anchor.parentElement;
   if(!header)return;
   // Place roles immediately after the author/name, never after Reply/Report controls.
   let cursor=anchor;
   const nativeIds=new Set([...header.querySelectorAll('.user-group-badge:not(.kmh-official-group-badge)')]
       .map(b=>[...b.classList].find(c=>c.startsWith('user-group-badge--'))?.slice('user-group-badge--'.length)).filter(Boolean));
   for(const g of groups.filter(eligible)) {
     const identifier=cssIdentifier(g.identifier), key=String(g.id ?? identifier);
     if(nativeIds.has(identifier))continue;
     let wrapper=[...header.querySelectorAll('.kmh-group-wrapper')].find(w=>w.querySelector('[data-kmh-group-id]')?.dataset.kmhGroupId===key);
     if(!wrapper){
       const badge=make(g);if(!badge)continue;
       wrapper=document.createElement('span');wrapper.className='comment__row-item kmh-group-wrapper';wrapper.append(badge);
       cursor.insertAdjacentElement('afterend',wrapper);
     }
     cursor=wrapper;
   }
 }
 window.KmhGroupBadges={make,insertNearAuthor,eligible};
})();
