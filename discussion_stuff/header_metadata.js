// header_metadata.js - Native Layered Box Model (Powered by osu! API v2)

async function injectMetadataBox() {
    if (document.querySelector('.custom-metadata-block')) {
        if (window.customMapCache) {
            updateSelectedBeatmapStats();
        }
        return;
    }

    const mapDataNode = document.getElementById('json-beatmapset');
    if (!mapDataNode) return;
    const mapData = JSON.parse(mapDataNode.textContent);

    const filterToolbar = document.querySelector('.beatmapset-discussions-toolbar');
    if (!filterToolbar) return;

    const setId = mapData.id;
    const source = mapData.source || 'None';
    const tags = mapData.tags || 'None';

    const metaBlock = document.createElement('div');
    metaBlock.className = 'custom-metadata-block';
    


    const spinner = '<i class="fas fa-spinner fa-spin"></i>';
    const copyButton = (id, cls, label) => `<button type="button" class="custom-tags-code kmh-copy-value ${cls}" id="${id}" title="${label}" aria-label="${label}" data-kmh-copy-state=""><span class="kmh-copy-value-text">${spinner}</span></button>`;
    metaBlock.innerHTML = `
        <div class="kmh-metadata-layout">
            <div class="kmh-metadata-details">
                <div class="custom-metadata-line"><strong>Source:</strong> ${copyButton('custom-source-loader','kmh-source-value','Copy source')}</div>
                <div class="custom-metadata-line"><strong>Genre:</strong> <button type="button" class="kmh-copy-value kmh-copy-pair" id="kmh-copy-genre-language" title="Copy genre and language" aria-label="Copy genre and language"><span class="custom-tags-code kmh-genre-value" id="custom-genre-loader">${spinner}</span><span class="custom-metadata-separator" aria-hidden="true">/</span><span class="custom-tags-code kmh-genre-value" id="custom-language-loader">${spinner}</span></button></div>
                <span class="kmh-meta-status" role="status" aria-live="polite"></span>
                <span class="kmh-meta-copy-feedback" role="status" aria-live="polite"></span>
            </div>
            <div class="kmh-metadata-tags">
                <div class="kmh-tags-content">
                    <div class="kmh-tags-line"><strong>Tags:</strong> ${copyButton('custom-tags-loader','kmh-tags-value','Copy tags')}</div>
                </div>
            </div>
        </div>`;
    filterToolbar.parentNode.insertBefore(metaBlock, filterToolbar);

    const feedback = metaBlock.querySelector('.kmh-meta-copy-feedback');
    async function copyMeta(text, trigger, name) {
        if (!text) return;
        try {
            await navigator.clipboard.writeText(text);
            if (feedback) feedback.textContent = `${name} copied`;
            trigger.dataset.kmhCopyState = 'copied';
            setTimeout(() => { if (trigger.isConnected) { trigger.dataset.kmhCopyState = ''; if (feedback) feedback.textContent = ''; } }, 1250);
        } catch {
            if (feedback) feedback.textContent = 'Clipboard unavailable. Select and copy the text.';
            window.prompt?.(`Copy ${name.toLowerCase()} (Ctrl+C)`, text);
        }
    }
    function nativeMeta(name) {
        const entry = [...document.querySelectorAll('.beatmapset-info__half-entry')]
            .find(element => element.querySelector('.beatmapset-info__header')?.textContent?.trim().toLowerCase() === name.toLowerCase());
        return entry?.querySelector('.beatmapset-info__link')?.textContent?.trim() || '';
    }
    function unlockMetadataUI(genre, lang) {
        const sourceSpan = metaBlock.querySelector('#custom-source-loader .kmh-copy-value-text');
        const tagsSpan = metaBlock.querySelector('#custom-tags-loader .kmh-copy-value-text');
        const genreSpan = metaBlock.querySelector('#custom-genre-loader');
        const languageSpan = metaBlock.querySelector('#custom-language-loader');
        const genreValue = genre && genre !== '—' ? genre : nativeMeta('Genre') || 'Unavailable';
        const languageValue = lang && lang !== '—' ? lang : nativeMeta('Language') || 'Unavailable';
        if (sourceSpan) sourceSpan.textContent = source;
        if (tagsSpan) tagsSpan.textContent = tags;
        if (genreSpan) genreSpan.textContent = genreValue;
        if (languageSpan) languageSpan.textContent = languageValue;
        // Each metadata code surface is its own copy target; none requires OAuth.
        const sourceButton = metaBlock.querySelector('#custom-source-loader');
        const tagsButton = metaBlock.querySelector('#custom-tags-loader');
        const pairButton = metaBlock.querySelector('#kmh-copy-genre-language');
        if (sourceButton) sourceButton.onclick = () => copyMeta(source, sourceButton, 'Source');
        if (tagsButton) tagsButton.onclick = () => copyMeta(tags, tagsButton, 'Tags');
        if (pairButton) pairButton.onclick = () => copyMeta(`Genre: ${genreValue}\nLanguage: ${languageValue}`, pairButton, 'Genre and language');
        updateSelectedBeatmapStats();
    }

    // --- API V2 FETCH ---
    const genreFromPage = mapData.genre?.name || nativeMeta('Genre');
    const langFromPage = mapData.language?.name || nativeMeta('Language');
    const statusEl = metaBlock.querySelector('.kmh-meta-status');
    function clearStatus() {
        if (!statusEl) return;
        statusEl.classList.remove('kmh-meta-status--action', 'kmh-meta-status--loading');
        statusEl.replaceChildren();
    }
    function showAction(message, label, handler, retry = false) {
        if (!statusEl) return;
        clearStatus();
        statusEl.classList.add('kmh-meta-status--action');
        const copy = document.createElement('span');
        copy.className = 'kmh-meta-status-copy';
        const title = document.createElement('strong');
        title.className = 'kmh-meta-status-title';
        title.textContent = retry ? 'Metadata could not be loaded' : 'Genre and language unavailable';
        const text = document.createElement('span');
        text.className = 'kmh-meta-status-message';
        text.textContent = message;
        copy.append(title, text);
        const btn = document.createElement('button');btn.type='button';
        btn.className = `btn-osu-big kmh-metadata-auth-action ${retry ? 'kmh-metadata-retry' : 'kmh-metadata-connect'}`;
        btn.innerHTML = '<span class="btn-osu-big__content"><span class="btn-osu-big__icon-inline btn-osu-big__icon-inline--left"><i class="fas fa-sync-alt" aria-hidden="true"></i></span><span class="kmh-metadata-action-label"></span></span>';
        btn.querySelector('.kmh-metadata-action-label').textContent = label;
        btn.querySelector('.btn-osu-big__icon-inline i').className = retry ? 'fas fa-redo' : 'fas fa-external-link-alt';
        btn.addEventListener('click',handler);
        statusEl.append(copy, btn);
    }
    function connectAccount() {
        const opener = metaBlock.querySelector('.kmh-metadata-connect');
        if (!opener || opener.disabled) return;
        const icon = opener.querySelector('.btn-osu-big__icon-inline i');
        const text = opener.querySelector('.kmh-metadata-action-label');
        opener.disabled = true;
        opener.classList.add('kmh-is-loading');
        opener.setAttribute('aria-busy', 'true');
        icon.className = 'fas fa-spinner fa-spin';
        text.textContent = 'Opening settings…';
        // This button intentionally opens the documented OAuth settings first:
        // the third-party token exchange disclosure must remain visible before consent.
        try {
            if (typeof toggleModHelperSettings !== 'function') throw new Error('Settings unavailable');
            if (!document.getElementById('mod-helper-settings-modal')) toggleModHelperSettings(opener);
            const tab = document.querySelector('#mod-helper-settings-modal [data-settings-tab="integrations"]');
            if (!tab) throw new Error('Account settings unavailable');
            tab.click();
            document.getElementById('mod-helper-osu-connect')?.focus();
            // Reset after the settings panel has been displayed, not on a guessed timer.
            requestAnimationFrame(() => {
                if (!opener.isConnected) return;
                opener.disabled = false;
                opener.classList.remove('kmh-is-loading');
                opener.removeAttribute('aria-busy');
                icon.className = 'fas fa-external-link-alt';
                text.textContent = 'Connect osu! ↗';
            });
        } catch (error) {
            opener.disabled = false;
            opener.classList.remove('kmh-is-loading');
            opener.removeAttribute('aria-busy');
            icon.className = 'fas fa-exclamation-circle';
            text.textContent = 'Settings unavailable';
            if (statusEl) statusEl.title = String(error?.message || error);
        }
    }
    const fallbackReady = !!genreFromPage && !!langFromPage;
    unlockMetadataUI(genreFromPage || '—', langFromPage || '—', fallbackReady);
    if (window.customMapCache?.id === setId) {
        unlockMetadataUI(window.customMapCache.genre, window.customMapCache.language);
        return;
    }
    function loadMetadata() {
        if (!metaBlock.isConnected) return;
        clearStatus();
        if (!fallbackReady && statusEl) {
            statusEl.classList.add('kmh-meta-status--loading');
            statusEl.innerHTML = '<i class="fas fa-spinner fa-spin" aria-hidden="true"></i><span>Loading genre and language…</span>';
        }
        try { chrome.runtime.sendMessage({ action: 'fetchBeatmap', setId }, response => {
            if (!metaBlock.isConnected) return;
            const error = chrome.runtime.lastError?.message || response?.error;
            if (!error && response?.data) {
                const genre = response.data.genre?.name || genreFromPage || 'Unknown';
                const language = response.data.language?.name || langFromPage || 'Unknown';
                window.customMapCache = { id: setId, genre, language };
                unlockMetadataUI(genre, language, true);
                clearStatus();
                return;
            }
            if (fallbackReady) { clearStatus(); return; }
            chrome.runtime.sendMessage({ action: 'getAuthStatus' }, authResponse => {
                if (!metaBlock.isConnected) return;
                const connected = !!authResponse?.data?.connected;
                if (!connected) showAction('Connect your osu! account to load these fields.', 'Connect osu!', connectAccount);
                else showAction('osu! API could not return these fields.', 'Retry', loadMetadata, true);
            });
        }); } catch {
            if (!fallbackReady) showAction('The API request could not start.', 'Retry', loadMetadata, true);
        }
    }
    loadMetadata();
}

