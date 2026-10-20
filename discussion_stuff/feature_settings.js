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

    function render(status) {
        const connected = !!(status && status.connected);
        const expired = !!(status && status.expired);
        isConnected = connected;

        connectBtn.textContent = isConnected ? 'Disconnect osu! Account' : 'Connect osu! Account';
        connectBtn.classList.toggle('btn-osu-big--disabled', false);
        connectBtn.disabled = false;

        if (statusText) {
            if (isConnected) {
                statusText.textContent = expired ? 'Status: Connected — refresh available' : 'Status: Connected';
                statusText.style.color = '#a6cc2b';
            } else if (connected && expired) {
                statusText.textContent = 'Status: Session expired — reconnect';
                statusText.style.color = '#ff6666';
            } else {
                statusText.textContent = 'Status: Not Connected';
                statusText.style.color = '#ff6666';
            }
        }
    }

    function refreshStatus() {
        chrome.runtime.sendMessage({ action: 'getAuthStatus' }, (response) => {
            render(response && response.data);
        });
    }

    refreshStatus();

    connectBtn.addEventListener('click', () => {
        connectBtn.disabled = true;
        connectBtn.textContent = isConnected ? 'Disconnecting…' : 'Connecting…';

        const action = isConnected ? 'disconnectAuth' : 'startAuthFlow';
        chrome.runtime.sendMessage({ action }, (response) => {
            if (response && response.error) {
                if (statusText) {
                    statusText.textContent = `Status: ${response.error}`;
                    statusText.style.color = '#ff6666';
                }
                connectBtn.disabled = false;
                connectBtn.textContent = isConnected ? 'Disconnect osu! Account' : 'Connect osu! Account';
                return;
            }

            window.dispatchEvent(new CustomEvent('mod-helper-osu-auth-changed'));
            refreshStatus();
        });
    });
}

// Explicitly initialized by the settings modal. Do not observe the entire
// osu!web DOM simply to find a button: it caused stale modal references.