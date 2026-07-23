/* =========================================================================
   symbols.js – Geraete-Piktogramme fuer Design- & Professional-Mode
   -------------------------------------------------------------------------
   Design Mode        -> realistischere, gefuellte Piktogramme
   Professional Mode  -> genormte, reduzierte Schematik-Symbole
   Jede Funktion liefert ein <g>-Innenmarkup, das mittig in einem
   ~ 84x40 Geraetekoerper platziert wird (Ursprung 0,0 = Mitte des Koerpers).
   ========================================================================= */

const Symbols = (() => {

  // Realistische Icons (Design Mode)
  const design = {
    router: `
      <rect x="-22" y="-9" width="44" height="16" rx="3" fill="#334155"/>
      <circle cx="-14" cy="-1" r="1.6" fill="#22c55e"/>
      <circle cx="-9"  cy="-1" r="1.6" fill="#22c55e"/>
      <circle cx="-4"  cy="-1" r="1.6" fill="#f59e0b"/>
      <line x1="-8" y1="-9" x2="-14" y2="-20" stroke="#334155" stroke-width="1.6"/>
      <line x1="8"  y1="-9" x2="14"  y2="-20" stroke="#334155" stroke-width="1.6"/>
      <circle cx="-14" cy="-21" r="1.8" fill="#334155"/>
      <circle cx="14"  cy="-21" r="1.8" fill="#334155"/>`,
    switch: `
      <rect x="-24" y="-8" width="48" height="14" rx="2" fill="#1e40af"/>
      <rect x="-20" y="-3" width="4" height="4" rx="1" fill="#93c5fd"/>
      <rect x="-13" y="-3" width="4" height="4" rx="1" fill="#93c5fd"/>
      <rect x="-6"  y="-3" width="4" height="4" rx="1" fill="#93c5fd"/>
      <rect x="1"   y="-3" width="4" height="4" rx="1" fill="#93c5fd"/>
      <rect x="8"   y="-3" width="4" height="4" rx="1" fill="#93c5fd"/>
      <rect x="15"  y="-3" width="4" height="4" rx="1" fill="#93c5fd"/>`,
    ap: `
      <rect x="-12" y="-2" width="24" height="10" rx="5" fill="#0f766e"/>
      <path d="M-16 -6 A 22 22 0 0 1 16 -6" fill="none" stroke="#14b8a6" stroke-width="1.6"/>
      <path d="M-10 -2 A 14 14 0 0 1 10 -2" fill="none" stroke="#2dd4bf" stroke-width="1.6"/>`,
    pc: `
      <rect x="-16" y="-12" width="32" height="20" rx="2" fill="#475569"/>
      <rect x="-13" y="-9" width="26" height="14" rx="1" fill="#93c5fd"/>
      <rect x="-5" y="8" width="10" height="3" fill="#475569"/>`,
    nas: `
      <rect x="-12" y="-13" width="24" height="26" rx="2" fill="#334155"/>
      <rect x="-8" y="-9" width="16" height="4" rx="1" fill="#64748b"/>
      <rect x="-8" y="-3" width="16" height="4" rx="1" fill="#64748b"/>
      <rect x="-8" y="3"  width="16" height="4" rx="1" fill="#64748b"/>
      <circle cx="9" cy="10" r="1.4" fill="#22c55e"/>`,
    host: `<rect x="-12" y="-10" width="24" height="20" rx="3" fill="#64748b"/>`,
    mesh: `
      <circle cx="0" cy="0" r="9" fill="#0f766e"/>
      <circle cx="-14" cy="-8" r="3.5" fill="#2dd4bf"/>
      <circle cx="14" cy="-8" r="3.5" fill="#2dd4bf"/>
      <circle cx="0" cy="13" r="3.5" fill="#2dd4bf"/>
      <path d="M0 0 L-14 -8 M0 0 L14 -8 M0 0 L0 13" stroke="#14b8a6" stroke-width="1.2"/>`,
    sbc: `
      <rect x="-15" y="-11" width="30" height="22" rx="2" fill="#16a34a"/>
      <rect x="-11" y="-7" width="9" height="9" rx="1" fill="#065f46"/>
      <g fill="#bbf7d0"><rect x="-13" y="-11" width="1.4" height="3"/><rect x="-10" y="-11" width="1.4" height="3"/><rect x="-7" y="-11" width="1.4" height="3"/><rect x="-4" y="-11" width="1.4" height="3"/></g>
      <rect x="3" y="-6" width="10" height="5" rx="1" fill="#065f46"/>`,
    server: `
      <rect x="-13" y="-13" width="26" height="26" rx="2" fill="#334155"/>
      <rect x="-9" y="-9" width="18" height="4" rx="1" fill="#64748b"/><circle cx="6" cy="-7" r="1.1" fill="#22c55e"/>
      <rect x="-9" y="-3" width="18" height="4" rx="1" fill="#64748b"/><circle cx="6" cy="-1" r="1.1" fill="#22c55e"/>
      <rect x="-9" y="3" width="18" height="4" rx="1" fill="#64748b"/><circle cx="6" cy="5" r="1.1" fill="#f59e0b"/>`,
    iot: `
      <rect x="-11" y="-11" width="22" height="22" rx="6" fill="#7c3aed"/>
      <circle cx="0" cy="1" r="3" fill="#ede9fe"/>
      <path d="M-6 -3 A 8 8 0 0 1 6 -3" fill="none" stroke="#ede9fe" stroke-width="1.4"/>
      <path d="M-9 -6 A 13 13 0 0 1 9 -6" fill="none" stroke="#c4b5fd" stroke-width="1.4"/>`,
  };

  // Genormte Schematik-Symbole (Professional Mode) – einfarbig, reduziert.
  const professional = {
    router: `
      <circle cx="0" cy="0" r="16" fill="none" stroke="currentColor" stroke-width="1.6"/>
      <path d="M-8 4 L8 -4 M8 -4 L3 -4 M8 -4 L8 1" stroke="currentColor" stroke-width="1.4" fill="none"/>
      <path d="M8 4 L-8 -4 M-8 -4 L-3 -4 M-8 -4 L-8 1" stroke="currentColor" stroke-width="1.4" fill="none"/>`,
    switch: `
      <circle cx="0" cy="0" r="16" fill="none" stroke="currentColor" stroke-width="1.6"/>
      <path d="M-9 5 L9 5 M-9 5 L-4 2 M-9 5 L-4 8" stroke="currentColor" stroke-width="1.3" fill="none"/>
      <path d="M9 -5 L-9 -5 M9 -5 L4 -8 M9 -5 L4 -2" stroke="currentColor" stroke-width="1.3" fill="none"/>
      <path d="M-9 0 L9 0 M9 0 L4 -3 M9 0 L4 3" stroke="currentColor" stroke-width="1.3" fill="none"/>`,
    ap: `
      <circle cx="0" cy="6" r="4" fill="none" stroke="currentColor" stroke-width="1.6"/>
      <path d="M-12 -4 A 16 16 0 0 1 12 -4" fill="none" stroke="currentColor" stroke-width="1.4"/>
      <path d="M-7 0 A 9 9 0 0 1 7 0" fill="none" stroke="currentColor" stroke-width="1.4"/>`,
    pc: `
      <rect x="-13" y="-11" width="26" height="18" rx="1" fill="none" stroke="currentColor" stroke-width="1.6"/>
      <path d="M-5 7 L5 7 M-7 11 L7 11" stroke="currentColor" stroke-width="1.4"/>`,
    nas: `
      <rect x="-11" y="-13" width="22" height="26" rx="1" fill="none" stroke="currentColor" stroke-width="1.6"/>
      <circle cx="0" cy="-5" r="4" fill="none" stroke="currentColor" stroke-width="1.3"/>
      <line x1="-7" y1="6" x2="7" y2="6" stroke="currentColor" stroke-width="1.3"/>`,
    host: `
      <rect x="-11" y="-9" width="22" height="18" rx="1" fill="none" stroke="currentColor" stroke-width="1.6"/>`,
    mesh: `
      <circle cx="0" cy="0" r="6" fill="none" stroke="currentColor" stroke-width="1.6"/>
      <circle cx="-13" cy="-9" r="3" fill="none" stroke="currentColor" stroke-width="1.3"/>
      <circle cx="13" cy="-9" r="3" fill="none" stroke="currentColor" stroke-width="1.3"/>
      <circle cx="0" cy="13" r="3" fill="none" stroke="currentColor" stroke-width="1.3"/>
      <path d="M-5 -3 L-11 -7 M5 -3 L11 -7 M0 6 L0 10" stroke="currentColor" stroke-width="1.2"/>`,
    sbc: `
      <rect x="-14" y="-10" width="28" height="20" rx="1" fill="none" stroke="currentColor" stroke-width="1.6"/>
      <rect x="-10" y="-6" width="8" height="8" fill="none" stroke="currentColor" stroke-width="1.2"/>
      <path d="M2 -4 L11 -4 M2 0 L11 0 M2 4 L8 4" stroke="currentColor" stroke-width="1.1"/>`,
    server: `
      <rect x="-12" y="-13" width="24" height="26" rx="1" fill="none" stroke="currentColor" stroke-width="1.6"/>
      <path d="M-8 -8 L8 -8 M-8 -2 L8 -2 M-8 4 L8 4" stroke="currentColor" stroke-width="1.2"/>`,
    iot: `
      <circle cx="0" cy="2" r="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <path d="M-7 -3 A 9 9 0 0 1 7 -3" fill="none" stroke="currentColor" stroke-width="1.3"/>
      <path d="M-11 -7 A 14 14 0 0 1 11 -7" fill="none" stroke="currentColor" stroke-width="1.3"/>`,
  };

  return {
    render(icon, mode) {
      const set = mode === 'professional' ? professional : design;
      return set[icon] || set.host;
    },
  };
})();
