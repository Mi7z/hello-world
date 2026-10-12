// Geräte mit Hello-World-Helfer: koppeln, Befehle weiterreichen, Ergebnisse zurück.
// Der Helfer verbindet sich nur ausgehend und holt seine Befehle ab („warten").
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { FAEHIGKEITEN, parameterPruefen } from './faehigkeiten.js';

let DATEI;
const befehle = new Map(); // Befehle leben nur im Speicher (kurzlebig)
const wartende = new Map(); // helfer_id → Funktion, die einen wartenden Abruf weckt
export function einrichten({ datei }) { DATEI = datei; fs.mkdirSync(path.dirname(DATEI), { recursive: true }); }

const laden = () => { try { return JSON.parse(fs.readFileSync(DATEI, 'utf8')); } catch { return {}; } };
const speichern = (h) => fs.writeFileSync(DATEI, JSON.stringify(h, null, 1), { mode: 0o600 });
const hash = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const online = (h) => Date.now() - (h.zuletzt || 0) < 45e3;

function helferVonAnfrage(req) {
  const geheimnis = String(req.headers.authorization || '').replace(/^Bearer /, '');
  if (!geheimnis) return null;
  const alle = laden();
  const id = Object.keys(alle).find((k) => alle[k].geheimnis === hash(geheimnis));
  return id ? { id, ...alle[id] } : null;
}

// ---------- Helfer-Seite ----------
export function anmelden({ name, system, plattform }) {
  const alle = laden();
  const id = 'h' + crypto.randomBytes(6).toString('hex');
  const geheimnis = crypto.randomBytes(24).toString('hex');
  const code = crypto.randomBytes(3).toString('hex').toUpperCase().replace(/(...)(...)/, '$1-$2');
  alle[id] = { name: String(name || 'Computer').slice(0, 60), system: String(system || '').slice(0, 80), plattform: String(plattform || '').slice(0, 20), geheimnis: hash(geheimnis), besitzer: null, code, codeBis: Date.now() + 15 * 60e3, zuletzt: Date.now() };
  speichern(alle);
  return { helfer_id: id, geheimnis, code };
}

export async function warten(req) {
  const h = helferVonAnfrage(req);
  if (!h) throw Object.assign(new Error('Helfer unbekannt'), { status: 401 });
  const alle = laden();
  alle[h.id].zuletzt = Date.now();
  speichern(alle);
  const offen = () => [...befehle.values()].filter((b) => b.helfer_id === h.id && b.status === 'wartet');
  if (!offen().length && h.besitzer) await new Promise((r) => { const uhr = setTimeout(r, 25000); wartende.set(h.id, () => { clearTimeout(uhr); r(); }); });
  wartende.delete(h.id);
  const liste = offen();
  for (const b of liste) b.status = 'gesendet';
  return { gekoppelt: Boolean(h.besitzer), code: h.besitzer ? null : h.code, befehle: liste.map((b) => ({ id: b.id, faehigkeit: b.faehigkeit, parameter: b.parameter, app: b.app, von: b.von })) };
}

export function ergebnis(req, { id, ok, ergebnis: e, fehler }) {
  const h = helferVonAnfrage(req);
  if (!h) throw Object.assign(new Error('Helfer unbekannt'), { status: 401 });
  const b = befehle.get(id);
  if (!b || b.helfer_id !== h.id) throw new Error('Befehl unbekannt');
  Object.assign(b, { status: ok ? 'erledigt' : 'fehler', ergebnis: e ?? null, fehler: fehler ? String(fehler).slice(0, 300) : null, fertig: Date.now() });
  return { ok: true };
}

// ---------- Nutzer-Seite ----------
export function koppeln(login, code) {
  const alle = laden();
  const c = String(code || '').toUpperCase().replace(/[^A-F0-9]/g, '').replace(/(...)(...)/, '$1-$2');
  const id = Object.keys(alle).find((k) => alle[k].code === c && !alle[k].besitzer && alle[k].codeBis > Date.now());
  if (!id) throw Object.assign(new Error('Code unbekannt oder abgelaufen – starte den Helfer neu für einen frischen Code.'), { status: 404 });
  alle[id].besitzer = login;
  alle[id].code = null;
  speichern(alle);
  return { id, name: alle[id].name };
}
export function meine(login) {
  return Object.entries(laden()).filter(([, h]) => h.besitzer === login).map(([id, h]) => ({ id, name: h.name, system: h.system, online: online(h), zuletzt: h.zuletzt }));
}
export function entfernen(login, id) {
  const alle = laden();
  if (alle[id]?.besitzer !== login) throw Object.assign(new Error('Nicht dein Gerät'), { status: 403 });
  delete alle[id];
  speichern(alle);
  return { ok: true };
}
function eigener(login, helfer_id) {
  const h = laden()[helfer_id];
  if (!h || h.besitzer !== login) throw Object.assign(new Error('Dieses Gerät gehört nicht zu deinem Konto'), { status: 403 });
  return h;
}
// Text für die Erlaubnis-Frage („… möchte deinen Computer „x" in 30 Minuten herunterfahren")
export function frage(login, { helfer_id, faehigkeit, parameter }) {
  const h = eigener(login, helfer_id);
  const p = parameterPruefen(faehigkeit, parameter);
  return { text: FAEHIGKEITEN[faehigkeit].frage(p, h.name), gefaehrlich: FAEHIGKEITEN[faehigkeit].gefaehrlich, online: online(h), parameter: p };
}
export function befehlAnlegen(login, { helfer_id, app, faehigkeiten, faehigkeit, parameter }) {
  eigener(login, helfer_id);
  if (!(faehigkeiten || []).includes(faehigkeit)) throw Object.assign(new Error(`Diese App darf „${faehigkeit}" nicht nutzen (steht nicht in ihrem Steckbrief).`), { status: 403 });
  const p = parameterPruefen(faehigkeit, parameter);
  const id = 'b' + crypto.randomBytes(8).toString('hex');
  befehle.set(id, { id, helfer_id, app, faehigkeit, parameter: p, von: login, status: 'wartet', erstellt: Date.now() });
  wartende.get(helfer_id)?.();
  return { id };
}
export function befehlStatus(login, id) {
  const b = befehle.get(id);
  if (!b || b.von !== login) throw Object.assign(new Error('Befehl unbekannt'), { status: 404 });
  if (b.status === 'wartet' && Date.now() - b.erstellt > 120e3) { b.status = 'fehler'; b.fehler = 'Der Helfer hat nicht geantwortet – ist der Computer an?'; }
  return { status: b.status, ergebnis: b.ergebnis, fehler: b.fehler };
}
// Alte Befehle aufräumen
setInterval(() => { for (const [id, b] of befehle) if (Date.now() - b.erstellt > 30 * 60e3) befehle.delete(id); }, 60e3);
