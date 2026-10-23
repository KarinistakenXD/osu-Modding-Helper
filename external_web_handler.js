// external_web_handler.js - The Background Service Worker

// Chromium runs this file as an MV3 service worker and needs importScripts().
// Firefox / Zen runs the manifest's background.scripts in order in a
// background event page, where importScripts() is not available.
if (typeof importScripts === 'function') {
    try {
        importScripts('osu_auth_manager.js', 'osu_api_client.js', 'upload_limits.js', 'upload_providers.js');
    } catch (e) {
        console.error('Modding Helper: Failed to import background scripts', e);
    }
} else if (!self.OsuAuthManager || !self.OsuApiClient) {
    console.error('Modding Helper: Firefox background dependencies were not loaded');
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    
    // 1. Auth Flow Actions
    if (request.action === 'startAuthFlow') {
        self.OsuAuthManager.startAuthFlow()
            .then(async () => { self.OsuApiClient.clearCache(); sendResponse({ data: await self.OsuAuthManager.getAuthStatus() }); })
            .catch(err => sendResponse({ error: err.message }));
        return true; 
    }

    if (request.action === 'disconnectAuth') {
        self.OsuAuthManager.disconnect()
            .then(() => { self.OsuApiClient.clearCache(); sendResponse({ data: { connected: false }, success: true }); })
            .catch(err => sendResponse({ error: err.message }));
        return true;
    }

    if (request.action === 'getAuthStatus') {
        self.OsuAuthManager.getAuthStatus()
            .then(data => sendResponse({ data }))
            .catch(err => sendResponse({ error: err.message }));
        return true;
    }

    // 2. osu! API Actions
    if (request.action === 'fetchProfile') {
        self.OsuApiClient.fetchCurrentProfile()
            .then(data => sendResponse({ data }))
            .catch(err => sendResponse({ error: err.message }));
        return true;
    }

    if (request.action === 'fetchBeatmap') {
        self.OsuApiClient.fetchBeatmapset(request.setId)
            .then(data => sendResponse({ data }))
            .catch(err => sendResponse({ error: err.message }));
        return true;
    }

    const readers = {
        fetchDiscussions: () => self.OsuApiClient.fetchDiscussions(request.filters),
        fetchDiscussionPosts: () => self.OsuApiClient.fetchDiscussionPosts(request.discussionId, request.cursor),
        fetchFavourites: () => self.OsuApiClient.fetchFavourites(request.page),
        fetchPublicUser: () => self.OsuApiClient.fetchPublicUser(request.userId)
    };
    if (Object.prototype.hasOwnProperty.call(readers, request.action)) {
        Promise.resolve().then(readers[request.action]).then(data => sendResponse({ data })).catch(err => sendResponse({ error: err.message, status: err.status, retryAfter: err.retryAfter }));
        return true;
    }

    // 3. s-ul Image Uploader
    if (request.action === 'uploadImage' || request.action === 'uploadFile') {
        handleImageUpload(request, sendResponse);
        return true; // Keep message channel open for async
    }
    sendResponse({ error: 'Unknown extension action. Reload the extension and this osu! tab.' });
});

async function handleImageUpload(request, sendResponse) {
    try {
        const result=await self.KmhUploadProviders.upload(request);
        sendResponse(result);
    } catch(error) {
        console.warn('Modding Helper: image/file hosting failed:', error.message);
        sendResponse({ error:error.message, code:error.code||null });
    }
}
