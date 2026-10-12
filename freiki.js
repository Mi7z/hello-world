// Kostenlose KIs: Hello World reiht die Gratis-Angebote seriöser Anbieter aneinander.
// Der Nutzer legt dort kostenlose Konten an und trägt die Schlüssel ein (bleiben in
// seinem Browser bzw. Programm und werden nur für den einzelnen Auftrag mitgeschickt).
// Ist ein Anbieter am Limit oder gestört, kommt automatisch der nächste dran.
// Alle sprechen dieselbe Schnittstelle (OpenAI-kompatibel: /chat/completions).

export const ANBIETER = [
  { id: 'gemini', name: 'Google Gemini', url: 'https://generativelanguage.googleapis.com/v1beta/openai', konto: 'https://aistudio.google.com/apikey', bevorzugt: [/gemini-.*pro/, /gemini-.*flash(?!-lite)/, /gemini/] },
  { id: 'openrouter', name: 'OpenRouter (Gratis-Modelle)', url: 'https://openrouter.ai/api/v1', konto: 'https://openrouter.ai/keys', festesModell: 'openrouter/free' },
  { id: 'groq', name: 'Groq', url: 'https://api.groq.com/openai/v1', konto: 'https://console.groq.com/keys', bevorzugt: [/gpt-oss-120b/, /qwen.*coder/, /llama-3\.3-70b/, /70b/] },
  { id: 'cerebras', name: 'Cerebras', url: 'https://api.cerebras.ai/v1', konto: 'https://cloud.cerebras.ai', bevorzugt: [/gpt-oss-120b/, /qwen.*coder/, /qwen-3/, /llama/] },
  { id: 'mistral', name: 'Mistral', url: 'https://api.mistral.ai/v1', konto: 'https://console.mistral.ai/api-keys', bevorzugt: [/codestral-latest/, /devstral/, /mistral-medium-latest/, /mistral-small-latest/] },
];

const basis = (a) => process.env.HW_FREI_TEST_URL || a.url; // nur für automatische Tests
const pause = new Map(); // Anbieter am Limit: bis wann überspringen (pro Schlüssel)
const modelle = new Map(); // gewähltes Modell je Anbieter+Schlüssel

async function modellVon(a, schluessel) {
  if (a.festesModell) return a.festesModell;
  const merk = a.id + schluessel.slice(-6);
  if (modelle.has(merk)) return modelle.get(merk);
  const res = await fetch(`${basis(a)}/models`, { headers: { Authorization: `Bearer ${schluessel}` }, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw Object.assign(new Error(`${a.name}: Schlüssel ungültig oder Dienst gestört (${res.status})`), { status: res.status });
  const ids = ((await res.json()).data || []).map((m) => String(m.id).replace(/^models\//, ''));
  const wahl = a.bevorzugt.map((m) => ids.find((id) => m.test(id))).find(Boolean) || ids[0];
  if (!wahl) throw new Error(`${a.name}: keine Modelle verfügbar`);
  modelle.set(merk, wahl);
  return wahl;
}

async function einmal(a, schluessel, system, frage, schema) {
  const modell = await modellVon(a, schluessel);
  const sys = schema
    ? `${system}\n\nAntworte AUSSCHLIESSLICH mit gültigem JSON (ohne Erklärung, ohne Markdown) genau nach diesem JSON-Schema:\n${JSON.stringify(schema)}`
    : system;
  const res = await fetch(`${basis(a)}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${schluessel}`, 'Content-Type': 'application/json', 'HTTP-Referer': 'https://github.com/Mi7z/hello-world', 'X-Title': 'Hello World' },
    body: JSON.stringify({ model: modell, messages: [{ role: 'system', content: sys }, { role: 'user', content: frage }], temperature: 0.4, max_tokens: 32000 }),
    signal: AbortSignal.timeout(6 * 60e3),
  });
  if (!res.ok) {
    const text = (await res.text().catch(() => '')).slice(0, 200);
    throw Object.assign(new Error(`${a.name}: ${res.status} ${text}`), { status: res.status });
  }
  const d = await res.json();
  const inhalt = d.choices?.[0]?.message?.content;
  if (!inhalt || !String(inhalt).trim()) throw new Error(`${a.name}: leere Antwort`);
  return { text: String(inhalt), anbieter: a.name, modell };
}

// schluessel = { gemini: '…', groq: '…', … } – nur eingetragene Anbieter werden benutzt
export async function freiFragen(schluessel, system, frage, schema = null) {
  const liste = ANBIETER.filter((a) => typeof schluessel?.[a.id] === 'string' && schluessel[a.id].trim());
  if (!liste.length) throw new Error('Keine kostenlose KI eingerichtet – trage unter „Deine KI" mindestens einen Gratis-Schlüssel ein.');
  const fehler = [];
  for (const a of liste) {
    const s = schluessel[a.id].trim();
    const merk = a.id + s.slice(-6);
    if ((pause.get(merk) || 0) > Date.now()) { fehler.push(`${a.name}: gerade am Limit`); continue; }
    try {
      const r = await einmal(a, s, system, frage, schema);
      console.log(`Kostenlose KI: ${r.anbieter} (${r.modell})`);
      return r.text;
    } catch (err) {
      fehler.push(err.message);
      // Limit erreicht → eine Weile überspringen; Schlüssel falsch → bis zum Neustart
      if (err.status === 429) pause.set(merk, Date.now() + 10 * 60e3);
      else if (err.status === 401 || err.status === 403) pause.set(merk, Date.now() + 24 * 3600e3);
      else pause.set(merk, Date.now() + 60e3);
    }
  }
  throw new Error(`Alle kostenlosen KIs sind gerade nicht verfügbar (meist Tageslimit). Später nochmal versuchen oder einen weiteren Gratis-Anbieter eintragen. Details: ${fehler.join(' | ').slice(0, 400)}`);
}
