# Karin's osu! Modding Helper

A browser extension for **osu! beatmap discussions** that helps mappers and modders write clearer feedback, revisit existing discussions, follow replies, and check the Ranking Criteria without replacing osu!web's own editor.

**Public release:** v1.1.0 (following the GitHub v1.0 release)  
**Platform:** Chromium (Chrome / Edge / Opera / Brave / Vivaldi) and Firefox / Zen (Gecko) · Manifest V3  
**Status:** v1.1.0 GitHub package; Review-page Markdown highlighting is disabled. Local tests pass; live osu!web Review/OAuth integration still needs user testing.

> This is a community extension, not an official osu! / BN / NAT tool. It does not provide staff privileges, certify rankability, or submit and resolve discussions automatically.

## Installation

1. Download the extension ZIP and extract it.
2. **Chrome, Edge, Opera, Brave, Vivaldi:** open your browser's extension-management page (for example `chrome://extensions`), enable Developer mode, select **Load unpacked**, and choose the extracted folder containing `manifest.json`.
3. **Firefox / Zen:** open `about:debugging` → **This Firefox** → **Load Temporary Add-on**, then select `manifest.json`. A temporary add-on is removed when Firefox restarts. Persistent Firefox distribution requires Mozilla signing.
4. Disable older copies to avoid duplicate editor controls.
5. Open an osu! beatmapset discussion page and reload it. The introductory spotlight tour explains the features.

**Browser status (RC4):** Chromium background service-worker compatibility and Firefox-style background event-page initialization have been checked in isolation. Real Firefox/Zen and Opera installations and live osu! OAuth have **not** been verified. Firefox OAuth uses a browser-specific redirect URL that must be registered with the osu! OAuth application; the inherited proxy/client configuration may reject it. Browsing and local editor utilities do not require OAuth.

**Upgrade note:** v1.1.0 is the *public* version number. The development ZIPs used larger experimental numbers; do not load multiple builds at once.

## Features

### Editor integration

The extension uses compact helper controls near the native Markdown toolbar. osu!web keeps ownership of the message field, pin button, post-type buttons, and submission workflow.

- **Draft Coach** checks the text you are already writing. While Coach is open, analysis updates about **900 ms after typing stops**, including when IME input finishes.
- **Linked attachments** detect direct image links, osu! screenshot URLs, s-ul.eu links, ordinary websites, and common file URLs. Images can display previews; other links receive clickable cards. A separate, non-interactive highlighting layer colours Markdown in the native discussion/reply textarea without moving the textarea or changing the submitted text. It is **enabled by default on normal discussions and replies** and can be turned off with the highlighter icon. Highlighting is **disabled entirely on New Review pages** to avoid interfering with osu!'s Slate editor. It covers bold/italic, links and image syntax, inline/fenced code, headings, quotes, strikethrough, and osu! timestamps. For very long drafts (more than 30,000 characters), it temporarily falls back to the unmodified native text display.
- **Paste/drop image upload** supports user-initiated clipboard or dropped images through an optional **s-ul.eu** API key. Uploaded images are inserted as Markdown. Pasting a standalone screenshot URL can also insert an image link automatically.
- **Ranking Criteria** remains one click away, with mode-specific reference material. Its side-panel header now matches osu!web’s 50px navigation height, instead of covering a taller strip.
- **Replies** can have compact Preview links and Coach controls when their native text editor is present.
- **Reviews** use a separate multi-block helper strip for Coach and link previews, plus a contextual formatting bar that only appears while typing in the active Review block. Issue embeds can insert Markdown wrappers around selected text; Review paragraphs use osu!web's existing Slate bold/italic shortcuts. The extension never replaces Slate or the Review Post button. These functions passed local fixtures but remain unverified on live osu!web.

### Draft Coach and the *Road to BN* approach

Draft Coach uses the personal educational handbook **Karin-'s Road to BN: Modding Judgement & International English Writing** as its methodology. The checks are local and rule-based—not a cloud LLM, an official BN application grader, or a substitute for listening and playtesting.

Its focus is **Where → Observation → Why → Impact → Repair**, with optional comparison to similar phrases and alternative solutions for larger issues. It can also point you towards relevant Ranking Criteria topics, flag unsupported authority claims, and detect simple Markdown formatting problems.

The status chips indicate which concepts the draft *appears to mention*. They are **not** a judgement that the underlying mod is correct. The editor's native Problem/Suggestion controls are authoritative; the old, duplicated **Post category** dropdown has been removed.

### My Discussions: history and follow-up

Connect an osu! account to browse discussions started by that account, open follow-ups, inspect replies, revisit mapsets, and use local unread-activity checkpoints.

- **History loading:** fetch 50, 100, 250, or 500 discussions. The extension requests up to 50 per API page and retrieves more pages using the returned cursor; **Load next 50 discussions** is available when additional pages exist.
- **Posted-date filters:** filter by creation date, as well as local text search, type, resolution status, and sort order.
- **Important:** text and date filters search the **retrieved pages only**. They are not server-side date searches and do not prove that older matching posts do not exist.
- **Discussion cards:** map cover, keymode icon where supplied, category and resolution, activity time, direct link, copyable permalink and timestamp chips, and a small image thumbnail if the post includes a supported image URL.
- **Local activity markers:** compare retrieved discussion timestamps and resolved state to previous checkpoints. They are not native osu! notifications and are not guaranteed to distinguish your own replies from other participants.
- **Draft recovery:** preserve local unsent discussion text; the Coach itself does not submit content.

### Metadata and account connection

The extra beatmap header shows metadata and compact selected-difficulty OD/HP. When metadata requires OAuth, a disconnected state offers an account connection action; request errors while connected offer Retry rather than a misleading “Not loaded.”

