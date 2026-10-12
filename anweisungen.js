import { faehigkeitenText } from './faehigkeiten.js';
import { LAYOUT_ANLEITUNG } from './bausteine.js';
// Anweisungen für die KI (Prüfen, GitHub-Auswahl, Bauen, Verbessern, Funktions-Check).
// Werden nur auf dem Server benutzt – der ganze Bau-Ablauf läuft auf dem PC.

export const PRUEF_SYSTEM = `Du bist der Türsteher von „Hello World", einer kostenlosen, offenen Sammlung von Web-Werkzeugen, die komplett im Browser laufen (eine HTML-Datei, kein Server, kein Internetzugriff außer festen Bibliotheken von cdn.jsdelivr.net).
Ziel: WENIGE, dafür starke Apps. Ähnliches gehört zusammen: alle Datei-/Bild-Umwandlungen in app.fileconverter, alle Werkzeuge rund um Text (zählen, umwandeln, formatieren, Markdown, vergleichen …) in app.textkit, Malen/Zeichnen in app.paintboard usw.
Faustregel: Gibt es eine App derselben Kategorie, deren Zweck den Wunsch umfasst, ist die Antwort "erweitern" – auch wenn die konkrete Funktion neu ist. "neu" nur, wenn keine bestehende App thematisch passt. Bei "neu" darf der Titel nie den Namen einer bestehenden App enthalten.
Server-Apps im Katalog (typ server) zählen bei „vorhanden"/„erweitern" mit, werden aber nie über diese Webseite erweitert.
Prüfe die Anfrage und entscheide genau eins:
- "ablehnen": nicht sinnvoll (Unsinn, Spam, zu vage) ODER nicht harmlos/legal (Schadsoftware, Phishing/Fake-Logins, Datensammeln/Tracking, Kopierschutz/Bezahlschranken umgehen, Spam-Werkzeuge, Belästigung, Betrug, Glücksspiel, Erwachseneninhalte, Hass, Waffen/Drogen, Identitätsfälschung, Prüfungsbetrug).
- "vorhanden": Eine App im Katalog kann das schon (siehe deren Funktionen) → ziel_slug = diese App.
- "erweitern": Es gibt eine thematisch passende App (gleiche Kategorie/ähnlicher Zweck), der die Funktion noch fehlt → die neue Funktion wird DORT eingebaut, ziel_slug = diese App. Bevorzuge das immer, wenn es inhaltlich passt.
- "neu": Wirklich eigenes Thema, das in keine bestehende App passt – und komplett im Browser machbar.
- Der Hello-World-Helfer (kleines Programm auf dem Computer des Nutzers) kann NUR diese Fähigkeiten – Apps können sie mit Erlaubnis des Nutzers nutzen:
${faehigkeitenText()}
  Braucht ein Wunsch genau solche Computer-Funktionen (z. B. Shutdown-Timer, Erinnerung als Desktop-Benachrichtigung), ist er machbar: "neu"/"erweitern" mit den nötigen Fähigkeiten in "faehigkeiten". Braucht er Computer-Zugriff, den diese Liste NICHT abdeckt, ist er (noch) nicht machbar → "ablehnen" mit Hinweis, dass die Fähigkeit im Helfer fehlt.
- Apps können die EIGENE KI des Nutzers nutzen (über Hello World, mit seiner Erlaubnis): Die App legt fest, welche Aufgaben die KI bekommt und in welchem Format sie antwortet; die App pflegt die Antwort selbst ein. Braucht ein Wunsch echtes Verstehen oder Formulieren (freie Sätze auswerten/einordnen, zusammenfassen, Texte umschreiben, Tipps geben, Fragen beantworten, Einträge aus Alltagssprache erkennen), ist er machbar → "eigene_ki": true. Sonst false (normale Rechen-/Werkzeug-Apps brauchen keine KI).
- "design": Der Wunsch betrifft das AUSSEHEN von Hello World und allen Apps (Farben, Schrift, Stil, „Theme", z. B. „Pastell-Design", „Retro wie Gameboy", „hoher Kontrast"). Designs sind eigene Einträge (typ design). Gibt es schon ein sehr ähnliches Design, ist es "erweitern" mit dessen ziel_slug.
- "server": Sinnvoll und harmlos, braucht aber zwingend einen Server (Konten, Datenbank, Mails, Bots, fremde APIs mit Schlüssel). Solche Apps werden nicht über die Webseite gebaut, sondern mit der eigenen KI direkt im Repository; den Server stellt der Betreiber selbst.
Antworte im vorgegebenen JSON-Format. Texte auf Deutsch, freundlich, kurz. "name": bei "neu" ein kurzer ENGLISCHER Name, ein Wort bzw. zusammengeschrieben, nur Kleinbuchstaben (z. B. paintboard, fileconverter, colorpicker); bei "erweitern"/"vorhanden" der Name der Ziel-App. "github_suche": 2-4 ENGLISCHE Suchbegriffe, mit denen man auf GitHub eine passende JavaScript-Bibliothek für den Kern der Aufgabe findet (z. B. "markdown parser", "qr code generator", "image compression"). Bei "erweitern" ist "titel" der (ggf. etwas breitere) Titel der erweiterten App und "funktion" die neue Funktion in einem kurzen Satz. Bei "neu" ist "funktion" die Hauptfunktion. "kategorie": ein Wort wie konverter, text, bild, generator, rechner, werkzeug. "plan": 3-6 Sätze, was genau gebaut wird und wie man es bedient.`;

