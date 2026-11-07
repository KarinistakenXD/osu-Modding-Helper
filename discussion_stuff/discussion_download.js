// discussion_download.js - Native download and osu!direct shortcuts.
// This feature runs only on the beatmap discussion route. All inserted nodes
// are outside of React-managed button contents, and carry the beatmapset ID.
function upgradeDownloadButton() {
    const currentId = Number(location.pathname.match(/^\/beatmapsets\/(\d+)\/discussion(?:\/|$)/)?.[1]);
    if (!Number.isSafeInteger(currentId) || currentId <= 0) return;

    const links = [...document.querySelectorAll('a.btn-osu-big')];
    let downloadBtn = links.find(a => {
        try {const u = new URL(a.href, location.origin);
             return u.origin === location.origin && u.pathname === `/beatmapsets/${currentId}/download`;
        } catch {return false;}
    });
    if (!downloadBtn) {
        const dataNode = document.getElementById('json-beatmapset');
        let setData;
        try {setData = JSON.parse(dataNode?.textContent || 'null');} catch {return;}
        if (Number(setData?.id) !== currentId) return;
        const detailsContainer = links.find(link => {
            try {return new URL(link.href, location.origin).pathname === `/beatmapsets/${currentId}`;} catch {return false;}
        })?.closest('.beatmap-discussions-header-bottom__details');
        if (!detailsContainer) return;
        const downloadContainer = document.createElement('div');
        downloadContainer.className = 'beatmap-discussions-header-bottom__details kmh-download-container';
        downloadContainer.dataset.kmhSetId = String(currentId);
        downloadContainer.innerHTML = `<a class="btn-osu-big btn-osu-big--full custom-download-btn" href="/beatmapsets/${currentId}/download"><span class="btn-osu-big__content"><span class="btn-osu-big__left"><span class="btn-osu-big__text-top">Download</span></span><span class="btn-osu-big__icon"><span class="fa fa-fw"><span class="fas fa-download"></span></span></span></span></a>`;
        detailsContainer.after(downloadContainer);
        downloadBtn = downloadContainer.querySelector('.custom-download-btn');
    }
    if (!downloadBtn) return;
    downloadBtn.dataset.smartDl = 'true';
    const text = downloadBtn.querySelector('.btn-osu-big__text-top');
    if (text) text.textContent = 'Download';

    // Reconcile one osu!direct link per beatmapset, in the same native
    // action row as Download and the advanced-options (+) trigger.
    // Keep the native download anchor in place: only manage our own control.
    document.querySelectorAll('.kmh-osu-direct-row').forEach(node => node.remove());
    document.querySelectorAll('.kmh-osu-direct-btn').forEach(node => {
        if(node.dataset.kmhSetId !== String(currentId)) node.remove();
    });
    const container = downloadBtn.parentElement;
    if (!container) return;
    const selector = `.kmh-osu-direct-btn[data-kmh-set-id="${currentId}"]`;
    let direct = container.querySelector(selector);
    if (!direct) {
        direct = document.createElement('a');
        direct.className = 'btn-osu-big kmh-osu-direct-btn';
        direct.href = `osu://dl/${currentId}`;
        direct.dataset.kmhSetId = String(currentId);
        direct.dataset.turbo = 'false';
        direct.dataset.turbolinks = 'false';
        direct.title = 'Open with osu!direct (osu!supporter may be required)';
        direct.setAttribute('aria-label', 'Download using osu!direct');
        direct.innerHTML = '<span class="btn-osu-big__content"><span class="btn-osu-big__left"><span class="btn-osu-big__text-top">osu!direct</span></span><span class="btn-osu-big__icon"><span class="fa fa-fw"><span class="fas fa-bolt" aria-hidden="true"></span></span></span></span>';
    }
    // Even if React replaces native controls, re-establish the order:
    // Download | osu!direct | +. The + trigger will be inserted last by
    // Kmh111Download when it has not yet been constructed.
    if (downloadBtn.nextElementSibling !== direct) downloadBtn.after(direct);
    container.classList.add('kmh111-download-action-row', 'kmh-direct-action-group');
}
