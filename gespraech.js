// Der Hello-World-Chat: versteht, was der Nutzer möchte – im Zusammenhang mit der
// gerade offenen App (falls eine offen ist) – und entscheidet, was passiert:
// App verbessern/erweitern, neue App bauen, passende Apps vorschlagen/öffnen oder antworten.
// Läuft als Hintergrund-Auftrag (die Seite fragt den Stand ab).
import crypto from 'node:crypto';
import { kiJson } from './ki.js';

const SYSTEM = `Du bist der Assistent von „Hello World", einer Sammlung kleiner Apps (Browser-Apps, Designs, Skills, KI-Werkzeuge). Der Nutzer schreibt in ein Chatfenster. Entscheide, was er möchte, und wähle GENAU EINE aktion:
- "verbessern": Er möchte die GERADE OFFENE App ändern, verbessern oder erweitern (z. B. „füg einen Radiergummi hinzu", „mach die Knöpfe größer", „das soll auch PDFs können"). Nur möglich, wenn eine App offen ist. "wunsch" = der Änderungswunsch, klar formuliert.
- "neu": Er möchte etwas, das es noch nicht gibt und nicht in die offene App gehört – eine neue App, ein neues Design, oder z. B. zwei Apps verbinden/kombinieren (dann eine neue App, die beides zusammenführt, oder – wenn es klar zur offenen App gehört – "verbessern"). "wunsch" = vollständige Beschreibung, was gebaut werden soll (inkl. der beteiligten Apps).
- "suchen": Er sucht ein Werkzeug/eine App oder fragt, ob es etwas gibt. Wähle aus dem Katalog die passenden Einträge (bis 5, beste zuerst) in "apps" – auch bei ganz anderem Wortlaut. Gibt es nichts Passendes, ist es "neu".
- "oeffnen": Er möchte eine bestimmte vorhandene App öffnen/wechseln („öffne den Fileconverter", „zurück zum Paintboard") → "apps" = genau diese.
- "pitch": Er möchte Hello World SELBST verändern (die Startseite, den Chat, das Hello-World-Fenster, den Bauablauf, das Programm, neue Funktionen von Hello World – nicht eine einzelne App), z. B. „Hello World sollte einen Dunkelmodus-Schalter haben", „der Chat soll Sprachnachrichten können". Solche Änderungen werden als Pitch vorgeschlagen; andere stimmen ab. "wunsch" = die Idee, klar formuliert.
- "antwort": Eine Frage oder Plauderei, die mit Text beantwortet ist (Bedienung, was eine App kann, Hilfe).
"antwort": immer 1–3 kurze, freundliche Sätze auf Deutsch, die sagen, was jetzt passiert bzw. die Antwort. Keine Fachbegriffe.
Ist eine App offen, bezieht sich „diese/die App/hier/das" auf sie. Bevorzuge "verbessern", wenn sich der Wunsch sinnvoll auf die offene App bezieht.`;

const SCHEMA = {
  type: 'object', additionalProperties: false, required: ['aktion', 'antwort', 'apps', 'wunsch'],
  properties: {
    aktion: { type: 'string', enum: ['verbessern', 'neu', 'suchen', 'oeffnen', 'pitch', 'antwort'] },
    antwort: { type: 'string' },
    apps: { type: 'array', items: { type: 'string' } },
    wunsch: { type: 'string' },
  },
};

const PRAEFIX = { browser: 'app', server: 'server', skill: 'skill', mcp: 'mcp', design: 'design' };
const auftraege = new Map();
setInterval(() => { for (const [id, a] of auftraege) if (Date.now() - a.seit > 20 * 60e3) auftraege.delete(id); }, 60e3);

export function starten({ ki, nachricht, kontext, verlauf, katalog }) {
  const offen = kontext?.slug ? katalog.find((a) => a.slug === kontext.slug) : null;
  const liste = katalog.map((a) => `- ${a.slug} (${PRAEFIX[a.typ || 'browser']}.${a.slug}): ${a.beschreibung} | kann: ${(a.funktionen || []).slice(0, 8).join('; ')}`).join('\n');
  const frage = [
    offen ? `GERADE OFFEN: ${PRAEFIX[offen.typ || 'browser']}.${offen.slug}${kontext.version ? `@${kontext.version}` : ''} – ${offen.beschreibung}\nFunktionen: ${(offen.funktionen || []).join('; ')}` : 'Gerade ist keine App offen (Startseite).',
    verlauf?.length ? `Bisheriger Chat (kurz):\n${verlauf.slice(-6).map((v) => `${v.wer === 'ich' ? 'Nutzer' : 'Hello World'}: ${String(v.text).slice(0, 300)}`).join('\n')}` : '',
    `Katalog:\n${liste}`,
    `Neue Nachricht des Nutzers: „${nachricht}"`,
  ].filter(Boolean).join('\n\n');
  const id = crypto.randomBytes(8).toString('hex');
  const auftrag = { status: 'laeuft', seit: Date.now() };
  auftraege.set(id, auftrag);
  kiJson(ki, SYSTEM, frage, SCHEMA)
    .then((d) => {
      const bekannt = new Set(katalog.map((a) => a.slug));
      const apps = (d.apps || []).map((s) => String(s).replace(/^(app|server|skill|mcp|design)\./, '')).filter((s) => bekannt.has(s)).slice(0, 5);
      let aktion = d.aktion;
      if (aktion === 'verbessern' && !offen) aktion = 'neu';
      if ((aktion === 'suchen' || aktion === 'oeffnen') && !apps.length) aktion = 'neu';
      Object.assign(auftrag, { status: 'fertig', ergebnis: { aktion, antwort: String(d.antwort || '').slice(0, 600), apps, wunsch: String(d.wunsch || nachricht).slice(0, 1000) } });
    })
    .catch((err) => Object.assign(auftrag, { status: 'fehler', fehler: String(err.message || err).slice(0, 300) }));
  return { id };
}
export const stand = (id) => auftraege.get(id) || { status: 'fehler', fehler: 'Unbekannt – bitte nochmal schreiben.' };