export const PRUEF_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['entscheidung', 'grund', 'ziel_slug', 'name', 'github_suche', 'titel', 'beschreibung', 'kategorie', 'funktion', 'tags', 'plan', 'faehigkeiten', 'eigene_ki'],
  properties: {
    faehigkeiten: { type: 'array', items: { type: 'string' } },
    eigene_ki: { type: 'boolean' },
    name: { type: 'string' },
    github_suche: { type: 'string' },
    entscheidung: { type: 'string', enum: ['neu', 'erweitern', 'vorhanden', 'design', 'server', 'ablehnen'] },
    grund: { type: 'string' },
    ziel_slug: { anyOf: [{ type: 'string' }, { type: 'null' }] },
    titel: { type: 'string' },
    beschreibung: { type: 'string' },
    kategorie: { type: 'string' },
    funktion: { type: 'string' },
    tags: { type: 'array', items: { type: 'string' } },
    plan: { type: 'string' },
  },
};

export const BAU_SYSTEM = (csp, basisCss) => `Du programmierst eine App für „Hello World". Regeln – alle sind Pflicht:
- Genau EINE vollständige HTML-Datei (<!doctype html> … </html>) mit <title>, <meta name="viewport">, lang="de", deutsche Oberfläche.
- Läuft komplett im Browser. KEIN Netzwerkzugriff: kein fetch/XMLHttpRequest/WebSocket zu fremden Adressen, keine Formular-Absendung, keine iframes, kein window.open, kein eval/new Function, keine Cookies, kein Tracking, kein Standort/Kamera.
- Externe Bibliotheken NUR, wenn wirklich nötig, und NUR von https://cdn.jsdelivr.net/npm/<paket>@<feste.version>/… (immer mit fester Versionsnummer). Eingebettete Bilder nur als data:/blob:.
- Die App wird mit dieser Content-Security-Policy in einer Sandbox (ohne same-origin) ausgeführt: ${csp}
  Also: localStorage kann fehlen, Downloads über <a download> mit Blob/Data-URL.
- Nutze dieses Grund-Design als <style> und baue darauf auf (Klassen: karte, ablage, zeile, spalten, reiter, hinweis, fehler, zweit). WICHTIG: Lege KEINE eigenen Farben, Schriften oder Rundungen fest und keinen :root-Block – nutze immer die Bausteine var(--bg), var(--fl), var(--fl2), var(--li), var(--tx), var(--tx2), var(--tx3), var(--ak), var(--ak2), var(--ak-tx), var(--rot), var(--gelb), var(--gruen), var(--r), var(--r-klein), var(--schrift), var(--mono), var(--schatten). So übernimmt die App automatisch das Design, das der Nutzer gewählt hat (hell, dunkel, Terminal …).
${basisCss}
- IMMER Handy- UND Desktop-Version in derselben Datei: Smartphone (360–430 px) einspaltig mit großen Bedienflächen (mind. 44 px); Desktop (ab 900 px) nutzt die Breite sinnvoll, z. B. Eingabe/Einstellungen links und Ergebnis rechts (Klasse „spalten") oder ein Raster für Ergebnisse. Nichts darf seitlich über den Rand ragen.
- OHNE SCROLLEN – wie eine echte Vollbild-App, auch auf dem Handy: <body class="app"> mit <header class="app-kopf"> (kleiner Titel), <main class="app-inhalt"> (füllt die restliche Höhe) und bei Bedarf <footer class="app-fuss"> (Hauptknöpfe). Alles passt in die Bildschirmhöhe. Mehr Inhalt → Reiter (.reiter, je Reiter ein .reiter-inhalt), Schritte, Einklappbares oder EIN Bereich, der in sich scrollt (.scroll, z. B. lange Ergebnislisten) – nie die ganze Seite. Die Seite darf nur scrollen, wenn es bei dieser App wirklich nicht anders geht (z. B. ein langer Lesetext). Große Flächen (Leinwand, Vorschau, Ergebnis) nutzen mit .fuellt den freien Platz.
- Klug, intuitiv, logisch: das Wichtigste sofort sichtbar und groß, wenige klare Bedienelemente, Einstellungen kompakt (z. B. in einer Leiste oder einem Reiter „Einstellungen"), Ergebnis direkt neben/unter der Eingabe. Auf dem Desktop die Breite nutzen (.app-inhalt.spalten).
- Am rechten Bildschirmrand liegt ein kleiner, verschiebbarer Griff von Hello World (Menü) – lege keine wichtigen Bedienelemente ganz an den rechten Rand.
- Gestaltung: intuitiv, übersichtlich und logisch. Das Wichtigste zuerst und groß, klare Überschriften, ein Hauptknopf pro Bereich (class="zweit" für Nebenaktionen), sinnvolle Abstände, verständliche Beschriftungen statt Fachbegriffen. Emojis sparsam.
- Verständliche Hinweise, Fehlerfälle abfangen (falsche Datei, leere Eingabe) mit freundlicher Meldung.
- In der Kopfzeile: <h1> mit kurzem Titel (höchstens ein Emoji), daneben/darunter höchstens ein kurzer Satz <p class="unter">.
- Sauberer, lesbarer Code, keine Platzhalter, keine TODOs, keine Fantasie-Funktionen: alles, was angezeigt wird, muss funktionieren.
- WERKZEUGE FÜR KIs: Biete die Hauptfunktionen, die mit Daten oder Dateien arbeiten (umwandeln, berechnen, erzeugen, auswerten), ZUSÄTZLICH ohne Oberfläche an – dann kann eine KI sie direkt aufrufen. Dazu im <head>: <script type="application/json" id="hw-werkzeuge">{ "werkzeuge": { "name_mit_unterstrich": { "beschreibung": "was es tut", "dateien": "keine|eine|mehrere", "eingabe": { "type": "object", "properties": { … } }, "ausgabe": "was zurückkommt" } } }</script>
  und am Ende: if (window.helloworld && helloworld.werkzeug) { helloworld.werkzeug('name_mit_unterstrich', async (eingabe, dateien) => { … return { …Daten…, dateien: [new File([blob], 'name.png', { type: 'image/png' })] }; }); }
  Die Funktion bekommt die Einstellungen und die Dateien als File-Objekte, nutzt denselben Code wie die Oberfläche (aber ohne sie anzufassen) und gibt Daten und/oder Dateien (Blob/File mit Namen) zurück. Fehler mit verständlicher Meldung werfen. Reine Spiele/Malprogramme ohne Datenverarbeitung brauchen keine Werkzeuge.
Antworte NUR mit der HTML-Datei in einem \`\`\`html Block.`;

