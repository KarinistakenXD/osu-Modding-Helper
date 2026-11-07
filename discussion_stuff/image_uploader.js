/* Paste/drop into native osu! editors, provider selection occurs in background.
   Explicit Markdown images use any URL (not only extensions); visual preview decides
   whether a URL actually renders as an image. */
(() => {
 'use strict';

 const allowedArea='.beatmap-discussion-new, .beatmap-discussion-post--new-reply, .beatmap-discussion-post__message--editor, .beatmap-discussion-post--reply, .beatmap-discussion--review, .beatmap-discussion-review';
 // Only native textarea editors are supported. New Review uses Slate; modifying its
 // contentEditable DOM from an extension can desynchronize Slate's internal model.
 const editable='textarea';
 const imageExt=/\.(?:png|jpe?g|gif|webp|avif|apng|bmp|ico|svg)(?:$|[?#])/i;
 // s-ul is a file host, but some formats are restricted by the service.
 // Never upload executables or arbitrary unknown file types by accident.
 const safeFile=/\.(?:png|jpe?g|gif|webp|avif|apng|bmp|svg|ico|tiff?|heic|heif|jxl|pdf|txt|md|json|csv|xml|log|osu|osz|zip|7z|rar|mp3|ogg|wav|mp4|webm)$/i;
 const webImage=/\.(?:png|jpe?g|gif|webp|avif|apng|bmp|svg|ico)$/i;
 const mimeImageExt = Object.freeze({
   'image/png':'png', 'image/jpeg':'jpg', 'image/gif':'gif', 'image/webp':'webp',
   'image/avif':'avif', 'image/apng':'apng', 'image/bmp':'bmp',
   'image/svg+xml':'svg', 'image/x-icon':'ico', 'image/vnd.microsoft.icon':'ico'
 });
 const imageMime=file=>mimeImageExt[String(file?.type||'').trim().toLowerCase()]||null;
 const isImageFile=file=>webImage.test(file.name||'') || !!imageMime(file);
 // Clipboard images often have no extension. Trust only an allowlisted image MIME
 // for *extensionless* files; a forged MIME must not approve named .exe files.
 const fileAllowed=file=>!!file && (safeFile.test(file.name||'') ||
   (!/\.[^./\\]+$/.test(file.name||'') && !!imageMime(file)));
 const transportName=file=>{
   const name=String(file?.name||'').trim();
   return safeFile.test(name)?name:(imageMime(file)?`${name||'clipboard-image'}.${imageMime(file)}`:name);
 };
 const escapeLabel=name=>String(name||'Attachment').replace(/[\[\]\r\n]/g,'').replace(/[()]/g,'_').slice(0,100);
 function inside(){return /^\/beatmapsets\/\d+\/discussion(?:\/|$)/.test(location.pathname);}
 function isReviewPage(){
   // A single Review can have nested non-Slate controls and a drag overlay
   // targeted at document.body. Do not use a previous native textarea there.
   if(/\/discussion\/(?:-\/)?reviews(?:\/|$)/i.test(location.pathname))return true;
   return [...document.querySelectorAll('.beatmap-discussion-new .page-title')]
     .some(title=>/^\s*New Review\b/i.test(title.textContent||'') && title.getClientRects().length);
 }
 function reviewSlate(target){
   if(isReviewPage())return true;
   const el=target instanceof Element?target:target?.parentElement;
   return !!el?.closest?.('[data-slate-editor="true"],.beatmap-discussion-editor,.beatmap-discussion-review,.beatmap-discussion--review') ||
     !!el?.closest?.('.beatmap-discussion-new')?.querySelector?.('.page-title')?.textContent?.trim().startsWith('New Review');
 }
 function findField(target){
   if(!(target instanceof Element))return null;
   const area=target.closest(allowedArea);if(!area)return null;
   const direct=target.closest(editable);
   if(direct && area.contains(direct))return direct;
   const fields=[...area.querySelectorAll(editable)].filter(el=>el.isConnected && el.getClientRects().length);
   // A drag/drop into a wrapper selects the nearest visible editor; don't choose an unrelated editor.
   return fields.length===1?fields[0]:null;
 }
 function nativeInsert(field,text){
   field.focus();
   if(field instanceof HTMLTextAreaElement||field instanceof HTMLInputElement){
     const start=field.selectionStart??field.value.length, end=field.selectionEnd??start;
     const newValue=field.value.slice(0,start)+text+field.value.slice(end);
     const prototype=field instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;
     Object.getOwnPropertyDescriptor(prototype,'value').set.call(field,newValue);
     field.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:text}));
     field.setSelectionRange(start+text.length,start+text.length);
     return true;
   }
   // Never mutate Slate or any other contentEditable editor directly.
   return false;
 }
 function replacePlaceholder(field,token,replacement){
   if(!(field instanceof HTMLTextAreaElement))return nativeInsert(field,replacement);
   const pos=field.value.indexOf(token);
   if(pos<0)return false; // User may have removed the placeholder while uploading.
   const updated=field.value.slice(0,pos)+replacement+field.value.slice(pos+token.length);
   Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(field,updated);
   field.dispatchEvent(new Event('input',{bubbles:true}));
   return true;
 }
 function isImageLink(raw){
   let u;try{u=new URL(raw);}catch{return false;}
   if(!['https:','http:'].includes(u.protocol)||u.username||u.password)return false;
   if(imageExt.test(u.pathname+u.search))return true;
   if(u.hostname==='osu.ppy.sh'&&/^\/ss\/\d+(?:\/[a-zA-Z0-9]+)?\/?$/.test(u.pathname))return true;
   // This host serves extensionless image URLs; if not an image the preview will fall back to a link.
   if(/(^|\.)s-ul\.eu$/i.test(u.hostname)&&u.pathname!=='/'&& !/\.(pdf|zip|osz|txt|mp4|webm)$/i.test(u.pathname))return true;
   if(['files.catbox.moe','litter.catbox.moe','i.ibb.co'].includes(u.hostname)&&u.pathname!=='/'&&!/\.(pdf|zip|osz|txt|mp4|webm)$/i.test(u.pathname))return true;
   return false;
 }
 function toast(message,action,explicitPhase){
   document.getElementById('kmh-upload-status-toast')?.remove();
   const el=document.createElement('div');el.id='kmh-upload-status-toast';
   el.dataset.phase=explicitPhase||(/uploading|reading/i.test(message)?'loading':/failed|error|could not|requires|larger|rejected|exceeds/i.test(message)?'error':'success');
   el.setAttribute('role',el.dataset.phase==='error'?'alert':'status');
   const span=document.createElement('span');span.textContent=message;el.append(span);
   if(action===true){const button=document.createElement('button');button.type='button';button.textContent='Open settings';button.onclick=()=>{el.remove();const opener=document.querySelector('[data-kmh-open-settings]')||document.querySelector('.kmh-entry-main');opener?.click();document.querySelector('[data-settings-tab="integrations"]')?.click();};el.append(button);}
   if(typeof action==='string'&&/^https:\/\//.test(action)){const a=document.createElement('a');a.textContent='Open file ↗';a.href=action;a.target='_blank';a.rel='noopener noreferrer';el.append(a);}
   if(el.dataset.phase==='error'){const dismiss=document.createElement('button');dismiss.type='button';dismiss.textContent='Dismiss';dismiss.setAttribute('aria-label','Dismiss upload error');dismiss.onclick=()=>el.remove();el.append(dismiss);}
   document.body.append(el);setTimeout(()=>el.remove(),el.dataset.phase==='error'?14000:7000);
 }
 function checkUploadedPreview(result){
   // A completed API request is not proof that an image URL is readable here.
   // Loading an image avoids CORS fetch constraints and never reuploads the file.
   if(!result?.image || !/^https:\/\//.test(result.url||''))return;
   const image=new Image();let finished=false;
   const timer=setTimeout(()=>finish(false,'Preview timed out'),10000);
   function finish(ok,reason){if(finished)return;finished=true;clearTimeout(timer);image.onload=image.onerror=null;
     if(!ok)toast(`${result.provider||'Image host'} accepted the file, but this browser could not load its image (${reason}). Open the direct link before sharing, or switch hosts.`,result.url,'error');
   }
   image.onload=()=>finish(true);image.onerror=()=>finish(false,'load failed');
   image.referrerPolicy='no-referrer';image.src=result.url;
 }
 // Pending uploads are scoped to the native textarea's discussion/reply composer.
 // A placeholder makes osu!web consider an otherwise empty draft non-empty; lock
 // every native posting action until ALL requests for that composer have settled.
 // Never put this guard on the Slate-based New Review composer.
 const composerSelector='.beatmap-discussion-new, .beatmap-discussion-post--new-reply, .beatmap-discussion-post--reply, .beatmap-discussion-post';
 const postButtonSelector='.beatmap-discussion-new__footer [data-type], .beatmap-discussion-post__footer [data-action]';
 const uploadGuards=new Map();
 const originals=new WeakMap();
 const UPLOAD_TIMEOUT_MS=50000;
 const composerOf=field=>field?.closest?.(composerSelector)||null;
 const pendingFor=root=>uploadGuards.get(root)?.pending.size||0;
 function buttonsFor(root){return [...root.querySelectorAll(postButtonSelector)];}
 function lockButton(button){
   if(!originals.has(button)) originals.set(button,{
     ariaDisabled:button.getAttribute('aria-disabled'),
     title:button.getAttribute('title')
   });
   // Do not set the React-owned disabled property; osu!web may rerender it.
   // This native-looking disabled class is backed by a real event guard below.
   button.classList.add('btn-osu-big--disabled','kmh-upload-submit-locked');
   button.setAttribute('aria-disabled','true');
   button.setAttribute('title','Uploading attachment — posting is temporarily disabled');
 }
 function unlockButton(button){
   const old=originals.get(button);
   if(!old)return;
   button.classList.remove('kmh-upload-submit-locked');
   // React remains the authority on validity: derive the final native class
   // from its actual disabled property, not the pre-upload snapshot.
   button.classList.toggle('btn-osu-big--disabled',!!button.disabled);
   if(old.ariaDisabled==null)button.removeAttribute('aria-disabled');
   else button.setAttribute('aria-disabled',old.ariaDisabled);
   if(old.title==null)button.removeAttribute('title');
   else button.setAttribute('title',old.title);
   originals.delete(button);
 }
 function activeTotal(){let n=0;for(const state of uploadGuards.values())n+=state.pending.size;return n;}
 function updateProgressToast(){
   const n=activeTotal();
   let toast=document.getElementById('kmh-upload-progress-toast');
   if(!n){toast?.remove();return;}
   if(!toast){
     toast=document.createElement('div');toast.id='kmh-upload-progress-toast';
     toast.setAttribute('role','status');toast.setAttribute('aria-live','polite');
     const spinner=document.createElement('span');spinner.className='kmh-upload-progress-spinner';spinner.setAttribute('aria-hidden','true');
     const message=document.createElement('span');message.className='kmh-upload-progress-message';
     toast.append(spinner,message);document.body.append(toast);
   }
   toast.querySelector('.kmh-upload-progress-message').textContent=`Uploading ${n} attachment${n===1?'':'s'} — posting disabled until finished`;
 }
 function updateGuard(root){
   const state=uploadGuards.get(root);
   if(!state)return;
   const n=state.pending.size;
   if(n){
     root.dataset.kmhUploadPending='true';
     root.dataset.kmhUploadCount=String(n);
     buttonsFor(root).forEach(lockButton);
   }else{
     delete root.dataset.kmhUploadPending;
     delete root.dataset.kmhUploadCount;
     buttonsFor(root).forEach(unlockButton);
     state.observer.disconnect();uploadGuards.delete(root);
   }
   updateProgressToast();
 }
 function startUpload(field,token){
   const root=composerOf(field);
   if(!root) return ()=>{};
   let state=uploadGuards.get(root);
   if(!state){
     state={pending:new Set(),observer:new MutationObserver(()=>{
       if(state.pending.size)buttonsFor(root).forEach(lockButton);
     })};
     // React can replace post buttons during upload. Keep each new button locked.
     state.observer.observe(root,{subtree:true,childList:true});
     uploadGuards.set(root,state);
   }
   state.pending.add(token);updateGuard(root);
   let ended=false;
   return ()=>{if(ended)return;ended=true;state.pending.delete(token);updateGuard(root);};
 }
 function stopSubmission(event){
   if(!inside())return;
   let root=event.target?.closest?.(composerSelector);
   if(!root||!pendingFor(root))return;
   if(event.type==='keydown'){
     // New Discussion and reply textareas submit on Enter; Shift+Enter
     // remains available for multiline editing. Never block ordinary typing.
     if(!(event.target instanceof HTMLTextAreaElement) || event.key!=='Enter'||event.shiftKey)return;
   }else if(event.type==='click'){
     if(!event.target?.closest?.(postButtonSelector))return;
   }else if(event.type==='submit'){
     // Block a form submit only when it belongs to this composer.
   }else return;
   event.preventDefault();event.stopImmediatePropagation();
 }
 document.addEventListener('click',stopSubmission,true);
 document.addEventListener('keydown',stopSubmission,true);
 document.addEventListener('submit',stopSubmission,true);
 // Source-level test hook only; no UI or posting action is exposed through this.
 window.KmhUploadPending={count:()=>activeTotal(),composerCount:root=>pendingFor(root)};
 function upload(field,file){
   if(!file)return;
   if(!fileAllowed(file)){toast('This file type is not supported. Choose an image, document, .osu/.osz, archive or media file.',false,'error');return;}
   const osuSizeCheck=window.KmhUploadLimits?.validate(file);
   if(osuSizeCheck && !osuSizeCheck.ok){toast(osuSizeCheck.message,false,'error');return;}
   if(file.size>48*1000000){toast('Files over 48 MB exceed this extension’s current upload transport limit.',false,'error');return;}
   const token=`[uploading:${crypto.randomUUID?.()||('kmh-'+Date.now()+'-'+Math.random().toString(36).slice(2))}]`;
   const canReplace=field instanceof HTMLTextAreaElement;
   // Lock posting BEFORE inserting the temporary placeholder or dispatching input.
   const unlock=startUpload(field,token);
   if(canReplace)nativeInsert(field,token);
   const reader=new FileReader();
   let settled=false;
   const watchdog=setTimeout(()=>fail('Upload timed out. The host may have saved the file; check before retrying.'),UPLOAD_TIMEOUT_MS);
   function settle(){if(settled)return false;settled=true;clearTimeout(watchdog);unlock();return true;}
   function fail(message){
     if(!settle())return;
     if(canReplace)replacePlaceholder(field,token,'');
     toast(message,false,'error');
   }
   reader.onerror=()=>fail('Could not read the selected file.');
   reader.onabort=()=>fail('File reading was cancelled.');
   reader.onload=()=>{
     if(settled)return;
     try{
       chrome.runtime.sendMessage({action:'uploadFile',imageData:reader.result,fileName:transportName(file),fileType:file.type}, response=>{
         if(settled)return; // Ignore a late callback after timeout.
         const runtimeError=chrome.runtime.lastError?.message;
         if(runtimeError||!response?.url){
           fail('Upload failed: '+(response?.error||runtimeError||'unknown error'));
           return;
         }
         const name=escapeLabel(transportName(file)||'Image');
         const markdown=(response.image&&isImageFile(file))?`![${name}](${response.url})`:`[${name}](${response.url})`;
         // The user may delete the placeholder during upload. Never append a
         // link unexpectedly or mark an unmodified draft as safe to post.
         const inserted=canReplace?replacePlaceholder(field,token,markdown):nativeInsert(field,markdown);
         settle();
         if(!inserted){toast('Upload completed but its placeholder was removed. Open the file link to copy it manually.',response.url,'error');return;}
         document.dispatchEvent(new CustomEvent('kmh-image-uploaded',{detail:{url:response.url}}));
         toast(`Upload accepted by ${response.provider||'selected host'}. Checking image availability…`,response.url,'success');
         checkUploadedPreview(response);
       });
     }catch(error){fail('Upload failed: '+error.message);}
   };
   try{reader.readAsDataURL(file);}catch(error){fail('Could not read the selected file: '+error.message);}
 }

 function uploadForReview(file, onUpdate){
   if(!file || !isImageFile(file) || !fileAllowed(file)){
     onUpdate?.({error:'Choose a supported image (PNG, JPEG, GIF, WebP, AVIF or another allowed image format).'});
     return;
   }
   const limit=window.KmhUploadLimits?.validate(file);
   if(limit && !limit.ok){onUpdate?.({error:limit.message});return;}
   if(file.size>48*1000000){onUpdate?.({error:'Image exceeds upload transport limit.'});return;}
   onUpdate?.({pending:true});
   const reader=new FileReader();
   let settled=false;
   const watchdog=setTimeout(()=>finish({error:'Upload timed out. The host may have saved the file; check before retrying.'}),UPLOAD_TIMEOUT_MS);
   function finish(result){if(settled)return;settled=true;clearTimeout(watchdog);onUpdate?.(result);}
   reader.onerror=()=>finish({error:'Cannot read this image.'});
   reader.onload=()=>{
     try { chrome.runtime.sendMessage({action:'uploadFile',imageData:reader.result,fileName:transportName(file),fileType:file.type}, response=>{
       const error=chrome.runtime.lastError?.message || response?.error;
       if(error || !/^https:\/\//.test(response?.url||'')){finish({error:error||'Image host returned no valid HTTPS URL.'});return;}
       const markdown=`![${escapeLabel(transportName(file))}](${response.url})`;
       finish({url:response.url,markdown,provider:response.provider||'image host'});
       checkUploadedPreview(response);
     });}catch(e){finish({error:e.message});}
   };
   try{reader.readAsDataURL(file);}catch(e){finish({error:e.message});}
 }
 window.KmhReviewUpload={upload:uploadForReview};
 document.addEventListener('paste',e=>{
   if(!inside()||reviewSlate(e.target))return;
   const field=findField(e.target);
   if(!field)return;
   const cb=e.clipboardData;if(!cb)return;
   const files=[...(cb.items||[])].filter(x=>x.kind==='file').map(x=>x.getAsFile()).filter(Boolean);
   if(files.length){
     if(!isModHelperFeatureEnabled('imageUploader')||window.imagePasteEnabled===false)return;
     e.preventDefault();e.stopPropagation();files.forEach(file=>upload(field,file));
     return;
   }
   const text=cb.getData('text/plain').trim();
   // Only convert a standalone pasted URL. Never rewrite embedded Markdown or entire paragraphs.
   if(text.length>0&&text.length<2400&&!/\s/.test(text)&&isImageLink(text)){
     e.preventDefault();e.stopPropagation();
     nativeInsert(field,`![](${text})`);
   }
 },true);
 let activeEditor=null;
 const hasFiles=e=>[...(e.dataTransfer?.types||[])].includes('Files');
 const currentEditor=target=>{
   const direct=findField(target);
   if(direct)return direct;
   if(activeEditor?.isConnected&&activeEditor.getClientRects().length)return activeEditor;
   const editors=[...new Set([...document.querySelectorAll(allowedArea)]
     .flatMap(area=>[...area.querySelectorAll('textarea')]))]
     .filter(n=>n.getClientRects().length>0&&!n.disabled);
   return editors.length===1?editors[0]:null;
 };
 document.addEventListener('focusin',e=>{
   const selected=findField(e.target);
   if(selected)activeEditor=selected;
 },true);
 let overlay=null,dragDepth=0;
 function getOverlay(){
   if(overlay)return overlay;
   overlay=document.createElement('div');
   overlay.className='kmh-upload-drop-overlay';
   overlay.hidden=true;
   overlay.setAttribute('aria-hidden','true');
   overlay.innerHTML='<div class="kmh-upload-drop-message"><i class="fas fa-cloud-upload-alt" aria-hidden="true"></i><strong>Drop a file to upload</strong><span>GIF, PNG, JPEG, WebP and other supported images embed · your selected host</span></div>';
   document.body.appendChild(overlay);
   return overlay;
 }
 function hideDrop(){dragDepth=0;if(overlay)overlay.hidden=true;}
 document.addEventListener('dragenter',e=>{
   if(!inside()||!isModHelperFeatureEnabled('imageUploader')||!hasFiles(e)||reviewSlate(e.target))return;
   dragDepth++;
   const el=getOverlay();
   el.hidden=false;
 },true);
 document.addEventListener('dragover',e=>{
   if(!inside()||!isModHelperFeatureEnabled('imageUploader')||!hasFiles(e)||reviewSlate(e.target))return;
   const editor=currentEditor(e.target);
   if(!editor)return;
   e.preventDefault();
   if(e.dataTransfer)e.dataTransfer.dropEffect='copy';
   getOverlay().hidden=false;
 },true);
 document.addEventListener('dragleave',e=>{
   if(!overlay||overlay.hidden)return;
   dragDepth=Math.max(0,dragDepth-1);
   if(!dragDepth || (e.relatedTarget==null && (e.clientX<=0||e.clientY<=0||e.clientX>=innerWidth||e.clientY>=innerHeight)))hideDrop();
 },true);
 window.addEventListener('blur',hideDrop);
 document.addEventListener('keydown',e=>{if(e.key==='Escape')hideDrop();},true);
 document.addEventListener('drop',e=>{
   const shouldHandle=inside()&&isModHelperFeatureEnabled('imageUploader');
   hideDrop();
   if(!shouldHandle||reviewSlate(e.target))return;
   const files=[...(e.dataTransfer?.files||[])];
   if(!files.length)return;
   e.preventDefault(); // never navigate the page to a dropped file
   const field=currentEditor(e.target);
   if(!field){toast('Focus an osu! discussion editor before dropping a file.');return;}
   e.stopPropagation();
   files.slice(0,8).forEach(f=>upload(field,f));
 },true);
 window.KmhPasteUpload={findField,isImageLink,nativeInsert,uploadFile:upload};
})();
// Review image uploads are explicitly user-initiated and never edit Slate.
// The caller displays the returned Markdown for a native paste by the user.
