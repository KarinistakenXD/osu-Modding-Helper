> **v1.1.1 local preview.** Nothing from this candidate has been committed or released on GitHub. Test on your own browser before approving a publish.

# Karin's osu! Modding Helper

A browser extension for **osu! beatmap discussions** that helps mappers and modders write clearer feedback, revisit existing discussions, follow replies, and check the Ranking Criteria without replacing osu!web's own editor.

**Local testing candidate:** v1.1.1 (not published; v1.1.0 remains the latest public GitHub release)  
**Platform:** Chromium (Chrome / Edge / Opera / Brave / Vivaldi) and Firefox / Zen (Gecko) · Manifest V3  
**Status:** v1.1.1 revised LOCAL PREVIEW (not published); Review-page Markdown highlighting stays disabled. Live osu!web compatibility and OAuth remain unverified.

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
- **Linked attachments** detect direct image links, osu! screenshot URLs, s-ul.eu links, ordinary websites, and common file URLs. Images can display previews; other links receive clickable cards. A separate, non-interactive highlighting layer colours Markdown in the native discussion/reply textarea without moving the textarea or changing the submitted text. It is **enabled by default on normal discussions and replies** and can be turned off with the highlighter icon. Highlighting is **disabled entirely on New Review pages** to avoid interfering with osu!'s Slate editor. It covers bold/italic, links and image syntax, inline/fenced code, headings, quotes, strikethrough, and osu! timestamps. For very long drafts (more than 20,000 characters), it temporarily falls back to the unmodified native text display.
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


## v1.1.1 candidate additions

- **Download options:** preserves osu!'s own button on main beatmapset pages, with an adjacent expandable menu; on discussion pages, a small + control opens a floating options panel without intercepting the native Download action. Official package and no-video links, Hinai mirror with/no video, full background, cover, audio **preview**, JSON/TXT metadata. Nerinyan is linked to its website (no unverified direct endpoint is invented).
- **Audio, video and background-only:** a local `.osz` extractor. First download your `.osz`, then select it and choose the asset category. Uses the `.osu` `AudioFilename` and Background event if available, instead of confusing song audio with hitsounds. It does not access a private music stream or claim an audio preview is a full song. ZIP extraction requires a browser with `DecompressionStream('deflate-raw')`; unsupported formats show an error.
- **Original `.osu` metadata:** optional on-demand raw difficulty retrieval (`/osu/{beatmap_id}`) with graceful fallback to existing page JSON; if osu! rejects or returns HTML, no fabricated content is exported. Tag strings cannot reliably identify storyboard/hitsound contributions; this build does not attempt role classification.
- **Front-page inspector:** a small upper-right pen button opening a copy/export modal showing original/romanised artist and title, source, genre, language, and unmodified tags. No contributor classification.
- **Discussions:** enlarged HP/OD strip, category-coloured controls, more consistent My Discussions header buttons, green/red statuses, empty link-preview state, and post-submit preview refresh. Nearby discussion text peek only when the text is already present in the DOM.
- **Ranking Criteria:** topic switcher for General, Metadata, Standardisation, Current Difficulty, media and modding procedure. Always read the official text for binding interpretations.
- **Comment badges:** optional public usergroup lookup (BN/NAT/GMT/BSC) only on visible main-mapset comments, with a cap of 12 lookups per page session. Requires the existing osu! OAuth connection. Never simulates staff roles.

**Known limitations:** Actual osu!web React and OAuth integration was not exercised against a live signed-in page in this environment. The no-video official URL and external mirror availability depend on those services. Browser-based local extraction currently selects a single asset per action rather than building a new `.osz`.


## v1.1.1 floating-panel revision (local preview)

- Download remains an osu!web action. A small adjacent **+** opens a **fixed-position** options popover; it does not enlarge the beatmap header or the pinned New Discussion editor. It closes on outside click, Escape, or scrolling the page.
- Draft Coach (small icon), linked previews, and the download popover share a single dismissible anchoring system. Only one helper popover is visible at a time. Coach is limited to roughly 408 px wide and 70% of the viewport height, with internal scrolling.
- Removed the duplicate **Toggle editor highlighting** action from the link preview. The existing highlighter toolbar action remains.
- Moved the map-page metadata inspector to a small top-right pen button. Removed host/guest-mapper classification from this inspector and metadata export.
- Restored osu!web's own post-category button colours instead of applying colours after JavaScript loads. This should eliminate the blue-to-dark flash caused by the extension.
- Corrected the Code of Conduct and visual/song content links to the official **Rules** wiki namespace. Added an **Open in wiki** fallback for RC pages that cannot be embedded.
- The helper never creates a second editable text field, submits a post, or intercepts the original Download button.

**Test scope:** offline Chromium fixture only (950/500/370 px, route selectors isolated due to sandbox navigation restrictions). Live pinned editor, dynamic React replacement, Firefox, mirrors and API integrations must still be verified before publishing.

### v1.1.1 local-review notes

This is an **unpublished preview**, not the public v1.1.0 release. The Download options appear from a small `+` beside the native download action. The Source-side metadata magnifier opens an inspector. Draft Coach remains floating and does not close when scrolling or clicking outside.

The RC drawer cannot determine the correct map difficulty tier solely from star rating; select it manually when not evident from difficulty naming. Image thumbnails may not load from hosts that reject embedding; the extension keeps a link to the original image.

If Markdown highlighting causes misalignment, turn it off in the editor. The native textarea remains the source of truth. Live osu!web integration is not verified by these local tests.


### v1.1.1 local review-4 adjustments (not published)

- Source inspector now uses the native Source row and is available when Source is unspecified.
- RC topic navigation hides the difficulty-specific selectors for other topics. Custom difficulty names use star-rating bands for a **suggestion only**, never an official RC classification.
- CS and AR appear with HP/OD on non-mania difficulties when available from the beatmapset payload.
- Nearby discussions offer a small contextual excerpt from posts already loaded or from an authenticated, rate-limited discussion API lookup.
- User-group labels may appear for BN/NAT/GMT when returned by the public user API; results are capped and native labels are not duplicated.
- Markdown syntax uses different colours for delimiters, link labels/URLs, images, code, quotes, headings, strikethrough and timestamps. The non-interactive overlay preserves original text and falls back safely when geometry is uncertain.
- Coach stays logically enabled but visually hides if its editor is far outside the viewport. It reappears on return.

**Browser fixture tests are not equivalent to live osu!web testing.** Don't publish this local build without the requested user verification.


### Review 6 notes (local candidate)

- **Download:** additional download options are kept off the beatmapset Info hero, which retains its native controls.
- **My Discussions:** recent activity and unread local changes share one view, with separate visual dividers.
- **Draft recovery:** local copies are attached to their editor/mapset context and can be restored manually. Recovering a draft never posts it.
- **Files:** with a configured s-ul.eu key, user-selected image, document, beatmap and supported media files can be pasted or dropped; non-images insert a Markdown link. Unsupported/executable files are rejected and the hosting service may reject other formats.
- **Public badges:** groups are only displayed if the public API returns a matching role; probation is not guessed.