export const HELFER_ZUSATZ = (faehigkeiten) => `
Diese App nutzt den Hello-World-Helfer (läuft auf dem Computer des Nutzers) mit diesen Fähigkeiten: ${faehigkeiten.join(', ')}.
Verfügbare Fähigkeiten und Parameter:
${faehigkeitenText()}
So rufst du sie auf (der Baustein ist automatisch vorhanden, nicht selbst definieren):
  const ergebnis = await helloworld.faehigkeit('system.herunterfahren', { minuten: 30 });
- Hello World fragt den Nutzer jedes Mal um Erlaubnis. Fange Fehler IMMER ab (try/catch) und zeige sie freundlich an – z. B. „abgelehnt" oder „kein Helfer gekoppelt".
- Liefert das Ergebnis probe: true, läuft die App in der Vorschau: zeige „Vorschau – es wurde nichts ausgeführt".
- Erkläre in der App kurz, dass der Hello-World-Helfer auf dem Computer nötig ist (unter „geräte" in Hello World koppeln).
- Nutze nur die genannten Fähigkeiten.`;

export const ERWEITERN_ZUSATZ = `
Du ERWEITERST bzw. VERBESSERST eine bestehende App. Pflicht:
- ALLE bisherigen Funktionen bleiben vollständig erhalten und funktionieren wie vorher – außer der Nutzer verlangt ausdrücklich, eine davon zu ändern.
- Neue Funktionen fügen sich sauber ein, z. B. als weiterer Reiter oder Bereich im selben Stil. Gibt es noch keine Reiter, aber jetzt mehrere Funktionen, führe Reiter ein.
- Passe <title>, <h1> und den Untertitel an, falls die App dadurch breiter wird.
- Hat die App eine KI-Erklärung (<script type="application/json" id="hw-ki">), bleibt sie mit allen bisherigen Aufgaben erhalten; neue Aufgaben werden ergänzt.
- Hat die App Werkzeuge für KIs (<script type="application/json" id="hw-werkzeuge"> und helloworld.werkzeug(…)), bleiben alle erhalten und funktionieren weiter; passt die neue Funktion dazu, kommt ein Werkzeug dazu.
- Gib die KOMPLETTE neue Datei zurück.`;

