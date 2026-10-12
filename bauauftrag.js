// Bau-Aufträge laufen komplett auf dem PC: prüfen → GitHub → bauen → Check → Vorschau.
// Jeder Zwischenstand wird gespeichert (daten/bau/). Die Oberfläche fragt nur den
// Stand ab – Handy aus, Seite zu, später wiederkommen: egal.
import fs from 'node:fs';
import path from 'node:path';
import { kiFragen, kiJson, htmlAus } from './ki.js';
import { pruefeApp, pruefeDesign, APP_CSP } from './pruefung.js';
import { FAEHIGKEITEN } from './faehigkeiten.js';
import { KI_BAU_ZUSATZ } from './appki.js';
import { githubSuchen, githubDetails, npmInfo } from './github.js';
import { testlauf } from './testlauf.js';
import * as A from './anweisungen.js';

let ORDNER, BASIS_URL, katalogLaden, veroeffentlichen, basisCss;
const schluessel = new Map(); // eigene API-Schlüssel nur im Speicher, nie auf der Platte
const PRAEFIX = { browser: 'app', server: 'server', skill: 'skill', mcp: 'mcp', design: 'design' };
const kennung = (a) => `${PRAEFIX[a.typ || 'browser']}.${a.slug}`;

export function einrichten(o) {
  ({ ordner: ORDNER, basisUrl: BASIS_URL, katalogLaden, veroeffentlichen, basisCss } = o);
  fs.mkdirSync(ORDNER, { recursive: true });
  // Was beim letzten Neustart mitten im Bau war, ehrlich als abgebrochen markieren
  for (const d of fs.readdirSync(ORDNER).filter((x) => x.endsWith('.json'))) {
    const a = laden(d.slice(0, -5));
    if (a?.status === 'laeuft') {
      a.status = 'abgebrochen';
      a.meldung = 'Der Hello-World-Dienst auf dem PC wurde neu gestartet, dabei ist dieser Auftrag abgebrochen. Tippe auf „neu starten".';
      a.meldungArt = 'nein';
      speichern(a);
    }
  }
}

// ---------- Speicher ----------
const datei = (id, endung) => path.join(ORDNER, `${id}.${endung}`);
function laden(id) {
  if (!/^[a-z0-9]+$/.test(id)) return null;
  try { return JSON.parse(fs.readFileSync(datei(id, 'json'), 'utf8')); } catch { return null; }
}
function speichern(a) {
  a.aktualisiert = Date.now();
  fs.writeFileSync(datei(a.id, 'json') + '.tmp', JSON.stringify(a, null, 1));
  fs.renameSync(datei(a.id, 'json') + '.tmp', datei(a.id, 'json'));
}
export const htmlLesen = (id) => { try { return fs.readFileSync(datei(id, 'html'), 'utf8'); } catch { return null; } };
const htmlSchreiben = (id, html) => fs.writeFileSync(datei(id, 'html'), html);

export function auftrag(id) { return laden(id); }
export function auftraege() {
  return fs.readdirSync(ORDNER).filter((x) => x.endsWith('.json')).map((d) => laden(d.slice(0, -5))).filter(Boolean)
    .sort((a, b) => b.erstellt - a.erstellt);
}

function neu(felder, ki) {
  const id = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  const a = {
    id, status: 'laeuft', erstellt: Date.now(),
    schritte: { pruefen: '', github: '', bauen: '', test: '', fertig: '' }, schrittText: {},
    meldung: '', meldungArt: '', versuche: 0, probleme: [], ki: { art: ki?.art || 'lokal' },
    ...felder,
  };
  if (ki && ki.art !== 'lokal') schluessel.set(id, ki); // eigener oder Gratis-Schlüssel
  speichern(a);
  return a;
}
const kiVon = (a) => schluessel.get(a.id) || { art: 'lokal' };
function schritt(a, name, status, text) {
  a.schritte[name] = status;
  if (text !== undefined) a.schrittText[name] = text;
  speichern(a);
}
function melden(a, text, art = '') { a.meldung = text; a.meldungArt = art; speichern(a); }
function beenden(a, status, text, art = '') { a.status = status; melden(a, text, art); schluessel.delete(a.id); }

