# Deckly

A presentation editor (like PowerPoint) with a simple, drag-and-drop interface. It works **offline**: all its elements are stored in the app. When you're online, it can also search the web for more.

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
npm run dist         # build the installer -> dist/Deckly-Setup-<version>.exe
```

The installer adds Deckly to the Start menu and the desktop, like any program. Designs are saved inside the app (they are separate from the browser version's designs: move them with File → Save as file / Open file).

### Updates

On first launch, Deckly asks the person once:
- **Update automatically (recommended)**: when the computer is online, new versions download in the background and install when Deckly is closed (or right away with "Restart now").
- **Ask me each time**: a card says a new version is out and recommends installing it, with "Update now" / "Later". "Later" hides it until the next version or the next manual check.

Deckly checks at start-up, each time the computer comes back online, and every 4 hours. It never downloads anything before the person has chosen. They can change the choice or check by hand with the **Updates** button on the home screen, or File → Check for updates / Update settings.

**Releasing a new version** (updates come from GitHub Releases, set in `package.json` → `build.publish`):
1. Raise `version` in `package.json` (for example 1.0.0 → 1.1.0).
2. Run `npm run dist`.
3. On GitHub, create a release named `v1.1.0` in the repository set in `build.publish`, and attach the 3 files from `dist/`: `Deckly-Setup-1.1.0.exe`, its `.blockmap`, and `latest.yml`. The repository must be public, or the app cannot download the update.
   (Or let the build publish it: `set GH_TOKEN=<token>` then `npx electron-builder --win nsis --publish always`.)

Installed copies then find the update by themselves.

## Languages

The interface opens in **French**. People can switch to English (and back) with the **Langue / Language** button on the home screen, or Fichier → Langue. Translations live in `app/js/i18n.js`: the code uses English text, wrapped in `t('…')`, and the `FR` table gives the French. Static HTML and panels are translated automatically.

## What's inside

- **Home screen**: pick a size (16:9, 4:3, square, story, A4) or one of 8 templates. Your designs are listed, and they save automatically on this computer (IndexedDB).
- **Editor**: drag, resize, rotate, smart alignment guides, multi-select (Shift-click or drag a box), undo/redo, copy/paste, lock, layers, align/distribute, transparency, shadow.
- **Text**: font picker (16 offline fonts), size, colour, bold/italic/underline, alignment, spacing, effects (shadow, outline, highlight), font pairings.
- **Elements**: 30 shapes and lines, photo frames (drop a photo into a frame), charts, timelines, tables.
- **Slides**: thumbnail strip, add/duplicate/delete, drag to reorder, slide layouts.
- **Present**: full screen, arrow keys / click to move between slides.
- **Download**: PowerPoint `.pptx` (text stays editable), PDF, PNG, and `.deckly` project files.
- **Online / Offline switch** (top-right pill): when it's on and you're online, searching Photos also searches Wikimedia Commons and searching Icons also searches Iconify. Web photos you use are downloaded into the design and your library, so they keep working offline.

### "Pro" features (paid in other tools, free here)

- **Brand kit** (Marque tab): brand colours (also shown first in every colour picker), heading/body fonts applied to a whole design in one click, brand logos.
- **Magic resize** (File menu): change a design's format (square post, story, YouTube thumbnail, A4…). Every element is scaled and re-centred, as a copy or in place.
- **Background remover** (photo toolbar): fully offline AI (U²-Net `u2netp`, Apache-2.0, run with ONNX Runtime Web, MIT). "Restore original" brings the photo back.
- **Animations** (Animate button) and **slide transitions** (Transition button, nothing selected), played in Present mode.
- **Transparent PNG** export.
- **Version history** (File menu): a copy every 5 minutes of editing, the last 30 kept, restore in one click.
- **Your own fonts**: Text tab → "+ Upload a font" (.ttf, .otf, .woff, .woff2).
- **Several brand kits** (one per client or project), switched from the Marque tab.
- **High-resolution download** (Download button): PNG, JPG, PDF standard / print, PowerPoint, SVG; ×1, ×2, ×3 or 4K; one slide or all (several images come as a .zip).
- **My templates**: File → Save as my template; they appear first in Design and on the home screen.
- **Folders** on the home screen; each design card has a "move to folder" button.
- **Group / ungroup** (Ctrl+G / Ctrl+Shift+G); a second click picks one piece of a group.
- **Speaker notes** (Notes button under the slide) and **presenter view** in Present mode (P): notes, timer, next slide. Notes also go into the PowerPoint export.
- **14 templates** (6 new: business plan, quarterly results, roadmap, workshop, event, restaurant menu).

### Animations (version 1.2)

- **Animate panel** (Animer in the rail, or the Animate button): 26 entrance effects (Rise, Pan, Fade, Pop, Wipe, Blur, Breathe, Baseline, Drift, Tectonic, Tumble, Neon, Scrapbook, Stomp, Bounce, Roll, Skate, Spread, Burst, Clarify, Block, Ascend, Shift, Merge, Typewriter, Photo zoom/flow), with direction, speed, delay, and text by line / word / letter.
- **On click** steps (like PowerPoint builds), **exit** animations, **loop** effects (Breathe, Pulse, Wiggle, Float, Spin, Flicker).
- **Page animation** (one effect for every element, one after another) and **10 transitions**, including **Match & move**: duplicate a slide, move things on the copy, and they glide between the two slides.
- Engine: `app/js/anim.js` (Web Animations API); panel: `app/js/animpanel.js`.

### The .dkly file

One self-contained presentation (`app/js/dkly.js`): a ZIP package whose first entry is `mimetype` = `application/vnd.deckly.presentation` (the signature), then `deckly.json` (manifest), `document.json` (slides, animations, notes) and `media/` + `fonts/` (every picture and custom font used). File → *Save as a Deckly file* or *Save as a slideshow* (opens straight in Present mode). The installer registers `.dkly` with Windows: a double-click opens it in Deckly. Old `.deckly` files still open.

## Built-in library (`app/assets/`)

| Pack | Count | Licence |
|---|---|---|
| Lucide line icons | 2,410 | ISC |
| Fluent Emoji stickers (Microsoft) | 1,591 | MIT |
| Brand logos (gilbarbara/logos) | 2,305 | CC0 (logos are their owners' trademarks) |
| Fonts via Fontsource | 16 | SIL OFL 1.1 |
| Photos from Wikimedia Commons | 160 | CC0 / PD / CC BY / CC BY-SA: see `app/assets/photos/CREDITS.md` |

### Refresh or grow the library

```
cd tools
npm install
node build-assets.mjs        # icons, stickers, logos, fonts, libraries
node fetch-photos.mjs 20     # 20 photos per category (only adds new ones)
```

Edit the `cats` list in `tools/fetch-photos.mjs` to add photo categories, or the `fonts` list in `tools/build-assets.mjs` to add fonts (any `@fontsource/*` package).

## Code map

- `app/index.html`, `app/css/app.css`: layout and look
- `app/js/store.js`: document model, undo/redo, local saving
- `app/js/editor.js`: canvas, selection, drag/resize/rotate, guides, text editing, shortcuts
- `app/js/panels.js`: left panels (templates, elements, text, photos, icons, stickers, logos, uploads, background) and web search
- `app/js/toolbar.js`: the context bar above the slide
- `app/js/slides.js`: slide strip
- `app/js/output.js`: present mode and downloads
- `app/js/templates.js`: templates and slide layouts
- `app/js/render.js`, `app/js/assets.js`: drawing elements and shapes, packs, colours

## Ideas for next steps

- Package it as a desktop app (Electron or Tauri) so it installs like PowerPoint.
- Slide transitions and element animations.
- Import `.pptx`.
- More templates, and illustration packs.

## Download page

https://tahiboutall.github.io/deckly/ (GitHub Pages, served from `docs/`).

- The buttons always point to the newest `.exe` of the latest GitHub release (the page asks GitHub when it opens), so a new release needs no page change.
- To change the page: edit `tools/site/index.src.html` (`{{ic:name}}` = a Lucide icon), run `node tools/site/build-site.mjs`, then commit and push `docs/`.
- Screenshots are in `docs/img/`.
