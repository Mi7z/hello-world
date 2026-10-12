#!/usr/bin/env node
// Hello-World-Helfer: läuft auf deinem Computer und führt NUR die Fähigkeiten aus
// faehigkeiten.js aus – nachdem du sie in Hello World erlaubt hast.
// Er verbindet sich von selbst mit Hello World (nur ausgehend, kein offener Port).
//
// Start:   node helfer.js [--server https://…] [--probe]
//   --probe   tut nur so (zum Ausprobieren, fährt nichts herunter)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { FAEHIGKEITEN, parameterPruefen } from '../faehigkeiten.js';

const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const PROBE = process.argv.includes('--probe') || process.env.HW_HELFER_PROBE === '1';
const KONFIG = process.env.HW_HELFER_KONFIG || path.join(os.homedir(), '.hello-world-helfer.json');
let konfig = {};
try { konfig = JSON.parse(fs.readFileSync(KONFIG, 'utf8')); } catch { /* erster Start */ }
konfig.server = (arg('--server') || konfig.server || 'http://127.0.0.1:8810').replace(/\/+$/, '');
const speichern = () => fs.writeFileSync(KONFIG, JSON.stringify(konfig, null, 2), { mode: 0o600 });

const log = (...t) => console.log(new Date().toLocaleTimeString('de-DE'), ...t);
const plattform = process.platform; // linux, win32, darwin
const geplant = { aktion: null, zeit: null, uhr: null };

function ausfuehren(befehl, args) {
  if (PROBE) { log(`[probe] würde ausführen: ${befehl} ${args.join(' ')}`); return Promise.resolve(); }
  return new Promise((resolve, reject) => execFile(befehl, args, { timeout: 20000 }, (err) => (err ? reject(err) : resolve())));
}

// Betriebssystem-Befehle für jede Fähigkeit (feste Befehle, keine Nutzereingaben im Befehl)
const SYSTEM = {
  herunterfahren: { linux: ['systemctl', ['poweroff']], win32: ['shutdown', ['/s', '/t', '0']], darwin: ['osascript', ['-e', 'tell app "System Events" to shut down']] },
  neustarten: { linux: ['systemctl', ['reboot']], win32: ['shutdown', ['/r', '/t', '0']], darwin: ['osascript', ['-e', 'tell app "System Events" to restart']] },
  ruhezustand: { linux: ['systemctl', ['suspend']], win32: ['rundll32.exe', ['powrprof.dll,SetSuspendState', '0,1,0']], darwin: ['pmset', ['sleepnow']] },
};

function planen(aktion, minuten) {
  const cmd = SYSTEM[aktion][plattform];
  if (!cmd) throw new Error(`Auf diesem Betriebssystem (${plattform}) nicht möglich`);
  if (geplant.uhr) clearTimeout(geplant.uhr);
  geplant.aktion = aktion;
  geplant.zeit = Date.now() + minuten * 60e3;
  geplant.uhr = setTimeout(async () => {
    log(`führe aus: ${aktion}`);
    Object.assign(geplant, { aktion: null, zeit: null, uhr: null });
    try { await ausfuehren(...cmd); } catch (err) { log('Fehler:', err.message); }
  }, minuten * 60e3);
  return { geplant: aktion, um: new Date(geplant.zeit).toISOString(), probe: PROBE };
}

async function faehigkeit(name, p) {
  switch (name) {
    case 'system.herunterfahren': return planen('herunterfahren', p.minuten);
    case 'system.neustarten': return planen('neustarten', p.minuten);
    case 'system.ruhezustand': return planen('ruhezustand', p.minuten);
    case 'system.abbrechen': {
      const war = geplant.aktion;
      if (geplant.uhr) clearTimeout(geplant.uhr);
      Object.assign(geplant, { aktion: null, zeit: null, uhr: null });
      return { abgebrochen: war };
    }
    case 'system.status':
      return { name: os.hostname(), system: `${os.type()} ${os.release()}`, geplant: geplant.aktion, um: geplant.zeit ? new Date(geplant.zeit).toISOString() : null, probe: PROBE };
    case 'benachrichtigung.zeigen': {
      const c = { linux: ['notify-send', [p.titel, p.text]], darwin: ['osascript', ['-e', `display notification ${JSON.stringify(p.text)} with title ${JSON.stringify(p.titel)}`]], win32: ['msg', ['*', `${p.titel}: ${p.text}`]] }[plattform];
      if (!c) throw new Error('Auf diesem Betriebssystem nicht möglich');
      await ausfuehren(...c);
      return { gezeigt: true };
    }
    default: throw new Error(`Unbekannte Fähigkeit: ${name}`);
  }
}

async function anfrage(pfad, daten) {
  const res = await fetch(konfig.server + pfad, {
    method: daten ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', ...(konfig.geheimnis ? { Authorization: `Bearer ${konfig.geheimnis}` } : {}) },
    body: daten ? JSON.stringify(daten) : undefined,
    signal: AbortSignal.timeout(40000),
  });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(d.fehler || `Server ${res.status}`), { status: res.status });
  return d;
}

async function koppeln() {
  const d = await anfrage('/api/helfer/anmelden', { name: os.hostname(), system: `${os.type()} ${os.release()}`, plattform });
  Object.assign(konfig, { helfer_id: d.helfer_id, geheimnis: d.geheimnis });
  speichern();
  log('──────────────────────────────────────────────');
  log(`Kopplungscode: ${d.code}`);
  log(`In Hello World unter „geräte" eingeben (gültig 15 Minuten).`);
  log('──────────────────────────────────────────────');
  if (plattform === 'linux' && !PROBE) execFile('notify-send', ['Hello-World-Helfer', `Kopplungscode: ${d.code}`], () => {});
}

async function schleife() {
  log(`Hello-World-Helfer startet (${plattform}${PROBE ? ', PROBE-MODUS' : ''}) – Server ${konfig.server}`);
  for (;;) {
    try {
      if (!konfig.geheimnis) await koppeln();
      const { befehle, gekoppelt, code } = await anfrage('/api/helfer/warten');
      if (!gekoppelt && code) { /* wartet noch auf Kopplung */ }
      for (const b of befehle || []) {
        let antwort;
        try {
          const p = parameterPruefen(b.faehigkeit, b.parameter);
          if (!FAEHIGKEITEN[b.faehigkeit]) throw new Error('Unbekannte Fähigkeit');
          log(`Befehl von ${b.app} (erlaubt von @${b.von}): ${b.faehigkeit} ${JSON.stringify(p)}`);
          antwort = { id: b.id, ok: true, ergebnis: await faehigkeit(b.faehigkeit, p) };
        } catch (err) {
          antwort = { id: b.id, ok: false, fehler: err.message };
        }
        await anfrage('/api/helfer/ergebnis', antwort);
      }
    } catch (err) {
      if (err.status === 401) { log('Kopplung ungültig – koppele neu'); delete konfig.geheimnis; speichern(); }
      else { log('Keine Verbindung:', err.message); await new Promise((r) => setTimeout(r, 10000)); }
    }
  }
}
schleife();
