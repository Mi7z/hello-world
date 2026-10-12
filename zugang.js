// Handy-Zugang: Hello World läuft auf dem PC oder einem Server und wird vom Handy aus
// bedient (im WLAN oder unterwegs über Tailscale). Sicher durch Kopplung: Nur Geräte,
// die einmal mit einem Code vom PC verbunden wurden, kommen hinein – auch im selben WLAN
// nicht ohne. Der PC selbst (Programmfenster) ist immer erlaubt.
// Aktiv, wenn HW_ZUGANG=1 (Programm und Server-Installation).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';

export const AN = process.env.HW_ZUGANG === '1';
let DATEI;
const codes = new Map(); // Kopplungscode → gültig bis
const versuche = new Map(); // Fehlversuche pro Adresse
setInterval(() => { versuche.clear(); for (const [c, bis] of codes) if (bis < Date.now()) codes.delete(c); }, 60e3);

export function einrichten({ daten }) { DATEI = path.join(daten, 'zugang.json'); fs.mkdirSync(daten, { recursive: true }); }
const laden = () => { try { return JSON.parse(fs.readFileSync(DATEI, 'utf8')); } catch { return { offen: false, geraete: {} }; } };
const speichern = (d) => fs.writeFileSync(DATEI, JSON.stringify(d, null, 1), { mode: 0o600 });
const hash = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');

// Der Rechner selbst: Anfrage von 127.0.0.1 und NICHT über einen Vermittler
// (z. B. „tailscale serve" leitet von außen über 127.0.0.1 weiter – das zählt als außen)
export function istRechner(req) {
  const ip = (req.socket.remoteAddress || '').replace('::ffff:', '');
  if (ip !== '127.0.0.1' && ip !== '::1') return false;
  return !req.headers['x-forwarded-for'] && !Object.keys(req.headers).some((h) => h.startsWith('tailscale-'));
}
function keks(req, name) {
  const m = String(req.headers.cookie || '').match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : null;
}
// Gekoppeltes Gerät dieser Anfrage (oder null)
let zuletztGespeichert = 0;
export function geraet(req) {
  const token = keks(req, 'hw_geraet');
  if (!token) return null;
  const d = laden();
  const id = Object.keys(d.geraete).find((k) => d.geraete[k].hash === hash(token));
  if (!id) return null;
  if (Date.now() - zuletztGespeichert > 60e3) { d.geraete[id].zuletzt = Date.now(); speichern(d); zuletztGespeichert = Date.now(); }
  return { id, ...d.geraete[id] };
}
export const erlaubt = (req) => !AN || istRechner(req) || Boolean(geraet(req));

// Ohne Kopplung erreichbar: nur die Kopplungsseite und was sie zum Aussehen braucht
const OFFEN = [/^\/koppeln$/, /^\/api\/koppeln$/, /^\/style\.css$/, /^\/design\.js$/, /^\/api\/design\/[a-z0-9.@-]+\.css$/, /^\/icon(-512)?\.(svg|png)$/, /^\/manifest\.webmanifest$/];
export const ohneKopplung = (pfad) => OFFEN.some((m) => m.test(pfad));

export function offen() { return AN && Boolean(laden().offen); }
export function offenSetzen(an) { const d = laden(); d.offen = Boolean(an); speichern(d); }

export function codeErstellen() {
  const code = crypto.randomBytes(3).toString('hex').toUpperCase().replace(/(...)(...)/, '$1-$2');
  codes.set(code, Date.now() + 10 * 60e3);
  return { code, gueltigBis: codes.get(code) };
}
export function koppeln(req, { code, name }) {
  const ip = req.socket.remoteAddress || '';
  const n = (versuche.get(ip) || 0) + 1;
  versuche.set(ip, n);
  if (n > 10) throw Object.assign(new Error('Zu viele Versuche – bitte eine Minute warten.'), { status: 429 });
  const c = String(code || '').toUpperCase().replace(/[^A-F0-9]/g, '').replace(/(...)(...)/, '$1-$2');
  if (!codes.has(c) || codes.get(c) < Date.now()) throw Object.assign(new Error('Code unbekannt oder abgelaufen – erstelle am PC einen neuen.'), { status: 403 });
  codes.delete(c); // nur einmal gültig
  const token = crypto.randomBytes(32).toString('hex');
  const d = laden();
  const id = 'g' + crypto.randomBytes(5).toString('hex');
  d.geraete[id] = { name: String(name || 'Handy').slice(0, 60), seit: Date.now(), zuletzt: Date.now(), hash: hash(token) };
  speichern(d);
  const sicher = req.headers['x-forwarded-proto'] === 'https';
  return { token, keks: `hw_geraet=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${400 * 86400}${sicher ? '; Secure' : ''}` };
}
export function liste() {
  return Object.entries(laden().geraete).map(([id, g]) => ({ id, name: g.name, seit: g.seit, zuletzt: g.zuletzt }));
}
export function entfernen(id) { const d = laden(); delete d.geraete[id]; speichern(d); }

// Adressen, unter denen das Handy Hello World erreicht
export async function adressen(port) {
  const liste = [];
  for (const [name, netze] of Object.entries(os.networkInterfaces())) {
    for (const n of netze || []) {
      if (n.family !== 'IPv4' || n.internal) continue;
      const tailscale = n.address.startsWith('100.') || /tailscale/i.test(name);
      liste.push({ art: tailscale ? 'tailscale' : 'wlan', url: `http://${n.address}:${port}` });
    }
  }
  const ts = await tailscaleName();
  // Mit Tailscale-Namen nur diesen zeigen (merkt sich leichter als die 100.x-Nummer)
  return ts ? [...liste.filter((a) => a.art === 'wlan'), { art: 'tailscale', url: `http://${ts}:${port}` }] : liste;
}
let tsCache = { zeit: 0, name: null, installiert: false };
export async function tailscaleName() {
  if (Date.now() - tsCache.zeit < 300e3) return tsCache.name;
  const r = await new Promise((resolve) => execFile('tailscale', ['status', '--json'], { timeout: 5000 }, (err, aus) => resolve(err ? null : aus)));
  let name = null;
  try { name = String(JSON.parse(r).Self.DNSName || '').replace(/\.$/, '') || null; } catch { /* kein Tailscale */ }
  tsCache = { zeit: Date.now(), name, installiert: r !== null };
  return name;
}
export const tailscaleInstalliert = () => tsCache.installiert;
