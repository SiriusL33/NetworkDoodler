/* =========================================================================
   groups.js – Gruppen- & Highlight-Panel
   -------------------------------------------------------------------------
   Geräte & Kabel zu Gruppen zusammenfassen und einzeln highlighten
   (blendet den Rest ab). Hilft bei komplexen Netzen mit Überschneidungen.
   ========================================================================= */

const Groups = (() => {
  const el = UI.el;
  let host;

  function mount(container) {
    host = container;
    Bus.on('state', render);
    Bus.on('selection', render);
    Bus.on('highlight', render);
    render();
  }

  function render() {
    if (!host) return;
    host.innerHTML = '';
    const p = State.project; if (!p) return;
    const sel = Canvas.selectedIds;

    // Kopf: aus Auswahl gruppieren
    const head = el('div.p-3.border-b.border-slate-200.dark\\:border-slate-700');
    head.appendChild(el('button', {
      class: `w-full px-3 py-2 rounded-lg text-sm font-medium ${sel.length ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-slate-100 dark:bg-slate-700 text-slate-400 cursor-not-allowed'}`,
      text: sel.length ? `＋ Gruppe aus Auswahl (${sel.length})` : 'Nichts ausgewählt',
      disabled: !sel.length, onclick: () => sel.length && createDialog(sel),
    }));
    head.appendChild(el('div.text-\\[11px\\].text-slate-400.mt-2.leading-snug', { text: 'Auswahl: Werkzeug „Gruppieren" oder Shift-Klick auf Geräte/Kabel. Highlight blendet alle anderen Elemente ab.' }));
    host.appendChild(head);

    // Gruppenliste
    if (!p.groups.length) {
      host.appendChild(el('div.p-4.text-sm.text-slate-400.italic', { text: 'Noch keine Gruppen. Wähle Elemente aus und erstelle eine Gruppe.' }));
      return;
    }
    const list = el('div.p-2.space-y-2');
    p.groups.forEach((g) => {
      const members = State.groupMembers(g.id);
      const active = Canvas.highlightGroupId === g.id;
      const card = el('div', { class: `rounded-lg border p-2 ${active ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' : 'border-slate-200 dark:border-slate-700'}` });
      card.appendChild(el('div.flex.items-center.gap-2', {}, [
        el('span.w-4.h-4.rounded-full.shrink-0', { style: `background:${g.color}` }),
        el('div.flex-1.min-w-0', {}, [ el('div.text-sm.font-medium.truncate', { text: g.name }), el('div.text-xs.text-slate-400', { text: `${members.length} Element(e)` }) ]),
        el('button', { class: `px-2 py-1 rounded text-xs font-medium ${active ? 'bg-indigo-600 text-white' : 'bg-slate-200 dark:bg-slate-600'}`, text: active ? 'Highlight AUS' : 'Highlight', onclick: () => Canvas.setHighlight(g.id) }),
      ]));
      const actions = el('div.flex.gap-1.mt-2');
      actions.append(
        el('button.text-xs.px-2.py-1.rounded.bg-slate-100.dark\\:bg-slate-700', { text: 'Auswahl +', title: 'Aktuelle Auswahl hinzufügen', onclick: () => { if (sel.length) { State.assignToGroup(sel, g.id); UI.toast('Zur Gruppe hinzugefügt.', 'ok'); } else UI.toast('Nichts ausgewählt.', 'warn'); } }),
        el('button.text-xs.px-2.py-1.rounded.bg-slate-100.dark\\:bg-slate-700', { text: 'Bearbeiten', onclick: () => editDialog(g) }),
        el('button.text-xs.px-2.py-1.rounded.bg-slate-100.dark\\:bg-slate-700', { text: 'Auswählen', onclick: () => Canvas.setSelection(members) }),
        el('button.text-xs.px-2.py-1.rounded.bg-red-100.text-red-700.dark\\:bg-red-900\\/40.dark\\:text-red-300', { text: 'Auflösen', onclick: () => { State.dissolveGroup(g.id); if (Canvas.highlightGroupId === g.id) Canvas.setHighlight(g.id); } }),
      );
      card.appendChild(actions);
      list.appendChild(card);
    });
    host.appendChild(list);
  }

  function createDialog(memberIds) {
    const draft = { name: 'Gruppe ' + (State.project.groups.length + 1), color: NETWORK_COLORS[(State.project.groups.length) % NETWORK_COLORS.length].hex };
    formDialog('Neue Gruppe', draft, () => { State.createGroup(memberIds, draft.name, draft.color); UI.toast('Gruppe erstellt.', 'ok'); });
  }
  function editDialog(g) {
    const draft = { name: g.name, color: g.color };
    formDialog('Gruppe bearbeiten', draft, () => State.updateGroup(g.id, draft));
  }
  function formDialog(title, draft, onSave) {
    UI.modal({
      title,
      body: (n) => {
        n.appendChild(el('label.block.text-xs.font-medium.mb-1', { text: 'Name' }));
        n.appendChild(el('input', { value: draft.name, class: 'w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm mb-3', oninput: (e) => draft.name = e.target.value }));
        n.appendChild(el('label.block.text-xs.font-medium.mb-1', { text: 'Farbe' }));
        const cr = el('div.flex.flex-wrap.gap-2');
        NETWORK_COLORS.forEach((c) => cr.appendChild(el('button', { class: 'w-7 h-7 rounded-full border-2', style: `background:${c.hex};border-color:${draft.color === c.hex ? '#6366f1' : 'transparent'}`, title: c.name, onclick: () => { draft.color = c.hex; [...cr.children].forEach((b) => b.style.borderColor = 'transparent'); } })));
        n.appendChild(cr);
      },
      actions: [{ label: 'Abbrechen' }, { label: 'Speichern', primary: true, onClick: () => { if (!draft.name.trim()) { UI.toast('Name fehlt.', 'warn'); return false; } onSave(); } }],
    });
  }

  return { mount };
})();
