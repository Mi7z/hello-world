// Hello World – Startseite: Entdecken, Aufträge, Geräte, Mehr (nutzt kern.js)
let stand = { apps: [], lokaleKi: false, csp: '', basisCss: '' };

// ---------- Bereiche (unten auf dem Handy, oben auf dem Desktop) ----------
const BEREICHE = ['entdecken', 'auftraege', 'geraete', 'mehr'];
function bereich(name, scrollen = true) {
  // Auch eigene Bereiche aus Layout-Designs (data-hw-ansicht)
  if (!name || !document.querySelector(`[data-ansicht="${CSS.escape(name)}"]`)) name = 'entdecken';
  for (const el of document.querySelectorAll('[data-ansicht]')) el.hidden = el.dataset.ansicht !== name;
  for (const a of document.querySelectorAll('#nav a')) {
    if (a.dataset.ziel === name) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  }
  if (scrollen) window.scrollTo({ top: 0 });
}
addEventListener('hashchange', () => bereich(location.hash.slice(1)));
const zuBereich = (name) => { if (location.hash !== `#${name}`) location.hash = name; else bereich(name); };

// ---------- Deine KI ----------
function zeigeKi() {
  const k = kiEinstellung();
  const anzahlFrei = Object.values(k?.frei || {}).filter(Boolean).length;
  const prog = (stand.kiProgramme || []).find((p) => p.id === k?.programm) || (stand.kiProgramme || [])[0];
  $('kiName').textContent = !k ? 'nicht verbunden – zum Bauen nötig'
    : k.art === 'lokal' ? `${prog ? prog.name : 'KI-Programm'} auf diesem PC (${prog ? prog.abo : 'ohne Schlüssel'})`
    : k.art === 'frei' ? `Kostenlose KIs (${anzahlFrei} Anbieter)`
    : `Claude mit eigenem Schlüssel (${k.modell})`;
}
// Felder für die Gratis-Anbieter (Liste kommt vom Server)
let freiAnbieter = [];
async function freiFelderZeigen(werte = {}) {
  if (!freiAnbieter.length) freiAnbieter = (await (await fetch('/api/frei/anbieter')).json()).anbieter;
  $('freiFelder').innerHTML = freiAnbieter.map((a) => `<label for="frei_${a.id}">${esc(a.name)} <a href="${esc(a.konto)}" target="_blank" rel="noopener">Gratis-Schlüssel holen ↗</a></label>
    <input id="frei_${a.id}" data-frei="${a.id}" type="password" autocomplete="off" placeholder="Schlüssel einfügen (optional)" value="${esc(werte[a.id] || '')}">`).join('');
}
function kiBereicheZeigen() {
  $('programmBereich').hidden = $('kiArt').value !== 'lokal';
  $('schluesselBereich').hidden = $('kiArt').value !== 'anthropic';
  $('freiBereich').hidden = $('kiArt').value !== 'frei';
}
function kiDialog() {
  const k = kiEinstellung() || { art: stand.lokaleKi ? 'lokal' : 'anthropic', modell: 'claude-opus-5' };
  $('lokalOption').disabled = !stand.lokaleKi;
  $('kiArt').value = k.art === 'lokal' && !stand.lokaleKi ? 'anthropic' : k.art;
  $('kiSchluessel').value = k.schluessel || '';
  $('kiModell').value = k.modell || 'claude-opus-5';
  $('kiProgramm').innerHTML = (stand.kiProgramme || []).map((p) => `<option value="${p.id}">${esc(p.name)} – ${esc(p.abo)}</option>`).join('') || '<option value="">keins gefunden</option>';
  if (k.programm) $('kiProgramm').value = k.programm;
  freiFelderZeigen(k.frei || {});
  kiBereicheZeigen();
  $('kiDialog').showModal();
}
$('kiKnopf').addEventListener('click', kiDialog);
$('kiArt').addEventListener('change', kiBereicheZeigen);
$('kiForm').addEventListener('submit', (ev) => {
  const art = $('kiArt').value;
  if (art === 'anthropic' && !$('kiSchluessel').value.trim()) { ev.preventDefault(); $('kiSchluessel').focus(); return; }
  const frei = Object.fromEntries([...document.querySelectorAll('[data-frei]')].map((x) => [x.dataset.frei, x.value.trim()]).filter(([, v]) => v));
  if (art === 'frei' && !Object.keys(frei).length) { ev.preventDefault(); document.querySelector('[data-frei]')?.focus(); return; }
  localStorage.setItem('hw-ki', JSON.stringify({ art, programm: $('kiProgramm').value || undefined, schluessel: $('kiSchluessel').value.trim(), modell: $('kiModell').value.trim() || 'claude-opus-5', frei }));
  zeigeKi();
});
$('kiTrennen').addEventListener('click', () => { localStorage.removeItem('hw-ki'); zeigeKi(); $('kiDialog').close(); });
function zeigeKiErlaubnisse() {
  const n = Object.keys(kiErlaubnisse()).length;
  $('kiErlaubtText').textContent = n ? `${n} App${n > 1 ? 's' : ''} dürfen deine KI nutzen` : 'Noch keine App darf deine KI nutzen';
  $('kiErlaubtZurueck').hidden = !n;
}
$('kiErlaubtZurueck').addEventListener('click', () => { localStorage.removeItem('hw-ki-erlaubt'); zeigeKiErlaubnisse(); });
function zeigeKonto() { $('kontoText').textContent = ich ? `@${ich.login}${ich.automatisch ? ' · automatisch angemeldet' : ''}` : 'Nicht angemeldet'; }
document.addEventListener('hw-angemeldet', zeigeKonto);

