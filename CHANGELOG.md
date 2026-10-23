## v1.1.2 — Metadata export button spacing (local preview, uncommitted)

- Arrange the four existing download-panel metadata actions in a balanced 2×2 grid; keep all actions inside the same container.
- Add adequate heading, button, and top/bottom spacing, with a one-column fallback for extremely narrow windows.
- Preserve all existing operations, previous auth/profile/group changes, manifest version and permissions.
- See `V1.1.2_METADATA_EXPORT_SPACING_LOG.md` for verification and scope.

## v1.1.2 — Connection layout and vertical spacing (LOCAL PREVIEW, uncommitted)

- Separate the metadata auth notice from the cramped inline Genre/Language row; increase vertical padding in both metadata columns and inside the notice.
- Stack OAuth status above the native Connect button, enlarge spacing in Integrations, and use a neutral disconnected badge instead of a red error indication.
- Preserve third-party OAuth disclosure, pending-operation spinners, upstream native buttons, preceding four fixes, the inspector, and all other existing functionality.
- Isolated Chromium checks at 1440 / 950 / 500 / 370 px and previous regression suites passed. See `V1.1.2_CONNECTION_LAYOUT_LOG.md`.

## v1.1.2 — Final UI refinement (local preview, uncommitted)

- Switched metadata authentication actions and the Settings OAuth button to osu!web `btn-osu-big` markup with meaningful progress icons and disabled states.
- Converted New Discussion Draft Coach to a single icon toggle; added consistent active highlights for Draft Coach, Ranking Criteria, My discussions and Markdown highlighting.
- Replaced the always-visible attachment preview icon with an on-demand, clickable link-count chip; reply preview shortcuts hide when there are no links.
- Preserved the third-party OAuth proxy disclosure, native posting controls, previous metadata inspector placement and all prior v1.1.2 fixes.
- Added targeted isolated Chromium tests and `V1.1.2_FINAL_UI_LOG.md`.

### v1.1.2 local preview — native metadata action alignment (unpublished)

- Place the Metadata Inspector magnifying-glass button immediately **left of** osu!web’s native metadata pencil, using its own extension-owned action wrapper; do not modify React-owned editing controls.
- Match native `btn-circle` dimensions, hover colours and 120ms hover reveal of the metadata box. Hide the action when the pointer leaves the box; retain focus and touch accessibility.
- On beatmapsets without an edit pencil, keep the Inspector as a single right-hand action. Preserve real Source fields and the previous four fixes. Remove obsolete conflicting inspector styling rules.
- Validate placement, 4px action spacing, mouse hover, React-style replacement, navigation cleanup and Source/no-Source cases at 1440/950/500/370px in isolated Chromium fixtures. Live osu!web remains unverified.

## v1.1.2 — Metadata inspector placement correction (local preview, 2026-10-23; NOT published)

- Remove fabricated `Source: Not specified` metadata rows and the old Description-column fallback.
- Attach Metadata Inspector to the existing Genre/Language metadata area, inline beside Genre, on front-page beatmapset information only. Keep osu!web's real Source field intact when it exists.
- Clean obsolete inspector controls when osu!web replaces the metadata DOM or the browser navigates away.
- Preserve inspector viewing/copying/JSON export and all four previous v1.1.2 fixes. No manifest version or permission changes.
- Added isolated Chromium tests at 1440/950/500/370 px (DOM structure based on current `ppy/osu-web` info.tsx) including React-like rerender and navigation; live signed-in osu!web remains unverified.

## v1.1.2 — Four focused fixes (local preview, 2026-10-23; NOT published)

