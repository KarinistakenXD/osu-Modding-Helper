/* osu!web user-group badge presentation. Uses only groups returned by public API. */
(() => {
 'use strict';
 const validId = value => Number.isSafeInteger(Number(value)) && Number(value) > 0;
 const cssIdentifier = value => String(value || '').toLowerCase().replace(/[^a-z0-9_-]/g, '');
 function eligible(g) {
   if (!g || typeof g !== 'object') return false;
   const id = cssIdentifier(g.identifier);
   return id && id !== 'default' && id !== 'user' && typeof g.short_name === 'string' && g.short_name.trim().length > 0;
 }
 function safeColour(colour) {return /^#[0-9a-f]{6}$/i.test(String(colour || '')) ? colour : null;}
 const titleFor = g => [String(g.name || g.short_name),g.is_probationary===true?'(Probationary)':'',
     (Array.isArray(g.playmodes)&&g.playmodes.length) ? `(${g.playmodes.join(', ')})`: ''].filter(Boolean).join(' ');
 function make(g) {
   if (!eligible(g)) return null;
   const id=cssIdentifier(g.identifier);
   const href=validId(g.id) ? `https://osu.ppy.sh/groups/${Number(g.id)}` : null;
   const node=(g.has_listing===true && href) ? document.createElement('a') : document.createElement('span');
   if (node.tagName === 'A') node.href=href;
   node.className=`user-group-badge user-group-badge--${id}${g.is_probationary===true?' user-group-badge--probationary':''} kmh-official-group-badge`;
   node.dataset.label=String(g.short_name).slice(0,22);
   node.dataset.kmhGroupId=String(g.id ?? id);
   node.dataset.kmhGroupIdentifier=id;
   node.title=titleFor(g);
   node.setAttribute('aria-label',titleFor(g));
   const colour=safeColour(g.colour); if(colour)node.style.setProperty('--group-colour',colour);
   const modes=Array.isArray(g.playmodes) ? g.playmodes.filter(m=>['osu','taiko','fruits','mania'].includes(m)).slice(0,4) : [];
   if(modes.length){const bar=document.createElement('div');bar.className='user-group-badge__modes';for(const mode of modes){const icon=document.createElement('i');icon.className=`fal fa-extra-mode-${mode}`;icon.title=mode==='fruits'?'catch':mode;bar.append(icon);}node.append(bar);}
   return node;
 }
 function insertNearAuthor(anchor,groups){
   if(!anchor?.isConnected||!Array.isArray(groups))return;
   const header=anchor.closest('.comment__row--header,.beatmap-discussion-post__header,.user-card')||anchor.parentElement;
   if(!header)return;
   for(const g of groups.filter(eligible).slice(0,6)){
     const key=String(g.id ?? cssIdentifier(g.identifier));
     if([...header.querySelectorAll('[data-kmh-group-id]')].some(el=>el.dataset.kmhGroupId===key))continue;
     if([...header.querySelectorAll('.user-group-badge:not(.kmh-official-group-badge)')].some(el=>el.classList.contains(`user-group-badge--${cssIdentifier(g.identifier)}`)))continue;
     const badge=make(g);if(!badge)continue;
     const wrapper=document.createElement('span');wrapper.className='comment__row-item kmh-group-wrapper';wrapper.append(badge);header.append(wrapper);
   }
 }
 window.KmhGroupBadges={make,insertNearAuthor,eligible};
})();
