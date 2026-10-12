// Pitches: Vorschläge, Hello World SELBST weiterzuentwickeln. Jeder Pitch ist ein
// GitHub-Eintrag (Issue mit Markierung „pitch") im öffentlichen Repository, jede Stimme
// ein 👍. So sehen alle Nutzer weltweit dieselbe Liste – kostenlos.
// Der Besitzer eines Hello World (GitHub-CLI „gh" angemeldet) reicht direkt ein und
// stimmt direkt ab; alle anderen landen mit fertig ausgefülltem Plan auf GitHub.
import { execFile } from 'node:child_process';
import { kiJson } from './ki.js';

export const REPO = process.env.HW_REPO || 'Mi7z/hello-world';
// Entscheidung: mindestens 10 Stimmen (👍 + 👎) und mindestens 80 % dafür
export const MIN_STIMMEN = Number(process.env.HW_PITCH_MIN_STIMMEN || 10);
export const QUOTE = Number(process.env.HW_PITCH_QUOTE || 0.8);
export function bewertung(dafuer, dagegen) {
  const gesamt = dafuer + dagegen;
  const anteil = gesamt ? dafuer / gesamt : 0;
  const status = gesamt < MIN_STIMMEN ? 'offen' : anteil >= QUOTE ? 'angenommen' : 'zu wenig Zustimmung';
  return { gesamt, anteil, status };
}

const gh = (args, eingabe) => new Promise((resolve) => {
  const k = execFile('gh', args, { timeout: 20000, maxBuffer: 5e6 }, (err, aus, fehler) => resolve({ ok: !err, aus: String(aus || ''), fehler: String(fehler || err?.message || '') }));
  if (eingabe) k.stdin.end(eingabe);
});

