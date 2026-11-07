// Compact, actionable entry point. OAuth is never initiated without a click.
document.addEventListener('DOMContentLoaded', () => {
    const $=id=>document.getElementById(id);
    const note=$('popup-note'), key=$('sul-key'), save=$('save-btn');
    const auth=$('auth-action'), status=$('connection-status'), explanation=$('connection-description');
    let connected=false;
    const profileArea=$('popup-account-identity');
    const safeImage=raw=>{try{const u=new URL(String(raw||''));return u.protocol==='https:'&&['osu.ppy.sh','a.ppy.sh','assets.ppy.sh'].includes(u.hostname)?u.href:'';}catch{return '';}};
    function renderProfile(){
        chrome.runtime.sendMessage({action:'fetchProfile'},response=>{
            if(chrome.runtime.lastError||response?.error||!response?.data?.id){profileArea.hidden=true;return;}
            const user=response.data,id=String(user.id),name=String(user.username||`User ${id}`);
            profileArea.replaceChildren();profileArea.hidden=false;
            const cover=safeImage(user.cover?.url||user.cover?.custom_url||user.cover_url);
            if(cover)profileArea.style.setProperty('--kmh-popup-cover',`url(${JSON.stringify(cover)})`);
            const avatar=safeImage(user.avatar_url);
            if(avatar){const pic=document.createElement('img');pic.className='popup-account-avatar';pic.src=avatar;pic.alt='';profileArea.append(pic);}
            const copy=document.createElement('div');copy.className='popup-account-copy';
            const greeting=document.createElement('strong');greeting.textContent=`Welcome back, ${name}.`;copy.append(greeting);
            const roles=document.createElement('div');roles.className='popup-account-roles';roles.append(document.createTextNode('Usergroup:'));
            const groups=Array.isArray(user.groups)?user.groups.filter(g=>g&&g.short_name&&g.identifier&&!['default','user'].includes(g.identifier)):[];
            if(groups.length>1)roles.firstChild.textContent='Usergroups:';
            if(groups.length)for(const g of groups){const badge=document.createElement('span');badge.className='popup-account-role';badge.textContent=g.short_name;
                if(/^#[a-f0-9]{6}$/i.test(String(g.colour||'')))badge.style.setProperty('--role-colour',g.colour);roles.append(badge);}
            else roles.append(document.createTextNode(' Player'));
            copy.append(roles);profileArea.append(copy);
            if(user.is_supporter){const hearts=document.createElement('span');hearts.className='popup-account-hearts';hearts.title='osu!supporter';hearts.textContent='♥'.repeat(Math.max(1,Math.min(3,Number(user.support_level)||1)));profileArea.append(hearts);}
            chrome.storage.local.get(['kmhGreetedProfiles'],record=>{
                const seen=record?.kmhGreetedProfiles&&typeof record.kmhGreetedProfiles==='object'?record.kmhGreetedProfiles:{};
                greeting.textContent=`${seen[id]?'Welcome back':'Hello'}, ${name}.`;
                if(!seen[id])chrome.storage.local.set({kmhGreetedProfiles:{...seen,[id]:true}});
            });
        });
    }
    const info=text=>{note.textContent=text;};
    function readStatus() {
        status.textContent='Checking osu! connection…';
        chrome.runtime.sendMessage({action:'getAuthStatus'}, response=>{
            if(chrome.runtime.lastError || response?.error){status.textContent='Connection unavailable'; info(chrome.runtime.lastError?.message||response?.error||'Reload extension and retry.');return;}
            connected=!!response?.data?.connected;
            if(connected)renderProfile();else {profileArea.hidden=true;profileArea.replaceChildren();}
            document.body.dataset.connected=String(connected);
            status.textContent=connected?'osu! account connected':'osu! account not connected';
            explanation.textContent=connected?'Your discussions and reply tracking are available.':'Some features require an osu! connection. Public tools still work.';
            auth.textContent=connected?'Disconnect osu! account':'Connect osu! account ↗';
            auth.disabled=false;
        });
    }
    auth.addEventListener('click',()=>{
        if(connected && !confirm('Disconnect osu! from Modding Helper? Local drafts and checkpoints will remain saved.')) return;
        auth.disabled=true;auth.textContent=connected?'Disconnecting…':'Connecting…';
        chrome.runtime.sendMessage({action:connected?'disconnectAuth':'startAuthFlow'},response=>{
            if(chrome.runtime.lastError || response?.error){info(chrome.runtime.lastError?.message||response?.error||'Connection failed');auth.disabled=false;readStatus();return;}
            info(connected?'Disconnected.':'Connected. Your workspace is ready.');
            readStatus();
        });
    });
    async function open(action){
        try {
            const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
            if(!tab?.id)throw Error('No active browser tab.');
            const result=await chrome.tabs.sendMessage(tab.id,{action});
            if(result?.error)throw Error(result.error);
            window.close();
        }catch(e){info(`${e.message||'Cannot open workspace'}. Open a beatmap discussion on osu.ppy.sh, reload, then try again.`);}
    }
    $('open-workspace').addEventListener('click',()=>open('openPageWorkspace'));
    $('open-discussion-settings').addEventListener('click',()=>open('openPageSettings'));
    $('replay-onboarding')?.addEventListener('click',()=>open('openPageTour'));
    chrome.storage.local.get(['sulApiKey','catboxUserhash','imgbbApiKey','uploadProvider','uploadLitterboxExpiry'],record=>{
        key.value=record.sulApiKey||'';
        $('catbox-key').value=record.catboxUserhash||'';
        $('imgbb-key').value=record.imgbbApiKey||'';
        $('upload-provider').value=record.uploadProvider||'smart';
        $('litterbox-expiry').value=record.uploadLitterboxExpiry||'24h';
    });
    save.addEventListener('click',()=>{
        save.disabled=true;
        chrome.storage.local.set({
            sulApiKey:key.value.trim(),catboxUserhash:$('catbox-key').value.trim(),
            imgbbApiKey:$('imgbb-key').value.trim(),uploadProvider:$('upload-provider').value,
            uploadLitterboxExpiry:$('litterbox-expiry').value
        },()=>{
            save.disabled=false;
            info(chrome.runtime.lastError?.message||'Hosting preferences saved locally.');
        });
    });
    readStatus();
});