- **Link preview lifecycle:** Rebind existing body-level preview portals to replacement React textareas in the same editor host, update their popover anchor if the toolbar button changes, abort obsolete listeners, and remove detached previews on unmount or navigation away from discussion pages. Preserve preview contents, links, cards, and the live-open state when possible.
- **Draft Coach lifecycle:** Rebind IME/input handlers to replacement native textareas; remove stale Coach panels/listeners/timers, preserve open Coach functionality, and avoid closing unrelated popovers. The reply Coach also stops holding onto a previous textarea.
- **Extensionless clipboard images:** Accept allowlisted image MIME types for files without an extension (e.g. clipboard `image`/`image/png`), supply a safe matching upload filename, and continue rejecting executable filenames, unsupported types, and images over the conservative 4,000,000-byte embed limit.
- **OAuth status:** Show expired access tokens with stored refresh tokens as connected and automatically refreshable, rather than demanding a new interactive sign-in. Sessions with no usable access/refresh token still offer Connect. Status checks do not initiate OAuth or remote refresh.
- Added offline regression fixtures for browser component replacement at 1440/950/500/370 px, paste safety, and auth status/settings. The previous GIF boundary tests still pass. See `V1.1.2_FOUR_FIXES.md` for test boundaries.
- No feature removals, manifest version change, permission changes, GitHub commit, tag, push or release.

## v1.1.1 — Profile-page compatibility fix

- Restricted injected scripts and CSS to `osu.ppy.sh/beatmapsets/*` instead of every osu! page. This prevents Modding Helper UI styling, highlighting layers, and onboarding effects from leaking into user-profile covers or unrelated pages.
- Retains support for both beatmapset information pages and beatmapset discussion pages.
- Incorporates the previously tested Review 7 local changes; historical v1.0.0 and v1.1.0 release tags remain unchanged.

## v1.1.1 — Review 6 (unpublished local candidate)

- Reworked Source inspector button to match osu! native circular controls.
- Removed extra front-page Download dropdown to avoid width conflicts.
- Improved nearby modpost excerpts, public comment usergroup badges, and disabled action styling.
- Consolidated discussion activity views with new-update dividers.
- Clarified local draft recovery and added saved-copy deletion.
- Added user-initiated s-ul.eu file links for approved non-image attachments while blocking executables.

## v1.1.1 — Review 5 (local preview, not published)

Nearby timestamp excerpts and osu://edit links; stronger RC name-versus-SR guidance; native-style Coach/Settings/disabled buttons; public BN/NAT/GMT role rendering; drag-and-drop overlay with upload feedback; safe Coach hide-on-distance.

## v1.1.1 — Local review fixes (not published) — 22 October 2026

- Fixed the metadata magnifying-glass entry to attach to the beatmap Source heading rather than Description; no automatic host/GD contributor inference.
- Reduced the Download + panel to official/mirror beatmapset links, cover artwork and metadata copy/export; removed full background, audio preview and `.osz` extraction actions.
- Made the Draft Coach narrow and right-preferred, persistent while typing, on scrolling and outside clicks; close intentionally via button/toggle or Escape.
- Restored immediate colour styling for Note/Praise/Suggestion/Problem using static native data-type selectors without JavaScript-delayed recolouring.
- Reworked Ranking Criteria difficulty identification: URL/selected difficulty precedes a fallback; star rating is displayed as information only. Unknown tiers remain unclassified and can be selected manually. Added difficulty selector and explicit verification message.
- Redesigned My Discussions media display to detect multiple image links through whole loaded text and keep failed image-host previews as clickable links. More-than-four thumbnails collapse behind a compact button.
- Made Markdown source mirroring fail safely: text stays native if the mirror is offscreen, geometrically out of sync or empty, rather than leaving floating text on top of the page. This remains a local fixture test and needs live browser verification.
- Maintained existing v1.1.1 features and custom icon; no GitHub repository changes.

## v1.1.0 — Review highlighting safety patch

- Disabled the extension Markdown syntax overlay on New Review pages, including matching textareas introduced by React rerenders.
- When switching into Reviews, any existing overlay is detached and the native text is restored.
- Left ordinary discussion and reply highlighting unchanged, as well as the Review Coach, link previews and native Slate editor.
- Kept the supplied custom extension icon and cross-browser RC4 support.

