/* Ranking Criteria panel: selected difficulty is explicit; SR is informational,
   not an authority on Easy/Normal/Hard/Insane/Expert classification. */
function toggled_RC_book() {
  'use strict';
  let beatmapset;
  try {beatmapset=JSON.parse(document.getElementById('json-beatmapset')?.textContent||'null');}catch{return;}
  const beatmaps=(beatmapset?.beatmaps||[]).filter(m=>m&&Number.isSafeInteger(Number(m.id)));
  if(!beatmaps.length)return;
  const modePath={osu:'osu%21',taiko:'osu%21taiko',fruits:'osu%21catch',mania:'osu%21mania'};
  const modeLabel={osu:'osu!',taiko:'osu!taiko',fruits:'osu!catch',mania:'osu!mania'};
  const findMap=id=>beatmaps.find(m=>String(m.id)===String(id));
  function selectedMap(){
    const path=location.pathname.match(/\/beatmapsets\/\d+\/discussion\/(\d+)(?:\/|$)/);
    if(path&&findMap(path[1]))return {map:findMap(path[1]),reason:'discussion URL'};
    const hash=location.hash.match(/#(?:osu|taiko|fruits|mania)\/(\d+)/);
    if(hash&&findMap(hash[1]))return {map:findMap(hash[1]),reason:'map URL'};
    const selectors=['.beatmap-list__item--selected[data-id]','.beatmap-list__item--current[data-id]','[data-beatmap-id][aria-current="true"]','[data-beatmap-id][aria-selected="true"]','.beatmap-list__item--selected[data-beatmap-id]'];
    for(const css of selectors){const item=document.querySelector(css);const id=item?.dataset?.id||item?.dataset?.beatmapId;if(findMap(id))return {map:findMap(id),reason:'selected difficulty'};}
    return {map:beatmaps[0],reason:beatmaps.length===1?'only difficulty':'first difficulty (unconfirmed)'};
  }
  function namedTier(name){
    const s=String(name||'').toLowerCase().replace(/\[[^\]]*\]/g,' ');
    if(/\b(?:beginner|easy)\b/.test(s))return 'easy';
    if(/\bnormal\b/.test(s))return 'normal';
    if(/\b(?:advanced|hard)\b/.test(s))return 'hard';
    if(/\b(?:hyper|insane)\b/.test(s))return 'insane';
    if(/\b(?:extra|expert|extreme|another)\b/.test(s))return 'expert';
    return '';
  }
  const tiers=['easy','normal','hard','insane','expert'];
  function suggestedTier(sr){
    if(!Number.isFinite(sr))return '';
    if(sr<2)return 'easy';if(sr<2.7)return 'normal';if(sr<4)return 'hard';
    if(sr<5.3)return 'insane';return 'expert'; // includes Expert+; RC only has Expert
  }
  const modeUrl=mode=>'https://osu.ppy.sh/wiki/en/Ranking_criteria/'+(modePath[mode]||modePath.osu);
  const commonTopics={
    difficulty:['Current difficulty RC',null],
    general:['General Ranking Criteria','https://osu.ppy.sh/wiki/en/Ranking_criteria'],
    metadata:['Metadata RC','https://osu.ppy.sh/wiki/en/Ranking_criteria/Metadata'],
    standardisation:['Standardisation (Metadata)','https://osu.ppy.sh/wiki/en/Ranking_criteria/Metadata#romanisation'],
    visual:['Visual content considerations','https://osu.ppy.sh/wiki/en/Rules/Visual_content_considerations'],
    song:['Song content rules','https://osu.ppy.sh/wiki/en/Rules/Song_content_rules'],
    conduct:['Code of conduct for modding','https://osu.ppy.sh/wiki/en/Rules/Code_of_conduct_for_modding_and_mapping'],
    procedure:['Beatmap ranking procedure','https://osu.ppy.sh/wiki/en/Beatmap_ranking_procedure']
  };
  function sync(panel){
    if(!panel)return;
    const initial=selectedMap();
    if(!findMap(panel.dataset.kmhMapId))panel.dataset.kmhMapId=String(initial.map.id);
    const map=findMap(panel.dataset.kmhMapId)||initial.map;
    const selectMap=panel.querySelector('[data-kmh-rc-map]');
    if(selectMap && selectMap.options.length!==beatmaps.length){
      selectMap.replaceChildren();
      for(const bm of beatmaps){const opt=document.createElement('option');opt.value=String(bm.id);const sr=Number(bm.difficulty_rating);opt.textContent=`${bm.version||'Unnamed difficulty'}${Number.isFinite(sr)?` · ${sr.toFixed(2)}★`:''} (${bm.mode||'osu'})`;selectMap.append(opt);}
    }
    if(selectMap)selectMap.value=String(map.id);
    const tierChoice=panel.querySelector('[data-kmh-rc-tier]');
    const isManual=panel.dataset.kmhManualTier==='1';
    const named=namedTier(map.version);
    const sr=Number(map.difficulty_rating);
    const inferred=named||suggestedTier(sr);
    const relativeName=/\b(?:top|final|upper|highest)\b/i.test(String(map.version||''));
    if(!isManual||panel.dataset.kmhTierMap!==String(map.id)){
      panel.dataset.kmhTier=inferred;
      panel.dataset.kmhTierMap=String(map.id);
      panel.dataset.kmhManualTier='0';
    }
    if(tierChoice)tierChoice.value=panel.dataset.kmhTier||'';
    const tier=panel.dataset.kmhTier||'';
    const topic=panel.dataset.kmhRcTopic in commonTopics?panel.dataset.kmhRcTopic:'difficulty';
    const url=topic==='difficulty'?`${modeUrl(map.mode)}${tier?'#'+tier:''}`:commonTopics[topic][1];
    const title=topic==='difficulty'?`${modeLabel[map.mode]||'osu!'} RC${tier?' · '+tier.charAt(0).toUpperCase()+tier.slice(1):''}`:commonTopics[topic][0];
    const difficultyTopic=topic==='difficulty';
    const selectors=panel.querySelector('.kmh-rc-secondary-selectors');
    if(selectors)selectors.hidden=!difficultyTopic;
    const warning=panel.querySelector('.kmh-rc-warning');
    if(warning)warning.hidden=!difficultyTopic;
    if(warning){warning.textContent=panel.dataset.kmhManualTier==='1'?'Manual RC tier · verify the actual pattern difficulty':named?'Tier suggested by name · check its pattern requirements':tier?(relativeName?'Top/final is relative to this spread; SR provides a tentative tier · verify the patterns':'SR suggests this tier · NOT an RC classification; verify patterns manually'):'No tier found · select one manually';}
    const titleEl=panel.querySelector('[data-rc-panel-title]');if(titleEl)titleEl.textContent=title;
    const sub=panel.querySelector('[data-rc-difficulty]');if(sub)sub.textContent=difficultyTopic?`${map.version||'Unnamed difficulty'} · ${Number.isFinite(sr)?sr.toFixed(2)+'★':'SR unavailable'} · ${panel.dataset.kmhMapId===String(initial.map.id)?initial.reason:'manual map selection'}`:'General reference · applies across difficulties';
    const link=panel.querySelector('[data-kmh-rc-external]');if(link)link.href=url;
    const frame=panel.querySelector('iframe');if(frame&&frame.getAttribute('src')!==url)frame.src=url;
  }
  function open(event){
    event?.preventDefault?.();
    let panel=document.getElementById('custom-rc-panel');
    if(panel){panel.style.display=panel.style.display==='none'?'flex':'none';if(panel.style.display!=='none')sync(panel);return;}
    panel=document.createElement('div');panel.id='custom-rc-panel';panel.className='kmh-rc-drawer';
    panel.innerHTML=`<div class="kmh-rc-drawer__header"><div class="kmh-rc-drawer__heading"><span data-rc-panel-title class="kmh-rc-drawer__title">Ranking Criteria</span><span data-rc-difficulty class="kmh-rc-drawer__subtitle"></span></div><button type="button" id="close-rc-panel" class="kmh-rc-drawer__close" aria-label="Close Ranking Criteria panel" title="Close Ranking Criteria"><i class="fas fa-times" aria-hidden="true"></i></button></div>
     <nav class="kmh111-rc-nav" aria-label="Ranking Criteria topics"><select data-kmh-rc-topic aria-label="RC topic"></select><a data-kmh-rc-external href="https://osu.ppy.sh/wiki/en/Ranking_criteria" target="_blank" rel="noopener noreferrer">Open in wiki ↗</a></nav>
     <div class="kmh-rc-secondary-selectors"><label>Difficulty<select data-kmh-rc-map aria-label="Select beatmap difficulty"></select></label><label>RC level<select data-kmh-rc-tier aria-label="Choose RC difficulty tier"><option value="">Unclassified</option><option value="easy">Easy</option><option value="normal">Normal</option><option value="hard">Hard</option><option value="insane">Insane</option><option value="expert">Expert</option></select></label></div>
     <small class="kmh-rc-warning"></small><iframe title="osu! Ranking Criteria" referrerpolicy="strict-origin-when-cross-origin"></iframe>`;
    document.body.appendChild(panel);
    panel.dataset.kmhMapId=String(selectedMap().map.id);
    const topics=panel.querySelector('[data-kmh-rc-topic]');for(const [key,t] of Object.entries(commonTopics)){const option=document.createElement('option');option.value=key;option.textContent=t[0];topics.append(option);}
    topics.addEventListener('change',()=>{panel.dataset.kmhRcTopic=topics.value;sync(panel);});
    panel.querySelector('[data-kmh-rc-map]').addEventListener('change',e=>{panel.dataset.kmhMapId=e.target.value;panel.dataset.kmhManualTier='0';sync(panel);});
    panel.querySelector('[data-kmh-rc-tier]').addEventListener('change',e=>{panel.dataset.kmhTier=e.target.value;panel.dataset.kmhManualTier='1';sync(panel);});
    panel.querySelector('#close-rc-panel').addEventListener('click',()=>panel.style.display='none');
    sync(panel);
  }
  window.KmhOpenRC=open;
  const openPanel=document.getElementById('custom-rc-panel');
  if(openPanel&&openPanel.style.display!=='none')sync(openPanel);
}