// ---------- Start ----------
export function neueApp(anfrage, ki, autor) {
  const a = neu({ art: 'neu', anfrage: String(anfrage).slice(0, 600), autor: autorKurz(autor) }, ki);
  ablauf(a, ablaufNeu).catch(() => {});
  return a;
}
export function verbessern(ziel, wunsch, ki, autor, basis) {
  const a = neu({ art: 'verbessern', anfrage: String(wunsch).slice(0, 600), ziel, basis: basis || null, autor: autorKurz(autor) }, ki);
  ablauf(a, ablaufVerbessern).catch(() => {});
  return a;
}
export function neuStarten(id, ki, autor) {
  const alt = laden(id);
  if (!alt) throw new Error('Auftrag unbekannt');
  return alt.art === 'verbessern' ? verbessern(alt.ziel, alt.anfrage, ki, autor, alt.basis) : neueApp(alt.anfrage, ki, autor);
}
const autorKurz = (p) => (p ? { login: p.login, name: p.name || p.login, ...(p.lokal ? { lokal: true } : {}) } : null);
export function nachbessern(id, was) {
  const a = laden(id);
  if (!a || a.status !== 'vorschau') throw new Error('Nachbessern geht nur bei einer fertigen Vorschau');
  a.status = 'laeuft'; a.versuche = 0; a.anfrage += ` – zusätzlich: ${String(was).slice(0, 400)}`;
  for (const s of ['test', 'fertig']) a.schritte[s] = '';
  speichern(a);
  ablauf(a, (x) => bauenUndPruefen(x, `Wunsch des Nutzers zur Vorschau: ${was}`)).catch(() => {});
  return a;
}
export function verwerfen(id) {
  const a = laden(id);
  if (!a) throw new Error('Auftrag unbekannt');
  beenden(a, 'verworfen', 'Verworfen – es wurde nichts geändert.');
  return a;
}
export async function uebernehmen(id, person) {
  const a = laden(id);
  if (!a || a.status !== 'vorschau') throw new Error('Nur eine fertige Vorschau kann veröffentlicht werden');
  if (!a.autor && person) a.autor = autorKurz(person); // ältere Aufträge ohne Ersteller: wer veröffentlicht, wird eingetragen
  const html = htmlLesen(id);
  const d = await veroeffentlichen({
    html, name: a.name, titel: a.titel, beschreibung: a.beschreibung, tags: a.tags, anfrage: a.anfrage,
    kategorie: a.kategorie, funktionen: [a.funktion].filter(Boolean), ziel: a.zielSlug || null,
    quellen: [...(a.quelle ? [a.quelle] : []), ...(a.quellen || [])], ki: a.ki.art === 'lokal' ? 'Claude' : 'KI',
    autor: a.autor, basis: a.basis, faehigkeiten: a.faehigkeiten || [], typ: a.typ === 'design' ? 'design' : undefined,
  });
  a.app = { slug: d.app.slug, kennung: kennung(d.app), erweitert: Boolean(d.erweitert), version: d.version };
  beenden(a, 'fertig', d.erweitert ? '[ ok ] übernommen – die vorige Version ist gesichert.' : '[ ok ] veröffentlicht – die App ist jetzt für alle da.');
  return a;
}

// Fehler im Ablauf (KI weg, Netz weg …) führen zu „fehler" mit ehrlicher Meldung
async function ablauf(a, schrittfolge) {
  try { await schrittfolge(a); } catch (err) {
    const offen = Object.entries(a.schritte).find(([, v]) => v === 'laeuft');
    if (offen) a.schritte[offen[0]] = 'nein';
    beenden(a, 'fehler', `Abgebrochen: ${err.message}`, 'nein');
  }
}

