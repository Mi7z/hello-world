# Hello World für Android

Die Android-App zeigt dieselbe Oberfläche wie die Web-App (ohne Server):
stöbern, suchen, Apps benutzen – auch ohne Internet. Neues bauen geht im
Hello-World-Programm am PC.

Gebaut wird automatisch auf GitHub (`.github/workflows/android.yml`) bei jedem
Versions-Tag. Das Android-Projekt wird dabei jedes Mal frisch erzeugt.
Die App-Unterschrift liegt als GitHub-Secret (`ANDROID_KEYSTORE`, `ANDROID_KEYSTORE_PASSWORT`).
