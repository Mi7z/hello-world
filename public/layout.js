// Layout-Designs: Hat das gewählte Design eine eigene Anordnung (/* hw-layout … hw-layout */
// in design.css), baut Hello World die Startseite danach neu auf. Die festen Bausteine
// (Suche, Katalog, Aufträge …) werden samt ihrer Funktion an ihre neuen Plätze gesetzt;
// eigene Knöpfe lösen nur Aktionen aus der festen Liste aus. Kein fremdes JavaScript.
(() => {
  const TAGS = new Set(['div', 'section', 'header', 'footer', 'main', 'nav', 'aside', 'article', 'h1', 'h2', 'h3', 'h4', 'p', 'span', 'b', 'strong', 'i', 'em', 'small', 'br', 'hr', 'ul', 'ol', 'li', 'a', 'button', 'details', 'summary', 'img', 'figure', 'figcaption', 'hw-baustein', 'hw-wert']);
  const ATTRIBUTE = new Set(['class', 'data-hw-aktion', 'data-hw-ansicht', 'name', 'title', 'role', 'open', 'alt', 'href', 'src', 'type']);
  const merkName = (n) => `hw-layout-hat:${n}`;

  function saeubern(html) {
    const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html'); // führt nichts aus
    const gehen = (knoten) => {
      for (const k of [...knoten.children]) {
        const tag = k.tagName.toLowerCase();
        if (!TAGS.has(tag)) { k.remove(); continue; }
        for (const a of [...k.attributes]) {
          const n = a.name.toLowerCase(), v = a.value.trim();
          const ok = (ATTRIBUTE.has(n) || n.startsWith('aria-'))
            && !(n === 'href' && !(v.startsWith('/') || v.startsWith('#') || v.startsWith('https://github.com/')))
            && !(n === 'src' && !/^data:image\/(png|jpe?g|gif|webp);/i.test(v));
          if (!ok) k.removeAttribute(a.name);
        }
        if (tag === 'button' && !k.getAttribute('type')) k.setAttribute('type', 'button');
        gehen(k);
      }
    };
    gehen(doc.body);
    return doc.body;
  }

  function aktion(wert) {
    const [name, ...rest] = String(wert).split(':');
    const arg = rest.join(':').trim();
    const BEFEHLE = {
      bereich: () => { location.hash = arg || 'entdecken'; },
      chat: () => (arg ? window.hwChat?.senden(arg) : window.hwChat?.oeffnen()),
      oeffnen: () => { if (/^[a-z]+\.[a-z0-9-]+(@v\d+)?$/.test(arg)) location.href = `/a/${arg}`; },
      filter: () => document.querySelector(`#filter [data-filter="${CSS.escape(arg)}"]`)?.click(),
      design: () => { if (/^[a-z0-9-]+$/.test(arg)) { designWaehlen(arg); location.reload(); } },
      suchfeld: () => { location.hash = 'entdecken'; setTimeout(() => document.getElementById('anfrage')?.focus(), 50); },
      'ki-verbinden': () => document.getElementById('kiKnopf')?.click(),
      installieren: () => appInstallieren(),
      anmelden: () => anmelden(),
      link: () => { if (arg.startsWith('/')) location.href = arg; else if (arg.startsWith('https://github.com/')) open(arg, '_blank', 'noopener'); },
    };
    BEFEHLE[name]?.();
  }
  document.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-hw-aktion]');
    if (!b) return;
    ev.preventDefault();
    aktion(b.dataset.hwAktion);
  });

  function werte() {
    const apps = (typeof stand !== 'undefined' && stand.apps) || [];
    const W = {
      'anzahl-eintraege': apps.length,
      'anzahl-apps': apps.filter((a) => ['browser', 'server'].includes(a.typ || 'browser')).length,
      'anzahl-auftraege': document.getElementById('auftragZahl')?.hidden ? 0 : document.getElementById('auftragZahl')?.textContent || 0,
      konto: typeof ich !== 'undefined' && ich ? `@${ich.login}` : '',
      ki: document.getElementById('kiName')?.textContent || '',
      design: designName(),
    };
    for (const el of document.querySelectorAll('hw-wert')) el.textContent = W[el.getAttribute('name')] ?? '';
  }

  async function anwenden() {
    const name = designName();
    let css = '';
    try { css = await (await fetch(`/api/design/${name}.css`)).text(); } catch { /* ohne Layout */ }
    const m = css.match(/\/\*\s*hw-layout\b([\s\S]*?)\bhw-layout\s*\*\//);
    localStorage.setItem(merkName(name), m ? '1' : '0');
    if (!m) { document.documentElement.classList.remove('hw-layout-laedt'); return; }
    const vorlage = saeubern(m[1]);
    const teile = new Map([...document.querySelectorAll('[data-baustein]')].map((el) => [el.dataset.baustein, el]));
    // Nicht platzierte Bausteine bleiben ausgeblendet erhalten (ihre Funktion läuft weiter)
    const lager = document.createElement('div');
    lager.id = 'hwLager'; lager.hidden = true;
    for (const platz of [...vorlage.querySelectorAll('hw-baustein')]) {
      const teil = teile.get(platz.getAttribute('name'));
      if (teil && !teil.dataset.platziert) { teil.dataset.platziert = '1'; platz.replaceWith(teil); } else platz.remove();
    }
    for (const [, teil] of teile) if (!teil.dataset.platziert) lager.appendChild(teil);
    for (const s of vorlage.querySelectorAll('[data-hw-ansicht]')) s.dataset.ansicht = s.dataset.hwAnsicht;
    const neu = document.createElement('div');
    neu.className = 'hw-layout';
    neu.append(...vorlage.childNodes);
    document.querySelector('body > header.kopf')?.remove();
    document.querySelector('body > main.seite')?.remove();
    document.body.prepend(neu, lager);
    document.body.classList.add('mit-layout');
    if (typeof bereich === 'function') bereich(location.hash.slice(1), false);
    werte();
    setInterval(werte, 3000);
    document.documentElement.classList.remove('hw-layout-laedt');
  }
  document.addEventListener('hw-design', (ev) => {
    // Wechsel zu/von einem Design mit eigener Anordnung → Seite neu aufbauen
    if (localStorage.getItem(merkName(ev.detail)) !== '0' || document.body.classList.contains('mit-layout')) location.reload();
  });
  anwenden();
  setTimeout(() => document.documentElement.classList.remove('hw-layout-laedt'), 1500);
})();
