// Hello World – lokaler Prototyp. Node ohne Framework.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { pruefeApp, pruefeDesign, slugVon, APP_CSP, werkzeugErklaerungAus } from './pruefung.js';
import { werkzeugAusfuehren } from './werkzeuge.js';
import { claudeFragen, gefundeneProgramme, KI_PROGRAMME } from './ki.js';
import * as bau from './bauauftrag.js';
import * as baum from './stammbaum.js';
import * as anmeldung from './anmeldung.js';
import * as geraete from './geraete.js';
import * as suchtexte from './beschreibung.js';
import * as appki from './appki.js';
import * as gespraech from './gespraech.js';
import { BAUSTEINE, AKTIONEN, WERTE, TAGS } from './bausteine.js';
import * as zugang from './zugang.js';
import { ANBIETER } from './freiki.js';
import { FAEHIGKEITEN } from './faehigkeiten.js';
import { MELDER, CHROME, SDK, SDK_PROBE, einsetzen } from './testlauf.js';
import { githubSuchen, githubDetails, npmInfo, lizenzErlaubt, ERLAUBTE_LIZENZEN } from './github.js';

const hier = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8810);
const OEFFENTLICH = path.join(hier, 'public');
const APPS = process.env.HW_APPS || path.join(hier, 'apps'); // im Programm: Ordner des Nutzers
const DATEN = process.env.HW_DATEN || path.join(hier, 'daten');

// Jede App hat ihren eigenen Steckbrief apps/<slug>/hello.json (keine gemeinsame
// Liste, damit sich Beiträge verschiedener Leute/KIs nicht in die Quere kommen).
function katalogLaden() {
  const liste = [];
  for (const slug of fs.readdirSync(APPS)) {
    try {
      const m = JSON.parse(fs.readFileSync(path.join(APPS, slug, 'hello.json'), 'utf8'));
      liste.push({ slug, ...m });
    } catch { /* kein gültiger Steckbrief – wird von der Prüfung gemeldet */ }
  }
  return liste;
}
function steckbriefSpeichern(eintrag) {
  const { slug, ...rest } = eintrag;
  const datei = path.join(APPS, slug, 'hello.json');
  fs.writeFileSync(datei + '.tmp', JSON.stringify(rest, null, 2) + '\n');
  fs.renameSync(datei + '.tmp', datei);
}

// ---------- „Claude auf diesem PC" (nur aus dem Heimnetz) ----------
// Erlaubt nur Anfragen vom PC selbst, aus dem WLAN (192.168.x) und aus Tailscale (100.x).
function ausHeimnetz(req) {
  // Programm/Server-Installation: nur der Rechner selbst und gekoppelte Geräte
  if (zugang.AN) return zugang.istRechner(req) || Boolean(zugang.geraet(req));
  const ip = (req.socket.remoteAddress || '').replace('::ffff:', '');
  return ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('100.');
}

// ---------- Designs ----------
// CSS eines Designs (beste Distribution oder bestimmte Version); Standard: design.klar
function designCss(name, version) {
  [name, version = version] = String(name || 'terminal').split('@'); // „klar@v2" = bestimmte Version
  const slug = aufloesen(String(name || 'terminal')) || 'terminal';
  const e = katalogLaden().find((a) => a.slug === slug && a.typ === 'design') || katalogLaden().find((a) => a.slug === 'terminal');
  if (!e) return '';
  const datei = version && /^v\d+$/.test(version) ? baum.versionsDatei(e.slug, version) : path.join(APPS, e.slug, 'design.css');
  try { return fs.readFileSync(datei, 'utf8'); } catch { return ''; }
}
// Die wichtigsten Farben eines Designs (für die Farbmuster auf den Kärtchen), hell und ggf. dunkel
function designFarben(slug) {
  const css = designCss(slug);
  return (css.match(/:root:root\s*\{[^}]*\}/g) || []).slice(0, 2).map((block) => {
    const f = {};
    for (const n of ['bg', 'fl', 'tx', 'ak', 'ak2', 'li']) f[n] = (block.match(new RegExp(`--${n}\\s*:\\s*(#[0-9a-fA-F]{3,8})`)) || [])[1] || null;
    return f;
  });
}
// Design ans Ende von <head> setzen (die Bausteine stehen in :root:root und gewinnen daher)
function mitDesign(html, css) {
  const block = `<style id="hw-design">${css.replace(/<\/style/gi, '')}</style>`;
  return /<\/head>/i.test(html) ? html.replace(/<\/head>/i, block + '</head>') : block + html;
}

// Nutzt die App die eigene KI des Nutzers? Dann steht es im Steckbrief (für Anzeige und Suche)
function eigeneKiEintragen(eintrag, html) {
  if (eintrag.typ === 'design') return;
  const { erklaerung } = appki.kiErklaerungAus(html);
  if (erklaerung) eintrag.eigeneKi = { zweck: erklaerung.zweck, aufgaben: Object.keys(erklaerung.aufgaben) };
  else delete eintrag.eigeneKi;
  // Werkzeuge für KIs (Kurzfassung im Steckbrief, für Suche und Anzeige)
  const wz = werkzeugErklaerungAus(html).erklaerung;
  if (wz) eintrag.werkzeuge = Object.entries(wz).map(([name, w]) => ({ name, beschreibung: w.beschreibung }));
  else delete eintrag.werkzeuge;
}
// HTML einer App (beste Distribution oder bestimmte Version)
function appHtml(slug, version) {
  try { return fs.readFileSync(version && /^v\d+$/.test(version) ? baum.versionsDatei(slug, version) : path.join(APPS, slug, 'index.html'), 'utf8'); } catch { return null; }
}

