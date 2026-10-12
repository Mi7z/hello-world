#!/usr/bin/env node
// Prüft alle Apps im Repository (oder eine bestimmte: --app <slug>).
// Läuft lokal bei jeder KI/jedem Menschen und automatisch auf GitHub bei jedem
// Pull Request. Endet mit Code 1, wenn etwas nicht den Regeln entspricht.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pruefeApp, pruefeDesign } from '../pruefung.js';
import { FAEHIGKEITEN } from '../faehigkeiten.js';
import { ERLAUBTE_LIZENZEN, lizenzErlaubt } from '../github.js';

const wurzel = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const APPS = path.join(wurzel, 'apps');
const nurApp = process.argv.includes('--app') ? process.argv[process.argv.indexOf('--app') + 1] : null;

const KATEGORIEN_ALLGEMEIN = new Set(['werkzeug', 'sonstiges']);
const GEHEIMNISSE = [
  [/sk-ant-[A-Za-z0-9_-]{20,}/, 'Anthropic-Schlüssel'],
  [/sk-[A-Za-z0-9]{32,}/, 'API-Schlüssel (sk-…)'],
  [/AKIA[0-9A-Z]{16}/, 'AWS-Zugangsschlüssel'],
  [/AIza[0-9A-Za-z_-]{35}/, 'Google-API-Schlüssel'],
  [/gh[pousr]_[A-Za-z0-9]{30,}/, 'GitHub-Token'],
  [/xox[abprs]-[A-Za-z0-9-]{10,}/, 'Slack-Token'],
  [/-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/, 'privater Schlüssel'],
  [/(password|passwort|secret|token)\s*[:=]\s*["'][^"'\s]{8,}["']/i, 'fest eingetragenes Passwort/Geheimnis'],
];
const VERBOTENE_DATEIEN = /\.(exe|dll|so|dylib|bin|msi|apk|dmg|jar)$|^\.env$|^\.env\.(?!beispiel$|example$)/i; // .env.beispiel ist erlaubt

const fehler = [], warnungen = [];
const f = (slug, t) => fehler.push(`❌ ${slug}: ${t}`);
const w = (slug, t) => warnungen.push(`⚠️  ${slug}: ${t}`);

