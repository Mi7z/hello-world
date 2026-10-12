#!/usr/bin/env node
// Hello World – MCP-Server: die Schnittstelle, über die KIs (Claude Code, Codex,
// Claude Desktop …) den Hello-World-Katalog selbstständig nutzen.
// Ohne Abhängigkeiten; spricht JSON-RPC über stdin/stdout (MCP „stdio").
//
// Quelle des Katalogs: HELLO_WORLD_URL (Standard: http://localhost:8810).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';

const BASIS = (process.env.HELLO_WORLD_URL || 'http://localhost:8810').replace(/\/+$/, '');
const VERSION = '0.4.0';

async function holen(pfad, alsText = false) {
  const res = await fetch(BASIS + pfad, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`Hello World antwortet mit ${res.status} für ${pfad}`);
  return alsText ? res.text() : res.json();
}

const normal = (t) => String(t).toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');
const woerter = (t) => normal(t).split(/[^a-z0-9]+/).filter((w) => w.length > 2);
function bewerten(app, anfrage) {
  const gesucht = woerter(anfrage);
  if (!gesucht.length) return 0;
  const text = woerter(`${app.slug} ${app.titel} ${app.beschreibung} ${(app.tags || []).join(' ')} ${(app.funktionen || []).join(' ')} ${(app.beispiele || []).join(' ')} ${(app.stichworte || []).join(' ')} ${app.kategorie} ${app.typ}`);
  let p = 0;
  for (const g of gesucht) {
    if (text.includes(g)) p += 2;
    else if (g.length >= 4 && text.some((t) => t.startsWith(g.slice(0, 4)) || g.startsWith(t.slice(0, 4)))) p += 1;
  }
  return p / gesucht.length;
}

const PRAEFIX = { browser: 'app', server: 'server', skill: 'skill', mcp: 'mcp', design: 'design' };
const kennung = (x) => `${PRAEFIX[x.typ || 'browser']}.${x.slug}`;
const ohnePraefix = (s) => String(s || '').replace(/^(app|server|skill|mcp)\./, '');
const TYP_TEXT = {
  browser: 'App mit Oberfläche, läuft im Browser',
  server: 'Server-App, läuft beim Betreiber',
  skill: 'Skill für KIs (Anleitung/Fähigkeit)',
  mcp: 'MCP-Werkzeug für KIs (Hintergrundprogramm)',
};

