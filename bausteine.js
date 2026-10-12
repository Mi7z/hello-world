// Layout-Designs: Ein Design kann – neben Farben und Schrift – die ganze Startseite neu
// anordnen. Es bringt eine Vorlage mit (in design.css zwischen /* hw-layout … hw-layout */),
// die die festen BAUSTEINE beliebig platziert und eigene Panels und Knöpfe ergänzt.
// Knöpfe lösen nur Aktionen aus dieser Liste aus. Kein eigenes JavaScript – so kann ein
// fremdes Design nie an Konto, Schlüssel oder Daten.

export const BAUSTEINE = {
  logo: 'Logo „hw Hello World" (Link zur Startseite)',
  navigation: 'Bereichs-Navigation (Entdecken, Aufträge, Geräte, Mehr) – auf dem Handy standardmäßig als Leiste unten',
  konto: 'Konto-Knopf (@Name bzw. Anmelden)',
  'install-hinweis': 'Kleiner Hinweis „Hello World als App installieren" (nur auf Handys, ausblendbar)',
  titel: 'Große Überschrift „Was brauchst du?"',
  einleitung: 'Ein Satz unter der Überschrift',
  suche: 'Suchfeld – Eingabe geht in den Hello-World-Chat (Vorschläge, öffnen, neu bauen)',
  vorschlaege: 'Vorschlags-Knöpfe unter der Suche (z. B. „Bilder verkleinern")',
  katalog: 'Liste aller Einträge mit Filter-Chips (Apps, Designs, Skills, KI-Werkzeuge)',
  bau: 'Der gerade verfolgte Bau-Auftrag mit Zeitleiste, Vorschau und Veröffentlichen',
  auftragsliste: 'Liste laufender und offener Aufträge',
  geraete: 'Geräte mit Hello-World-Helfer (koppeln, Liste)',
  installieren: 'Karte „Als App installieren"',
  handy: 'Karte „Vom Handy aus nutzen" (Kopplung per QR-Code, nur im Programm/Server)',
  aussehen: 'Design-Auswahl und „Eigenes Design bauen lassen"',
  'neues-bauen': 'Hinweis aufs Programm (nur in der Web-App ohne Server)',
  'konto-ki': 'Konto und „Deine KI" (welche KI baut)',
  regeln: '„So funktioniert\'s" – die vier Grundregeln',
  'ki-holen': '„In deine KI holen" – Plugin-Anleitung',
  treffer: '(alt) Trefferliste der Suche – wird heute im Chat gezeigt',
};

// Aktionen für eigene Knöpfe: <button data-hw-aktion="name:wert">…</button>
export const AKTIONEN = {
  'bereich:<entdecken|auftraege|geraete|mehr>': 'zeigt diesen Bereich (eigene Bereiche: <section data-hw-ansicht="name">)',
  chat: 'öffnet das Hello-World-Fenster (Chat, Tabs)',
  'chat:<text>': 'schickt diesen Text in den Chat (z. B. „chat:Ich brauche einen Timer")',
  'oeffnen:<kennung>': 'öffnet eine App, z. B. „oeffnen:app.paintboard"',
  'filter:<alle|apps|design|skill|mcp>': 'filtert die Liste aller Einträge',
  'design:<name>': 'wechselt das Design, z. B. „design:klar"',
  'suchfeld': 'setzt den Cursor ins Suchfeld',
  'ki-verbinden': 'öffnet „KI verbinden"',
  installieren: 'Hello World als App installieren',
  anmelden: 'Anmelden bzw. Konto wechseln',
  'link:<adresse>': 'öffnet eine Hello-World-Seite (beginnt mit /) oder einen GitHub-Link',
};

// Live-Werte zum Einbauen: <hw-wert name="…"></hw-wert>
export const WERTE = {
  'anzahl-eintraege': 'Anzahl aller Einträge',
  'anzahl-apps': 'Anzahl der Apps',
  'anzahl-auftraege': 'laufende/offene Aufträge',
  konto: 'angemeldeter Name (@…)',
  ki: 'welche KI baut',
  design: 'Name des aktiven Designs',
};

export const TAGS = ['div', 'section', 'header', 'footer', 'main', 'nav', 'aside', 'article', 'h1', 'h2', 'h3', 'h4', 'p', 'span', 'b', 'strong', 'i', 'em', 'small', 'br', 'hr', 'ul', 'ol', 'li', 'a', 'button', 'details', 'summary', 'img', 'figure', 'figcaption', 'hw-baustein', 'hw-wert'];

