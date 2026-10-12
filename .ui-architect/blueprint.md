# UI-Blueprint: Hello World (Neukonzeption, 12.10.2026)

## 1 Brief
- Subjekt: App-Wolke – Werkzeug finden, im Vollbild nutzen, per KI bauen/verbessern.
- Nutzer: Laien, vor allem Android-Handy, einhändig, nebenbei; auch Desktop.
- Kernaufgaben: (1) Wunsch → App öffnen oder bauen, (2) App benutzen + verbessern, (3) Status sehen, Vorschau übernehmen/verwerfen.
- Leitsatz: Jederzeit sichtbar: WO bin ich · WIE komme ich raus · WAS läuft gerade · WOHIN geht es.

## 2 Recherche (übernommen)
- Bottom-Navigation mit 3–5 Zielen, aktuelles Ziel benannt (Material/HIG).
- Kontext-Aktionsleiste: Leiste wird bei Vorschau zu Aktionen (Verwerfen/Übernehmen), bis entschieden.
- Dauerhafter Status-Chip für Hintergrund-Aufgaben (Leerlauf neutral, arbeitet = Spinner + Anzahl, Antippen = Details).

## 3 Informationsarchitektur
Ebene 1 – Hello World (Bottom-Nav, Handy) / Kopf-Nav (Desktop): Start · Meine Apps · Aufträge · Mehr
  - Start: Suche (→ Chat), Vorschläge, „Weitermachen" (offene Apps), „Läuft gerade", Katalog
  - Meine Apps: offene + zuletzt benutzte Apps (= Tabs)
  - Aufträge: alle Bauten mit Meldungen, Zeitleiste, „Vorschau im Vollbild"
  - Mehr: Pitches, Aussehen, Deine KI, Vom Handy aus nutzen, Geräte, Installieren, Konto, Regeln
Ebene 2 – App im Vollbild (auch Vorschauen). Oben ein kleiner Pfeil.
  - Pfeil → Aktionsleiste (oben): Ort + Zurück, Status, offene Apps, Aktionen
  - Vorschau: Leiste zeigt Verwerfen · Übernehmen/Veröffentlichen · Nachbessern
Ebene 3 – Chat-Fenster (aus „Verbessern"/„Chat"), Handy Vollbild, Desktop Seitenleiste
Android-Zurück: schließt immer die oberste Ebene (Chat → Leiste → App → Start).
Verworfen: 5. Bottom-Nav-Punkt „Pitches" (selten genutzt → Mehr); Seitenleiste am Handy (Daumen, Platz).

## 4 Tokens
Aus dem gewählten Design (Terminal Standard). Z-Leiter: App 0 · Kopf/Nav 100 · Pfeil 350 · Aktionsleiste 380 · Chat 400 · Dialoge (top layer) · Hinweise 500.

## 5 Screens (Handy)
Start, Meine Apps, Aufträge, Mehr, App + Pfeil, App + Aktionsleiste, Vorschau + Aktionsleiste, Chat.

## 7 Konflikte (Entwurfszeit)
- Pfeil oben vs. App-Kopfzeilen: Pfeil klein (44×24), mittig, halbtransparent; verschiebbar entlang der Oberkante.
- Status-Chip nur EINER pro Ebene (Kopf bzw. Aktionsleiste), Badge am Pfeil als Punkt.
- Vorschau-Hinweis als schmaler Streifen im Pfeil/der Leiste – nie Inhalt überdecken.