function showAuthWarningToast() {
    if (document.getElementById('kmh-auth-toast')) return;

    const toast = document.createElement('div');
    toast.id = 'kmh-auth-toast';
    toast.style.cssText = `
        position: fixed;
        bottom: 25px;
        right: 25px;
        background: #1c242e;
        border-left: 4px solid hsl(200, 80%, 55%);
        color: #fff;
        padding: 16px 20px;
        border-radius: 6px;
        box-shadow: 0 8px 25px rgba(0,0,0,0.5);
        z-index: 10000;
        font-family: Torus, Inter, sans-serif;
        font-size: 14px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        opacity: 0;
        transform: translateY(10px);
        transition: all 0.3s ease;
    `;
    
    toast.innerHTML = `
        <div style="font-weight: bold; color: hsl(200, 80%, 65%);">
            <i class="fas fa-exclamation-circle" style="margin-right: 5px;"></i> Modding Helper
        </div>
        <div style="color: #a39eb5; font-size: 13px;">
            To view full beatmap metadata, please click the <strong>Gear icon</strong> <i class="fas fa-cog"></i> below the discussion box and <strong>Connect your osu! Account</strong>.
        </div>
    `;
    
    document.body.appendChild(toast);

    requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0)';
    });

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        setTimeout(() => toast.remove(), 300);
    }, 7000);
}