export function layoutAus(css) {
  const m = String(css || '').match(/\/\*\s*hw-layout\b([\s\S]*?)\bhw-layout\s*\*\//);
  return m ? m[1].trim() : null;
}

// Prüfung auf dem Server (beim Bauen/Veröffentlichen); die Oberfläche säubert zusätzlich
export function pruefeLayout(html) {
  const fehler = [];
  if (html.length > 30000) fehler.push('Layout zu groß (höchstens 30 KB)');
  const verboten = [
    [/<\s*(script|style|iframe|object|embed|link|meta|form|input|textarea|select|svg|math|template|base)\b/i, 'nicht erlaubte Elemente (kein Script, Style, Formular, iframe, svg …)'],
    [/\son\w+\s*=/i, 'keine Ereignis-Attribute (onclick …) – Knöpfe nutzen data-hw-aktion'],
    [/javascript:|data:text\/html|vbscript:/i, 'keine Skript-Adressen'],
    [/\sstyle\s*=/i, 'kein style-Attribut – Aussehen gehört ins CSS'],
    [/\s(src|href)\s*=\s*["']?\s*(https?:)?\/\/(?!github\.com\/)/i, 'keine fremden Adressen (nur /… oder github.com)'],
    [/\ssrc\s*=\s*["']?(?!data:image\/)/i, 'Bilder nur als data:image/…'],
  ];
  for (const [m, t] of verboten) if (m.test(html)) fehler.push(`Layout: ${t}`);
  for (const t of html.matchAll(/<\s*([a-z][a-z0-9-]*)/gi)) if (!TAGS.includes(t[1].toLowerCase())) { fehler.push(`Layout: Element <${t[1]}> ist nicht erlaubt`); break; }
  for (const b of html.matchAll(/<hw-baustein[^>]*name=["']([^"']+)/gi)) if (!BAUSTEINE[b[1]]) fehler.push(`Layout: Baustein „${b[1]}" gibt es nicht`);
  for (const a of html.matchAll(/data-hw-aktion=["']([^"':]+)/gi)) if (!Object.keys(AKTIONEN).some((k) => k.split(':')[0] === a[1])) fehler.push(`Layout: Aktion „${a[1]}" gibt es nicht`);
  return fehler;
}

// Für die Design-Anleitung der KI
export const LAYOUT_ANLEITUNG = () => `
LAYOUT (optional, für komplett neue Anordnungen): Du darfst die Startseite von Hello World neu aufbauen. Schreibe dafür ans Ende von design.css einen Kommentar
/* hw-layout
<header class="mein-kopf"><hw-baustein name="logo"></hw-baustein><hw-baustein name="navigation"></hw-baustein><hw-baustein name="konto"></hw-baustein></header>
<main class="meine-seite">
  <section data-hw-ansicht="entdecken"> … Bausteine, eigene Panels, Knöpfe … </section>
  <section data-hw-ansicht="auftraege"><hw-baustein name="bau"></hw-baustein><hw-baustein name="auftragsliste"></hw-baustein></section>
  <section data-hw-ansicht="geraete"><hw-baustein name="geraete"></hw-baustein></section>
  <section data-hw-ansicht="mehr"> … </section>
</main>
hw-layout */
und gestalte die eigenen Klassen im CSS darüber. Bausteine (platzieren mit <hw-baustein name="…">, jeder höchstens einmal; nicht platzierte sind ausgeblendet):
${Object.entries(BAUSTEINE).map(([k, v]) => `- ${k}: ${v}`).join('\n')}
Eigene Knöpfe/Links mit <button data-hw-aktion="…">Text</button>, erlaubte Aktionen:
${Object.entries(AKTIONEN).map(([k, v]) => `- ${k}: ${v}`).join('\n')}
Live-Werte mit <hw-wert name="…"></hw-wert>: ${Object.keys(WERTE).join(', ')}.
Erlaubte Elemente: ${TAGS.join(', ')}. Attribute nur: class, data-hw-aktion, data-hw-ansicht, name, title, role, aria-*, open, alt, href (nur /… oder https://github.com/…), src (nur data:image/…). KEIN script, style-Attribut, onclick, Formular, iframe, svg, fremde Adressen.
Bereiche: jede <section data-hw-ansicht="entdecken|auftraege|geraete|mehr|eigener-name"> ist ein Bereich (nur einer sichtbar). Platziere suche, katalog, bau, aussehen, konto-ki und navigation, sonst fehlen wichtige Funktionen. Handy UND Desktop müssen gut funktionieren.`;