## v1.1.0 RC4 — cross-browser loader and RC header

- Added MV3 service-worker / background-script dual manifest for Chromium and Firefox/Zen, based on Mozilla's documented cross-browser pattern.
- Background initialization now uses `importScripts` only when available; Firefox scripts load in manifest order.
- Added Firefox add-on metadata and a stable development ID; Firefox OAuth still requires its redirect to be registered with osu!'s client.
- RC drawer title bar reduced to osu!web's 50px navigation height, with compact typography and centered Close control.
- Added honest installation guidance for Opera/Edge/Brave/Vivaldi and Firefox/Zen.
- No changes to Markdown highlighting, existing editor state, or submission behavior.

# Changelog

## v1.1.0 RC3 — Markdown safety update

- Replaced DOM-wrapping syntax highlighting with a separate body-level, pointer-transparent display layer. Native React textarea nodes and their parents are unchanged.
- Enabled native discussion/reply syntax colouring by default (unless the user previously disabled it).
- Expanded colouring beyond bold to italic, links, Markdown images, inline/fenced code, quotes, headings, strikethrough, and osu! timestamps.
- Added a 30,000-character plain-text fallback and cleanup/rebinding after textarea replacement.
- Retained the optional highlighter toggle and the distinction between normal Markdown textareas and the native Slate Review editor.
- Browser fixture tests pass at 950, 500, and 370 px. Live osu!web compatibility is still unverified.

## v1.1.0 — Release candidate

This is the next **public** version after v1.0. The intervening v1.4.x packages were internal experimental builds.

### Added
- Contextual Review formatting controls, visible only while the active Review block contains text (Markdown wrappers for issue embeds; native Slate bold/italic for paragraphs).
- In-place Markdown syntax highlighting in discussion and reply textareas, preserving their native input and posting behavior.
- Paginated My Discussions history with fetch-size selection (50 / 100 / 250 / 500), posted-date controls, and an explicit partial-history warning.
- Review-specific Coach and URL preview strip for the native multi-block New Review editor.
- Small attachment thumbnails and clickable preview cards for supported links.
- First-install spotlight guide, OAuth onboarding and robust Settings entry points.

### Improved
- Unified editor toolbar sizing and spacing, while keeping native osu! controls untouched.
- Automatic, debounced Draft Coach text checks based on Karin-'s *Road to BN* handbook.
- Metadata loading states, OD/HP display, timestamps, and discussion status indicators.
- Reply-editor helpers and optional image paste/drop support.

### Removed
- Duplicate editor formatting toolbar.
- Redundant Post category selector and Review again button inside Coach.

### Test status
Local browser and syntax tests pass for the covered fixtures. Live osu!web Review and OAuth integration remain unverified. See `VERIFICATION.md`.

## [1.1.1] — Local preview candidate (not published)
- Expandable download options for official osu! and Hinai mirrors; local .osz extraction for audio, video, image and .osu.
- Front-page metadata inspector and honest contributor classification.
- Readability improvements for HP/OD, discussion category actions and workspace buttons.
- Ranking Criteria topic selector and read-only adjacent-post preview when text is already loaded on the page.
- Empty-state link previews and editor-clear reconciliation after submission.
- No GitHub release or tag created; requires user validation.


## [1.1.1 UI revision] — LOCAL PREVIEW ONLY; not published
- Replaced layout-expanding Download, Coach, and Link Preview panels with anchored, auto-dismissable floating popovers; editor height stays unchanged.
- Download expansion now uses a small + button alongside the original Download link; native Download is never intercepted.
- Moved metadata inspector to a small upper-right pen icon. Removed automated contributor-role classification.
- Reduced Coach width, changed its editor action to a compact icon, and removed duplicate highlighting action from linked previews.
- Removed delayed custom post-category colours; uses native osu!web colours.
- Corrected Code of Conduct, visual content and song content RC URLs; added Open in wiki fallback.
- Offline responsive fixture and Node syntax checks. No GitHub changes.


