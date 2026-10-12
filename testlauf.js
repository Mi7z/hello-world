// Testlauf einer App in einem unsichtbaren Browser auf dem PC – einmal als Handy,
// einmal als Desktop. Sammelt Fehler und meldet Inhalte, die seitlich überstehen.
// Braucht Chrome/Chromium (Pfad über CHROME oder Standard-Pfade) und Node mit WebSocket
// (Node 22+ oder Node 20 mit --experimental-websocket).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const KANDIDATEN = [
  process.env.CHROME,
  path.join(os.homedir(), '.cache/ms-playwright/chromium-1234/chrome-linux64/chrome'),
  '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/microsoft-edge', '/snap/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge', '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ...['PROGRAMFILES', 'PROGRAMFILES(X86)', 'LOCALAPPDATA'].flatMap((v) => (process.env[v] ? [path.join(process.env[v], 'Google', 'Chrome', 'Application', 'chrome.exe'), path.join(process.env[v], 'Microsoft', 'Edge', 'Application', 'msedge.exe')] : [])),
].filter(Boolean);
export const CHROME = KANDIDATEN.find((p) => fs.existsSync(p)) || null;

export const MELDER = `<script>window.__hwFehler=[];window.onerror=(m,q,z)=>{__hwFehler.push(String(m)+' (Zeile '+z+')')};addEventListener('unhandledrejection',e=>__hwFehler.push('Promise: '+(e.reason&&e.reason.message||e.reason)));document.addEventListener('securitypolicyviolation',e=>__hwFehler.push('Gesperrt durch Sicherheitsregel: '+e.blockedURI));<\/script>`;

export async function testlauf(url) {
  if (!CHROME || typeof WebSocket === 'undefined') return { fehler: [], hinweis: 'Testlauf übersprungen (kein Browser auf dem Server verfügbar)' };
  const profil = fs.mkdtempSync(path.join(os.tmpdir(), 'hw-test-'));
  const browser = spawn(CHROME, ['--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars', `--user-data-dir=${profil}`, '--remote-debugging-port=0', 'about:blank']);
  const aufraeumen = () => { try { browser.kill('SIGKILL'); } catch {} fs.rm(profil, { recursive: true, force: true }, () => {}); };
  try {
    const wsUrl = await new Promise((resolve, reject) => {
      let puffer = '';
      const uhr = setTimeout(() => reject(new Error('Test-Browser startet nicht')), 15000);
      browser.stderr.on('data', (d) => { puffer += d; const m = puffer.match(/ws:\/\/[^\s]+/); if (m) { clearTimeout(uhr); resolve(m[0]); } });
      browser.on('exit', () => reject(new Error('Test-Browser beendet')));
    });
    const ws = new WebSocket(wsUrl);
    await new Promise((r, j) => { ws.onopen = r; ws.onerror = () => j(new Error('Keine Verbindung zum Test-Browser')); });
    let id = 0; const offen = new Map();
    ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && offen.has(m.id)) { offen.get(m.id)(m); offen.delete(m.id); } };
    const senden = (method, params = {}, sessionId) => new Promise((r) => { const i = ++id; offen.set(i, r); ws.send(JSON.stringify({ id: i, method, params, ...(sessionId ? { sessionId } : {}) })); });

    const fehler = [];
    for (const g of [{ name: 'Handy', b: 390, h: 844, mobil: true }, { name: 'Desktop', b: 1280, h: 800, mobil: false }]) {
      const { result: { targetId } } = await senden('Target.createTarget', { url: 'about:blank' });
      const { result: { sessionId } } = await senden('Target.attachToTarget', { targetId, flatten: true });
      await senden('Emulation.setDeviceMetricsOverride', { width: g.b, height: g.h, deviceScaleFactor: 1, mobile: g.mobil }, sessionId);
      await senden('Page.enable', {}, sessionId);
      await senden('Page.navigate', { url }, sessionId);
      await new Promise((r) => setTimeout(r, 4500));
      const ausw = await senden('Runtime.evaluate', { expression: 'JSON.stringify({f:window.__hwFehler||["Seite nicht geladen"],w:document.documentElement.scrollWidth,v:innerWidth})', returnByValue: true }, sessionId);
      const d = JSON.parse(ausw.result?.result?.value || '{"f":["Testseite nicht auswertbar"],"w":0,"v":0}');
      for (const x of d.f) fehler.push(`${g.name}: ${x}`);
      if (d.w > d.v + 2) fehler.push(`${g.name}: Inhalt ragt seitlich über den Rand (${d.w} statt ${d.v} px breit)`);
      await senden('Target.closeTarget', { targetId });
    }
    ws.close();
    return { fehler: [...new Set(fehler)].slice(0, 10) };
  } finally {
    aufraeumen();
  }
}

