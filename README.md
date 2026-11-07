<div align="center">
  <img src="icons/icon-128.png" width="92" height="92" alt="osu! Modding Helper icon">
  <h1>osu! Modding Helper</h1>
  <p>Extra tools for beatmap discussions and modding on osu!web.</p>
  <p>
    <a href="https://github.com/KarinistakenXD/osu-Modding-Helper/releases">Releases</a> ·
    <a href="#screenshots">Screenshots</a> ·
    <a href="#installation">Installation</a> ·
    <a href="https://github.com/KarinistakenXD/osu-Modding-Helper/issues">Issues & suggestions</a>
  </p>
</div>

> [!NOTE]
> This is an unofficial extension, not a project of the osu! team, BN, or NAT.

## About

I made **osu! Modding Helper** to make the small, repetitive parts of modding on osu!web easier. It adds shortcuts and useful information to beatmap pages, so you don't have to keep switching tabs just to check the Ranking Criteria, copy metadata, or look back through your discussions.

The extension works alongside osu!web's existing editors. Most page tools don't need an account connection; personal discussion history and activity do.

## Features

- **Discussion editor:** Formatting previews, clickable links and timestamps, attachment previews, and image uploads. Posting is blocked while an upload is still running.
- **Recent Discussions:** Find your modposts, filter them by type or status, view replies, and mark updates as read or unread.
- **Modding Activity:** Browse kudosu history, recent modding events, and (for supported usergroups) nominated beatmapsets.
- **Review image uploads:** Upload images, preview them, and copy the Markdown into osu!web's Review editor.
- **Ranking Criteria:** Keep relevant RC rules and guidelines open beside the beatmap you're checking.
- **Metadata and downloads:** Copy Source, Genre/Language, or Tags; export metadata; and access additional download options, including osu!direct.
- **Settings:** Choose which tools to enable, configure an image host, and optionally connect your osu! account.

## Screenshots

*Screenshots show the v1.1.3 interface.*

### Recent Discussions

A place to find your previous modposts and catch up on replies without searching through individual beatmap pages. Read/unread markers are saved locally and don't affect osu!'s notifications.

<img src="docs/screenshots/recent-discussions.png" width="900" alt="Recent Discussions workspace">

### Modding Activity

Kudosu and modding events are kept in separate lists. The nomination section is available for supported mapping-staff usergroups.

<details>
  <summary><b>Kudosu history</b></summary>
  <p><img src="docs/screenshots/kudosu-history.png" width="900" alt="Kudosu history with beatmap artwork"></p>
</details>

<details>
  <summary><b>Recent events</b></summary>
  <p><img src="docs/screenshots/modding-events.png" width="900" alt="Recent modding events"></p>
</details>

### Review image uploader

Open **Image uploads** above the Review editor to upload images and copy their Markdown. You still paste the result into the Review yourself; the extension doesn't change how osu!web's Review editor works.

<img src="docs/screenshots/review-uploader.png" width="800" alt="Review image uploader and Markdown reference">

### Discussion editor and Ranking Criteria

The normal discussion editor has formatting previews and linked attachment cards. You can also open the Ranking Criteria panel without leaving the beatmap page.

<details>
  <summary><b>Discussion editor</b></summary>
  <p><img src="docs/screenshots/discussion-editor.png" width="810" alt="Discussion editor and attachment previews"></p>
</details>

<details>
  <summary><b>Ranking Criteria panel</b></summary>
  <p><img src="docs/screenshots/ranking-criteria.png" width="390" alt="Ranking Criteria side panel"></p>
</details>

### Settings

Choose the features you want and set up your upload service under **Integrations**. If you connect an osu! account, you'll also see its profile information in the extension.

<details>
  <summary><b>Account settings</b></summary>
  <p><img src="docs/screenshots/settings-account.png" width="800" alt="Settings and connected osu! account"></p>
</details>

<details>
  <summary><b>Upload providers</b></summary>
  <p><img src="docs/screenshots/settings-uploads.png" width="800" alt="Settings for s-ul.eu, Catbox, ImgBB and Litterbox"></p>
</details>

## Installation

The extension is available as a ZIP for manual installation.

1. Download a ZIP from [Releases](https://github.com/KarinistakenXD/osu-Modding-Helper/releases) and extract it.
2. Open `chrome://extensions` in Chrome or another Chromium-based browser.
3. Enable **Developer mode** and click **Load unpacked**.
4. Select the extracted folder containing `manifest.json`.
5. Open or refresh an osu! beatmapset page.

If you have an older copy installed separately, disable it first to avoid duplicate controls. Chromium-based browsers are the main target; support elsewhere may vary.

## A few things to know

**Discussion and Review uploads are different.** In normal discussions, uploaded image links are added to the draft. In Reviews, the extension gives you Markdown to copy and paste. It doesn't directly edit osu!web's Review content. Auto-copy is optional, and may replace what's currently on your clipboard.

**osu!direct** uses an `osu://` link to open the beatmapset in an installed osu! client. It may require osu!supporter and a compatible client.

**Connecting your osu! account is optional.** Personal history needs a connection, but the public page tools still work without it. OAuth token exchange uses a third-party Cloudflare Worker, **not an osu!-operated service**. You can review the connection details in **Settings → Integrations**. Never enter your osu! password into the extension.

**Uploads use third-party hosts.** s-ul.eu, Catbox, ImgBB and Litterbox have their own limits and availability. Uploaded files may be public, and Litterbox links expire. If a link is important for a mod, open it once before posting to make sure it works.

**Activity history has limits.** Read markers only exist in your browser, and the API history isn't a complete record of staff actions. The extension doesn't provide moderation or nomination privileges.

## Troubleshooting

If the tools don't appear, check that the extension is enabled and refresh the beatmap page. If you see duplicate buttons, disable any older installations.

If uploads fail or get stuck, check the selected host, its credentials, and the file size. An upload can finish while the returned image link is still unavailable, so try opening the URL directly.

For bugs or feature requests, [open an issue on GitHub](https://github.com/KarinistakenXD/osu-Modding-Helper/issues). Include the browser and extension version, what you did, and what happened. Screenshots or console errors help too—just don't post API keys or OAuth tokens.

## License

[GNU Affero General Public License v3.0](LICENCE).
