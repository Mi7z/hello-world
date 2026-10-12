// Pfeil oben + Aktionsleiste in der App-Ansicht.
// Der kleine Pfeil (oben, verschiebbar: gedrückt halten und ziehen) öffnet die Leiste:
//   Zeile 1: ← Start · WO bin ich (App, Version bzw. „Vorschau") · Status · schließen
//   Zeile 2: offene Apps (Tabs) zum Wechseln
//   Zeile 3: Aktionen passend zur Lage (App: Verbessern, Versionen … / Vorschau: Verwerfen, Nachbessern, Übernehmen)
// Die Zurück-Taste (Android) schließt die Leiste. Die Seite beschreibt sich über window.HW_SEITE
// (kontext, tabs, tabWahl, tabZu, aktionen, aktion, ort, mehrBereich).
(() => {
  const S = () => window.HW_SEITE || {};
  document.body.insertAdjacentHTML('beforeend', `
    <button type="button" class="hw-pfeil" id="hwPfeil" aria-label="Hello-World-Leiste öffnen" aria-expanded="false" aria-controls="hwLeiste" title="Hello World (gedrückt halten zum Verschieben)">
      <span class="hw-pfeil-zeichen" aria-hidden="true">⌄</span><span class="hw-pfeil-text" id="hwPfeilText"></span><i class="hw-pfeil-punkt" id="hwPfeilPunkt" hidden></i>
    </button>
    <div class="hw-leiste-hinter" id="hwLeisteHinter" hidden></div>
    <section class="hw-leiste" id="hwLeiste" aria-label="Hello-World-Leiste" hidden>
      <div class="hw-leiste-kopf">
        <a class="knopf leise klein" href="/" id="hwStart" title="Zur Hello-World-Startseite">← Start</a>
        <span class="hw-leiste-luecke"></span>
        <span id="hwLeisteStatus"></span>
        <button type="button" class="leise klein" id="hwLeisteZu" aria-label="Leiste schließen">⌃</button>
      </div>
      <div class="hw-leiste-ort"><b id="hwOrtName"></b><small id="hwOrtInfo"></small></div>
      <nav class="hw-leiste-tabs" id="hwLeisteTabs" aria-label="Offene Apps"></nav>
      <div class="hw-leiste-aktionen" id="hwLeisteAktionen"></div>
      <div class="hw-leiste-mehr" id="hwLeisteMehr" hidden></div>
    </section>`);
  const $l = (id) => document.getElementById(id);
  let offen = false;

  // ---------- Pfeil: antippen öffnet, gedrückt halten + ziehen verschiebt (entlang der Oberkante) ----------
  const pfeil = $l('hwPfeil');
  let x = Number(localStorage.getItem('hw-pfeil-x') || 0.5);
  const setzen = () => { pfeil.style.left = `${Math.round(Math.min(0.9, Math.max(0.1, x)) * 100)}%`; };
  setzen();
  let druck = null;
  pfeil.addEventListener('pointerdown', (ev) => {
    pfeil.setPointerCapture(ev.pointerId);
    druck = { x: ev.clientX, y: ev.clientY, uhr: setTimeout(() => { druck.ziehen = true; pfeil.classList.add('zieht'); navigator.vibrate?.(15); }, 350) };
  });
  pfeil.addEventListener('pointermove', (ev) => {
    if (!druck) return;
    if (!druck.ziehen && Math.hypot(ev.clientX - druck.x, ev.clientY - druck.y) > 12) { clearTimeout(druck.uhr); druck.abbruch = true; }
    if (druck.ziehen) { x = ev.clientX / innerWidth; setzen(); }
  });
  pfeil.addEventListener('pointerup', () => {
    if (!druck) return;
    clearTimeout(druck.uhr);
    if (druck.ziehen) { localStorage.setItem('hw-pfeil-x', String(x)); pfeil.classList.remove('zieht'); }
    else if (!druck.abbruch) leisteAuf(true);
    druck = null;
  });
  pfeil.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); leisteAuf(true); } });

  // ---------- Leiste öffnen/schließen (Zurück-Taste schließt) ----------
  function leisteAuf(auf, { durchZurueck = false } = {}) {
    if (auf === offen) { if (auf) zeigen(); return; }
    offen = auf;
    $l('hwLeiste').hidden = !auf;
    $l('hwLeisteHinter').hidden = !auf;
    pfeil.hidden = auf;
    pfeil.setAttribute('aria-expanded', String(auf));
    if (auf) { history.pushState({ ...(history.state || {}), hwEbene: 'leiste' }, ''); zeigen(); $l('hwLeisteZu').focus({ preventScroll: true }); }
    else { $l('hwLeisteMehr').hidden = true; if (!durchZurueck && history.state?.hwEbene === 'leiste') history.back(); }
  }
  addEventListener('popstate', () => { if (offen && history.state?.hwEbene !== 'leiste' && !window.hwChat?.istOffen()) leisteAuf(false, { durchZurueck: true }); });
  $l('hwLeisteZu').onclick = () => leisteAuf(false);
  $l('hwLeisteHinter').onclick = () => leisteAuf(false);
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && offen && !window.hwChat?.istOffen()) leisteAuf(false); });

  // ---------- Inhalt ----------
  function pfeilZeigen() {
    const o = S().ort?.() || {};
    const vorschau = Boolean(o.vorschau);
    pfeil.classList.toggle('vorschau', vorschau);
    $l('hwPfeilText').textContent = vorschau ? 'VORSCHAU' : '';
    const s = typeof hwStatus !== 'undefined' ? hwStatus : { laeuft: [], vorschau: [] };
    const punkt = $l('hwPfeilPunkt');
    punkt.hidden = vorschau || !(s.laeuft.length || s.vorschau.length);
    punkt.className = `hw-pfeil-punkt${s.vorschau.length ? ' fertig' : ' baut'}`;
  }
  function zeigen() {
    pfeilZeigen();
    if (!offen) return;
    const o = S().ort?.() || {};
    $l('hwOrtName').textContent = o.name || 'Hello World';
    $l('hwOrtInfo').textContent = o.info || '';
    $l('hwLeiste').classList.toggle('vorschau', Boolean(o.vorschau));
    $l('hwLeisteStatus').innerHTML = statusChipHtml();
    const tabs = S().tabs?.() || [];
    $l('hwLeisteTabs').innerHTML = tabs.map((t, i) => `<button type="button" class="hw-tab${t.aktiv ? ' an' : ''}" data-l-tab="${i}" title="${esc(t.kennung)}">${t.symbol || ''}<span>${esc(t.name)}</span><i data-l-tabzu="${i}" role="button" aria-label="${esc(t.name)} schließen">✕</i></button>`).join('')
      + '<a class="hw-tab neu" href="/" title="Weitere App öffnen">＋</a>';
    $l('hwLeisteAktionen').innerHTML = (S().aktionen?.() || []).map((a) => `<button type="button" class="${a.art === 'haupt' ? '' : a.art === 'leise' ? 'leise' : 'zweit'}${a.breit ? ' breit' : ''}" data-l-aktion="${a.id}">${a.text}</button>`).join('');
  }
  $l('hwLeiste').addEventListener('click', async (ev) => {
    const zu = ev.target.closest('[data-l-tabzu]');
    if (zu) { ev.stopPropagation(); S().tabZu?.(Number(zu.dataset.lTabzu)); zeigen(); return; }
    const tab = ev.target.closest('[data-l-tab]');
    if (tab) { S().tabWahl?.(Number(tab.dataset.lTab)); leisteAuf(false); return; }
    const a = ev.target.closest('[data-l-aktion]');
    if (!a) return;
    if (a.dataset.lAktion === 'mehr') {
      const m = $l('hwLeisteMehr');
      m.hidden = !m.hidden;
      if (!m.hidden) S().mehrBereich?.(m);
      return;
    }
    a.disabled = true;
    try { await S().aktion?.(a.dataset.lAktion, { schliessen: () => leisteAuf(false) }); } finally { a.disabled = false; }
    zeigen();
  });
  document.addEventListener('hw-status', zeigen);
  // Von der Leiste in den Chat wechseln, ohne einen zusätzlichen Zurück-Schritt
  function zuChat(opts = {}) {
    leisteAuf(false, { durchZurueck: true });
    history.replaceState({ ...(history.state || {}), hwEbene: 'chat' }, '');
    window.hwChat?.oeffnen({ ...opts, ohneVerlauf: true });
  }
  window.hwLeiste = { oeffnen: () => leisteAuf(true), schliessen: () => leisteAuf(false), zuChat, aktualisieren: zeigen, istOffen: () => offen };
  zeigen();
})();
