/* =========================================================================
   icons.js – Kompaktes Line-Icon-Set (24×24) für Toolbar & Menüs
   Icons.get(name, size) -> <svg>-Markup (stroke = currentColor).
   ========================================================================= */

const Icons = (() => {
  const P = {
    cursor: '<path d="M5 3l6 16 2.5-6L20 11 5 3z"/>',
    wire: '<path d="M4 6h4a3 3 0 0 1 3 3v6a3 3 0 0 0 3 3h6"/><circle cx="4" cy="6" r="1.6"/><circle cx="20" cy="18" r="1.6"/>',
    flag: '<path d="M6 21V4h11l-2 3 2 3H6"/>',
    group: '<rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/><path d="M13 6h5M6 13v5" stroke-dasharray="2 2"/>',
    highlight: '<circle cx="12" cy="12" r="3.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/>',
    rotate: '<path d="M20 11a8 8 0 1 0-2.3 5.3"/><path d="M20 5v5h-5"/>',
    duplicate: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M4 16V4h12"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
    palette: '<path d="M12 3a9 9 0 1 0 0 18c1.5 0 2-1 2-2s-.7-1.5 0-2.5 2 0 3 0a3 3 0 0 0 3-3c0-4.5-3.8-7.5-8-7.5z"/><circle cx="7.5" cy="11" r="1"/><circle cx="12" cy="7.5" r="1"/><circle cx="16" cy="11" r="1"/>',
    fit: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
    download: '<path d="M12 3v12M7 10l5 5 5-5M4 20h16"/>',
    database: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
    design: '<path d="M4 20l4-1 10-10-3-3L5 16l-1 4z"/><path d="M13.5 6.5l3 3"/>',
    pro: '<circle cx="6" cy="12" r="2"/><circle cx="18" cy="6" r="2"/><circle cx="18" cy="18" r="2"/><path d="M8 12h4M16.5 7l-4.5 4M16.5 17l-4.5-5"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5"/>',
    moon: '<path d="M20 14a8 8 0 1 1-9-11 6.5 6.5 0 0 0 9 11z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    file: '<path d="M13 3H6v18h12V8l-5-5z"/><path d="M13 3v5h5"/>',
    folder: '<path d="M3 7h6l2 2h10v10H3V7z"/>',
    exit: '<path d="M14 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 8l-4 4 4 4M6 12h9"/>',
    save: '<path d="M5 3h11l3 3v15H5z"/><path d="M8 3v5h7V3M8 21v-6h8v6"/>',
    grid: '<path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>',
  };
  function get(name, size = 20) {
    const inner = P[name] || P.cursor;
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
  }
  return { get };
})();
