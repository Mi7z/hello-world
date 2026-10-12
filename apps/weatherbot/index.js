// Wetter-Bot für Telegram
// Schickt jeden Morgen zur eingestellten Zeit das Wetter für die Stadt eines Chats.
// Keine externen Pakete nötig: nutzt das eingebaute fetch von Node 20+ und eine
// einfache Minuten-Schleife als Zeitplan. Wetterdaten kommen von Open-Meteo
// (kostenlos, ohne Schlüssel). Der einzige geheime Wert ist der Bot-Token; er
// wird ausschließlich über die Umgebungsvariable TELEGRAM_BOT_TOKEN gelesen.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HIER = path.dirname(fileURLToPath(import.meta.url));

// ---- .env laden (falls vorhanden), ohne externes Paket --------------------
// Echte Schlüssel stehen nur in der lokalen .env, nie im Repository.
(function ladeEnv() {
  const datei = path.join(HIER, '.env');
  if (!fs.existsSync(datei)) return;
  for (const zeile of fs.readFileSync(datei, 'utf8').split(/\r?\n/)) {
    const m = zeile.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    const wert = m[2].replace(/^["']|["']$/g, '');
    if (process.env[m[1]] === undefined) process.env[m[1]] = wert;
  }
})();

// ---- Einstellungen (aus der Umgebung) -------------------------------------
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const STANDARD_ZEIT = (process.env.SENDE_ZEIT || '07:00').trim(); // HH:MM, lokale Zeit
const STANDARD_STADT = (process.env.STANDARD_STADT || '').trim();
const ABO_DATEI = process.env.ABO_DATEI || path.join(HIER, 'abos.json');

if (!TOKEN) {
  console.error('Fehler: Umgebungsvariable TELEGRAM_BOT_TOKEN ist nicht gesetzt.');
  console.error('Lege eine .env nach dem Muster von .env.beispiel an (siehe README.md).');
  process.exit(1);
}
if (!/^\d{1,2}:\d{2}$/.test(STANDARD_ZEIT)) {
  console.error(`Fehler: SENDE_ZEIT "${STANDARD_ZEIT}" ist keine Uhrzeit im Format HH:MM.`);
  process.exit(1);
}

const API = `https://api.telegram.org/bot${TOKEN}`;

// ---- Abos speichern (eine kleine JSON-Datei) ------------------------------
// Aufbau: { "<chatId>": { stadt, lat, lon, zeit, letzterVersand } }
function ladeAbos() {
  try {
    return JSON.parse(fs.readFileSync(ABO_DATEI, 'utf8'));
  } catch {
    return {};
  }
}
function speichereAbos(abos) {
  fs.writeFileSync(ABO_DATEI, JSON.stringify(abos, null, 2));
}
let abos = ladeAbos();

// ---- Telegram --------------------------------------------------------------
async function sende(chatId, text) {
  try {
    const r = await fetch(`${API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
    });
    const daten = await r.json();
    if (!daten.ok) console.error('sendMessage fehlgeschlagen:', daten.description);
    return daten.ok;
  } catch (e) {
    console.error('Netzwerkfehler beim Senden:', e.message);
    return false;
  }
}

// ---- Wetter (Open-Meteo, kostenlos & ohne Schlüssel) ----------------------
async function sucheOrt(name) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=de&format=json`;
  const r = await fetch(url);
  const daten = await r.json();
  const treffer = daten?.results?.[0];
  if (!treffer) return null;
  const teile = [treffer.name, treffer.admin1, treffer.country].filter(Boolean);
  return { lat: treffer.latitude, lon: treffer.longitude, anzeige: teile.join(', ') };
}

// Wettercodes von Open-Meteo in Text + Symbol übersetzen.
const WETTERTEXT = {
  0: ['klar', '☀️'], 1: ['überwiegend klar', '🌤️'], 2: ['teils bewölkt', '⛅'], 3: ['bewölkt', '☁️'],
  45: ['Nebel', '🌫️'], 48: ['gefrierender Nebel', '🌫️'],
  51: ['leichter Nieselregen', '🌦️'], 53: ['Nieselregen', '🌦️'], 55: ['starker Nieselregen', '🌦️'],
  56: ['gefrierender Niesel', '🌧️'], 57: ['gefrierender Niesel', '🌧️'],
  61: ['leichter Regen', '🌧️'], 63: ['Regen', '🌧️'], 65: ['starker Regen', '🌧️'],
  66: ['gefrierender Regen', '🌧️'], 67: ['gefrierender Regen', '🌧️'],
  71: ['leichter Schneefall', '🌨️'], 73: ['Schneefall', '🌨️'], 75: ['starker Schneefall', '❄️'],
  77: ['Schneegriesel', '🌨️'],
  80: ['leichte Schauer', '🌦️'], 81: ['Schauer', '🌦️'], 82: ['heftige Schauer', '⛈️'],
  85: ['Schneeschauer', '🌨️'], 86: ['starke Schneeschauer', '❄️'],
  95: ['Gewitter', '⛈️'], 96: ['Gewitter mit Hagel', '⛈️'], 99: ['schweres Gewitter mit Hagel', '⛈️'],
};

async function holeWetter(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}`
    + `&current=temperature_2m,weather_code`
    + `&daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max`
    + `&timezone=auto&forecast_days=1`;
  const r = await fetch(url);
  const d = await r.json();
  if (!d?.current || !d?.daily) return null;
  return {
    jetztTemp: Math.round(d.current.temperature_2m),
    jetztCode: d.current.weather_code,
    max: Math.round(d.daily.temperature_2m_max[0]),
    min: Math.round(d.daily.temperature_2m_min[0]),
    tagCode: d.daily.weather_code[0],
    regen: d.daily.precipitation_probability_max?.[0],
  };
}

function wetterText(anzeige, w) {
  const [jetztWort, jetztSym] = WETTERTEXT[w.jetztCode] || ['unbekannt', '🌡️'];
  const [tagWort, tagSym] = WETTERTEXT[w.tagCode] || ['wechselhaft', '🌡️'];
  const regen = (w.regen ?? null) === null ? '' : `\n☔ Regenwahrscheinlichkeit: ${w.regen}%`;
  return (
    `<b>Guten Morgen! Wetter für ${anzeige}</b>\n\n`
    + `${jetztSym} Jetzt: ${w.jetztTemp}°C, ${jetztWort}\n`
    + `${tagSym} Heute: ${w.min}° bis ${w.max}°C, ${tagWort}${regen}`
  );
}

async function wetterFuer(chatId, abo) {
  if (!abo?.lat) {
    await sende(chatId, 'Für diesen Chat ist noch keine Stadt eingestellt. Nutze <code>/stadt Berlin</code>.');
    return false;
  }
  const w = await holeWetter(abo.lat, abo.lon);
  if (!w) {
    await sende(chatId, 'Das Wetter konnte gerade nicht geladen werden. Bitte später erneut versuchen.');
    return false;
  }
  await sende(chatId, wetterText(abo.stadt, w));
  return true;
}

// ---- Befehle ---------------------------------------------------------------
const HILFE =
  '<b>Wetter-Bot</b> – ich schicke dir jeden Morgen das Wetter.\n\n'
  + '• <code>/stadt &lt;Ort&gt;</code> – deine Stadt einstellen, z. B. <code>/stadt München</code>\n'
  + '• <code>/zeit HH:MM</code> – Uhrzeit der täglichen Nachricht, z. B. <code>/zeit 07:00</code>\n'
  + '• <code>/jetzt</code> – Wetter sofort anzeigen\n'
  + '• <code>/stop</code> – tägliche Nachrichten abbestellen\n'
  + '• <code>/hilfe</code> – diese Übersicht';

async function behandle(nachricht) {
  const chatId = nachricht.chat?.id;
  const text = (nachricht.text || '').trim();
  if (!chatId || !text.startsWith('/')) return;

  // "/befehl@botname rest" -> befehl, rest
  const [roh, ...restTeile] = text.split(/\s+/);
  const befehl = roh.split('@')[0].toLowerCase();
  const rest = restTeile.join(' ').trim();

  if (befehl === '/start' || befehl === '/hilfe' || befehl === '/help') {
    if (befehl === '/start' && STANDARD_STADT && !abos[chatId]) {
      const ort = await sucheOrt(STANDARD_STADT);
      if (ort) {
        abos[chatId] = { stadt: ort.anzeige, lat: ort.lat, lon: ort.lon, zeit: STANDARD_ZEIT, letzterVersand: '' };
        speichereAbos(abos);
      }
    }
    await sende(chatId, HILFE);
    return;
  }

  if (befehl === '/stadt') {
    if (!rest) { await sende(chatId, 'Bitte einen Ort angeben, z. B. <code>/stadt Hamburg</code>.'); return; }
    const ort = await sucheOrt(rest);
    if (!ort) { await sende(chatId, `Den Ort „${rest}“ habe ich nicht gefunden. Schreibweise prüfen?`); return; }
    const vorher = abos[chatId] || {};
    abos[chatId] = { stadt: ort.anzeige, lat: ort.lat, lon: ort.lon, zeit: vorher.zeit || STANDARD_ZEIT, letzterVersand: '' };
    speichereAbos(abos);
    await sende(chatId, `Stadt gespeichert: <b>${ort.anzeige}</b>.\nDu bekommst das Wetter täglich um ${abos[chatId].zeit} Uhr. Teste jetzt mit /jetzt.`);
    return;
  }

  if (befehl === '/zeit') {
    if (!/^\d{1,2}:\d{2}$/.test(rest)) { await sende(chatId, 'Bitte eine Uhrzeit angeben, z. B. <code>/zeit 07:00</code>.'); return; }
    const [hh, mm] = rest.split(':').map(Number);
    if (hh > 23 || mm > 59) { await sende(chatId, 'Das ist keine gültige Uhrzeit (00:00 bis 23:59).'); return; }
    if (!abos[chatId]) { await sende(chatId, 'Stelle zuerst deine Stadt ein: <code>/stadt Berlin</code>.'); return; }
    abos[chatId].zeit = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    speichereAbos(abos);
    await sende(chatId, `Alles klar, ich melde mich täglich um <b>${abos[chatId].zeit}</b> Uhr.`);
    return;
  }

  if (befehl === '/jetzt') {
    await wetterFuer(chatId, abos[chatId]);
    return;
  }

  if (befehl === '/stop') {
    if (abos[chatId]) { delete abos[chatId]; speichereAbos(abos); }
    await sende(chatId, 'Du bekommst keine täglichen Nachrichten mehr. Mit /stadt kannst du jederzeit wieder starten.');
    return;
  }

  await sende(chatId, 'Das habe ich nicht verstanden. /hilfe zeigt alle Befehle.');
}

// ---- Eingehende Nachrichten (Long Polling) --------------------------------
let offset = 0;
let laeuft = true;

async function abfrageSchleife() {
  while (laeuft) {
    try {
      const r = await fetch(`${API}/getUpdates?timeout=30&offset=${offset}`);
      const daten = await r.json();
      if (daten.ok) {
        for (const update of daten.result) {
          offset = update.update_id + 1;
          if (update.message) await behandle(update.message);
        }
      } else if (daten.description) {
        console.error('getUpdates:', daten.description);
        await warte(3000);
      }
    } catch (e) {
      console.error('Verbindungsfehler, neuer Versuch in 5 s:', e.message);
      await warte(5000);
    }
  }
}
const warte = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- Täglicher Versand -----------------------------------------------------
// Jede Minute prüfen: Für welche Chats ist jetzt die eingestellte Zeit und
// heute wurde noch nicht gesendet?
function heuteStempel(d) {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}
async function pruefeVersand() {
  const jetzt = new Date();
  const hhmm = `${String(jetzt.getHours()).padStart(2, '0')}:${String(jetzt.getMinutes()).padStart(2, '0')}`;
  const heute = heuteStempel(jetzt);
  for (const [chatId, abo] of Object.entries(abos)) {
    if ((abo.zeit || STANDARD_ZEIT) !== hhmm) continue;
    if (abo.letzterVersand === heute) continue;
    const ok = await wetterFuer(chatId, abo);
    abo.letzterVersand = heute; // auch bei Fehler nicht im selben Minutenfenster spammen
    speichereAbos(abos);
    if (ok) console.log(`Wetter an Chat ${chatId} gesendet (${abo.stadt}).`);
  }
}

// ---- Start -----------------------------------------------------------------
async function setzeBefehlsmenue() {
  try {
    await fetch(`${API}/setMyCommands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        commands: [
          { command: 'stadt', description: 'Stadt einstellen, z. B. /stadt Berlin' },
          { command: 'zeit', description: 'Uhrzeit der Morgennachricht, z. B. /zeit 07:00' },
          { command: 'jetzt', description: 'Wetter sofort anzeigen' },
          { command: 'stop', description: 'Tägliche Nachrichten abbestellen' },
          { command: 'hilfe', description: 'Alle Befehle anzeigen' },
        ],
      }),
    });
  } catch { /* nicht kritisch */ }
}

process.on('SIGINT', () => { laeuft = false; console.log('\nWetter-Bot beendet.'); process.exit(0); });

console.log('Wetter-Bot gestartet.');
console.log(`Standard-Sendezeit: ${STANDARD_ZEIT} Uhr (lokale Zeit des Servers).`);
console.log(`${Object.keys(abos).length} Chat(s) abonniert.`);
await setzeBefehlsmenue();
setInterval(pruefeVersand, 60 * 1000);
abfrageSchleife();
