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