// Alte Kurznamen (z. B. nach dem Zusammenlegen) auf die aktuelle App umleiten
function aufloesen(slug) {
  slug = String(slug).replace(/^(app|server|skill|mcp|design)\./, ''); // „app.paintboard" → „paintboard"
  const k = katalogLaden();
  if (k.some((a) => a.slug === slug)) return slug;
  return k.find((a) => (a.aliase || []).includes(slug))?.slug || null;
}

// Laufende KI-Aufträge (werden nach 30 Minuten vergessen)
const auftraege = new Map();
setInterval(() => { for (const [id, a] of auftraege) if (Date.now() - a.seit > 30 * 60e3) auftraege.delete(id); }, 60e3);

// Veröffentlichen bzw. Erweitern – genutzt vom HTTP-Endpunkt und von Bau-Aufträgen
async function veroeffentlichenIntern(daten) {
    const { html, titel, name, beschreibung, tags, anfrage, ki, kategorie, funktionen, ziel, quelle, quellen, autor, basis } = daten;
    const faehigkeitenSauber = [...new Set((Array.isArray(daten.faehigkeiten) ? daten.faehigkeiten : []).filter((f) => FAEHIGKEITEN[f]))];
    if (!autor?.login) { const x = { fehler: 'Bitte zuerst mit GitHub anmelden – dein Name wird als Ersteller eingetragen.' }; throw Object.assign(new Error(x.fehler), { status: 401, extra: x }); }
    const body_quellen = (x) => x;
    // Genutzte Open-Source-Projekte: nur freie Lizenzen, sichtbare Quellenangabe
    const quellenListe = [...(Array.isArray(body_quellen(quellen)) ? quellen : []), ...(quelle && quelle.repo ? [quelle] : [])];
    const quellenSauber = [];
    for (const q of quellenListe) {
      if (!q || !q.lizenz) continue;
      if (!lizenzErlaubt(q.lizenz)) { const x = { fehler: `Die Lizenz „${q.lizenz}"${q.repo ? ` von ${q.repo}` : ''} ist für Hello World nicht freigegeben.` }; throw Object.assign(new Error(x.fehler), { status: 400, extra: x }); }
      if (q.repo && !String(html).includes(`github.com/${q.repo}`)) { const x = { fehler: `Die App muss ${q.repo} sichtbar nennen (Link).` }; throw Object.assign(new Error(x.fehler), { status: 400, extra: x }); }
      if (q.repo && !quellenSauber.some((x) => x.repo === q.repo)) quellenSauber.push({ repo: String(q.repo).slice(0, 120), url: `https://github.com/${q.repo}`, lizenz: String(q.lizenz).slice(0, 60), autor: String(q.autor || '').slice(0, 60), ...(q.paket ? { paket: String(q.paket).slice(0, 80) } : {}) });
    }
    const istDesign = daten.typ === 'design' || (ziel && katalogLaden().find((a) => a.slug === ziel)?.typ === 'design');
    const pruefung = istDesign ? pruefeDesign(html) : pruefeApp(html); // erneut auf dem Server prüfen
    if (!pruefung.ok) { const x = { fehler: 'Die App hat die Prüfung nicht bestanden.', pruefung }; throw Object.assign(new Error(x.fehler), { status: 400, extra: x }); }
    const katalog = katalogLaden();
    const liste = (x, n, len) => (Array.isArray(x) ? x : []).map((t) => String(t).slice(0, len)).filter(Boolean).slice(0, n);

    if (ziel) {
      // Vorhandene App weiterentwickeln: neuer Zweig im Stammbaum, nichts wird überschrieben
      const eintrag = katalog.find((a) => a.slug === ziel);
      if (!eintrag) { const x = { fehler: 'Die App, die erweitert werden soll, gibt es nicht.' }; throw Object.assign(new Error(x.fehler), { status: 404, extra: x }); }
      if (!['browser', 'design'].includes(eintrag.typ || 'browser')) { const x = { fehler: 'Dieser Eintrag wird direkt im Repository weiterentwickelt.' }; throw Object.assign(new Error(x.fehler), { status: 400, extra: x }); }
      const stand = baum.baumMitWertung(ziel);
      const eltern = basis && stand?.versionen.some((v) => v.id === basis) ? basis : stand?.standard || null;
      const neueVersion = baum.versionAnlegen(ziel, { eltern, autor, aenderung: liste(funktionen, 1, 300)[0] || anfrage, html });
      if (titel && String(titel).trim().length >= 3) eintrag.titel = String(titel).slice(0, 80);
      if (beschreibung) eintrag.beschreibung = String(beschreibung).slice(0, 300);
      eintrag.funktionen = [...new Set([...(eintrag.funktionen || []), ...liste(funktionen, 20, 120)])];
      if (faehigkeitenSauber.length) eintrag.faehigkeiten = [...new Set([...(eintrag.faehigkeiten || []), ...faehigkeitenSauber])];
      eintrag.tags = [...new Set([...(eintrag.tags || []), ...liste(tags, 12, 30).map((t) => t.toLowerCase())])].slice(0, 40);
      eintrag.version = baum.baumLaden(ziel).versionen.length;
      eintrag.verlauf = [...(eintrag.verlauf || []), { zeit: new Date().toISOString(), anfrage: String(anfrage || '').slice(0, 300), ki: String(ki || '').slice(0, 40), version: neueVersion, autor: autor.login }];
      eintrag.hinweise = pruefung.hinweise;
      if (quellenSauber.length) eintrag.quellen = [...(eintrag.quellen || []).filter((q) => !quellenSauber.some((n) => n.repo === q.repo)), ...quellenSauber];
      eigeneKiEintragen(eintrag, html);
      steckbriefSpeichern(eintrag);
      suchtexte.vormerken(ziel);
      return { app: eintrag, erweitert: true, version: neueVersion };
    }

    if (!titel || String(titel).trim().length < 3) { const x = { fehler: 'Titel fehlt' }; throw Object.assign(new Error(x.fehler), { status: 400, extra: x }); }
    // Englischer Name, z. B. „paintboard" → angezeigt als app.paintboard
    const basisName = (String(name || '').toLowerCase().replace(/[^a-z0-9]/g, '') || slugVon(titel).replace(/-/g, '')).replace(/^[0-9]+/, '').slice(0, 22) || 'app';
    let slug = basisName;
    for (let i = 2; katalog.some((a) => a.slug === slug || (a.aliase || []).includes(slug)); i++) slug = `${basisName}${i}`;
    // (Designs und Apps teilen sich die Namen – keine Doppelten)
    fs.mkdirSync(path.join(APPS, slug), { recursive: true });
    fs.writeFileSync(path.join(APPS, slug, istDesign ? 'design.css' : 'index.html'), html);
    const eintrag = {
      slug,
      titel: String(titel).slice(0, 80),
      beschreibung: String(beschreibung || '').slice(0, 300),
      kategorie: String(kategorie || 'werkzeug').toLowerCase().slice(0, 30),
      funktionen: liste(funktionen, 20, 120),
      tags: liste(tags, 12, 30).map((t) => t.toLowerCase()),
      anfrage: String(anfrage || '').slice(0, 300),
      ki: String(ki || '').slice(0, 40),
      erstellt: new Date().toISOString(),
      version: 1,
      typ: istDesign ? 'design' : 'browser',
      hinweise: pruefung.hinweise,
      ...(daten.symbol ? { symbol: String(daten.symbol).slice(0, 4) } : {}),
      ...(quellenSauber.length ? { quellen: quellenSauber } : {}),
      autor: { login: autor.login, name: autor.name || autor.login },
      ...(faehigkeitenSauber.length ? { faehigkeiten: faehigkeitenSauber } : {}),
    };
    eigeneKiEintragen(eintrag, html);
    steckbriefSpeichern(eintrag);
    baum.versionAnlegen(slug, { eltern: null, autor, aenderung: `erste Version: ${String(anfrage || titel).replace(/\s+/g, ' ').slice(0, 140)}`, html });
    suchtexte.vormerken(slug);
    return { app: eintrag, version: 'v1' };
  }

