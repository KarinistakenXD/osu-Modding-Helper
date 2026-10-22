/* Reliable image/link paste and drag-and-drop for native osu! discussion editors.
   Text URLs are converted ONLY when they are recognizable direct image/screenshot links.
   Actual image files require user-configured s-ul.eu; no OAuth is required for this. */
(() => {
 'use strict';
 let hasKey=false;
 chrome.storage.local.get(['sulApiKey'], d=>{hasKey=!!d.sulApiKey?.trim();});
 chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes.sulApiKey)hasKey=!!changes.sulApiKey.newValue?.trim();});
 const allowedArea='.beatmap-discussion-new, .beatmap-discussion-post--new-reply, .beatmap-discussion-post__message--editor, .beatmap-discussion-post--reply, .beatmap-discussion--review, .beatmap-discussion-review';
 const editable='textarea, [contenteditable="true"]';
 const imageExt=/\.(png|jpe?g|gif|webp|avif|bmp)(?:\?.*)?$/i;
 // s-ul is a file host, but some formats are restricted by the service.
 // Never upload executables or arbitrary unknown file types by accident.
 const safeFile=/\.(?:png|jpe?g|gif|webp|avif|bmp|svg|pdf|txt|md|json|csv|xml|log|osu|osz|zip|7z|rar|mp3|ogg|wav|mp4|webm)$/i;
 const isImageFile=file=>file.type.startsWith('image/')||/\.(png|jpe?g|gif|webp|avif|bmp|svg)$/i.test(file.name||'');
 const fileAllowed=file=>!!file&&safeFile.test(file.name||'');
 const escapeLabel=name=>String(name||'Attachment').replace(/[\[\]\r\n]/g,'').replace(/[()]/g,'_').slice(0,100);
 function inside(){return /^\/beatmapsets\/\d+\/discussion(?:\/|$)/.test(location.pathname);}
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
   if(field.isContentEditable){
     // Invoke native insertText so React-based editors receive their own beforeinput/input sequence.
     return document.execCommand('insertText',false,text);
   }
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
   return false;
 }
 function toast(message,action){
   document.getElementById('kmh-upload-status-toast')?.remove();
   const el=document.createElement('div');el.id='kmh-upload-status-toast';el.setAttribute('role','status');
   el.dataset.phase=/uploading|reading/i.test(message)?'loading':/failed|error|could not|requires|larger/i.test(message)?'error':'success';
   const span=document.createElement('span');span.textContent=message;el.append(span);
   if(action){const button=document.createElement('button');button.type='button';button.textContent='Open settings';button.onclick=()=>{el.remove();const opener=document.querySelector('[data-kmh-open-settings]')||document.querySelector('.kmh-entry-main');opener?.click();document.querySelector('[data-settings-tab="integrations"]')?.click();};el.append(button);}
   document.body.append(el);setTimeout(()=>el.remove(),7000);
 }
 function upload(field,file){
   if(!file)return;
   if(!fileAllowed(file)){toast('This file type is not supported. Choose an image, document, .osu/.osz, archive or media file.');return;}
   if(!hasKey){toast('File upload requires your s-ul.eu API key.',true);return;}
   if(file.size>20*1024*1024){toast('File exceeds the 20 MB upload limit.');return;}
   const token=`[uploading:${crypto.randomUUID?.()||('kmh-'+Date.now()+'-'+Math.random().toString(36).slice(2))}]`;
   const canReplace=field instanceof HTMLTextAreaElement;
   if(canReplace)nativeInsert(field,token);
   toast(`Uploading ${file.name||'file'} to s-ul.eu…`);
   const reader=new FileReader();
   reader.onerror=()=>{if(canReplace)replacePlaceholder(field,token,'');toast('Could not read the image file.');};
   reader.onload=()=>{
     try{
       chrome.runtime.sendMessage({action:'uploadFile',imageData:reader.result,fileName:file.name||'clipboard.png',fileType:file.type}, response=>{
         if(chrome.runtime.lastError||!response?.url){
           if(canReplace)replacePlaceholder(field,token,'');
           toast('Image upload failed: '+(response?.error||chrome.runtime.lastError?.message||'unknown error'),true);
           return;
         }
         const name=escapeLabel(file.name||'Image');
         const markdown=isImageFile(file)?`![${name}](${response.url})`:`[${name}](${response.url})`;
         if(canReplace)replacePlaceholder(field,token,markdown);else nativeInsert(field,markdown);
         document.dispatchEvent(new CustomEvent('kmh-image-uploaded',{detail:{url:response.url}}));
         document.querySelector('.kmh-linked-preview')?.removeAttribute('hidden');
         toast('File uploaded and link inserted into the editor.');
       });
     }catch(error){if(canReplace)replacePlaceholder(field,token,'');toast('Upload failed: '+error.message);}
   };
   reader.readAsDataURL(file);
 }
 document.addEventListener('paste',e=>{
   if(!inside())return;
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
   overlay.innerHTML='<div class="kmh-upload-drop-message"><i class="fas fa-cloud-upload-alt" aria-hidden="true"></i><strong>Drop a file to upload</strong><span>Images embed · other supported files become links · s-ul.eu</span></div>';
   document.body.appendChild(overlay);
   return overlay;
 }
 function hideDrop(){dragDepth=0;if(overlay)overlay.hidden=true;}
 document.addEventListener('dragenter',e=>{
   if(!inside()||!isModHelperFeatureEnabled('imageUploader')||!hasFiles(e))return;
   dragDepth++;
   const el=getOverlay();
   el.hidden=false;
 },true);
 document.addEventListener('dragover',e=>{
   if(!inside()||!isModHelperFeatureEnabled('imageUploader')||!hasFiles(e))return;
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
   if(!shouldHandle)return;
   const files=[...(e.dataTransfer?.files||[])];
   if(!files.length)return;
   e.preventDefault(); // never navigate the page to a dropped file
   const field=currentEditor(e.target);
   if(!field){toast('Focus an osu! discussion editor before dropping a file.');return;}
   e.stopPropagation();
   files.slice(0,8).forEach(f=>upload(field,f));
 },true);
 window.KmhPasteUpload={findField,isImageLink,nativeInsert};
})();