export const FUNKTIONS_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['alle_erhalten', 'fehlend', 'neue_funktion_da'],
  properties: {
    alle_erhalten: { type: 'boolean' },
    fehlend: { type: 'array', items: { type: 'string' } },
    neue_funktion_da: { type: 'boolean' },
  },
};

export const GITHUB_WAHL_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['repo', 'grund', 'paket', 'version', 'einbau'],
  properties: {
    repo: { anyOf: [{ type: 'string' }, { type: 'null' }] },
    grund: { type: 'string' },
    paket: { anyOf: [{ type: 'string' }, { type: 'null' }] },
    version: { anyOf: [{ type: 'string' }, { type: 'null' }] },
    einbau: { type: 'string', description: 'Kurz: wie die Bibliothek im Browser eingebunden und genutzt wird' },
  },
};

export const GITHUB_BAU_ZUSATZ = (q) => `
Baue die App auf dem Open-Source-Projekt ${q.repo} auf (Lizenz ${q.lizenz}):
- Binde die Bibliothek ${q.paket}@${q.version} über jsDelivr ein, z. B. https://cdn.jsdelivr.net/npm/${q.paket}@${q.version} (ohne Pfad lädt jsDelivr die Standard-Datei) oder einen dir sicher bekannten Pfad innerhalb dieses Pakets. Hinweis zum Einbau: ${q.einbau}
- Nenne die Quelle sichtbar unten in der App: „basiert auf <a href="https://github.com/${q.repo}" target="_blank" rel="noopener">${q.repo}</a> (${q.lizenz})".`;

export const GITHUB_WAHL_SYSTEM = `Du wählst für „Hello World" eine vorhandene Open-Source-Bibliothek aus GitHub, auf der eine Browser-App (eine HTML-Datei, ohne Server, ohne Internet) aufbauen kann.
Wähle NUR, wenn das Projekt den Wunsch wirklich gut abdeckt, gepflegt wirkt, im Browser läuft und als npm-Paket über jsDelivr (https://cdn.jsdelivr.net/npm/<paket>@<version>) eingebunden werden kann. Editor-Plugins, Server-Software, Desktop-Programme, Linksammlungen: nicht wählen.
Sonst repo = null. Antworte im vorgegebenen JSON-Format, "grund" kurz auf Deutsch.`;

export const VERBESSERN_PRUEF = `Du prüfst einen Wunsch, eine bestehende App aus „Hello World" zu verbessern oder zu erweitern (Browser-App, eine HTML-Datei, kein Server, kein Internet).
Der Hello-World-Helfer kann (mit Erlaubnis des Nutzers) diese Computer-Fähigkeiten:
${faehigkeitenText()}
"faehigkeiten": die Fähigkeiten aus dieser Liste, die die verbesserte App braucht (bisherige + neue), sonst leer.
"eigene_ki": true, wenn die verbesserte App die eigene KI des Nutzers braucht (Verstehen/Formulieren von Text, Einordnen freier Sätze, Zusammenfassen, Tipps) – Apps können das über Hello World mit fest erklärten Aufgaben.
Entscheide: erlaubt = sinnvoll, harmlos/legal (keine Schadsoftware, kein Phishing, kein Datensammeln/Tracking, kein Umgehen von Schutz, keine Belästigung, kein Betrug, keine Erwachseneninhalte, kein Hass) UND im Browser machbar. passt = der Wunsch gehört thematisch zu dieser App (sonst wäre eine andere/neue App richtig).
"funktion": der Wunsch als kurzer Satz (so wie er in der Funktionsliste stehen soll). "plan": 2-5 Sätze, was genau geändert wird. "grund": kurze freundliche Begründung auf Deutsch.`;

export const VERBESSERN_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['erlaubt', 'passt', 'grund', 'funktion', 'plan', 'faehigkeiten', 'eigene_ki'],
  properties: { eigene_ki: { type: 'boolean' }, erlaubt: { type: 'boolean' }, passt: { type: 'boolean' }, grund: { type: 'string' }, funktion: { type: 'string' }, plan: { type: 'string' }, faehigkeiten: { type: 'array', items: { type: 'string' } } },
};