// ---------- Ablauf: neue App ----------
async function ablaufNeu(a) {
  schritt(a, 'pruefen', 'laeuft');
  const katalog = katalogLaden();
  const liste = katalog.map((x) => `- ziel_slug ${x.slug} (${kennung(x)}) [${x.kategorie || 'werkzeug'}, typ ${x.typ || 'browser'}]: ${x.beschreibung} – Funktionen: ${(x.funktionen || []).join('; ')}${x.beispiele?.length ? ` – passende Wünsche z. B.: ${x.beispiele.slice(0, 6).join(' / ')}` : ''}`).join('\n');
  const p = await kiJson(kiVon(a), A.PRUEF_SYSTEM, `Katalog:\n${liste}\n\nAnfrage: „${a.anfrage}"`, A.PRUEF_SCHEMA);
  const ziel = katalog.find((x) => x.slug === p.ziel_slug);
  a.faehigkeiten = (p.faehigkeiten || []).filter((f) => FAEHIGKEITEN[f]);
  a.eigeneKi = Boolean(p.eigene_ki);
  Object.assign(a, { name: p.name, titel: p.titel, beschreibung: p.beschreibung, tags: p.tags, plan: p.plan, kategorie: p.kategorie, funktion: p.funktion, githubSuche: p.github_suche });
  if (p.entscheidung === 'vorhanden' && ziel) {
    schritt(a, 'pruefen', 'ok');
    a.ergebnis = { kennung: kennung(ziel) };
    return beenden(a, 'vorhanden', `Das kann schon ${kennung(ziel)}. ${p.grund || ''}`);
  }
  if (p.entscheidung === 'design') {
    a.typ = 'design';
    a.titelAnzeige = `design.${String(p.name || '').toLowerCase().replace(/[^a-z0-9]/g, '')}`;
    schritt(a, 'pruefen', 'ok', 'neues Design');
    schritt(a, 'github', 'ok', 'bei Designs nicht nötig');
    melden(a, `Plan: ${p.plan}`);
    return bauenUndPruefen(a);
  }
  if (p.entscheidung === 'erweitern' && ziel?.typ === 'design') a.typ = 'design';
  if (p.entscheidung === 'server' || (p.entscheidung === 'erweitern' && ziel?.typ === 'server')) {
    schritt(a, 'pruefen', 'ok');
    return beenden(a, 'server', `Das braucht einen Server. ${p.grund || ''} Solche Apps baust du mit deiner eigenen KI direkt im Hello-World-Repository (Regeln in AGENTS.md, Vorlage vorlage/server-app/). Den Server betreibst und bezahlst du selbst.`, 'warn');
  }
  if (p.entscheidung === 'ablehnen' || (p.entscheidung === 'vorhanden' && !ziel)) {
    schritt(a, 'pruefen', 'nein');
    return beenden(a, 'abgelehnt', `Diese App wird nicht gebaut. ${p.grund || ''}`, 'nein');
  }
  if (p.entscheidung === 'erweitern' && ziel) {
    a.zielSlug = ziel.slug;
    a.zielKennung = kennung(ziel);
    a.titelAnzeige = `${kennung(ziel)} + ${p.funktion}`;
    schritt(a, 'pruefen', 'ok', `passt zu ${kennung(ziel)} – wird dort eingebaut`);
  } else {
    a.titelAnzeige = `app.${String(p.name || '').toLowerCase().replace(/[^a-z0-9]/g, '')}`;
    schritt(a, 'pruefen', 'ok', 'neue App');
  }
  melden(a, `Plan: ${p.plan}`);
  await githubSchritt(a);
  await bauenUndPruefen(a);
}

// ---------- Ablauf: vorhandene App verbessern ----------
async function ablaufVerbessern(a) {
  const ziel = katalogLaden().find((x) => x.slug === a.ziel);
  if (!ziel) throw new Error('App nicht gefunden');
  if (ziel.typ === 'design') a.typ = 'design';
  Object.assign(a, { zielSlug: ziel.slug, zielKennung: kennung(ziel), titelAnzeige: `${kennung(ziel)}${a.basis ? '@' + a.basis : ''} weiterentwickeln` });
  schritt(a, 'pruefen', 'laeuft');
  const p = await kiJson(kiVon(a), A.VERBESSERN_PRUEF, `App: ${kennung(ziel)} – ${ziel.beschreibung}\nFunktionen: ${(ziel.funktionen || []).join('; ')}\n\nWunsch: „${a.anfrage}"`, A.VERBESSERN_SCHEMA);
  if (!p.erlaubt || !p.passt) {
    schritt(a, 'pruefen', 'nein');
    return beenden(a, 'abgelehnt', `${p.erlaubt ? 'Das passt nicht zu dieser App.' : 'Das wird nicht umgesetzt.'} ${p.grund}${p.erlaubt ? ' Auf der Startseite kannst du es als eigene App bauen lassen.' : ''}`, 'nein');
  }
  Object.assign(a, { funktion: p.funktion, plan: p.plan, githubSuche: '', faehigkeiten: [...new Set([...(ziel.faehigkeiten || []), ...(p.faehigkeiten || [])])].filter((f) => FAEHIGKEITEN[f]), eigeneKi: Boolean(ziel.eigeneKi || p.eigene_ki) });
  schritt(a, 'pruefen', 'ok');
  schritt(a, 'github', 'ok', 'bei Verbesserungen übersprungen');
  melden(a, `Plan: ${p.plan}`);
  await bauenUndPruefen(a);
}

