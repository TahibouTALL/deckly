# Deckly

A presentation editor (like PowerPoint) with a simple, drag-and-drop interface. It works **offline**: its whole library — 110,000 elements, fonts, photos, templates — is stored in the app. When you're online, it can also search the web for more. Claude Desktop / Claude Code can create and edit presentations through its connector.

Download page: https://tahiboutall.github.io/deckly/

## Start it

Double-click `start.bat`, or run:

```
node server.js
```

then open http://localhost:5179. You need Node.js 18 or newer. Nothing else to install.

## Desktop app (Windows)

```
npm install          # once
npm start            # run the desktop app
npm run icon         # redraw the logo, the app icon and the .dkly file icon (desktop/make-icon.mjs)
npm run dist         # build the installer -> dist/Deckly-Setup-<version>.exe
```

The installer adds Deckly to the Start menu and the desktop, registers `.dkly` files, and installs the Claude connector script next to the app (`resources/app.asar.unpacked/desktop/mcp.cjs`).

### Updates

On first launch, Deckly asks the person once:
- **Update automatically (recommended)**: when the computer is online, new versions download in the background and install when Deckly is closed (or right away with "Restart now").
- **Ask me each time**: a card says a new version is out and recommends installing it, with "Update now" / "Later".

Deckly checks at start-up, each time the computer comes back online, and every 4 hours. It never downloads anything before the person has chosen. They can change the choice or check by hand with the **Updates** button on the home screen, or File → Check for updates / Update settings.

