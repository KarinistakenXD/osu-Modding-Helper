// external_web_handler.js - The Background Service Worker

// Chromium runs this file as an MV3 service worker and needs importScripts().
// Firefox / Zen runs the manifest's background.scripts in order in a
// background event page, where importScripts() is not available.
if (typeof importScripts === 'function') {
    try {
        importScripts('osu_auth_manager.js', 'osu_api_client.js');
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
        const storageData = await chrome.storage.local.get(['sulApiKey']);
        const apiKey = storageData.sulApiKey;

        if (!apiKey || apiKey.trim() === '') {
            throw new Error("missing_api_key");
        }

        const response = await fetch(request.imageData);
        const blob = await response.blob();

        const uploadUrl = new URL('https://s-ul.eu/api/v1/upload');
        uploadUrl.searchParams.set('wizard', 'true');
        uploadUrl.searchParams.set('key', apiKey.trim());

        const formData = new FormData();
        formData.append('file', blob, request.fileName || 'image.png');

        const uploadRes = await fetch(uploadUrl.toString(), {
            method: 'POST',
            body: formData,
            credentials: 'omit'
        });

        if (!uploadRes.ok) {
            const errorBody = await uploadRes.text().catch(() => '');
            const detail = errorBody ? `: ${errorBody.slice(0, 200)}` : '';
            throw new Error(`Upload failed with status ${uploadRes.status}${detail}`);
        }

        const json = await uploadRes.json();
        
        if (json && json.url) {
            sendResponse({ url: json.url });
        } else {
            throw new Error("Invalid response from s-ul");
        }
    } catch (error) {
        console.error("Modding Helper File Upload Error:", error);
        sendResponse({ error: error.message });
    }
}