// ---------- GitHub ----------
async function githubSchritt(a) {
  schritt(a, 'github', 'laeuft', 'suche passende Open-Source-Projekte …');
  try {
    if (!a.githubSuche) return schritt(a, 'github', 'ok', 'keine Suche nötig');
    const treffer = await githubSuchen(a.githubSuche);
    const kandidaten = treffer.filter((t) => t.lizenz_ok).slice(0, 4);
    schritt(a, 'github', 'laeuft', `${treffer.length} Projekte gefunden, ${kandidaten.length} mit freier Lizenz – lese die besten …`);
    if (!kandidaten.length) return schritt(a, 'github', 'ok', 'nichts mit freier Lizenz – wird selbst gebaut');
    const details = await Promise.all(kandidaten.slice(0, 3).map((k) => githubDetails(k.repo).catch(() => ({}))));
    const text = kandidaten.map((k, i) => `### ${k.repo} (★${k.sterne}, Lizenz ${k.lizenz}, ${k.sprache || '?'})\n${k.beschreibung}\nnpm-Paket: ${details[i]?.npm ? `${details[i].npm.name}@${details[i].npm.version}` : 'keins bekannt'}\nREADME (Auszug):\n${(details[i]?.readme || '').slice(0, 2500)}`).join('\n\n');
    const w = await kiJson(kiVon(a), A.GITHUB_WAHL_SYSTEM, `Wunsch: „${a.anfrage} – ${a.funktion}"\n\nKandidaten:\n${text}`, A.GITHUB_WAHL_SCHEMA);
    const k = w.repo && w.paket && w.version ? kandidaten.find((x) => x.repo === w.repo) : null;
    if (!k) return schritt(a, 'github', 'ok', `nichts Passendes – wird selbst gebaut (${w.grund})`);
    a.quelle = { repo: k.repo, url: k.url, lizenz: k.lizenz, autor: k.autor, sterne: k.sterne, paket: w.paket, version: w.version, einbau: w.einbau };
    schritt(a, 'github', 'ok', `nutzt ${k.repo} (★${k.sterne}, ${k.lizenz}) – ${w.grund}`);
  } catch (err) {
    schritt(a, 'github', 'ok', `übersprungen: ${err.message}`);
  }
}

