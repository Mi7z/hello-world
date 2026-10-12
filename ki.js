// KI-Aufrufe auf dem Server: „Claude auf diesem PC" (claude -p) oder Claude mit
// eigenem API-Schlüssel des Nutzers (wird nur für die Dauer des Auftrags im
// Speicher gehalten, nie auf die Platte geschrieben).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import Anthropic from '@anthropic-ai/sdk';
import { freiFragen } from './freiki.js';

// ---------- KI-Programme auf dem Rechner des Nutzers (ohne API-Schlüssel) ----------
// Wer Claude Code, OpenAI Codex oder Gemini CLI installiert hat, nutzt sein eigenes Abo
// bzw. Google-Konto. Hello World ruft das Programm nur mit Text auf: ohne Werkzeuge
// bzw. schreibgeschützt, in einem leeren Arbeitsordner.
export const KI_PROGRAMME = {
  claude: { name: 'Claude Code', befehl: 'claude', abo: 'Claude-Abo' },
  codex: { name: 'OpenAI Codex', befehl: 'codex', abo: 'ChatGPT-Abo' },
  gemini: { name: 'Gemini CLI', befehl: 'gemini', abo: 'Google-Konto (kostenlos)' },
};
// Auch dort suchen, wo Programme oft liegen, die nicht im PATH eines Fensters stehen
const ORTE = [
  ...(process.env.PATH || '').split(path.delimiter),
  path.join(os.homedir(), '.local', 'bin'), path.join(os.homedir(), '.npm-global', 'bin'), path.join(os.homedir(), '.claude', 'local'),
  path.join(os.homedir(), '.bun', 'bin'), '/usr/local/bin', '/usr/bin', '/opt/homebrew/bin', '/snap/bin',
  ...(process.env.APPDATA ? [path.join(process.env.APPDATA, 'npm')] : []),
].filter(Boolean);
const gefunden = new Map();
export function programmFinden(id) {
  if (gefunden.has(id)) return gefunden.get(id);
  const befehl = KI_PROGRAMME[id]?.befehl;
  const namen = process.platform === 'win32' ? [`${befehl}.cmd`, `${befehl}.exe`, befehl] : [befehl];
  let pfad = null;
  for (const ort of ORTE) for (const n of namen) {
    const p = path.join(ort, n);
    try { if (!pfad && fs.statSync(p).isFile()) pfad = p; } catch { /* nicht da */ }
  }
  gefunden.set(id, pfad);
  return pfad;
}
export function gefundeneProgramme() {
  return Object.entries(KI_PROGRAMME).filter(([id]) => programmFinden(id)).map(([id, p]) => ({ id, name: p.name, abo: p.abo }));
}
// Altes Kürzel: Claude-Pfad (für die Anzeige „KI auf diesem PC verfügbar")
export const CLAUDE = programmFinden('claude') || '/usr/bin/claude';

const arbeitsordner = () => { const o = path.join(os.homedir(), '.hello-world-ki'); fs.mkdirSync(o, { recursive: true }); return o; };

// Ein Programm starten, Eingabe über stdin, Ausgabe einsammeln
function ausfuehren(pfad, args, eingabe, zeitlimit) {
  return new Promise((resolve, reject) => {
    const kind = spawn(pfad, args, { cwd: arbeitsordner(), shell: process.platform === 'win32' && /\.cmd$/i.test(pfad) });
    let aus = '', fehler = '';
    const uhr = setTimeout(() => { kind.kill(); reject(new Error('Zeitüberschreitung der KI')); }, zeitlimit);
    kind.stdout.on('data', (d) => (aus += d));
    kind.stderr.on('data', (d) => (fehler += d));
    kind.on('error', (e) => { clearTimeout(uhr); reject(e); });
    kind.on('close', (code) => { clearTimeout(uhr); resolve({ aus, fehler, code }); });
    kind.stdin.end(eingabe);
  });
}

