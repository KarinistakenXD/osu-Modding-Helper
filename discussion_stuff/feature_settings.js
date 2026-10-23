const MOD_HELPER_DEFAULT_SETTINGS = {
    rcBook: true,
    imageUploader: true,
    discussionDownload: true,
    headerMetadata: true,
    modWorkspace: true,
    draftRecovery: true
};

window.modHelperSettings = { ...MOD_HELPER_DEFAULT_SETTINGS };

function loadModHelperSettings() {
    chrome.storage.local.get(MOD_HELPER_DEFAULT_SETTINGS, (settings) => {
        window.modHelperSettings = { ...MOD_HELPER_DEFAULT_SETTINGS, ...settings };
        window.dispatchEvent(new CustomEvent('mod-helper-settings-changed'));
    });
}

function isModHelperFeatureEnabled(feature) {
    return window.modHelperSettings?.[feature] !== false;
}

chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') return;

    let changed = false;
    Object.keys(MOD_HELPER_DEFAULT_SETTINGS).forEach((feature) => {
        if (changes[feature]) {
            window.modHelperSettings[feature] = changes[feature].newValue;
            changed = true;
        }
    });

    if (changed) window.dispatchEvent(new CustomEvent('mod-helper-settings-changed'));
});

loadModHelperSettings();

function setupOsuAuthListeners(connectBtn, host = document) {
    if (!connectBtn) return;
    if (connectBtn.dataset.osuAuthWired === 'true') return;
    connectBtn.dataset.osuAuthWired = 'true';

    const statusText = host.querySelector('#mod-helper-osu-status');
    let isConnected = false;
    function busy(active, label) {
        connectBtn.disabled = active;
        connectBtn.classList.toggle('kmh-is-loading', active);
        connectBtn.setAttribute('aria-busy', String(active));
        const content = connectBtn.querySelector('.btn-osu-big__content');
        if (!content) return;
        const icon = content.querySelector('i');
        const caption = content.querySelector('.kmh-auth-button-label');
        if (icon) icon.className = active ? 'fas fa-spinner fa-spin' : isConnected ? 'fas fa-unlink' : 'fas fa-link';
        if (caption) caption.textContent = label || (isConnected ? 'Disconnect osu! Account' : 'Connect osu! Account');
    }
    connectBtn.classList.remove('kmh-primary-button');
    connectBtn.classList.add('btn-osu-big', 'kmh-auth-native-button');
    connectBtn.innerHTML = '<span class="btn-osu-big__content"><span class="btn-osu-big__icon-inline btn-osu-big__icon-inline--left"><i class="fas fa-link" aria-hidden="true"></i></span><span class="kmh-auth-button-label">Connect osu! Account</span></span>';


    function render(status) {
        const connected = !!(status && status.connected);
        const expired = !!(status && status.expired);
        const refreshable = !!(status && status.refreshable);
        isConnected = connected;

        busy(false);

        if (statusText) {
            statusText.classList.toggle('kmh-auth-status-ok', isConnected);
            statusText.classList.toggle('kmh-auth-status-error', !isConnected && expired);
            statusText.classList.toggle('kmh-auth-status-idle', !isConnected && !expired);
            statusText.removeAttribute('style');
            if (isConnected) {
                statusText.textContent = expired && refreshable
                    ? 'Connected · token refresh available'
                    : 'Connected';
            } else if (expired) {
                statusText.textContent = 'Session expired · reconnect';
            } else {
                statusText.textContent = 'Not connected';
            }
        }
    }

    function refreshStatus() {
        chrome.runtime.sendMessage({ action: 'getAuthStatus' }, (response) => {
            if (chrome.runtime.lastError || response?.error) {
                if (statusText) {
                    statusText.textContent = 'Connection status unavailable';
                    statusText.classList.remove('kmh-auth-status-ok', 'kmh-auth-status-idle');
                    statusText.classList.add('kmh-auth-status-error');
                }
                busy(false);
                connectBtn.disabled=true;
                return;
            }
            render(response && response.data);
        });
    }

    refreshStatus();

    connectBtn.addEventListener('click', () => {
        busy(true, isConnected ? 'Disconnecting…' : 'Connecting to osu!…');

        const action = isConnected ? 'disconnectAuth' : 'startAuthFlow';
        chrome.runtime.sendMessage({ action }, (response) => {
            const err = chrome.runtime.lastError?.message || response?.error || (!response ? 'No response from extension' : null);
            if (err) {
                if (statusText) {
                    statusText.textContent = `Connection failed: ${err}`;
                    statusText.classList.remove('kmh-auth-status-ok', 'kmh-auth-status-idle');
                    statusText.classList.add('kmh-auth-status-error');
                }
                busy(false);
                return;
            }

            window.dispatchEvent(new CustomEvent('mod-helper-osu-auth-changed'));
            refreshStatus();
        });
    });
}

// Explicitly initialized by the settings modal. Do not observe the entire
// osu!web DOM simply to find a button: it caused stale modal references.