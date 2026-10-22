/* Inline, opt-in local draft review. Reads native editor; never changes or submits it. */
(function(){
 'use strict';
 const scheduleTimers = new WeakMap();
 const $=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!=null)el.textContent=text;return el;};
 const message=box=>box?.querySelector('.beatmap-discussion-new__message');
 function websiteCategory(box){
   const title=box?.querySelector('.page-title')?.textContent||'';
   if(/new review/i.test(title))return 'review';
   const buttons=[...box?.querySelectorAll('.beatmap-discussion-new__footer button, .beatmap-discussion-new__footer [role=button]')||[]];
   const selected=buttons.find(b=>b.getAttribute('aria-pressed')==='true'||b.getAttribute('aria-checked')==='true'||/\b(?:is-active|active|selected)\b/i.test(b.className||''));
   const label=(selected?.textContent||selected?.getAttribute('title')||'').toLowerCase();
   return ['problem','suggestion','praise','hype','note'].find(k=>label.includes(k))||'unspecified';
 }
 const getField=box=>{const nodes=[...message(box)?.querySelectorAll('textarea, [contenteditable="true"], .markdown-field__input')||[]];return nodes.find(n=>n.getClientRects().length>0)||nodes[0]||null;};
 const draft=box=>{const field=getField(box);return field?(field.value??field.innerText??''):'';};
 function findEditor(){return [...document.querySelectorAll('.beatmap-discussion-new')].find(b=>b.getClientRects().length>0)||document.querySelector('.beatmap-discussion-new');}
 function panelFor(box){return box?._kmh111CoachPanel?.isConnected ? box._kmh111CoachPanel : null;}
 function updateActive(box,shown){const toggle=box?.querySelector('.kmh-editor-actions [data-kmh-open-coach]');if(toggle){toggle.setAttribute('aria-expanded',String(shown));toggle.classList.toggle('is-active',shown);}}
 function render(box){
   const panel=panelFor(box);if(!panel||panel.hidden)return;
   panel.dataset.kmhHasDraft=String(!!draft(box).trim());
   if(!draft(box).trim()){panel.querySelector('.kmh-coach-live-status').textContent='No draft · cleared';}
   const result=window.KmhCoachCore.analyze(draft(box),{postType:websiteCategory(box)});
   const out=panel.querySelector('.kmh-coach-results');out.replaceChildren();
   const summary=$('div','kmh-coach-summary');summary.append($('strong',null,`${result.covered}/${result.total} reasoning elements found`),$('span',null,`${result.wordCount} words · Pattern-based check, not a quality score`));out.append(summary);
   const chips=$('div','kmh-coach-pill-row');for(const [key,title] of Object.entries({where:'Where',evidence:'Observation',why:'Why',impact:'Impact',solution:'Repair',comparison:'Comparison',alternative:'Alternative'})){
      const yes=result.checks[key];chips.append($('span',`kmh-coach-pill ${yes?'is-found':'is-missing'}`,`${yes?'✓':'○'} ${title}`));
   }out.append(chips);
   const notes=$('div','kmh-coach-finding-list');for(const finding of result.notes){const card=$('section',`kmh-coach-finding kmh-coach-${finding.level}`);card.append($('strong',null,finding.title),$('p',null,finding.detail));notes.append(card);}
   if(!result.notes.length)notes.append($('p','kmh-coach-empty','No obvious omissions found. Review the actual chart and song independently.'));
   out.append(notes);
   if(result.relevantTopics.length){const refs=$('details','kmh-coach-refs');refs.append($('summary',null,'RC topics to verify ('+result.relevantTopics.length+')'));for(const topic of result.relevantTopics){const a=$('a',null,topic.title+' ↗');a.href=topic.url;a.target='_blank';a.rel='noopener noreferrer';refs.append(a,$('p',null,topic.detail));}out.append(refs);}
   panel.querySelector('.kmh-coach-stale').hidden=true;
   panel.querySelector('.kmh-coach-live-status').textContent=draft(box).trim()?'Updated after typing pause':'No draft · cleared';
   // Show formatting conversion only when it would actually change draft text.
   const converted=window.KmhCoachCore.cleanupMarkdown(draft(box));
   panel.querySelector('.kmh-coach-clean').hidden=converted===draft(box);
   panel.querySelector('.kmh-coach-copy-preview').hidden=true;
   panel.querySelector('.kmh-coach-copy-preview').value='';
   panel.querySelector('.kmh-coach-copy-clean').hidden=true;
 }
 function ensure(box){
   const host=message(box);if(!host)return null;
   let panel=panelFor(box);if(panel)return panel;
   panel=$('section','kmh-inline-coach');panel.hidden=true;
   panel.setAttribute('aria-label','Draft Coach local review');
   panel.innerHTML=`<header class="kmh-coach-inline-head"><div><strong><i class="fas fa-clipboard-check" aria-hidden="true"></i> Draft Coach</strong><span>Live while open · local only · Karin-’s Road to BN</span></div><button class="kmh-coach-close" type="button" aria-label="Close Draft Coach" title="Collapse Coach">×</button></header>
     <div class="kmh-coach-inline-controls"><span class="kmh-coach-context">Writing guidance · follows native discussion type when detectable</span><span class="kmh-coach-stale" hidden>Typing…</span><span class="kmh-coach-live-status" role="status"></span></div>
     <div class="kmh-coach-results" aria-live="polite"></div>
     <div class="kmh-coach-inline-foot"><span>Based on Karin-’s Road to BN (personal teaching edition). Not official RC or gameplay validation.</span><button class="kmh-coach-clean" type="button" hidden>Preview Markdown cleanup</button></div>
     <details class="kmh-coach-guide"><summary>About the Road to BN method</summary><p>Where → Why → How. Compare similar phrases, explain musical or physical impact, and consider alternative repairs. A polished post does not prove a strong diagnosis.</p></details>
     <textarea class="kmh-coach-copy-preview" aria-label="Converted Markdown preview (not the original draft)" readonly hidden></textarea><button type="button" class="kmh-coach-copy-clean" hidden>Copy converted preview</button>`;
   document.body.append(panel);box._kmh111CoachPanel=panel;
   panel.querySelector('.kmh-coach-close').addEventListener('click',()=>close(box));

   panel.querySelector('.kmh-coach-clean').addEventListener('click',()=>{
      const preview=panel.querySelector('.kmh-coach-copy-preview');preview.value=window.KmhCoachCore.cleanupMarkdown(draft(box));preview.hidden=false;
      panel.querySelector('.kmh-coach-copy-clean').hidden=false;
   });
   panel.querySelector('.kmh-coach-copy-clean').addEventListener('click',async()=>{
      const value=panel.querySelector('.kmh-coach-copy-preview').value;
      try{await navigator.clipboard.writeText(value);panel.querySelector('.kmh-coach-copy-clean').textContent='Copied ✓';}
      catch{panel.querySelector('.kmh-coach-copy-preview').focus();panel.querySelector('.kmh-coach-copy-preview').select();}
   });
   function queueReview(){if(panel.hidden)return;panel.querySelector('.kmh-coach-stale').hidden=false;clearTimeout(scheduleTimers.get(panel));const timer=setTimeout(()=>{if(panel.isConnected&&!panel.hidden)render(box);},900);scheduleTimers.set(panel,timer);}
   const field=getField(box);let composing=false;
   field?.addEventListener('compositionstart',()=>{composing=true;});
   field?.addEventListener('compositionend',()=>{composing=false;queueReview();});
   field?.addEventListener('input',()=>{if(!composing)queueReview();});
   box.addEventListener('click',ev=>{const button=ev.target.closest?.('button');if(!button)return;const label=String(button.textContent||'').trim();if(/^(?:Post|Praise|Suggestion|Problem|Note|Respond|Reply)/i.test(label))setTimeout(()=>{if(panel.isConnected&&!panel.hidden&&!draft(box).trim())render(box);},1100);});
   return panel;
 }
 function close(box){const target=box||findEditor();const panel=panelFor(target);if(panel){clearTimeout(scheduleTimers.get(panel));window.Kmh111Popover?.close?.();panel.hidden=true;updateActive(target,false);}}
 function open(opener){
   const box=opener?.closest?.('.beatmap-discussion-new')||findEditor();
   if(!box)return false;
   const panel=ensure(box);if(!panel)return false;
   if(!panel.hidden){close(box);return true;}
   const anchor=opener?.closest?.('[data-kmh-open-coach]')||box.querySelector('[data-kmh-open-coach]');
   if(!window.Kmh111Popover?.show?.(anchor,panel,{preferred:'coach',stayOpen:true,onClose:()=>updateActive(box,false)}))return false;
   updateActive(box,true);render(box);
   // Keep original caret/selection in the native editor instead of stealing focus.
   return true;
 }
 function reconcile(box){const panel=panelFor(box);if(panel&&!panel.hidden&&!box.isConnected){panel.remove();} else if(panel&&!panel.hidden)updateActive(box,true);}
 window.KmhDraftCoach={open,close,reconcile,analyze:(txt,opts)=>window.KmhCoachCore.analyze(txt,opts)};
})();
