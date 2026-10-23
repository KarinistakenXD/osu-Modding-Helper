// osu_auth_manager.js - "The Bouncer"
//
// Owns the osu! API v2 OAuth 2.0 Authorization Code flow: launching the
// consent screen via chrome.identity, and exchanging the resulting code
// (and later, refresh tokens) for an access token pair.
//
// WORKER PROXY MODEL: this extension no longer holds a client_secret at
// all. The confidential half of the token exchange (POST /oauth/token
// with client_id + client_secret) happens in a separate Cloudflare Worker
// (see osu_proxy_worker.js) that this file calls instead of osu.ppy.sh
// directly. PUBLIC_CLIENT_ID below is safe to hardcode — client_id is not
// confidential; it's already visible in the browser's address bar during
// the consent step. TRADE-OFF: every user of this extension now has their
// authorization code / refresh token routed through WORKER_PROXY_URL, so
// whoever operates that worker is in a position to see them. That's the
// same trust model as any "Sign in with X" backend — just worth being
// explicit about, since this extension is distributed to other people.
//
// This file is loaded into the background service worker via
// importScripts() from external_web_handler.js, so it must stay a classic
// (non-module) script. It exposes a single global, `self.OsuAuthManager`.

// --- placeholders: ---------------------------
const PUBLIC_CLIENT_ID = '68910';
const WORKER_PROXY_URL = 'https://osu-proxy.ameliar-online.workers.dev/';
// ---------------------------------------------------------------------------

