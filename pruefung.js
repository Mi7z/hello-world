import { layoutAus, pruefeLayout } from './bausteine.js';
// Statische Sicherheits- und Qualitätsprüfung einer App (eine HTML-Datei).
// Läuft immer auf dem Server – der KI im Browser des Nutzers wird nicht vertraut.
// Die eigentliche Absicherung ist zusätzlich die strenge CSP + iframe-Sandbox,
// mit der jede App ausgeliefert wird (siehe APP_CSP).

export const CDN = 'https://cdn.jsdelivr.net/npm/';
export const CDN_GH = 'https://cdn.jsdelivr.net/gh/'; // GitHub-Projekte direkt, nur mit fester Version/Tag

// Was eine App darf: nur eigener Code, gepinnte Bibliotheken vom CDN,
// Bilder aus Daten/Blobs. Kein Netzwerk nach außen, keine Formulare, keine Frames.
export const APP_CSP = [
  "default-src 'none'",
  "script-src 'unsafe-inline' https://cdn.jsdelivr.net",
  "style-src 'unsafe-inline' https://cdn.jsdelivr.net",
  "img-src data: blob:",
  "media-src data: blob:",
  "font-src data: https://cdn.jsdelivr.net",
  "worker-src blob: https://cdn.jsdelivr.net",
  "connect-src data: blob: https://cdn.jsdelivr.net",
  "form-action 'none'",
  "base-uri 'none'",
  "frame-src 'none'",
].join('; ');

