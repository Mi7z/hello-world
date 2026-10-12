// Werkzeuge für KIs: Apps bieten ihre Hauptfunktionen zusätzlich als Werkzeuge an
// (z. B. „PDF in PNG umwandeln"). Eine KI ruft sie über den Hello-World-Connector auf –
// Hello World öffnet die App unsichtbar in einem Browser auf diesem Rechner, ruft die
// Funktion mit den Daten/Dateien auf und gibt das Ergebnis samt Dateien zurück.
// So muss die KI Dateien weder lesen noch selbst umrechnen: spart Tokens und nutzt
// geprüfte, ausgearbeitete Lösungen.
//
// In der App:  <script type="application/json" id="hw-werkzeuge">{ "werkzeuge": { … } }</script>
//              helloworld.werkzeug('pdf_zu_png', async (eingabe, dateien) => ({ dateien: [blob, …] }))
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { CHROME } from './testlauf.js';

const MAX_EINGABE = 40 * 1024 * 1024; // Dateien zusammen höchstens ~30 MB
let laufend = 0;
const warteschlange = [];
async function platz() {
  if (laufend < 2) { laufend++; return; }
  await new Promise((r) => warteschlange.push(r));
  laufend++;
}
function frei() { laufend--; warteschlange.shift()?.(); }

// Läuft im Browser: wartet auf das Werkzeug, ruft es auf, verpackt Dateien als base64
const SEITE = (name, eingabe, dateien) => `(async () => {
  const name = ${JSON.stringify(name)};
  const eingabe = JSON.parse(${JSON.stringify(JSON.stringify(eingabe ?? {}))});
  const roh = JSON.parse(${JSON.stringify(JSON.stringify(dateien))});
  for (let i = 0; i < 150 && !(window.__hwWerkzeuge || {})[name]; i++) await new Promise((r) => setTimeout(r, 100));
  const fn = (window.__hwWerkzeuge || {})[name];
  if (!fn) throw new Error('Diese App hat kein Werkzeug „' + name + '"');
  const ausB64 = (b64) => { const s = atob(b64); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; };
  const dateien = roh.map((d) => new File([ausB64(d.base64)], d.name, { type: d.typ || '' }));
  const ergebnis = await fn(eingabe, dateien);
  const raus = [];
  const zuB64 = async (b) => { const u = new Uint8Array(await b.arrayBuffer()); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
  const wandeln = async (x) => {
    if (x instanceof Blob) { const n = x.name || 'ergebnis-' + (raus.length + 1); raus.push({ name: n, typ: x.type, base64: await zuB64(x) }); return { datei: n }; }
    if (Array.isArray(x)) { const a = []; for (const y of x) a.push(await wandeln(y)); return a; }
    if (x && typeof x === 'object') {
      if (x.blob instanceof Blob) return wandeln(new File([x.blob], x.name || x.dateiname || 'ergebnis', { type: x.blob.type }));
      const o = {}; for (const [k, v] of Object.entries(x)) o[k] = await wandeln(v); return o;
    }
    return x;
  };
  const daten = await wandeln(ergebnis);
  return JSON.stringify({ daten, dateien: raus });
})()`;

export async function werkzeugAusfuehren({ adresse, name, eingabe, dateien = [] }) {
  if (!CHROME || typeof WebSocket === 'undefined') throw Object.assign(new Error('Für Werkzeuge braucht Hello World einen Browser auf diesem Rechner (Chrome, Chromium oder Edge).'), { status: 501 });
  const groesse = dateien.reduce((s, d) => s + String(d.base64 || '').length, 0);
  if (groesse > MAX_EINGABE) throw Object.assign(new Error('Die Dateien sind zu groß (zusammen höchstens etwa 30 MB).'), { status: 413 });
  await platz();
  const profil = fs.mkdtempSync(path.join(os.tmpdir(), 'hw-werkzeug-'));
  const browser = spawn(CHROME, ['--headless=new', '--no-sandbox', '--disable-gpu', `--user-data-dir=${profil}`, '--remote-debugging-port=0', 'about:blank']);
  const aufraeumen = () => { try { browser.kill('SIGKILL'); } catch { /* weg */ } fs.rm(profil, { recursive: true, force: true }, () => {}); frei(); };
  const uhr = setTimeout(() => { try { browser.kill('SIGKILL'); } catch { /* weg */ } }, 180e3);
  try {
    const wsUrl = await new Promise((resolve, reject) => {
      let puffer = '';
      const u = setTimeout(() => reject(new Error('Browser startet nicht')), 15000);
      browser.stderr.on('data', (d) => { puffer += d; const m = puffer.match(/ws:\/\/\S+/); if (m) { clearTimeout(u); resolve(m[0]); } });
      browser.on('exit', () => reject(new Error('Browser wurde beendet (Zeitüberschreitung?)')));
    });
    const ws = new WebSocket(wsUrl);
    await new Promise((r, j) => { ws.onopen = r; ws.onerror = () => j(new Error('Keine Verbindung zum Browser')); });
    let id = 0; const offen = new Map();
    ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && offen.has(m.id)) { offen.get(m.id)(m); offen.delete(m.id); } };
    const senden = (method, params = {}, sessionId) => new Promise((r) => { const i = ++id; offen.set(i, r); ws.send(JSON.stringify({ id: i, method, params, ...(sessionId ? { sessionId } : {}) })); });
    const { result: { targetId } } = await senden('Target.createTarget', { url: 'about:blank' });
    const { result: { sessionId } } = await senden('Target.attachToTarget', { targetId, flatten: true });
    await senden('Page.navigate', { url: adresse }, sessionId);
    for (let i = 0; i < 100; i++) { // warten, bis die App geladen ist
      const r = await senden('Runtime.evaluate', { expression: 'location.href + "|" + document.readyState', returnByValue: true }, sessionId);
      const [href, stand] = String(r.result?.result?.value || '').split('|');
      if (href !== 'about:blank' && stand === 'complete') break;
      await new Promise((x) => setTimeout(x, 150));
    }
    const r = await senden('Runtime.evaluate', { expression: SEITE(name, eingabe, dateien), awaitPromise: true, returnByValue: true }, sessionId);
    ws.close();
    if (r.result?.exceptionDetails) {
      const text = r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text || 'Fehler im Werkzeug';
      throw Object.assign(new Error(String(text).split('\n')[0].replace(/^Error: /, '').slice(0, 300)), { status: 422 });
    }
    return JSON.parse(r.result?.result?.value || '{}');
  } finally {
    clearTimeout(uhr);
    aufraeumen();
  }
}
