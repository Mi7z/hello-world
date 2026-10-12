// Stammbaum jeder App: Die erste Version ist die Wurzel, jede Verbesserung ein
// neuer Zweig (nichts wird überschrieben). Zweig-Enden sind „Distributionen",
// die bewertet werden. apps/<slug>/stammbaum.json + apps/<slug>/versionen/<id>.html
import fs from 'node:fs';
import path from 'node:path';

let APPS, BEWERTUNGEN;
export function einrichten({ apps, bewertungen }) {
  APPS = apps;
  BEWERTUNGEN = bewertungen;
  fs.mkdirSync(path.dirname(BEWERTUNGEN), { recursive: true });
}

const baumDatei = (slug) => path.join(APPS, slug, 'stammbaum.json');
// Apps: HTML (index.html), Designs: CSS (design.css)
function art(slug) {
  try { return JSON.parse(fs.readFileSync(path.join(APPS, slug, 'hello.json'), 'utf8')).typ === 'design' ? { endung: 'css', haupt: 'design.css' } : { endung: 'html', haupt: 'index.html' }; }
  catch { return { endung: 'html', haupt: 'index.html' }; }
}
export const versionsDatei = (slug, id) => path.join(APPS, slug, 'versionen', `${id}.${art(slug).endung}`);
export const hauptDatei = (slug) => path.join(APPS, slug, art(slug).haupt);

export function baumLaden(slug) {
  try { return JSON.parse(fs.readFileSync(baumDatei(slug), 'utf8')); } catch { return null; }
}
function baumSpeichern(slug, baum) {
  fs.writeFileSync(baumDatei(slug) + '.tmp', JSON.stringify(baum, null, 2) + '\n');
  fs.renameSync(baumDatei(slug) + '.tmp', baumDatei(slug));
}

// ---------- Bewertungen (je Person eine Bewertung pro Version) ----------
function bewertungenLaden() { try { return JSON.parse(fs.readFileSync(BEWERTUNGEN, 'utf8')); } catch { return {}; } }
export function bewerten(slug, id, login, sterne) {
  const b = bewertungenLaden();
  const k = `${slug}/${id}`;
  b[k] = b[k] || {};
  b[k][login] = Math.max(1, Math.min(5, Math.round(sterne)));
  fs.writeFileSync(BEWERTUNGEN + '.tmp', JSON.stringify(b, null, 1));
  fs.renameSync(BEWERTUNGEN + '.tmp', BEWERTUNGEN);
  indexAktualisieren(slug);
}
function wertung(b, slug, id, login) {
  const stimmen = Object.values(b[`${slug}/${id}`] || {});
  const n = stimmen.length, summe = stimmen.reduce((x, y) => x + y, 0);
  return {
    schnitt: n ? Math.round((summe / n) * 10) / 10 : null,
    anzahl: n,
    punkte: (2 * 3 + summe) / (2 + n), // vorsichtiger Schnitt: wenige Stimmen zählen weniger
    meine: login ? b[`${slug}/${id}`]?.[login] || null : null,
  };
}

// ---------- Baum mit Auswertung ----------
export function baumMitWertung(slug, login) {
  const baum = baumLaden(slug);
  if (!baum) return null;
  const b = bewertungenLaden();
  const kinder = (id) => baum.versionen.filter((v) => v.eltern === id).map((v) => v.id);
  const pfad = (v) => { const p = []; let x = v; while (x) { p.unshift(x); x = baum.versionen.find((y) => y.id === x.eltern); } return p; };
  const versionen = baum.versionen.map((v) => {
    const p = pfad(v);
    return {
      ...v,
      kinder: kinder(v.id),
      tiefe: p.length - 1,
      // Eigenarten: alle Änderungen auf dem Weg von der Wurzel bis hierher
      eigenarten: p.slice(1).map((x) => ({ text: x.aenderung, autor: x.autor })),
      wertung: wertung(b, slug, v.id, login),
    };
  });
  const enden = versionen.filter((v) => !v.kinder.length);
  const beste = [...enden].sort((x, y) => y.wertung.punkte - x.wertung.punkte || y.zeit.localeCompare(x.zeit)).slice(0, 3);
  return { slug, versionen, distributionen: beste.map((v) => v.id), standard: beste[0]?.id || versionen[0]?.id };
}