function updateSelectedBeatmapStats() {
    const mapDataNode = document.getElementById('json-beatmapset');
    const statsContainer = document.querySelector('.beatmap-discussions-header-top__basic-stats');
    if (!mapDataNode || !statsContainer) return;

    const mapData = JSON.parse(mapDataNode.textContent);
    const urlParts = window.location.pathname.split('/');
    const discussionIndex = urlParts.indexOf('discussion');
    const urlBeatmapId = discussionIndex !== -1 ? Number(urlParts[discussionIndex + 1]) : NaN;
    const selectedBeatmap = document.querySelector('.beatmap-list__item--current[data-id]');
    const selectedBeatmapId = selectedBeatmap ? Number(selectedBeatmap.dataset.id) : NaN;
    const activeModeLink = document.querySelector('.game-mode-link--active[data-mode]');
    const activeMode = activeModeLink ? activeModeLink.dataset.mode : null;

    let targetMap = Number.isInteger(urlBeatmapId)
        ? mapData.beatmaps?.find(beatmap => beatmap.id === urlBeatmapId)
        : null;
    if (!targetMap && Number.isInteger(selectedBeatmapId)) {
        targetMap = mapData.beatmaps?.find(beatmap => beatmap.id === selectedBeatmapId);
    }
    if (!targetMap && activeMode) {
        targetMap = mapData.beatmaps?.find(beatmap => beatmap.mode === activeMode);
    }
    if (!targetMap) targetMap = mapData.beatmaps?.[0];
    if (!targetMap) return;

    const statsRowId = 'custom-beatmap-advanced-stats';
    let statsRow = document.getElementById(statsRowId);
    if (!statsRow) {
        statsRow = document.createElement('div');
        statsRow.id = statsRowId;
        statsRow.className = 'beatmapset-stats__row beatmapset-stats__row--advanced custom-discussion-stats';
        statsContainer.appendChild(statsRow);
    }

    const hpDrain = Number(targetMap.drain);
    const od = Number(targetMap.accuracy);
    const display = value => Number.isFinite(value) ? value.toFixed(2).replace(/\.00$/, '') : '—';
    const strip = document.createElement('div');
    strip.className = 'kmh-difficulty-stats-strip';
    strip.setAttribute('aria-label', 'Selected difficulty HP Drain and Overall Difficulty');
    const addStat = (key, label, value) => {
        const pill = document.createElement('div');
        pill.className = 'kmh-difficulty-stat kmh-difficulty-stat--' + key;
        pill.title = label + ': ' + display(value) + ' (selected difficulty)';
        const short = document.createElement('span'); short.className='kmh-difficulty-stat-label'; short.textContent=key.toUpperCase();
        const number = document.createElement('strong'); number.className='kmh-difficulty-stat-value'; number.textContent=display(value);
        const bar = document.createElement('span'); bar.className='kmh-difficulty-stat-track';
        const fill = document.createElement('span'); fill.className='kmh-difficulty-stat-fill';
        fill.style.width=Number.isFinite(value) ? Math.max(0,Math.min(100,value / 10 * 100))+'%' : '0%';
        bar.append(fill);pill.append(short,number,bar);strip.append(pill);
    };
    addStat('hp','HP Drain',hpDrain);
    addStat('od','Overall Difficulty',od);
    const mode=String(targetMap.mode||'osu');
    const cs=Number(targetMap.cs??targetMap.circle_size);
    const ar=Number(targetMap.ar??targetMap.approach_rate);
    if(mode!=='mania'){
        if(Number.isFinite(cs))addStat('cs','Circle Size',cs);
        if(Number.isFinite(ar))addStat('ar','Approach Rate',ar);
    }
    // Avoid re-rendering when a MutationObserver or page navigation rechecks the same map.
    const fingerprint = `${targetMap.id}:${display(hpDrain)}:${display(od)}:${mode}:${display(cs)}:${display(ar)}`;
    if (statsRow.dataset.kmhFingerprint !== fingerprint) {
        statsRow.dataset.kmhFingerprint = fingerprint;
        statsRow.replaceChildren(strip);
    }

}