// ---------- Katalog & Suche ----------
const normal = (t) => String(t).toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');
const FUELLWOERTER = new Set(['ich', 'brauche', 'ein', 'eine', 'einen', 'tool', 'app', 'das', 'die', 'der', 'den', 'aus', 'macht', 'machen', 'mit', 'und', 'oder', 'fuer', 'zum', 'zur', 'von', 'in', 'im', 'mir', 'bitte', 'kann', 'man', 'was', 'wie', 'es', 'werkzeug', 'programm', 'soll', 'will', 'moechte']);
function woerter(t) { return normal(t).split(/[^a-z0-9]+/).filter((w) => w.length > 1 && !FUELLWOERTER.has(w)); }

// Einfache Wortstämme, damit „Bilder/Bildern/Bild" zusammenpassen
const stamm = (w) => w.replace(/(ungen|ung|ern|en|er|es|e|n|s)$/, '');
function bewerten(app, anfrage) {
  const gesucht = woerter(anfrage).map(stamm).filter((w) => w.length > 1);
  if (!gesucht.length) return 0;
  const text = woerter(`${app.slug} ${app.typ || ''} ${app.titel} ${app.beschreibung} ${(app.tags || []).join(' ')} ${(app.funktionen || []).join(' ')} ${(app.beispiele || []).join(' ')} ${(app.stichworte || []).join(' ')}`).map(stamm);
  let punkte = 0;
  for (const g of gesucht) {
    if (text.includes(g)) punkte += 2;
    else if (g.length >= 4 && text.some((t) => t.length >= 4 && (t.startsWith(g.slice(0, 4)) || g.startsWith(t.slice(0, 4))))) punkte += 1;
  }
  return punkte / gesucht.length;
}

function karte(a, { top = false, grund = '' } = {}) {
  const marken = [`<span class="marke">${TYP_NAME[a.typ || 'browser']}</span>`];
  if (a.typ === 'design' && a.slug === designName()) marken.push('<span class="marke akzent">aktiv</span>');
  if (a.faehigkeiten?.length) marken.push('<span class="marke">steuert den PC</span>');
  if (a.eigeneKi) marken.push('<span class="marke">nutzt deine KI</span>');
  if (a.version > 1) marken.push(`<span>${a.version} Versionen</span>`);
  return `<a class="hw-karte${top ? ' top' : ''}" href="/a/${kennung(a)}" data-slug="${a.slug}">${symbolHtml(a)}<span class="karte-name">${esc(kennung(a))}</span><span class="karte-text">${esc(a.beschreibung)}</span>${grund ? `<span class="grund">${esc(grund)}</span>` : ''}<span class="karte-fuss">${marken.join('')}</span></a>`;
}

// Antippen öffnet die Beschreibung: Schließen oder Öffnen
const TYP_LANG = { browser: 'App · Handy und Desktop', server: 'Server-App · läuft beim Betreiber', skill: 'Skill für KIs', mcp: 'Werkzeug für KIs (MCP)', design: 'Design · für Hello World und alle Apps' };
function beschreibung(slug) {
  const a = stand.apps.find((x) => x.slug === slug);
  if (!a) return;
  const istDesign = a.typ === 'design';
  $('bSymbol').outerHTML = symbolHtml(a).replace('class="symbol', 'id="bSymbol" class="symbol');
  $('bTitel').textContent = kennung(a);
  $('bTyp').textContent = `${TYP_LANG[a.typ || 'browser']}${a.version > 1 ? ` · ${a.version} Versionen` : ''}`;
  $('bText').textContent = a.beschreibung;
  $('bFunktionen').innerHTML = (a.funktionen || []).map((f) => `<li>${esc(f)}</li>`).join('');
  $('bUse').href = `/a/${kennung(a)}`;
  $('bUse').textContent = istDesign ? 'Ansehen & anpassen' : 'Öffnen';
  $('bUse').className = istDesign ? 'knopf zweit' : 'knopf';
  $('bVerwenden').hidden = !istDesign;
  if (istDesign) $('bUse').after($('bVerwenden')); else $('bVerwenden').after($('bUse'));
  $('bVerwenden').disabled = istDesign && designName() === a.slug;
  $('bVerwenden').textContent = istDesign && designName() === a.slug ? 'Ist aktiv ✓' : 'Verwenden';
  $('bVerwenden').onclick = () => { designWaehlen(a.slug); $('beschreibungDialog').close(); zeigeAlle(); zeigeDesigns(); };
  $('bVorschau').hidden = !istDesign;
  if (istDesign) rahmenSetzen($('bVorschau'), `/muster?design=${a.slug}`);
  $('bDistributionen').innerHTML = '';
  $('bBaum').hidden = true;
  $('beschreibungDialog').showModal();
  // Die besten Distributionen aus dem Stammbaum
  if (['browser', 'design'].includes(a.typ || 'browser')) {
    api(`/api/stammbaum/${a.slug}`).then((b) => {
      if (b.versionen.length < 2) return;
      const nachId = Object.fromEntries(b.versionen.map((v) => [v.id, v]));
      $('bDistributionen').innerHTML = `<h3 class="unter-titel">Beste Versionen</h3>${b.distributionen.map((id, i) => distributionKarte(a, nachId[id], i)).join('')}`;
      $('bBaum').href = `/b/${kennung(a)}`;
      $('bBaum').hidden = false;
    }).catch(() => {});
  }
}
document.addEventListener('click', (ev) => {
  const k = ev.target.closest('.hw-karte[data-slug]');
  if (!k || ev.metaKey || ev.ctrlKey) return;
  ev.preventDefault();
  beschreibung(k.dataset.slug);
});
$('bSchliessen').addEventListener('click', () => $('beschreibungDialog').close());
$('beschreibungDialog').addEventListener('click', (ev) => { if (ev.target === $('beschreibungDialog')) $('beschreibungDialog').close(); });

