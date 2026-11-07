/* Subtle account greeting on discussion pages; no editor DOM changes. */
(() => {
  'use strict';
  const discussionSet=()=>location.pathname.match(/^\/beatmapsets\/(\d+)\/discussion(?:\/|$)/)?.[1]||null;
  const isDiscussion=()=>!!discussionSet();
  const safeImage=raw=>{try{const u=new URL(String(raw||''));return u.protocol==='https:'&&['osu.ppy.sh','a.ppy.sh','assets.ppy.sh'].includes(u.hostname)?u.href:'';}catch{return '';}};
  let lastPath=null,sequence=0,showTimer=null,routeTimer=null;
  const node=(tag,className,text)=>{const el=document.createElement(tag);if(className)el.className=className;if(text!=null)el.textContent=text;return el;};
  function dismiss(){clearTimeout(showTimer);const old=document.getElementById('kmh-account-notice');if(old)old.remove();}
  const call=action=>new Promise((resolve,reject)=>{
    try{chrome.runtime.sendMessage({action},reply=>{
      const error=chrome.runtime.lastError?.message||reply?.error;
      if(error)reject(Error(error));else resolve(reply?.data);
    });}catch(error){reject(error);}
  });
  function show(profile,connected,first){
    dismiss();
    if(!isDiscussion()||document.hidden)return;
    const card=node('div','kmh-account-notice');card.id='kmh-account-notice';
    card.setAttribute('role','status');card.setAttribute('aria-live','polite');
    const icon=safeImage(profile?.avatar_url);
    if(icon){const img=node('img','kmh-account-notice-avatar');img.src=icon;img.alt='';img.referrerPolicy='no-referrer';card.append(img);}
    else card.append(node('i','fas fa-user-circle kmh-account-notice-guest'));
    const copy=node('div','kmh-account-notice-copy');
    if(connected){
      const username=String(profile?.username||'there');
      copy.append(node('strong',null,`${first?'Hello':'Welcome back'}, ${username}.`));
      const line=node('div','kmh-account-notice-groups');
      const roles=(Array.isArray(profile?.groups)?profile.groups:[]).filter(g=>window.KmhGroupBadges?.eligible?.(g));
      if(roles.length){
        const preferred=[...roles].sort((a,b)=>{
          const priority={bng:0,bng_limited:1,nat:2,gmt:3,lvd:4,dev:5,admin:6};
          return (priority[a.identifier]??20)-(priority[b.identifier]??20);
        });
        const badge=window.KmhGroupBadges.make(preferred[0]);
        if(badge){badge.classList.add('kmh-notice-badge');line.append(badge);}
      }
      copy.append(line);
    }else{
      copy.append(node('strong',null,'Some personal tools require osu! login.'));
      const link=node('button','kmh-account-notice-connect','Connect osu!');link.type='button';
      link.addEventListener('click',()=>{
        dismiss();const opener=document.querySelector('.kmh-entry-main')||document.querySelector('[data-kmh-open-settings]');
        if(typeof window.KmhOpenSettings==='function'&&!document.getElementById('mod-helper-settings-modal'))window.KmhOpenSettings(opener);
        document.querySelector('#mod-helper-settings-modal [data-settings-tab="integrations"]')?.click();
      });copy.append(link);
    }
    card.append(copy);
    const close=node('button','kmh-account-notice-close','×');close.type='button';close.setAttribute('aria-label','Dismiss greeting');close.addEventListener('click',dismiss);card.append(close);
    document.body.append(card);
    requestAnimationFrame(()=>card.classList.add('is-visible'));
    showTimer=setTimeout(()=>{card.classList.remove('is-visible');setTimeout(()=>{if(card.isConnected)card.remove();},280);},4800);
  }
  async function refresh(){
    if(!isDiscussion()||document.hidden){dismiss();return;}
    const version=++sequence;
    let auth;
    try{auth=await call('getAuthStatus');}catch{return;} // Unknown is not disconnected.
    if(version!==sequence||!isDiscussion())return;
    if(auth?.connected!==true){show(null,false,false);return;}
    let profile;
    try{profile=await call('fetchProfile');}catch{return;}
    if(version!==sequence||!isDiscussion()||!profile?.id)return;
    const id=String(profile.id);
    try{
      const saved=await chrome.storage.local.get(['kmhGreetedProfiles']);
      const seen=saved?.kmhGreetedProfiles&&typeof saved.kmhGreetedProfiles==='object'?saved.kmhGreetedProfiles:{};
      const first=!seen[id];
      if(first)await chrome.storage.local.set({kmhGreetedProfiles:{...seen,[id]:true}});
      if(version!==sequence||!isDiscussion())return;
      show(profile,true,first);
    }catch{if(version===sequence)show(profile,true,false);}
  }
  function routeCheck(){
    const path=discussionSet();
    if(path===lastPath)return;
    lastPath=path;dismiss();if(path)refresh();
  }
  function onAuthChange(){lastPath=null;routeCheck();}
  window.addEventListener('popstate',routeCheck);
  window.addEventListener('pageshow',routeCheck);
  window.navigation?.addEventListener?.('currententrychange',routeCheck);
  window.addEventListener('mod-helper-osu-auth-changed',onAuthChange);
  // Tabs and difficulty changes within one beatmapset are not new visits.
  // History navigation can update the URL without popstate; only the beatmapset ID is polled.
  routeTimer=setInterval(()=>{if(!document.hidden)routeCheck();},1500);
  routeCheck();
})();
