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
   const span=document.createElement('span');span.textContent=message;el.append(span);
   if(action){const button=document.createElement('button');button.type='button';button.textContent='Open settings';button.onclick=()=>{el.remove();const opener=document.querySelector('[data-kmh-open-settings]')||document.querySelector('.kmh-entry-main');opener?.click();document.querySelector('[data-settings-tab="integrations"]')?.click();};el.append(button);}
   document.body.append(el);setTimeout(()=>el.remove(),7000);
 }
 function upload(field,file){
   if(!file||!file.type.startsWith('image/'))return;
   if(!hasKey){toast('Image upload requires your s-ul.eu API key.',true);return;}
   if(file.size>20*1024*1024){toast('Image is larger than 20 MB. Compress it before uploading.');return;}
   const token=`[uploading:${crypto.randomUUID()}]`;
   const canReplace=field instanceof HTMLTextAreaElement;
   if(canReplace)nativeInsert(field,token);
   toast('Uploading image to s-ul.eu…');
   const reader=new FileReader();
   reader.onerror=()=>{if(canReplace)replacePlaceholder(field,token,'');toast('Could not read the image file.');};
   reader.onload=()=>{
     try{
       chrome.runtime.sendMessage({action:'uploadImage',imageData:reader.result,fileName:file.name||'clipboard.png',fileType:file.type}, response=>{
         if(chrome.runtime.lastError||!response?.url){
           if(canReplace)replacePlaceholder(field,token,'');
           toast('Image upload failed: '+(response?.error||chrome.runtime.lastError?.message||'unknown error'),true);
           return;
         }
         const name=(file.name||'Image').replace(/[\[\]\r\n]/g,'');
         const markdown=`![${name}](${response.url})`;
         if(canReplace)replacePlaceholder(field,token,markdown);else nativeInsert(field,markdown);
         document.dispatchEvent(new CustomEvent('kmh-image-uploaded',{detail:{url:response.url}}));
         document.querySelector('.kmh-linked-preview')?.removeAttribute('hidden');
         toast('Image uploaded and inserted into the discussion.');
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
   const files=[...(cb.items||[])].filter(x=>x.kind==='file'&&x.type.startsWith('image/')).map(x=>x.getAsFile()).filter(Boolean);
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
 document.addEventListener('dragover',e=>{
   if(!inside()||!findField(e.target))return;
   if([...e.dataTransfer?.types||[]].includes('Files')&&isModHelperFeatureEnabled('imageUploader')){
     e.preventDefault();e.dataTransfer.dropEffect='copy';
   }
 },true);
 document.addEventListener('drop',e=>{
   if(!inside()||!isModHelperFeatureEnabled('imageUploader'))return;
   const field=findField(e.target);if(!field)return;
   const files=[...(e.dataTransfer?.files||[])].filter(x=>x.type.startsWith('image/'));
   if(!files.length)return;
   e.preventDefault();e.stopPropagation();files.forEach(f=>upload(field,f));
 },true);
 window.KmhPasteUpload={findField,isImageLink,nativeInsert};
})();
