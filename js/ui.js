/* =========================================================================
   ui.js – Gemeinsame UI-Helfer: DOM-Builder, Modals, Toasts, Escaping
   ========================================================================= */

const UI = (() => {

  /* Kompakter DOM-Builder.
     el('div.card', { onclick }, [ child, 'text' ])
     -----------------------------------------------------------------------
     Klassen werden an Punkten getrennt. Tailwind-Klassen enthalten selbst
     Sonderzeichen (":", "/", "."), daher gilt:
       - Getrennt wird nur an NICHT-escapten Punkten.
       - "\." bleibt ein Punkt in der Klasse (z. B. py-1\.5  -> py-1.5).
       - Sonstige Escape-Backslashes (\:  \/) werden entfernt
         (dark\:bg-slate-800 -> dark:bg-slate-800).                          */
  function el(spec, attrs = {}, children = []) {
    const tokens = spec.split(/(?<!\\)\./);           // nur unescapte Punkte trennen
    const tag = tokens.shift();
    const node = document.createElement(tag || 'div');
    const cls = tokens.map((t) => t.replace(/\\(.)/g, '$1')); // \x -> x
    if (cls.length) node.className = cls.join(' ');
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') node.className += ' ' + v;
      else if (k === 'html') node.innerHTML = v;
      else if (k === 'text') node.textContent = v;
      else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
      else if (k === 'dataset') Object.assign(node.dataset, v);
      else if (k in node && k !== 'list' && k !== 'style') { try { node[k] = v; } catch { node.setAttribute(k, v); } }
      else node.setAttribute(k, v);
    }
    (Array.isArray(children) ? children : [children]).forEach((c) => {
      if (c == null || c === false) return;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return node;
  }

  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }

  /* ------------------------------------------------------------- Modal
     UI.modal({ title, body(node), actions:[{label, primary, danger, onClick}] })
     onClick erhaelt eine close()-Funktion; gibt onClick false zurueck,
     bleibt das Modal offen.                                              */
  function modal({ title, body, actions = [], wide = false, onClose }) {
    const backdrop = el('div.nd-modal-backdrop');
    const panel = el('div', {
      class: `bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full ${wide ? 'max-w-3xl' : 'max-w-md'} max-h-[88vh] flex flex-col`,
    });
    function close() { backdrop.remove(); document.removeEventListener('keydown', onKey); onClose && onClose(); }
    function onKey(e) { if (e.key === 'Escape') close(); }

    const head = el('div.px-5.py-4.border-b.border-slate-200.dark\\:border-slate-700.flex.items-center.justify-between', {}, [
      el('h3.text-lg.font-semibold', { text: title }),
      el('button.text-slate-400.hover\\:text-slate-600.text-xl.leading-none', { text: '✕', onclick: close, title: 'Schließen' }),
    ]);
    const content = el('div.px-5.py-4.overflow-y-auto.nd-scroll.flex-1');
    if (typeof body === 'function') body(content, close);
    else if (body) content.appendChild(body);

    const foot = el('div.px-5.py-3.border-t.border-slate-200.dark\\:border-slate-700.flex.justify-end.gap-2');
    actions.forEach((a) => {
      const base = 'px-4 py-2 rounded-lg text-sm font-medium transition';
      const style = a.danger
        ? 'bg-red-600 hover:bg-red-700 text-white'
        : a.primary
          ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
          : 'bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600';
      foot.appendChild(el('button', {
        class: `${base} ${style}`, text: a.label,
        onclick: () => { if (a.onClick?.(close) !== false && !a.keepOpen) close(); },
      }));
    });

    panel.append(head, content);
    if (actions.length) panel.appendChild(foot);
    backdrop.appendChild(panel);
    backdrop.addEventListener('mousedown', (e) => { if (e.target === backdrop) close(); });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(backdrop);
    return { close, content };
  }

  /* ------------------------------------------------------------- Toast */
  function toast(msg, type = 'info') {
    const colors = {
      info: 'bg-slate-800 text-white',
      ok: 'bg-emerald-600 text-white',
      warn: 'bg-amber-500 text-white',
      error: 'bg-red-600 text-white',
    };
    const t = el('div', {
      class: `fixed bottom-5 left-1/2 -translate-x-1/2 z-[60] px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium ${colors[type] || colors.info}`,
      text: msg,
    });
    document.body.appendChild(t);
    t.animate([{ opacity: 0, transform: 'translate(-50%, 10px)' }, { opacity: 1, transform: 'translate(-50%, 0)' }], { duration: 140 });
    setTimeout(() => {
      t.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 250 }).onfinish = () => t.remove();
    }, 2600);
  }

  return { el, escapeHtml, modal, toast };
})();
