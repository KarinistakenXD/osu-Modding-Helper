/* v1.1.2 upload providers. Runs only in the extension background context.
   Never uploads without an explicit user paste/drop/click. No hidden fallback after
   a network request: a lost response does not prove an upload failed. */
(() => {
  'use strict';
  const MB = 1000000;
  const formats = new Set(['png','jpg','jpeg','jpe','gif','webp','avif','apng','bmp','svg','tif','tiff','heic','heif','ico','jxl']);
  const webFormats = new Set(['png','jpg','jpeg','jpe','gif','webp','avif','apng','bmp','svg','ico']);
  const PROVIDERS = Object.freeze({
    sul: {label:'s-ul.eu',limit:20*MB, credential:'sulApiKey',temporary:false,hasPublishedLimit:false},
    catbox: {label:'Catbox',limit:200*MB, credential:null,temporary:false,hasPublishedLimit:true},
    imgbb: {label:'ImgBB',limit:32*MB, credential:'imgbbApiKey',temporary:false,hasPublishedLimit:true},
    litterbox: {label:'Litterbox',limit:200*MB,credential:null,temporary:true,hasPublishedLimit:false}
  });
  const keys=['uploadProvider','sulApiKey','catboxUserhash','imgbbApiKey','uploadLitterboxExpiry'];
  const asText=v=>typeof v==='string'?v.trim():'';
  function ext(name){const s=asText(name);const m=/\.([a-z0-9]{2,6})$/i.exec(s);return m?m[1].toLowerCase():'';}
  function isImage(file){return asText(file.type).startsWith('image/') || formats.has(ext(file.name));}
  function isWebImage(file){return webFormats.has(ext(file.name))||['image/gif','image/png','image/jpeg','image/webp','image/avif','image/apng','image/svg+xml','image/bmp','image/x-icon'].includes(asText(file.type));}
  function compatible(id,file,conf){
    const p=PROVIDERS[id];if(!p)return {ok:false,reason:'Unknown upload provider'};
    if(!file||!Number.isFinite(file.size)||file.size<=0)return {ok:false,reason:'Empty or invalid attachment'};
    const imageLimit=self.KmhUploadLimits?.validate(file);
    if(imageLimit && !imageLimit.ok)return {ok:false,reason:imageLimit.message,code:imageLimit.code};
    if(file.size>p.limit)return {ok:false,reason:`File exceeds ${p.label} limit (${Math.floor(p.limit/MB)} MB)`};
    if(p.credential&&!asText(conf[p.credential]))return {ok:false,reason:`${p.label} needs an API key`};
    if(id==='imgbb'&&!isImage(file))return {ok:false,reason:'ImgBB accepts images only'};
    // Limits for s-ul and Litterbox are conservative extension defaults, not verified provider quota.
    return {ok:true,reason:''};
  }
  function select(file,conf){
    const requested=asText(conf.uploadProvider)||'smart';
    const order=requested==='smart'?['sul','catbox','imgbb']: [requested];
    for(const id of order){if(compatible(id,file,conf).ok)return {id,reason:requested==='smart'?'Selected by file size, type and configured credentials':'Selected manually'};}
    const reasons=order.map(id=>`${PROVIDERS[id]?.label||id}: ${compatible(id,file,conf).reason}`);
    throw Object.assign(new Error(reasons.join('; ')),{code:'NO_PROVIDER'});
  }
  function normalizeUrl(value,allowedHosts){
    const u=new URL(value);
    if(u.protocol!=='https:'||u.username||u.password||!allowedHosts.some(h=>u.hostname===h||u.hostname.endsWith('.'+h)))throw Error('Provider returned an unexpected URL');
    return u.href;
  }
  async function send(id,file,conf){
    const check=compatible(id,file,conf);if(!check.ok)throw Error(check.reason);
    const form=new FormData();let endpoint,parse;
    if(id==='catbox'){
      endpoint='https://catbox.moe/user/api.php';form.append('reqtype','fileupload');
      if(asText(conf.catboxUserhash))form.append('userhash',asText(conf.catboxUserhash));
      form.append('fileToUpload',file.blob,file.name);
      parse=async r=>normalizeUrl((await r.text()).trim(),['files.catbox.moe']);
    }else if(id==='litterbox'){
      endpoint='https://litterbox.catbox.moe/resources/internals/api.php';form.append('reqtype','fileupload');
      const expiry=['1h','12h','24h','72h'].includes(conf.uploadLitterboxExpiry)?conf.uploadLitterboxExpiry:'24h';
      form.append('time',expiry);form.append('fileToUpload',file.blob,file.name);
      parse=async r=>normalizeUrl((await r.text()).trim(),['litter.catbox.moe']);
    }else if(id==='imgbb'){
      endpoint='https://api.imgbb.com/1/upload?key='+encodeURIComponent(asText(conf.imgbbApiKey));
      form.append('image',file.blob,file.name);
      parse=async r=>{const json=await r.json();if(!json.success||!json.data?.url)throw Error('ImgBB rejected this upload');return normalizeUrl(json.data.image?.url||json.data.url,['i.ibb.co']);};
    }else if(id==='sul'){
      const u=new URL('https://s-ul.eu/api/v1/upload');u.searchParams.set('wizard','true');u.searchParams.set('key',asText(conf.sulApiKey));endpoint=u.toString();
      form.append('file',file.blob,file.name);
      parse=async r=>{const json=await r.json();if(!json.url)throw Error('s-ul.eu returned no file URL');return normalizeUrl(json.url,['s-ul.eu']);};
    }
    // Any failure after network dispatch is terminal: do NOT silently reupload.
    const response=await fetch(endpoint,{method:'POST',body:form,credentials:'omit',redirect:'error',signal:AbortSignal.timeout(45000)});
    if(!response.ok)throw Object.assign(new Error(`${PROVIDERS[id].label} returned HTTP ${response.status}`),{status:response.status});
    const url=await parse(response);
    return {url,provider:id,image:isWebImage(file),temporary:PROVIDERS[id].temporary};
  }
  async function upload(req){
    const stored=await chrome.storage.local.get(keys);const conf={...stored};
    if(typeof req.imageData!=='string'||!req.imageData.startsWith('data:'))throw Error('Invalid file data');
    if(req.imageData.length>300*MB)throw Error('File payload too large');
    const match=/^data:([^;,]+)?;base64,([A-Za-z0-9+/=]+)$/.exec(req.imageData);
    if(!match)throw Error('Unsupported file encoding');
    // Blob decoding in a background worker, without routing file contents through third-party proxies.
    const response=await fetch(req.imageData);
    const blob=await response.blob();
    const name=asText(req.fileName).slice(0,160)||'attachment.bin';
    const file={name,type:blob.type||req.fileType||'',size:blob.size,blob};
    // Validate after data URL decoding as well; never dispatch network upload for an oversized image.
    // The preflight in compatible() applies regardless of selected provider.
    const resultCheck=self.KmhUploadLimits?.validate(file);
    if(resultCheck && !resultCheck.ok)throw Object.assign(new Error(resultCheck.message),{code:resultCheck.code});
    const selected=select(file,conf);
    const result=await send(selected.id,file,conf);
    return {...result,reason:selected.reason};
  }
  self.KmhUploadProviders={PROVIDERS,isImage,isWebImage,compatible,select,upload};
})();
