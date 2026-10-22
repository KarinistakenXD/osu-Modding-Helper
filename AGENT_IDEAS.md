# Draft Coach implementation status — v1.4.4

The **local Draft Coach** is now implemented. It reads only an intentionally imported draft from the native discussion textarea, keeps a separate editing copy, evaluates Where → Observation → Why → Impact → How and comparative/alternative cues, flags Markdown/BBCode formatting pitfalls, and provides relevant official RC lookup links. It is a rule-based reviewer, **not an LLM**. It does not fetch map/audio data, assert violations, write notes back, or post anything.

The human author is responsible for musical and technical judgement. The supplied *Road to BN* handbook is pedagogical and not official BN/NAT policy. Official RC requirements must be read live.

A future true RC-aware analytical model would need user-approved `.osu` import with parser/metadata checks, beatmapset comparisons, optional audio evaluation with explicit file transfer, and explicit opt-in to a model provider. Avoid generating hitobjects, hitsounds or timing; osu!'s current general RC requires direct human creation of those assets. Such a model must distinguish verifiable technical findings from subjective critique and never impersonate official NAT/BN judgements.

---

# Research notes: an optional osu! modding assistant

These are **proposals**, not implemented features in v1.4.3. This browser extension currently operates using the osu! API v2 scopes `public identify`, an OAuth flow provided by the existing extension, and local browser storage.

## What we can add without an LLM

1. **Conversation triage / mod queue** — retrieve discussions and posts, group by mapset/difficulty, sort by open/resolved status and last known activity. Identify activity changes by comparing persisted local checkpoints. Be honest that the API does not give the extension a dedicated Discord-style unread flag. User-initiated refresh and conservative polling are preferable to aggressive background polling.
2. **Follow-up digest** — summarise changes based on fetched first/reply/system posts: issue opened, mapper replied, issue resolved or reopened. Replies require querying individual discussions; paging and API rate limits need to be respected. Never label a generic update as *mapper replied* unless the actor can be established.
3. **Timestamp workspace** — extract `mm:ss:ms` timestamps from posts, group by beatmap difficulty, produce `osu://edit/` deep-links and clipboard-ready copies. Purely local; no new scopes required.
4. **RC bookmarks and contextual search** — show General RC and matching ruleset RC near the post editor. Support severity tags and links to the actual current RC wording. Flag possible rule conflicts only if a verifiable rule applies; guideline exceptions and musical judgment still require human evaluation.
5. **Duplicate-discussion warnings** — compare timestamp proximity and text overlap on the current mapset *on demand* before posting. Present similar threads with links and confidence explanations, not automatic rejection or mass posting.

## What could require separate AI / local analysis

6. **Modpost clarity assistant** — optionally review a draft for the concrete issue, musical rationale, likely significance, and actionable alternatives. Mark opinions as suggestions, never as official NAT rulings. Leave submission to the user; do not auto-post.
7. **Evidence-based mapper reply summarisation** — show a brief digest of *actual retrieved replies* with attribution and source links. Any generative model should require explicit user consent before draft text or account data is sent to a third-party AI service.
8. **Local beatmap parser** — if the user explicitly imports an `.osu` / `.osz` file, analyze note density, hitobject structures, mania lane use, LN tails, timing points and RC-checkable conditions. The public discussion API does **not** deliver all chart object data needed for this analysis. Music representation / playability cannot be verified from discussion text alone.

## Implementation constraints / non-goals

- API docs cover reading `GET /beatmapsets/discussions` and `GET /beatmapsets/discussions/posts` using `public`. They do not establish a normal write endpoint available to this extension for resolving or posting under this OAuth configuration. Let osu!web manage resolve, reply, edit, and staff controls.
- Current API documentation has a breaking change dated 2026-10-13: `current_user_attributes` is no longer present in read-only discussions responses. Do not rely on that property for vote/unread state.
- Rate guidance: do not exceed 60 requests/min; avoid per-minute-per-user polling, implement cache/backoff, scan only when appropriate.
- Need **no** staff access, account standing, privileged moderation UI, or token scope escalation for these proposals. A regular OAuth login grants identity, not an elevated osu! role.
- OAuth token exchange currently uses a third-party Cloudflare Worker inherited from the extension. This security model is not independently audited, and must be made clear before authorization.

Sources: https://osu.ppy.sh/docs/ ; https://osu.ppy.sh/wiki/en/Modding ; https://osu.ppy.sh/wiki/en/Ranking_criteria ; https://osu.ppy.sh/wiki/en/Rules/Code_of_conduct_for_modding_and_mapping ; https://osu.ppy.sh/wiki/en/Modding/Timestamp
