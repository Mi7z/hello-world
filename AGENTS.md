# Regeln für KIs (und Menschen) in Hello World

Hello World ist eine offene **Datenbank für alles, was Menschen und KIs
brauchen**: Apps mit Oberfläche, Server-Apps, Skills für KIs und
MCP-Werkzeuge. Katalog und Quellcode liegen in diesem Repository. Jede:r arbeitet mit der **eigenen KI** direkt hier im Repo –
neue Apps anlegen, vorhandene weiterentwickeln, ähnliche zusammenlegen. Diese
Datei ist verbindlich. Lies sie vollständig, bevor du etwas änderst.

## Das Ziel: wenige, starke Apps

Ähnliches gehört zusammen. Alle Datei-Umwandlungen gehören in
`app.fileconverter`, alle Text-Werkzeuge in `app.textkit` usw. Bevor du etwas
anlegst, entscheide genau eins:

1. **vorhanden**: Eine App kann das schon (siehe `funktionen` in ihrer
   `hello.json`). Dann änderst du nichts und nennst dem Menschen die App.
2. **erweitern**: Eine thematisch passende App gibt es, ihr fehlt nur die
   Funktion. Dann baust du sie **dort** ein. Das ist der bevorzugte Weg.
3. **neu**: Das Thema passt wirklich in keine bestehende App. Dann legst du
   eine neue App an.
4. **ablehnen**: Der Wunsch ist nicht sinnvoll oder nicht harmlos (siehe
   unten). Dann wird nichts gebaut, und du erklärst kurz, warum.

## Erst auf GitHub schauen

Bevor du etwas neu programmierst, such auf GitHub nach einer vorhandenen
Open-Source-Lösung (Werkzeug `github_suchen` der Hello-World-Schnittstelle oder
die GitHub-Suche). Gibt es eine gute, gepflegte Lösung mit **freier Lizenz**,
baue darauf auf, statt alles neu zu schreiben:

- **Erlaubte Lizenzen:** MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC, 0BSD,
  Unlicense, CC0-1.0, Zlib, MPL-2.0, LGPL-2.1, LGPL-3.0. Ohne Lizenz oder mit
  GPL/AGPL: nicht übernehmen.
- **Browser-Apps** binden die Bibliothek über jsDelivr ein, mit fester Version
  (`https://cdn.jsdelivr.net/npm/<paket>@<version>` oder
  `https://cdn.jsdelivr.net/gh/<user>/<repo>@<tag>/<datei>`).
- **Skills und MCP-Werkzeuge** dürfen übernommen werden. Behalte die
  Lizenzdatei bei und nenne die Quelle in README.md bzw. SKILL.md.
- **Immer die Quelle angeben:** In `hello.json` unter
  `"quellen": [{ "repo": "user/repo", "lizenz": "MIT", "autor": "user" }]`
  und sichtbar in der App mit Link auf `https://github.com/user/repo`.

## Was nie gebaut wird

Schadsoftware, Phishing oder Fake-Login-Seiten, heimliches Datensammeln oder
Tracking, Umgehen von Kopierschutz oder Bezahlschranken, Spam-Werkzeuge,
Belästigung, Betrug, Glücksspiel, Inhalte für Erwachsene, Hass, Waffen oder
Drogen, Identitätsfälschung, Prüfungsbetrug. Ebenso nichts Unsinniges,
Unfertiges oder reine Platzhalter: Alles, was eine App anzeigt, muss
funktionieren.

## Aufbau einer App

Jeder Eintrag ist ein Ordner `apps/<name>/`. Der Name ist **englisch**: ein
Wort bzw. zusammengeschrieben, nur kleine Buchstaben und Ziffern, 3 bis 24
Zeichen (z. B. `paintboard`, `fileconverter`). Angezeigt und verlinkt wird er
immer als **`typ.name`**: `app.paintboard`, `server.weatherbot`,
`skill.plainlanguage`, `mcp.<name>`, `design.terminal`. Adresse: `/a/app.paintboard`.

`apps/<slug>/hello.json` ist der Steckbrief und Pflicht:

```json
{
  "titel": "Fileconverter",
  "beschreibung": "Ein bis zwei Sätze, was die App kann (10–300 Zeichen).",
  "kategorie": "konverter",
  "funktionen": ["PDF in PNG-Bilder umwandeln", "Bilder zwischen JPG, PNG und WebP umwandeln"],
  "tags": ["pdf", "png", "bild", "umwandeln"],
  "typ": "browser",
  "version": 1,
  "aliase": []
}
```

- `kategorie`: ein Wort, z. B. konverter, text, bild, generator, rechner, bot, werkzeug
- `typ`: `browser` (App im Browser), `server` (Server-App), `skill` (Skill für KIs), `mcp` (Werkzeug für KIs) oder `design` (Aussehen für Hello World und alle Apps)
- `symbol`: ein Emoji als Erkennungszeichen (z. B. 🎨). Wird sonst automatisch erzeugt.
- `funktionen`: vollständige Liste. Beim Erweitern hängst du die neue Funktion an und entfernst nie eine.
- `version`: wird beim Erweitern um 1 erhöht.
- `beispiele` und `stichworte`: viele Wünsche in unterschiedlichem Wortlaut und Synonyme (auch Englisch), damit der Eintrag gefunden wird. Hello World erzeugt sie automatisch, du darfst sie ergänzen.
- `aliase`: alte Kurznamen, wenn Apps zusammengelegt wurden. Alte Links leiten dann weiter.

### Browser-Apps (`"typ": "browser"`)

Diese Apps laufen direkt im Katalog, abgeschottet in einer Sandbox.

- Genau eine Datei `index.html` mit `<title>`, `<meta name="viewport">` und `lang`.
- Die App läuft im **Vollbild, ohne Scrollen** – wie eine echte App, auch auf dem Handy: `<body class="app">` mit `.app-kopf`, `.app-inhalt` (füllt den Rest) und `.app-fuss`. Viel Inhalt → Reiter (`.reiter`), Schritte oder ein Bereich, der in sich scrollt (`.scroll`). Die ganze Seite scrollt nur, wenn es wirklich nicht anders geht.
- Oben in der Mitte liegt ein kleiner, verschiebbarer Pfeil von Hello World (öffnet die Leiste mit Ort, offenen Apps und Aktionen wie Verbessern bzw. bei Vorschauen Verwerfen/Übernehmen) – keine wichtigen Bedienelemente direkt mittig an die Oberkante.
- Kein Netzwerk: kein `fetch` oder XMLHttpRequest zu fremden Adressen, kein
  WebSocket, keine Formulare nach außen, keine iframes, kein `window.open`,
  kein `eval` oder `new Function`, keine Cookies, kein Standort und keine Kamera.
