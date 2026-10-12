// KI-Aufrufe auf dem Server: „Claude auf diesem PC" (claude -p) oder Claude mit
// eigenem API-Schlüssel des Nutzers (wird nur für die Dauer des Auftrags im
// Speicher gehalten, nie auf die Platte geschrieben).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import Anthropic from '@anthropic-ai/sdk';
import { freiFragen } from './freiki.js';

export const CLAUDE = '/usr/bin/claude';

export function claudeFragen(system, frage, schema = null, zeitlimit = 900e3) {
  const arbeitsordner = path.join(os.homedir(), '.hello-world-ki');
  fs.mkdirSync(arbeitsordner, { recursive: true });
  const args = ['-p', '--system-prompt', system, '--tools', '', '--strict-mcp-config', '--setting-sources', '', '--no-session-persistence', '--output-format', 'json'];
  if (schema) args.push('--json-schema', JSON.stringify(schema)); // erzwingt gültiges JSON
  return new Promise((resolve, reject) => {
    const kind = spawn(CLAUDE, args, { cwd: arbeitsordner });
    let aus = '';
    const uhr = setTimeout(() => { kind.kill(); reject(new Error('Zeitüberschreitung der KI')); }, zeitlimit);
    kind.stdout.on('data', (d) => (aus += d));
    kind.on('error', (e) => { clearTimeout(uhr); reject(e); });
    kind.on('close', () => {
      clearTimeout(uhr);
      try {
        const r = JSON.parse(aus);
        if (r.is_error) return reject(new Error(String(r.result || 'Claude-Fehler').slice(0, 300)));
        resolve(r.structured_output ? JSON.stringify(r.structured_output) : String(r.result || ''));
      } catch { reject(new Error('Claude hat nicht geantwortet')); }
    });
    kind.stdin.end(frage);
  });
}

// ki = { art: 'lokal' }, { art: 'anthropic', schluessel, modell } oder { art: 'frei', schluessel: { gemini, groq, … } }
export async function kiFragen(ki, system, frage, schema = null) {
  if (!ki || ki.art === 'lokal') return claudeFragen(system, frage, schema);
  if (ki.art === 'frei') return freiFragen(ki.schluessel, system, frage, schema);
  const client = new Anthropic({ apiKey: ki.schluessel });
  const stream = client.messages.stream({
    model: ki.modell || 'claude-opus-5',
    max_tokens: 64000,
    system,
    messages: [{ role: 'user', content: frage }],
    ...(schema ? { output_config: { format: { type: 'json_schema', schema } } } : {}),
  });
  const antwort = await stream.finalMessage();
  if (antwort.stop_reason === 'refusal') throw new Error('Die KI hat die Anfrage abgelehnt.');
  return antwort.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
}

export async function kiJson(ki, system, frage, schema) {
  const text = await kiFragen(ki, system, frage, schema);
  const lesen = (t) => { const m = t.match(/\{[\s\S]*\}/); if (!m) throw new Error('Keine verwertbare Antwort der KI'); return JSON.parse(m[0]); };
  try { return lesen(text); } catch {
    return lesen(await kiFragen(ki, 'Du reparierst kaputtes JSON. Gib NUR das korrigierte, gültige JSON zurück, ohne Erklärung.', text));
  }
}

export function htmlAus(text) {
  const block = text.match(/```html\s*([\s\S]*?)```/i);
  const html = (block ? block[1] : text).trim();
  const start = html.search(/<!doctype html|<html/i);
  return start >= 0 ? html.slice(start) : html;
}
