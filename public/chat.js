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
    <aside class="hw-fenster" id="hwFenster" aria-label="Chat" hidden>
      <header class="hw-fenster-kopf">
        <button type="button" class="leise klein" id="hwZu" aria-label="Chat schließen">← Zurück</button>
        <b class="hw-fenster-titel">💬 Chat</b>
        <span id="hwFensterStatus"></span>
      </header>
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

  // Öffnen/Schließen – die Zurück-Taste (Android) schließt den Chat
  let nachbessernFuer = null; // { id, titel } – nächste Nachricht bessert diesen Auftrag nach
  function fensterAuf(auf, opts = {}) {
    if (opts.nachbessern) { nachbessernFuer = opts.nachbessern; ohneBezug = false; }
    if (auf === offen) { if (auf) zeigen(); return; }
    offen = auf;
    $h('hwFenster').hidden = !auf;
    document.body.classList.toggle('hw-fenster-offen', auf);
    if (auf) {
      if (!opts.ohneVerlauf) history.pushState({ ...(history.state || {}), hwEbene: 'chat' }, '');
      zeigen();
      setTimeout(() => $h('hwText').focus({ preventScroll: true }), 50);
    } else if (!opts.durchZurueck && history.state?.hwEbene === 'chat') history.back();
  }
  addEventListener('popstate', () => { if (offen && history.state?.hwEbene !== 'chat') fensterAuf(false, { durchZurueck: true }); });
  $h('hwZu').onclick = () => fensterAuf(false);
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && offen) fensterAuf(false); });
  document.addEventListener('hw-status', () => { $h('hwFensterStatus').innerHTML = statusChipHtml(); });

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
      knoepfe = `<button type="button" class="zweit klein" data-hw-ansehen="${id}">▶ Vorschau</button>
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
    const ziel = a.zielKennung
      ? `✎ Verbesserung für <b>${esc(a.zielKennung)}</b>${a.basis ? ` <span class="leise-text">(ab v${esc(a.basis.slice(1))})</span>` : ''}`
      : a.typ === 'design' ? `◐ Neues Design: <b>${esc(a.titelAnzeige || '')}</b>` : `✨ Neue App: <b>${esc(a.titelAnzeige || 'wird benannt …')}</b>`;
    return `<div class="hw-auftrag ${a.status}"><div class="hw-auftrag-kopf"><span>${ziel}</span></div>
      ${ablaufMeldungen(a)}
      ${ablaufHtml(a)}
      ${knoepfe ? `<div class="knoepfe links">${knoepfe}</div>` : ''}</div>`;
  }
  function zeigen() {
    if (!offen) return;
    const k = S().kontext?.();
    // Bezug: worauf sich die nächste Nachricht bezieht
    const bezug = k && !ohneBezug;
    $h('hwBezug').hidden = !k && !nachbessernFuer;
    $h('hwBezug').innerHTML = nachbessernFuer ? `✎ Nachbessern: <b>${esc(nachbessernFuer.titel)}</b> <button type="button" class="leise klein" id="hwBezugAus" aria-label="Nicht nachbessern">✕</button>`
      : bezug ? `Für <b>${esc(k.kennung)}</b> <button type="button" class="leise klein" id="hwBezugAus" aria-label="Ohne Bezug zur App schreiben">✕</button>`
      : k ? `<button type="button" class="leise klein" id="hwBezugAn">Für ${esc(k.kennung)} schreiben</button>` : '';
    $h('hwBezugAus')?.addEventListener('click', () => { if (nachbessernFuer) nachbessernFuer = null; else ohneBezug = true; zeigen(); });
    $h('hwBezugAn')?.addEventListener('click', () => { ohneBezug = false; zeigen(); });
    $h('hwText').placeholder = nachbessernFuer ? 'Was soll noch anders werden?' : bezug ? 'Was soll die App können?' : 'Was brauchst du?';
    // Verlauf
    const v = verlauf();
    $h('hwVerlauf').innerHTML = v.length ? v.map((n, i) => `<div class="hw-nachricht ${n.wer}">
        ${n.wer === 'ich' ? `<span class="hw-fuer">${n.art === 'nachbessern' ? '✎ Nachbessern · ' : n.fuer ? '→ ' : ''}${n.fuer ? esc(n.fuer) : 'Hello World'}</span>` : ''}
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
    if (o) { fensterAuf(false, { durchZurueck: true }); S().oeffnen?.(o.dataset.hwOeffnen); return; }
    const an = t.closest('[data-hw-ansehen]');
    if (an) { const a = auftraegeStand.get(an.dataset.hwAnsehen); if (a) { fensterAuf(false, { durchZurueck: true }); if (S().vorschauOeffnen) S().vorschauOeffnen(a); else location.href = vorschauAdresse(a); } return; }
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
    if (nb) { const a = auftraegeStand.get(nb.dataset.hwNachbessern); nachbessernFuer = { id: nb.dataset.hwNachbessern, titel: a?.titelAnzeige || 'Auftrag' }; zeigen(); $h('hwText').focus(); return; }
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
    if (nachbessernFuer) {
      const ziel = nachbessernFuer; nachbessernFuer = null;
      hinzu({ wer: 'ich', text, fuer: ziel.titel.replace(/ weiterentwickeln$/, ''), art: 'nachbessern' });
      try {
        await auftragAktion(ziel.id, 'nachbessern', { was: text });
        hinzu({ wer: 'hw', text: 'Ich bessere nach – die Vorschau aktualisiert sich gleich.', auftrag: ziel.id });
        verfolgen(ziel.id);
      } catch (err) { hinzu({ wer: 'hw', text: `Nachbessern hat nicht geklappt: ${err.message}` }); }
      return;
    }
    const k = ohneBezug ? null : S().kontext?.();
    const bisher = verlauf().filter((n) => n.text).map((n) => ({ wer: n.wer, text: n.text }));
    hinzu({ wer: 'ich', text, fuer: k ? k.kennung + (k.version ? '@' + k.version : '') : null });
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
  window.hwChat = { oeffnen: (opts = {}) => fensterAuf(true, opts), istOffen: () => offen, schliessen: () => fensterAuf(false), senden: (t) => { fensterAuf(true); senden(t); }, aktualisieren: zeigen, leeren: () => { speichern([]); zeigen(); } };
})();
