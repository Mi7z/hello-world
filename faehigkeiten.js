// Die feste Liste der Fähigkeiten des Hello-World-Helfers.
// Apps können NUR diese Fähigkeiten anfragen (und nur die, die in ihrem Steckbrief
// unter "faehigkeiten" stehen). Jede Anfrage braucht die Erlaubnis des Nutzers.
// Neue Fähigkeiten kommen nur nach strenger Prüfung dazu (siehe AGENTS.md).

const minuten = { typ: 'zahl', min: 0, max: 1440, standard: 0, text: 'in Minuten (0 = sofort)' };

export const FAEHIGKEITEN = {
  'system.herunterfahren': {
    titel: 'Computer herunterfahren',
    frage: (p, g) => `deinen Computer „${g}" ${p.minuten ? `in ${p.minuten} Minuten` : 'sofort'} herunterfahren`,
    gefaehrlich: true,
    parameter: { minuten },
  },
  'system.neustarten': {
    titel: 'Computer neu starten',
    frage: (p, g) => `deinen Computer „${g}" ${p.minuten ? `in ${p.minuten} Minuten` : 'sofort'} neu starten`,
    gefaehrlich: true,
    parameter: { minuten },
  },
  'system.ruhezustand': {
    titel: 'Computer in den Ruhezustand',
    frage: (p, g) => `deinen Computer „${g}" ${p.minuten ? `in ${p.minuten} Minuten` : 'sofort'} in den Ruhezustand schicken`,
    gefaehrlich: true,
    parameter: { minuten },
  },
  'system.abbrechen': {
    titel: 'Geplantes Herunterfahren/Neustarten abbrechen',
    frage: (p, g) => `geplantes Herunterfahren/Neustarten/Ruhezustand auf „${g}" abbrechen`,
    gefaehrlich: false,
    parameter: {},
  },
  'system.status': {
    titel: 'Status abfragen',
    frage: (p, g) => `sehen, ob auf „${g}" etwas geplant ist (Name, Betriebssystem, geplante Aktion)`,
    gefaehrlich: false,
    parameter: {},
  },
  'benachrichtigung.zeigen': {
    titel: 'Benachrichtigung anzeigen',
    frage: (p, g) => `auf „${g}" eine Benachrichtigung anzeigen: „${p.titel}"`,
    gefaehrlich: false,
    parameter: {
      titel: { typ: 'text', max: 80, standard: 'Hello World' },
      text: { typ: 'text', max: 300, standard: '' },
    },
  },
};

// Prüft und bereinigt Parameter – alles andere wird verworfen
export function parameterPruefen(name, eingabe = {}) {
  const f = FAEHIGKEITEN[name];
  if (!f) throw new Error(`Unbekannte Fähigkeit: ${name}`);
  const sauber = {};
  for (const [k, def] of Object.entries(f.parameter)) {
    const w = eingabe[k] ?? def.standard;
    if (def.typ === 'zahl') {
      const z = Number(w);
      if (!Number.isFinite(z) || z < def.min || z > def.max) throw new Error(`${k} muss zwischen ${def.min} und ${def.max} liegen`);
      sauber[k] = Math.round(z);
    } else {
      sauber[k] = String(w ?? '').replace(/[\u0000-\u001f]/g, ' ').slice(0, def.max);
    }
  }
  return sauber;
}

// Für die KI-Anweisungen und die Regeln: lesbare Liste
export function faehigkeitenText() {
  return Object.entries(FAEHIGKEITEN).map(([n, f]) => `- ${n}: ${f.titel}${Object.keys(f.parameter).length ? ` – Parameter: ${Object.entries(f.parameter).map(([k, d]) => `${k} (${d.typ === 'zahl' ? `Zahl ${d.min}–${d.max}` : `Text bis ${d.max} Zeichen`})`).join(', ')}` : ''}`).join('\n');
}