// Bilder (für Apps mit eigener KI, z. B. Skizze erkennen) als Dateien in einem eigenen Ordner
function bilderAblegen(bilder = []) {
  if (!bilder.length) return null;
  const ordner = fs.mkdtempSync(path.join(os.tmpdir(), 'hw-bilder-'));
  const pfade = bilder.slice(0, 4).map((b, i) => {
    const endung = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' }[b.typ] || 'png';
    const p = path.join(ordner, `bild-${i + 1}.${endung}`);
    fs.writeFileSync(p, Buffer.from(b.base64, 'base64'));
    return p;
  });
  return { ordner, pfade, weg: () => fs.rmSync(ordner, { recursive: true, force: true }) };
}

export async function claudeFragen(system, frage, schema = null, zeitlimit = 900e3, { web = false, bilder = [] } = {}) {
  // Websuche nur für die Vorbilder-Recherche; Bilder: nur Lesen des Bilder-Ordners erlaubt
  const ablage = bilderAblegen(bilder);
  const werkzeuge = web ? ['--tools', 'WebSearch,WebFetch', '--allowedTools', 'WebSearch,WebFetch']
    : ablage ? ['--tools', 'Read', '--allowedTools', 'Read', '--add-dir', ablage.ordner] : ['--tools', ''];
  const args = ['-p', '--system-prompt', system, ...werkzeuge, '--strict-mcp-config', '--setting-sources', '', '--no-session-persistence', '--output-format', 'json'];
  if (schema) args.push('--json-schema', JSON.stringify(schema)); // erzwingt gültiges JSON
  if (ablage) frage = `Sieh dir zuerst diese Bilder an (mit dem Read-Werkzeug öffnen): ${ablage.pfade.join(', ')}\n\n${frage}`;
  let aus;
  try { ({ aus } = await ausfuehren(programmFinden('claude') || '/usr/bin/claude', args, frage, zeitlimit)); } finally { ablage?.weg(); }
  let r;
  try { r = JSON.parse(aus); } catch { throw new Error('Claude hat nicht geantwortet'); }
  if (r.is_error) throw new Error(String(r.result || 'Claude-Fehler').slice(0, 300));
  return r.structured_output ? JSON.stringify(r.structured_output) : String(r.result || '');
}

const OHNE_WERKZEUGE = 'WICHTIG: Benutze keine Werkzeuge, führe keine Befehle aus und lies keine Dateien. Antworte ausschließlich mit Text.';

async function codexFragen(system, frage, schema = null, zeitlimit = 900e3, { bilder = [] } = {}) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hw-codex-'));
  const ablage = bilderAblegen(bilder);
  try {
    const ergebnis = path.join(tmp, 'antwort.txt');
    const args = ['exec', '--sandbox', 'read-only', '--skip-git-repo-check', '--ephemeral', '--color', 'never', '-C', arbeitsordner(), '-o', ergebnis];
    if (schema) { fs.writeFileSync(path.join(tmp, 'schema.json'), JSON.stringify(schema)); args.push('--output-schema', path.join(tmp, 'schema.json')); }
    for (const p of ablage?.pfade || []) args.push('-i', p);
    args.push('-');
    const eingabe = `${system}\n\n${OHNE_WERKZEUGE}${schema ? '\nAntworte NUR mit gültigem JSON nach dem vorgegebenen Schema.' : ''}\n\n---\n\n${frage}`;
    const { fehler, code } = await ausfuehren(programmFinden('codex'), args, eingabe, zeitlimit);
    const text = fs.existsSync(ergebnis) ? fs.readFileSync(ergebnis, 'utf8') : '';
    if (!text.trim()) {
      // Manche Schemas mag Codex nicht – dann ohne Schema nochmal (das JSON prüft kiJson)
      if (schema) return codexFragen(system + `\n\nAntworte AUSSCHLIESSLICH mit gültigem JSON nach diesem Schema:\n${JSON.stringify(schema)}`, frage, null, zeitlimit, { bilder });
      throw new Error(`Codex hat nicht geantwortet${code ? ` (${fehler.trim().split('\n').at(-1)?.slice(0, 200) || code})` : ''}`);
    }
    return text;
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); ablage?.weg(); }
}

