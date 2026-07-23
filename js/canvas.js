/* =========================================================================
   canvas.js – Interaktives CAD-Canvas (v2)
   -------------------------------------------------------------------------
   - Unendliche Arbeitsfläche mit Pan (Leerklick+ziehen / mittlere Maus) und
     stufenlosem Zoom am Mauszeiger (viewBox-basiert).
   - Orthogonales Grid-Routing der Kabel (nur 90°-Winkel).
   - Eckige Ports mit gelbem Snap-Punkt in der Mitte; Status-LEDs in den
     oberen Ecken (werden vom Kabel nicht verdeckt).
   - Geräte: verschieben, rotieren (90°), Kontextmenü (Quick Actions).
   - Debug-Engine-LEDs & Bottleneck-Badges.
   ========================================================================= */

const Canvas = (() => {
  const SVGNS = 'http://www.w3.org/2000/svg';
  const GRID = 20, BOX_H = 64, BOX_W_MIN = 116, PORT_PITCH = 24, PS = 16, STUB = 24;

  let svg, wrap, gGrid, gGrid2, gCables, gDevices, gOverlay, ctxMenu;
  let view = { x: 0, y: 0, w: 1200, h: 800 };
  let selectedId = null;
  let wiring = null;    // { deviceId, portId }
  let ghost = null, snapTarget = null;

  const e = (tag, attrs = {}) => { const n = document.createElementNS(SVGNS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); return n; };
  const snap = (v) => Math.round(v / GRID) * GRID;
  function rot(x, y, deg) { const r = deg * Math.PI / 180, c = Math.cos(r), s = Math.sin(r); return { x: x * c - y * s, y: x * s + y * c }; }

  /* --------------------------------------------------------------- Init */
  function init(svgEl, wrapEl) {
    svg = svgEl; wrap = wrapEl;
    svg.innerHTML = '';
    // Grid-Pattern
    const defs = e('defs');
    defs.innerHTML =
      `<pattern id="nd-grid" width="${GRID}" height="${GRID}" patternUnits="userSpaceOnUse">
         <path d="M ${GRID} 0 L 0 0 0 ${GRID}" fill="none" stroke="var(--nd-grid)" stroke-width="1"/>
       </pattern>
       <pattern id="nd-grid-strong" width="${GRID * 5}" height="${GRID * 5}" patternUnits="userSpaceOnUse">
         <path d="M ${GRID * 5} 0 L 0 0 0 ${GRID * 5}" fill="none" stroke="var(--nd-grid-strong)" stroke-width="1"/>
       </pattern>`;
    svg.appendChild(defs);
    gGrid = e('rect', { fill: 'url(#nd-grid)' });
    gGrid2 = e('rect', { fill: 'url(#nd-grid-strong)' }); gGrid2.id = 'nd-grid2';
    gCables = e('g'); gDevices = e('g'); gOverlay = e('g');
    svg.append(gGrid, gGrid2, gCables, gDevices, gOverlay);

    // Kontextmenü-Overlay (HTML) im Wrapper.
    ctxMenu = document.createElement('div');
    ctxMenu.className = 'nd-ctxmenu hidden';
    wrap.appendChild(ctxMenu);

    // Anfangs-View an Wrapper-Größe koppeln (1:1-Zoom).
    view = { x: -40, y: -40, w: wrap.clientWidth || 1200, h: wrap.clientHeight || 800 };
    applyView();

    svg.addEventListener('dragover', (ev) => { ev.preventDefault(); ev.dataTransfer.dropEffect = 'copy'; });
    svg.addEventListener('drop', onDrop);
    svg.addEventListener('mousedown', onCanvasDown);
    svg.addEventListener('mousemove', onWireMove);
    svg.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('resize', () => { view.w = wrap.clientWidth; view.h = wrap.clientHeight; applyView(); });

    Bus.on('state', render);
  }

  function applyView() {
    svg.setAttribute('viewBox', `${view.x} ${view.y} ${view.w} ${view.h}`);
    [gGrid, gGrid2].forEach((g) => {
      if (!g) return;
      g.setAttribute('x', view.x); g.setAttribute('y', view.y);
      g.setAttribute('width', view.w); g.setAttribute('height', view.h);
    });
    hideCtxMenu();
  }

  function toWorld(cx, cy) { const p = svg.createSVGPoint(); p.x = cx; p.y = cy; return p.matrixTransform(svg.getScreenCTM().inverse()); }

  /* ------------------------------------------------------------ Pan/Zoom */
  function onWheel(ev) {
    ev.preventDefault();
    const factor = ev.deltaY < 0 ? 0.88 : 1.14;
    const wpt = toWorld(ev.clientX, ev.clientY);
    const nw = Math.min(8000, Math.max(160, view.w * factor));
    const nh = nw * (view.h / view.w);
    // Zoom auf den Mauszeiger fixieren.
    view.x = wpt.x - (wpt.x - view.x) * (nw / view.w);
    view.y = wpt.y - (wpt.y - view.y) * (nh / view.h);
    view.w = nw; view.h = nh;
    applyView();
  }

  function onCanvasDown(ev) {
    const onEmpty = ev.target === svg || ev.target === gGrid || ev.target.id === 'nd-grid2';
    // Pan mit mittlerer Maustaste (überall) oder Linksklick auf leere Fläche.
    if (ev.button === 1 || (ev.button === 0 && onEmpty)) {
      const startClient = { x: ev.clientX, y: ev.clientY };
      const startView = { x: view.x, y: view.y };
      const scale = view.w / (wrap.clientWidth || view.w);
      let moved = false;
      const move = (e2) => {
        const dx = (e2.clientX - startClient.x) * scale, dy = (e2.clientY - startClient.y) * scale;
        if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
        view.x = startView.x - dx; view.y = startView.y - dy; applyView();
      };
      const up = () => {
        document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up);
        if (!moved && ev.button === 0) { select(null); cancelWiring(); hideCtxMenu(); }
      };
      document.addEventListener('mousemove', move); document.addEventListener('mouseup', up);
    }
  }

  function onDrop(ev) {
    ev.preventDefault();
    const assetId = ev.dataTransfer.getData('text/asset'); if (!assetId) return;
    const p = toWorld(ev.clientX, ev.clientY);
    const dev = State.addDevice(assetId, snap(p.x - 55), snap(p.y - 30));
    if (dev) select(dev.id);
  }

  /* -------------------------------------------------------- Geometrie */
  function boxWidth(d) { return Math.max(BOX_W_MIN, d.ports.length * PORT_PITCH + 20); }
  function portLocal(d, i) {
    const W = boxWidth(d), n = d.ports.length;
    const startX = (W - (n - 1) * PORT_PITCH) / 2;
    return { x: startX + i * PORT_PITCH - W / 2, y: BOX_H / 2, W };
  }
  // Welt-Anker + Normale eines Ports (berücksichtigt Rotation).
  function portWorld(deviceId, portId) {
    const d = State.device(deviceId); if (!d) return null;
    const i = d.ports.findIndex((p) => p.id === portId); if (i < 0) return null;
    const loc = portLocal(d, i);
    const cx = d.x + loc.W / 2, cy = d.y + BOX_H / 2, r = d.rotation || 0;
    const rv = rot(loc.x, loc.y, r), nv = rot(0, 1, r);
    return { x: snap0(cx + rv.x), y: snap0(cy + rv.y), nx: Math.round(nv.x), ny: Math.round(nv.y), raw: { x: cx + rv.x, y: cy + rv.y } };
  }
  function snap0(v) { return Math.round(v); }

  /* --------------------------------------------------------- Render */
  function render() {
    if (!State.project) return;
    State.recomputeAll();
    renderCables(); renderDevices();
  }

  function renderDevices() {
    gDevices.innerHTML = '';
    const mode = State.project.meta.mode;
    State.project.devices.forEach((d) => {
      const W = boxWidth(d), cx = d.x + W / 2, cy = d.y + BOX_H / 2, r = d.rotation || 0;
      const g = e('g', { class: 'nd-device' + (d.id === selectedId ? ' selected' : '') }); g.dataset.id = d.id;

      const inner = e('g', { transform: `translate(${cx} ${cy}) rotate(${r})` });
      // Box (enthält nur Piktogramm + Ports)
      const box = e('rect', { class: 'nd-device-body', x: -W / 2, y: -BOX_H / 2, width: W, height: BOX_H, rx: 8 });
      if (d.color) { box.setAttribute('stroke', d.color); box.setAttribute('stroke-width', '2.5'); }
      inner.appendChild(box);
      // Piktogramm
      const sym = e('g', { transform: `translate(0 ${-8})`, class: 'text-slate-500 dark:text-slate-300', color: 'currentColor' });
      sym.innerHTML = Symbols.render(d.icon, mode);
      inner.appendChild(sym);
      // Ports
      d.ports.forEach((p, i) => inner.appendChild(renderPort(d, p, i)));
      g.appendChild(inner);

      // Label IMMER außerhalb & oberhalb der Box (unrotiert, lesbar).
      const halfY = (r % 180 === 0) ? BOX_H / 2 : W / 2;
      const topY = cy - halfY - 8;
      const label = e('text', { class: 'nd-device-label', x: cx, y: topY, 'text-anchor': 'middle' });
      label.textContent = d.props.hostname || d.model;
      g.appendChild(label);
      if (d.props.ip4) { const s = e('text', { class: 'nd-device-sub', x: cx, y: topY + 11, 'text-anchor': 'middle' }); s.textContent = d.props.ip4; g.appendChild(s); }

      // PoE-Budget-Badge (Switch)
      const poe = State.poeLoad(d.id);
      if (poe) {
        const bY = cy + halfY + 12;
        const badge = e('text', { class: 'nd-poe-badge ' + (poe.over ? 'over' : 'ok'), x: cx, y: bY, 'text-anchor': 'middle' });
        badge.textContent = `PoE ${poe.load}/${poe.budget} W${poe.over ? '  ⚠' : ''}`;
        g.appendChild(badge);
      }

      enableDeviceInteract(g, d);
      gDevices.appendChild(g);
    });
  }

  function renderPort(d, port, i) {
    const loc = portLocal(d, i);
    const lx = loc.x, ly = loc.y;
    const used = State.isPortUsed(d.id, port.id);
    const disabled = State.isPortDisabled(d.id, port.id);
    const status = portStatus(d.id, port.id);
    const armed = wiring && wiring.deviceId === d.id && wiring.portId === port.id;
    const compatible = wiring && !armed && !used && !disabled;

    const g = e('g', { class: 'nd-port' + (armed ? ' armed' : '') + (compatible ? ' compatible' : '') + (disabled ? ' disabled' : '') });
    g.dataset.dev = d.id; g.dataset.port = port.id;

    // Eckiger Port
    g.appendChild(e('rect', { class: 'nd-port-body', x: lx - PS / 2, y: ly - PS / 2, width: PS, height: PS, rx: 2 }));
    // Status-LEDs in den OBEREN Ecken (nicht vom Kabel verdeckt)
    g.appendChild(e('rect', { class: `nd-led nd-led-green ${status}`, x: lx - PS / 2 + 1.5, y: ly - PS / 2 + 1.5, width: 3, height: 3, rx: 0.5 }));
    g.appendChild(e('rect', { class: `nd-led nd-led-amber ${status}`, x: lx + PS / 2 - 4.5, y: ly - PS / 2 + 1.5, width: 3, height: 3, rx: 0.5 }));
    // Gelber Snapping-Punkt in der Mitte
    g.appendChild(e('circle', { class: 'nd-snap-dot', cx: lx, cy: ly, r: 2.4 }));
    // Port-Kürzel (oberhalb, innerhalb der Box)
    const t = e('text', { class: 'nd-port-label', x: lx, y: ly - PS / 2 - 2 }); t.textContent = port.label; g.appendChild(t);

    if (status === 'warning') {
      const badge = e('g', { class: 'nd-warn-badge', transform: `translate(${lx + PS / 2}, ${ly - PS / 2})` });
      badge.appendChild(e('circle', { r: 4.5 }));
      const bt = e('text', { y: 3 }); bt.textContent = '!'; badge.appendChild(bt);
      badge.addEventListener('click', (ev) => { ev.stopPropagation(); showPortReason(d.id, port.id); });
      g.appendChild(badge);
    }

    // Größere Hitbox
    const hit = e('rect', { class: 'nd-port-hit', x: lx - PS / 2 - 4, y: ly - PS / 2 - 4, width: PS + 8, height: PS + 8 });
    g.appendChild(hit);
    g.addEventListener('mousedown', (ev) => ev.stopPropagation());
    g.addEventListener('click', (ev) => { ev.stopPropagation(); if (!disabled) onPortClick(d.id, port.id); });
    return g;
  }

  function portStatus(deviceId, portId) {
    const cs = State.project.cables.filter((c) =>
      (c.from.deviceId === deviceId && c.from.portId === portId) ||
      (c.to.deviceId === deviceId && c.to.portId === portId));
    if (!cs.length) return 'idle';
    if (cs.some((c) => c.status === 'error')) return 'error';
    if (cs.some((c) => c.status === 'warning')) return 'warning';
    return 'ok';
  }
  function showPortReason(deviceId, portId) {
    const c = State.project.cables.find((x) =>
      (x.from.deviceId === deviceId && x.from.portId === portId) ||
      (x.to.deviceId === deviceId && x.to.portId === portId));
    if (c) UI.toast(State.cableReason(c), 'warn');
  }

  /* ------------------------------------------------- Orthogonales Routing */
  // Liefert Punkt-Array (Welt) fuer eine orthogonale Verbindung A->B.
  function orthRoute(A, B) {
    const a1 = { x: snap(A.x + A.nx * STUB), y: snap(A.y + A.ny * STUB) };
    const b1 = { x: snap(B.x + B.nx * STUB), y: snap(B.y + B.ny * STUB) };
    let mids;
    if (A.nx === 0) { // Quelle vertikal orientiert -> horizontaler Kanal
      const midY = snap((a1.y + b1.y) / 2);
      mids = [{ x: a1.x, y: midY }, { x: b1.x, y: midY }];
    } else {          // horizontal orientiert -> vertikaler Kanal
      const midX = snap((a1.x + b1.x) / 2);
      mids = [{ x: midX, y: a1.y }, { x: midX, y: b1.y }];
    }
    const pts = [A, a1, ...mids, b1, B];
    // aufeinanderfolgende Duplikate entfernen
    return pts.filter((p, i) => i === 0 || p.x !== pts[i - 1].x || p.y !== pts[i - 1].y);
  }
  function pointsToPath(pts) { return pts.map((p, i) => `${i ? 'L' : 'M'} ${p.x} ${p.y}`).join(' '); }

  function renderCables() {
    gCables.innerHTML = '';
    State.project.cables.forEach((c) => {
      const A = portWorld(c.from.deviceId, c.from.portId);
      const B = portWorld(c.to.deviceId, c.to.portId);
      if (!A || !B) return;
      const pts = orthRoute(A, B);
      const d = pointsToPath(pts);
      const g = e('g');
      g.appendChild(e('path', { class: 'nd-cable-hit', d }));
      g.appendChild(e('path', { class: `nd-cable status-${c.status}`, d, stroke: c.status === 'error' ? '#ef4444' : c.color }));
      // Label am längsten Segment / Mittelpunkt
      const mid = pts[Math.floor(pts.length / 2)];
      const std = cableStandard(c.standard);
      const lbl = e('text', { class: 'nd-cable-label', x: mid.x, y: mid.y - 5, 'text-anchor': 'middle' });
      lbl.textContent = `${std.name} · ${c.length} m · ${speedLabel(c.speed)}${c.label ? ' · ' + c.label : ''}`;
      g.appendChild(lbl);
      g.querySelector('.nd-cable-hit').addEventListener('click', (ev) => { ev.stopPropagation(); cableMenu(c); });
      gCables.appendChild(g);
    });
  }

  function cableMenu(c) {
    const std = cableStandard(c.standard);
    UI.modal({
      title: 'Verbindung',
      body: (n) => {
        n.appendChild(UI.el('p.text-sm.mb-2', { html: `<b>${std.name}</b> · ${c.length} m · ${speedLabel(c.speed)}${c.label ? ' · ' + UI.escapeHtml(c.label) : ''}` }));
        n.appendChild(UI.el('p.text-sm.text-slate-500', { text: State.cableReason(c) }));
      },
      actions: [{ label: 'Kabel entfernen', danger: true, onClick: () => State.removeCable(c.id) }, { label: 'Schließen' }],
    });
  }

  /* ------------------------------------------- Geräte-Interaktion */
  function enableDeviceInteract(g, d) {
    g.addEventListener('mousedown', (ev) => {
      if (ev.button !== 0) return;
      if (ev.target.closest('.nd-port')) return;
      ev.preventDefault(); ev.stopPropagation();
      const startW = toWorld(ev.clientX, ev.clientY);
      const orig = { x: d.x, y: d.y }; let moved = false;
      hideCtxMenu();
      const move = (e2) => {
        const w = toWorld(e2.clientX, e2.clientY);
        const nx = snap(orig.x + (w.x - startW.x)), ny = snap(orig.y + (w.y - startW.y));
        if (nx !== d.x || ny !== d.y) moved = true;
        State.moveDevice(d.id, nx, ny); renderCables(); renderDevices();
      };
      const up = () => {
        document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up);
        select(d.id);
        if (!moved) showCtxMenu(d);   // Linksklick ohne Ziehen -> Quick Actions
      };
      document.addEventListener('mousemove', move); document.addEventListener('mouseup', up);
    });
  }

  /* ------------------------------------------------- Kontextmenü */
  function showCtxMenu(d) {
    const W = boxWidth(d), cx = d.x + W / 2, cy = d.y + BOX_H / 2;
    const halfY = ((d.rotation || 0) % 180 === 0) ? BOX_H / 2 : W / 2;
    const top = worldToClient(cx, cy - halfY);
    ctxMenu.innerHTML = '';
    const mk = (icon, title, fn) => {
      const b = document.createElement('button'); b.className = 'nd-ctx-btn'; b.title = title; b.textContent = icon;
      b.addEventListener('click', (ev) => { ev.stopPropagation(); fn(); });
      return b;
    };
    ctxMenu.append(
      mk('🗑️', 'Löschen', () => { State.removeDevice(d.id); hideCtxMenu(); select(null); }),
      mk('⧉', 'Duplizieren', () => { const nd = State.duplicateDevice(d.id); hideCtxMenu(); if (nd) select(nd.id); }),
      mk('⟳', 'Rotieren 90°', () => { State.rotateDevice(d.id); showCtxMenu(d); }),
      mk('🎨', 'Farbe ändern', () => colorPalette(d)),
    );
    const rect = wrap.getBoundingClientRect();
    ctxMenu.style.left = (top.x - rect.left) + 'px';
    ctxMenu.style.top = (top.y - rect.top - 44) + 'px';
    ctxMenu.classList.remove('hidden');
  }
  function colorPalette(d) {
    ctxMenu.innerHTML = '';
    NETWORK_COLORS.concat([{ name: 'Keine', hex: null }]).forEach((c) => {
      const b = document.createElement('button');
      b.className = 'nd-ctx-swatch'; b.title = c.name;
      b.style.background = c.hex || 'transparent';
      if (!c.hex) b.textContent = '∅';
      b.addEventListener('click', (ev) => { ev.stopPropagation(); State.setDeviceColor(d.id, c.hex); hideCtxMenu(); });
      ctxMenu.appendChild(b);
    });
  }
  function hideCtxMenu() { if (ctxMenu) ctxMenu.classList.add('hidden'); }
  function worldToClient(x, y) { const m = svg.getScreenCTM(); return { x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f }; }

  /* --------------------------------------------- Verkabelungs-Flow */
  function onPortClick(deviceId, portId) {
    const used = State.isPortUsed(deviceId, portId);
    if (!wiring) {
      if (used) { UI.toast('Port ist bereits belegt.', 'warn'); return; }
      wiring = { deviceId, portId }; svg.classList.add('is-wiring');
      UI.toast('Ziel-Port anklicken … (aktives Kabel: ' + cableStandard(State.activeCable.standard).name + ')', 'info');
      renderDevices(); return;
    }
    if (wiring.deviceId === deviceId && wiring.portId === portId) { cancelWiring(); return; }
    if (used) { UI.toast('Ziel-Port ist bereits belegt.', 'warn'); return; }
    State.addCable({ deviceId: wiring.deviceId, portId: wiring.portId }, { deviceId, portId });
    cancelWiring();
  }

  function onWireMove(ev) {
    if (!wiring) return;
    const A = portWorld(wiring.deviceId, wiring.portId); if (!A) return;
    const w = toWorld(ev.clientX, ev.clientY);
    // Auf nahen freien Port snappen.
    snapTarget = nearestPort(w.x, w.y);
    const end = snapTarget
      ? { x: portWorld(snapTarget.deviceId, snapTarget.portId).x, y: portWorld(snapTarget.deviceId, snapTarget.portId).y, nx: 0, ny: 0 }
      : { x: snap(w.x), y: snap(w.y), nx: 0, ny: 0 };
    const pts = orthRoute(A, end);
    if (!ghost) { ghost = e('path', { class: 'nd-wire-ghost' }); gOverlay.appendChild(ghost); }
    ghost.setAttribute('d', pointsToPath(pts));
  }
  function nearestPort(x, y) {
    let best = null, bd = 18 * 18;
    State.project.devices.forEach((d) => {
      d.ports.forEach((p) => {
        if (d.id === wiring.deviceId && p.id === wiring.portId) return;
        if (State.isPortUsed(d.id, p.id) || State.isPortDisabled(d.id, p.id)) return;
        const w = portWorld(d.id, p.id); const dd = (w.x - x) ** 2 + (w.y - y) ** 2;
        if (dd < bd) { bd = dd; best = { deviceId: d.id, portId: p.id }; }
      });
    });
    return best;
  }
  function cancelWiring() { wiring = null; snapTarget = null; svg.classList.remove('is-wiring'); if (ghost) { ghost.remove(); ghost = null; } renderDevices(); }

  /* --------------------------------------------------- Auswahl / Export */
  function select(id) { selectedId = id; Bus.emit('select', id); renderDevices(); }
  function deleteSelected() { if (selectedId) { State.removeDevice(selectedId); select(null); hideCtxMenu(); } }
  function flashDevice(id) {
    select(id);
    const d = State.device(id); if (!d) return;
    const W = boxWidth(d), cx = d.x + W / 2, cy = d.y + BOX_H / 2;
    // Zentrieren
    view.x = cx - view.w / 2; view.y = cy - view.h / 2; applyView();
    const g = gDevices.querySelector(`[data-id="${id}"]`);
    if (g) { g.classList.add('jump-flash'); setTimeout(() => g.classList.remove('jump-flash'), 1200); }
  }

  function buildStandaloneSVG(mode) {
    const devs = State.project.devices;
    if (!devs.length) return { svg: '', width: 0, height: 0 };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    devs.forEach((d) => { const W = boxWidth(d); minX = Math.min(minX, d.x - 20); minY = Math.min(minY, d.y - 30); maxX = Math.max(maxX, d.x + W + 20); maxY = Math.max(maxY, d.y + BOX_H + 40); });
    const pad = 30; minX -= pad; minY -= pad; maxX += pad; maxY += pad;
    const Wd = Math.round(maxX - minX), Hd = Math.round(maxY - minY);
    const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
    const out = [`<rect x="${minX}" y="${minY}" width="${Wd}" height="${Hd}" fill="${mode === 'professional' ? '#fff' : '#f8fafc'}"/>`];

    State.project.cables.forEach((c) => {
      const A = portWorld(c.from.deviceId, c.from.portId), B = portWorld(c.to.deviceId, c.to.portId);
      if (!A || !B) return;
      const d = pointsToPath(orthRoute(A, B));
      out.push(`<path d="${d}" fill="none" stroke="${c.status === 'error' ? '#ef4444' : c.color}" stroke-width="3" stroke-linejoin="round"/>`);
    });
    const symColor = mode === 'professional' ? '#334155' : '#000';
    devs.forEach((d) => {
      const W = boxWidth(d), cx = d.x + W / 2, cy = d.y + BOX_H / 2, r = d.rotation || 0;
      const halfY = (r % 180 === 0) ? BOX_H / 2 : W / 2;
      out.push(`<text x="${cx}" y="${cy - halfY - 8}" text-anchor="middle" font-family="sans-serif" font-weight="600" font-size="12" fill="#334155">${esc(d.props.hostname || d.model)}</text>`);
      out.push(`<g transform="translate(${cx} ${cy}) rotate(${r})">`);
      out.push(`<rect x="${-W / 2}" y="${-BOX_H / 2}" width="${W}" height="${BOX_H}" rx="8" fill="#fff" stroke="${d.color || '#94a3b8'}" stroke-width="${d.color ? 2.5 : 1.5}"/>`);
      out.push(`<g transform="translate(0 -8)" color="${symColor}" fill="${mode === 'professional' ? 'none' : symColor}">${Symbols.render(d.icon, mode)}</g>`);
      d.ports.forEach((p, i) => {
        const loc = portLocal(d, i); const st = portStatus(d.id, p.id); const on = st === 'ok' || st === 'warning';
        out.push(`<rect x="${loc.x - PS / 2}" y="${loc.y - PS / 2}" width="${PS}" height="${PS}" rx="2" fill="#cbd5e1" stroke="#64748b"/>`);
        out.push(`<rect x="${loc.x - PS / 2 + 1.5}" y="${loc.y - PS / 2 + 1.5}" width="3" height="3" fill="#16a34a" opacity="${on ? 1 : 0.2}"/>`);
        out.push(`<rect x="${loc.x + PS / 2 - 4.5}" y="${loc.y - PS / 2 + 1.5}" width="3" height="3" fill="#f59e0b" opacity="${on ? 1 : 0.2}"/>`);
        out.push(`<circle cx="${loc.x}" cy="${loc.y}" r="2.2" fill="#eab308"/>`);
        if (st === 'warning') out.push(`<g transform="translate(${loc.x + PS / 2} ${loc.y - PS / 2})"><circle r="4.5" fill="#dc2626"/><text y="3" text-anchor="middle" font-family="sans-serif" font-weight="700" font-size="8" fill="#fff">!</text></g>`);
      });
      out.push(`</g>`);
    });
    return { svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${Wd}" height="${Hd}" viewBox="${minX} ${minY} ${Wd} ${Hd}">${out.join('')}</svg>`, width: Wd, height: Hd };
  }

  return { init, render, select, deleteSelected, flashDevice, buildStandaloneSVG, get selectedId() { return selectedId; } };
})();