const WERKZEUGE = [
  {
    name: 'suchen',
    description: 'Durchsucht Hello World nach Apps, Skills und KI-Werkzeugen. IMMER zuerst nutzen, wenn der Nutzer ein Werkzeug, eine App, eine Umwandlung, einen Rechner, eine Fähigkeit oder einen Arbeitsablauf braucht – bevor du selbst etwas baust. Optional nach Typ filtern.',
    inputSchema: {
      type: 'object',
      properties: {
        anfrage: { type: 'string', description: 'Was gebraucht wird, in eigenen Worten (z. B. „PDF in PNG umwandeln", „Text in einfache Sprache")' },
        typ: { type: 'string', enum: ['browser', 'server', 'skill', 'mcp'], description: 'Optional: nur diesen Typ' },
      },
      required: ['anfrage'],
    },
  },
  {
    name: 'details',
    description: 'Zeigt alles zu einem Eintrag: Steckbrief, Funktionen, Anleitung (README.md bzw. SKILL.md) und Dateiliste. Bei Skills: die Anleitung lesen und die Schritte befolgen.',
    inputSchema: { type: 'object', properties: { slug: { type: 'string', description: 'Name des Eintrags, z. B. app.paintboard oder skill.plainlanguage' } }, required: ['slug'] },
  },
  {
    name: 'datei_lesen',
    description: 'Liest eine Textdatei aus einem Eintrag (z. B. ein Skript oder eine Referenz, auf die eine SKILL.md verweist).',
    inputSchema: { type: 'object', properties: { slug: { type: 'string' }, pfad: { type: 'string', description: 'Pfad innerhalb des Eintrags, z. B. „referenz/regeln.md"' } }, required: ['slug', 'pfad'] },
  },
  {
    name: 'werkzeug_ausfuehren',
    description: 'Führt ein fertiges, geprüftes Werkzeug einer Hello-World-App direkt aus – z. B. PDF in PNG umwandeln, Bilder umwandeln/verkleinern, Bilder zu PDF. Dateien werden über ihren Pfad übergeben und die Ergebnisse als Dateien gespeichert; du musst sie NICHT selbst lesen oder verarbeiten (spart Tokens und ist zuverlässiger). Welche Werkzeuge es gibt und welche Eingaben sie brauchen, zeigen „suchen" und „details".',
    inputSchema: {
      type: 'object',
      properties: {
        app: { type: 'string', description: 'Die App, z. B. app.fileconverter' },
        werkzeug: { type: 'string', description: 'Name des Werkzeugs, z. B. pdf_zu_png' },
        eingabe: { type: 'object', description: 'Einstellungen laut „details", z. B. { "format": "jpg" }' },
        dateien: { type: 'array', items: { type: 'string' }, description: 'Absolute Pfade der Eingabedateien auf diesem Rechner' },
        ziel_ordner: { type: 'string', description: 'Wohin die Ergebnisdateien sollen (Standard: Ordner der ersten Eingabedatei)' },
      },
      required: ['app', 'werkzeug'],
    },
  },
  {
    name: 'app_oeffnen',
    description: 'Gibt den Link zu einer App mit Oberfläche zurück, den der Nutzer im Browser öffnen kann. Bei Server-Apps: Betreiber-Link bzw. Hinweis zum Selbst-Betreiben.',
    inputSchema: { type: 'object', properties: { slug: { type: 'string', description: 'Name des Eintrags, z. B. app.paintboard oder skill.plainlanguage' } }, required: ['slug'] },
  },
  {
    name: 'skill_installieren',
    description: 'Installiert einen Skill aus Hello World dauerhaft für Claude Code (~/.claude/skills) oder Codex (~/.codex/skills). NUR auf ausdrücklichen Wunsch des Nutzers verwenden; für einmalige Nutzung reicht „details".',
    inputSchema: { type: 'object', properties: { slug: { type: 'string' }, ziel: { type: 'string', enum: ['claude', 'codex'] } }, required: ['slug', 'ziel'] },
  },
  {
    name: 'github_suchen',
    description: 'Sucht auf GitHub nach vorhandenen Open-Source-Projekten (Bibliotheken, Skills, MCP-Server) für eine Aufgabe – mit Sternen und Lizenz. Vor dem Neubau eines Hello-World-Eintrags nutzen: Gibt es eine gute Lösung mit freier Lizenz (lizenz_ok), darauf aufbauen und die Quelle angeben.',
    inputSchema: { type: 'object', properties: { anfrage: { type: 'string', description: 'Englische Suchbegriffe, z. B. „markdown parser" oder „mcp server weather"' } }, required: ['anfrage'] },
  },
  {
    name: 'regeln',
    description: 'Liefert die verbindlichen Regeln (AGENTS.md), um in Hello World etwas Neues beizutragen oder eine vorhandene App/einen Skill zu erweitern. Vor jedem Beitrag lesen.',
    inputSchema: { type: 'object', properties: {} },
  },
];

