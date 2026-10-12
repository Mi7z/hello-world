// Hello World als eigenes Programm: startet den Hello-World-Dienst im Hintergrund
// (nur für diesen Rechner erreichbar) und zeigt ihn in einem eigenen Fenster.
// Apps, Aufträge und Einstellungen liegen im Benutzerordner, nicht im Programm.
const { app, BrowserWindow, shell, Menu } = require('electron');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const net = require('node:net');
const path = require('node:path');

if (process.env.HW_TESTORDNER) app.setPath('userData', process.env.HW_TESTORDNER); // für automatische Tests
if (!app.requestSingleInstanceLock()) { app.quit(); return; }

const KERN = path.join(__dirname, 'hw'); // Kopie von Hello World (server.js, public, apps …)
const ORDNER = app.getPath('userData');
const APPS = path.join(ORDNER, 'apps');
let dienst = null, fenster = null, adresse = null;

// Beim ersten Start die mitgelieferten Apps in den Benutzerordner kopieren,
// später neu hinzugekommene ergänzen (eigene Änderungen bleiben unangetastet)
function appsVorbereiten() {
  fs.mkdirSync(APPS, { recursive: true });
  for (const name of fs.readdirSync(path.join(KERN, 'apps'))) {
    const ziel = path.join(APPS, name);
    if (!fs.existsSync(ziel)) fs.cpSync(path.join(KERN, 'apps', name), ziel, { recursive: true });
  }
}

// Fester Port (ab 8810), damit gekoppelte Handys ihre Adresse behalten
const frei = (port) => new Promise((resolve) => {
  const s = net.createServer().once('error', () => resolve(false)).listen(port, '0.0.0.0', () => s.close(() => resolve(true)));
});
async function freierPort() {
  const datei = path.join(ORDNER, 'port.txt');
  const alt = Number(fs.existsSync(datei) ? fs.readFileSync(datei, 'utf8') : 0);
  if (alt && await frei(alt)) return alt;
  for (let p = 8810; p < 8900; p++) if (await frei(p)) { fs.writeFileSync(datei, String(p)); return p; }
  throw new Error('Kein freier Port');
}

async function dienstStarten() {
  const port = await freierPort();
  dienst = spawn(process.execPath, [path.join(KERN, 'server.js')], {
    cwd: KERN,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', PORT: String(port), HW_ZUGANG: '1', HW_APPS: APPS, HW_DATEN: path.join(ORDNER, 'daten'), HW_PROGRAMM: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  dienst.stdout.on('data', (d) => process.stdout.write(d));
  dienst.stderr.on('data', (d) => process.stderr.write(d));
  adresse = `http://127.0.0.1:${port}`;
  // warten, bis der Dienst antwortet
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(`${adresse}/api/apps`)).ok) return; } catch { /* startet noch */ }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error('Hello World startet nicht');
}

function fensterOeffnen() {
  fenster = new BrowserWindow({
    width: 1280, height: 860, minWidth: 360, minHeight: 500,
    title: 'Hello World', show: !process.env.HW_TESTBILD, backgroundColor: '#0b0e0c', autoHideMenuBar: true,
    icon: path.join(KERN, 'public', 'icon-512.png'),
    webPreferences: { contextIsolation: true, sandbox: true },
  });
  Menu.setApplicationMenu(null);
  fenster.loadURL(adresse);
  // Automatischer Test: Bildschirmfoto speichern und beenden
  if (process.env.HW_TESTBILD) fenster.webContents.once('did-finish-load', () => setTimeout(async () => {
    if (process.env.HW_TESTWEG) { await fenster.loadURL(adresse + process.env.HW_TESTWEG); await new Promise((r) => setTimeout(r, 2500)); }
    fs.writeFileSync(process.env.HW_TESTBILD, (await fenster.webContents.capturePage()).toPNG());
    app.quit();
  }, 2500));
  // Fremde Seiten (z. B. GitHub-Links) im normalen Browser öffnen, nie im Programm
  const intern = (url) => url.startsWith(adresse);
  fenster.webContents.setWindowOpenHandler(({ url }) => { if (!intern(url)) shell.openExternal(url); return { action: intern(url) ? 'allow' : 'deny' }; });
  fenster.webContents.on('will-navigate', (ev, url) => { if (!intern(url)) { ev.preventDefault(); shell.openExternal(url); } });
  // Zurück/Vor wie im Browser: Alt+←/→, Maustasten
  fenster.webContents.on('before-input-event', (ev, i) => {
    if (i.type !== 'keyDown') return;
    if (i.alt && i.key === 'ArrowLeft' && fenster.webContents.navigationHistory.canGoBack()) fenster.webContents.navigationHistory.goBack();
    if (i.alt && i.key === 'ArrowRight' && fenster.webContents.navigationHistory.canGoForward()) fenster.webContents.navigationHistory.goForward();
    if ((i.control || i.meta) && i.key.toLowerCase() === 'r') fenster.webContents.reload();
  });
  fenster.on('app-command', (ev, cmd) => {
    if (cmd === 'browser-backward' && fenster.webContents.navigationHistory.canGoBack()) fenster.webContents.navigationHistory.goBack();
    if (cmd === 'browser-forward' && fenster.webContents.navigationHistory.canGoForward()) fenster.webContents.navigationHistory.goForward();
  });
}

app.on('second-instance', () => { if (fenster) { if (fenster.isMinimized()) fenster.restore(); fenster.focus(); } });
app.whenReady().then(async () => {
  appsVorbereiten();
  await dienstStarten();
  fensterOeffnen();
}).catch((err) => { console.error(err); app.quit(); });
app.on('window-all-closed', () => app.quit());
app.on('quit', () => { try { dienst?.kill(); } catch { /* schon weg */ } });