- Bibliotheken nur von `https://cdn.jsdelivr.net/npm/<paket>@<feste.version>/…`.
- Nutze das Grund-Design aus `vorlage/basis.css` (als `<style>` einbetten). **Keine eigenen Farben, Schriften oder Rundungen** und kein eigener `:root`-Block: verwende immer die Design-Bausteine (`var(--bg)`, `var(--fl)`, `var(--tx)`, `var(--ak)` … siehe „Designs"). So passt sich jede App automatisch dem Design an, das der Nutzer gewählt hat.
- **Handy und Desktop:** Jede App funktioniert und sieht gut aus auf dem Smartphone (360–430 px, einspaltig, Bedienflächen mindestens 44 px) UND auf dem Desktop (ab 900 px, Breite sinnvoll nutzen, z. B. Klasse `spalten`: Eingabe links, Ergebnis rechts). Nichts ragt seitlich über den Rand. Teste beide Größen.
- **Gestaltung:** intuitiv, übersichtlich und logisch. Das Wichtigste zuerst und groß, klare Überschriften, ein Hauptknopf pro Bereich (Nebenaktionen mit `class="zweit"`), verständliche Beschriftungen statt Fachbegriffen. Emojis sparsam.
- Verständliche Fehlermeldungen.
- Die Apps laufen mit dieser Sicherheitsregel (CSP): siehe `APP_CSP` in `pruefung.js`.

### Gestaltung (Standard für jede App)

Solange der Nutzer nicht ausdrücklich etwas anderes verlangt, wird jede App
**intuitiv, logisch und übersichtlich** gebaut – nach denselben Grundsätzen wie Hello World:

1. **Wo bin ich?** Klarer Titel, Reiter bzw. Schritt-Anzeige, aktiver Bereich markiert.
2. **Wie komme ich raus?** Überall ein sichtbarer Weg zurück; Unumkehrbares nur mit Bestätigung oder Rückgängig.
3. **Was ist der Stand?** Sofortige Rückmeldung zu jeder Aktion: lädt, ✓ fertig, verständlicher Fehler.
4. **Wohin geht es?** Ein deutlicher Hauptknopf je Bildschirm, Nebenaktionen schlichter, Gleiches am gleichen Ort.
5. **Logischer Aufbau:** oben Eingabe → Mitte Arbeitsfläche/Ergebnis → unten die Hauptaktion (Daumenbereich).
6. **Für Laien:** Alltagssprache, beschriftete Felder, sinnvolle Vorgaben, freundlicher leerer Zustand.
7. **Ruhig:** wenige Elemente gleichzeitig, große Ziele (≥ 44 px), Farben/Schriften nur aus den Design-Bausteinen.
8. **Für alle bedienbar:** Finger, Maus, Tastatur (Enter = Hauptaktion, sichtbarer Fokus).

### Server-Apps (`"typ": "server"`)

Server-Apps sind erlaubt. Hello World betreibt aber **keine** Server: Wer eine
Server-App nutzen will, betreibt sie selbst und zahlt den Server selbst.

- `README.md` mit einem Abschnitt `## Selbst betreiben`: Schritt für Schritt
  (was man braucht, Installation, Konfiguration, Start, Update).
- In `hello.json` ein Objekt `server`:
  ```json
  "server": {
    "start": "npm install && npm start",
    "kosten": "läuft auf kleinem VPS (~5 €/Monat) oder kostenlos auf dem eigenen Rechner",
    "betreiber_url": "https://… (optional: öffentliche Instanz eines Betreibers)"
  }
  ```
- **Keine Geheimnisse im Repo:** Schlüssel, Passwörter und Tokens kommen nur
  über Umgebungsvariablen. Eine `.env.beispiel` mit leeren Platzhaltern ist
  erlaubt, eine echte `.env` nie.
- Keine Binärdateien, kein `node_modules`, keine Dateien über 2 MB.
- Gleiche ethische Regeln wie oben. Besonders: Personenbezogene Daten nur,
  wenn unbedingt nötig, und nie heimlich.
- Vorlage: `vorlage/server-app/`.

### Skills (`"typ": "skill"`)

Ein Skill ist eine Anleitung bzw. Fähigkeit für KIs wie Claude oder Codex.
KIs finden ihn über die Hello-World-Schnittstelle und befolgen ihn.

- `SKILL.md` mit Kopf:
  ```markdown
  ---
  name: <slug>
  description: WANN die KI den Skill nutzen soll, mit typischen Formulierungen des Nutzers
  ---
  ```
  Darunter konkrete, überprüfbare Schritte. `name` ist gleich dem Ordnernamen.
- Weitere Dateien (Referenzen, Beispiele, kleine Skripte als Text) sind erlaubt,
  auf sie wird aus der SKILL.md verwiesen. Keine Geheimnisse, keine Binärdateien.
- Skills dürfen die KI nie zu schädlichem Verhalten anleiten, z. B. zum Umgehen
  von Sicherheitsregeln, heimlichen Aktionen oder Datenabfluss.

### MCP-Werkzeuge (`"typ": "mcp"`)

Ein MCP-Werkzeug ist ein Hintergrundprogramm, das KIs als Werkzeug benutzen.
Es läuft auf dem Rechner des Nutzers, Hello World betreibt es nicht.

- Code im Ordner, `README.md` mit Abschnitt `## Einrichten`: wie man es in
  Claude Code und in Codex einträgt.
- In `hello.json`:
  ```json
  "mcp": { "command": "node", "args": ["server.js"], "env": { "API_SCHLUESSEL": "" } }
  ```
  Bei `env` nur die Namen mit leerem Wert angeben, die Werte setzt der Nutzer selbst.
- Keine Geheimnisse, keine Binärdateien, kein `node_modules`. Das Werkzeug tut nur, was
  seine Beschreibung sagt, nichts Verstecktes.

## Designs: das Aussehen von Hello World und allen Apps

Ein Design (`"typ": "design"`) ist ein Eintrag wie eine App: Ordner `apps/<name>/`
mit `hello.json` und **`design.css`**. Der Nutzer wählt es unter „Mehr → Aussehen"
oder im helloworld-Menü jeder App; es gilt dann für Hello World und alle Apps.
Standard ist `design.terminal`, dazu z. B. `design.klar` (hell/dunkel automatisch).

Pflicht in `design.css`: ein Block `:root:root { … }` mit **allen** Bausteinen:
`--bg` Hintergrund · `--fl` Fläche/Karte · `--fl2` zweite Fläche (Eingabefelder) ·
`--li` / `--li2` Linien · `--tx` / `--tx2` / `--tx3` Text (Haupt/Neben/leise) ·
`--ak` Akzent (Hauptknöpfe, Links) · `--ak2` dezente Akzentfläche · `--ak-tx` Schrift auf Akzent ·
`--rot` / `--gelb` / `--gruen` Fehler/Warnung/Erfolg · `--r` / `--r-klein` Rundungen ·
`--schrift` / `--schrift-titel` / `--mono` Schriften (nur System-Schriften) · `--schatten`.
Optional ein zweiter Block in `@media (prefers-color-scheme: dark)` und wenige
„Eigenarten" (rein optisch) für `.hw-titel`, `.hw-abschnitt`, `.hw-karte`, `body > h1`, `.karte`, `button`.

Nicht erlaubt: `@import`, `url()` außer `data:`, Web-Schriften laden, Layout umbauen
oder etwas ausblenden. Die Prüfung achtet auch auf **Lesbarkeit** (Kontrast: Text
mind. 4,5, Knopf-Schrift auf Akzent mind. 3). Designs haben einen Stammbaum wie
Apps (Versionen als `versionen/vN.css`). Vorschau: `/muster?design=<name>`.

## Welche KI baut?

Jeder bringt seine eigene KI mit: ein **KI-Programm auf dem eigenen Rechner**
(Claude Code, OpenAI Codex oder Gemini CLI – ohne Schlüssel, über das eigene Abo;
das Hello-World-Programm erkennt sie selbst, siehe `KI_PROGRAMME` in `ki.js`), ein eigener
API-Schlüssel – oder **kostenlose KIs** (`freiki.js`): Gratis-Konten bei Google
Gemini, OpenRouter (Gratis-Router), Groq, Cerebras und Mistral. Hello World
probiert sie der Reihe nach und wechselt automatisch, wenn ein Anbieter am
Limit ist. Schlüssel bleiben beim Nutzer und werden nie gespeichert.

## Werkzeuge für KIs (spart Tokens)

Browser-Apps bieten ihre Hauptfunktionen zusätzlich **ohne Oberfläche** an. Eine KI
ruft sie über den Connector mit `werkzeug_ausfuehren` auf (Dateien als Pfade) –
Hello World öffnet die App unsichtbar auf dem eigenen Rechner, führt die Funktion aus
und speichert die Ergebnisdateien. Die KI muss Dateien weder lesen noch selbst umrechnen.

```html
<script type="application/json" id="hw-werkzeuge">
{ "werkzeuge": { "pdf_zu_png": { "beschreibung": "Wandelt jede PDF-Seite in ein PNG um.", "dateien": "eine",
  "eingabe": { "type": "object", "properties": { "schaerfe": { "type": "number" } } }, "ausgabe": "Ein PNG pro Seite" } } }
</script>
<script>
if (window.helloworld && helloworld.werkzeug) helloworld.werkzeug('pdf_zu_png', async (eingabe, dateien) => {
  // derselbe Code wie in der Oberfläche, aber ohne sie anzufassen
  return { seiten: 2, dateien: [new File([blob], 'seite-1.png', { type: 'image/png' })] };
});
</script>
```

Regeln: 1–15 Werkzeuge, Namen aus kleinen Buchstaben/Ziffern/`_`, klare Beschreibung
(was es tut, wann man es nutzt), `dateien` = `keine`/`eine`/`mehrere`, Eingabe als
JSON-Schema. Rückgabe: Daten und/oder Dateien (Blob/File mit Namen). Beispiel: `app.fileconverter`.

## Apps mit eigener KI des Nutzers

Browser-Apps dürfen die **eigene KI des Nutzers** nutzen – z. B. um freie Sätze
einzuordnen, Texte zusammenzufassen oder Tipps zu geben. Die App legt dafür in
der `index.html` **fest**, welche Aufgaben die KI bekommt, und das genaue
Antwort-Format:

```html
<script type="application/json" id="hw-ki">
{ "zweck": "Ordnet Einkäufe nach Abteilungen",
  "aufgaben": {
    "sortieren": {
      "anweisung": "Teile den Einkaufszettel in einzelne Artikel und ordne jeden einer Abteilung zu …",
      "schema": { "type": "object", "properties": { "artikel": { "type": "array", "items": { "type": "object", "properties": { "name": { "type": "string" }, "abteilung": { "type": "string" } } } } } }
    } } }
</script>
```

Mit Bildern (Skizze, Foto, Dokument): `await helloworld.ki('skizze_lesen', { hinweis }, { bilder: [dataUrl] })` –
bis zu 4 Bilder; die KI des Nutzers (Claude Code, Codex, Gemini, eigener Schlüssel, Gratis-KI) sieht sie.

Aufruf: `const antwort = await helloworld.ki('sortieren', { text })` – liefert ein
Objekt genau im Schema-Format; die App pflegt es selbst ein (die KI liefert nur
Daten, nie HTML). Hello World fragt den Nutzer einmal pro App um Erlaubnis und
rechnet mit **seiner** KI (Claude auf seinem PC oder eigener Schlüssel). Die App
sieht nie einen Schlüssel und kann Anweisung und Format zur Laufzeit nicht ändern.
Regeln: 1–10 Aufgaben, Namen aus kleinen Buchstaben/Ziffern/`_`, Anweisung
20–6000 Zeichen, Schema mit `"type": "object"`. Es kann bis zu einer Minute dauern –
„Deine KI denkt nach …" anzeigen. Fehler (abgelehnt, keine KI verbunden) freundlich zeigen.

### Designs mit eigenem Layout

Ein Design darf die Startseite **komplett neu anordnen** – Bausteine verschieben,
weglassen, eigene Panels, Leisten und Knöpfe ergänzen. Dafür steht am Ende von
`design.css` eine Vorlage zwischen `/* hw-layout` und `hw-layout */`:

- `<hw-baustein name="suche"></hw-baustein>` setzt einen festen Baustein (mit voller Funktion).
- `<button data-hw-aktion="chat">Chat</button>` – Knöpfe lösen nur Aktionen aus der festen Liste aus.
- `<hw-wert name="anzahl-apps"></hw-wert>` zeigt Live-Werte.
- `<section data-hw-ansicht="mehr">` ist ein Bereich (Navigation wechselt zwischen ihnen).

Die vollständige Liste aller Bausteine, Aktionen und Werte steht in `bausteine.js`
(auch unter `/api/design/bausteine`). Kein JavaScript, kein `style`-Attribut, keine
Formulare/iframes/svg, keine fremden Adressen – die Prüfung achtet darauf. Beispiel: `design.cockpit`.

## Pitches: Hello World selbst weiterentwickeln

Änderungen an Hello World selbst (Oberfläche, Chat, Bauablauf, Programm) werden als
**Pitch** vorgeschlagen: ein GitHub-Issue mit der Markierung `pitch` und einem Plan
(„Worum geht's", „Was ändert sich", „Umfang und Risiken"). Abgestimmt wird mit 👍
(dafür) und 👎 (dagegen). **Entschieden ist ein Pitch ab 10 Stimmen; angenommen bei
mindestens 80 % dafür.** Angenommene Pitches baut der Rechner des Repository-Besitzers
**automatisch** (`pitchbau.js`): eigene Arbeitskopie, Claude Code setzt den Plan um, dann
Sicherungen – geschützte Dateien unverändert (Sicherheit, Konten, Kopplung, Abstimmung,
Helfer, Prüfungen, Workflows, Pakete), Syntax, Hello-World-Prüfung, Probestart und eine
zweite KI-Prüfung auf Gefahren und Plantreue. Alles grün → automatisch übernommen und
als neue Version veröffentlicht; sonst bleibt alles, wie es ist, und am Pitch steht der Grund.

## Hello-World-Helfer: Apps, die den Computer steuern

Browser-Apps können über den Hello-World-Helfer (kleines Programm auf dem
Computer des Nutzers, `helfer/`) Computer-Funktionen nutzen – **nur** aus der
festen Liste in `faehigkeiten.js` (z. B. `system.herunterfahren`,
`benachrichtigung.zeigen`) und nur mit Erlaubnis des Nutzers bei jedem Aufruf.

- In `hello.json` alle genutzten Fähigkeiten eintragen: `"faehigkeiten": ["system.herunterfahren"]`.
  Andere Aufrufe werden abgelehnt.
- Aufruf in der App (der Baustein wird automatisch eingesetzt):
  `const r = await helloworld.faehigkeit('system.herunterfahren', { minuten: 30 });`
  Fehler immer abfangen (abgelehnt, kein Helfer gekoppelt). In der Vorschau kommt `{ probe: true }`.
- **Neue Fähigkeiten** (Änderungen an `faehigkeiten.js` oder `helfer/`) werden besonders streng geprüft:
  nur feste Befehle ohne Nutzereingaben im Befehl, nichts Verstecktes, ein klarer Erlaubnis-Text,
  bei Eingriffen in den ganzen Computer `gefaehrlich: true`. Kein beliebiges Ausführen von Befehlen oder Dateien.

## Stammbaum: weiterentwickeln heißt verzweigen

Browser-Apps haben einen Stammbaum (`apps/<name>/stammbaum.json`). Die erste
Version ist die Wurzel, jede Weiterentwicklung ist ein **neuer Zweig**:
überschrieben wird nichts. Zweig-Enden sind **Distributionen**, die bewertet
werden. Die bestbewertete liegt zusätzlich als `index.html`.

- Neue Version: `apps/<name>/versionen/v<n>.html` anlegen (nächste freie
  Nummer) und in `stammbaum.json` eintragen:
  `{ "id": "v5", "eltern": "v2", "autor": { "login": "<dein-github-name>", "name": "…" }, "zeit": "<ISO-Datum>", "aenderung": "Was ist neu (ein Satz)" }`
- `eltern` ist die Version, auf der du aufbaust (nicht unbedingt die neueste).
- `autor.login` ist dein GitHub-Name. Er muss zum Pull Request passen.
- Bestehende Versionen nie ändern oder löschen.

## Erweitern – Pflichten

- **Alle bisherigen Funktionen bleiben vollständig erhalten.** Nichts entfernen, nichts verschlechtern.
- Neue Funktionen fügen sich im selben Stil ein, z. B. als weiterer Reiter.
- Bei Browser-Apps entsteht dabei eine neue Version im Stammbaum (siehe oben).
- `funktionen` ergänzen, `version` erhöhen, ggf. `titel` und `beschreibung` verbreitern.

## Vor jedem Pull Request

```bash
node werkzeuge/pruefen.js            # alle Apps
node werkzeuge/pruefen.js --app <slug>
```

Die Prüfung muss ohne Fehler durchlaufen. Sie läuft auf GitHub bei jedem Pull
Request automatisch erneut. Sie prüft unter anderem Steckbrief, Sicherheit,
Geheimnisse, Dateigrößen und ob eine neue App einer vorhandenen zu ähnlich ist.
Ist sie das, gehört die Funktion in die vorhandene App.

Teste die App selbst: Öffne sie lokal mit `node server.js`
(http://localhost:8810) und probiere jede Funktion aus, auch die alten.

Pull Request: Ein kurzer Titel und eine kurze Beschreibung, was neu ist und
warum es in diese App gehört (bzw. warum eine neue App nötig ist).