async function ausfuehren(name, a = {}) {
  if (a.slug) a.slug = ohnePraefix(a.slug);
  if (name === 'suchen') {
    const { apps } = await holen('/api/apps');
    const treffer = apps.filter((x) => !a.typ || (x.typ || 'browser') === a.typ)
      .map((x) => ({ x, p: bewerten(x, a.anfrage || '') })).filter((t) => t.p >= 0.5)
      .sort((u, v) => v.p - u.p).slice(0, 10);
    if (!treffer.length) {
      return `Nichts Passendes zu „${a.anfrage}" gefunden. Es gibt ${apps.length} Einträge. Wenn der Nutzer möchte, kann es nach den Regeln (Werkzeug „regeln") neu beigetragen werden – bevorzugt als Erweiterung einer thematisch passenden vorhandenen App.`;
    }
    return treffer.map(({ x }) => `• ${kennung(x)} – ${TYP_TEXT[x.typ || 'browser']}\n  ${x.beschreibung}\n  Kann: ${(x.funktionen || []).join('; ')}${x.werkzeuge?.length ? `\n  Direkt ausführbar (werkzeug_ausfuehren): ${x.werkzeuge.map((w) => `${w.name} – ${w.beschreibung}`).join(' | ')}` : ''}`).join('\n');
  }
  if (name === 'details') {
    const d = await holen(`/api/app/${encodeURIComponent(a.slug)}`);
    const m = d.app;
    return [
      `${kennung(m)} – ${TYP_TEXT[m.typ || 'browser']}`,
      m.beschreibung,
      `Funktionen: ${(m.funktionen || []).join('; ')}`,
      (m.typ || 'browser') === 'browser' ? `Öffnen (Vollbild): ${BASIS}/a/${kennung(m)}` : '',
      m.server ? `Start: ${m.server.start || '–'} · Kosten: ${m.server.kosten || '–'}${m.server.betreiber_url ? ` · Betreiber: ${m.server.betreiber_url}` : ''}` : '',
      m.mcp ? `MCP-Einrichtung: ${JSON.stringify(m.mcp)}` : '',
      d.werkzeuge ? `\nDirekt ausführbare Werkzeuge (mit „werkzeug_ausfuehren" aufrufen, Dateien als Pfade):\n${Object.entries(d.werkzeuge).map(([n, w]) => `• ${n} – ${w.beschreibung}\n  Dateien: ${w.dateien} · Eingabe: ${JSON.stringify(w.eingabe)}${w.ausgabe ? `\n  Ergebnis: ${w.ausgabe}` : ''}`).join('\n')}` : '',
      `Dateien: ${(d.dateien || []).join(', ')}`,
      d.readme ? `\n--- Anleitung ---\n${d.readme}` : '',
    ].filter(Boolean).join('\n');
  }
  if (name === 'datei_lesen') {
    const pfad = String(a.pfad || '').split('/').map(encodeURIComponent).join('/');
    return holen(`/api/datei/${encodeURIComponent(a.slug)}/${pfad}`, true);
  }
  if (name === 'werkzeug_ausfuehren') {
    const TYPEN = { pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', bmp: 'image/bmp', svg: 'image/svg+xml', txt: 'text/plain', md: 'text/markdown', csv: 'text/csv', json: 'application/json', html: 'text/html', zip: 'application/zip', mp3: 'audio/mpeg', wav: 'audio/wav', mp4: 'video/mp4' };
    const pfade = (Array.isArray(a.dateien) ? a.dateien : []).map((p) => path.resolve(String(p).replace(/^~(?=\/|$)/, os.homedir())));
    const dateien = pfade.map((p) => {
      if (!fs.existsSync(p)) throw new Error(`Datei nicht gefunden: ${p}`);
      return { name: path.basename(p), typ: TYPEN[path.extname(p).slice(1).toLowerCase()] || '', base64: fs.readFileSync(p).toString('base64') };
    });
    const res = await fetch(`${BASIS}/api/werkzeug`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(200000),
      body: JSON.stringify({ slug: ohnePraefix(a.app), werkzeug: a.werkzeug, eingabe: a.eingabe || {}, dateien }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(d.fehler || `Hello World antwortet mit ${res.status}`);
    const ziel = path.resolve(String(a.ziel_ordner || (pfade[0] ? path.dirname(pfade[0]) : process.cwd())).replace(/^~(?=\/|$)/, os.homedir()));
    fs.mkdirSync(ziel, { recursive: true });
    const gespeichert = [];
    for (const f of d.dateien || []) {
      let p = path.join(ziel, path.basename(f.name));
      for (let i = 2; fs.existsSync(p); i++) p = path.join(ziel, path.basename(f.name).replace(/(\.[^.]*)?$/, `-${i}$1`)); // nichts überschreiben
      fs.writeFileSync(p, Buffer.from(f.base64, 'base64'));
      gespeichert.push(p);
    }
    return [`Fertig (${kennung({ slug: ohnePraefix(a.app) })} → ${a.werkzeug}).`, gespeichert.length ? `Gespeicherte Dateien:\n${gespeichert.map((p) => `• ${p}`).join('\n')}` : '', `Ergebnis: ${JSON.stringify(d.daten)}`].filter(Boolean).join('\n');
  }
  if (name === 'app_oeffnen') {
    const { app } = await holen(`/api/app/${encodeURIComponent(a.slug)}`);
    if ((app.typ || 'browser') === 'browser') return `Link für den Nutzer (öffnet ${kennung(app)} im Vollbild): ${BASIS}/a/${kennung(app)}\n(Läuft abgeschottet im Browser, Handy und Desktop; Dateien bleiben auf dem Gerät. Oben rechts „helloworld" öffnet das Menü zum Verbessern/Erweitern.)`;
    if (app.typ === 'server') return app.server?.betreiber_url ? `Betreiber-Instanz: ${app.server.betreiber_url}` : `Diese Server-App hat keine öffentliche Instanz. Anleitung zum Selbst-Betreiben: ${BASIS}/a/${kennung(app)}`;
    return `„${app.titel}" ist ein ${TYP_TEXT[app.typ]} und hat keine Oberfläche. Nutze „details", um damit zu arbeiten.`;
  }
  if (name === 'skill_installieren') {
    const d = await holen(`/api/app/${encodeURIComponent(a.slug)}`);
    if (d.app.typ !== 'skill') throw new Error(`„${a.slug}" ist kein Skill.`);
    const ziel = path.join(os.homedir(), a.ziel === 'codex' ? '.codex' : '.claude', 'skills', d.app.slug);
    for (const datei of d.dateien) {
      if (datei === 'hello.json') continue;
      const inhalt = await holen(`/api/datei/${d.app.slug}/${datei.split('/').map(encodeURIComponent).join('/')}`, true);
      const p = path.join(ziel, datei);
      if (!p.startsWith(ziel + path.sep)) continue;
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.writeFileSync(p, inhalt);
    }
    return `Skill „${d.app.titel}" installiert nach ${ziel}. Er steht ab der nächsten Sitzung automatisch zur Verfügung.`;
  }
  if (name === 'github_suchen') {
    const d = await holen(`/api/github?q=${encodeURIComponent(a.anfrage || '')}`);
    if (!d.treffer.length) return 'Nichts gefunden.';
    return d.treffer.slice(0, 10).map((t) => `• ${t.repo} ★${t.sterne} · Lizenz ${t.lizenz || 'keine'}${t.lizenz_ok ? ' (für Hello World erlaubt)' : ' (NICHT erlaubt)'} · ${t.sprache || ''}\n  ${t.beschreibung}\n  ${t.url}`).join('\n') + `\n\nErlaubte Lizenzen: ${d.erlaubteLizenzen.join(', ')}`;
  }
  if (name === 'regeln') return holen('/api/regeln', true);
  throw new Error(`Unbekanntes Werkzeug: ${name}`);
}

// ---------- MCP über stdio ----------
const senden = (nachricht) => process.stdout.write(JSON.stringify(nachricht) + '\n');
const rl = readline.createInterface({ input: process.stdin });
rl.on('line', async (zeile) => {
  if (!zeile.trim()) return;
  let n;
  try { n = JSON.parse(zeile); } catch { return senden({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }); }
  const { id, method, params } = n;
  if (id === undefined) return; // Benachrichtigungen (z. B. notifications/initialized)
  try {
    if (method === 'initialize') {
      return senden({ jsonrpc: '2.0', id, result: {
        protocolVersion: params?.protocolVersion || '2025-06-18',
        capabilities: { tools: {} },
        serverInfo: { name: 'hello-world', version: VERSION },
        instructions: 'Hello World ist eine offene Datenbank mit Apps, Skills und KI-Werkzeugen. Wenn der Nutzer ein Werkzeug braucht oder eine spezialisierte Aufgabe ansteht (z. B. Text vereinfachen, Dokument erstellen, Daten umwandeln), suche zuerst hier (Werkzeug „suchen"), bevor du selbst etwas baust oder es frei erledigst. Gefundene Skills: mit „details" lesen und befolgen. Hat eine App ein passendes Werkzeug (z. B. Datei umwandeln), führe es mit „werkzeug_ausfuehren" aus und übergib Dateien als Pfade, statt sie selbst zu lesen oder zu verarbeiten – das spart Tokens und nutzt geprüfte Lösungen.',
      } });
    }
    if (method === 'ping') return senden({ jsonrpc: '2.0', id, result: {} });
    if (method === 'tools/list') return senden({ jsonrpc: '2.0', id, result: { tools: WERKZEUGE } });
    if (method === 'tools/call') {
      try {
        const text = await ausfuehren(params?.name, params?.arguments || {});
        return senden({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: String(text) }] } });
      } catch (err) {
        return senden({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: `Fehler: ${err.message}` }], isError: true } });
      }
    }
    senden({ jsonrpc: '2.0', id, error: { code: -32601, message: `Unbekannte Methode: ${method}` } });
  } catch (err) {
    senden({ jsonrpc: '2.0', id, error: { code: -32603, message: err.message } });
  }
});