// ---------- Bauen und prüfen (mit bis zu 2 automatischen Nachbesserungen) ----------
async function bauenUndPruefen(a, nachbesserung) {
  const ziel = a.zielSlug ? katalogLaden().find((x) => x.slug === a.zielSlug) : null;
  const appOrdner = ziel ? path.join(path.dirname(ORDNER), '..', 'apps', ziel.slug) : null;
  const basisDatei = ziel && a.basis ? path.join(appOrdner, 'versionen', `${a.basis}.html`) : null;
  const design = a.typ === 'design';
  const basisDesign = ziel && a.basis ? path.join(appOrdner, 'versionen', `${a.basis}.css`) : null;
  const alteHtml = !ziel ? null : design
    ? fs.readFileSync(basisDesign && fs.existsSync(basisDesign) ? basisDesign : path.join(appOrdner, 'design.css'), 'utf8')
    : fs.readFileSync(basisDatei && fs.existsSync(basisDatei) ? basisDatei : path.join(appOrdner, 'index.html'), 'utf8');
  for (;;) {
    schritt(a, 'bauen', 'laeuft', a.versuche ? `bessert nach (${a.versuche}/2) …` : ziel ? `baut in ${kennung(ziel)} ein …` : 'programmiert die App für Handy und Desktop …');
    let system = design ? A.DESIGN_SYSTEM : A.BAU_SYSTEM(APP_CSP, basisCss()) + (a.quelle ? A.GITHUB_BAU_ZUSATZ(a.quelle) : '') + (a.faehigkeiten?.length ? A.HELFER_ZUSATZ(a.faehigkeiten) : '') + (a.eigeneKi && !design ? KI_BAU_ZUSATZ : '');
    let frage = `App: ${a.titelAnzeige}\nWunsch des Nutzers: „${a.anfrage}"\nPlan: ${a.plan}`;
    if (ziel && design) {
      system += '\nDu ENTWICKELST ein bestehendes Design WEITER: übernimm alles, was der Wunsch nicht ändert, und gib das KOMPLETTE neue CSS zurück.';
    } else if (ziel) {
      system += A.ERWEITERN_ZUSATZ;
      frage += `\nNeu bzw. Wunsch: ${a.funktion}\nBisherige Funktionen (müssen bleiben, außer der Wunsch ändert sie ausdrücklich): ${(ziel.funktionen || []).join('; ')}`;
    }
    const bisher = htmlLesen(a.id);
    const sprache = design ? 'css' : 'html';
    if (nachbesserung && bisher) frage += `\n\nDie letzte Version hatte diese Probleme – behebe sie:\n${nachbesserung}\n\nLetzte Version:\n\`\`\`${sprache}\n${bisher}\n\`\`\``;
    else if (alteHtml) frage += `\n\n${design ? 'Bestehendes Design' : 'Bestehende App'}:\n\`\`\`${sprache}\n${alteHtml}\n\`\`\``;
    const antwort = await kiFragen(kiVon(a), system, frage);
    const html = design ? ((antwort.match(/```css\s*([\s\S]*?)```/i) || [])[1] || antwort).trim() : htmlAus(antwort);
    htmlSchreiben(a.id, html);
    schritt(a, 'bauen', 'ok', ziel ? `in ${kennung(ziel)} eingebaut` : 'gebaut');

    schritt(a, 'test', 'laeuft', 'Sicherheit …');
    const probleme = [];
    const p = design ? pruefeDesign(html) : pruefeApp(html);
    probleme.push(...p.fehler);
    schritt(a, 'test', 'laeuft', 'Testlauf auf Handy und Desktop …');
    const t = await testlauf(`${BASIS_URL}/api/bau/${a.id}/test`);
    probleme.push(...t.fehler.map((f) => `Fehler beim Testlauf: ${f}`));
    if (a.quelle && !html.includes(`github.com/${a.quelle.repo}`)) probleme.push(`Quellenangabe fehlt: Die App muss sichtbar auf https://github.com/${a.quelle.repo} (${a.quelle.lizenz}) verlinken.`);
    schritt(a, 'test', 'laeuft', 'Bibliotheken und Lizenzen …');
    a.quellen = [];
    for (const m of design ? [] : new Set([...html.matchAll(/cdn\.jsdelivr\.net\/npm\/((?:@[\w.-]+\/)?[\w.-]+)@/g)].map((x) => x[1]))) {
      try {
        const info = await npmInfo(m);
        if (!info.lizenz_ok) { probleme.push(`Bibliothek ${m} hat die Lizenz „${info.lizenz || 'keine'}" – nicht erlaubt, nutze eine Alternative mit freier Lizenz.`); continue; }
        if (info.repo) {
          a.quellen.push({ repo: info.repo, lizenz: info.lizenz, autor: info.autor, paket: m });
          if (!html.includes(`github.com/${info.repo}`)) probleme.push(`Quellenangabe fehlt: Nenne unten in der App sichtbar „nutzt <a href="https://github.com/${info.repo}">${info.repo}</a> (${info.lizenz})".`);
        }
      } catch { /* npm nicht erreichbar – Sicherheit greift trotzdem */ }
    }
    if (ziel && !design && !p.fehler.length) {
      schritt(a, 'test', 'laeuft', 'Funktionen erhalten? …');
      try {
        const f = await kiJson(kiVon(a), A.FUNKTIONS_SYSTEM, `Bisherige Funktionen:\n${(ziel.funktionen || []).map((x) => '- ' + x).join('\n')}\nNeu bzw. Wunsch: ${a.funktion}\n\nNeue Datei:\n\`\`\`html\n${html}\n\`\`\``, A.FUNKTIONS_SCHEMA);
        if (!f.alle_erhalten) probleme.push(...(f.fehlend.length ? f.fehlend : ['unklar']).map((x) => `Bisherige Funktion fehlt oder ist kaputt: ${x}`));
        if (!f.neue_funktion_da) probleme.push(`Der Wunsch ist noch nicht umgesetzt: ${a.funktion}`);
      } catch (err) { probleme.push(`Funktions-Check nicht möglich: ${err.message}`); }
    }
    a.probleme = probleme;
    a.hinweise = [...p.hinweise, ...(t.hinweis ? [t.hinweis] : [])];
    if (!probleme.length) break;
    if (a.versuche >= 2) {
      schritt(a, 'test', 'nein', `${probleme.length} Problem(e) nach 2 Nachbesserungen`);
      return beenden(a, 'fehler', 'Die App hat den Check nicht bestanden und wird so nicht veröffentlicht.', 'nein');
    }
    a.versuche++;
    schritt(a, 'test', 'nein', `${probleme.length} Problem(e) gefunden – KI bessert nach`);
    nachbesserung = probleme.join('\n');
  }
  schritt(a, 'test', 'ok', design ? 'Sicherheit · Lesbarkeit · Handy · Desktop' : 'Sicherheit · Handy · Desktop · Lizenzen' + (ziel ? ' · Funktionen' : ''));
  schritt(a, 'fertig', 'ok', 'Vorschau bereit');
  a.status = 'vorschau';
  melden(a, 'Fertig! Probier die Vorschau aus – dann übernehmen, nachbessern oder verwerfen.');
}