// Baustein für Apps: helloworld.faehigkeit(name, parameter) – fragt über Hello World
// den gekoppelten Helfer an (mit Erlaubnis des Nutzers).
export const SDK = `<script>(()=>{let n=0;const o={};addEventListener('message',e=>{const d=e.data;if(d&&d.hwAntwort&&o[d.id]){const x=o[d.id];delete o[d.id];d.ok?x.r(d.ergebnis):x.j(new Error(d.fehler||'Abgelehnt'))}});const frag=(d)=>new Promise((r,j)=>{const id=++n;o[id]={r,j};parent.postMessage({...d,id},'*')});window.helloworld={faehigkeit:(name,parameter={})=>frag({hwSdk:'faehigkeit',name,parameter}),ki:(aufgabe,eingabe={})=>frag({hwSdk:'ki',aufgabe,eingabe}),werkzeug:(n,f)=>{(window.__hwWerkzeuge=window.__hwWerkzeuge||{})[n]=f}};})()<\/script>`;
// In Vorschau und Testlauf wird nie etwas ausgeführt
// helloworld.ki: in der Vorschau rechnet die echte KI (über die Vorschau-Seite), im
// unsichtbaren Testlauf kommt eine Beispiel-Antwort im festgelegten Format.
export const SDK_PROBE = `<script>(()=>{let n=0;const o={};addEventListener('message',e=>{const d=e.data;if(d&&d.hwAntwort&&o[d.id]){const x=o[d.id];delete o[d.id];d.ok?x.r(d.ergebnis):x.j(new Error(d.fehler||'Abgelehnt'))}});const bsp=s=>!s||typeof s!=='object'?null:s.enum?s.enum[0]:s.type==='object'?Object.fromEntries(Object.entries(s.properties||{}).map(([k,v])=>[k,bsp(v)])):s.type==='array'?[bsp(s.items)]:(s.type==='number'||s.type==='integer')?1:s.type==='boolean'?true:'Beispiel';window.helloworld={werkzeug:(n,f)=>{(window.__hwWerkzeuge=window.__hwWerkzeuge||{})[n]=f},faehigkeit:(name,parameter={})=>Promise.resolve({probe:true,faehigkeit:name,parameter,hinweis:'Vorschau – es wurde nichts ausgeführt'}),ki:(aufgabe,eingabe={})=>{if(parent!==window)return new Promise((r,j)=>{const id=++n;o[id]={r,j};parent.postMessage({hwSdk:'ki',id,aufgabe,eingabe},'*')});try{const a=JSON.parse(document.getElementById('hw-ki').textContent).aufgaben[aufgabe];if(!a)throw 0;return new Promise(r=>setTimeout(()=>r(bsp(a.schema)),300))}catch{return Promise.reject(new Error('Unbekannte KI-Aufgabe'))}}};})()<\/script>`;
export function einsetzen(html, ...bausteine) {
  const kopf = bausteine.join('');
  return /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, (m) => m + kopf) : kopf + html;
}
