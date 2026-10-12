// Hello World – gemeinsamer Kern für Startseite und App-Menü.
// Gebaut wird komplett auf dem PC (Bau-Aufträge). Die Seite startet Aufträge und
// fragt regelmäßig den Stand ab – Handy aus oder Seite zu ist egal.
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const PRAEFIX = { browser: 'app', server: 'server', skill: 'skill', mcp: 'mcp', design: 'design' };
const kennung = (a) => `${PRAEFIX[a.typ || 'browser']}.${a.slug}`;

// ---------- Designs ----------
// Gewähltes Design (gilt für Hello World und alle Apps); design.js lädt es beim Start
const designName = () => new URLSearchParams(location.search).get('design') || localStorage.getItem('hw-design') || 'klar';
function designWaehlen(name) {
  localStorage.setItem('hw-design', name);
  const link = document.getElementById('hwDesign');
  if (link) link.href = `/api/design/${name}.css?t=${Date.now()}`;
  setTimeout(themaFarbe, 150);
  document.dispatchEvent(new CustomEvent('hw-design', { detail: name }));
}
// Statusleiste des Handys in der Hintergrundfarbe des Designs
function themaFarbe() {
  const m = document.querySelector('meta[name="theme-color"]');
  if (m) m.content = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || m.content;
}
addEventListener('load', themaFarbe);
// Erkennungszeichen eines Eintrags: Farbmuster bei Designs, sonst Emoji oder Anfangsbuchstabe
const SYMBOL_ERSATZ = { generator: '🎲', konverter: '🔁', bild: '🎨', text: '📝', werkzeug: '🛠️', bot: '🤖', skill: '💡', mcp: '🔌' };
function symbolHtml(a, extra = '') {
  const f = a.farben?.[0];
  if (a.typ === 'design' && f) return `<span class="symbol farben ${extra}" aria-hidden="true">${[f.bg, f.ak, f.fl, f.tx].map((c) => `<i style="background:${esc(c || 'transparent')}"></i>`).join('')}</span>`;
  return `<span class="symbol ${extra}" aria-hidden="true">${esc(a.symbol || SYMBOL_ERSATZ[a.kategorie] || SYMBOL_ERSATZ[a.typ] || (a.slug || '?')[0].toUpperCase())}</span>`;
}
const TYP_NAME = { browser: 'App', server: 'Server-App', skill: 'Skill', mcp: 'KI-Werkzeug', design: 'Design' };

// ---------- Deine KI ----------
function kiEinstellung() {
  try { return JSON.parse(localStorage.getItem('hw-ki') || 'null'); } catch { return null; }
}
// Was dem Auftrag mitgegeben wird: „lokal" oder der eigene Schlüssel (nur für diesen Auftrag)
function kiFuerAuftrag() {
  const k = kiEinstellung();
  if (k?.art === 'anthropic') return { art: 'anthropic', schluessel: k.schluessel, modell: k.modell };
  if (k?.art === 'frei') return { art: 'frei', schluessel: k.frei || {} };
  return { art: 'lokal' };
}

