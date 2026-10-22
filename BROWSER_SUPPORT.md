# Browser compatibility — v1.1.0 RC4

| Browser | Package format | Local extension load | osu! OAuth |
|---|---|---|---|
| Chrome, Edge, Opera, Brave, Vivaldi (recent Chromium) | same unpacked folder | intended; test on each | Chromium client redirect must match its actual extension ID; unverified outside existing Chrome use |
| Firefox / Zen (Firefox 121+) | same unpacked folder via about:debugging | MV3 background event-page path implemented; actual install unverified | **Not guaranteed**: Gecko redirect URL must be registered at osu! OAuth app |
| Safari | not targeted | no compatibility claim | not supported/tested |

Mozilla's documented dual-MV3 manifest selects `background.service_worker` in Chromium and `background.scripts` in Firefox. This package supplies both; Firefox preloads dependencies in order, while Chromium's worker imports them.

Firefox temporary installation: `about:debugging` → This Firefox → Load Temporary Add-on → choose manifest.json. This persists only for the session. Permanent distribution requires Mozilla signing and privacy/collection declarations.

Privacy: OAuth token exchange routes through the inherited third-party Cloudflare Worker and remains unaudited. The extension does not grant staff powers. The Firefox `gecko.id` in the manifest is a development identity; decide on the permanent ID before submitting to AMO, as changing it changes Firefox's generated OAuth redirect URI.

Live checklist: inspect background errors; open popup and Settings; load osu! discussion page; open RC drawer, close/reopen and switch difficulties; test editor, Coach, markdown highlight off/on; paste image (opt-in s-ul.eu); test signed-in osu! OAuth only after redirect URI is registered and proxy is trusted.