let filter = 'alle';
const FILTER = { alle: () => true, apps: (a) => ['browser', 'server'].includes(a.typ || 'browser'), design: (a) => a.typ === 'design', skill: (a) => a.typ === 'skill', mcp: (a) => a.typ === 'mcp' };
function zeigeAlle() {
  const liste = stand.apps.filter(FILTER[filter]);
  $('anzahl').textContent = liste.length;
  $('alleListe').innerHTML = liste.sort((a, b) => a.slug.localeCompare(b.slug)).map((a) => karte(a)).join('') || '<p class="leer">Hier ist noch nichts – mach den Anfang.</p>';
}
$('filter').addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-filter]');
  if (!b) return;
  filter = b.dataset.filter;
  for (const x of $('filter').children) x.setAttribute('aria-pressed', String(x === b));
  zeigeAlle();
});
$('vorschlaege').addEventListener('click', (ev) => {
  const b = ev.target.closest('button');
  if (!b) return;
  $('anfrage').value = b.textContent;
  $('suche').requestSubmit();
});

let letzteAnfrage = '';
// Suche → Hello-World-Chat: schlägt passende Apps vor (öffnen direkt aus dem Chat)
// oder baut Neues; der Chat bleibt danach als ausklappbares Fenster erhalten.
$('suche').addEventListener('submit', (ev) => {
  ev.preventDefault();
  const anfrage = $('anfrage').value.trim();
  if (!anfrage) return;
  letzteAnfrage = anfrage;
  $('anfrage').value = '';
  $('anfrage').blur();
  window.hwChat?.senden(anfrage);
});

// Hello-World-Fenster auf der Startseite: offene Apps als Tabs, keine aktuelle App
const offeneTabs = () => { try { return JSON.parse(localStorage.getItem('hw-tabs') || '[]'); } catch { return []; } };
window.HW_SEITE = {
  kontext: () => null,
  tabs: () => offeneTabs().map((t) => { const a = stand.apps.find((x) => x.slug === t.slug); return { kennung: t.kennung, name: t.kennung + (t.version ? '@' + t.version : ''), symbol: a ? symbolHtml(a) : '' }; }),
  tabWahl: (i) => { const t = offeneTabs()[i]; if (t) location.href = `/a/${t.kennung}${t.version ? '@' + t.version : ''}`; },
  tabZu: (i) => { const l = offeneTabs(); l.splice(i, 1); localStorage.setItem('hw-tabs', JSON.stringify(l)); },
  oeffnen: (k) => { location.href = `/a/${k}`; },
  vorschau: () => {},
  vorschauOeffnen: (a) => { window.hwChat?.schliessen(); zeigeAuftrag(a.id); },
};

// ---------- Neu bauen: der PC arbeitet, die Seite zeigt nur den Stand ----------
let aktuell = null; // laufender Auftrag (id)
let letzterAuftrag = null;
$('bauAnfrage').addEventListener('click', () => $('bauAnfrage').classList.toggle('ganz'));
document.addEventListener('hw-ablauf', (ev) => { if (letzterAuftrag && ev.detail === letzterAuftrag.id) $('ablauf').innerHTML = ablaufHtml(letzterAuftrag); });

async function bauen(anfrage) {
  if (STATISCH) return nurImProgramm();
  if (!kiEinstellung()) { kiDialog(); return; }
  try {
    const a = await auftragStarten({ anfrage });
    zeigeAuftrag(a.id);
  } catch (err) { alert(err.message); }
}
$('bauenKnopf').addEventListener('click', () => bauen(letzteAnfrage));
$('designForm').addEventListener('submit', (ev) => {
  ev.preventDefault();
  const w = $('designWunsch').value.trim();
  if (!w) return $('designWunsch').focus();
  $('designWunsch').value = '';
  bauen(`Neues Design (Aussehen für Hello World und alle Apps): ${w}`);
});

function zeigeAuftrag(id) {
  aktuell = id;
  localStorage.setItem('hw-auftrag', id);
  $('bau').hidden = false;
  $('vorschauBereich').hidden = true;
  zuBereich('auftraege');
  auftragVerfolgen(id, darstellen);
}

