// Gute Beschreibungen für die Suche: Die KI beschreibt jeden Eintrag aus Sicht des
// Nutzers (was er damit erreicht) und sammelt viele Beispiel-Wünsche in
// unterschiedlichem Wortlaut – damit er auch gefunden wird, wenn ganz anders gesucht wird.
import fs from 'node:fs';
import path from 'node:path';
import { kiJson } from './ki.js';

const SYSTEM = `Du schreibst für „Hello World" (eine Sammlung von Apps, Skills und KI-Werkzeugen) die Suchtexte zu einem Eintrag.
Ziel: Menschen sollen den Eintrag finden, egal wie sie ihren Wunsch formulieren – Alltagssprache, Fachbegriffe, Tippfehler-nah, Deutsch oder Englisch.
- "beschreibung": 1–2 Sätze auf Deutsch aus Sicht des Nutzers: was er damit erreicht (nicht wie es technisch funktioniert). Nur was der Eintrag wirklich kann.
- "beispiele": 12–20 realistische Wünsche, wie Menschen sie eintippen würden („Ich brauche …", „wie kann ich …", „… umwandeln", Stichworte). Unterschiedlicher Wortlaut, Alltag und Fachsprache, 3–4 davon auf Englisch. Nur Wünsche, die der Eintrag wirklich erfüllt.
- "symbol": genau EIN passendes Emoji als Erkennungszeichen (z. B. 🎨 für Malen, 🔁 für Umwandeln).
- "stichworte": 15–30 einzelne Such-Wörter und Synonyme (klein, deutsch und englisch), auch verwandte Begriffe (z. B. foto, bild, image, picture, jpg).
Antworte im vorgegebenen JSON-Format.`;

const SCHEMA = {
  type: 'object', additionalProperties: false, required: ['beschreibung', 'beispiele', 'stichworte', 'symbol'],
  properties: {
    symbol: { type: 'string' },
    beschreibung: { type: 'string' },
    beispiele: { type: 'array', items: { type: 'string' } },
    stichworte: { type: 'array', items: { type: 'string' } },
  },
};

let APPS;
const schlange = [];
let laeuft = false;
export function einrichten({ apps }) { APPS = apps; }

// Beschreibung im Hintergrund (neu) erstellen lassen – nacheinander, ohne zu blockieren
export function vormerken(slug) {
  if (!schlange.includes(slug)) schlange.push(slug);
  abarbeiten();
}
async function abarbeiten() {
  if (laeuft) return;
  laeuft = true;
  while (schlange.length) {
    const slug = schlange.shift();
    try { await erstellen(slug); console.log(`Beschreibung aktualisiert: ${slug}`); }
    catch (err) { console.error(`Beschreibung ${slug}:`, err.message); }
  }
  laeuft = false;
}

async function erstellen(slug) {
  const ordner = path.join(APPS, slug);
  const datei = path.join(ordner, 'hello.json');
  const m = JSON.parse(fs.readFileSync(datei, 'utf8'));
  let inhalt = '';
  for (const n of ['index.html', 'design.css', 'SKILL.md', 'README.md']) {
    const p = path.join(ordner, n);
    if (fs.existsSync(p)) { inhalt = fs.readFileSync(p, 'utf8').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<script[^>]*src=[^>]*><\/script>/gi, '').slice(0, 14000); break; }
  }
  const d = await kiJson({ art: 'lokal' }, SYSTEM, `Eintrag: ${m.typ || 'browser'}.${slug}\nBisherige Beschreibung: ${m.beschreibung}\nFunktionen: ${(m.funktionen || []).join('; ')}\n\nInhalt (gekürzt):\n${inhalt}`, SCHEMA);
  const frisch = JSON.parse(fs.readFileSync(datei, 'utf8')); // könnte sich inzwischen geändert haben
  frisch.beschreibung = String(d.beschreibung || frisch.beschreibung).slice(0, 300);
  frisch.beispiele = [...new Set((d.beispiele || []).map((x) => String(x).trim()).filter(Boolean))].slice(0, 24).map((x) => x.slice(0, 120));
  frisch.stichworte = [...new Set((d.stichworte || []).map((x) => String(x).toLowerCase().trim()).filter(Boolean))].slice(0, 40).map((x) => x.slice(0, 40));
  if (!frisch.symbol && d.symbol) frisch.symbol = [...String(d.symbol).trim()].slice(0, 2).join('');
  frisch.beschreibungStand = new Date().toISOString();
  fs.writeFileSync(datei + '.tmp', JSON.stringify(frisch, null, 2) + '\n');
  fs.renameSync(datei + '.tmp', datei);
}

// ---------- KI-Suche: welche Einträge erfüllen den Wunsch? ----------
const SUCH_SYSTEM = `Du hilfst bei der Suche in „Hello World". Gegeben ist ein Wunsch und der Katalog. Finde die Einträge, die den Wunsch WIRKLICH erfüllen (auch wenn ganz andere Wörter benutzt werden). Bewerte "passt" von 0 bis 100 und begründe in einem kurzen deutschen Satz, was der Eintrag für diesen Wunsch tut. Nur Einträge mit passt >= 50. Lieber weniger, dafür treffend.`;
const SUCH_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['treffer'],
  properties: { treffer: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['slug', 'passt', 'grund'], properties: { slug: { type: 'string' }, passt: { type: 'integer' }, grund: { type: 'string' } } } } },
};
const suchSpeicher = new Map();
export async function kiSuche(anfrage, katalog) {
  const schluessel = anfrage.toLowerCase().trim();
  const alt = suchSpeicher.get(schluessel);
  if (alt && Date.now() - alt.zeit < 3600e3) return alt.treffer;
  const liste = katalog.map((a) => `- ${a.slug} (${a.typ || 'browser'}): ${a.beschreibung} | kann: ${(a.funktionen || []).join('; ')} | z. B.: ${(a.beispiele || []).slice(0, 8).join(' / ')}`).join('\n');
  const d = await kiJson({ art: 'lokal' }, SUCH_SYSTEM, `Wunsch: „${anfrage}"\n\nKatalog:\n${liste}`, SUCH_SCHEMA);
  const treffer = (d.treffer || []).filter((t) => katalog.some((a) => a.slug === t.slug) && t.passt >= 50).sort((x, y) => y.passt - x.passt).slice(0, 6);
  suchSpeicher.set(schluessel, { zeit: Date.now(), treffer });
  return treffer;
}
