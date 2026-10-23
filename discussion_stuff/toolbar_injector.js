// The official osu! editor owns its formatting toolbar, heading/pin and posting controls.
// Place extension tools in a separate group INSIDE the native message toolbar.
// Always-on, independent entry: never rely on the site's editor hierarchy.
let kmhDockAuthLastChecked = 0;
let kmhDockAuthRequest = false;
let kmhDockAuthRetry = null;
let kmhDockAuthFailures = 0;
function ensureHelperEntry() {
    const isDiscussion = /^\/beatmapsets\/\d+\/discussion(?:\/|$)/.test(location.pathname);
    let entry = document.getElementById('kmh-helper-entry');
    if (!isDiscussion) { if (entry) entry.hidden = true; return; }
    if (!entry) {
        entry = document.createElement('div');
        entry.id = 'kmh-helper-entry';
        entry.innerHTML = '<button type="button" class="kmh-entry-main" aria-label="Open Modding Helper settings" title="Open Modding Helper settings"><i class="fas fa-cog" aria-hidden="true"></i><span>Helper settings</span></button><button type="button" class="kmh-entry-connect" title="Connect osu! to unlock your personal discussions" hidden>Connect osu! <i class="fas fa-arrow-right" aria-hidden="true"></i></button>';
        const opener = entry.querySelector('.kmh-entry-main');
        opener.addEventListener('click', () => toggleModHelperSettings(opener));
        entry.querySelector('.kmh-entry-connect').addEventListener('click', () => {
            toggleModHelperSettings(opener);
            const target = document.querySelector('#mod-helper-settings-modal [data-settings-tab="integrations"]');
            target?.click();
            document.getElementById('mod-helper-osu-connect')?.focus();
        });
        document.body.append(entry);
    }
    // Do not display a disconnected CTA until the initial auth lookup finishes.
    entry.hidden = entry.classList.contains('is-connected') && !!document.querySelector('.beatmap-discussion-new .kmh-editor-actions');
    if (!kmhDockAuthLastChecked || Date.now() - kmhDockAuthLastChecked > 60000) refreshHelperEntryAuth();
}
function refreshHelperEntryAuth(force = false) {
    const entry = document.getElementById('kmh-helper-entry');
    if (!entry || !/^\/beatmapsets\/\d+\/discussion(?:\/|$)/.test(location.pathname)) return;
    if (kmhDockAuthRequest) return;
    if (!force && kmhDockAuthLastChecked && Date.now() - kmhDockAuthLastChecked < 60000) return;
    kmhDockAuthRequest = true;
    try { chrome.runtime.sendMessage({ action: 'getAuthStatus' }, response => {
        kmhDockAuthRequest = false;
        if (!entry.isConnected) return;
        if (chrome.runtime.lastError || response?.error || !response?.data || typeof response.data.connected !== 'boolean') {
            // A service-worker startup interruption is unknown, not 'disconnected'.
            // Do not lock in a false negative by updating the successful-check clock.
            kmhDockAuthFailures++;
            entry.querySelector('.kmh-entry-connect').hidden = true;
            entry.querySelector('.kmh-entry-main').title = 'Modding Helper settings · connection status unavailable';
            clearTimeout(kmhDockAuthRetry);
            kmhDockAuthRetry = setTimeout(() => refreshHelperEntryAuth(true), Math.min(12000, 800 * 2 ** Math.min(kmhDockAuthFailures, 4)));
            return;
        }
        clearTimeout(kmhDockAuthRetry);
        kmhDockAuthFailures = 0;
        kmhDockAuthLastChecked = Date.now();
        const connected = response.data.connected;
        entry.classList.toggle('is-connected', connected);
        entry.hidden = connected && !!document.querySelector('.beatmap-discussion-new .kmh-editor-actions');
        entry.querySelector('.kmh-entry-connect').hidden = connected;
        entry.querySelector('.kmh-entry-main').title = connected ? 'Modding Helper settings · osu! connected' : 'Modding Helper settings · osu! not connected';
    }); } catch {
        kmhDockAuthRequest = false;
        clearTimeout(kmhDockAuthRetry);
        kmhDockAuthRetry = setTimeout(() => refreshHelperEntryAuth(true), 2000);
    }
}
function invalidateHelperAuth() { kmhDockAuthLastChecked = 0; clearTimeout(kmhDockAuthRetry); refreshHelperEntryAuth(true); }
window.addEventListener('mod-helper-osu-auth-changed', invalidateHelperAuth);
window.addEventListener('focus', invalidateHelperAuth);
window.addEventListener('pageshow', invalidateHelperAuth);
document.addEventListener('visibilitychange', () => { if (!document.hidden) invalidateHelperAuth(); });
chrome.storage?.onChanged?.addListener?.((changes, area) => { if (area === 'local' && changes.osuAuthToken) invalidateHelperAuth(); });
// The toolbar represents actual open panels, not merely the last button clicked.
window.KmhSyncQuickToggles = function syncQuickToggles() {
    const rc = document.getElementById('custom-rc-panel');
    const rcOpen = !!rc && rc.isConnected && rc.style.display !== 'none' && !rc.hidden;
    const workspace = document.querySelector('.kmh-workspace-overlay');
    const mineOpen = !!workspace && !workspace.hidden && workspace.isConnected;
    document.querySelectorAll('.kmh-editor-actions').forEach(actions => {
        for (const [selector, active] of [
            ['[data-kmh-open-rc]', rcOpen],
            ['[data-kmh-open-finder]', mineOpen]
        ]) {
            const button = actions.querySelector(selector);
            if (!button) continue;
            button.classList.toggle('is-active', active);
            button.setAttribute('aria-pressed', String(active));
        }
    });
};
// Stable edit-area anchor. Does not change the native New Discussion heading,
// pin button, formatting icons, or submission buttons.
function injectToolbar() {
    document.querySelectorAll('.beatmap-discussion-new').forEach(box => {
        const nativeToolbar = box.querySelector('.beatmap-discussion-new__message .beatmap-discussion-new__toolbar');
        if (!nativeToolbar) return;
        // Remove earlier header controls if the extension is hot-reloaded.
        box.querySelectorAll('.page-title .kmh-discussion-shortcuts').forEach(node => node.remove());
        let actions = nativeToolbar.querySelector(':scope > .kmh-editor-actions');
        if (actions && actions.querySelector('[data-kmh-open-settings]') && actions.querySelector('[data-kmh-open-coach]') && actions.querySelector('[data-kmh-toggle-markdown]')) {
            actions.querySelector('[data-kmh-open-finder]').hidden = !isModHelperFeatureEnabled('modWorkspace');
            actions.querySelector('[data-kmh-open-rc]').hidden = !isModHelperFeatureEnabled('rcBook');
            window.KmhMarkdownOverlay?.reconcile?.();
            // React may replace only the textarea; rebind the existing toolbar
            // toggle without moving any native editor DOM nodes.
            const activeHighlight = actions.querySelector('[data-kmh-toggle-markdown]');
            const activeField = box.querySelector('.beatmap-discussion-new__message textarea');
            if (activeHighlight && activeField) {
                activeHighlight._kmhField = activeField;
                const enabled = !!window.KmhMarkdownOverlay?.isEnabled?.(activeField);
                activeHighlight.setAttribute('aria-pressed', String(enabled));
                activeHighlight.classList.toggle('is-active', enabled);
            }
            window.KmhLinkPreview?.reconcile?.(box);
            actions.hidden = false;
            window.KmhDraftCoach?.reconcile?.(box);
            window.KmhSyncQuickToggles?.();
            return;
        }
        nativeToolbar.querySelectorAll(':scope > .kmh-editor-actions').forEach(node => node.remove());
        actions = document.createElement('div');
        actions.className = 'kmh-editor-actions';
        actions.setAttribute('role','group');
        actions.setAttribute('aria-label','Modding Helper tools');
        const makeButton = (name, icon, handler, marker, label) => {
            const b=document.createElement('button');
            b.type='button';b.className='kmh-editor-tool';
            b.setAttribute('aria-label',name);b.title=name;
            b.setAttribute('data-kmh-open-'+marker,'');
            b.innerHTML='<span class="kmh-tool-icon" aria-hidden="true"><i class="fas '+icon+'"></i></span>';
            if (label) {const l=document.createElement('span');l.textContent=label;l.className='kmh-tool-label';b.append(l);}
            b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();handler(b);});
            return b;
        };
        const finder = makeButton('My discussions','fa-comments',b=>window.KmhWorkspace?.open?.('mine',b),'finder');
        const book = makeButton('Ranking Criteria','fa-book',b=>{window.KmhOpenRC?.(b);window.KmhSyncQuickToggles?.();},'rc');
        const md = makeButton('Highlight Markdown in editor','fa-highlighter',b=>{const textarea=b.closest('.beatmap-discussion-new')?.querySelector('.beatmap-discussion-new__message textarea');if(textarea)window.KmhMarkdownOverlay?.toggle?.(textarea);},'markdown');
        md.setAttribute('data-kmh-toggle-markdown','');md._kmhField=box.querySelector('.beatmap-discussion-new__message textarea');
        const coach = makeButton('Toggle Draft Coach','fa-clipboard-check',b=>window.KmhDraftCoach?.open?.(b),'coach');
        coach.setAttribute('aria-pressed','false');
        const settings = makeButton('Modding Helper Settings','fa-cog',b=>toggleModHelperSettings(b),'settings','Settings');
        settings.classList.add('btn-osu-big','kmh-editor-action-large');
        finder.hidden = !isModHelperFeatureEnabled('modWorkspace');
        book.hidden = !isModHelperFeatureEnabled('rcBook');
        actions.append(finder,book,md,coach,settings);
        nativeToolbar.append(actions);
        window.KmhMarkdownOverlay?.reconcile?.();
        window.KmhLinkPreview?.reconcile?.(box);
        window.KmhDraftCoach?.reconcile?.(box);
        window.KmhSyncQuickToggles?.();
    });
}
function toggleModHelperSettings(opener) {
    // Only one large extension dialog at once, keeping the native post editor untouched.
    window.KmhWorkspace?.close?.();
    const old=document.getElementById('mod-helper-settings-modal');
    if(old){old.remove();return;}
    const sections={
        general:{name:'General',icon:'fa-sliders-h',description:'Control the tools displayed on beatmap discussion pages.',features:[
            ['rcBook','Ranking Criteria shortcut','Keep quick access to the mode-specific Ranking Criteria.'],
            ['discussionDownload','Download shortcut','Show the download action near discussion information.'],
            ['headerMetadata','Metadata & statistics','Show metadata and selected difficulty statistics.']
        ]},
        finder:{name:'My discussions',icon:'fa-comments',description:'Tools for finding, reviewing and following up on modposts.',features:[
            ['modWorkspace','Mod finder','Search your modposts, favourites and mapset discussion history.'],
            ['draftRecovery','Local draft recovery','Save unsent notes; restore them from My discussions.']
        ]},
        integrations:{name:'Integrations',icon:'fa-plug',description:'Connect osu! and configure image and attachment hosting.',features:[
            ['imageUploader','Image paste & drop','Paste or drop an attachment using your selected hosting provider.']
        ]}
    };
    const modal=document.createElement('div');modal.id='mod-helper-settings-modal';modal.className='kmh-overlay kmh-settings-redesign';
    modal.innerHTML=`
      <section class="kmh-modal" role="dialog" aria-modal="true" aria-labelledby="kmh-settings-title">
        <header class="kmh-settings-hero"><div><span class="kmh-eyebrow">KARIN'S / OSU! MODDING HELPER</span><h2 id="kmh-settings-title">Settings</h2><p>Tools for your modding workflow, styled to fit osu!web.</p></div>
        <button class="kmh-settings-close" type="button" aria-label="Close settings">×</button></header>
        <div class="kmh-settings-layout"><nav class="kmh-settings-nav" aria-label="Settings categories">
          ${Object.entries(sections).map(([id,s])=>`<button type="button" class="kmh-settings-tab" data-settings-tab="${id}"><i class="fas ${s.icon}"></i>${s.name}</button>`).join('')}
          <button type="button" id="kmh-replay-tour" class="kmh-replay-tour">▶ Replay introduction</button><div class="kmh-settings-nav-note">Draft Coach is available directly inside the New Discussion editor. <strong>Connect osu!</strong> under Integrations to unlock personal discussion tracking.</div>
        </nav><div class="kmh-settings-content">
          ${Object.entries(sections).map(([id,s])=>`<section data-settings-section="${id}" class="kmh-settings-section"><div class="kmh-settings-section-heading"><span class="kmh-eyebrow">PREFERENCES</span><h3>${s.name}</h3><p>${s.description}</p></div>
          <div class="kmh-feature-list">${s.features.map(([key,title,description])=>`<label class="kmh-feature-row"><div class="kmh-feature-copy"><strong>${title}</strong><small>${description}</small></div><input type="checkbox" data-feature="${key}" ${isModHelperFeatureEnabled(key)?'checked':''}><span class="kmh-switch" aria-hidden="true"></span></label>`).join('')}</div>
          ${id==='integrations'?`<div class="kmh-settings-integration kmh-auth-settings"><h4><i class="fas fa-user-check"></i> Your osu! account</h4><p>Connect to unlock My discussions and thread activity. Local drafts and Ranking Criteria work without signing in.</p><p class="kmh-trust-note">OAuth token exchange uses the existing third-party Cloudflare Worker configured in this extension, not an osu!-operated endpoint. Connect only if you trust its operator.</p><div class="kmh-integration-controls"><button type="button" id="mod-helper-osu-connect" class="kmh-primary-button">Connect osu! account</button><span id="mod-helper-osu-status" role="status">Checking connection…</span></div></div>
          <div class="kmh-settings-integration kmh-host-settings"><h4><i class="fas fa-cloud-upload-alt"></i> Hosting provider</h4>
          <p>Choose where screenshots and files are published. Smart selects an eligible persistent host before the upload; it never republishes to another host after a failed or uncertain request.</p>
          <label for="modal-upload-provider">Upload service</label>
          <select id="modal-upload-provider" class="kmh-host-select">
            <option value="smart">Smart — prefer your configured s-ul.eu, otherwise Catbox</option>
            <option value="sul">s-ul.eu — personal API key</option>
            <option value="catbox">Catbox — optional account userhash</option>
            <option value="imgbb">ImgBB — image-only API key</option>
            <option value="litterbox">Litterbox — temporary files, explicit choice only</option>
          </select>
          <div class="kmh-host-credentials">
            <label for="modal-sul-key">s-ul.eu API key</label><input type="password" id="modal-sul-key" autocomplete="off" placeholder="Existing s-ul.eu upload key">
            <label for="modal-catbox-key">Catbox userhash (optional)</label><input type="password" id="modal-catbox-key" autocomplete="off" placeholder="Leave empty for anonymous Catbox">
            <label for="modal-imgbb-key">ImgBB API key (optional)</label><input type="password" id="modal-imgbb-key" autocomplete="off" placeholder="Required when ImgBB is selected">
            <label for="modal-litterbox-expiry">Litterbox expiry</label><select id="modal-litterbox-expiry" class="kmh-host-select"><option value="1h">1 hour</option><option value="12h">12 hours</option><option value="24h">24 hours</option><option value="72h">72 hours</option></select>
          </div>
          <small class="kmh-host-note">Uploads are public. Catbox may be anonymous, meaning you cannot manage those files later. ImgBB requires an API key. Host storage quota is not exposed by these APIs; the extension cannot reliably know how much space remains. Files over 48 MB exceed this build's upload transport limit. Temporary Litterbox links are unsuitable for permanent modding evidence.</small>
          <details class="kmh-tutorial"><summary><i class="fas fa-question-circle"></i> Provider setup and supported Markdown</summary><ol>
            <li><a href="https://catbox.moe/tools.php" target="_blank" rel="noopener noreferrer">Catbox</a> works anonymously, or with your account userhash.</li>
            <li><a href="https://api.imgbb.com/" target="_blank" rel="noopener noreferrer">ImgBB</a> requires a key and only accepts images.</li>
            <li><a href="https://s-ul.eu/" target="_blank" rel="noopener noreferrer">s-ul.eu</a> uses your existing personal API key.</li>
            <li>Paste or drag files into a discussion editor. GIF, PNG, JPEG, WebP and other browser-renderable images use <code>![name](direct-url)</code>. Other supported files use normal links.</li>
          </ol></details></div>`:''}</section>`).join('')}
        </div></div><footer class="kmh-settings-footer"><a href="https://osu.ppy.sh/users/28330584" target="_blank" rel="noopener noreferrer">Made by Karin- ↗</a><div><span id="modal-settings-status" role="status"></span><button type="button" class="kmh-outline-button kmh-settings-cancel">Cancel</button><button type="button" id="modal-settings-save" class="kmh-primary-button">Save changes</button></div></footer>
      </section>`;
    document.body.append(modal);
    const replay = modal.querySelector('#kmh-replay-tour');
    if(replay) replay.addEventListener('click',()=>{modal.querySelector('.kmh-settings-close').click();window.KmhTour?.start?.();});
    const close=()=>{document.removeEventListener('keydown',handleKey);modal.remove();opener?.focus?.();};
    modal.querySelector('.kmh-settings-close').onclick=close;
    modal.querySelector('.kmh-settings-cancel').onclick=close;
    modal.addEventListener('click',event=>{if(event.target===modal)close();});
    const handleKey=event=>{
       if(event.key==='Escape'){event.preventDefault();close();return;}
       if(event.key==='Tab'){
         const focusable=[...modal.querySelectorAll('button,input,a[href]')].filter(element=>!element.disabled && !element.closest('[hidden]'));
         if(!focusable.length)return;
         const first=focusable[0],last=focusable.at(-1);
         if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
         else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
       }
    };
    document.addEventListener('keydown',handleKey);
    const setSection=id=>{
        modal.querySelectorAll('[data-settings-tab]').forEach(button=>{
           const active=button.dataset.settingsTab===id;
           button.classList.toggle('is-active',active);button.setAttribute('aria-current',active?'page':'false');
        });
        modal.querySelectorAll('[data-settings-section]').forEach(section=>section.hidden=section.dataset.settingsSection!==id);
    };
    modal.querySelectorAll('[data-settings-tab]').forEach(button=>button.onclick=()=>setSection(button.dataset.settingsTab));
    setSection('general');
    setupOsuAuthListeners(modal.querySelector('#mod-helper-osu-connect'), modal);
    chrome.storage.local.get(['sulApiKey','catboxUserhash','imgbbApiKey','uploadProvider','uploadLitterboxExpiry'],values=>{
        const pair={'modal-sul-key':'sulApiKey','modal-catbox-key':'catboxUserhash','modal-imgbb-key':'imgbbApiKey'};
        Object.entries(pair).forEach(([id,key])=>{const el=modal.querySelector('#'+id);if(el)el.value=values[key]||'';});
        modal.querySelector('#modal-upload-provider').value=values.uploadProvider||'smart';
        modal.querySelector('#modal-litterbox-expiry').value=values.uploadLitterboxExpiry||'24h';
    });
    modal.querySelector('#modal-settings-save').onclick=()=>{
        const save=modal.querySelector('#modal-settings-save');save.disabled=true;
        const values={
            sulApiKey:modal.querySelector('#modal-sul-key').value.trim(),
            catboxUserhash:modal.querySelector('#modal-catbox-key').value.trim(),
            imgbbApiKey:modal.querySelector('#modal-imgbb-key').value.trim(),
            uploadProvider:modal.querySelector('#modal-upload-provider').value,
            uploadLitterboxExpiry:modal.querySelector('#modal-litterbox-expiry').value
        };
        modal.querySelectorAll('[data-feature]').forEach(input=>values[input.dataset.feature]=input.checked);
        chrome.storage.local.set(values,()=>{
            save.disabled=false;
            const status=modal.querySelector('#modal-settings-status');
            if(chrome.runtime.lastError){status.textContent=chrome.runtime.lastError.message;return;}
            status.textContent='Changes saved';
            window.dispatchEvent(new CustomEvent('mod-helper-settings-changed'));
            setTimeout(()=>{if(modal.isConnected)close();},550);
        });
    };
    modal.querySelector('.kmh-settings-close').focus();
}

window.KmhOpenSettings = toggleModHelperSettings;
// A fallback path from the extension action popup when the native page rerenders.
chrome.runtime.onMessage.addListener((request, _sender, respond) => {
    if(!['openPageSettings','openPageWorkspace','openPageCoach','openPageTour'].includes(request?.action)) return false;
    if(!/^\/beatmapsets\/\d+\/discussion(?:\/|$)/.test(location.pathname)) {
        respond({error:'Open an osu! beatmap discussion page first.'});return false;
    }
    if(request.action==='openPageWorkspace'){ window.KmhWorkspace?.open?.('mine'); respond({success:true}); return false; }
    if(request.action==='openPageCoach'){ window.KmhDraftCoach?.open?.(); respond({success:true}); return false; }
    if(request.action==='openPageTour'){window.KmhTour?.start?.();respond({success:true});return false;}
    toggleModHelperSettings();respond({success:true});return false;
});
