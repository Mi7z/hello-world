// Hello-World-Fenster: kleiner, verschiebbarer Griff am Rand → ausklappbares Fenster mit
// offenen Apps (Tabs), der aktuellen App und einem Chat. Was man unten eingibt, bezieht
// sich auf die gerade offene App – man kann aber auch alles andere schreiben (suchen,
// neue App, zwei Apps verbinden …). Der Chat bleibt erhalten (auch beim Seitenwechsel).
//
// Die Seite beschreibt sich über window.HW_SEITE:
//   kontext()            → { slug, kennung, version } der offenen App oder null
//   oeffnen(kennung)     → App öffnen (als Tab bzw. Seite)
//   vorschau(auftrag)    → Vorschau eines Umbaus in der offenen App zeigen (null = zurück)
//   vorschauOeffnen(a)   → Vorschau einer neuen App als Tab öffnen
//   tabs(), tabWahl(i), tabZu(i), appBereich(el)  (optional)
(() => {
  const S = () => window.HW_SEITE || {};
  const CHAT = 'hw-chat';
  let katalog = [];
  let offen = false;
  let ohneBezug = false; // Nutzer hat die Verbindung zur offenen App gelöst
  const auftraegeStand = new Map(); // Auftrag → letzter Stand

  // ---------- Grundgerüst ----------
  document.body.insertAdjacentHTML('beforeend', `
    <button type="button" class="hw-griff" id="hwGriff" aria-label="Hello World öffnen" title="Hello World (gedrückt halten zum Verschieben)"><span aria-hidden="true">‹</span></button>
    <aside class="hw-fenster" id="hwFenster" aria-label="Hello World" hidden>
      <header class="hw-fenster-kopf">
        <a href="/" class="logo"><span class="logo-zeichen" aria-hidden="true">hw</span><span>Hello World</span></a>
        <button type="button" class="leise klein" id="hwZu" aria-label="Schließen">✕</button>
      </header>
      <nav class="hw-tabs" id="hwTabs" aria-label="Offene Apps"></nav>
      <section class="hw-app" id="hwApp" hidden></section>
      <div class="hw-verlauf" id="hwVerlauf" aria-live="polite"></div>
      <form class="hw-eingabe" id="hwEingabe" autocomplete="off">
        <div class="hw-bezug" id="hwBezug" hidden></div>
        <div class="hw-zeile">
          <textarea id="hwText" rows="1" placeholder="Was möchtest du?" enterkeyhint="send"></textarea>
          <button type="submit" aria-label="Senden">➤</button>
        </div>
      </form>
    </aside>`);
  const $h = (id) => document.getElementById(id);

  // ---------- Griff: antippen öffnet, gedrückt halten + ziehen verschiebt ----------
  const griff = $h('hwGriff');
  const lage = (() => { try { return JSON.parse(localStorage.getItem('hw-griff')) || { seite: 'rechts', y: 0.5 }; } catch { return { seite: 'rechts', y: 0.5 }; } })();
  function griffSetzen() {
    griff.classList.toggle('links', lage.seite === 'links');
    griff.style.top = `${Math.round(Math.min(0.92, Math.max(0.08, lage.y)) * window.innerHeight)}px`;
    griff.querySelector('span').textContent = lage.seite === 'links' ? '›' : '‹';
  }
  griffSetzen();
  addEventListener('resize', griffSetzen);
  let druck = null;
  griff.addEventListener('pointerdown', (ev) => {
    griff.setPointerCapture(ev.pointerId);
    druck = { x: ev.clientX, y: ev.clientY, ziehen: false, uhr: setTimeout(() => { druck.ziehen = true; griff.classList.add('zieht'); navigator.vibrate?.(15); }, 350) };
  });
  griff.addEventListener('pointermove', (ev) => {
    if (!druck) return;
    if (!druck.ziehen && Math.hypot(ev.clientX - druck.x, ev.clientY - druck.y) > 12) { clearTimeout(druck.uhr); druck.abbruch = true; }
    if (druck.ziehen) { griff.style.top = `${ev.clientY}px`; griff.style.left = `${ev.clientX - 18}px`; griff.style.right = 'auto'; }
  });
  griff.addEventListener('pointerup', (ev) => {
    if (!druck) return;
    clearTimeout(druck.uhr);
    if (druck.ziehen) {
      lage.seite = ev.clientX < window.innerWidth / 2 ? 'links' : 'rechts';
      lage.y = ev.clientY / window.innerHeight;
      localStorage.setItem('hw-griff', JSON.stringify(lage));
      griff.style.left = ''; griff.style.right = '';
      griff.classList.remove('zieht');
      griffSetzen();
    } else if (!druck.abbruch) fensterAuf(true);
    druck = null;
  });
  griff.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); fensterAuf(true); } });

  // Tastatur auf dem Handy: Fenster genau auf den sichtbaren Bereich setzen,
  // damit das Eingabefeld über der Tastatur bleibt (auch in Browsern ohne „resizes-content")
  function anTastaturAnpassen() {
    const vv = window.visualViewport;
    const f = $h('hwFenster');
    if (!vv || !offen) return;
    const klein = vv.height < window.innerHeight - 80; // Tastatur offen
    f.style.top = klein ? `${vv.offsetTop}px` : '';
    f.style.height = klein ? `${vv.height}px` : '';
    f.style.bottom = klein ? 'auto' : '';
    if (klein) $h('hwVerlauf').scrollTop = $h('hwVerlauf').scrollHeight;
  }
  window.visualViewport?.addEventListener('resize', anTastaturAnpassen);
  window.visualViewport?.addEventListener('scroll', anTastaturAnpassen);
  $h('hwText').addEventListener('focus', () => setTimeout(() => { anTastaturAnpassen(); $h('hwText').scrollIntoView({ block: 'nearest' }); }, 300));

  function fensterAuf(auf) {
    offen = auf;
    $h('hwFenster').hidden = !auf;
    griff.hidden = auf;
    document.body.classList.toggle('hw-fenster-offen', auf);
    if (auf) { zeigen(); setTimeout(() => $h('hwText').focus({ preventScroll: true }), 50); }
  }
  $h('hwZu').onclick = () => fensterAuf(false);
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && offen) fensterAuf(false); });

  // ---------- Verlauf ----------
  const verlauf = () => { try { return JSON.parse(localStorage.getItem(CHAT) || '[]'); } catch { return []; } };
  const speichern = (v) => localStorage.setItem(CHAT, JSON.stringify(v.slice(-60)));
  function hinzu(n) { const v = verlauf(); v.push({ zeit: Date.now(), ...n }); speichern(v); zeigen(); return v.length - 1; }
  function aendern(i, n) { const v = verlauf(); if (v[i]) { Object.assign(v[i], n); speichern(v); zeigen(); } }

  const app = (slug) => katalog.find((a) => a.slug === slug);
  const karte = (slug) => {
    const a = app(slug);
    if (!a) return '';
    return `<div class="hw-vorschlag">${symbolHtml(a)}<div><b>${esc(kennung(a))}</b><span>${esc(a.beschreibung)}</span></div><button type="button" class="klein" data-hw-oeffnen="${esc(kennung(a))}">Öffnen</button></div>`;
  };
  function auftragKarte(id, i) {
    const a = auftraegeStand.get(id);
    if (!a) return `<div class="hw-auftrag"><span class="lade">Lade Stand …</span></div>`;
    const neu = !a.zielSlug;
    let knoepfe = '';
    if (a.status === 'vorschau') {
      knoepfe = `${neu ? `<button type="button" class="zweit klein" data-hw-ansehen="${id}">Ansehen</button>` : ''}
        <button type="button" class="leise klein" data-hw-verwerfen="${id}">Verwerfen</button>
        <button type="button" class="zweit klein" data-hw-nachbessern="${id}">Nachbessern</button>
        <button type="button" class="klein" data-hw-uebernehmen="${id}">${neu ? 'Veröffentlichen' : 'Übernehmen'}</button>`;
    } else if (['fehler', 'abgebrochen'].includes(a.status)) {
      knoepfe = `<button type="button" class="klein" data-hw-nochmal="${id}">Nochmal versuchen</button>`;
    } else if (a.status === 'fertig' && a.app) {
      knoepfe = `<button type="button" class="klein" data-hw-oeffnen="${esc(a.app.kennung)}${a.app.version ? '@' + a.app.version : ''}">Öffnen</button>`;
    } else if (a.status === 'vorhanden' && a.ergebnis?.kennung) {
      knoepfe = `<button type="button" class="klein" data-hw-oeffnen="${esc(a.ergebnis.kennung)}">Öffnen</button>`;
    }
    const status = { laeuft: 'Der PC arbeitet …', vorschau: neu ? 'Fertig – schau es dir an.' : 'Fertig – die Vorschau läuft in der App.', fertig: '✓ Übernommen', verworfen: 'Verworfen', fehler: 'Hat nicht geklappt', abgebrochen: 'Abgebrochen', abgelehnt: 'Abgelehnt', vorhanden: 'Gibt es schon' }[a.status] || a.status;
    return `<div class="hw-auftrag ${a.status}"><div class="hw-auftrag-kopf"><b>${esc(a.titelAnzeige || 'Auftrag')}</b><span>${status}</span></div>
      ${ablaufHtml(a)}
      ${a.meldung && a.status !== 'laeuft' ? `<p class="hinweis">${esc(a.meldung)}</p>` : ''}
      ${knoepfe ? `<div class="knoepfe links">${knoepfe}</div>` : ''}</div>`;
  }
  function zeigen() {
    if (!offen) return;
    // Tabs
    const tabs = S().tabs?.() || [];
    $h('hwTabs').innerHTML = `<a href="/" class="hw-tab heim" title="Hello World Startseite"><span class="logo-zeichen" aria-hidden="true">hw</span><span>Start</span></a>`
      + tabs.map((t, i) => `<button type="button" class="hw-tab${t.aktiv ? ' an' : ''}" data-hw-tab="${i}" title="${esc(t.kennung)}">${t.symbol || ''}<span>${esc(t.name)}</span><i data-hw-tabzu="${i}" aria-label="Schließen" role="button">✕</i></button>`).join('');
    // Aktuelle App
    const k = S().kontext?.();
    $h('hwApp').hidden = !k || !S().appBereich;
    if (k && S().appBereich) S().appBereich($h('hwApp'));
    // Bezug
    const bezug = k && !ohneBezug;
    $h('hwBezug').hidden = !k;
    $h('hwBezug').innerHTML = bezug ? `Für <b>${esc(k.kennung)}</b> <button type="button" class="leise klein" id="hwBezugAus" aria-label="Ohne Bezug zur App schreiben">✕</button>` : `<button type="button" class="leise klein" id="hwBezugAn">Für ${esc(k?.kennung || '')} schreiben</button>`;
    $h('hwBezugAus')?.addEventListener('click', () => { ohneBezug = true; zeigen(); });
    $h('hwBezugAn')?.addEventListener('click', () => { ohneBezug = false; zeigen(); });
    $h('hwText').placeholder = bezug ? 'Was soll die App können?' : 'Was brauchst du?';
    // Verlauf
    const v = verlauf();
    $h('hwVerlauf').innerHTML = v.length ? v.map((n, i) => `<div class="hw-nachricht ${n.wer}">
        ${n.text ? `<div class="hw-blase">${esc(n.text)}</div>` : ''}
        ${n.denkt ? '<div class="hw-blase"><span class="lade">Ich denke nach …</span></div>' : ''}
        ${n.nochmal ? `<div class="knoepfe links"><button type="button" class="klein" data-hw-nochmal-text="${i}">↻ Nochmal senden</button></div>` : ''}
        ${(n.apps || []).map(karte).join('')}
        ${n.auftrag ? auftragKarte(n.auftrag, i) : ''}
        ${n.pitch ? `<div class="hw-auftrag"><div class="hw-auftrag-kopf"><b>💡 Pitch: ${esc(n.pitch.slice(0, 80))}</b></div><p class="hinweis">Änderungen an Hello World selbst werden als Pitch vorgeschlagen – mit genug Sternen wird es gebaut.</p><div class="knoepfe links"><a class="knopf klein" href="/?pitch=${encodeURIComponent(n.pitch)}#pitches">Pitch erstellen</a></div></div>` : ''}
      </div>`).join('')
      : `<div class="hw-leer"><p><b>Hallo!</b> ${k ? `Schreib unten, was <b>${esc(k.kennung)}</b> zusätzlich können soll – oder frag nach einer anderen App.` : 'Schreib unten, was du brauchst. Gibt es das schon, schlage ich es vor; sonst baut deine KI es.'}</p></div>`;
    $h('hwVerlauf').scrollTop = $h('hwVerlauf').scrollHeight;
  }

  // ---------- Klicks im Fenster ----------
  $h('hwFenster').addEventListener('click', async (ev) => {
    const t = ev.target;
    const zu = t.closest('[data-hw-tabzu]');
    if (zu) { ev.stopPropagation(); S().tabZu?.(Number(zu.dataset.hwTabzu)); zeigen(); return; }
    const tab = t.closest('[data-hw-tab]');
    if (tab) { S().tabWahl?.(Number(tab.dataset.hwTab)); zeigen(); if (matchMedia('(max-width: 700px)').matches) fensterAuf(false); return; }
    const o = t.closest('[data-hw-oeffnen]');
    if (o) { S().oeffnen?.(o.dataset.hwOeffnen); if (matchMedia('(max-width: 700px)').matches) fensterAuf(false); return; }
    const an = t.closest('[data-hw-ansehen]');
    if (an) { const a = auftraegeStand.get(an.dataset.hwAnsehen); if (a) { S().vorschauOeffnen?.(a); if (matchMedia('(max-width: 700px)').matches) fensterAuf(false); } return; }
    const ub = t.closest('[data-hw-uebernehmen]');
    if (ub) {
      ub.disabled = true;
      try {
        const a = await auftragAktion(ub.dataset.hwUebernehmen, 'uebernehmen');
        auftraegeStand.set(a.id, a); zeigen();
        S().vorschau?.(null);
        if (a.app) S().oeffnen?.(`${a.app.kennung}${a.app.version ? '@' + a.app.version : ''}`, { neu: true });
        katalogLaden();
      } catch (err) { hinzu({ wer: 'hw', text: `Das hat nicht geklappt: ${err.message}` }); }
      return;
    }
    const vw = t.closest('[data-hw-verwerfen]');
    if (vw) { const a = await auftragAktion(vw.dataset.hwVerwerfen, 'verwerfen').catch(() => null); if (a) auftraegeStand.set(a.id, a); S().vorschau?.(null); zeigen(); return; }
    const nb = t.closest('[data-hw-nachbessern]');
    if (nb) { const was = prompt('Was soll noch anders werden?'); if (!was) return; await auftragAktion(nb.dataset.hwNachbessern, 'nachbessern', { was }); verfolgen(nb.dataset.hwNachbessern); return; }
    const ns = t.closest('[data-hw-nochmal-text]');
    if (ns) { const n = verlauf()[Number(ns.dataset.hwNochmalText)]; if (n?.nochmal) { aendern(Number(ns.dataset.hwNochmalText), { nochmal: null }); senden(n.nochmal); } return; }
    const nm = t.closest('[data-hw-nochmal]');
    if (nm) {
      const neu = await auftragAktion(nm.dataset.hwNochmal, 'neustart', { ki: kiFuerAuftrag() }).catch((err) => { hinzu({ wer: 'hw', text: err.message }); return null; });
      if (neu) { hinzu({ wer: 'hw', text: 'Ich versuche es nochmal.', auftrag: neu.id }); verfolgen(neu.id); }
    }
  });

  // ---------- Aufträge verfolgen ----------
  function verfolgen(id) {
    auftragVerfolgen(id, (a) => {
      const vorher = auftraegeStand.get(id);
      auftraegeStand.set(id, a);
      // Umbau der offenen App fertig → Vorschau direkt in der App zeigen
      if (a.status === 'vorschau' && a.zielSlug && (!vorher || vorher.status !== 'vorschau' || vorher.aktualisiert !== a.aktualisiert)) {
        const k = S().kontext?.();
        if (k && k.slug === a.zielSlug) S().vorschau?.(a);
      }
      zeigen();
      document.dispatchEvent(new CustomEvent('hw-auftrag', { detail: a }));
    });
  }

  // ---------- Senden ----------
  const normal = (t) => String(t).toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');
  function lokalSuchen(text) {
    const w = normal(text).split(/[^a-z0-9]+/).filter((x) => x.length > 2);
    return katalog.map((a) => {
      const t = normal(`${a.slug} ${a.titel} ${a.beschreibung} ${(a.funktionen || []).join(' ')} ${(a.beispiele || []).join(' ')} ${(a.stichworte || []).join(' ')}`);
      return { a, p: w.filter((x) => t.includes(x) || t.includes(x.slice(0, 5))).length / (w.length || 1) };
    }).filter((x) => x.p >= 0.5).sort((x, y) => y.p - x.p).slice(0, 4).map((x) => x.a.slug);
  }
  async function senden(text) {
    const k = ohneBezug ? null : S().kontext?.();
    const bisher = verlauf().filter((n) => n.text).map((n) => ({ wer: n.wer, text: n.text }));
    hinzu({ wer: 'ich', text });
    // Ohne Server (Web-App) oder ohne KI: nur suchen
    if (STATISCH || !kiEinstellung()) {
      const treffer = lokalSuchen(text);
      hinzu({ wer: 'hw', text: treffer.length ? 'Das könnte passen:' : STATISCH ? 'Dazu habe ich nichts gefunden. Neues bauen und Apps verbessern geht im Hello-World-Programm am PC.' : 'Dazu habe ich nichts gefunden. Verbinde unter Mehr → Deine KI eine KI, dann baue ich es dir.', apps: treffer });
      if (!STATISCH && !kiEinstellung() && !treffer.length) kiFehltHinweis();
      return;
    }
    const i = hinzu({ wer: 'hw', denkt: true, frage: text, kontext: k ? { slug: k.slug, version: k.version } : null });
    try {
      const { id } = await api('/api/chat', { method: 'POST', body: JSON.stringify({ nachricht: text, kontext: k ? { slug: k.slug, version: k.version } : null, verlauf: bisher, ki: kiFuerAuftrag() }) });
      aendern(i, { chatId: id, seit: Date.now() }); // überlebt Neuladen der Seite
      await abwarten(i);
    } catch (err) { fehlgeschlagen(i, err.message); }
  }
  // Antwort abholen – auch nach Neuladen der Seite oder Neustart von Hello World
  const wartet = new Set();
  async function abwarten(i) {
    if (wartet.has(i)) return;
    wartet.add(i);
    try {
      const n0 = verlauf()[i];
      if (!n0?.chatId) return fehlgeschlagen(i, 'Die Anfrage ist unterwegs verloren gegangen.');
      let st;
      for (let n = 0; n < 240; n++) {
        try { st = await api(`/api/chat/${n0.chatId}`); } catch { st = null; }
        if (st && st.status !== 'laeuft') break;
        if (Date.now() - (n0.seit || Date.now()) > 5 * 60e3) { st = { status: 'fehler', fehler: 'Das dauert ungewöhnlich lange.' }; break; }
        await new Promise((r) => setTimeout(r, n < 5 ? 800 : 1500));
      }
      if (st?.status !== 'fertig') return fehlgeschlagen(i, st?.fehler || 'Die KI hat nicht geantwortet.');
      const e = st.ergebnis;
      const k = n0.kontext;
      aendern(i, { denkt: false, chatId: null, text: e.antwort, apps: ['suchen', 'oeffnen'].includes(e.aktion) ? e.apps : [] });
      if (e.aktion === 'oeffnen' && e.apps[0]) { const a = app(e.apps[0]); if (a) S().oeffnen?.(kennung(a)); }
      if (e.aktion === 'verbessern' && k) {
        const a = await auftragStarten({ ziel: k.slug, wunsch: e.wunsch, basis: k.version || null });
        aendern(i, { auftrag: a.id }); verfolgen(a.id);
      }
      if (e.aktion === 'pitch') aendern(i, { pitch: e.wunsch });
      if (e.aktion === 'neu' && !STATISCH) {
        const a = await auftragStarten({ anfrage: e.wunsch });
        aendern(i, { auftrag: a.id }); verfolgen(a.id);
      }
    } catch (err) { fehlgeschlagen(i, err.message); }
    finally { wartet.delete(i); }
  }
  function fehlgeschlagen(i, grund) {
    const v = verlauf();
    // Ursprüngliche Frage: gespeichert oder die letzte eigene Nachricht davor
    const frage = v[i]?.frage || v.slice(0, i).reverse().find((x) => x.wer === 'ich')?.text || null;
    const treffer = frage ? lokalSuchen(frage) : [];
    aendern(i, { denkt: false, chatId: null, text: `${grund}${treffer.length ? ' Vielleicht passt eins davon:' : ''}`, apps: treffer, nochmal: frage });
  }
  $h('hwEingabe').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const text = $h('hwText').value.trim();
    if (!text) return;
    $h('hwText').value = '';
    $h('hwText').style.height = '';
    senden(text);
  });
  $h('hwText').addEventListener('keydown', (ev) => { if (ev.key === 'Enter' && !ev.shiftKey && !matchMedia('(pointer: coarse)').matches) { ev.preventDefault(); $h('hwEingabe').requestSubmit(); } });
  $h('hwText').addEventListener('input', () => { const t = $h('hwText'); t.style.height = ''; t.style.height = Math.min(140, t.scrollHeight) + 'px'; });

  document.addEventListener('hw-ablauf', () => zeigen());

  // ---------- Start ----------
  async function katalogLaden() { try { katalog = (await (await fetch('/api/apps', { cache: 'no-store' })).json()).apps || []; zeigen(); } catch { /* später */ } }
  katalogLaden();
  for (const n of verlauf()) if (n.auftrag) verfolgen(n.auftrag);
  verlauf().forEach((n, i) => { if (n.denkt) abwarten(i); });
  // Von außen nutzbar (z. B. Suche auf der Startseite)
  window.hwChat = { oeffnen: () => fensterAuf(true), schliessen: () => fensterAuf(false), senden: (t) => { fensterAuf(true); senden(t); }, aktualisieren: zeigen, leeren: () => { speichern([]); zeigen(); } };
})();