async function geminiFragen(system, frage, schema = null, zeitlimit = 900e3, { bilder = [] } = {}) {
  const ablage = bilderAblegen(bilder);
  const args = ['-p', `Bearbeite die Aufgabe aus der Eingabe genau wie beschrieben.${ablage ? ' Bilder: ' + ablage.pfade.map((p) => '@' + p).join(' ') : ''}`, '--output-format', 'json', '--approval-mode', 'default'];
  const eingabe = `${system}\n\n${OHNE_WERKZEUGE}${schema ? `\nAntworte AUSSCHLIESSLICH mit gültigem JSON nach diesem Schema:\n${JSON.stringify(schema)}` : ''}\n\n---\n\n${frage}`;
  let aus, fehler;
  try { ({ aus, fehler } = await ausfuehren(programmFinden('gemini'), args, eingabe, zeitlimit)); } finally { ablage?.weg(); }
  try {
    const r = JSON.parse(aus);
    if (r.error) throw new Error(String(r.error.message || r.error).slice(0, 300));
    return String(r.response || '');
  } catch (err) {
    if (aus.trim() && !aus.trim().startsWith('{')) return aus; // ältere Version ohne JSON-Ausgabe
    throw new Error(`Gemini CLI: ${err.message || fehler.slice(0, 200)}`);
  }
}

// Welches Programm? Gewähltes, sonst das erste gefundene (Claude zuerst)
function programmFragen(ki, system, frage, schema, opts = {}) {
  const id = ki?.programm && programmFinden(ki.programm) ? ki.programm : gefundeneProgramme()[0]?.id;
  if (!id) throw new Error('Auf diesem Rechner ist kein KI-Programm (Claude Code, Codex, Gemini CLI) installiert.');
  if (id === 'claude') return claudeFragen(system, frage, schema, 900e3, opts);
  return { codex: codexFragen, gemini: geminiFragen }[id](system, frage, schema, 900e3, opts);
}

// ki = { art: 'lokal', programm: 'claude'|'codex'|'gemini' }, { art: 'anthropic', schluessel, modell } oder { art: 'frei', schluessel: { gemini, groq, … } }
export async function kiFragen(ki, system, frage, schema = null, opts = {}) {
  if (!ki || ki.art === 'lokal') return programmFragen(ki, system, frage, schema, opts);
  if (ki.art === 'frei') return freiFragen(ki.schluessel, system, frage, schema, opts);
  const client = new Anthropic({ apiKey: ki.schluessel });
  const stream = client.messages.stream({
    model: ki.modell || 'claude-opus-5',
    max_tokens: 64000,
    system,
    messages: [{ role: 'user', content: opts.bilder?.length ? [...opts.bilder.slice(0, 4).map((b) => ({ type: 'image', source: { type: 'base64', media_type: b.typ || 'image/png', data: b.base64 } })), { type: 'text', text: frage }] : frage }],
    ...(schema ? { output_config: { format: { type: 'json_schema', schema } } } : {}),
  });
  const antwort = await stream.finalMessage();
  if (antwort.stop_reason === 'refusal') throw new Error('Die KI hat die Anfrage abgelehnt.');
  return antwort.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
}

export async function kiJson(ki, system, frage, schema, opts = {}) {
  const text = await kiFragen(ki, system, frage, schema, opts);
  const lesen = (t) => { const m = t.match(/\{[\s\S]*\}/); if (!m) throw new Error('Keine verwertbare Antwort der KI'); return JSON.parse(m[0]); };
  try { return lesen(text); } catch {
    return lesen(await kiFragen(ki, 'Du reparierst kaputtes JSON. Gib NUR das korrigierte, gültige JSON zurück, ohne Erklärung.', text));
  }
}

export function htmlAus(text) {
  const block = text.match(/```html\s*([\s\S]*?)```/i);
  const html = (block ? block[1] : text).trim();
  const start = html.search(/<!doctype html|<html/i);
  return start >= 0 ? html.slice(start) : html;
}

// Recherche mit Internet, wo das KI-Programm es kann (Claude Code: Websuche);
// sonst aus dem Wissen der KI
export async function kiRecherche(ki, system, frage) {
  const lokalClaude = (!ki || ki.art === 'lokal') && (ki?.programm ? ki.programm === 'claude' : programmFinden('claude'));
  if (lokalClaude && programmFinden('claude')) return claudeFragen(system, frage, null, 300e3, { web: true });
  return kiFragen(ki, system + '\n\n(Du hast hier keinen Internetzugang – nutze dein Wissen über bekannte Apps und Tools.)', frage);
}
