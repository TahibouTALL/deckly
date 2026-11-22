// Update choice + update card (desktop app only; the web version skips all of this).
import { ic } from './assets.js';
import { modal, closeModal, toast } from './ui.js';
import { t as tr, translateDom } from './i18n.js';

const D = window.decklyDesktop;
let info = null, last = {}, dismissedFor = null;

export async function initUpdates() {
  if (!D) return;
  document.querySelectorAll('.desktop-only').forEach((n) => n.classList.remove('hidden'));
  info = await D.info();
  D.onEvent(onEvent);
  if (info.state) onEvent(info.state, true);
  if (!info.mode) setTimeout(askChoice, 900);          // first launch: ask once
  else D.check(false);
  // the moment the computer comes back online, look for a new version
  window.addEventListener('online', () => D.check(false));
}

// ---------- first-launch choice ----------
export function askChoice() {
  if (!D) return;
  const cur = info?.mode;
  modal(`<div class="upd-modal">
    <div class="upd-hero">${ic('refresh-cw')}</div>
    <h3>Keep Deckly up to date</h3>
    <p class="hint" style="font-size:13px">New versions bring new features and fixes. Deckly looks for them only when your computer is connected to the internet.</p>
    <button class="upd-opt ${cur !== 'manual' ? 'on' : ''}" data-mode="auto">
      <span class="upd-radio"></span>
      <span><b>Update automatically</b> <em class="upd-rec">Recommended</em><br><small>Updates download in the background and install the next time you close Deckly. You never lose your work.</small></span>
    </button>
    <button class="upd-opt ${cur === 'manual' ? 'on' : ''}" data-mode="manual">
      <span class="upd-radio"></span>
      <span><b>Ask me each time</b><br><small>Deckly tells you when a new version is out, and you choose when to install it.</small></span>
    </button>
    <p class="hint">You can change this any time with the Updates button on the home screen, or File → Update settings.</p>
    <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:6px"><button class="btn primary" data-save>${ic('check')} Confirm</button></div>
  </div>`);
  const card = document.querySelector('#modalCard');
  let mode = cur || 'auto';
  card.querySelectorAll('[data-mode]').forEach((b) => (b.onclick = () => {
    mode = b.dataset.mode; card.querySelectorAll('[data-mode]').forEach((x) => x.classList.toggle('on', x === b));
  }));
  card.querySelector('[data-save]').onclick = async () => {
    await D.setMode(mode); info.mode = mode; closeModal();
    toast(mode === 'auto' ? 'Automatic updates are on' : 'Deckly will ask you before each update');
  };
  // closing without choosing = ask again next launch (nothing is installed without a choice)
  document.querySelector('#modal').onclick = (e) => { if (e.target.id === 'modal') closeModal(); };
}

export function checkNow() {
  if (!D) return;
  toast('Looking for updates…');
  dismissedFor = null;
  D.check(true);
  last.manualCheck = true;
}

// ---------- update card ----------
function onEvent(s, silent = false) {
  const manual = last.manualCheck;
  last = s;
  const box = card();
  if (s.status === 'available' && info.mode !== 'auto') {
    if (dismissedFor === s.version) return;
    show(box, `${ic('sparkles')}<div class="upd-txt"><b>${tr('Deckly {v} is available', { v: s.version })}</b><small>We recommend installing it: it brings the latest improvements and fixes.</small></div>
      <button class="btn primary sm" data-u="download">${ic('download')} Update now</button><button class="upd-later" data-u="later">Later</button>`);
  } else if (s.status === 'downloading') {
    show(box, `${ic('loader')}<div class="upd-txt"><b>Downloading the update…</b><div class="upd-bar"><span style="width:${s.percent || 0}%"></span></div></div>`);
  } else if (s.status === 'ready') {
    show(box, `${ic('circle-check')}<div class="upd-txt"><b>${tr('Deckly {v} is ready', { v: s.version })}</b><small>${tr('Restart to finish. Your designs are saved.')} ${info.mode === 'auto' ? tr('Otherwise it installs when you close Deckly.') : ''}</small></div>
      <button class="btn primary sm" data-u="install">${ic('rotate-ccw')} Restart now</button><button class="upd-later" data-u="hide">Later</button>`);
  } else {
    box.classList.add('hidden');
    if (manual && !silent) {
      if (s.status === 'uptodate') toast(tr('You have the latest version ({v})', { v: info.version }));
      if (s.status === 'error') toast('Could not check for updates. Are you connected to the internet?');
      if (s.status === 'unavailable') toast('Updates work in the installed app');
    }
  }
}
function card() {
  let c = document.querySelector('#updCard');
  if (!c) {
    c = document.createElement('div'); c.id = 'updCard'; c.className = 'upd-card hidden'; document.body.appendChild(c);
    c.addEventListener('click', (e) => {
      const a = e.target.closest('[data-u]')?.dataset.u; if (!a) return;
      if (a === 'download') D.download();
      if (a === 'install') D.install();
      if (a === 'later') { dismissedFor = last.version; c.classList.add('hidden'); toast('Reminder: updating is recommended. File → Check for updates.'); }
      if (a === 'hide') c.classList.add('hidden');
    });
  }
  return c;
}
function show(box, html) { box.innerHTML = html; translateDom(box); box.classList.remove('hidden'); }
