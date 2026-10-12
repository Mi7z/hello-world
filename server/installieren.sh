#!/bin/sh
# Hello World auf einem eigenen Server oder PC ohne Bildschirm installieren
# (Linux, z. B. Raspberry Pi, Heimserver, gemieteter Server).
# Bedienen dann vom Handy aus – im WLAN oder unterwegs über Tailscale.
#
#   curl -fsSL https://raw.githubusercontent.com/Mi7z/hello-world/main/server/installieren.sh | sh
set -e
ORDNER="${HW_ORDNER:-$HOME/hello-world}"
PORT="${PORT:-8810}"

command -v node >/dev/null 2>&1 || { echo "Bitte zuerst Node.js 20 oder neuer installieren: https://nodejs.org"; exit 1; }
[ "$(node -p 'process.versions.node.split(".")[0]')" -ge 20 ] || { echo "Node.js ist zu alt – bitte Version 20 oder neuer."; exit 1; }
command -v git >/dev/null 2>&1 || { echo "Bitte zuerst git installieren."; exit 1; }

if [ -d "$ORDNER/.git" ]; then
  echo "Hello World aktualisieren …"; git -C "$ORDNER" pull --ff-only -q
else
  echo "Hello World herunterladen …"; git clone -q --depth 1 https://github.com/Mi7z/hello-world.git "$ORDNER"
fi
cd "$ORDNER" && npm ci --omit=dev --no-audit --no-fund --silent

# Handy-Zugang einschalten (nur gekoppelte Geräte kommen hinein)
mkdir -p "$ORDNER/daten"
[ -f "$ORDNER/daten/zugang.json" ] || echo '{"offen":true,"geraete":{}}' > "$ORDNER/daten/zugang.json"

# Als Dienst einrichten, der beim Start des Rechners mitläuft
mkdir -p "$HOME/.config/systemd/user"
cat > "$HOME/.config/systemd/user/hello-world.service" <<DIENST
[Unit]
Description=Hello World
After=network-online.target

[Service]
WorkingDirectory=$ORDNER
Environment=PORT=$PORT
Environment=HW_ZUGANG=1
Environment=PATH=$HOME/.local/bin:$HOME/.npm-global/bin:/usr/local/bin:/usr/bin:/bin
ExecStart=$(command -v node) --experimental-websocket server.js
Restart=on-failure

[Install]
WantedBy=default.target
DIENST
systemctl --user daemon-reload
systemctl --user enable --now hello-world >/dev/null 2>&1 || systemctl --user restart hello-world
loginctl enable-linger "$USER" >/dev/null 2>&1 || true
sleep 3

echo ""
echo "✅ Hello World läuft."
journalctl --user -u hello-world -n 20 --no-pager 2>/dev/null | grep "Handy koppeln" | tail -1 | sed 's/.*Handy koppeln/👉 Handy koppeln/'
echo ""
echo "Neuen Kopplungscode später:  systemctl --user restart hello-world  und dann"
echo "                             journalctl --user -u hello-world | grep 'Handy koppeln' | tail -1"
echo ""
echo "KI ohne Schlüssel: Claude Code, OpenAI Codex oder Gemini CLI hier auf dem Server installieren"
echo "und einmal anmelden (z. B. 'claude' starten) – Hello World findet sie dann selbst."
echo "Für unterwegs: Tailscale auf Server und Handy installieren (https://tailscale.com/download)."
