## Review-page highlighting safety patch

- On a Reviews route, the Markdown overlay does not attach, and toggling it is a no-op.
- On a New Review editor detected by the page heading, matching textareas are excluded.
- Switching from General into Reviews removes any previously mounted overlay and restores native textarea text.
- General and Timeline discussion/reply highlighting is preserved.
- No changes to the native Slate Review editor, Review Coach, or link-preview helper.

## RC4 cross-browser verification (non-live)

- Checked both manifest background paths (Chromium `service_worker`, Firefox `scripts`) and script order.
- Checked service-worker and event-page startup in sandboxed JavaScript mocks without contacting oauth endpoints.
- Checked RC drawer opens with navbar-height header and keeps iframe in remaining height.
- Chrome/Chromium and Firefox OAuth redirect compatibility has **not** been verified against osu! in a signed-in browser.
- Firefox/Zen, Opera, Brave, Vivaldi browser installation tests must still be performed before claiming those platforms are fully supported.

## RC3 Markdown regression results

Offline Chromium tests passed at 950, 500 and 370 px:

- Highlighter enabled by default, with a reversible on/off toggle.
- Bold, italic (`*`, `_`), strikethrough, Markdown link and image, inline code, quote, heading, and timestamp tokens detected.
- Normal typing preserved, and the source textarea remains the only editable field.
- Replacing the textarea to simulate React re-rendering leaves its native parent unchanged; the detached display layer is cleaned up.
- Drafts above 30,000 characters restore native text visibility; shortening the draft resumes highlighting.
- No uncaught browser errors in the isolated test fixture.

This does **not** prove that a live signed-in osu!web page cannot crash. When testing the release, focus on textarea selection/caret, resizing, pinned editor scrolling, React discussion-tab changes, Japanese IME composition, and Review/Reply navigation. The Review editor remains Slate-based and does not use this textarea highlighter.

---

# Verification — GitHub v1.1.0 release candidate

## Confirmed by source inspection

- The osu! API client requests 50 discussions per page and supports the returned `cursor_string`.
- The workspace can retrieve 50/100/250/500 records via multiple requests and still offers manual additional pages where available.
- Posted-from and posted-to inputs filter only retrieved records by `created_at`.
- The duplicated Draft Coach Post category selector has been removed. It reads the native editor's selected label when detectable; if none is exposed, the analysis uses the noncommittal `unspecified` setting.
- Native Review entries are multi-block and require a different helper UI from single-textarea discussion/reply editors.

## Offline Chromium fixture tests

- New Review active-block formatting tested with issue text selection, inline Markdown insertion, and automatic hiding when focus leaves. The context bar reserves space within the selected block rather than obscuring the following block. Paragraph controls are limited to the Slate-native bold/italic shortcuts.
- In-place Markdown highlighting tested with typed Markdown, link syntax, selection/caret preservation and responsive layouts.
- New Discussion toolbar regression tests passed at 950, 500 and 370 px, with the native toolbar and pin left in place.

**Unverified:** Live Slate paragraph formatting via the extension button and React rerender behaviour on a real signed-in Review page. Do not treat synthetic DOM tests as proof of that integration.


- A constructed native-style New Review view mounted Review tools exactly once, opened a Coach analysis of multiple blocks, displayed two link cards, and opened Settings using the correct action.
- An OAuth-mocked My Discussions response returned 50 items for the initial fetch. Selecting 100 loaded a second cursor page, and creation-date input filtered the retrieved rows.
- JavaScript syntax validation uses Node.js `node --check`.

Fixtures are deliberately simulated and do not establish successful authenticated live osu!web compatibility.

## Live QA before a public release

1. **Reviews:** open a signed-in beatmapset's Reviews tab, create several draft review blocks, confirm helper placement, and verify content updates without modifying Review's own Clear/Post actions.
2. **General/Timeline:** check Coach and preview layout on different difficulty pages, using actual osu! timestamps and Markdown links.
3. **Replies:** open an existing thread and verify paste/drop, preview, and Coach update without interrupting its native reply workflow.
4. **OAuth:** test connected/disconnected and expired-token states using an explicitly trusted proxy.
5. **History:** confirm 50 → 100 → 250 discussion retrieval on a real account, validate `cursor_string` behavior, and compare posted-date results against known posts.
6. **Images:** test osu! `/ss/`, s-ul.eu and direct image links, successful and failed uploads, clipboard paste and drag/drop.
7. **Responsive:** test at narrow widths and with the pinned editor to catch any overlapping controls.
8. **Security:** audit the inherited token-exchange Worker and extension permissions before encouraging broad OAuth adoption.

The release should be called fully verified only after these checks pass on the live site.


## v1.1.1 floating panel revision — offline checks

- Three Chromium mock layouts (950, 500, 370 px) with actual extension scripts/CSS, except URL-path guards replaced in the test harness because sandbox blocks custom page navigation.
- Native New Discussion element height stayed **219px before and after** opening Download, Draft Coach and Linked Attachments.
- Download, Coach, and Linked Attachments panels reported `position: fixed`; the first two were clamped to 532px height in a 760px viewport.
- Metadata inspector mounted once; no uncaught browser errors in the fixture.
- RC topic links corrected by checking publicly accessible osu! wiki pages.
- **Not verified:** live osu!web, signed-in browser, Firefox/Zen, actual network mirrors, native pinned scrolling, OAuth, uploader or downloading media from osu!.


### v1.1.1 review-4 local tests

The test scripts used mocked HTML structures and a Chromium fixture at **950 / 500 / 370px** (no network requests or live osu! auth).

- [x] Source inspector appears even with missing Source; modal opens and closes.
- [x] Markdown source preserves every character across bold, italic, link/image, code, quote, heading, strikethrough and timestamp samples.
- [x] Native input text restored when a dialog overlays the editor; highlight comes back when safe.
- [x] Mirror border-box geometry matches even when the native textarea is content-box with padding.
- [x] RC hides difficulty/tier selectors for Metadata and restores them for Current Difficulty; custom BASIC map 3.25★ gets a **suggested** Hard level (not RC-verified).
- [x] Non-mania HP/OD/CS/AR test values render for a selected difficulty.
- [x] Coach stays open across typing, scroll and outside click and closes explicitly.
- [x] Image gallery expands six attachments, then collapses.
- [x] Nearby-thread API mock provides bounded text excerpt and Open action.
- [x] Public BN badge appears when the authenticated user-lookup mock reports group `bng`.
- [ ] Live osu!web site, Firefox, real role metadata, remote URL media, authenticated discussion text and real React rerenders.
