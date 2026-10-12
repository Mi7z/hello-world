# Wetter-Bot für Telegram

Ein Telegram-Bot, der dir **jeden Morgen zur eingestellten Zeit (Standard 7 Uhr)
das Wetter für deine Stadt** schickt. Du kannst deine Stadt und die Uhrzeit pro
Chat einstellen und das Wetter jederzeit sofort abrufen.

Die Wetterdaten kommen von [Open-Meteo](https://open-meteo.com) – kostenlos und
ohne Anmeldung oder Schlüssel. Der einzige geheime Wert ist der Bot-Token von
Telegram; er wird nur über eine Umgebungsvariable gelesen und nie gespeichert.

## Befehle im Chat

- `/stadt <Ort>` – deine Stadt einstellen, z. B. `/stadt München`
- `/zeit HH:MM` – Uhrzeit der täglichen Nachricht, z. B. `/zeit 07:00`
- `/jetzt` – Wetter sofort anzeigen
- `/stop` – tägliche Nachrichten abbestellen
- `/hilfe` – Übersicht aller Befehle

## Selbst betreiben

Hello World betreibt keine Server. Wer diesen Bot nutzen will, betreibt ihn
selbst – das geht kostenlos auf dem eigenen Rechner.

1. **Was du brauchst:** [Node.js](https://nodejs.org) Version 20 oder neuer und
   einen Telegram-Account.
2. **Bot anlegen:** In Telegram den [@BotFather](https://t.me/BotFather) öffnen,
   `/newbot` schreiben, Namen vergeben und den **Token** kopieren, den du
   zurückbekommst.
3. **Herunterladen:** diesen Ordner (`apps/weatherbot/`) auf deinen Rechner
   kopieren.
4. **Einstellen:** Datei `.env.beispiel` nach `.env` kopieren und den Token
   eintragen (der Token bleibt geheim und wird nie veröffentlicht):

   ```bash
   cp .env.beispiel .env
   # .env öffnen und bei TELEGRAM_BOT_TOKEN den Token vom BotFather eintragen
   ```

   Optional in der `.env`:
   - `SENDE_ZEIT` – andere Standard-Uhrzeit (Format `HH:MM`, lokale Zeit)
   - `STANDARD_STADT` – Stadt, die neuen Chats beim `/start` voreingestellt wird

5. **Starten:**

   ```bash
   npm install && npm start
   ```

   (Der Bot braucht keine zusätzlichen Pakete; `npm install` ist nur der
   übliche Schritt.) Schreibe deinem Bot in Telegram `/start`, dann
   `/stadt Berlin` und teste mit `/jetzt`.

6. **Dauerbetrieb:** Damit die Morgen-Nachricht kommt, muss der Bot laufen.
   Lass das Programm durchlaufen (z. B. mit `pm2`, `systemd` oder in einem
   `screen`/`tmux`-Fenster).
7. **Aktualisieren:** neue Version des Ordners holen, dann wieder `npm start`.

## Hinweise

- Die Abos (welcher Chat welche Stadt und Uhrzeit hat) werden lokal in
  `abos.json` gespeichert. Diese Datei und die `.env` gehören nicht ins
  Repository (siehe `.gitignore`).
- Die tägliche Nachricht richtet sich nach der **lokalen Uhrzeit des Rechners**,
  auf dem der Bot läuft.

## Kosten

Kostenlos auf dem eigenen Rechner. Auf einem kleinen VPS (rund 5 €/Monat) läuft
der Bot ebenfalls problemlos. Der Wetterdienst Open-Meteo ist für die private
Nutzung kostenlos. Die Kosten trägt, wer den Bot betreibt.