(() => {
    const AUTHORIZE_ENDPOINT = 'https://osu.ppy.sh/oauth/authorize';
    const TOKEN_STORAGE_KEY = 'osuAuthToken';
    const SCOPES = 'public identify';

    // Treat a token as expired slightly before it actually is, so a call
    // that lands right on the boundary never goes out with a token that
    // dies mid-flight.
    const EXPIRY_BUFFER_MS = 60 * 1000;

    // Collapses concurrent refresh calls into one in-flight request. osu!
    // rotates the refresh token on every use, so two simultaneous refreshes
    // would race and one would fail on an already-spent token.
    let refreshInFlight = null;
    let sessionEpoch = 0;

    // ---- small storage helpers -------------------------------------------------

    function getStoredToken() {
        return new Promise((resolve) => {
            chrome.storage.local.get([TOKEN_STORAGE_KEY], (result) => {
                resolve(result[TOKEN_STORAGE_KEY] || null);
            });
        });
    }

    function saveToken(tokenData) {
        return new Promise((resolve) => {
            chrome.storage.local.set({ [TOKEN_STORAGE_KEY]: tokenData }, resolve);
        });
    }

    function clearToken() {
        return new Promise((resolve) => {
            chrome.storage.local.remove([TOKEN_STORAGE_KEY], resolve);
        });
    }

    // ---- osu! + worker endpoints ------------------------------------------

    function getRedirectUri() {
        // Stable as long as manifest.json's "key" field doesn't change.
        return chrome.identity.getRedirectURL();
    }

    function launchWebAuthFlow(url) {
        return new Promise((resolve, reject) => {
            chrome.identity.launchWebAuthFlow({ url, interactive: true }, (redirectUrl) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                    return;
                }
                if (!redirectUrl) {
                    reject(new Error('cancelled'));
                    return;
                }
                resolve(redirectUrl);
            });
        });
    }

    /**
     * Sends the non-confidential half of a token request to our own
     * Worker, which attaches client_id/client_secret and forwards to
     * osu!'s /oauth/token. Never sends client_secret from here.
     */
    async function postToProxy(body) {
        const response = await fetch(WORKER_PROXY_URL, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(20000)
        });

        if (!response.ok) {
            const errBody = await response.text().catch(() => '');
            const err = new Error(`osu-proxy token exchange failed (${response.status}): ${errBody}`);
            err.status = response.status;
            try { err.oauthError = JSON.parse(errBody).error; } catch {}
            throw err;
        }

        return response.json();
    }

    // Normalizes a raw /oauth/token response into what we persist.
    function toStoredShape(tokenResponse, fallbackRefreshToken) {
        if (!tokenResponse.access_token || !Number.isFinite(Number(tokenResponse.expires_in)) || Number(tokenResponse.expires_in) <= 0) throw new Error('Invalid token response');
        return {
            accessToken: tokenResponse.access_token,
            // osu! returns a fresh refresh_token on every grant; keep the
            // old one only if a response is ever missing it.
            refreshToken: tokenResponse.refresh_token || fallbackRefreshToken || null,
            tokenType: tokenResponse.token_type || 'Bearer',
            expiresAt: Date.now() + (Number(tokenResponse.expires_in) * 1000)
        };
    }

    // ---- public flow ---------------------------------------------------------

    /**
     * Runs the full interactive Authorization Code flow: opens osu!'s
     * consent screen via chrome.identity.launchWebAuthFlow, validates the
     * redirect, then hands the code to the Worker proxy for exchange.
     *
     * Call this from a user gesture (e.g. a "Connect osu! account" button
     * in the settings UI) rather than automatically in the background.
     */
    async function startAuthFlow() {
        const epoch = ++sessionEpoch;
        const redirectUri = getRedirectUri();
        const state = crypto.randomUUID();

        const authorizeUrl = new URL(AUTHORIZE_ENDPOINT);
        authorizeUrl.searchParams.set('client_id', PUBLIC_CLIENT_ID);
        authorizeUrl.searchParams.set('redirect_uri', redirectUri);
        authorizeUrl.searchParams.set('response_type', 'code');
        authorizeUrl.searchParams.set('scope', SCOPES);
        authorizeUrl.searchParams.set('state', state);

        const redirectedTo = await launchWebAuthFlow(authorizeUrl.toString());
        const resultUrl = new URL(redirectedTo);
        const expectedUrl = new URL(redirectUri);
        if (resultUrl.origin !== expectedUrl.origin || resultUrl.pathname !== expectedUrl.pathname) throw new Error('Unexpected OAuth redirect');

        const returnedState = resultUrl.searchParams.get('state');
        if (returnedState !== state) {
            throw new Error('OAuth state mismatch — aborting (possible CSRF).');
        }

        const oauthError = resultUrl.searchParams.get('error');
        if (oauthError) {
            throw new Error(`osu! denied authorization: ${oauthError}`);
        }

        const code = resultUrl.searchParams.get('code');
        if (!code) {
            throw new Error('No authorization code in redirect URL.');
        }

        const tokenResponse = await postToProxy({
            grant_type: 'authorization_code',
            code,
            redirect_uri: redirectUri
        });

        const stored = toStoredShape(tokenResponse);
        if (epoch !== sessionEpoch) throw new Error('Authentication cancelled');
        await saveToken(stored);
        return stored;
    }

    /**
     * Exchanges the stored refresh token for a new access token via the
     * Worker proxy. Safe to call concurrently — duplicate calls share one
     * in-flight request.
     *
     * Rejects with Error('not_authenticated') if there's no refresh token
     * to use (caller should fall back to startAuthFlow()).
     */
    async function refreshAccessToken() {
        if (refreshInFlight) return refreshInFlight;

        const epoch = sessionEpoch;
        refreshInFlight = (async () => {
            const existing = await getStoredToken();
            if (!existing || !existing.refreshToken) throw new Error('not_authenticated');

            try {
                const tokenResponse = await postToProxy({
                    grant_type: 'refresh_token',
                    refresh_token: existing.refreshToken
                });

                const stored = toStoredShape(tokenResponse, existing.refreshToken);
                if (epoch !== sessionEpoch) throw new Error('Authentication cancelled');
                await saveToken(stored);
                return stored;
            } catch (err) {
                // Preserve the session for network/server errors.
                if (err.oauthError === 'invalid_grant' && epoch === sessionEpoch) await clearToken();
                throw err;
            }
        })();

        try {
            return await refreshInFlight;
        } finally {
            refreshInFlight = null;
        }
    }

    /**
     * The main entry point for everything else in the extension: returns a
     * currently-valid access token, transparently refreshing first if the
     * stored one is expired (or close to it).
     *
     * Rejects with Error('not_authenticated') if the user has never
     * connected.
     */
    async function getValidAccessToken() {
        const existing = await getStoredToken();
        if (!existing) throw new Error('not_authenticated');

        if (existing.expiresAt - EXPIRY_BUFFER_MS > Date.now()) {
            return existing.accessToken;
        }

        const refreshed = await refreshAccessToken();
        return refreshed.accessToken;
    }

    /** Quick status check for settings UI — never throws. */
    async function getAuthStatus() {
        const existing = await getStoredToken();
        if (!existing) return { connected: false };
        const expired = !Number.isFinite(Number(existing.expiresAt)) || existing.expiresAt <= Date.now();
        const refreshable = !!existing.refreshToken;
        return {
            connected: (!!existing.accessToken && !expired) || refreshable,
            expiresAt: existing.expiresAt,
            expired,
            refreshable
        };
    }

    /** Wipes the stored token pair (a "Disconnect osu! account" action). */
    async function disconnect() {
        sessionEpoch++;
        await clearToken();
    }

    self.OsuAuthManager = {
        startAuthFlow,
        refreshAccessToken,
        getValidAccessToken,
        getAuthStatus,
        disconnect,
        getRedirectUri
    };
})();