OAuth is **optional** for offline writing guidance, Ranking Criteria access, and local drafts. It is needed for the account-aware discussion tools.

## Privacy and security

- Draft Coach runs locally. It does not send mod text to a model service.
- Direct image previews request images from their original hosts; those hosts may receive normal browser requests. Ordinary website links do **not** trigger HTML scraping.
- osu! authentication uses the existing `identify public` scopes, which do **not** grant privileges to post as you, resolve discussions, nominate maps, or inspect private moderation data.
- **Important:** The current OAuth implementation includes a third-party token-exchange Cloudflare Worker at `https://osu-proxy.ameliar-online.workers.dev/`. It is **not operated by osu!**, and this code has **not received an independent security audit**. Connect only if you trust its operator. Replacing this with an auditable, user-controlled OAuth flow is recommended before wider distribution.
- Optional s-ul.eu uploading transmits the images you explicitly paste/drop for uploading. Configure the API key in Settings → Integrations.

## Known limitations

- Live osu!web can change its React components and CSS classes. Helper placement must be checked on **General**, **Timeline**, **Reviews**, and **Replies** after site updates.
- The Review helper and contextual formatting bar were validated with simulated multi-block composers, **not** with a signed-in live Review session. Paragraph rich-text formatting relies on Slate's own hotkeys and must be verified live. Other Markdown wrappers are offered only for embedded issue text; they are not inserted into ordinary Review paragraphs because Slate may escape the raw characters. If its strip does not appear, inspect the `.page-title` and the closest enclosing review-editor DOM and report the selectors.
- Date-filtered searches are local to loaded API pages. On a very large history, select a larger fetch count or load more pages.
- Coach recognises wording patterns; it cannot independently verify note placement, musical structure, playability, RC violations, or mapper intent without the actual chart/audio.
- File URLs get link cards, not automatic PDF/ZIP contents. Some image hosts block cross-origin image previewing; those URLs remain accessible as links.
- No background-service polling or official notification subscription is implemented. Follow-up checks operate under the extension's documented, rate-limited conditions.

## Troubleshooting

| Problem | Check |
| --- | --- |
| Helper controls do not appear | Refresh the discussion tab; check `chrome://extensions` for one enabled build and inspect the console. |
| Account features are locked | Open Settings → Integrations and connect osu! only if you trust the configured OAuth proxy. |
| My Discussions stops at 50 | Select a larger **Fetch** count or press **Load next 50 discussions**. |
| A date search finds nothing | Dates are filtered only within pages already retrieved. Load more history. |
| The Review helper is missing | Capture the actual New Review HTML/DOM and a console error; the Review editor is not a single text field. |
| Markdown does not look coloured | The highlighter is normally enabled. Check the highlighter icon near Coach; turn it off and on if needed. New Review is a Slate editor; the extension suppresses its Markdown highlighting on that page entirely to protect native Review editing. |
| A discussion editor looks empty or behaves strangely | Turn off the highlighter using the highlighter icon, then reload. Report the console error and editor type. The optional display layer must never be required to post. |
| Coach doesn't refresh | Open Coach, type, then wait about one second; check whether the native editor was replaced by React. |
| Image paste/drop doesn't upload | Set up your s-ul.eu key, check file type/size and that the native textarea is focused. |

## Development

Source is plain JavaScript/CSS for a Chrome Manifest V3 extension. No build or bundled web framework is required. Load the repository directory using **Load unpacked**.

Useful modules: `discussion_stuff/mod_workspace.js` (discussion browsing and pagination), `discussion_stuff/coach_core.js` and `coach_ui.js` (local writing checks), `discussion_stuff/review_tools.js` and `review_format.js` (Review helper and active-block formatting), `markdown_overlay.js` (textarea highlighting), `discussion_stuff/link_preview.js` (link detection and preview cards), `discussion_stuff/image_uploader.js` (paste/drop insertion), and `osu_api_client.js` (osu! API requests).

The included `VERIFICATION.md` describes the reproducible local tests and what still needs live testing. Please attach the browser console output and the affected page's HTML structure when reporting an injection issue.

## v1.1.0 — changes since public v1.0

- Native osu!web-aligned helper UI and independent Settings/connection recovery.
- Draft Coach based on Karin-'s *Road to BN*, now debounced and automatic while open.
- In-editor Markdown source highlighting, contextual Review formatting, URL and image previews; optional s-ul.eu clipboard/drop upload.
- Account-aware discussion workspace with thread links, images, timestamps, and local follow-up markers.
- Fetch-size selection and posted-date filtering with honest partial-history coverage labels.
- Compact Review-page companion and reply-editor tools.
- Metadata/OD/HP refinements and first-install spotlight tour.
- Removed redundant Markdown toolbars, manual Coach category dropdown, and Review again action.

## License and credits

This distribution retains the repository's **GNU Affero General Public License v3** (`LICENCE`) and existing third-party attribution. The UI design is inspired by osu!web's publicly documented patterns but does **not** redistribute osu!web fonts or proprietary art assets. osu! and related names are associated with their respective owners.

The *Road to BN* methodology is Karin-'s independent personal teaching guide, not an official Ranking Criteria document. Refer to the [official Ranking Criteria](https://osu.ppy.sh/wiki/en/Ranking_criteria) for binding requirements.

### RC3 safety change

The earlier RC2 syntax highlighter wrapped the native React-managed textarea. That DOM manipulation could conflict with React re-rendering, so RC3 **never wraps or reparents the textarea**. It renders a non-interactive separate layer, enabled by default for native discussion and reply textareas. Test the live editor before publishing a stable v1.1.0.