// ---------- Anmeldung mit GitHub ----------
const sitzung = () => localStorage.getItem('hw-sitzung');
let ich = null; // { login, name, bild, lokal }
// API-Aufruf mit Sitzung; bei „bitte anmelden" öffnet sich die Anmeldung
async function api(url, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  if (sitzung()) headers['X-HW-Sitzung'] = sitzung();
  if (localStorage.getItem('hw-kein-auto')) headers['X-HW-Kein-Auto'] = '1';
  if (opts.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
  const res = await fetch(url, { cache: 'no-store', ...opts, headers });
  const d = await res.json().catch(() => ({}));
  if (res.status === 401) { anmelden(); throw new Error(d.fehler || 'Bitte zuerst anmelden'); }
  if (!res.ok) throw new Error(d.fehler || 'Hat nicht geklappt');
  return d;
}
async function ichLaden() {
  const d = await api('/api/ich');
  if (d.sitzung) localStorage.setItem('hw-sitzung', d.sitzung); // automatisch angemeldet
  ich = d.person;
  document.querySelectorAll('[data-anmelde-knopf]').forEach(anmeldeKnopfZeigen);
  return d;
}
function anmeldeKnopfZeigen(k) {
  k.textContent = ich ? `@${ich.login}${ich.lokal ? ' (lokal)' : ''}` : 'Anmelden';
  k.classList.toggle('verbunden', Boolean(ich));
  k.onclick = () => (ich ? abmeldenFragen() : anmelden());
}
async function abmeldenFragen() {
  if (!confirm(`Du bist als @${ich.login} angemeldet${ich.automatisch ? ' (automatisch, weil das dein Gerät ist)' : ''}.\n\nAbmelden bzw. Konto wechseln?`)) return;
  await api('/api/abmelden', { method: 'POST' }).catch(() => {});
  localStorage.removeItem('hw-sitzung');
  if (ich.automatisch) localStorage.setItem('hw-kein-auto', '1'); // nicht sofort wieder automatisch anmelden
  ich = null;
  document.querySelectorAll('[data-anmelde-knopf]').forEach(anmeldeKnopfZeigen);
}
// Anmelde-Fenster: GitHub-Code anzeigen, im Hintergrund auf die Bestätigung warten
let anmeldungLaeuft = null;
async function anmelden() {
  let dlg = document.getElementById('hwAnmelden');
  if (!dlg) {
    dlg = document.createElement('dialog');
    dlg.id = 'hwAnmelden';
    dlg.className = 'blatt';
    document.body.appendChild(dlg);
  }
  const info = await fetch('/api/ich', { cache: 'no-store', headers: { 'X-HW-Kein-Auto': '1' } }).then((r) => r.json()).catch(() => ({}));
  const fertig = (d) => {
    localStorage.setItem('hw-sitzung', d.sitzung);
    localStorage.removeItem('hw-kein-auto');
    ich = d.person;
    document.querySelectorAll('[data-anmelde-knopf]').forEach(anmeldeKnopfZeigen);
    dlg.close();
    document.dispatchEvent(new CustomEvent('hw-angemeldet'));
  };
  if (info.github) {
    dlg.innerHTML = `<div class="blatt-inhalt"><h2>Mit GitHub anmelden</h2><p class="hinweis">Dein GitHub-Name wird als Ersteller bzw. Erweiterer eingetragen.</p><p id="hwAnmeldeText">Verbinde …</p><div class="knoepfe"><button type="button" class="zweit" id="hwAnmeldenZu">Abbrechen</button></div></div>`;
    dlg.querySelector('#hwAnmeldenZu').onclick = () => { anmeldungLaeuft = null; dlg.close(); };
    dlg.showModal();
    try {
      const st = await (await fetch('/api/anmelden/start', { method: 'POST' })).json();
      if (!st.vorgang) throw new Error(st.fehler || 'GitHub nicht erreichbar');
      anmeldungLaeuft = st.vorgang;
      dlg.querySelector('#hwAnmeldeText').innerHTML = `1. Öffne <a href="${esc(st.adresse)}" target="_blank" rel="noopener">${esc(st.adresse)}</a><br>2. Gib diesen Code ein:<div class="anmelde-code">${esc(st.code)}</div><span class="lade">Wartet auf GitHub …</span>`;
      while (anmeldungLaeuft === st.vorgang) {
        await new Promise((r) => setTimeout(r, (st.intervall || 5) * 1000));
        const s = await (await fetch(`/api/anmelden/status?vorgang=${st.vorgang}`)).json();
        if (s.status === 'fertig') return fertig(s);
        if (['abgelaufen', 'fehler', 'unbekannt'].includes(s.status)) throw new Error(s.fehler || 'Anmeldung abgelaufen – bitte nochmal');
      }
    } catch (err) { dlg.querySelector('#hwAnmeldeText').textContent = err.message; }
  } else if (info.lokalErlaubt) {
    // Besitzer des Rechners kann sich mit einem Tipp wieder automatisch anmelden
    localStorage.removeItem('hw-kein-auto');
    const auto = await fetch('/api/ich', { cache: 'no-store' }).then((r) => r.json()).catch(() => ({}));
    if (auto.sitzung) {
      if (confirm(`Als @${auto.person.login} (Besitzer dieses Hello World) anmelden?\n\nAbbrechen = mit anderem Namen anmelden.`)) return fertig(auto);
      localStorage.setItem('hw-kein-auto', '1');
    }
    dlg.innerHTML = `<form class="blatt-inhalt" id="hwLokal"><h2>Anmelden (vorläufig)</h2><p class="hinweis">Die GitHub-Anmeldung wird gerade eingerichtet. Bis dahin meldest du dich im Heimnetz mit deinem Namen an – er wird als Ersteller eingetragen und als „lokal" markiert.</p><label for="hwName">Dein Name</label><input id="hwName" required maxlength="39" autocomplete="nickname"><div class="knoepfe"><button type="button" class="leise" id="hwAnmeldenZu">Abbrechen</button><button type="submit">Anmelden</button></div></form>`;
    dlg.querySelector('#hwAnmeldenZu').onclick = () => dlg.close();
    dlg.querySelector('#hwLokal').onsubmit = async (ev) => {
      ev.preventDefault();
      const r = await fetch('/api/anmelden/lokal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: dlg.querySelector('#hwName').value }) });
      if (r.ok) fertig(await r.json());
    };
    dlg.showModal();
  } else {
    dlg.innerHTML = `<div class="blatt-inhalt"><h2>Mit GitHub anmelden</h2><p>Die GitHub-Anmeldung ist noch nicht eingerichtet.</p><div class="knoepfe"><button type="button" id="hwAnmeldenZu">OK</button></div></div>`;
    dlg.querySelector('#hwAnmeldenZu').onclick = () => dlg.close();
    dlg.showModal();
  }
}

// ---------- Bau-Aufträge ----------
async function auftragStarten(daten) {
  return api('/api/bau', { method: 'POST', body: JSON.stringify({ ...daten, ki: kiFuerAuftrag() }) });
}
async function auftragAktion(id, aktion, daten = {}) {
  return api(`/api/bau/${id}/${aktion}`, { method: 'POST', body: JSON.stringify(daten) });
}

// ---------- Stammbaum ----------
const sterneText = (w) => (w?.schnitt ? `★ ${String(w.schnitt).replace('.', ',')} (${w.anzahl})` : 'noch nicht bewertet');
const autorText = (a) => `@${a.login}${a.lokal ? ' (lokal)' : ''}`;
// Karte für eine Distribution (Zweig-Ende) mit Eigenarten
function distributionKarte(app, v, rang) {
  const eigen = v.eigenarten.length ? v.eigenarten.map((e) => `<li>+ ${esc(e.text)} <span class="leise-text">${esc(autorText(e.autor))}</span></li>`).join('') : '<li>Die erste Version, unverändert</li>';
  return `<div class="distribution">
    <div class="dist-kopf"><b>${rang === 0 ? '<span class="marke akzent">Beste</span> ' : ''}Version ${v.id.slice(1)}</b><span class="hinweis">${sterneText(v.wertung)}</span></div>
    <div class="hinweis">von ${esc(autorText(v.autor))} · ${new Date(v.zeit).toLocaleDateString('de-DE')}</div>
    <ul class="eigenarten">${eigen}</ul>
    <div class="knoepfe"><a class="knopf klein zweit" href="/a/${kennung(app)}@${v.id}">Diese Version öffnen</a></div>
  </div>`;
}
// Fragt alle 3 Sekunden den Stand ab und ruft bei jeder Änderung „bei(auftrag)" auf.
// Verbindungsprobleme werden einfach überbrückt – der PC arbeitet ja weiter.
const verfolgt = new Map();
function auftragVerfolgen(id, bei) {
  if (verfolgt.has(id)) { verfolgt.get(id).bei = bei; return; }
  const v = { bei, stand: '' };
  verfolgt.set(id, v);
  (async () => {
    for (;;) {
      try {
        const res = await fetch(`/api/bau/${id}`, { cache: 'no-store' });
        if (res.status === 404) { verfolgt.delete(id); return v.bei({ id, status: 'unbekannt', schritte: {}, schrittText: {}, meldung: 'Diesen Auftrag gibt es nicht mehr.', meldungArt: 'nein' }); }
        const a = await res.json();
        const stand = `${a.status}|${a.aktualisiert}`;
        if (stand !== v.stand) { v.stand = stand; v.bei(a); }
        if (!['laeuft'].includes(a.status)) { verfolgt.delete(id); return; }
      } catch { /* offline – gleich nochmal */ }
      await new Promise((r) => setTimeout(r, 3000));
    }
  })();
}
// Zeigt die Schritte eines Auftrags in einer <ol class="schritte"> an
function schritteZeigen(wurzel, a) {
  for (const li of wurzel.querySelectorAll('[data-schritt]')) {
    const name = li.dataset.schritt;
    li.classList.remove('laeuft', 'ok', 'nein');
    if (a.schritte?.[name]) li.classList.add(a.schritte[name]);
    const span = li.querySelector('span:not(.punkt)');
    if (span) {
      if (!span.dataset.standard) span.dataset.standard = span.textContent;
      span.textContent = a.schrittText?.[name] || span.dataset.standard;
    }
  }
}
// Wenn die Seite wieder sichtbar wird (Handy entsperrt), sofort nachsehen
document.addEventListener('visibilitychange', () => { if (!document.hidden) for (const v of verfolgt.values()) v.stand = ''; });

// Kleiner, sicherer Markdown-Leser (erst maskieren, dann formatieren)
function markdown(text) {
  const inline = (t) => esc(t)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  let html = '', liste = null, code = false, absatz = [];
  const absatzEnde = () => { if (absatz.length) { html += `<p>${inline(absatz.join(' '))}</p>`; absatz = []; } };
  const listeEnde = () => { if (liste) { html += `</${liste}>`; liste = null; } };
  for (const z of String(text).split('\n')) {
    if (z.trim().startsWith('```')) { absatzEnde(); listeEnde(); html += code ? '</pre>' : '<pre class="code">'; code = !code; continue; }
    if (code) { html += esc(z) + '\n'; continue; }
    const titel = z.match(/^(#{1,4})\s+(.*)/);
    const punkt = z.match(/^\s*[-*]\s+(.*)/), nummer = z.match(/^\s*\d+\.\s+(.*)/), zahl = z.match(/^\s*(\d+)\./);
    if (titel) { absatzEnde(); listeEnde(); html += `<h3>${inline(titel[2])}</h3>`; }
    else if (punkt || nummer) { absatzEnde(); const art = punkt ? 'ul' : 'ol'; if (liste !== art) { listeEnde(); html += art === 'ol' && zahl ? `<ol start="${zahl[1]}">` : `<${art}>`; liste = art; } html += `<li>${inline((punkt || nummer)[1])}</li>`; }
    else if (!z.trim()) { absatzEnde(); }
    else if (liste && /^\s{2,}\S/.test(z)) { html = html.replace(/<\/li>$/, ` ${inline(z.trim())}</li>`); }
    else { listeEnde(); absatz.push(z.trim()); }
  }
  absatzEnde(); listeEnde(); if (code) html += '</pre>';
  return html;
}


// ---------- Hello-World-Helfer: Erlaubnis einholen und Befehl ausführen ----------
// Wird vom App-Vollbild aufgerufen, wenn eine App helloworld.faehigkeit(…) nutzt.
async function faehigkeitAusfuehren(app, name, parameter) {
  if (!(app.faehigkeiten || []).includes(name)) throw new Error(`Diese App darf „${name}" nicht nutzen.`);
  if (!ich) { anmelden(); throw new Error('Bitte zuerst anmelden.'); }
  const { geraete } = await api('/api/helfer');
  if (!geraete.length) { helferHinweis(); throw new Error('Kein Computer mit Hello-World-Helfer gekoppelt.'); }
  const gewaehlt = await erlaubnisFragen(app, name, parameter, geraete);
  if (!gewaehlt) throw new Error('Abgelehnt.');
  const { id } = await api('/api/helfer/befehl', { method: 'POST', body: JSON.stringify({ app: app.slug, helfer_id: gewaehlt, faehigkeit: name, parameter }) });
  for (let i = 0; i < 70; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    const st = await api(`/api/helfer/befehl/${id}`);
    if (st.status === 'erledigt') return st.ergebnis;
    if (st.status === 'fehler') throw new Error(st.fehler || 'Fehler beim Helfer');
  }
  throw new Error('Der Helfer hat nicht geantwortet.');
}

function erlaubnisFragen(app, name, parameter, geraete) {
  return new Promise(async (resolve) => {
    let dlg = document.getElementById('hwErlaubnis');
    if (!dlg) { dlg = document.createElement('dialog'); dlg.id = 'hwErlaubnis'; dlg.className = 'blatt'; document.body.appendChild(dlg); }
    const zeigen = async (helferId) => {
      const f = await api('/api/helfer/frage', { method: 'POST', body: JSON.stringify({ helfer_id: helferId, faehigkeit: name, parameter }) });
      dlg.innerHTML = `<div class="blatt-inhalt erlaubnis${f.gefaehrlich ? ' gefaehrlich' : ''}">
        <h2>Erlaubnis</h2>
        <p><b>${esc(kennung(app))}</b> möchte ${esc(f.text)}.</p>
        ${geraete.length > 1 ? `<label for="hwGeraet">Auf welchem Computer?</label><select id="hwGeraet">${geraete.map((g) => `<option value="${g.id}"${g.id === helferId ? ' selected' : ''}>${esc(g.name)}${g.online ? '' : ' (offline)'}</option>`).join('')}</select>` : ''}
        ${f.online ? '' : '<p class="fehler-text">Der Computer ist gerade nicht erreichbar – der Befehl wird ausgeführt, sobald der Helfer wieder online ist (höchstens 2 Minuten).</p>'}
        ${f.gefaehrlich ? '<p class="hinweis">Das betrifft deinen ganzen Computer. Ungespeicherte Arbeit kann verloren gehen.</p>' : ''}
        <div class="knoepfe"><button type="button" class="zweit" id="hwNein">Ablehnen</button><button type="button" id="hwJa">Erlauben</button></div>
      </div>`;
      dlg.querySelector('#hwGeraet')?.addEventListener('change', (e) => zeigen(e.target.value));
      dlg.querySelector('#hwNein').onclick = () => { dlg.close(); resolve(null); };
      dlg.querySelector('#hwJa').onclick = () => { dlg.close(); resolve(helferId); };
      if (!dlg.open) dlg.showModal();
    };
    const start = geraete.find((g) => g.online) || geraete[0];
    try { await zeigen(start.id); } catch (err) { alert(err.message); resolve(null); }
  });
}

function helferHinweis() {
  let dlg = document.getElementById('hwHelferHinweis');
  if (!dlg) { dlg = document.createElement('dialog'); dlg.id = 'hwHelferHinweis'; dlg.className = 'blatt'; document.body.appendChild(dlg); }
  dlg.innerHTML = `<div class="blatt-inhalt"><h2>Hello-World-Helfer nötig</h2><p>Diese App steuert deinen Computer (z. B. herunterfahren). Dafür braucht es den <b>Hello-World-Helfer</b> auf dem Computer – einmal installieren und koppeln.</p><div class="knoepfe"><button type="button" class="leise" id="hwHinweisZu">Schließen</button><a class="knopf" href="/#geraete">Zu „Geräte"</a></div></div>`;
  dlg.querySelector('#hwHinweisZu').onclick = () => dlg.close();
  dlg.showModal();
}

// ---------- Apps mit eigener KI: helloworld.ki(aufgabe, eingabe) ----------
// quelle = { slug, version, auftrag, kennung, adresse } – adresse = woher die App-Datei kommt
const kiErlaubnisse = () => { try { return JSON.parse(localStorage.getItem('hw-ki-erlaubt') || '{}'); } catch { return {}; } };
async function appKiAusfuehren(quelle, aufgabe, eingabe) {
  const ki = kiEinstellung();
  if (!ki) { kiFehltHinweis(); throw new Error('Keine KI verbunden.'); }
  const schluessel = quelle.auftrag ? `vorschau:${quelle.auftrag}` : quelle.slug;
  if (!kiErlaubnisse()[schluessel]) {
    const html = await (await fetch(quelle.adresse, { cache: 'no-store' })).text().catch(() => '');
    let zweck = '';
    try { zweck = JSON.parse(html.match(/<script[^>]*id=["']hw-ki["'][^>]*>([\s\S]*?)<\/script>/i)[1]).zweck; } catch { /* egal */ }
    if (!(await kiErlaubnisFragen(quelle.kennung, zweck, ki))) throw new Error('Du hast die KI-Nutzung abgelehnt.');
    localStorage.setItem('hw-ki-erlaubt', JSON.stringify({ ...kiErlaubnisse(), [schluessel]: true }));
  }
  const { id } = await api('/api/ki/app', { method: 'POST', body: JSON.stringify({ slug: quelle.slug, version: quelle.version, auftrag: quelle.auftrag, aufgabe, eingabe, ki: kiFuerAuftrag() }) });
  for (let i = 0; i < 400; i++) {
    await new Promise((r) => setTimeout(r, i < 5 ? 1000 : 2000));
    let st;
    try { st = await api(`/api/ki/app/${id}`); } catch { continue; } // kurz offline – weiter warten
    if (st.status === 'fertig') return st.ergebnis;
    if (st.status === 'fehler') throw new Error(st.fehler || 'Die KI hat nicht geantwortet.');
  }
  throw new Error('Die KI hat zu lange gebraucht.');
}
function kiErlaubnisFragen(kennungText, zweck, ki) {
  return new Promise((resolve) => {
    let dlg = document.getElementById('hwKiErlaubnis');
    if (!dlg) { dlg = document.createElement('dialog'); dlg.id = 'hwKiErlaubnis'; dlg.className = 'blatt'; document.body.appendChild(dlg); }
    dlg.innerHTML = `<div class="blatt-inhalt">
      <h2>Deine KI nutzen?</h2>
      <p><b>${esc(kennungText)}</b> möchte deine KI nutzen${zweck ? `: <i>${esc(zweck)}</i>` : '.'}</p>
      <p class="hinweis">Es rechnet ${ki.art === 'lokal' ? 'Claude auf deinem PC' : ki.art === 'frei' ? 'eine kostenlose KI mit deinen Gratis-Schlüsseln' : 'deine KI mit deinem eigenen Schlüssel'}. Die App bekommt nur die Antwort – nie deinen Schlüssel. Was die KI tun darf, hat die App fest vorgegeben und Hello World geprüft.</p>
      <p class="hinweis">Hello World merkt sich deine Erlaubnis für diese App (zurücknehmen unter Mehr).</p>
      <div class="knoepfe"><button type="button" class="zweit" id="hwKiNein">Ablehnen</button><button type="button" id="hwKiJa">Erlauben</button></div>
    </div>`;
    dlg.querySelector('#hwKiNein').onclick = () => { dlg.close(); resolve(false); };
    dlg.querySelector('#hwKiJa').onclick = () => { dlg.close(); resolve(true); };
    dlg.oncancel = () => resolve(false);
    dlg.showModal();
  });
}
function kiFehltHinweis() {
  let dlg = document.getElementById('hwKiFehlt');
  if (!dlg) { dlg = document.createElement('dialog'); dlg.id = 'hwKiFehlt'; dlg.className = 'blatt'; document.body.appendChild(dlg); }
  dlg.innerHTML = `<div class="blatt-inhalt"><h2>Eigene KI nötig</h2><p>Diese App rechnet mit <b>deiner eigenen KI</b>. Verbinde sie einmal in Hello World – zu Hause z. B. „Claude auf diesem PC", unterwegs mit einem eigenen Schlüssel.</p><div class="knoepfe"><button type="button" class="leise" id="hwKiFehltZu">Schließen</button><a class="knopf" href="/#mehr">KI verbinden</a></div></div>`;
  dlg.querySelector('#hwKiFehltZu').onclick = () => dlg.close();
  dlg.showModal();
}
