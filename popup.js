// Compact, actionable entry point. OAuth is never initiated without a click.
document.addEventListener('DOMContentLoaded', () => {
    const $=id=>document.getElementById(id);
    const note=$('popup-note'), key=$('sul-key'), save=$('save-btn');
    const auth=$('auth-action'), status=$('connection-status'), explanation=$('connection-description');
    let connected=false;
    const info=text=>{note.textContent=text;};
    function readStatus() {
        status.textContent='Checking osu! connection…';
        chrome.runtime.sendMessage({action:'getAuthStatus'}, response=>{
            if(chrome.runtime.lastError || response?.error){status.textContent='Connection unavailable'; info(chrome.runtime.lastError?.message||response?.error||'Reload extension and retry.');return;}
            connected=!!response?.data?.connected;
            document.body.dataset.connected=String(connected);
            status.textContent=connected?'osu! account connected':'osu! account not connected';
            explanation.textContent=connected?'Your personal discussions, follow-ups and favourites are available.':'Connect to see your own modposts, detect new thread activity and manage mapset follow-ups. Ranking Criteria and drafts work without a connection.';
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
    $('open-draft-coach')?.addEventListener('click',()=>open('openPageCoach'));
    $('replay-onboarding')?.addEventListener('click',()=>open('openPageTour'));
    chrome.storage.local.get(['sulApiKey'],record=>{key.value=record.sulApiKey||'';});
    save.addEventListener('click',()=>{
        save.disabled=true;
        chrome.storage.local.set({sulApiKey:key.value.trim()},()=>{
            save.disabled=false;
            info(chrome.runtime.lastError?.message||'s-ul.eu key saved locally.');
        });
    });
    readStatus();
});