// ---------- HTTP ----------
const TYPEN = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };

function json(res, status, daten) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(daten));
}
function body(req, max = 600_000) {
  return new Promise((resolve, reject) => {
    let d = '';
    req.on('data', (c) => { d += c; if (d.length > max) req.destroy(); });
    req.on('end', () => { try { resolve(d ? JSON.parse(d) : {}); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  try {
    // ---------- Handy-Zugang: ohne Kopplung nur die Kopplungsseite ----------
    if (!zugang.erlaubt(req) && !zugang.ohneKopplung(url.pathname)) {
      if (url.pathname.startsWith('/api/')) return json(res, 401, { fehler: 'Dieses Gerät ist nicht gekoppelt.', koppeln: true });
      res.writeHead(302, { Location: '/koppeln' });
      return res.end();
    }
    if (url.pathname === '/api/koppeln' && req.method === 'POST') {
      const r = zugang.koppeln(req, await body(req));
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Set-Cookie': r.keks, 'Cache-Control': 'no-store' });
      return res.end(JSON.stringify({ ok: true }));
    }
    if (url.pathname === '/api/zugang' && req.method === 'GET') {
      return json(res, 200, {
        an: zugang.AN, offen: zugang.offen(), port: PORT, rechner: zugang.istRechner(req),
        adressen: zugang.AN ? await zugang.adressen(PORT) : [], tailscale: zugang.tailscaleInstalliert(),
        geraete: zugang.AN ? zugang.liste() : [],
      });
    }
    if (url.pathname.startsWith('/api/zugang/') && req.method === 'POST') {
      if (!zugang.AN) return json(res, 400, { fehler: 'Handy-Zugang gibt es im Programm und in der Server-Installation.' });
      const d = await body(req);
      if (url.pathname === '/api/zugang/entfernen') { zugang.entfernen(String(d.id || '')); return json(res, 200, { ok: true }); }
      if (!zugang.istRechner(req)) return json(res, 403, { fehler: 'Das geht nur direkt am PC.' });
      if (url.pathname === '/api/zugang/offen') { zugang.offenSetzen(d.an); lauschen(); return json(res, 200, { offen: zugang.offen() }); }
      if (url.pathname === '/api/zugang/code') return json(res, 200, zugang.codeErstellen(d.minuten));
      if (url.pathname === '/api/zugang/https') return json(res, 200, { adressen: await zugang.sicherEinrichten(PORT) });
    }
    if (url.pathname === '/api/apps' && req.method === 'GET') {
      return json(res, 200, {
        apps: katalogLaden().map((a) => (a.typ === 'design' ? { ...a, farben: designFarben(a.slug) } : a)),
        lokaleKi: ausHeimnetz(req) && gefundeneProgramme().length > 0,
        kiProgramme: ausHeimnetz(req) ? gefundeneProgramme() : [],
        csp: APP_CSP,
        basisCss: fs.readFileSync(path.join(hier, 'vorlage', 'basis.css'), 'utf8'),
      });
    }
    const appInfo = url.pathname.match(/^\/api\/app\/([a-z0-9.-]+)$/);
    if (appInfo && req.method === 'GET') {
      const slug = aufloesen(appInfo[1]);
      const app = katalogLaden().find((a) => a.slug === slug);
      if (!app) return json(res, 404, { fehler: 'App nicht gefunden' });
      let readme = null;
      for (const name of ['README.md', 'SKILL.md']) {
        try { readme = fs.readFileSync(path.join(APPS, slug, name), 'utf8'); break; } catch { /* nächste */ }
      }
      const dateien = [];
      const sammeln = (ordner, rel = '') => {
        for (const e of fs.readdirSync(ordner, { withFileTypes: true })) {
          if (['versionen', 'node_modules', '.env'].includes(e.name)) continue;
          if (e.isDirectory()) sammeln(path.join(ordner, e.name), rel + e.name + '/');
          else dateien.push(rel + e.name);
        }
      };
      sammeln(path.join(APPS, slug));
      const werkzeuge = (app.typ || 'browser') === 'browser' ? werkzeugErklaerungAus(appHtml(slug) || '').erklaerung : null;
      return json(res, 200, { app, readme, dateien, ...(werkzeuge ? { werkzeuge } : {}) });
    }
    // Rohdateien eines Eintrags (für Skills/Werkzeuge, die KIs lesen) – nur Text, nie ausgeführt
    const roh = url.pathname.match(/^\/api\/datei\/([a-z0-9.-]+)\/(.+)$/);
    if (roh && req.method === 'GET') {
      const slug = aufloesen(roh[1]);
      if (!slug) return json(res, 404, { fehler: 'Eintrag nicht gefunden' });
      const basis = path.join(APPS, slug);
      const datei = path.normalize(path.join(basis, decodeURIComponent(roh[2])));
      if (!datei.startsWith(basis + path.sep) || /(^|\/)\.env$/.test(datei)) return json(res, 403, { fehler: 'Nicht erlaubt' });
      return fs.readFile(datei, (err, inhalt) => {
        if (err) return json(res, 404, { fehler: 'Datei nicht gefunden' });
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-cache' });
        res.end(inhalt);
      });
    }
    if (url.pathname === '/api/github' && req.method === 'GET') {
      const q = String(url.searchParams.get('q') || '').slice(0, 120);
      if (!q.trim()) return json(res, 400, { fehler: 'Suchbegriff fehlt' });
      return json(res, 200, { treffer: await githubSuchen(q), erlaubteLizenzen: ERLAUBTE_LIZENZEN });
    }
    if (url.pathname === '/api/npm' && req.method === 'GET') {
      return json(res, 200, await npmInfo(String(url.searchParams.get('paket') || '')));
    }
    if (url.pathname === '/api/github/details' && req.method === 'GET') {
      return json(res, 200, await githubDetails(String(url.searchParams.get('repo') || '')));
    }
    if (url.pathname === '/api/design/bausteine' && req.method === 'GET') return json(res, 200, { bausteine: BAUSTEINE, aktionen: AKTIONEN, werte: WERTE, elemente: TAGS });
    const designWeg = url.pathname.match(/^\/api\/design\/([a-z0-9.-]+?)(?:@(v\d+))?\.css$/);
    if (designWeg && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'text/css; charset=utf-8', 'Cache-Control': 'no-cache' });
      return res.end(designCss(designWeg[1], designWeg[2]));
    }
    if (url.pathname === '/muster' && req.method === 'GET') {
      const muster = fs.readFileSync(path.join(OEFFENTLICH, 'muster.html'), 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': `${APP_CSP}; sandbox allow-scripts`, 'Cache-Control': 'no-cache' });
      return res.end(mitDesign(muster, designCss(url.searchParams.get('design'), url.searchParams.get('version'))));
    }
    if (url.pathname === '/api/frei/anbieter' && req.method === 'GET') {
      return json(res, 200, { anbieter: ANBIETER.map(({ id, name, konto }) => ({ id, name, konto })) });
    }
    if (url.pathname === '/api/installieren' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end(fs.readFileSync(path.join(hier, 'INSTALLIEREN.md'), 'utf8'));
    }
    if (url.pathname === '/api/regeln' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end(fs.readFileSync(path.join(hier, 'AGENTS.md'), 'utf8'));
    }
    // ---------- Anmeldung ----------
    if (url.pathname === '/api/ich' && req.method === 'GET') {
      let person = anmeldung.person(req);
      let neueSitzung = null;
      // Automatisch anmelden: Geräte im Heimnetz/Tailscale gehören dem Besitzer des Rechners
      // (außer man hat bewusst „wechseln" gewählt)
      if (!person && ausHeimnetz(req) && req.headers['x-hw-kein-auto'] !== '1') {
        const b = await anmeldung.besitzer();
        if (b) ({ sitzung: neueSitzung, person } = anmeldung.automatischAnmelden(b));
      }
      return json(res, 200, { person, sitzung: neueSitzung, github: Boolean(anmeldung.clientId()), lokalErlaubt: !anmeldung.clientId() && ausHeimnetz(req) });
    }
    if (url.pathname === '/api/anmelden/start' && req.method === 'POST') return json(res, 200, await anmeldung.starten());
    if (url.pathname === '/api/anmelden/status' && req.method === 'GET') return json(res, 200, await anmeldung.status(String(url.searchParams.get('vorgang') || '')));
    if (url.pathname === '/api/anmelden/lokal' && req.method === 'POST') {
      if (anmeldung.clientId() || !ausHeimnetz(req)) return json(res, 403, { fehler: 'Bitte mit GitHub anmelden.' });
      return json(res, 200, anmeldung.lokalAnmelden((await body(req)).name));
    }
    if (url.pathname === '/api/abmelden' && req.method === 'POST') { anmeldung.abmelden(req); return json(res, 200, { ok: true }); }

    // ---------- Hello-World-Helfer (Geräte) ----------
    if (url.pathname === '/api/faehigkeiten' && req.method === 'GET') {
      return json(res, 200, Object.fromEntries(Object.entries(FAEHIGKEITEN).map(([n, f]) => [n, { titel: f.titel, gefaehrlich: f.gefaehrlich }])));
    }
    if (url.pathname === '/api/helfer/anmelden' && req.method === 'POST') return json(res, 200, geraete.anmelden(await body(req)));
    if (url.pathname === '/api/helfer/warten' && req.method === 'GET') return json(res, 200, await geraete.warten(req));
    if (url.pathname === '/api/helfer/ergebnis' && req.method === 'POST') return json(res, 200, geraete.ergebnis(req, await body(req)));
    if (url.pathname.startsWith('/api/helfer')) {
      const ich = anmeldung.person(req);
      if (!ich) return json(res, 401, { fehler: 'Bitte zuerst mit GitHub anmelden.' });
      if (url.pathname === '/api/helfer' && req.method === 'GET') return json(res, 200, { geraete: geraete.meine(ich.login) });
      if (url.pathname === '/api/helfer/koppeln' && req.method === 'POST') return json(res, 200, geraete.koppeln(ich.login, (await body(req)).code));
      if (url.pathname === '/api/helfer/entfernen' && req.method === 'POST') return json(res, 200, geraete.entfernen(ich.login, (await body(req)).id));
      if (url.pathname === '/api/helfer/frage' && req.method === 'POST') return json(res, 200, geraete.frage(ich.login, await body(req)));
      if (url.pathname === '/api/helfer/befehl' && req.method === 'POST') {
        const d = await body(req);
        const app = katalogLaden().find((a) => a.slug === aufloesen(d.app));
        if (!app) return json(res, 404, { fehler: 'App nicht gefunden' });
        return json(res, 200, geraete.befehlAnlegen(ich.login, { ...d, app: app.slug, faehigkeiten: app.faehigkeiten || [] }));
      }
      const bs = url.pathname.match(/^\/api\/helfer\/befehl\/(b[0-9a-f]+)$/);
      if (bs && req.method === 'GET') return json(res, 200, geraete.befehlStatus(ich.login, bs[1]));
    }

    // ---------- Stammbaum & Bewertungen ----------
    const baumWeg = url.pathname.match(/^\/api\/stammbaum\/([a-z0-9.-]+)$/);
    if (baumWeg && req.method === 'GET') {
      const slug = aufloesen(baumWeg[1]);
      const b = slug && baum.baumMitWertung(slug, anmeldung.person(req)?.login);
      if (!b) return json(res, 404, { fehler: 'Für diesen Eintrag gibt es keinen Stammbaum' });
      return json(res, 200, { app: katalogLaden().find((a) => a.slug === slug), ...b });
    }
    if (url.pathname === '/api/bewerten' && req.method === 'POST') {
      const p = anmeldung.person(req);
      if (!p) return json(res, 401, { fehler: 'Zum Bewerten bitte mit GitHub anmelden.' });
      const { slug, version, sterne } = await body(req);
      const ziel = aufloesen(slug);
      if (!ziel || !baum.baumLaden(ziel)?.versionen.some((v) => v.id === version)) return json(res, 404, { fehler: 'Version nicht gefunden' });
      baum.bewerten(ziel, version, p.login, Number(sterne));
      return json(res, 200, baum.baumMitWertung(ziel, p.login));
    }
    if (url.pathname === '/api/suche' && req.method === 'POST') {
      if (!ausHeimnetz(req)) return json(res, 200, { treffer: [], hinweis: 'KI-Suche nur im Heimnetz' });
      const anfrage = String((await body(req)).anfrage || '').trim().slice(0, 200);
      if (!anfrage) return json(res, 400, { fehler: 'Suchbegriff fehlt' });
      return json(res, 200, { treffer: await suchtexte.kiSuche(anfrage, katalogLaden()) });
    }
    if (url.pathname === '/api/pruefen' && req.method === 'POST') {
      const { html } = await body(req);
      return json(res, 200, pruefeApp(html));
    }
    if (url.pathname === '/api/veroeffentlichen' && req.method === 'POST') {
      return json(res, 200, await veroeffentlichenIntern(await body(req)));
    }
    // ---------- Bau-Aufträge (laufen komplett auf dem PC) ----------
    const kiAusAnfrage = (k) => {
      if (k && k.art === 'anthropic' && k.schluessel) return { art: 'anthropic', schluessel: String(k.schluessel), modell: String(k.modell || 'claude-opus-5') };
      if (k && k.art === 'frei' && k.schluessel && typeof k.schluessel === 'object') {
        return { art: 'frei', schluessel: Object.fromEntries(ANBIETER.map((x) => [x.id, String(k.schluessel[x.id] || '').slice(0, 300)]).filter(([, v]) => v)) };
      }
      return { art: 'lokal', ...(KI_PROGRAMME[k?.programm] ? { programm: k.programm } : {}) };
    };
    const darf = (k) => k.art !== 'lokal' || ausHeimnetz(req);
    // ---------- Chat: versteht den Wunsch (im Zusammenhang mit der offenen App) ----------
    if (url.pathname === '/api/chat' && req.method === 'POST') {
      const d = await body(req);
      const ki = kiAusAnfrage(d.ki);
      if (!darf(ki)) return json(res, 403, { fehler: 'Die KI auf diesem PC geht nur zu Hause bzw. mit gekoppeltem Gerät.' });
      const nachricht = String(d.nachricht || '').trim().slice(0, 2000);
      if (!nachricht) return json(res, 400, { fehler: 'Leere Nachricht' });
      return json(res, 200, gespraech.starten({ ki, nachricht, kontext: d.kontext || null, verlauf: Array.isArray(d.verlauf) ? d.verlauf : [], katalog: katalogLaden() }));
    }
    const chatStand = url.pathname.match(/^\/api\/chat\/([a-f0-9]+)$/);
    if (chatStand && req.method === 'GET') return json(res, 200, gespraech.stand(chatStand[1]));
    if (url.pathname === '/api/bau' && req.method === 'POST') {
      const d = await body(req);
      const ich = anmeldung.person(req);
      if (!ich) return json(res, 401, { fehler: 'Bitte zuerst mit GitHub anmelden – dein Name wird als Ersteller bzw. Erweiterer eingetragen.', anmelden: true });
      const ki = kiAusAnfrage(d.ki);
      if (!darf(ki)) return json(res, 403, { fehler: '„Claude auf diesem PC" gibt es nur im Heimnetz – verbinde deine eigene KI.' });
      if (d.ziel) {
        const ziel = aufloesen(d.ziel);
        if (!ziel) return json(res, 404, { fehler: 'App nicht gefunden' });
        return json(res, 200, bau.verbessern(ziel, String(d.wunsch || '').trim() || 'verbessern', ki, ich, /^v\d+$/.test(d.basis || '') ? d.basis : null));
      }
      if (!String(d.anfrage || '').trim()) return json(res, 400, { fehler: 'Was soll gebaut werden?' });
      return json(res, 200, bau.neueApp(String(d.anfrage).trim(), ki, ich));
    }
    if (url.pathname === '/api/bau' && req.method === 'GET') {
      const ziel = url.searchParams.get('ziel');
      const liste = bau.auftraege().filter((a) => (!ziel || a.zielSlug === ziel || a.ziel === ziel) && Date.now() - a.erstellt < 7 * 864e5);
      return json(res, 200, { auftraege: liste.slice(0, 30) });
    }
    const bauWeg = url.pathname.match(/^\/api\/bau\/([a-z0-9]+)(?:\/(test|vorschau|uebernehmen|nachbessern|verwerfen|neustart))?$/);
    if (bauWeg) {
      const [, id, aktion] = bauWeg;
      const a = bau.auftrag(id);
      if (!a) return json(res, 404, { fehler: 'Auftrag unbekannt' });
      if (!aktion && req.method === 'GET') return json(res, 200, a);
      if ((aktion === 'test' || aktion === 'vorschau') && req.method === 'GET') {
        const html = bau.htmlLesen(id);
        if (!html) return json(res, 404, { fehler: 'Noch keine Vorschau' });
        let seite = html, design = designCss(url.searchParams.get('design'));
        if (a.typ === 'design') { seite = fs.readFileSync(path.join(OEFFENTLICH, 'muster.html'), 'utf8'); design = html; }
        const mitMelder = mitDesign(aktion === 'test' ? einsetzen(seite, MELDER, SDK_PROBE) : einsetzen(seite, SDK_PROBE), design);
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': `${APP_CSP}; sandbox allow-scripts allow-downloads allow-modals allow-popups allow-popups-to-escape-sandbox`, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' });
        return res.end(mitMelder);
      }
      if (req.method !== 'POST') return json(res, 405, { fehler: 'Nicht erlaubt' });
      if (aktion === 'uebernehmen') {
        if (!anmeldung.person(req)) return json(res, 401, { fehler: 'Bitte zuerst mit GitHub anmelden.', anmelden: true });
        return json(res, 200, await bau.uebernehmen(id, anmeldung.person(req)));
      }
      if (aktion === 'verwerfen') return json(res, 200, bau.verwerfen(id));
      if (aktion === 'nachbessern') return json(res, 200, bau.nachbessern(id, String((await body(req)).was || '')));
      if (aktion === 'neustart') {
        const ki = kiAusAnfrage((await body(req)).ki);
        if (!darf(ki)) return json(res, 403, { fehler: 'Nur im Heimnetz verfügbar' });
        const ich = anmeldung.person(req);
        if (!ich) return json(res, 401, { fehler: 'Bitte zuerst mit GitHub anmelden.', anmelden: true });
        return json(res, 200, bau.neuStarten(id, ki, ich));
      }
    }

    // „Claude auf diesem PC": läuft als Hintergrund-Auftrag, die Seite fragt den Stand ab.
    // So übersteht ein Umbau auch Verbindungsabbrüche oder ein gesperrtes Handy.
    // ---------- Werkzeuge für KIs: App unsichtbar ausführen (siehe werkzeuge.js) ----------
    if (url.pathname === '/api/werkzeug' && req.method === 'POST') {
      if (!ausHeimnetz(req)) return json(res, 403, { fehler: 'Werkzeuge laufen auf dem eigenen Rechner – nur im Heimnetz bzw. mit gekoppeltem Gerät.' });
      const d = await body(req, 45 * 1024 * 1024);
      const slug = aufloesen(String(d.slug || ''));
      const e = slug && katalogLaden().find((x) => x.slug === slug);
      if (!e || (e.typ || 'browser') !== 'browser') return json(res, 404, { fehler: 'App nicht gefunden' });
      const version = /^v\d+$/.test(String(d.version || '')) ? d.version : null;
      const wz = werkzeugErklaerungAus(appHtml(slug, version) || '').erklaerung;
      const name = String(d.werkzeug || '');
      if (!wz?.[name]) return json(res, 400, { fehler: `app.${slug} hat kein Werkzeug „${name}". Vorhanden: ${Object.keys(wz || {}).join(', ') || 'keine'}` });
      const dateien = (Array.isArray(d.dateien) ? d.dateien : []).slice(0, 50).map((x) => ({ name: String(x.name || 'datei').slice(0, 120), typ: String(x.typ || ''), base64: String(x.base64 || '') }));
      const adresse = `http://127.0.0.1:${PORT}/apps/${slug}/${version ? `v/${version}/` : ''}?design=klar`;
      return json(res, 200, await werkzeugAusfuehren({ adresse, name, eingabe: d.eingabe || {}, dateien }));
    }

    // ---------- Apps, die die eigene KI des Nutzers nutzen (siehe appki.js) ----------
    if (url.pathname === '/api/ki/app' && req.method === 'POST') {
      const d = await body(req);
      const ki = kiAusAnfrage(d.ki);
      if (!darf(ki)) return json(res, 403, { fehler: '„Claude auf diesem PC" geht nur im Heimnetz. Verbinde unter Hello World → Mehr → Deine KI einen eigenen Schlüssel.' });
      let html = null, name = 'App';
      if (d.auftrag) {
        const a = bau.auftrag(String(d.auftrag));
        if (a) { html = bau.htmlLesen(a.id); name = a.titelAnzeige || 'Vorschau'; }
      } else {
        const slug = aufloesen(String(d.slug || ''));
        const e = slug && katalogLaden().find((x) => x.slug === slug);
        if (e && (e.typ || 'browser') === 'browser') {
          const v = /^v\d+$/.test(String(d.version || '')) ? d.version : null;
          try { html = fs.readFileSync(v ? baum.versionsDatei(slug, v) : path.join(APPS, slug, 'index.html'), 'utf8'); } catch { /* fehlt */ }
          name = `app.${slug}`;
        }
      }
      if (!html) return json(res, 404, { fehler: 'App nicht gefunden' });
      const { erklaerung } = appki.kiErklaerungAus(html);
      if (!erklaerung) return json(res, 400, { fehler: 'Diese App hat keine KI-Aufgaben festgelegt.' });
      return json(res, 200, appki.starten({ ki, erklaerung, app: name, aufgabe: String(d.aufgabe || ''), eingabe: d.eingabe, adresse: req.socket.remoteAddress }));
    }
    const appKiStand = url.pathname.match(/^\/api\/ki\/app\/([a-f0-9]+)$/);
    if (appKiStand && req.method === 'GET') return json(res, 200, appki.stand(appKiStand[1]));

    if (url.pathname === '/api/ki/auftrag' && req.method === 'POST') {
      if (!ausHeimnetz(req)) return json(res, 403, { fehler: 'Nur im Heimnetz verfügbar' });
      const { system, frage, schema } = await body(req);
      const id = Math.random().toString(36).slice(2) + Date.now().toString(36);
      const auftrag = { status: 'laeuft', seit: Date.now() };
      auftraege.set(id, auftrag);
      claudeFragen(String(system || '').slice(0, 30_000), String(frage || '').slice(0, 200_000), schema && typeof schema === 'object' ? schema : null)
        .then((text) => Object.assign(auftrag, { status: 'fertig', text }))
        .catch((err) => Object.assign(auftrag, { status: 'fehler', fehler: err.message }));
      return json(res, 200, { id });
    }
    const auftragAbfrage = url.pathname.match(/^\/api\/ki\/auftrag\/([a-z0-9]+)$/);
    if (auftragAbfrage && req.method === 'GET') {
      const a = auftraege.get(auftragAbfrage[1]);
      if (!a) return json(res, 404, { fehler: 'Auftrag unbekannt – vielleicht wurde der PC neu gestartet. Bitte nochmal versuchen.' });
      return json(res, 200, a);
    }
    if (url.pathname.startsWith('/api/')) return json(res, 404, { fehler: 'Unbekannt' });

    // Apps: immer mit strenger CSP ausliefern
    const app = url.pathname.match(/^\/apps\/([a-z0-9-]+)\/(?:v\/(v\d+)\/)?(index\.html)?$/);
    if (app) {
      const slugA = aufloesen(app[1]) || app[1];
      const datei = app[2] ? baum.versionsDatei(slugA, app[2]) : path.join(APPS, slugA, 'index.html');
      return fs.readFile(datei, 'utf8', (err, inhalt) => {
        if (err) return json(res, 404, { fehler: 'App nicht gefunden' });
        inhalt = mitDesign(einsetzen(inhalt, SDK), designCss(url.searchParams.get('design')));
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Security-Policy': `${APP_CSP}; sandbox allow-scripts allow-downloads allow-modals allow-popups allow-popups-to-escape-sandbox`,
          'X-Content-Type-Options': 'nosniff',
          'Referrer-Policy': 'no-referrer',
          'Cache-Control': 'no-cache',
        });
        res.end(inhalt);
      });
    }

    // Oberfläche; /a/<slug> zeigt die App-Ansicht
    let pfad = url.pathname === '/' ? 'index.html' : url.pathname === '/koppeln' ? 'koppeln.html' : url.pathname;
    const baumSeite = url.pathname.match(/^\/b\/([a-z0-9.-]+)\/?$/);
    if (baumSeite) pfad = 'baum.html';
    const ansicht = url.pathname.match(/^\/a\/([a-z0-9.-]+?)(@v\d+)?\/?$/);
    if (ansicht) {
      // Einheitliche Adresse: /a/typ.name (z. B. /a/app.paintboard); alte Namen leiten weiter
      const ziel = aufloesen(ansicht[1]);
      const eintrag = ziel && katalogLaden().find((a) => a.slug === ziel);
      if (eintrag) {
        const kanonisch = `${{ browser: 'app', server: 'server', skill: 'skill', mcp: 'mcp', design: 'design' }[eintrag.typ || 'browser']}.${ziel}`;
        if (ansicht[1] !== kanonisch) { res.writeHead(301, { Location: `/a/${kanonisch}${ansicht[2] || ''}${url.search}` }); return res.end(); }
      }
      pfad = 'app.html';
    }
    const datei = path.normalize(path.join(OEFFENTLICH, pfad));
    if (!datei.startsWith(OEFFENTLICH)) return json(res, 403, { fehler: 'Nein' });
    fs.readFile(datei, (err, inhalt) => {
      if (err) return json(res, 404, { fehler: 'Nicht gefunden' });
      res.writeHead(200, { 'Content-Type': TYPEN[path.extname(datei)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
      res.end(inhalt);
    });
  } catch (err) {
    console.error(err);
    json(res, err.status || 500, err.extra || { fehler: err.message || 'Fehler' });
  }
});

anmeldung.einrichten({ daten: DATEN });
zugang.einrichten({ daten: DATEN });
geraete.einrichten({ datei: path.join(DATEN, 'helfer.json') });
baum.einrichten({ apps: APPS, bewertungen: path.join(DATEN, 'bewertungen.json') });
for (const a of katalogLaden()) {
  if (baum.uebernehmen(a.slug, { login: 'Mi7z', name: 'Mi7z' })) console.log(`Stammbaum angelegt: ${a.slug}`);
}

suchtexte.einrichten({ apps: APPS });
// Einträge ohne gute Suchtexte im Hintergrund beschreiben lassen
for (const a of katalogLaden()) if (!a.beispiele?.length) suchtexte.vormerken(a.slug);
// Steckbriefe aktuell halten: Werkzeuge und eigene KI stehen in der App selbst
for (const a of katalogLaden()) {
  if ((a.typ || 'browser') !== 'browser') continue;
  const vorher = JSON.stringify([a.werkzeuge, a.eigeneKi]);
  const html = appHtml(a.slug);
  if (!html) continue;
  eigeneKiEintragen(a, html);
  if (JSON.stringify([a.werkzeuge, a.eigeneKi]) !== vorher) steckbriefSpeichern(a);
}

bau.einrichten({
  ordner: path.join(DATEN, 'bau'),
  basisUrl: `http://127.0.0.1:${PORT}`,
  katalogLaden,
  veroeffentlichen: veroeffentlichenIntern,
  basisCss: () => fs.readFileSync(path.join(hier, 'vorlage', 'basis.css'), 'utf8'),
});
console.log(CHROME ? `Testlauf-Browser: ${CHROME}` : 'Kein Testlauf-Browser gefunden – Testlauf wird übersprungen');

server.requestTimeout = 0; // lange Anfragen nicht abbrechen
// Wo Hello World lauscht: Programm/Server-Installation mit Handy-Zugang → im Netz
// (nur gekoppelte Geräte kommen hinein), sonst nur am Rechner selbst
const gastgeber = () => (zugang.AN ? (zugang.offen() ? '0.0.0.0' : '127.0.0.1') : process.env.HW_HOST || '0.0.0.0');
function lauschen() {
  const neu = () => server.listen(PORT, gastgeber(), () => console.log(`Hello World läuft auf ${gastgeber()}:${PORT}`));
  if (server.listening) { server.close(neu); server.closeAllConnections(); } else neu();
}
lauschen();
if (zugang.AN && zugang.offen()) {
  // Für Server ohne Bildschirm: Kopplungscode beim Start ausgeben
  const { code } = zugang.codeErstellen();
  zugang.adressen(PORT).then((a) => console.log(`Handy koppeln: ${a[0]?.url || `http://<adresse>:${PORT}`}/koppeln – Code ${code} (10 Minuten gültig)`));
}