function darstellen(a) {
  if (a.id !== aktuell) return;
  $('bauTitel').textContent = a.titelAnzeige || 'neuer Auftrag';
  $('bauAnfrage').textContent = a.anfrage ? `„${a.anfrage}"` : '';
  const design = a.typ === 'design';
  letzterAuftrag = a;
  $('ablauf').innerHTML = ablaufHtml(a);
  let html = esc(a.meldung || '');
  if (a.status === 'vorhanden' && a.ergebnis?.kennung) html += `<div class="knoepfe"><a class="knopf" href="/a/${a.ergebnis.kennung}">Öffnen</a></div>`;
  if (a.status === 'fehler' || a.status === 'abgebrochen') html += `${a.probleme?.length ? `<ul>${a.probleme.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}<div class="knoepfe"><button type="button" id="neuStarten">Nochmal versuchen</button></div>`;
  $('bauMeldung').hidden = !html;
  $('bauMeldung').className = `meldung ${a.meldungArt || ''}`;
  $('bauMeldung').innerHTML = html;
  $('neuStarten')?.addEventListener('click', async () => {
    const neu = await auftragAktion(a.id, 'neustart', { ki: kiFuerAuftrag() });
    zeigeAuftrag(neu.id);
  });
  if (a.status === 'vorschau') {
    const pruef = [...[a.quelle, ...(a.quellen || [])].filter(Boolean).map((q) => `nutzt ${q.repo} (${q.lizenz})`), 'Sicherheit', design ? 'gut lesbar' : 'läuft auf Handy und Desktop', ...(a.zielSlug && !design ? ['alle Funktionen erhalten'] : [])];
    $('pruefbericht').innerHTML = pruef.map((p) => `<li>${esc(p)}</li>`).join('');
    $('veroeffentlichen').textContent = a.zielSlug ? 'Neue Version veröffentlichen' : 'Veröffentlichen';
    if ($('vorschau').dataset.auftrag !== a.id + a.aktualisiert) {
      $('vorschau').dataset.auftrag = a.id + a.aktualisiert;
      $('vorschau').src = `/api/bau/${a.id}/vorschau?design=${designName()}&t=${a.aktualisiert}`;
      ansicht('handy');
    }
    $('vorschauBereich').hidden = false;
  } else {
    $('vorschauBereich').hidden = true;
  }
  if (a.status === 'fertig' && a.app) location.href = `/a/${a.app.kennung}?${a.app.erweitert ? 'erweitert' : 'neu'}=1`;
  if (!['laeuft', 'vorschau'].includes(a.status)) localStorage.removeItem('hw-auftrag');
  zeigeAuftraege();
}

function ansicht(art) {
  $('vorschau').classList.toggle('handy', art === 'handy');
  for (const b of document.querySelectorAll('[data-ansicht-art]')) b.setAttribute('aria-pressed', String(b.dataset.ansichtArt === art));
}
$('ansichtWahl').addEventListener('click', (ev) => { const b = ev.target.closest('[data-ansicht-art]'); if (b) ansicht(b.dataset.ansichtArt); });

$('verwerfen').addEventListener('click', async () => { if (aktuell) await auftragAktion(aktuell, 'verwerfen'); $('bau').hidden = true; localStorage.removeItem('hw-auftrag'); zeigeAuftraege(); });
$('nachbessern').addEventListener('click', async () => {
  const was = prompt('Was soll deine KI verbessern?');
  if (!was || !aktuell) return;
  await auftragAktion(aktuell, 'nachbessern', { was });
  zeigeAuftrag(aktuell);
});
$('veroeffentlichen').addEventListener('click', async () => {
  if (!aktuell) return;
  $('veroeffentlichen').disabled = true;
  try {
    const a = await auftragAktion(aktuell, 'uebernehmen');
    location.href = `/a/${a.app.kennung}?${a.app.erweitert ? 'erweitert' : 'neu'}=1`;
  } catch (err) { alert(`Veröffentlichen hat nicht geklappt: ${err.message}`); }
  finally { $('veroeffentlichen').disabled = false; }
});

// Vorschau: Apps mit eigener KI rechnen schon hier mit deiner KI
addEventListener('message', async (ev) => {
  const d = ev.data;
  if (!d || d.hwSdk !== 'ki' || ev.source !== $('vorschau').contentWindow || !aktuell) return;
  const antworten = (x) => $('vorschau').contentWindow.postMessage({ hwAntwort: true, id: d.id, ...x }, '*');
  try { antworten({ ok: true, ergebnis: await appKiAusfuehren({ auftrag: aktuell, kennung: $('bauTitel').textContent, adresse: `/api/bau/${aktuell}/vorschau` }, String(d.aufgabe), d.eingabe ?? {}) }); }
  catch (err) { antworten({ ok: false, fehler: err.message }); }
});

// Aufträge der letzten Tage (auch von anderen Geräten)
async function zeigeAuftraege() {
  try {
    const { auftraege } = await (await fetch('/api/bau', { cache: 'no-store' })).json();
    const offen = auftraege.filter((a) => ['laeuft', 'vorschau'].includes(a.status));
    $('auftragZahl').hidden = !offen.length;
    $('auftragZahl').textContent = offen.length;
    $('auftragListe').innerHTML = offen.map((a) => `<a class="hw-karte" href="#auftraege" data-auftrag="${a.id}"><span class="symbol" aria-hidden="true">${a.status === 'laeuft' ? '⏳' : '👀'}</span><span class="karte-name">${esc(a.titelAnzeige || 'neuer Auftrag')}</span><span class="karte-text">${esc(a.anfrage)}</span><span class="karte-fuss"><span class="marke${a.status === 'vorschau' ? ' akzent' : ''}">${a.status === 'laeuft' ? 'der PC arbeitet …' : 'Vorschau bereit'}</span></span></a>`).join('')
      || '<p class="leer">Gerade läuft nichts. Suche unter „Entdecken" nach etwas, das es noch nicht gibt – dann kann deine KI es bauen.</p>';
  } catch { /* später */ }
}
$('auftragListe').addEventListener('click', (ev) => {
  const k = ev.target.closest('[data-auftrag]');
  if (!k) return;
  ev.preventDefault();
  zeigeAuftrag(k.dataset.auftrag);
});

// ---------- Aussehen ----------
function zeigeDesigns() {
  const designs = stand.apps.filter((a) => a.typ === 'design').sort((a, b) => (a.slug === 'terminal' ? -1 : b.slug === 'terminal' ? 1 : a.slug.localeCompare(b.slug)));
  $('designWahl').innerHTML = designs.map((d) => {
    const f = d.farben?.[0] || {};
    const aktiv = d.slug === designName();
    return `<button type="button" class="design-wahl" data-design="${d.slug}" aria-pressed="${aktiv}">
      <span class="design-bild" style="background:${esc(f.bg)}"><i style="background:${esc(f.tx)};width:60%"></i><i style="background:${esc(f.li || f.fl)};width:85%"></i><span class="knopf-farbe" style="background:${esc(f.ak)}"></span></span>
      <span class="design-name">${esc(d.slug)}${aktiv ? '<small>aktiv</small>' : ''}</span>
    </button>`;
  }).join('');
}
$('designWahl').addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-design]');
  if (!b) return;
  designWaehlen(b.dataset.design);
  zeigeDesigns();
  zeigeAlle();
});

// ---------- Vom Handy aus nutzen (Programm / Server-Installation) ----------
async function zeigeHandy() {
  let z;
  try { z = await api('/api/zugang'); } catch { return; }
  $('handyBereich').hidden = !z.an;
  if (!z.an) return;
  const geraete = z.geraete.map((g) => `<div class="liste-zeile"><span class="symbol" style="width:40px;height:40px;font-size:20px" aria-hidden="true">📱</span><div><b>${esc(g.name)}</b><span class="hinweis">gekoppelt ${new Date(g.seit).toLocaleDateString('de-DE')} · zuletzt ${new Date(g.zuletzt).toLocaleString('de-DE', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })}</span></div><button type="button" class="leise klein" data-geraet-weg="${g.id}">Entfernen</button></div>`).join('');
  if (!z.rechner) {
    $('handyInhalt').innerHTML = `<p class="hinweis">Du bist mit diesem Gerät verbunden. Neue Geräte koppelst du direkt am PC.</p>${geraete}`;
    return;
  }
  if (!z.offen) {
    $('handyInhalt').innerHTML = `<div class="knoepfe links"><button type="button" id="handyAn">Handy-Zugang einschalten</button></div>${geraete ? `<h3 class="unter-titel">Gekoppelte Geräte</h3>${geraete}` : ''}`;
    $('handyAn').onclick = async () => { await api('/api/zugang/offen', { method: 'POST', body: JSON.stringify({ an: true }) }); setTimeout(zeigeHandy, 800); };
    return;
  }
  const ts = z.adressen.find((a) => a.art === 'tailscale');
  $('handyInhalt').innerHTML = `
    <div class="knoepfe links"><button type="button" id="handyKoppeln">Handy verbinden</button><button type="button" class="leise" id="handyAus">Zugang ausschalten</button></div>
    <div id="handyCode"></div>
    ${!ts ? `<p class="hinweis">Für unterwegs: <a href="https://tailscale.com/download" target="_blank" rel="noopener">Tailscale</a> auf diesem Rechner und dem Handy installieren (gleiches Konto) – dann erscheint hier die Adresse für unterwegs.</p>` : ''}
    ${ts && !z.adressen.some((x) => x.art === 'sicher') ? `<div class="knoepfe links"><button type="button" class="zweit" id="handySicher">🔒 Sichere Adresse einrichten</button></div><p class="hinweis">Damit lässt sich Hello World auf Android und iPhone als richtige App installieren (https über Tailscale).</p>` : ''}
    ${geraete ? `<h3 class="unter-titel">Gekoppelte Geräte</h3>${geraete}` : '<p class="hinweis">Noch kein Gerät gekoppelt.</p>'}`;
  if ($('handySicher')) $('handySicher').onclick = async () => {
    $('handySicher').disabled = true;
    try { await api('/api/zugang/https', { method: 'POST' }); zeigeHandy(); } catch (err) { alert(err.message); $('handySicher').disabled = false; }
  };
  $('handyAus').onclick = async () => { if (!confirm('Handy-Zugang ausschalten? Gekoppelte Geräte bleiben gespeichert, kommen aber nicht mehr hinein, bis du ihn wieder einschaltest.')) return; await api('/api/zugang/offen', { method: 'POST', body: JSON.stringify({ an: false }) }); setTimeout(zeigeHandy, 800); };
  $('handyKoppeln').onclick = async () => {
    const { code } = await api('/api/zugang/code', { method: 'POST' });
    const wahl = (a) => `${a.url}/koppeln#code=${code}`;
    const zeigen = (a) => {
      const qr = qrcode(0, 'M'); qr.addData(wahl(a)); qr.make();
      $('handyQr').innerHTML = qr.createSvgTag({ cellSize: 5, margin: 3, scalable: true });
      $('handyLink').textContent = wahl(a);
    };
    $('handyCode').innerHTML = `<div class="flaeche" style="margin-top:14px;text-align:center;box-shadow:none">
      <div class="umschalter" id="handyNetz">${z.adressen.map((a, i) => `<button type="button" data-i="${i}" aria-pressed="${i === 0}">${a.art === 'sicher' ? '🔒 Überall · als App' : a.art === 'tailscale' ? '🌍 Unterwegs' : '🏠 Zu Hause'}</button>`).join('')}</div>
      <div id="handyQr" style="width:220px;max-width:100%;margin:8px auto;background:#fff;border-radius:12px;padding:6px"></div>
      <p>Mit der Handy-Kamera scannen – oder am Handy öffnen und Code <b style="font-family:var(--mono);letter-spacing:.1em">${code}</b> eingeben:</p>
      <p class="hinweis" id="handyLink" style="word-break:break-all"></p>
      <p class="hinweis">Gilt 10 Minuten, nur einmal.</p></div>`;
    zeigen(z.adressen[0]);
    $('handyNetz').onclick = (ev) => { const b = ev.target.closest('[data-i]'); if (!b) return; for (const x of $('handyNetz').children) x.setAttribute('aria-pressed', String(x === b)); zeigen(z.adressen[b.dataset.i]); };
  };
}
document.addEventListener('click', async (ev) => {
  const b = ev.target.closest('[data-geraet-weg]');
  if (!b || !confirm('Dieses Gerät entfernen? Es kommt dann nicht mehr hinein.')) return;
  await api('/api/zugang/entfernen', { method: 'POST', body: JSON.stringify({ id: b.dataset.geraetWeg }) }).catch(() => {});
  zeigeHandy();
});

