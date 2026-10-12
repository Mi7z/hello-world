#!/usr/bin/env node
// Baut Hello World als reine Webseite ohne Server – für GitHub Pages (Web-App zum
// Installieren auf Android und iPhone) und für die Android-App.
// Stöbern, Suchen, Apps benutzen (auch ohne Internet), Designs und Versionen gehen;
// Neues bauen geht im Hello-World-Programm am PC.
//
//   node werkzeuge/statisch.js <zielordner> [--basis /hello-world/]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { APP_CSP } from '../pruefung.js';
import { SDK } from '../testlauf.js';
import * as baum from '../stammbaum.js';
import { ANBIETER } from '../freiki.js';

const wurzel = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const ziel = path.resolve(process.argv[2] || 'seite');
const basis = (process.argv.includes('--basis') ? process.argv[process.argv.indexOf('--basis') + 1] : '/').replace(/\/?$/, '/');
const APPS = path.join(wurzel, 'apps');
const PRAEFIX = { browser: 'app', server: 'server', skill: 'skill', mcp: 'mcp', design: 'design' };

fs.rmSync(ziel, { recursive: true, force: true });
fs.mkdirSync(ziel, { recursive: true });
const schreiben = (rel, inhalt) => { const p = path.join(ziel, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, inhalt); };
const json = (rel, d) => schreiben(`api/${rel}.json`, JSON.stringify(d));

// ---------- Katalog ----------
// Bewertungen sind persönlich und bleiben auf dem PC – hier wertet niemand
baum.einrichten({ apps: APPS, bewertungen: path.join(ziel, '.keine-bewertungen.json') });
const katalog = [];
for (const slug of fs.readdirSync(APPS).sort()) {
  try { katalog.push({ slug, ...JSON.parse(fs.readFileSync(path.join(APPS, slug, 'hello.json'), 'utf8')) }); } catch { /* kein Steckbrief */ }
}
const designCss = (slug) => { try { return fs.readFileSync(path.join(APPS, slug, 'design.css'), 'utf8'); } catch { return ''; } };
function farben(slug) {
  return (designCss(slug).match(/:root:root\s*\{[^}]*\}/g) || []).slice(0, 2).map((b) => Object.fromEntries(['bg', 'fl', 'tx', 'ak', 'ak2', 'li'].map((n) => [n, (b.match(new RegExp(`--${n}\\s*:\\s*(#[0-9a-fA-F]{3,8})`)) || [])[1] || null])));
}
const apps = katalog.map((a) => (a.typ === 'design' ? { ...a, farben: farben(a.slug) } : a));
json('apps', { apps, lokaleKi: false, csp: APP_CSP, basisCss: fs.readFileSync(path.join(wurzel, 'vorlage', 'basis.css'), 'utf8'), statisch: true });

for (const a of apps) {
  const ordner = path.join(APPS, a.slug);
  const namen = [a.slug, `${PRAEFIX[a.typ || 'browser']}.${a.slug}`, ...(a.aliase || [])];
  let readme = null;
  for (const n of ['README.md', 'SKILL.md']) { try { readme = fs.readFileSync(path.join(ordner, n), 'utf8'); break; } catch { /* nächste */ } }
  const b = baum.baumMitWertung(a.slug, null);
  for (const n of namen) {
    json(`app/${n}`, { app: a, readme, dateien: [] });
    if (b) json(`stammbaum/${n}`, { app: a, ...b });
  }
  // Dateien, die im Browser laufen bzw. gelesen werden (keine Server-Programme)
  for (const datei of ['index.html', 'design.css', 'README.md', 'SKILL.md']) {
    if (fs.existsSync(path.join(ordner, datei))) fs.cpSync(path.join(ordner, datei), path.join(ziel, 'apps', a.slug, datei));
  }
  if (fs.existsSync(path.join(ordner, 'versionen'))) fs.cpSync(path.join(ordner, 'versionen'), path.join(ziel, 'apps', a.slug, 'versionen'), { recursive: true });
  if (a.typ === 'design') {
    schreiben(`api/design/${a.slug}.css`, designCss(a.slug));
    for (const v of b?.versionen || []) {
      const vd = path.join(ordner, 'versionen', `${v.id}.css`);
      if (fs.existsSync(vd)) schreiben(`api/design/${a.slug}@${v.id}.css`, fs.readFileSync(vd));
    }
  }
}
json('ich', { person: null, sitzung: null, github: false, lokalErlaubt: false });
json('bau', { auftraege: [] });
json('helfer', { geraete: [] });
json('frei/anbieter', { anbieter: ANBIETER.map(({ id, name, konto }) => ({ id, name, konto })) });
schreiben('api/installieren.json', JSON.stringify(fs.readFileSync(path.join(wurzel, 'INSTALLIEREN.md'), 'utf8')));

