/* =========================================================================
   database.js – Asset- & Preset-Datenbank-Manager (persistente DB)
   ========================================================================= */

const Database = (() => {
  const el = UI.el;
  const ICONS = [['router', 'Router'], ['switch', 'Switch'], ['ap', 'Access Point'], ['mesh', 'Mesh'], ['pc', 'PC / Host'], ['nas', 'NAS'], ['server', 'Server'], ['sbc', 'Einplatinen-PC'], ['iot', 'Smart-Home / IoT'], ['host', 'Sonstiges']];

  function open(initialTab = 'assets') {
    let tab = initialTab;
    const m = UI.modal({
      title: 'Asset- & Preset-Datenbank', wide: true,
      body: (node) => rebuild(node),
      actions: [
        { label: 'Auf Auslieferungszustand zurücksetzen', keepOpen: true, onClick: () => { if (confirm('Alle eigenen Assets & Presets verwerfen und Defaults wiederherstellen?')) { DB.resetDefaults(); UI.toast('Datenbank zurückgesetzt.', 'ok'); } return false; } },
        { label: 'Fertig', primary: true },
      ],
    });
    Bus.on('db', () => { if (document.body.contains(m.content)) rebuild(m.content); });

    function rebuild(node) {
      node.innerHTML = '';
      const tabs = el('div.flex.gap-2.mb-4.border-b.border-slate-200.dark\\:border-slate-700');
      const mkTab = (k, l) => el('button', { class: `px-3 py-2 text-sm font-medium border-b-2 -mb-px ${tab === k ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500'}`, text: l, onclick: () => { tab = k; rebuild(node); } });
      tabs.append(mkTab('assets', 'Geräte-Assets'), mkTab('presets', 'Kabel-Presets'));
      node.appendChild(tabs);
      node.appendChild(tab === 'assets' ? assetsPanel() : presetsPanel());
    }

    /* -------------------------------------------------------- Assets */
    function assetsPanel() {
      const wrap = el('div');
      wrap.appendChild(el('button.mb-3.px-3.py-1\\.5.rounded-lg.bg-indigo-600.text-white.text-sm', { text: '+ Neues Asset', onclick: () => assetForm() }));
      ASSET_CATEGORIES.forEach((cat) => {
        const assets = DB.assetsByCategory(cat.id);
        if (!assets.length) return;
        wrap.appendChild(el('div.text-xs.font-semibold.text-slate-400.uppercase.tracking-wide.mt-3.mb-1', { text: cat.label }));
        const list = el('div.space-y-1');
        assets.forEach((a) => {
          const ps = a.ports.map((p) => `${p.count}×${p.label}/${speedLabel(p.speed)}`).join(', ');
          list.appendChild(el('div.flex.items-center.justify-between.gap-3.p-2\\.5.rounded-lg.bg-slate-100.dark\\:bg-slate-700\\/50', {}, [
            el('div.min-w-0', {}, [ el('div.font-medium.text-sm.truncate', { text: a.model }), el('div.text-xs.text-slate-500.truncate', { text: `${a.chipset || ''} · ${ps}${a.poeBudget ? ' · PoE ' + a.poeBudget + 'W' : ''}` }) ]),
            el('div.flex.gap-1.shrink-0', {}, [
              el('button.text-xs.px-2.py-1.rounded.bg-slate-200.dark\\:bg-slate-600', { text: 'Bearbeiten', onclick: () => assetForm(a) }),
              el('button.text-xs.px-2.py-1.rounded.bg-red-100.text-red-700.dark\\:bg-red-900\\/40.dark\\:text-red-300', { text: 'Löschen', onclick: () => { if (confirm(`Asset „${a.model}" löschen?`)) DB.removeAsset(a.id); } }),
            ]),
          ]));
        });
        wrap.appendChild(list);
      });
      return wrap;
    }

    function assetForm(asset) {
      const editing = !!asset;
      const draft = asset ? deepClone(asset) : { id: uid('asset'), model: '', chipset: '', category: 'switch', icon: 'switch', power: 0, poeBudget: 0, poeDraw: 0, ports: [{ label: 'P', type: 'rj45', speed: 1000, count: 8 }] };
      UI.modal({
        title: editing ? 'Asset bearbeiten' : 'Neues Asset',
        body: (n) => {
          n.appendChild(textRow('Modell', draft.model, (v) => draft.model = v));
          n.appendChild(textRow('Chipsatz / Beschreibung', draft.chipset, (v) => draft.chipset = v));
          n.appendChild(selectRow('Kategorie', ASSET_CATEGORIES.map((c) => [c.id, c.label]), draft.category, (v) => draft.category = v));
          n.appendChild(selectRow('Symbol', ICONS, draft.icon, (v) => draft.icon = v));
          const grid = el('div.grid.grid-cols-3.gap-2');
          grid.append(
            numRow('Ø Verbrauch (W)', draft.power, (v) => draft.power = v),
            numRow('PoE-Budget (W)', draft.poeBudget, (v) => draft.poeBudget = v),
            numRow('PoE-Bezug (W)', draft.poeDraw, (v) => draft.poeDraw = v),
          );
          n.appendChild(grid);

          n.appendChild(el('div.mt-3.mb-1.text-xs.font-semibold', { text: 'Port-Gruppen' }));
          const grpList = el('div.space-y-2'); n.appendChild(grpList);
          const renderGrps = () => { grpList.innerHTML = ''; draft.ports.forEach((g, i) => grpList.appendChild(portGroupRow(g, () => { draft.ports.splice(i, 1); renderGrps(); }))); };
          renderGrps();
          n.appendChild(el('button.mt-2.text-xs.text-indigo-600', { text: '+ Port-Gruppe', onclick: () => { draft.ports.push({ label: 'LAN', type: 'rj45', speed: 1000, count: 1 }); renderGrps(); } }));
        },
        actions: [{ label: 'Abbrechen' }, { label: 'Speichern', primary: true, onClick: () => {
          if (!draft.model.trim()) { UI.toast('Modellname fehlt.', 'warn'); return false; }
          draft.ports = draft.ports.filter((p) => p.count > 0);
          DB.upsertAsset(draft); UI.toast('Asset gespeichert.', 'ok');
        } }],
      });
    }

    function portGroupRow(g, onDelete) {
      const row = el('div.grid.grid-cols-12.gap-1.items-center');
      const inp = (val, span, on, attrs = {}) => el('input', Object.assign({ value: val, class: `col-span-${span} rounded border border-slate-300 dark:border-slate-600 bg-transparent px-2 py-1 text-xs`, oninput: (e) => on(e.target.value) }, attrs));
      row.appendChild(inp(g.label, 2, (v) => g.label = v, { placeholder: 'Label' }));
      const typeSel = el('select.col-span-3.rounded.border.border-slate-300.dark\\:border-slate-600.bg-transparent.px-1.py-1.text-xs', { onchange: (e) => g.type = e.target.value });
      [['rj45', 'RJ45'], ['wan', 'WAN'], ['sfp', 'SFP'], ['sfpplus', 'SFP+'], ['combo', 'Combo'], ['coax', 'Koax'], ['dsl', 'DSL']].forEach(([v, l]) => { const o = el('option', { value: v, text: l }); if (v === g.type) o.selected = true; typeSel.appendChild(o); });
      row.appendChild(typeSel);
      const spdSel = el('select.col-span-3.rounded.border.border-slate-300.dark\\:border-slate-600.bg-transparent.px-1.py-1.text-xs', { onchange: (e) => g.speed = parseInt(e.target.value) });
      [100, 1000, 2500, 5000, 10000, 25000].forEach((s) => { const o = el('option', { value: s, text: speedLabel(s) }); if (s === g.speed) o.selected = true; spdSel.appendChild(o); });
      row.appendChild(spdSel);
      row.appendChild(inp(g.count, 2, (v) => g.count = parseInt(v) || 0, { type: 'number', min: '0', title: 'Anzahl' }));
      const poe = el('label.col-span-1.flex.items-center.justify-center', { title: 'PoE-Quelle' }, [ el('input', { type: 'checkbox', checked: !!g.poe, class: 'accent-indigo-600', onchange: (e) => g.poe = e.target.checked }) ]);
      row.appendChild(poe);
      row.appendChild(el('button.col-span-1.text-red-500.text-sm', { text: '✕', onclick: onDelete, title: 'Gruppe entfernen' }));
      return row;
    }

    /* ------------------------------------------------------- Presets */
    function presetsPanel() {
      const wrap = el('div');
      wrap.appendChild(el('button.mb-3.px-3.py-1\\.5.rounded-lg.bg-indigo-600.text-white.text-sm', { text: '+ Neues Preset', onclick: () => presetForm() }));
      const list = el('div.space-y-2');
      DB.cablePresets.forEach((p) => {
        const std = cableStandard(p.standard);
        list.appendChild(el('div.flex.items-center.justify-between.gap-3.p-3.rounded-lg.bg-slate-100.dark\\:bg-slate-700\\/50', {}, [
          el('div.flex.items-center.gap-3.min-w-0', {}, [
            el('span.inline-block.w-4.h-4.rounded-full.shrink-0', { style: `background:${p.color}` }),
            el('div.min-w-0', {}, [ el('div.font-medium.text-sm.truncate', { text: p.name }), el('div.text-xs.text-slate-500', { text: `${std.name} · ${p.length} m${p.label ? ' · ' + p.label : ''}` }) ]),
          ]),
          el('div.flex.gap-1.shrink-0', {}, [
            el('button.text-xs.px-2.py-1.rounded.bg-slate-200.dark\\:bg-slate-600', { text: 'Bearbeiten', onclick: () => presetForm(p) }),
            el('button.text-xs.px-2.py-1.rounded.bg-red-100.text-red-700.dark\\:bg-red-900\\/40.dark\\:text-red-300', { text: 'Löschen', onclick: () => { if (confirm(`Preset „${p.name}" löschen?`)) DB.removePreset(p.id); } }),
          ]),
        ]));
      });
      wrap.appendChild(list);
      return wrap;
    }

    function presetForm(preset) {
      const editing = !!preset;
      const draft = preset ? deepClone(preset) : { id: uid('preset'), name: '', standard: 'cat6', color: '#3b82f6', length: 1, label: '' };
      UI.modal({
        title: editing ? 'Preset bearbeiten' : 'Neues Preset',
        body: (n) => {
          n.appendChild(textRow('Anzeigename', draft.name, (v) => draft.name = v));
          n.appendChild(selectRow('Standard', CABLE_STANDARDS.map((s) => [s.id, `${s.name} · bis ${speedLabel(s.maxSpeed)}`]), draft.standard, (v) => draft.standard = v));
          const colWrap = el('div.mb-3'); colWrap.appendChild(el('label.block.text-xs.font-medium.mb-1', { text: 'Farbe' }));
          const colRow = el('div.flex.flex-wrap.gap-2');
          NETWORK_COLORS.forEach((c) => colRow.appendChild(el('button', { class: 'w-7 h-7 rounded-full border-2', style: `background:${c.hex};border-color:${draft.color === c.hex ? '#6366f1' : 'transparent'}`, title: c.name, onclick: () => { draft.color = c.hex; UI.toast(c.name, 'info'); } })));
          colWrap.appendChild(colRow); n.appendChild(colWrap);
          n.appendChild(numRow('Länge (m)', draft.length, (v) => draft.length = v));
          n.appendChild(textRow('Flag / Bezeichnung', draft.label, (v) => draft.label = v));
        },
        actions: [{ label: 'Abbrechen' }, { label: 'Speichern', primary: true, onClick: () => { if (!draft.name.trim()) { UI.toast('Name fehlt.', 'warn'); return false; } DB.upsertPreset(draft); UI.toast('Preset gespeichert.', 'ok'); } }],
      });
    }
  }

  /* --------------------------------------------------------- Helpers */
  function textRow(label, value, onInput) {
    const w = el('div.mb-2'); w.appendChild(el('label.block.text-xs.font-medium.mb-1', { text: label }));
    w.appendChild(el('input', { value: value || '', class: 'w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm', oninput: (e) => onInput(e.target.value) }));
    return w;
  }
  function numRow(label, value, onInput) {
    const w = el('div.mb-2'); w.appendChild(el('label.block.text-xs.font-medium.mb-1', { text: label }));
    w.appendChild(el('input', { type: 'number', min: '0', value: value || 0, class: 'w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm', oninput: (e) => onInput(parseFloat(e.target.value) || 0) }));
    return w;
  }
  function selectRow(label, options, value, onChange) {
    const w = el('div.mb-2'); w.appendChild(el('label.block.text-xs.font-medium.mb-1', { text: label }));
    const sel = el('select.w-full.rounded-lg.border.border-slate-300.dark\\:border-slate-600.bg-transparent.px-3.py-2.text-sm', { onchange: (e) => onChange(e.target.value) });
    options.forEach(([v, l]) => { const o = el('option', { value: v, text: l }); if (v === value) o.selected = true; sel.appendChild(o); });
    w.appendChild(sel); return w;
  }

  return { open };
})();
