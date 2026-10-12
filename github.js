// GitHub nach vorhandenen Open-Source-Lösungen durchsuchen (öffentliche API, ohne Konto).
// Nur Projekte mit freien, unkomplizierten Lizenzen kommen für Hello World in Frage.

export const ERLAUBTE_LIZENZEN = ['MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC', '0BSD', 'Unlicense', 'CC0-1.0', 'Zlib', 'MPL-2.0', 'LGPL-2.1', 'LGPL-3.0'];

const zwischenspeicher = new Map();
async function holen(url, alsText = false) {
  const alt = zwischenspeicher.get(url);
  if (alt && Date.now() - alt.zeit < 15 * 60e3) return alt.daten;
  const istGithub = url.startsWith('https://api.github.com/');
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Hello-World/1.0', Accept: !istGithub ? 'application/json' : alsText ? 'application/vnd.github.raw' : 'application/vnd.github+json' },
    signal: AbortSignal.timeout(15000),
  });
  if (istGithub && (res.status === 403 || res.status === 429)) throw new Error('GitHub-Suchlimit erreicht – bitte in einer Minute nochmal');
  if (!res.ok) throw new Error(`${istGithub ? 'GitHub' : 'npm'} antwortet mit ${res.status}`);
  const daten = alsText ? await res.text() : await res.json();
  zwischenspeicher.set(url, { zeit: Date.now(), daten });
  return daten;
}

// SPDX-Ausdrücke wie „(MIT OR GPL-3.0)": erlaubt, wenn eine Alternative erlaubt ist
export function lizenzErlaubt(spdx) {
  if (!spdx) return false;
  return String(spdx).replace(/[()]/g, '').split(/\s+OR\s+/i).some((t) => ERLAUBTE_LIZENZEN.includes(t.trim()));
}

// Mehrere Suchläufe (JavaScript, TypeScript, allgemein), zusammengeführt und nach Sternen sortiert
export async function githubSuchen(anfrage) {
  const laeufe = [`${anfrage} language:JavaScript`, `${anfrage} language:TypeScript`, anfrage];
  const alle = new Map();
  for (const lauf of laeufe) {
    const q = encodeURIComponent(`${lauf} in:name,description archived:false`);
    try {
      const r = await holen(`https://api.github.com/search/repositories?q=${q}&sort=stars&order=desc&per_page=10`);
      for (const x of r.items || []) alle.set(x.full_name, x);
    } catch (err) { if (!alle.size && lauf === laeufe.at(-1)) throw err; }
  }
  const r = { items: [...alle.values()].sort((a, b) => b.stargazers_count - a.stargazers_count) };
  // Linksammlungen („awesome lists") sind keine Werkzeuge
  const keineListe = (x) => !/(^|[-_])awesome|public-apis|free-for-dev|list$/i.test(x.name) && !/curated list|awesome list|collection of/i.test(x.description || '');
  return (r.items || []).filter(keineListe).map((x) => ({
    repo: x.full_name,
    url: x.html_url,
    beschreibung: (x.description || '').slice(0, 200),
    sterne: x.stargazers_count,
    lizenz: x.license?.spdx_id || null,
    lizenz_ok: lizenzErlaubt(x.license?.spdx_id),
    sprache: x.language,
    aktualisiert: x.pushed_at,
    themen: (x.topics || []).slice(0, 8),
    autor: x.owner?.login,
  }));
}

// README (gekürzt) und – falls vorhanden – npm-Paketname/Version für den Einbau über jsDelivr
export async function githubDetails(repo) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new Error('Ungültiger Repository-Name');
  const [readme, paket] = await Promise.all([
    holen(`https://api.github.com/repos/${repo}/readme`, true).catch(() => ''),
    holen(`https://api.github.com/repos/${repo}/contents/package.json`, true).then((t) => JSON.parse(t)).catch(() => null),
  ]);
  return {
    repo,
    readme: String(readme).slice(0, 8000),
    npm: paket?.name && !paket.private ? { name: paket.name, version: paket.version || null } : null,
  };
}

// Lizenz und GitHub-Projekt eines npm-Pakets (für Bibliotheken, die eine App über jsDelivr nutzt)
export async function npmInfo(paket) {
  if (!/^(@[\w.-]+\/)?[\w.-]+$/.test(paket)) throw new Error('Ungültiger Paketname');
  const r = await holen(`https://registry.npmjs.org/${paket.replace('/', '%2F')}/latest`);
  const repoUrl = typeof r.repository === 'string' ? r.repository : r.repository?.url || '';
  const m = repoUrl.match(/github\.com[/:]([\w.-]+\/[\w.-]+?)(\.git)?(#.*)?$/);
  const lizenz = typeof r.license === 'string' ? r.license : r.license?.type || null;
  return { paket, version: r.version, lizenz, lizenz_ok: lizenzErlaubt(lizenz), repo: m ? m[1] : null, autor: m ? m[1].split('/')[0] : null };
}