let cache = { zeit: 0, liste: null };
export async function liste(frisch = false) {
  if (!frisch && cache.liste && Date.now() - cache.zeit < 120e3) return cache.liste;
  // Erst über gh (mehr Anfragen erlaubt), sonst öffentlich ohne Anmeldung
  let roh = null;
  const r = await gh(['api', `repos/${REPO}/issues?labels=pitch&state=all&per_page=100`]);
  if (r.ok) { try { roh = JSON.parse(r.aus); } catch { /* weiter */ } }
  if (!roh) {
    const res = await fetch(`https://api.github.com/repos/${REPO}/issues?labels=pitch&state=all&per_page=100`, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Hello-World' }, signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`GitHub antwortet mit ${res.status}`);
    roh = await res.json();
  }
  const liste = roh.filter((i) => !i.pull_request).map((i) => {
    const marken = i.labels.map((l) => (typeof l === 'string' ? l : l.name));
    const dafuer = i.reactions?.['+1'] || 0, dagegen = i.reactions?.['-1'] || 0;
    const b = bewertung(dafuer, dagegen);
    return {
      nummer: i.number, titel: String(i.title).replace(/^Pitch:\s*/i, ''), plan: String(i.body || '').replace(/^### Plan\s*/i, '').trim(),
      von: i.user?.login, zeit: i.created_at, dafuer, dagegen, gesamt: b.gesamt, anteil: b.anteil, url: i.html_url,
      status: marken.includes('pitch: umgesetzt') || i.state === 'closed' ? 'umgesetzt' : marken.includes('pitch: wird gebaut') ? 'wird gebaut' : marken.includes('pitch: fehlgeschlagen') ? 'fehlgeschlagen' : b.status,
      geschlossen: i.state === 'closed',
    };
  }).sort((a, b) => (a.geschlossen - b.geschlossen) || (b.dafuer - b.dagegen) - (a.dafuer - a.dagegen) || b.zeit.localeCompare(a.zeit));
  cache = { zeit: Date.now(), liste };
  return liste;
}

// Aus einer Idee einen ordentlichen Plan machen (mit der KI des Nutzers)
const PLAN_SYSTEM = `Du hilfst, einen „Pitch" für Hello World zu schreiben – einen Vorschlag, Hello World SELBST (die Oberfläche, den Chat, den Bauablauf, das Programm …) zu verbessern, nicht eine einzelne App. Mach aus der Idee einen klaren, ehrlichen Plan auf Deutsch, für Laien verständlich.
"titel": kurz und konkret (höchstens 60 Zeichen), ohne „Pitch:".
"zusammenfassung": ein Satz, was es dem Nutzer bringt.
"plan": Markdown mit den Abschnitten „## Worum geht's" (Problem/Wunsch), „## Was ändert sich" (konkrete Punkte), „## Umfang und Risiken" (klein/mittel/groß, was betroffen ist, Sicherheit). Höchstens 25 Zeilen. Nichts erfinden, was die Idee nicht hergibt.`;
const PLAN_SCHEMA = { type: 'object', additionalProperties: false, required: ['titel', 'zusammenfassung', 'plan'], properties: { titel: { type: 'string' }, zusammenfassung: { type: 'string' }, plan: { type: 'string' } } };
export async function entwurf(ki, idee) {
  const d = await kiJson(ki, PLAN_SYSTEM, `Idee: „${idee}"`, PLAN_SCHEMA);
  return { titel: String(d.titel).slice(0, 80), zusammenfassung: String(d.zusammenfassung).slice(0, 300), plan: String(d.plan).slice(0, 6000) };
}

export function githubLink(titel, plan) {
  const u = new URL(`https://github.com/${REPO}/issues/new`);
  u.searchParams.set('template', 'pitch.yml');
  u.searchParams.set('title', `Pitch: ${titel}`);
  u.searchParams.set('plan', plan.slice(0, 5000));
  return u.href;
}

// Direkt über das GitHub-Konto des Besitzers (gh)
export async function ghBereit() { return (await gh(['auth', 'status'])).ok; }
export async function einreichen({ titel, plan, autor }) {
  const body = `### Plan\n\n${plan}\n\n---\n_Eingereicht über Hello World${autor ? ` von @${autor}` : ''}._`;
  const r = await gh(['api', `repos/${REPO}/issues`, '-X', 'POST', '-f', `title=Pitch: ${titel}`, '-F', 'body=@-', '-f', 'labels[]=pitch'], body);
  if (!r.ok) throw new Error(`GitHub hat den Pitch nicht angenommen: ${r.fehler.slice(0, 200)}`);
  cache.zeit = 0;
  const i = JSON.parse(r.aus);
  return { nummer: i.number, url: i.html_url };
}
// Abstimmen über das GitHub-Konto des Besitzers: 👍 (+1) oder 👎 (-1).
// Nochmal dasselbe nimmt die Stimme zurück, die andere Richtung wechselt sie.
let ich = null;
export async function abstimmen(nummer, richtung) {
  const inhalt = richtung === '-1' ? '-1' : '+1';
  const n = Number(nummer);
  if (!ich) { const u = await gh(['api', 'user']); ich = u.ok ? JSON.parse(u.aus).login : null; }
  const r = await gh(['api', `repos/${REPO}/issues/${n}/reactions?per_page=100`]);
  const meine = r.ok ? JSON.parse(r.aus).filter((x) => x.user?.login === ich && ['+1', '-1'].includes(x.content)) : [];
  let zurueck = false;
  for (const x of meine) {
    await gh(['api', '-X', 'DELETE', `repos/${REPO}/issues/${n}/reactions/${x.id}`]);
    if (x.content === inhalt) zurueck = true;
  }
  if (!zurueck) {
    const neu = await gh(['api', `repos/${REPO}/issues/${n}/reactions`, '-X', 'POST', '-f', `content=${inhalt}`]);
    if (!neu.ok) throw new Error(`Abstimmen hat nicht geklappt: ${neu.fehler.slice(0, 200)}`);
  }
  cache.zeit = 0;
  return { ok: true, stimme: zurueck ? null : inhalt };
}