// ---------- Geräte (Hello-World-Helfer) ----------
async function zeigeGeraete() {
  if (!ich) { $('geraeteListe').innerHTML = '<p class="hinweis">Melde dich an, um deine Geräte zu sehen.</p>'; return; }
  try {
    const { geraete } = await api('/api/helfer');
    $('geraeteListe').innerHTML = geraete.length
      ? geraete.map((g) => `<div class="liste-zeile"><span class="symbol" style="width:40px;height:40px;font-size:20px" aria-hidden="true">💻</span><div><b>${esc(g.name)}</b><span class="hinweis">${g.online ? '<span style="color:var(--gruen)">● online</span>' : '○ offline'} · ${esc(g.system)}</span></div><button type="button" class="leise klein" data-entfernen="${g.id}">Entfernen</button></div>`).join('')
      : '<p class="hinweis">Noch kein Computer gekoppelt.</p>';
  } catch { /* egal */ }
}
$('koppelnForm').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  if (!ich) return anmelden();
  try {
    const r = await api('/api/helfer/koppeln', { method: 'POST', body: JSON.stringify({ code: $('koppelCode').value }) });
    $('koppelCode').value = '';
    alert(`Gekoppelt: ${r.name}`);
    zeigeGeraete();
  } catch (err) { alert(err.message); }
});
$('geraeteListe').addEventListener('click', async (ev) => {
  const b = ev.target.closest('[data-entfernen]');
  if (!b || !confirm('Diesen Computer entkoppeln?')) return;
  await api('/api/helfer/entfernen', { method: 'POST', body: JSON.stringify({ id: b.dataset.entfernen }) }).catch(() => {});
  zeigeGeraete();
});
document.addEventListener('hw-angemeldet', zeigeGeraete);