function dateienIn(ordner, basis = ordner) {
  const liste = [];
  for (const e of fs.readdirSync(ordner, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.git') continue;
    const p = path.join(ordner, e.name);
    if (e.isDirectory()) liste.push(...dateienIn(p, basis));
    else liste.push(path.relative(basis, p));
  }
  return liste;
}

const woerter = (t) => new Set(String(t).toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').split(/[^a-z0-9]+/).filter((x) => x.length > 2));
function aehnlichkeit(a, b) {
  const x = woerter(`${a.titel} ${(a.tags || []).join(' ')}`), y = woerter(`${b.titel} ${(b.tags || []).join(' ')}`);
  const schnitt = [...x].filter((v) => y.has(v)).length;
  return schnitt / Math.max(1, Math.min(x.size, y.size));
}

const apps = [];
for (const slug of fs.readdirSync(APPS).sort()) {
  const ordner = path.join(APPS, slug);
  if (!fs.statSync(ordner).isDirectory()) { if (!slug.startsWith('.')) f(slug, 'Im Ordner apps/ sind nur App-Ordner erlaubt'); continue; }
  if (!/^[a-z][a-z0-9]{2,23}$/.test(slug)) f(slug, 'Name: ein englisches Wort bzw. zusammengeschrieben, nur kleine Buchstaben/Ziffern, 3–24 Zeichen (z. B. paintboard) – angezeigt als typ.name, z. B. app.paintboard');
  let m;
  try { m = JSON.parse(fs.readFileSync(path.join(ordner, 'hello.json'), 'utf8')); } catch (e) { f(slug, `hello.json fehlt oder ist kein gültiges JSON (${e.message})`); continue; }
  apps.push({ slug, ...m });
}

const alleSlugs = new Set(apps.map((a) => a.slug));
const gesehen = new Map();
for (const a of apps) for (const al of a.aliase || []) {
  if (alleSlugs.has(al)) f(a.slug, `Alias „${al}" ist schon der Name einer anderen App`);
  if (gesehen.has(al)) f(a.slug, `Alias „${al}" wird schon von ${gesehen.get(al)} benutzt`);
  gesehen.set(al, a.slug);
}

for (const a of apps) {
  if (nurApp && a.slug !== nurApp) continue;
  const ordner = path.join(APPS, a.slug);
  // Steckbrief
  if (typeof a.titel !== 'string' || a.titel.length < 3 || a.titel.length > 80) f(a.slug, 'titel: 3–80 Zeichen');
  if (typeof a.beschreibung !== 'string' || a.beschreibung.length < 10 || a.beschreibung.length > 300) f(a.slug, 'beschreibung: 10–300 Zeichen');
  if (typeof a.kategorie !== 'string' || !/^[a-z]{3,20}$/.test(a.kategorie)) f(a.slug, 'kategorie: ein kleines Wort, z. B. konverter, text, bild, generator, rechner');
  if (!Array.isArray(a.funktionen) || !a.funktionen.length) f(a.slug, 'funktionen: mindestens eine Funktion auflisten');
  if (!Array.isArray(a.tags) || a.tags.length < 3) f(a.slug, 'tags: mindestens 3 Suchwörter');
  // Übernommene Open-Source-Projekte: freie Lizenz + sichtbare Quellenangabe
  for (const q of a.quellen || []) {
    if (!q.repo || !q.lizenz) f(a.slug, 'quellen: jede Quelle braucht repo und lizenz');
    else if (!lizenzErlaubt(q.lizenz)) f(a.slug, `quellen: Lizenz „${q.lizenz}" von ${q.repo} ist nicht freigegeben (erlaubt: ${ERLAUBTE_LIZENZEN.join(', ')})`);
    else if (a.typ === 'browser' && fs.existsSync(path.join(APPS, a.slug, 'index.html')) && !fs.readFileSync(path.join(APPS, a.slug, 'index.html'), 'utf8').includes(`github.com/${q.repo}`)) f(a.slug, `quellen: ${q.repo} muss in der App sichtbar genannt werden (Link)`);
  }
  for (const fh of a.faehigkeiten || []) if (!FAEHIGKEITEN[fh]) f(a.slug, `faehigkeiten: „${fh}" gibt es im Hello-World-Helfer nicht (siehe faehigkeiten.js)`);
  if (!['browser', 'server', 'skill', 'mcp', 'design'].includes(a.typ)) f(a.slug, 'typ: "browser", "server", "skill", "mcp" oder "design"');

  // Dateien
  const dateien = dateienIn(ordner);
  let summe = 0;
  for (const d of dateien) {
    const groesse = fs.statSync(path.join(ordner, d)).size;
    summe += groesse;
    if (VERBOTENE_DATEIEN.test(path.basename(d))) f(a.slug, `Datei nicht erlaubt: ${d} (keine Programme/Binärdateien, keine .env)`);
    if (groesse > 2_000_000) f(a.slug, `Datei zu groß (über 2 MB): ${d}`);
    if (groesse < 1_000_000 && /\.(js|mjs|ts|py|json|md|html|css|txt|yml|yaml|toml|sh|go|rs|rb|php)$/i.test(d)) {
      const inhalt = fs.readFileSync(path.join(ordner, d), 'utf8');
      for (const [muster, name] of GEHEIMNISSE) if (muster.test(inhalt)) f(a.slug, `Mögliches Geheimnis in ${d}: ${name} – Schlüssel gehören nie ins Repository`);
    }
  }
  if (summe > 10_000_000) f(a.slug, 'App ist insgesamt größer als 10 MB');

  if (a.typ === 'browser') {
    if (!dateien.includes('index.html')) f(a.slug, 'Browser-App braucht eine index.html');
    else {
      const r = pruefeApp(fs.readFileSync(path.join(ordner, 'index.html'), 'utf8'));
      r.fehler.forEach((x) => f(a.slug, x));
      r.hinweise.forEach((x) => w(a.slug, x));
    }
    const fremd = dateien.filter((d) => !['index.html', 'hello.json', 'stammbaum.json'].includes(d) && !d.startsWith('versionen/'));
    if (fremd.length) f(a.slug, `Browser-Apps bestehen nur aus index.html + hello.json (gefunden: ${fremd.slice(0, 5).join(', ')})`);
  }

  if (a.typ === 'design') {
    if (!dateien.includes('design.css')) f(a.slug, 'Design braucht eine design.css');
    else pruefeDesign(fs.readFileSync(path.join(ordner, 'design.css'), 'utf8')).fehler.forEach((x) => f(a.slug, x));
    const fremd = dateien.filter((d) => !['design.css', 'hello.json', 'stammbaum.json'].includes(d) && !d.startsWith('versionen/'));
    if (fremd.length) f(a.slug, `Designs bestehen nur aus design.css + hello.json (gefunden: ${fremd.slice(0, 5).join(', ')})`);
  }

  if (a.typ === 'server') {
    const s = a.server || {};
    if (!dateien.includes('README.md')) f(a.slug, 'Server-App braucht eine README.md');
    else if (!/^#+\s*selbst (betreiben|hosten)/im.test(fs.readFileSync(path.join(ordner, 'README.md'), 'utf8'))) f(a.slug, 'README.md braucht einen Abschnitt „## Selbst betreiben" mit Schritt-für-Schritt-Anleitung');
    if (typeof s.start !== 'string' || !s.start.trim()) f(a.slug, 'hello.json → server.start: Befehl zum Starten fehlt');
    if (typeof s.kosten !== 'string' || !s.kosten.trim()) f(a.slug, 'hello.json → server.kosten: grober Hinweis, was der Betrieb kostet (zahlt der Betreiber)');
    if (s.betreiber_url && !/^https:\/\//.test(s.betreiber_url)) f(a.slug, 'server.betreiber_url muss mit https:// beginnen');
    if (dateien.some((d) => /(^|\/)node_modules\//.test(d))) f(a.slug, 'node_modules nicht einchecken');
  }
}

// ---------- Stammbaum (Browser-Apps und Designs) ----------
for (const a of apps) {
  if (nurApp && a.slug !== nurApp) continue;
  if (!['browser', 'design'].includes(a.typ || 'browser')) continue;
  const design = a.typ === 'design';
  const datei = path.join(APPS, a.slug, 'stammbaum.json');
  if (!fs.existsSync(datei)) { w(a.slug, 'kein stammbaum.json – wird beim nächsten Start angelegt'); continue; }
  let b;
  try { b = JSON.parse(fs.readFileSync(datei, 'utf8')); } catch { f(a.slug, 'stammbaum.json ist kein gültiges JSON'); continue; }
  const ids = new Set((b.versionen || []).map((v) => v.id));
  if (!(b.versionen || []).some((v) => !v.eltern)) f(a.slug, 'stammbaum.json: keine Wurzel (erste Version)');
  for (const v of b.versionen || []) {
    if (!/^v\d+$/.test(v.id)) f(a.slug, `stammbaum.json: ungültige Versions-ID ${v.id}`);
    if (v.eltern && !ids.has(v.eltern)) f(a.slug, `stammbaum.json: ${v.id} verweist auf unbekannte Version ${v.eltern}`);
    if (!v.autor?.login) f(a.slug, `stammbaum.json: ${v.id} ohne Autor (GitHub-Name)`);
    const endung = design ? 'css' : 'html';
    const html = path.join(APPS, a.slug, 'versionen', `${v.id}.${endung}`);
    if (!fs.existsSync(html)) f(a.slug, `stammbaum.json: Datei versionen/${v.id}.${endung} fehlt`);
    else { const r = (design ? pruefeDesign : pruefeApp)(fs.readFileSync(html, 'utf8')); r.fehler.forEach((x) => f(a.slug, `${v.id}: ${x}`)); }
  }
}

// ---------- Skills und MCP-Werkzeuge ----------
for (const a of apps) {
  if (nurApp && a.slug !== nurApp) continue;
  const ordner = path.join(APPS, a.slug);
  const dateien = fs.existsSync(ordner) ? dateienIn(ordner) : [];
  if (a.typ === 'skill') {
    if (!dateien.includes('SKILL.md')) { f(a.slug, 'Skill braucht eine SKILL.md'); continue; }
    const text = fs.readFileSync(path.join(ordner, 'SKILL.md'), 'utf8');
    const kopf = text.match(/^---\n([\s\S]*?)\n---/);
    if (!kopf) { f(a.slug, 'SKILL.md braucht einen Kopf zwischen --- mit name und description'); continue; }
    const name = kopf[1].match(/^name:\s*(.+)$/m)?.[1].trim();
    const beschr = kopf[1].match(/^description:\s*([\s\S]+?)(?=\n\w+:|$)/m)?.[1].replace(/\s+/g, ' ').trim();
    if (name !== a.slug) f(a.slug, `SKILL.md: name muss gleich dem Ordnernamen sein („${a.slug}")`);
    if (!beschr || beschr.length < 40) f(a.slug, 'SKILL.md: description muss klar sagen, WANN der Skill genutzt wird (mind. 40 Zeichen)');
    if (text.length < 300) f(a.slug, 'SKILL.md ist zu kurz – beschreibe die Schritte konkret');
  }
  if (a.typ === 'mcp') {
    const m = a.mcp || {};
    if (typeof m.command !== 'string' || !m.command.trim()) f(a.slug, 'hello.json → mcp.command fehlt (z. B. "node")');
    if (!Array.isArray(m.args)) f(a.slug, 'hello.json → mcp.args fehlt (Liste, z. B. ["server.js"])');
    if (m.env && (typeof m.env !== 'object' || Object.values(m.env).some((v) => v !== ''))) f(a.slug, 'hello.json → mcp.env: nur Namen mit leerem Wert angeben (Werte setzt der Nutzer selbst)');
    if (!dateien.includes('README.md')) f(a.slug, 'MCP-Werkzeug braucht eine README.md');
    else if (!/^#+\s*einrichten/im.test(fs.readFileSync(path.join(ordner, 'README.md'), 'utf8'))) f(a.slug, 'README.md braucht einen Abschnitt „## Einrichten" (für Claude Code und Codex)');
    if (dateien.some((d) => /(^|\/)node_modules\//.test(d))) f(a.slug, 'node_modules nicht einchecken');
  }
}

// Ähnliche Apps zusammenlegen statt doppelt anlegen
for (let i = 0; i < apps.length; i++) for (let j = i + 1; j < apps.length; j++) {
  const a = apps[i], b = apps[j];
  if (nurApp && a.slug !== nurApp && b.slug !== nurApp) continue;
  if (a.kategorie !== b.kategorie || KATEGORIEN_ALLGEMEIN.has(a.kategorie) || a.typ !== b.typ || a.typ === 'design') continue; // Designs dürfen sich ähneln – Geschmack ist verschieden
  const s = aehnlichkeit(a, b);
  if (s >= 0.5) f(`${a.slug} + ${b.slug}`, `zu ähnlich (gleiche Kategorie „${a.kategorie}") – bitte die Funktion in die bestehende App einbauen statt eine neue anzulegen`);
  else if (s >= 0.3) w(`${a.slug} + ${b.slug}`, 'recht ähnlich – prüfen, ob eine gemeinsame App sinnvoller wäre');
}

console.log(`Hello World Prüfung: ${apps.length} Apps${nurApp ? ` (geprüft: ${nurApp})` : ''}`);
for (const x of warnungen) console.log(x);
for (const x of fehler) console.log(x);
if (fehler.length) { console.log(`\n${fehler.length} Fehler – so kann es nicht aufgenommen werden.`); process.exit(1); }
console.log('✅ Alles in Ordnung.');