### v1.1.1 local preview / review-4 (not a public release)

- Metadata inspector relocation and missing-source fallback.
- Nonstandard difficulty SR suggestion with manual RC verification; topic-specific control visibility.
- Non-mania CS and AR display.
- Syntax-aware Markdown colouring that preserves bytes and font metrics; fixed content-box padding geometry mismatch; hide for open dialogs.
- Nearby discussion preview and verified public role badge path, with bounded API lookups.
- Coach distance-aware visual hiding without cancelling the review session.
- Multi-image gallery support extended to 24 links.

### v1.1.1 local review 7 (unpublished)
- Official public group badges for comments and replies, preserving probation and ruleset icons.
- My Discussions cover/avatar/account header with public groups and supporter indicator.
- Copy Source alignment and red/green OAuth status with white button labels.

## v1.1.2 Preview — multi-host image/attachment uploads (2026-10-23)

- Added a local hosting-provider selector to both extension popup and osu!web Settings.
- Added Catbox (anonymous or userhash), ImgBB (API key), and temporary Litterbox to the existing s-ul.eu integration.
- Added pre-upload Smart selection based on configured credentials, file type, size and persistence suitability; no silent reupload after a network failure.
- Extended direct-image preview and auto-paste detection to support more formats, GIFs, image URLs with query strings, extensionless `![](URL)` targets and additional direct-image hosts.
- Enforced a 48 MB local transport limit and documented that provider quota visibility is unavailable.
- Preserved osu!web editor control and local-only preferences. No GitHub publication.

## v1.1.2 GIF / image embed compatibility patch (local preview)

- Conservative osu! discussion embed threshold: **4,000,000 bytes** (4 decimal MB). Community guidance reports a **4 MB** maximum for remote images cached by osu!. Exact 4 MiB vs decimal MB server cutoff was not verified.
- Applies to files that would become inline image embeds: GIF, PNG, JPEG, WebP, AVIF, APNG, BMP, SVG and ICO. Files intended as ordinary download links remain subject to provider/transport limits.
- Drag and Ctrl+V **reject before FileReader or upload** if an inline image is over the threshold, showing a 14-second red/error notice with size, action to compress, and confirmation that the upload was not attempted.
- Background uploader checks the same policy after decoding and before selecting any host/network request. Switching upload providers does not bypass the limit.
- Images at or below the conservative threshold can proceed as before. Server caching/hotlink support cannot be guaranteed merely by passing file size.
- Already-hosted image URLs (including manually written `![](url)`) have no reliable local File.size; the extension does not pretend to verify their dimensions/byte size or automatically download third-party URLs.
- Source: https://osu.ppy.sh/community/forums/topics/2175226 and https://osu.ppy.sh/community/forums/topics/1612139 .

## v1.1.2 (local preview — auth/profile/group review)
- Recover floating Connect control from interrupted startup and stale refresh throttles; resync on focus/visibility/token changes.
- Rebuild the My Discussions identity/cover section using osu!web supporter hearts from `support_level`, preserving multiple real group memberships and distinguishing OAuth status from profile API errors.
- Improve verified comment group badges for multiple memberships without replacing native author DOM or inventing roles; gate additional user lookups behind extension OAuth.
- Add synthetic Chromium tests and `V1.1.2_AUTH_PROFILE_GROUPS_LOG.md`. Unpublished local build.

## v1.1.2 local preview — Metadata action spacing

- Aligned Copy metadata, Export .txt, Export .json and Read .osu metadata in a consistent two-by-two button grid with equal widths.
- Increased metadata card top/bottom padding, button height and vertical gaps; use single-column layout below 331px.
- Left download links, editor, upload flows, other popovers and manifest permissions unchanged.
- Added `tests/metadata_download_spacing_browser.py` and screenshot fixture; no translation or summarization API added.
- No GitHub commit or release.
