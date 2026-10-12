// Anmeldung mit GitHub (Device Flow: kein Rückruf-Link nötig, funktioniert auch
// im Heimnetz). Gespeichert wird nur der GitHub-Name – das GitHub-Zugangs-Token
// wird nach dem Abruf des Namens sofort verworfen.
// Einrichtung: GitHub → Settings → Developer settings → OAuth Apps → New OAuth App,
// „Enable Device Flow" anhaken, Client-ID in daten/github-oauth.json eintragen:
//   { "client_id": "Ov23li…" }
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';

let DATEN;
const laufend = new Map(); // Anmeldevorgänge (device_code bleibt auf dem Server)
export function einrichten({ daten }) { DATEN = daten; fs.mkdirSync(DATEN, { recursive: true }); }

export function clientId() {
  try { return JSON.parse(fs.readFileSync(path.join(DATEN, 'github-oauth.json'), 'utf8')).client_id || null; } catch { return null; }
}

const sitzungsDatei = () => path.join(DATEN, 'sitzungen.json');
function sitzungen() { try { return JSON.parse(fs.readFileSync(sitzungsDatei(), 'utf8')); } catch { return {}; } }
function sitzungAnlegen(person) {
  const token = crypto.randomBytes(24).toString('hex');
  const s = sitzungen();
  s[token] = { ...person, seit: Date.now() };
  fs.writeFileSync(sitzungsDatei(), JSON.stringify(s, null, 1), { mode: 0o600 });
  return token;
}
export function person(req) {
  const token = req.headers['x-hw-sitzung'];
  if (!token) return null;
  return sitzungen()[token] || null;
}
export function abmelden(req) {
  const token = req.headers['x-hw-sitzung'];
  const s = sitzungen();
  if (token && s[token]) { delete s[token]; fs.writeFileSync(sitzungsDatei(), JSON.stringify(s, null, 1), { mode: 0o600 }); }
}

async function github(url, daten) {
  const res = await fetch(url, { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': 'Hello-World/1.0' }, body: JSON.stringify(daten), signal: AbortSignal.timeout(15000) });
  return res.json();
}

export async function starten() {
  const id = clientId();
  if (!id) throw Object.assign(new Error('Die GitHub-Anmeldung ist noch nicht eingerichtet.'), { status: 503 });
  const d = await github('https://github.com/login/device/code', { client_id: id, scope: 'read:user' });
  if (!d.device_code) throw new Error(d.error_description || 'GitHub-Anmeldung nicht möglich');
  const vorgang = crypto.randomBytes(12).toString('hex');
  laufend.set(vorgang, { device_code: d.device_code, intervall: (d.interval || 5) * 1000, naechste: 0, bis: Date.now() + d.expires_in * 1000 });
  return { vorgang, code: d.user_code, adresse: d.verification_uri, intervall: d.interval || 5 };
}

export async function status(vorgang) {
  const v = laufend.get(vorgang);
  if (!v) return { status: 'unbekannt' };
  if (Date.now() > v.bis) { laufend.delete(vorgang); return { status: 'abgelaufen' }; }
  if (Date.now() < v.naechste) return { status: 'warten' };
  v.naechste = Date.now() + v.intervall;
  const d = await github('https://github.com/login/oauth/access_token', { client_id: clientId(), device_code: v.device_code, grant_type: 'urn:ietf:params:oauth:grant-type:device_code' });
  if (d.error === 'authorization_pending') return { status: 'warten' };
  if (d.error === 'slow_down') { v.intervall += 5000; return { status: 'warten' }; }
  if (!d.access_token) { laufend.delete(vorgang); return { status: 'fehler', fehler: d.error_description || d.error }; }
  const res = await fetch('https://api.github.com/user', { headers: { Authorization: `Bearer ${d.access_token}`, 'User-Agent': 'Hello-World/1.0', Accept: 'application/vnd.github+json' } });
  const u = await res.json();
  laufend.delete(vorgang);
  if (!u.login) return { status: 'fehler', fehler: 'GitHub-Profil nicht lesbar' };
  return { status: 'fertig', sitzung: sitzungAnlegen({ login: u.login, name: u.name || u.login, bild: u.avatar_url }), person: { login: u.login, name: u.name || u.login, bild: u.avatar_url } };
}

// Solange GitHub nicht eingerichtet ist: vorläufige Anmeldung nur aus dem Heimnetz,
// deutlich als „lokal" gekennzeichnet.
export function lokalAnmelden(name) {
  const login = String(name || '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 39) || 'gast';
  const p = { login, name: String(name || login).slice(0, 60), lokal: true };
  return { sitzung: sitzungAnlegen(p), person: p };
}

// Besitzer des Hello-World-Rechners: das GitHub-Konto, mit dem der Rechner
// verbunden ist (GitHub-CLI „gh"). Seine Geräte im Heimnetz werden automatisch angemeldet.
let besitzerCache = { zeit: 0, person: null };
export async function besitzer() {
  if (Date.now() - besitzerCache.zeit < 3600e3) return besitzerCache.person;
  const person = await new Promise((resolve) => {
    execFile('gh', ['api', 'user'], { timeout: 15000 }, (err, aus) => {
      if (err) return resolve(null);
      try { const u = JSON.parse(aus); resolve(u.login ? { login: u.login, name: u.name || u.login, bild: u.avatar_url } : null); } catch { resolve(null); }
    });
  });
  besitzerCache = { zeit: Date.now(), person };
  return person;
}
export function automatischAnmelden(person) {
  return { sitzung: sitzungAnlegen({ ...person, automatisch: true }), person };
}