// Die beste Distribution liegt immer auch als apps/<slug>/index.html (für use, Suche, KIs)
export function indexAktualisieren(slug) {
  const baum = baumMitWertung(slug);
  if (!baum) return;
  const datei = versionsDatei(slug, baum.standard);
  if (fs.existsSync(datei)) fs.copyFileSync(datei, hauptDatei(slug));
}

// Neue Version anhängen (Wurzel, wenn eltern = null)
export function versionAnlegen(slug, { eltern, autor, aenderung, html, inhalt }) {
  html = inhalt ?? html;
  const baum = baumLaden(slug) || { versionen: [] };
  const nummer = baum.versionen.reduce((m, v) => Math.max(m, Number(v.id.slice(1)) || 0), 0) + 1;
  const id = `v${nummer}`;
  fs.mkdirSync(path.join(APPS, slug, 'versionen'), { recursive: true });
  fs.writeFileSync(versionsDatei(slug, id), html);
  baum.versionen.push({
    id, eltern: eltern || null,
    autor: { login: String(autor?.login || 'unbekannt'), name: String(autor?.name || autor?.login || 'unbekannt'), ...(autor?.lokal ? { lokal: true } : {}) },
    zeit: new Date().toISOString(),
    aenderung: String(aenderung || (eltern ? 'verbessert' : 'erste Version')).slice(0, 300),
  });
  baumSpeichern(slug, baum);
  indexAktualisieren(slug);
  return id;
}

// ---------- Einmalige Übernahme der bisherigen Versionen ----------
// Bisher: index.html = aktuell, versionen/<zeitstempel>.html = Stand VOR jeder Änderung,
// hello.json → verlauf[i].anfrage = die Änderung, die Version i+2 erzeugt hat.
export function uebernehmen(slug, standardAutor) {
  if (baumLaden(slug)) return false;
  const ordner = path.join(APPS, slug);
  const m = JSON.parse(fs.readFileSync(path.join(ordner, 'hello.json'), 'utf8'));
  if (!['browser', 'design'].includes(m.typ || 'browser') || !fs.existsSync(hauptDatei(slug))) return false;
  const verlauf = m.verlauf || [];
  const sicherungen = verlauf.map((v) => v.sicherung).filter((s) => s && fs.existsSync(path.join(ordner, 'versionen', s)));
  const staende = [...sicherungen.map((s) => fs.readFileSync(path.join(ordner, 'versionen', s), 'utf8')), fs.readFileSync(hauptDatei(slug), 'utf8')];
  const ersteller = m.ki === 'Start-App' ? { login: 'hello-world', name: 'Hello World' } : standardAutor;
  const baum = { versionen: [] };
  fs.mkdirSync(path.join(ordner, 'versionen'), { recursive: true });
  staende.forEach((html, i) => {
    const id = `v${i + 1}`;
    fs.writeFileSync(versionsDatei(slug, id), html);
    baum.versionen.push({
      id, eltern: i ? `v${i}` : null,
      autor: i ? standardAutor : ersteller,
      zeit: i ? verlauf[i - 1].zeit : (m.erstellt || new Date().toISOString()),
      aenderung: i ? kurz(verlauf[i - 1].anfrage) : (m.anfrage ? `erste Version: ${kurz(m.anfrage)}` : 'erste Version'),
    });
  });
  for (const s of sicherungen) fs.rmSync(path.join(ordner, 'versionen', s), { force: true });
  baumSpeichern(slug, baum);
  return true;
}
const kurz = (t) => String(t || '').replace(/\s+/g, ' ').trim().slice(0, 140);
