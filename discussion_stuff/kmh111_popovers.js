/* Non-invasive UI popovers: never change osu! React layout dimensions. */
(()=>{
 'use strict';
 let current=null;
 function place(anchor,panel,preferred='side'){
  if(!anchor?.isConnected||!panel?.isConnected)return;
  // Keep Coach open logically, but don't obscure unrelated content several screens away.
  if(preferred==='coach') {
    const rect=anchor.getBoundingClientRect();
    const distant=rect.bottom<64||rect.top>window.innerHeight-48;
    panel.classList.toggle('kmh111-offscreen-anchor',distant);
    if(distant)return;
  } else panel.classList.remove('kmh111-offscreen-anchor');
  const a=anchor.getBoundingClientRect(), w=window.innerWidth,h=window.innerHeight, gap=9;
  const width=Math.min(preferred==='coach'?360:408,Math.max(240,w-20));
  panel.style.width=width+'px';panel.style.maxHeight=Math.min(615,Math.round(h*.70))+'px';
  panel.style.left='-10000px';panel.style.top='0px';
  const paneHeight=panel.getBoundingClientRect().height;
  const leftRoom=a.left-gap-9,rightRoom=w-a.right-gap-9;
  let x,y;
  if((preferred==='side'||preferred==='coach')&&Math.max(leftRoom,rightRoom)>=Math.min(260,width)){
    x=preferred==='coach'&&rightRoom>=width?a.right+gap:(rightRoom>=width||rightRoom>=leftRoom?a.right+gap:a.left-width-gap);
    y=Math.min(a.top, h-paneHeight-10);
  }else{
    x=Math.min(a.left,w-width-10);
    y=h-a.bottom>=Math.min(paneHeight,250)+gap ?a.bottom+gap:Math.max(10,a.top-paneHeight-gap);
  }
  panel.style.left=Math.max(10,Math.min(x,w-width-10))+'px';
  panel.style.top=Math.max(10,Math.min(y,h-paneHeight-10))+'px';
 }
 function close(){if(!current)return;const s=current;current=null;document.removeEventListener('pointerdown',s.pointer,true);document.removeEventListener('keydown',s.key,true);document.removeEventListener('scroll',s.scroll,true);window.removeEventListener('resize',s.resize);s.panel.hidden=true;s.anchor?.setAttribute('aria-expanded','false');s.onClose?.();}
 function show(anchor,panel,opts={}){
  if(!anchor||!panel)return;
  if(current?.panel===panel){close();return false;}
  close();panel.hidden=false;panel.classList.add('kmh111-floating');document.body.append(panel);
  anchor.setAttribute('aria-expanded','true');
  const s={anchor,panel,onClose:opts.onClose};
  s.pointer=(ev)=>{if(panel.contains(ev.target)||s.anchor.contains(ev.target)||opts.stayOpen)return;close();};
  s.key=(ev)=>{if(ev.key==='Escape'){const previous=s.anchor;close();previous.focus?.();}};
  s.scroll=(ev)=>{if(panel.contains(ev.target))return;if(opts.stayOpen){s.resize();return;}close();};
  s.resize=()=>place(s.anchor,panel,opts.preferred||'side');
  current=s;document.addEventListener('pointerdown',s.pointer,true);document.addEventListener('keydown',s.key,true);document.addEventListener('scroll',s.scroll,true);window.addEventListener('resize',s.resize);
  s.resize();return true;
 }
 function reanchor(panel,anchor){
   if(current?.panel!==panel||!anchor?.isConnected)return false;
   if(current.anchor===anchor)return true;
   current.anchor?.setAttribute('aria-expanded','false');
   current.anchor=anchor;anchor.setAttribute('aria-expanded','true');
   current.resize();return true;
 }
 window.Kmh111Popover={show,close,reanchor,isOpen:el=>current?.panel===el,reposition:()=>current?.resize()};
})();