// ---------- Oberfläche ----------
// Adressen anpassen: /a/<name> → app.html?e=<name>, /b/<name> → baum.html?e=<name>,
// und alles unter die Basis-Adresse (z. B. /hello-world/ bei GitHub Pages)
const ZIELE = '(?:api|apps|muster|style\\.css|kern\\.js|haupt\\.js|design\\.js|statisch\\.js|icon|manifest|sw\\.js|app\\.html|baum\\.html)';
function anpassen(text) {
  return text
    .replace(/(["'`])\/a\//g, '$1/app.html?e=')
    .replace(/(["'`])\/b\//g, '$1/baum.html?e=')
    .replace(new RegExp(`(["'\`])\\/(?=${ZIELE}|#)`, 'g'), `$1${basis}`)
    .replace(/url\(\//g, `url(${basis}`)
    .replace(/href=(["'])\/\1/g, `href=$1${basis}$1`);
}
for (const datei of fs.readdirSync(path.join(wurzel, 'public')).filter((d) => d !== 'koppeln.html')) {
  const quelle = path.join(wurzel, 'public', datei);
  if (/\.(html|js|css|webmanifest)$/.test(datei)) {
    let t = anpassen(fs.readFileSync(quelle, 'utf8'));
    if (datei.endsWith('.html')) {
      // Einstellungen für die Seite ohne Server – vor allen anderen Skripten laden
      t = t.replace(/<head>/i, `<head>\n<script src="${basis}statisch.js"></script>`);
      if (!/rel="manifest"/.test(t)) t = t.replace('</head>', `<link rel="manifest" href="${basis}manifest.webmanifest">\n</head>`);
    }
    schreiben(datei, t);
  } else fs.cpSync(quelle, path.join(ziel, datei), { recursive: true });
}

const STATISCH = { basis, csp: APP_CSP, sdk: SDK };
schreiben('statisch.js', `// Hello World ohne Server (GitHub Pages / Android-App)
window.HW_STATISCH = ${JSON.stringify(STATISCH)};
document.documentElement.classList.add('hw-statisch');
(() => {
  // Daten liegen als Dateien bereit: /api/apps → /api/apps.json. Ändern geht hier nicht.
  const echt = window.fetch.bind(window);
  window.fetch = (eingabe, opts = {}) => {
    const url = new URL(typeof eingabe === 'string' ? eingabe : eingabe.url, location.href);
    if (url.origin === location.origin && url.pathname.startsWith(HW_STATISCH.basis + 'api/')) {
      if ((opts.method || 'GET').toUpperCase() !== 'GET') {
        return Promise.resolve(new Response(JSON.stringify({ fehler: 'Das geht im Hello-World-Programm am PC.' }), { status: 503, headers: { 'Content-Type': 'application/json' } }));
      }
      if (!/\\.(json|css)$/.test(url.pathname)) url.pathname += '.json'; // Namen wie app.qrcode haben selbst einen Punkt
      url.search = '';
      return echt(url.href, { cache: 'no-cache' }).then(async (r) => (url.pathname.endsWith('installieren.json') && r.ok ? new Response(await r.json()) : r));
    }
    return echt(eingabe, opts);
  };
  if ('serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register(HW_STATISCH.basis + 'sw.js').catch(() => {}));
})();
`);

// Web-App: Symbol, Name, ohne Internet benutzbar
schreiben('manifest.webmanifest', JSON.stringify({
  name: 'Hello World', short_name: 'Hello World', description: 'Die freie App-Wolke',
  start_url: basis, scope: basis, display: 'standalone', background_color: '#f6f5f2', theme_color: '#3b5bdb',
  icons: [{ src: `${basis}icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any maskable' }, { src: `${basis}icon.svg`, sizes: 'any', type: 'image/svg+xml' }],
}, null, 2));
schreiben('sw.js', `// Offline: einmal geöffnete Seiten und Apps bleiben verfügbar (erst Netz, sonst Speicher)
const SPEICHER = 'hello-world-${Date.now()}';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((x) => x !== SPEICHER).map((x) => caches.delete(x)))).then(() => self.clients.claim())));
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(fetch(e.request).then((r) => { if (r.ok) { const k = r.clone(); caches.open(SPEICHER).then((c) => c.put(e.request, k)); } return r; })
    .catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('${basis}index.html'))));
});
`);
schreiben('.nojekyll', '');
fs.rmSync(path.join(ziel, '.keine-bewertungen.json'), { force: true });
console.log(`Hello World ohne Server gebaut: ${ziel} (Basis ${basis}, ${apps.length} Einträge)`);