// ---------- Start ----------
bereich(location.hash.slice(1), false);
(async () => {
  const res = await fetch('/api/apps', { cache: 'no-store' });
  stand = await res.json();
  // Erster Start: gefundenes KI-Programm automatisch nehmen (z. B. Claude Code)
  if (!kiEinstellung() && stand.lokaleKi) localStorage.setItem('hw-ki', JSON.stringify({ art: 'lokal', programm: stand.kiProgramme?.[0]?.id }));
  // Gewähltes Design gibt es nicht mehr? Zurück zum Standard
  if (!stand.apps.some((a) => a.typ === 'design' && a.slug === designName().split('@')[0])) designWaehlen('terminal');
  zeigeKi();
  zeigeKiErlaubnisse();
  zeigeAlle();
  zeigeDesigns();
  if (!STATISCH) {
    ichLaden().catch(() => {}).finally(() => { zeigeKonto(); zeigeGeraete(); });
    setInterval(zeigeGeraete, 30000);
  }
  fetch('/api/installieren').then((r) => r.text()).then((t) => { $('installText').textContent = t; });
  if (!STATISCH) { zeigeAuftraege(); setInterval(zeigeAuftraege, 15000); }
  if (!STATISCH) zeigeHandy();
  const offen = localStorage.getItem('hw-auftrag');
  if (offen && location.hash === '#auftraege') zeigeAuftrag(offen);
  else if (offen) { aktuell = offen; $('bau').hidden = false; auftragVerfolgen(offen, darstellen); }
  const q = new URLSearchParams(location.search).get('q');
  if (q) { $('anfrage').value = q; $('suche').requestSubmit(); }
})();