const VERBOTEN = [
  [/XMLHttpRequest/, 'Netzwerkzugriff (XMLHttpRequest)'],
  [/\bWebSocket\b/, 'Netzwerkzugriff (WebSocket)'],
  [/\bEventSource\b/, 'Netzwerkzugriff (EventSource)'],
  [/sendBeacon/, 'Daten verschicken (sendBeacon)'],
  [/\beval\s*\(/, 'eval() – unsicherer Code'],
  [/new\s+Function\s*\(/, 'new Function() – unsicherer Code'],
  [/document\.cookie/, 'Zugriff auf Cookies'],
  [/<iframe/i, 'eingebettete fremde Seiten (iframe)'],
  [/window\.open\s*\(/, 'öffnet neue Fenster'],
  [/(top|parent)\.location/, 'versucht die Hauptseite umzuleiten'],
  [/http-equiv\s*=\s*["']?refresh/i, 'automatische Weiterleitung'],
  [/coinhive|cryptonight|webminer|coin-?hive/i, 'Krypto-Mining'],
  [/RTCPeerConnection/, 'Peer-Verbindungen (WebRTC)'],
  [/navigator\.(geolocation|mediaDevices|usb|bluetooth|serial|hid)/, 'Zugriff auf Standort/Kamera/Geräte'],
];

export function pruefeApp(html) {
  const fehler = [];
  const hinweise = [];
  if (typeof html !== 'string' || !html.trim()) return { ok: false, fehler: ['Leere App'], hinweise };
  if (html.length > 400_000) fehler.push('App ist zu groß (über 400 KB)');
  if (!/<html[\s>]/i.test(html) || !/<\/html>/i.test(html)) fehler.push('Keine vollständige HTML-Seite');
  if (!/<title>[^<]{2,}<\/title>/i.test(html)) fehler.push('Kein Titel');
  if (!/<meta[^>]+viewport/i.test(html)) hinweise.push('Kein Viewport – evtl. nicht handytauglich');

  for (const [muster, text] of VERBOTEN) if (muster.test(html)) fehler.push(`Nicht erlaubt: ${text}`);

  // Nutzt die App die eigene KI des Nutzers? Dann muss sie ihre Aufgaben fest erklären.
  const wzErkl = werkzeugErklaerungAus(html);
  fehler.push(...wzErkl.fehler);
  if (/helloworld\.werkzeug\s*\(/.test(html) && !wzErkl.erklaerung && !wzErkl.fehler.length) fehler.push('Die App meldet Werkzeuge an (helloworld.werkzeug), erklärt sie aber nicht (<script type="application/json" id="hw-werkzeuge">)');
  const kiErkl = kiErklaerungAus(html);
  fehler.push(...kiErkl.fehler);
  if (/helloworld\.ki\s*\(/.test(html) && !kiErkl.erklaerung && !kiErkl.fehler.length) fehler.push('Die App ruft helloworld.ki() auf, erklärt aber keine KI-Aufgaben (<script type="application/json" id="hw-ki">)');

  // fetch() nur auf CDN, data: oder blob:
  for (const m of html.matchAll(/fetch\s*\(\s*(['"`])([^'"`]*)\1/g)) {
    const ziel = m[2];
    if (/^https?:/i.test(ziel) && !ziel.startsWith(CDN)) fehler.push(`Netzwerkzugriff auf fremde Adresse: ${ziel.slice(0, 80)}`);
  }
  if (/fetch\s*\(\s*[^'"`\s)]/.test(html)) hinweise.push('fetch() mit variabler Adresse – wird durch die Sandbox auf erlaubte Ziele begrenzt');

  // Klickbare Links (<a href>) nach außen: nur für Quellenangaben (GitHub, npm, Lizenzseiten)
  for (const m of html.matchAll(/<a\b[^>]*\bhref\s*=\s*["'](https?:\/\/[^"']+)["']/gi)) {
    if (!/^https:\/\/(github\.com|www\.npmjs\.com|opensource\.org|choosealicense\.com)\//.test(m[1])) fehler.push(`Link auf fremde Seite (nur Quellenangaben auf GitHub/npm erlaubt): ${m[1].slice(0, 80)}`);
  }

  // Nachgeladene Dateien (Skripte, Styles, Bilder …): nur gepinnte Pakete von cdn.jsdelivr.net
  for (const m of html.matchAll(/<(?!a\b)[a-z]+\b[^>]*\b(?:src|href)\s*=\s*["'](https?:\/\/[^"']+)["']/gi)) {
    const url = m[1];
    if (url.startsWith(CDN_GH)) {
      if (!/^[\w.-]+\/[\w.-]+@(v?\d+\.\d+\.\d+[\w.-]*|[0-9a-f]{7,40})\//.test(url.slice(CDN_GH.length))) fehler.push(`GitHub-Datei ohne feste Version: ${url.slice(0, 80)}`);
      continue;
    }
    if (!url.startsWith(CDN)) { fehler.push(`Externe Datei von fremder Quelle: ${url.slice(0, 80)}`); continue; }
    const paket = url.slice(CDN.length);
    if (!/^(@[\w.-]+\/)?[\w.-]+@\d+\.\d+\.\d+/.test(paket)) fehler.push(`Bibliothek ohne feste Version: ${url.slice(0, 80)}`);
  }

  // Verschleierter Code: sehr lange Zeichenketten ohne Leerzeichen
  if (/[A-Za-z0-9+/=]{20000,}/.test(html)) fehler.push('Verdächtig lange verschlüsselte Zeichenkette');
  if ((html.match(/String\.fromCharCode/g) || []).length > 5) fehler.push('Verdächtig viel verschleierter Text (fromCharCode)');

  return { ok: fehler.length === 0, fehler, hinweise };
}

// Kurzname für die Adresse, z. B. "PDF in PNG" → "pdf-in-png"
export function slugVon(text) {
  return String(text).toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50) || 'app';
}

// ---------- Designs (design.css) ----------
// Ein Design ist reines CSS: Farb-/Schrift-/Form-Bausteine plus optionale Eigenarten.
export const DESIGN_BAUSTEINE = ['--bg', '--fl', '--fl2', '--li', '--li2', '--tx', '--tx2', '--tx3', '--ak', '--ak2', '--ak-tx', '--rot', '--gelb', '--gruen', '--r', '--r-klein', '--schrift', '--schrift-titel', '--mono', '--schatten'];
export function pruefeDesign(css) {
  const fehler = [];
  if (typeof css !== 'string' || !css.trim()) return { ok: false, fehler: ['Leeres Design'], hinweise: [] };
  if (css.length > 70000) fehler.push('Design ist zu groß (über 70 KB)');
  // Optionales Layout (neue Anordnung der Startseite) separat prüfen, dann aus dem CSS herausnehmen
  const layout = layoutAus(css);
  if (layout !== null) { fehler.push(...pruefeLayout(layout)); css = css.replace(/\/\*\s*hw-layout\b[\s\S]*?\bhw-layout\s*\*\//, ''); }
  if (/@import/i.test(css)) fehler.push('Nicht erlaubt: @import (keine fremden Dateien)');
  if (/url\s*\(\s*(?!["']?data:)/i.test(css)) fehler.push('Nicht erlaubt: url() mit fremder Adresse (nur data: erlaubt)');
  if (/expression\s*\(|javascript:|behavior\s*:|-moz-binding/i.test(css)) fehler.push('Nicht erlaubt: ausführbarer Inhalt im CSS');
  if (/<\/?\s*(style|script)/i.test(css)) fehler.push('Nicht erlaubt: HTML-Tags im CSS');
  if (!/:root:root\s*\{/.test(css)) fehler.push('Die Bausteine müssen in einem Block „:root:root { … }" stehen');
  for (const b of DESIGN_BAUSTEINE) if (!new RegExp(`${b}\\s*:`).test(css)) fehler.push(`Baustein fehlt: ${b}`);
  if ((css.match(/\{/g) || []).length !== (css.match(/\}/g) || []).length) fehler.push('Klammern { } passen nicht zusammen');
  // Lesbarkeit: Kontrast der wichtigsten Paare (für jeden :root:root-Block, also hell und dunkel)
  for (const block of css.match(/:root:root\s*\{[^}]*\}/g) || []) {
    const wert = (n) => (block.match(new RegExp(`${n}\\s*:\\s*(#[0-9a-fA-F]{3,6})\\b`)) || [])[1];
    for (const [vorne, hinten, mindest, name] of [['--tx', '--bg', 4.5, 'Text auf Hintergrund'], ['--tx', '--fl', 4.5, 'Text auf Fläche'], ['--tx2', '--fl', 3, 'Nebentext auf Fläche'], ['--ak-tx', '--ak', 3, 'Knopf-Schrift auf Akzent']]) {
      const k = kontrast(wert(vorne), wert(hinten));
      if (k && k < mindest) fehler.push(`Schlecht lesbar: ${name} (Kontrast ${k.toFixed(1)}, nötig ${mindest})`);
    }
  }
  return { ok: fehler.length === 0, fehler, hinweise: [] };
}

function kontrast(a, b) {
  const rgb = (h) => { if (!h) return null; h = h.slice(1); if (h.length === 3) h = [...h].map((c) => c + c).join(''); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255); };
  const lum = (c) => { const [r, g, bl] = c.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * bl; };
  const x = rgb(a), y = rgb(b);
  if (!x || !y) return null;
  const [l1, l2] = [lum(x), lum(y)].sort((m, n) => n - m);
  return (l1 + 0.05) / (l2 + 0.05);
}

// ---------- Eigene KI des Nutzers (siehe appki.js) ----------
const KI_NAME = /^[a-z][a-z0-9_]{1,30}$/;
const MAX_ANWEISUNG = 6000, MAX_SCHEMA = 12000;

export function kiErklaerungAus(html) {
  const m = String(html || '').match(/<script[^>]*\bid=["']hw-ki["'][^>]*>([\s\S]*?)<\/script>/i);
  if (!m) return { erklaerung: null, fehler: [] };
  const fehler = [];
  let d;
  try { d = JSON.parse(m[1]); } catch { return { erklaerung: null, fehler: ['hw-ki: kein gültiges JSON'] }; }
  if (!/application\/json/i.test(m[0])) fehler.push('hw-ki: <script type="application/json"> verwenden');
  if (typeof d.zweck !== 'string' || d.zweck.trim().length < 5 || d.zweck.length > 200) fehler.push('hw-ki: "zweck" fehlt (5–200 Zeichen, wofür die App die KI nutzt)');
  const aufgaben = d.aufgaben && typeof d.aufgaben === 'object' ? Object.entries(d.aufgaben) : [];
  if (!aufgaben.length || aufgaben.length > 10) fehler.push('hw-ki: 1–10 "aufgaben" angeben');
  for (const [name, a] of aufgaben) {
    if (!KI_NAME.test(name)) fehler.push(`hw-ki: Aufgaben-Name „${name}" – nur kleine Buchstaben, Ziffern, _`);
    if (typeof a?.anweisung !== 'string' || a.anweisung.trim().length < 20 || a.anweisung.length > MAX_ANWEISUNG) fehler.push(`hw-ki: ${name}.anweisung fehlt oder ist zu kurz/lang (20–${MAX_ANWEISUNG} Zeichen)`);
    if (!a?.schema || a.schema.type !== 'object' || typeof a.schema.properties !== 'object') fehler.push(`hw-ki: ${name}.schema muss ein JSON-Schema mit "type": "object" und "properties" sein`);
    else if (JSON.stringify(a.schema).length > MAX_SCHEMA) fehler.push(`hw-ki: ${name}.schema ist zu groß`);
  }
  return { erklaerung: fehler.length ? null : { zweck: d.zweck.trim(), aufgaben: Object.fromEntries(aufgaben) }, fehler };
}


// ---------- Werkzeuge für KIs (siehe werkzeuge.js) ----------
// <script type="application/json" id="hw-werkzeuge">{ "werkzeuge": { "name": { "beschreibung", "eingabe": {JSON-Schema}, "dateien": "keine|eine|mehrere", "ausgabe" } } }</script>
export function werkzeugErklaerungAus(html) {
  const m = String(html || '').match(/<script[^>]*\bid=["']hw-werkzeuge["'][^>]*>([\s\S]*?)<\/script>/i);
  if (!m) return { erklaerung: null, fehler: [] };
  const fehler = [];
  let d;
  try { d = JSON.parse(m[1]); } catch { return { erklaerung: null, fehler: ['hw-werkzeuge: kein gültiges JSON'] }; }
  const liste = d.werkzeuge && typeof d.werkzeuge === 'object' ? Object.entries(d.werkzeuge) : [];
  if (!liste.length || liste.length > 15) fehler.push('hw-werkzeuge: 1–15 "werkzeuge" angeben');
  for (const [name, w] of liste) {
    if (!/^[a-z][a-z0-9_]{1,30}$/.test(name)) fehler.push(`hw-werkzeuge: Name „${name}" – nur kleine Buchstaben, Ziffern, _`);
    if (typeof w?.beschreibung !== 'string' || w.beschreibung.trim().length < 10 || w.beschreibung.length > 400) fehler.push(`hw-werkzeuge: ${name}.beschreibung fehlt (10–400 Zeichen: was es tut, wann man es nutzt)`);
    if (w?.eingabe && (w.eingabe.type !== 'object' || JSON.stringify(w.eingabe).length > 6000)) fehler.push(`hw-werkzeuge: ${name}.eingabe muss ein JSON-Schema mit "type": "object" sein`);
    if (w?.dateien && !['keine', 'eine', 'mehrere'].includes(w.dateien)) fehler.push(`hw-werkzeuge: ${name}.dateien ist "keine", "eine" oder "mehrere"`);
  }
  if (fehler.length) return { erklaerung: null, fehler };
  return { erklaerung: Object.fromEntries(liste.map(([n, w]) => [n, { beschreibung: w.beschreibung.trim(), eingabe: w.eingabe || { type: 'object', properties: {} }, dateien: w.dateien || 'keine', ausgabe: String(w.ausgabe || '').slice(0, 300) }])), fehler: [] };
}