**Releasing a new version** (updates come from GitHub Releases, set in `package.json` → `build.publish`):
1. Raise `version` in `package.json`; add the release to `tools/site/releases.json` (the download page shows the last three).
2. Run `npm run dist`, then `node tools/site/build-site.mjs` (it reads the installer's size and SHA-256 from `dist/`).
3. On GitHub, create a release named `v<version>` and attach the 3 files from `dist/`: `Deckly-Setup-<version>.exe`, its `.blockmap`, and `latest.yml`. Commit and push `docs/`.

Installed copies then find the update by themselves.

## Deckly for Claude (the connector)

File → **Connect Claude…** (desktop app). Deckly ships an MCP server (`desktop/mcp.cjs`, plain Node, no dependency) that Claude Desktop or Claude Code run on the person's computer:
- **Claude Desktop**: the Connect button adds `deckly` to `%APPDATA%\Claude\claude_desktop_config.json` (`command` = Deckly.exe in Node mode, `args` = the script). Restart Claude Desktop.
- **Claude Code**: `claude mcp add deckly -e ELECTRON_RUN_AS_NODE=1 -- "<Deckly.exe>" "<mcp.cjs>"` (the window shows the exact command to copy).

The server talks to the running app over a local port with a secret token (`%APPDATA%\Deckly\connector.json`), and starts Deckly when it is closed. Every tool is answered by the page (`app/js/connector.js`): list / create / open / delete presentations, add / replace / move / delete slides from a high-level slide spec (title, bullets, two columns, image + text, quote, stats, table, chart, section…), update texts and table rows, add elements, set notes / backgrounds / theme, search the built-in library (photos, 3D stickers, icons, graphics), screenshot a slide (returned as an image), export (pptx / pdf / png / dkly). Deckly itself calls no online service.

## Languages

The interface opens in **French**. People can switch to English (and back) with the **Langue / Language** button on the home screen, or Fichier → Langue. Translations live in `app/js/i18n.js` (+ `app/js/i18n-more.js` for the 1.3 features): the code uses English text, wrapped in `t('…')`, and the `FR` table gives the French. Static HTML and panels are translated automatically; French typography (non-breaking spaces before `? ! ; :` and inside « ») is applied by `t()`.

## What's inside

- **Home screen**: your designs first (folders, rename, duplicate, move), then a size (16:9, 4:3, square, story, A4) or one of 14 templates. Everything saves automatically on this computer (IndexedDB).
- **Editor**: drag, resize, rotate, smart guides, multi-select (Shift-click or a box), undo/redo, copy/cut/paste, copy/paste style (Ctrl+Alt+C/V), lock, group, layers, align/distribute, transparency, shadow, right-click menus, numeric position (X/Y/W/H/rotation), a Layers list, zoom under the cursor, keyboard shortcuts (Ctrl+/).
- **Elements** (one panel, Canva-style rows with "See all"): lines & shapes, tables, charts, illustrations, stickers, icons, frames, grids, mockups, flags, logos, QR codes, drawing. Search is bilingual (French → English keywords, Unicode CLDR French names for emoji) and crosses every category.
- **Text**: 147 fonts grouped by style (sans, serif, display, handwriting, mono, your own), sizes list, effects (shadow, lift, hollow, splice, echo, neon, outline, highlight), bullet lists, font pairings; text inside any shape (double-click it).
- **Tables**: editable cells (Tab / Enter), header row, banded rows, borders, presets, column/row add/remove, per-cell colours; exported as real PowerPoint tables.
- **Charts**: column, bar, line, area, pie, donut, drawn as SVG from your data (data editor, paste from Excel, palettes, legend / values / grid / smooth / stacked); exported as native PowerPoint charts.
- **Lines**: two draggable ends, caps (arrow, triangle, circle, square, bar, diamond), solid / dashed / dotted, straight / elbow / curved.
- **Photos**: library (CC0 / CC BY only; the older CC BY-SA ones stay as hidden "legacy" files so old designs keep their pictures), filters, frames (any shape, letters & numbers, devices, polaroid, film), focus, flip, background removal (offline AI).
- **Slides**: strip with right-click menu, slide grid (reorder, duplicate, hide, delete), hidden slides skipped in Present mode, speaker notes, presenter view (P), black screen (B), go to slide (number + Enter).
- **Export**: `.dkly` (recommended), PowerPoint, PDF standard / print, PNG, JPG, SVG; ×1 / ×2 / ×3 / 4K.
- **Online / Offline switch** (top-right pill): web photos from Wikimedia Commons (CC0 / CC BY) and web icons from Iconify (only sets whose licence allows commercial use); what you use is kept in your library so it keeps working offline.

### Animations (version 1.2)

26 entrance effects, exits, loops, text by line / word / letter, on-click steps, page animation, 10 transitions including Match & move. Engine: `app/js/anim.js`; panel: `app/js/animpanel.js`.

### The .dkly file

One self-contained presentation (`app/js/dkly.js`): a ZIP whose first entry is `mimetype` = `application/vnd.deckly.presentation` (the signature), then `deckly.json`, `document.json` and `media/` + `fonts/`. Every text inside a loaded file goes through `app/js/sanitize.js` (a few formatting tags, no attributes, no scripts), and the document through `normalizeDoc()` (`app/js/store.js`).

## Built-in library (`app/assets/`)

Built by `tools/build-assets.mjs` from npm packages (run `npm install` in `tools/` first). Every source is listed in `app/assets/credits-packs.json` and in the app (File → Credits & licences).

| Group | Packs | Count | Licences |
|---|---|---|---|
| Icons | Lucide, Tabler, Phosphor, Solar, Material Symbols (rounded), Fluent UI (24), MingCute, Hugeicons, Remix, Bootstrap, Iconoir, Heroicons, Carbon, Myna UI, TDesign, IconPark, Pixelarticons, Health Icons, Game Icons, Pinhead, Temaki, Maki, Weather Icons | ~60,000 | ISC / MIT / Apache 2.0 / CC0 / CC BY |
| Illustrations | with icons (17 styles), Fluent UI Color, Flat Color Icons, Glyphs Poly, IconPark colour, Marketeq, Streamline colour sets (plump, freehand, ultimate, kameleon, streamline), Meteocons | ~25,000 | MIT / Apache 2.0 / CC BY 4.0 |
| Stickers | Fluent Emoji (flat, vector), Fluent Emoji 3D-look (WebP pictures, `app/assets/stickers3d/`), Noto Emoji, Twemoji, Streamline Emojis, Firefox OS Emoji | ~9,000 | MIT / Apache 2.0 / CC BY 4.0 |
| Flags | Circle Flags, Flag Icons, Tabler Flags | ~1,000 | MIT |
| Logos | SVG Logos, theSVG Color, Simple Icons, Skill Icons, Devicon, Cryptocurrency Color | ~14,000 | CC0 / MIT (logos are their owners' trademarks) |
| Shapes | `app/js/shapes.js` (own drawings) | 223 | — |
| Fonts | Fontsource (147 families, 400 + 700) | 147 | SIL OFL / Apache / UFL |
| Photos | Wikimedia Commons (CC0 / CC BY, 1400 px) | see `photos.json` | per photo |
| Letter frames | Poppins Black glyph outlines (`app/assets/frames/glyphs.json`) | 45 | SIL OFL |

The packs load one by one when a style is opened (`app/js/library.js`); `packs/names.json` carries every name for the search and `packs/samples.json` 16 samples per pack for the preview rows.

### Refresh or grow the library

```
cd tools
npm install
node build-assets.mjs        # icons, graphics, stickers, flags, logos, fonts, letter frames, vendor libraries
node build-samples.mjs       # the preview rows
node build-emoji-fr.mjs      # French emoji keywords (tools/cldr/*.json from Unicode CLDR)
node build-stickers3d.mjs    # the 3D-look stickers as WebP (needs sharp, ~15 min)
node fetch-photos.mjs 18     # photos per category (only adds new ones; CC0 / CC BY)
node build-photos.mjs        # re-encodes the photos for the installer, keeps photos.json in sync
```

Add a pack: one line in the `PACKS` list of `tools/build-assets.mjs` (any `@iconify-json/*` set with an open licence). Add a font: `npm install @fontsource/<family>` in `tools/`, then rebuild.

## Code map

- `app/index.html`, `app/css/app.css`: layout and look (light top bar, tokens, focus styles)
- `app/js/store.js`: document model, undo/redo (snapshots keep pictures by reference), local saving, `normalizeDoc`
- `app/js/editor.js`: canvas, selection, drag/resize/rotate, guides, text / cell / shape-text editing, line ends, drawing, right-click menus, shortcuts
- `app/js/panels.js`: left panels (Design, Elements, Text, Photos, Uploads, Brand, Background, Animate) and web search
- `app/js/library.js`, `app/js/search.js`: pack loading, bilingual search
- `app/js/shapes.js`: the 223 shapes (+ text areas, frames)
- `app/js/elements/`: `line.js`, `table.js`, `chart.js`, `qr.js`, `draw.js`
- `app/js/toolbar.js`: the context bar above the slide
- `app/js/render.js`: drawing every element type (frames, devices, effects)
- `app/js/output.js`: present mode and exports (native PowerPoint tables / charts / lines)
- `app/js/connector.js`, `desktop/mcp.cjs`, `desktop/main.cjs`: the Claude connector
- `app/js/sanitize.js`: HTML / colour / font / source sanitising
- `app/js/templates.js`, `app/js/slides.js`, `app/js/pro.js`, `app/js/anim.js`, `app/js/animpanel.js`, `app/js/dkly.js`, `app/js/updates.js`, `app/js/bgremove.js`

## Ideas for next steps

- Code signing (so Windows SmartScreen / Smart App Control stop warning).
- Import `.pptx`.
- Video and audio elements.
- Dark mode of the editor.

## Download page

https://tahiboutall.github.io/deckly/ (GitHub Pages, served from `docs/`).

- Edit `tools/site/index.src.html` (`{{ic:name}}` = a Lucide icon; `{{version}}`, `{{size}}`, `{{sha256}}`, `{{releases}}` are filled by the build), run `node tools/site/build-site.mjs`, then commit and push `docs/`.
- Screenshots are in `docs/img/` (taken from the desktop app with the `DECKLY_SMOKE` hooks of `desktop/main.cjs`, 1600 × 900).
