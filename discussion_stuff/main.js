// Reconcile after navigation/render changes, without rebuilding controls every 250 ms.
let kmhInjectionTimer;
let kmhCurrentSet;
let kmhLastPath = location.pathname;
const kmhUISelector = '.kmh-editor-actions, .kmh-inline-coach, .kmh-linked-preview, .kmh-attachments-inline, .custom-metadata-block, #custom-beatmap-advanced-stats, #custom-rc-panel, .kmh-markdown-preview, .kmh-mod-workspace, .kmh-workspace-launcher, .kmh-related, .kmh-draft-bar';
let kmhOutsideDiscussion = false;
function runInjections() {
    if (document.hidden) return;
    const discussion = /^\/beatmapsets\/\d+\/discussion(?:\/|$)/.test(location.pathname);
    if (!discussion) {
        window.KmhTour?.stop?.(false);
        // Body-mounted popovers must not survive leaving the discussion view.
        window.KmhLinkPreview?.disposeAll?.();
        window.KmhDraftCoach?.disposeAll?.();
        ensureHelperEntry();
        window.KmhWorkspace?.scan(); 
        if (!kmhOutsideDiscussion) window.KmhWorkspace?.flushDrafts();
        kmhOutsideDiscussion = true;
        document.querySelectorAll(kmhUISelector).forEach(node => node.hidden = true);
        document.getElementById('mod-helper-settings-modal')?.remove();
        return;
    }
    if (kmhOutsideDiscussion) document.querySelectorAll(kmhUISelector).forEach(node => node.hidden = false);
    kmhOutsideDiscussion = false;
    try {
        ensureHelperEntry();
        const set = location.pathname.match(/\/beatmapsets\/(\d+)/)?.[1];
        if (kmhCurrentSet && kmhCurrentSet !== set) { document.querySelector('.custom-metadata-block')?.remove(); document.getElementById('custom-beatmap-advanced-stats')?.remove(); window.customMapCache = null; }
        kmhCurrentSet = set;
        if (isModHelperFeatureEnabled('headerMetadata')) { if (!document.querySelector('.custom-metadata-block')) injectMetadataBox(); updateSelectedBeatmapStats(); }
        else { document.querySelector('.custom-metadata-block')?.remove(); document.getElementById('custom-beatmap-advanced-stats')?.remove(); }
        if (isModHelperFeatureEnabled('discussionDownload')) upgradeDownloadButton();
        else document.querySelector('.custom-download-btn')?.closest('.beatmap-discussions-header-bottom__details')?.remove();
        injectToolbar();
        window.KmhLinkPreview?.reconcileReplies?.();
        window.KmhReviewTools?.reconcile?.();
        window.KmhReviewFormat?.reconcile?.();
        window.KmhMarkdownOverlay?.reconcile?.();
        window.KmhTour?.maybeStart?.();
        ensureHelperEntry();
        if (isModHelperFeatureEnabled('rcBook')) toggled_RC_book();
        else { document.querySelectorAll('.rc-lens-btn').forEach(node => node.remove()); document.getElementById('custom-rc-panel')?.remove(); }
         window.KmhWorkspace?.scan();
         window.KmhSyncQuickToggles?.();
    } catch (error) { console.error('Modding Helper:', error); }
}
function scheduleInjections() {
    // A continuous stream of React mutations must not postpone recovery forever.
    if (kmhInjectionTimer != null) return;
    kmhInjectionTimer = setTimeout(() => { kmhInjectionTimer = null; runInjections(); }, 100);
}
function resumeInjections() {
    if (document.hidden) return;
    clearTimeout(kmhInjectionTimer); kmhInjectionTimer = null;
    runInjections();
}
new MutationObserver(records => {
    if (records.some(record => !record.target.closest?.('.kmh-editor-actions, .kmh-inline-coach, .custom-metadata-block, #custom-beatmap-advanced-stats, #custom-rc-panel, .kmh-markdown-preview, .kmh-mod-workspace, .kmh-workspace-launcher, .kmh-related, .kmh-draft-bar, .kmh-image-popup, .kmh-inline-mirror, .kmh-md-portal, #mod-helper-settings-modal, .kmh-tour-shade, .kmh-tour-outline, .kmh-tour-bubble, .kmh-linked-preview, .kmh-attachments-inline, .kmh-attachment-gallery-backdrop, .kmh-preview-lightbox, .kmh-reply-tools, #kmh-upload-status-toast'))) scheduleInjections();
}).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'data-id'] });
window.addEventListener('popstate', scheduleInjections);
window.addEventListener('mod-helper-settings-changed', scheduleInjections);
window.addEventListener('mod-helper-osu-auth-changed', () => { document.querySelector('.custom-metadata-block')?.remove(); scheduleInjections(); });
window.addEventListener('focus', resumeInjections);
window.addEventListener('pageshow', resumeInjections);
document.addEventListener('visibilitychange', resumeInjections);
window.navigation?.addEventListener('currententrychange', scheduleInjections);
// History-only navigation may not produce mutations or popstate. This checks
// just the path; full UI recovery remains event driven, with a slow fallback.
setInterval(() => {
    if (document.hidden) return;
    if (kmhLastPath !== location.pathname) { kmhLastPath = location.pathname; scheduleInjections(); }
}, 1000);
setInterval(() => { if (!document.hidden) runInjections(); }, 15000);
runInjections();

