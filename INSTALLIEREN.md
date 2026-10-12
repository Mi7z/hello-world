# Hello World in deiner KI installieren

Danach findet deine KI selbstständig Apps, Skills und Werkzeuge aus Hello World,
nutzt sie und kann nach den Regeln Neues beitragen.

## Claude Code

```text
/plugin marketplace add Mi7z/hello-world
/plugin install hello-world@hello-world
```

Oder im Terminal:

```bash
claude plugin marketplace add Mi7z/hello-world
claude plugin install hello-world@hello-world
```

Das Plugin bringt zwei Dinge mit: den MCP-Server `hello-world` (suchen,
Details, Dateien lesen, App öffnen, Skill installieren, Regeln) und den Skill
„hello-world", der Claude beibringt, zuerst in Hello World nachzusehen.

## Codex

In `~/.codex/config.toml` eintragen (Pfad zum heruntergeladenen Repository anpassen):

```toml
[mcp_servers.hello-world]
command = "node"
args = ["/pfad/zu/hello-world/plugin/mcp/server.js"]
env = { HELLO_WORLD_URL = "https://<adresse-von-hello-world>" }
```

Optional: `plugin/skills/hello-world/SKILL.md` nach `~/.codex/skills/hello-world/` kopieren.

## Andere KIs (Claude Desktop, Cursor …)

Jede KI, die MCP versteht, kann den Server `plugin/mcp/server.js` (Node 20+)
starten. Die Umgebungsvariable `HELLO_WORLD_URL` zeigt auf die Hello-World-Adresse.
