#!/bin/sh
# Baut das Programm: kopiert Hello World nach desktop/hw und packt es mit electron-builder.
set -e
cd "$(dirname "$0")"
rm -rf hw && mkdir hw
for x in server.js ki.js bauauftrag.js anweisungen.js testlauf.js pruefung.js github.js stammbaum.js anmeldung.js geraete.js faehigkeiten.js beschreibung.js appki.js freiki.js zugang.js werkzeuge.js gespraech.js bausteine.js pitches.js package.json package-lock.json AGENTS.md INSTALLIEREN.md public vorlage apps helfer; do
  cp -r "../$x" hw/
done
(cd hw && npm ci --omit=dev --no-audit --no-fund)
npx electron-builder "$@"   # ohne Angabe: für das aktuelle Betriebssystem