// ---------- Als App installieren ----------
function installZeigen() {
  const moeglich = !istInstalliert();
  $('installBereich').hidden = !moeglich;
  const handy = matchMedia('(pointer: coarse)').matches;
  $('installBanner').hidden = !moeglich || !handy || localStorage.getItem('hw-install-weg') === '1';
}
$('installKnopf').onclick = appInstallieren;
$('installBannerKnopf').onclick = appInstallieren;
$('installBannerZu').onclick = () => { localStorage.setItem('hw-install-weg', '1'); installZeigen(); };
document.addEventListener('hw-installierbar', installZeigen);
installZeigen();

// ---------- Pitches: Hello World weiterentwickeln (auf GitHub, Sterne = 👍) ----------
let pitchStand = { pitches: [], minStimmen: 10, quote: 0.8, direkt: false, repo: 'Mi7z/hello-world' };
const pitchOffen = new Set();
async function pitchesLaden(frisch = false) {
  try {
    if (STATISCH) {
      // Ohne Server direkt bei GitHub lesen (öffentlich)
      const roh = await (await fetch(`https://api.github.com/repos/${pitchStand.repo}/issues?labels=pitch&state=all&per_page=100`)).json();
      pitchStand.pitches = roh.filter((i) => !i.pull_request).map((i) => {
        const dafuer = i.reactions?.['+1'] || 0, dagegen = i.reactions?.['-1'] || 0, gesamt = dafuer + dagegen, anteil = gesamt ? dafuer / gesamt : 0;
        return { nummer: i.number, titel: i.title.replace(/^Pitch:\s*/i, ''), plan: String(i.body || '').replace(/^### Plan\s*/i, ''), von: i.user?.login, zeit: i.created_at, dafuer, dagegen, gesamt, anteil, url: i.html_url, geschlossen: i.state === 'closed',
          status: i.state === 'closed' ? 'umgesetzt' : gesamt < pitchStand.minStimmen ? 'offen' : anteil >= pitchStand.quote ? 'angenommen' : 'zu wenig Zustimmung' };
      }).sort((a, b) => (b.dafuer - b.dagegen) - (a.dafuer - a.dagegen));
    } else pitchStand = await api(`/api/pitches${frisch ? '?frisch=1' : ''}`);
  } catch (err) { $('pitchListe').innerHTML = `<p class="fehler-text">Pitches konnten nicht geladen werden (${esc(err.message)}).</p>`; return; }
  pitchesZeigen();
}
function pitchesZeigen() {
  const { pitches, minStimmen, quote, direkt } = pitchStand;
  $('pitchMin').textContent = minStimmen;
  $('pitchQuote').textContent = `${Math.round(quote * 100)} %`;
  $('pitchAnzahl').textContent = pitches.length || '';
  $('pitchEinreichen').textContent = direkt ? 'Einreichen' : 'Auf GitHub einreichen ↗';
  $('pitchListe').innerHTML = pitches.length ? pitches.map((p) => {
    const prozent = Math.round(p.anteil * 100);
    const fehlen = Math.max(0, minStimmen - p.gesamt);
    const offen = pitchOffen.has(p.nummer);
    const STATUS = { offen: fehlen ? `noch ${fehlen} ${fehlen === 1 ? 'Stimme' : 'Stimmen'} bis zur Entscheidung` : 'offen', angenommen: '✓ angenommen – wird gebaut', 'zu wenig Zustimmung': `zu wenig Zustimmung (nötig ${Math.round(quote * 100)} %)`, 'wird gebaut': '⚙ wird gerade automatisch gebaut', umgesetzt: '✓ umgesetzt', fehlgeschlagen: '✗ Bau fehlgeschlagen – Grund auf GitHub' };
    return `<article class="pitch flaeche${p.geschlossen ? ' zu' : ''}">
      <div class="pitch-kopf">
        <div class="pitch-titel"><b>${esc(p.titel)}</b><span class="hinweis">#${p.nummer} · @${esc(p.von || '')} · ${new Date(p.zeit).toLocaleDateString('de-DE')}</span></div>
        ${p.geschlossen ? '' : `<div class="pitch-stimmen">
          <button type="button" class="zweit klein" data-pitch-stimme="+1" data-nummer="${p.nummer}" aria-label="Dafür">👍 ${p.dafuer}</button>
          <button type="button" class="zweit klein" data-pitch-stimme="-1" data-nummer="${p.nummer}" aria-label="Dagegen">👎 ${p.dagegen}</button>
        </div>`}
      </div>
      <div class="pitch-balken" title="${prozent} % dafür"><i class="dafuer" style="width:${p.gesamt ? prozent : 0}%"></i><i class="dagegen" style="width:${p.gesamt ? 100 - prozent : 0}%"></i><span class="schwelle" style="left:${Math.round(quote * 100)}%"></span></div>
      <div class="pitch-stand"><span>${p.gesamt} ${p.gesamt === 1 ? 'Stimme' : 'Stimmen'}${p.gesamt ? ` · ${prozent} % dafür` : ''}</span><span class="marke${['angenommen', 'wird gebaut', 'umgesetzt'].includes(p.status) ? ' akzent' : ''}${p.status === 'fehlgeschlagen' ? ' warn' : ''}">${esc(STATUS[p.status] || p.status)}</span></div>
      ${offen ? `<div class="pitch-plan text-inhalt">${markdown(p.plan)}</div>` : ''}
      <div class="knoepfe links">
        <button type="button" class="leise klein" data-pitch-auf="${p.nummer}">${offen ? 'Plan zuklappen' : 'Plan ansehen'}</button>
        <a class="knopf leise klein" href="${esc(p.url)}" target="_blank" rel="noopener">Auf GitHub ↗</a>
      </div>
    </article>`;
  }).join('') : '<p class="leer">Noch keine Pitches. Mach den Anfang – oben deine Idee eintippen.</p>';
}
$('pitchListe').addEventListener('click', async (ev) => {
  const auf = ev.target.closest('[data-pitch-auf]');
  if (auf) { const n = Number(auf.dataset.pitchAuf); pitchOffen.has(n) ? pitchOffen.delete(n) : pitchOffen.add(n); pitchesZeigen(); return; }
  const b = ev.target.closest('[data-pitch-stimme]');
  if (!b) return;
  const n = b.dataset.nummer;
  if (STATISCH || !pitchStand.direkt) { open(`https://github.com/${pitchStand.repo}/issues/${n}`, '_blank', 'noopener'); return; }
  b.disabled = true;
  try { await api(`/api/pitches/${n}/stimme`, { method: 'POST', body: JSON.stringify({ richtung: b.dataset.pitchStimme }) }); await pitchesLaden(true); }
  catch (err) { alert(err.message); b.disabled = false; }
});
$('pitchForm').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const idee = $('pitchIdee').value.trim();
  if (!idee) return $('pitchIdee').focus();
  if (STATISCH || !kiEinstellung()) {
    // Ohne KI: Idee direkt als Plan übernehmen
    $('pitchTitel').value = idee.slice(0, 60); $('pitchPlan').value = `## Worum geht's\n${idee}\n\n## Was ändert sich\n- \n\n## Umfang und Risiken\n- `;
    $('pitchEntwurf').hidden = false; return;
  }
  $('pitchPlanKnopf').disabled = true; $('pitchPlanKnopf').textContent = 'Deine KI schreibt den Plan …';
  try {
    const e = await api('/api/pitches/entwurf', { method: 'POST', body: JSON.stringify({ idee, ki: kiFuerAuftrag() }) });
    $('pitchTitel').value = e.titel; $('pitchPlan').value = `${e.zusammenfassung}\n\n${e.plan}`;
    $('pitchEntwurf').hidden = false;
  } catch (err) { alert(err.message); }
  finally { $('pitchPlanKnopf').disabled = false; $('pitchPlanKnopf').textContent = 'Plan schreiben lassen'; }
});
$('pitchVerwerfen').onclick = () => { $('pitchEntwurf').hidden = true; };
$('pitchEinreichen').onclick = async () => {
  const titel = $('pitchTitel').value.trim(), plan = $('pitchPlan').value.trim();
  if (titel.length < 5 || plan.length < 20) return alert('Bitte Titel und Plan ausfüllen.');
  const link = () => { const u = new URL(`https://github.com/${pitchStand.repo}/issues/new`); u.searchParams.set('template', 'pitch.yml'); u.searchParams.set('title', `Pitch: ${titel}`); u.searchParams.set('plan', plan.slice(0, 5000)); return u.href; };
  if (STATISCH || !pitchStand.direkt) { open(link(), '_blank', 'noopener'); return; }
  $('pitchEinreichen').disabled = true;
  try {
    const r = await api('/api/pitches', { method: 'POST', body: JSON.stringify({ titel, plan }) });
    $('pitchEntwurf').hidden = true; $('pitchIdee').value = '';
    pitchOffen.add(r.nummer);
    await pitchesLaden(true);
  } catch (err) { alert(err.message); }
  finally { $('pitchEinreichen').disabled = false; }
};
addEventListener('hashchange', () => { if (location.hash === '#pitches') pitchesLaden(); });
{
  const idee = new URLSearchParams(location.search).get('pitch');
  if (idee) { $('pitchIdee').value = idee; history.replaceState(null, '', '/#pitches'); bereich('pitches'); setTimeout(() => $('pitchForm').requestSubmit(), 300); }
}
if (location.hash === '#pitches') pitchesLaden();