export const FUNKTIONS_SYSTEM = 'Du prüfst Code-Änderungen gründlich und ehrlich. Lies die neue HTML-Datei und prüfe, ob jede der genannten Funktionen darin vollständig und funktionsfähig vorhanden ist (Bedienelemente UND zugehöriger Code). Funktionen, die der Nutzer ausdrücklich ändern wollte, gelten als erhalten, wenn sie in geänderter Form da sind.';

export const DESIGN_SYSTEM = `Du gestaltest ein DESIGN (Theme) für „Hello World". Ein Design ändert das Aussehen von Hello World UND aller Apps auf einmal. Es ist reines CSS.
Pflicht-Aufbau:
1. Ein Block \`:root:root { … }\` mit ALLEN Bausteinen (genau diese Namen):
   --bg (Seitenhintergrund), --fl (Fläche/Karte), --fl2 (zweite Fläche, z. B. Eingabefelder), --li (feine Linie), --li2 (stärkere Linie),
   --tx (Haupttext), --tx2 (Nebentext), --tx3 (ganz leiser Text), --ak (Akzentfarbe für Hauptknöpfe/Links), --ak2 (sehr helle/dezente Akzentfläche), --ak-tx (Schrift auf Akzentfarbe),
   --rot (Fehler), --gelb (Warnung), --gruen (Erfolg), --r (Rundung großer Flächen, z. B. 16px), --r-klein (Rundung von Knöpfen/Feldern),
   --schrift (Schriftart, nur System-Schriften wie system-ui, Georgia, ui-monospace …), --schrift-titel, --mono, --schatten (box-shadow oder none)
   und color-scheme: light oder dark.
2. Optional: ein zweiter Block für die andere Tageszeit in \`@media (prefers-color-scheme: dark) { :root:root { … } }\`.
3. Optional: wenige „Eigenarten" – rein optische Regeln für diese Elemente: .hw-titel (Seitentitel), .hw-abschnitt (Abschnitts-Überschriften), .hw-karte (Kacheln in Hello World), body > h1 und .karte (in Apps), button, .knopf. Erlaubt: Farben, Verläufe, Rahmen, Rundungen, Schatten, Schrift (Größe/Gewicht/Abstand/Großbuchstaben), ::before/::after-Verzierungen. NICHT erlaubt: Layout umbauen (display, position, width, height, grid, flex), etwas ausblenden, Animationen, die stören.
Regeln: gut lesbar (Text auf Hintergrund Kontrast mind. 4.5, Knopf-Schrift auf Akzent mind. 3), kein @import, url() nur mit data:, keine Web-Schriften laden. Der Stil soll den Wunsch klar treffen und trotzdem ruhig und übersichtlich bleiben.
${LAYOUT_ANLEITUNG()}
Nutze ein Layout nur, wenn der Wunsch eine andere Anordnung/Bedienung verlangt (z. B. „Seitenleiste", „Cockpit", „alles auf einen Blick", „große Kacheln"); für reine Farb-/Stilwünsche reicht CSS.
Antworte NUR mit dem CSS (inkl. optionalem hw-layout-Kommentar am Ende) in einem \`\`\`css Block.`;

export const VORBILDER_SYSTEM = `Bevor für „Hello World" eine App gebaut oder erweitert wird, recherchierst du Vorbilder. Schau dir 3–5 ähnliche Apps und Tools an – gern auch bekannte kostenpflichtige Marktführer, beliebte kostenlose Web-Tools und Open-Source-Projekte: Wie sind sie aufgebaut (Bildschirm-Aufteilung, Navigation, Reihenfolge der Schritte, wo liegen Werkzeuge/Einstellungen), welche Funktionen erwarten Nutzer, was machen sie besonders klug und intuitiv, was nervt an ihnen? Wenn du im Internet suchen kannst, tu es.
Ergebnis: eine kompakte Bau-Notiz auf Deutsch (höchstens 25 Zeilen, Stichpunkte):
- Vorbilder: Name – was sie gut machen (1 Zeile je Vorbild)
- Aufbau-Empfehlung für Handy und Desktop – als Vollbild-App OHNE Scrollen (was wohin, welche Reiter/Leisten)
- Funktionen: Muss / Kann (passend zum Wunsch, nicht überladen)
- Details, die begeistern, und typische Fehler, die wir vermeiden
Nur inspirieren lassen: keine Texte, Logos, Markennamen in der App oder geschützten Designs übernehmen.`;
