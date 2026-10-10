/* =========================================================================
   app.js – Bootstrap, Routing, Editor-Shell mit Werkzeug-Toolbar (v3)
   ========================================================================= */

const App = (() => {
  const el = UI.el;
  const root = () => document.getElementById('app');
  const THEME_KEY = 'nd-theme';
  let refs = {};

  /* ------------------------------------------------------------- Theme */
  function applyTheme(t) { document.documentElement.classList.toggle('dark', t === 'dark'); localStorage.setItem(THEME_KEY, t); }
  function currentTheme() { return localStorage.getItem(THEME_KEY) || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'); }
  function toggleTheme() { applyTheme(currentTheme() === 'dark' ? 'light' : 'dark'); refreshChrome(); }

  /* --------------------------------------------------------- Startseite */
  function renderStart() {
    const r = root(); r.innerHTML = '';
    const wrap = el('div.h-full.w-full.flex.flex-col.items-center.justify-center.gap-8.p-6');
    wrap.appendChild(el('div.text-center', {}, [
      el('div.text-4xl.font-bold.tracking-tight', { html: 'Network&nbsp;Schematic&nbsp;<span class="text-indigo-500">Designer</span>' }),
      el('div.text-slate-500.mt-2', { text: 'Lokaler CAD-Netzwerk-Schaltplan-Editor · v2.1' }),
    ]));
    const cards = el('div.grid.gap-4.w-full.max-w-3xl', { style: 'grid-template-columns:repeat(auto-fit,minmax(200px,1fr))' });
    cards.append(
      startCard('🆕', 'Neues Design starten', 'Leeres Projekt öffnen', () => { State.blank(); renderEditor(); }),
      startCard('📂', 'Design hochladen', 'Projektdatei (.json) fortsetzen', pickProjectFile),
      startCard('🗄️', 'Asset- & Preset-Datenbank', 'Geräte & Kabel verwalten', () => Database.open()),
    );
    wrap.appendChild(cards);
    wrap.appendChild(el('button.mt-4.text-sm.text-slate-400.hover\\:text-slate-600', { text: (currentTheme() === 'dark' ? '☀️ Light' : '🌙 Dark') + ' Mode', onclick: () => { toggleTheme(); renderStart(); } }));
    r.appendChild(wrap);
  }
  function startCard(icon, title, desc, onClick) {
    return el('button.group.p-6.rounded-2xl.border.border-slate-200.dark\\:border-slate-700.bg-white.dark\\:bg-slate-800.hover\\:border-indigo-400.hover\\:shadow-lg.transition.text-left', { onclick: onClick }, [
      el('div.text-3xl.mb-3', { text: icon }), el('div.font-semibold', { text: title }), el('div.text-sm.text-slate-500.mt-1', { text: desc }),
    ]);
  }
  function pickProjectFile() {
    const input = el('input', { type: 'file', accept: '.json,application/json', style: 'display:none' });
    input.addEventListener('change', () => { const f = input.files[0]; if (!f) return; const rd = new FileReader(); rd.onload = () => { try { State.loadFrom(JSON.parse(rd.result)); renderEditor(); UI.toast('Projekt geladen.', 'ok'); } catch (e) { UI.toast('Fehler: ' + e.message, 'error'); } }; rd.readAsText(f); });
    document.body.appendChild(input); input.click(); input.remove();
  }

  /* ------------------------------------------------------------ Editor */
  function renderEditor() {
    const r = root(); r.innerHTML = '';
    const shell = el('div.h-full.w-full.flex.flex-col');
    shell.appendChild(buildToolbar());
    const main = el('div.flex.flex-1.min-h-0');
    main.appendChild(buildPalette());
    const canvasWrap = el('div.flex-1.min-w-0.nd-canvas-wrap');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.id = 'nd-svg';
    canvasWrap.appendChild(svg); main.appendChild(canvasWrap);
    main.appendChild(buildRightPanel());
    shell.appendChild(main); r.appendChild(shell);

    Canvas.init(svg, canvasWrap);
    Properties.mount(refs.propsHost);
    LiveCode.mount(refs.codeHost);
    Groups.mount(refs.groupsHost);
    Canvas.render(); Canvas.fitView();

    Bus.on('selection', (ids) => { if (ids.length) switchTab('props'); });
    Bus.on('activecable', updateCableBtn);
    Bus.on('tool', updateToolButtons);

    document.onkeydown = (ev) => {
      if (ev.key === 'Escape') return;
      if ((ev.key === 'Delete' || ev.key === 'Backspace') && Canvas.selectedIds.length && document.activeElement === document.body) { ev.preventDefault(); Canvas.deleteSelected(); }
    };
  }

  /* --------------------------------------------- Werkzeug-Toolbar (Fusion-Stil) */
  function toolBtn(icon, label, { onClick, title, active, tool }) {
    const b = el('button', { class: 'nd-tbtn' + (active ? ' active' : ''), title: title || label, onclick: onClick });
    if (tool) b.dataset.tool = tool;
    b.innerHTML = `${Icons.get(icon, 22)}<span>${label}</span>`;
    return b;
  }
  function sep() { return el('div.nd-tsep'); }
  function group(label, children) {
    return el('div.nd-tgroup', {}, [ el('div.nd-tgroup-body', {}, children), el('div.nd-tgroup-label', { text: label }) ]);
  }

  function buildToolbar() {
    const p = State.project;
    const nameInput = el('input', { value: p.meta.name, title: 'Projektname', class: 'bg-transparent font-semibold text-sm px-2 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 outline-none w-40', onchange: (ev) => State.setName(ev.target.value) });

    refs.toolBtns = {};
    const mkTool = (t, icon, label) => { const b = toolBtn(icon, label, { tool: t, active: Canvas.tool === t, onClick: () => Canvas.setTool(t) }); refs.toolBtns[t] = b; return b; };

    refs.cableBtn = el('button.nd-tbtn.nd-tbtn-wide', { onclick: openCableMenu, title: 'Base-Kabel konfigurieren' });
    refs.modeBtn = toolBtn('design', 'Design', { onClick: toggleMode, title: 'Design/Professional' });
    refs.themeBtn = toolBtn('moon', 'Theme', { onClick: toggleTheme, title: 'Light/Dark' });

    const bar = el('header.nd-toolbar', {}, [
      el('div.flex.items-center.gap-2.pr-2', {}, [ el('span.text-indigo-500.font-bold.text-lg', { text: '◈' }), nameInput ]),
      sep(),
      group('Werkzeuge', [ mkTool('select', 'cursor', 'Auswahl'), mkTool('wire', 'wire', 'Kabel'), mkTool('group', 'group', 'Gruppieren') ]),
      sep(),
      group('Kabel & Flags', [ refs.cableBtn ]),
      sep(),
      group('Bearbeiten', [
        toolBtn('rotate', 'Rotieren', { onClick: () => actOnSelection('rotate'), title: 'Auswahl rotieren' }),
        toolBtn('duplicate', 'Duplizieren', { onClick: () => actOnSelection('duplicate'), title: 'Auswahl duplizieren' }),
        toolBtn('trash', 'Löschen', { onClick: () => Canvas.deleteSelected(), title: 'Auswahl löschen' }),
      ]),
      sep(),
      group('Ansicht', [
        toolBtn('fit', 'Einpassen', { onClick: () => Canvas.fitView(), title: 'Ansicht einpassen' }),
        refs.modeBtn,
        toolBtn('highlight', 'Gruppen', { onClick: () => switchTab('groups'), title: 'Gruppen & Highlight' }),
        refs.themeBtn,
      ]),
      el('div.flex-1'),
      group('Projekt', [
        toolBtn('download', 'Export', { onClick: () => Exporter.openMenu(), title: '5-Wege-Export' }),
        toolBtn('database', 'Datenbank', { onClick: () => Database.open(), title: 'Asset-/Preset-DB' }),
        toolBtn('exit', 'Beenden', { onClick: exitToStart, title: 'Beenden (Zero-Trust)' }),
      ]),
    ]);
    refreshChrome(); updateCableBtn();
    return bar;
  }

  function actOnSelection(kind) {
    Canvas.selectedIds.forEach((id) => { if (State.device(id)) { kind === 'rotate' ? State.rotateDevice(id) : State.duplicateDevice(id); } });
  }
  function updateToolButtons(t) { Object.entries(refs.toolBtns || {}).forEach(([k, b]) => b.classList.toggle('active', k === t)); }
  function refreshChrome() {
    if (refs.modeBtn && State.project) { const pro = State.project.meta.mode === 'professional'; refs.modeBtn.innerHTML = `${Icons.get(pro ? 'pro' : 'design', 22)}<span>${pro ? 'Professional' : 'Design'}</span>`; }
    if (refs.themeBtn) { const dark = currentTheme() === 'dark'; refs.themeBtn.innerHTML = `${Icons.get(dark ? 'sun' : 'moon', 22)}<span>Theme</span>`; }
  }
  function updateCableBtn() {
    if (!refs.cableBtn) return; const ac = State.activeCable, std = cableStandard(ac.standard);
    refs.cableBtn.innerHTML = `${Icons.get('wire', 22)}<span style="display:flex;align-items:center;gap:5px"><span style="display:inline-block;width:10px;height:10px;border-radius:9999px;background:${ac.color}"></span>${std.name} · ${ac.length} m${ac.label ? ' · ' + UI.escapeHtml(ac.label) : ''}</span>`;
  }
  function toggleMode() { State.setMode(State.project.meta.mode === 'professional' ? 'design' : 'professional'); refreshChrome(); }

  /* ------------------------------------------- Kabel-Menü (Base-Kabel) */
  function openCableMenu() {
    const ac = Object.assign({}, State.activeCable);
    UI.modal({
      title: 'Kabel-Konfiguration (Base-Kabel für die nächste Verbindung)', wide: true,
      body: (n) => {
        n.appendChild(el('div.text-xs.font-semibold.mb-1.text-slate-400', { text: 'Schnellauswahl' }));
        const presetRow = el('div.flex.flex-wrap.gap-2.mb-4');
        DB.cablePresets.forEach((pr) => presetRow.appendChild(el('button.px-2.py-1.rounded-lg.text-xs.border.border-slate-200.dark\\:border-slate-600.flex.items-center.gap-2.hover\\:border-indigo-400', { onclick: () => { Object.assign(ac, { standard: pr.standard, color: pr.color, length: pr.length, label: pr.label }); rebuild(); } }, [ el('span', { style: `display:inline-block;width:10px;height:10px;border-radius:9999px;background:${pr.color}` }), document.createTextNode(pr.name) ])));
        n.appendChild(presetRow);
        const dyn = el('div'); n.appendChild(dyn);
        function rebuild() {
          dyn.innerHTML = '';
          dyn.appendChild(el('div.text-xs.font-semibold.mb-1', { text: 'Standard' }));
          const sg = el('div.flex.flex-wrap.gap-2.mb-3');
          CABLE_STANDARDS.forEach((s) => sg.appendChild(el('button', { class: `px-3 py-1.5 rounded-lg text-xs border ${ac.standard === s.id ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-300 dark:border-slate-600'}`, text: `${s.name} · bis ${speedLabel(s.maxSpeed)}`, onclick: () => { ac.standard = s.id; rebuild(); } })));
          dyn.appendChild(sg);
          dyn.appendChild(el('div.text-xs.font-semibold.mb-1', { text: 'Farbe' }));
          const cr = el('div.flex.flex-wrap.gap-2.mb-3');
          NETWORK_COLORS.forEach((c) => cr.appendChild(el('button', { class: `w-7 h-7 rounded-full border-2 ${ac.color === c.hex ? 'border-indigo-600' : 'border-transparent'}`, style: `background:${c.hex}`, title: c.name, onclick: () => { ac.color = c.hex; rebuild(); } })));
          dyn.appendChild(cr);
          dyn.appendChild(el('div.text-xs.font-semibold.mb-1', { text: 'Länge' }));
          const lr = el('div.flex.flex-wrap.gap-2.items-center.mb-3');
          CABLE_LENGTHS.forEach((l) => lr.appendChild(el('button', { class: `px-2.5 py-1 rounded-lg text-xs border ${ac.length === l ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-300 dark:border-slate-600'}`, text: l < 1 ? (l * 100) + ' cm' : l + ' m', onclick: () => { ac.length = l; rebuild(); } })));
          lr.appendChild(el('span.text-xs.text-slate-400', { text: 'Individuell:' }));
          lr.appendChild(el('input', { type: 'number', step: '0.01', min: '0', value: ac.length, class: 'w-20 rounded border border-slate-300 dark:border-slate-600 bg-transparent px-2 py-1 text-xs', oninput: (ev) => { ac.length = parseFloat(ev.target.value) || 0; } }));
          dyn.appendChild(lr);
          dyn.appendChild(el('div.text-xs.font-semibold.mb-1', { text: 'Flag / Bezeichnung' }));
          dyn.appendChild(el('input', { value: ac.label, placeholder: 'z. B. Uplink', class: 'w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm', oninput: (ev) => { ac.label = ev.target.value; } }));
        }
        rebuild();
      },
      actions: [{ label: 'Abbrechen' }, { label: 'Als aktives Kabel übernehmen', primary: true, onClick: () => { State.setActiveCable(ac); UI.toast('Aktives Kabel gesetzt.', 'ok'); } }],
    });
  }

  /* -------------------------------------------- Asset-Bibliothek (Accordion) */
  function buildPalette() {
    const aside = el('aside.w-60.shrink-0.border-r.border-slate-200.dark\\:border-slate-700.bg-white.dark\\:bg-slate-800.flex.flex-col');
    aside.appendChild(el('div.px-3.py-2.text-xs.font-semibold.uppercase.tracking-wide.text-slate-400.border-b.border-slate-200.dark\\:border-slate-700', { text: 'Asset-Bibliothek' }));
    const list = el('div.p-1.overflow-y-auto.nd-scroll.flex-1'); const openState = {};
    const build = () => {
      list.innerHTML = '';
      ASSET_CATEGORIES.forEach((cat, idx) => {
        const assets = DB.assetsByCategory(cat.id); if (!assets.length) return;
        if (openState[cat.id] === undefined) openState[cat.id] = idx < 2;
        const section = el('div.mb-1');
        section.appendChild(el('button.nd-acc-head', { onclick: () => { openState[cat.id] = !openState[cat.id]; build(); } }, [ document.createTextNode(cat.label), el('span', { text: (openState[cat.id] ? '▾' : '▸') + '  ' + assets.length }) ]));
        if (openState[cat.id]) { const items = el('div.space-y-0\\.5.px-1.pb-1'); assets.forEach((a) => items.appendChild(assetItem(a))); section.appendChild(items); }
        list.appendChild(section);
      });
    };
    build(); Bus.on('db', build);
    aside.appendChild(list);
    aside.appendChild(el('div.p-2.border-t.border-slate-200.dark\\:border-slate-700', {}, [ el('button.w-full.text-xs.px-3.py-2.rounded-lg.bg-slate-100.dark\\:bg-slate-700.hover\\:bg-slate-200', { text: '+ Assets verwalten', onclick: () => Database.open('assets') }) ]));
    return aside;
  }
  function assetItem(a) {
    const item = el('div.flex.items-center.gap-2.p-1\\.5.rounded-lg.cursor-grab.border.border-transparent.hover\\:border-indigo-300.hover\\:bg-indigo-50.dark\\:hover\\:bg-indigo-900\\/20', { draggable: 'true', title: `${a.chipset || ''} · ${a.ports.reduce((s, p) => s + p.count, 0)} Ports${a.poeBudget ? ' · PoE ' + a.poeBudget + 'W' : ''}` });
    item.addEventListener('dragstart', (ev) => ev.dataTransfer.setData('text/asset', a.id));
    const ico = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); ico.setAttribute('width', '32'); ico.setAttribute('height', '26'); ico.setAttribute('viewBox', '-20 -16 40 34'); ico.setAttribute('class', 'shrink-0 text-slate-500 dark:text-slate-300'); ico.setAttribute('color', 'currentColor'); ico.innerHTML = Symbols.render(a.icon, 'design');
    item.append(ico, el('div.min-w-0', {}, [ el('div.text-xs.font-medium.truncate', { text: a.model }), el('div.text-\\[10px\\].text-slate-400.truncate', { text: a.ports.map((p) => `${p.count}×${speedLabel(p.speed)}`).join(' ') }) ]));
    return item;
  }

  /* --------------------------------------------------- Rechte Spalte */
  function buildRightPanel() {
    const aside = el('aside.w-80.shrink-0.border-l.border-slate-200.dark\\:border-slate-700.bg-white.dark\\:bg-slate-800.flex.flex-col.min-h-0');
    const tabs = el('div.flex.shrink-0.border-b.border-slate-200.dark\\:border-slate-700');
    refs.tabProps = tabBtn('props', 'Eigenschaften'); refs.tabGroups = tabBtn('groups', 'Gruppen'); refs.tabCode = tabBtn('code', 'Live-Code');
    tabs.append(refs.tabProps, refs.tabGroups, refs.tabCode); aside.appendChild(tabs);
    refs.propsHost = el('div.flex-1.min-h-0.overflow-hidden');
    refs.groupsHost = el('div.flex-1.min-h-0.overflow-y-auto.nd-scroll.hidden');
    refs.codeHost = el('div.flex-1.min-h-0.overflow-y-auto.nd-scroll.p-3.nd-livecode.hidden');
    aside.append(refs.propsHost, refs.groupsHost, refs.codeHost);
    switchTab('props');
    return aside;
  }
  function tabBtn(key, label) { return el('button.flex-1.px-2.py-2.text-xs.font-medium.border-b-2.-mb-px', { text: label, onclick: () => switchTab(key), dataset: { tab: key } }); }
  function switchTab(key) {
    refs.propsHost.classList.toggle('hidden', key !== 'props');
    refs.groupsHost.classList.toggle('hidden', key !== 'groups');
    refs.codeHost.classList.toggle('hidden', key !== 'code');
    [refs.tabProps, refs.tabGroups, refs.tabCode].forEach((b) => { const a = b.dataset.tab === key; b.className = `flex-1 px-2 py-2 text-xs font-medium border-b-2 -mb-px ${a ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500'}`; });
  }

  function exitToStart() { Exporter.requestExit(() => { document.onkeydown = null; refs = {}; renderStart(); }); }

  function init() { DB.init(); applyTheme(currentTheme()); renderStart(); }
  return { init };
})();

document.addEventListener('DOMContentLoaded', App.init);
