/* v1.1.1: expandable download options + local, opt-in .osz media extraction.
   Never alters osu!web's download routes or React-owned nodes. */
(() => {
 'use strict';
 const $=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
 const canonicalId=()=>{const m=location.pathname.match(/^\/beatmapsets\/(\d+)/);return m?Number(m[1]):null;};
 const beatmapset=()=>{try{return JSON.parse(document.querySelector('#json-beatmapset')?.textContent||'null');}catch{return null;}};
 function downloadBlob(blob,name){const url=URL.createObjectURL(blob);const a=$('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
 function urls(set){const id=set.id;const base=`https://osu.ppy.sh/beatmapsets/${id}/download`;
  return {official:base, officialNoVideo:`${base}?noVideo=1`, mirror:`https://mirror.hinamizawa.ai/d/${id}?redirect=true`,mirrorNoVideo:`https://mirror.hinamizawa.ai/d/${id}?redirect=true&no_video=true`, background:set.covers?.raw || `https://assets.ppy.sh/beatmaps/${id}/covers/raw.jpg`, cover:set.covers?.cover || `https://assets.ppy.sh/beatmaps/${id}/covers/cover.jpg`,preview:`https://b.ppy.sh/preview/${id}.mp3`};
 }
 function arow(parent,label,href,desc){const a=$('a','kmh111-dl-link');a.href=href;a.target='_blank';a.rel='noopener noreferrer';a.append($('span',null,label),$('small',null,desc));parent.append(a);return a;}
 function parseOsuMetadata(raw){
   const out={};let section='';
   for(const line of String(raw||'').split(/\r?\n/)){
     const header=line.match(/^\s*\[([^\]]+)\]\s*$/);if(header){section=header[1];continue;}
     if(section!=='Metadata')continue;
     const pair=line.match(/^([^:]+):\s*(.*)$/);if(pair)out[pair[1].trim()]=pair[2].trim();
   }
   return out;
 }
 async function fetchOsuMetadata(set){
   const id=set.beatmaps?.find(b=>Number.isSafeInteger(Number(b.id)))?.id;
   if(!id)throw Error('No difficulty ID is available to read an .osu file.');
   const response=await fetch(`https://osu.ppy.sh/osu/${id}`,{credentials:'same-origin',signal:AbortSignal.timeout(12000)});
   if(!response.ok)throw Error(`Raw .osu is unavailable (${response.status}). The page metadata remains available.`);
   const ct=response.headers.get('content-type')||'';
   const text=await response.text();if(text.length>4e6||/^\s*<!doctype|^\s*<html/i.test(text)||!text.includes('[Metadata]'))throw Error('The response was not a valid text .osu metadata file.');
   const fields=parseOsuMetadata(text);
   if(!fields.Title&&!fields.Artist)throw Error('No Title or Artist was found in raw .osu metadata.');
   return {beatmap_id:id,fields,source:'raw .osu difficulty file (verified contents; not a music credit verification)'};
 }
 function metadata(set){
   return {beatmapset_id:set.id,title:{romanised:set.title||'',original:set.title_unicode||set.title||''},artist:{romanised:set.artist||'',original:set.artist_unicode||set.artist||''},source:set.source||'',genre:set.genre?.name||null,language:set.language?.name||null,tags:typeof set.tags==='string'?set.tags.split(/\s+/).filter(Boolean):[],tags_raw:set.tags||'',difficulties:(set.beatmaps||[]).map(b=>({id:b.id,name:b.version,mode:b.mode,od:b.accuracy,hp:b.drain}))};
 }
 async function clipboard(text,button){try{await navigator.clipboard.writeText(text);button.textContent='Copied!';setTimeout(()=>{if(button.isConnected)button.textContent='Copy metadata';},1100);}catch{button.textContent='Copy failed';}}
 function exportMetadata(set,format='json'){
  const m=metadata(set);let value,mime,name;if(format==='txt'){value=[`Artist: ${m.artist.romanised}`,`ArtistUnicode: ${m.artist.original}`,`Title: ${m.title.romanised}`,`TitleUnicode: ${m.title.original}`,`Source: ${m.source}`,`Tags: ${m.tags_raw}`,`BeatmapsetID: ${set.id}`].join('\n');mime='text/plain';name=`${set.id}-metadata.txt`;}
  else{value=JSON.stringify(m,null,2);mime='application/json';name=`${set.id}-metadata.json`;}downloadBlob(new Blob([value],{type:mime}),name);
 }
 function buildMenu(host,set,downloadButton){const u=urls(set),wrap=$('section','kmh111-dl-menu');wrap.hidden=true;wrap.setAttribute('aria-label','Beatmap download options');
  const title=$('div','kmh111-dl-heading');title.append($('strong',null,'Downloads & metadata'),$('small',null,`Beatmapset #${set.id}`));wrap.append(title);
  const grid=$('div','kmh111-dl-grid');
  const full=$('div','kmh111-dl-group');full.append($('h4',null,'Beatmapset (.osz)'));arow(full,'Official download',u.official,'Signed-in osu!web · video availability varies');arow(full,'Official · no video',u.officialNoVideo,'Requests the no-video variant');arow(full,'Mirror · full',u.mirror,'Hinai multi-source mirror · opens externally');arow(full,'Mirror · no video',u.mirrorNoVideo,'Alternative for pending / graveyard where available');arow(full,'Nerinyan mirror',`https://nerinyan.moe/`,'Open mirror site · search by set ID');grid.append(full);
  const media=$('div','kmh111-dl-group');media.append($('h4',null,'Artwork'));arow(media,'Cover image',u.cover,'Beatmapset cover (when available)');grid.append(media);
  const metadataGroup=$('div','kmh111-dl-group kmh111-dl-group--metadata');metadataGroup.append($('h4',null,'Metadata'));const tools=$('div','kmh111-dl-inline kmh111-dl-inline--metadata');const copy=$('button','kmh111-dl-action','Copy metadata'),txt=$('button','kmh111-dl-action','Export .txt'),json=$('button','kmh111-dl-action','Export .json');[copy,txt,json].forEach(b=>b.type='button');copy.onclick=()=>clipboard(JSON.stringify(metadata(set),null,2),copy);txt.onclick=()=>exportMetadata(set,'txt');json.onclick=()=>exportMetadata(set,'json');tools.append(copy,txt,json);metadataGroup.append(tools);
  const readOsu=$('button','kmh111-dl-action','Read .osu metadata');readOsu.type='button';
  readOsu.onclick=async()=>{readOsu.disabled=true;const previous=readOsu.textContent;readOsu.textContent='Reading .osu…';
    try{const result=await fetchOsuMetadata(set);downloadBlob(new Blob([JSON.stringify(result,null,2)],{type:'application/json'}),`${set.id}-osu-metadata.json`);readOsu.textContent='Exported .osu metadata';}
    catch(err){readOsu.textContent='Unavailable: '+String(err.message).slice(0,75);}
    finally{setTimeout(()=>{if(readOsu.isConnected){readOsu.disabled=false;readOsu.textContent=previous;}},2200);}
  };tools.append(readOsu);
  grid.append(metadataGroup);
  wrap.append(grid);
  const trigger=$('button','kmh111-dl-toggle');trigger.type='button';trigger.setAttribute('aria-expanded','false');trigger.setAttribute('aria-controls','kmh111-download-popover');trigger.setAttribute('title','More download and export options');trigger.setAttribute('aria-label','More download and export options');trigger.innerHTML='<span class="fas fa-plus" aria-hidden="true"></span>';
  wrap.id='kmh111-download-popover';wrap.dataset.kmhSetId=String(set.id);
  trigger.onclick=()=>window.Kmh111Popover?.show?.(trigger,wrap,{preferred:'side'});
  downloadButton?.insertAdjacentElement('afterend',trigger);
  if(downloadButton?.classList.contains('custom-download-btn'))downloadButton.parentElement.classList.add('kmh111-has-download-toggle');
  return {wrap,trigger};
 }
 function reconcile(){
  const set=beatmapset(),id=canonicalId();
  if(!id||!set||set.id!==id)return;
  if(!/\/discussion(?:\/|$)/.test(location.pathname)){document.querySelectorAll('.kmh111-dl-toggle,.kmh111-dl-menu').forEach(n=>n.remove());document.querySelectorAll('.kmh111-download-action-row').forEach(n=>n.classList.remove('kmh111-download-action-row'));return;}
  document.querySelectorAll('.kmh111-dl-menu').forEach(x=>{if(x.dataset.kmhSetId!==String(id))x.remove();});
  const matching=document.querySelector(`.kmh111-dl-toggle[data-set-id="${id}"]`);
  if(matching?.isConnected){return;}
  const button=[...document.querySelectorAll('a.btn-osu-big')].find(a=>a.href?.includes(`/beatmapsets/${id}/download`))||document.querySelector('.custom-download-btn');
  if(!button)return;
  // Front-page hero layouts have too many native button variations.
  // Limit extra controls to the discussion panel, leaving the Info hero untouched.
  if(!/\/discussion(?:\/|$)/.test(location.pathname)){document.querySelectorAll('.kmh111-dl-toggle,.kmh111-dl-menu').forEach(el=>el.remove());return;}
  const nativeParent=button.parentElement;
  const {trigger}=buildMenu(document.body,set,button);trigger.dataset.setId=String(id);
  // Do not reparent or override the native Download anchor.
  if(nativeParent)nativeParent.classList.add('kmh111-download-action-row');
 }
 window.Kmh111Download={reconcile,metadata,parseOsuMetadata,fetchOsuMetadata,urls,exportMetadata};
})();
