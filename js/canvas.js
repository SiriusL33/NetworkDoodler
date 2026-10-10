/* =========================================================================
   canvas.js – Interaktives CAD-Canvas (v3)
   -------------------------------------------------------------------------
   - Kamera-Modell (cam.x/y/zoom): viewBox = Elementgröße / zoom  → nie
     verzerrt oder abgeschnitten, Aspect immer korrekt.
   - Werkzeuge (tool): 'select' | 'wire' | 'group'.
   - Präzise Wegpunkt-Verkabelung: Port → Klicks setzen orthogonale
     Zwischenstops → Ziel-Port. Backspace entfernt letzten, Esc bricht ab.
   - Mehrfachauswahl (Shift-Klick), Gruppen + Highlight (dimmt den Rest).
   - Eckige Ports (Snap-Punkt, Eck-LEDs), Rotieren/Duplizieren/Farbe,
     PoE-Badge & Debug-LEDs.
   ========================================================================= */

const Canvas = (() => {
  const SVGNS = 'http://www.w3.org/2000/svg';
  const GRID = 20, BOX_H = 64, BOX_W_MIN = 116, PORT_PITCH = 24, PS = 16, STUB = 24;

  let svg, wrap, gGrid, gGrid2, gCables, gDevices, gOverlay, ctxMenu;
  let cam = { x: -40, y: -40, zoom: 1 };   // zoom = Bildschirm-Pixel pro Welt-Einheit
  let tool = 'select';
  let selectedIds = new Set();
  let wiring = null;                        // { deviceId, portId, waypoints:[] }
  let ghost = null;
  let highlightGroupId = null;

  const e = (tag, attrs = {}) => { const n = document.createElementNS(SVGNS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); return n; };
  const snap = (v) => Math.round(v / GRID) * GRID;
  function rot(x, y, deg) { const r = deg * Math.PI / 180, c = Math.cos(r), s = Math.sin(r); return { x: x * c - y * s, y: x * s + y * c }; }

  /* --------------------------------------------------------------- Init */
  function init(svgEl, wrapEl) {
    svg = svgEl; wrap = wrapEl; svg.innerHTML = '';
    const defs = e('defs');
    defs.innerHTML =
      `<pattern id="nd-grid" width="${GRID}" height="${GRID}" patternUnits="userSpaceOnUse"><path d="M ${GRID} 0 L 0 0 0 ${GRID}" fill="none"/></pattern>
       <pattern id="nd-grid-strong" width="${GRID * 5}" height="${GRID * 5}" patternUnits="userSpaceOnUse"><path d="M ${GRID * 5} 0 L 0 0 0 ${GRID * 5}" fill="none"/></pattern>`;
    svg.appendChild(defs);
    gGrid = e('rect', { fill: 'url(#nd-grid)' });
    gGrid2 = e('rect', { fill: 'url(#nd-grid-strong)' }); gGrid2.id = 'nd-grid2';
    gCables = e('g'); gDevices = e('g'); gOverlay = e('g');
    svg.append(gGrid, gGrid2, gCables, gDevices, gOverlay);

    ctxMenu = document.createElement('div'); ctxMenu.className = 'nd-ctxmenu hidden'; wrap.appendChild(ctxMenu);

    cam = { x: -40, y: -40, zoom: 1 }; applyView();

    svg.addEventListener('dragover', (ev) => { ev.preventDefault(); ev.dataTransfer.dropEffect = 'copy'; });
    svg.addEventListener('drop', onDrop);
    svg.addEventListener('mousedown', onCanvasDown);
    svg.addEventListener('mousemove', onWireMove);
    svg.addEventListener('wheel', onWheel, { passive: false });
    svg.addEventListener('contextmenu', (ev) => { ev.preventDefault(); if (wiring) cancelWiring(); });
    window.addEventListener('resize', applyView);
    Bus.on('state', render);
  }

  function applyView() {
    const W = wrap.clientWidth || 1200, H = wrap.clientHeight || 800;
    const vbW = W / cam.zoom, vbH = H / cam.zoom;
    svg.setAttribute('viewBox', `${cam.x} ${cam.y} ${vbW} ${vbH}`);
    [gGrid, gGrid2].forEach((g) => { g.setAttribute('x', cam.x); g.setAttribute('y', cam.y); g.setAttribute('width', vbW); g.setAttribute('height', vbH); });
    hideCtxMenu();
  }
  function toWorld(cx, cy) { const p = svg.createSVGPoint(); p.x = cx; p.y = cy; return p.matrixTransform(svg.getScreenCTM().inverse()); }
  function worldToClient(x, y) { const m = svg.getScreenCTM(); return { x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f }; }

  /* ------------------------------------------------------------ Pan/Zoom */
  function onWheel(ev) {
    ev.preventDefault();
    const w = toWorld(ev.clientX, ev.clientY);
    const nz = Math.min(6, Math.max(0.15, cam.zoom * (ev.deltaY < 0 ? 1.14 : 0.88)));
    cam.x = w.x - (w.x - cam.x) * (cam.zoom / nz);
    cam.y = w.y - (w.y - cam.y) * (cam.zoom / nz);
    cam.zoom = nz; applyView();
  }
  function startPan(ev) {
    const sc = { x: ev.clientX, y: ev.clientY }, so = { x: cam.x, y: cam.y }; let moved = false;
    const move = (e2) => { cam.x = so.x - (e2.clientX - sc.x) / cam.zoom; cam.y = so.y - (e2.clientY - sc.y) / cam.zoom; if (Math.abs(e2.clientX - sc.x) + Math.abs(e2.clientY - sc.y) > 3) moved = true; applyView(); };
    const up = () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); return moved; };
    return { move, up, get moved() { return moved; } };
  }

  function onCanvasDown(ev) {
    const onEmpty = ev.target === svg || ev.target === gGrid || ev.target.id === 'nd-grid2';
    if (ev.button === 1) { const p = startPan(ev); document.addEventListener('mousemove', p.move); document.addEventListener('mouseup', p.up); return; }
    if (ev.button !== 0 || !onEmpty) return;

    // Linksklick auf leere Fläche
    const p = startPan(ev);
    document.addEventListener('mousemove', p.move);
    document.addEventListener('mouseup', () => {
      p.up();
      if (p.moved) return;                    // war ein Pan
      if (wiring) { addWaypointAt(ev.clientX, ev.clientY); return; }   // Zwischenstop setzen
      setSelection([]); hideCtxMenu();
    }, { once: true });
  }

  function onDrop(ev) {
    ev.preventDefault();
    const assetId = ev.dataTransfer.getData('text/asset'); if (!assetId) return;
    const p = toWorld(ev.clientX, ev.clientY);
    const dev = State.addDevice(assetId, snap(p.x - 55), snap(p.y - 30));
    if (dev) setSelection([dev.id]);
  }

  /* -------------------------------------------------------- Geometrie */
  function boxWidth(d) { return Math.max(BOX_W_MIN, d.ports.length * PORT_PITCH + 20); }
  function portLocal(d, i) { const W = boxWidth(d), n = d.ports.length, s = (W - (n - 1) * PORT_PITCH) / 2; return { x: s + i * PORT_PITCH - W / 2, y: BOX_H / 2, W }; }
  function portWorld(deviceId, portId) {
    const d = State.device(deviceId); if (!d) return null;
    const i = d.ports.findIndex((p) => p.id === portId); if (i < 0) return null;
    const loc = portLocal(d, i), cx = d.x + loc.W / 2, cy = d.y + BOX_H / 2, r = d.rotation || 0;
    const rv = rot(loc.x, loc.y, r), nv = rot(0, 1, r);
    return { x: Math.round(cx + rv.x), y: Math.round(cy + rv.y), nx: Math.round(nv.x), ny: Math.round(nv.y) };
  }

  /* --------------------------------------------- Orthogonale Pfade */
  function align(p, ref) { return Math.abs(p.x - ref.x) >= Math.abs(p.y - ref.y) ? { x: p.x, y: ref.y } : { x: ref.x, y: p.y }; }
  function dedupe(pts) { return pts.filter((p, i) => i === 0 || p.x !== pts[i - 1].x || p.y !== pts[i - 1].y); }
  function orthogonalize(pts) {
    pts = dedupe(pts); if (pts.length < 2) return pts;
    const out = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const a = out[out.length - 1], b = pts[i];
      if (a.x !== b.x && a.y !== b.y) out.push({ x: b.x, y: a.y }); // Ellbogen einfügen
      out.push(b);
    }
    return dedupe(out);
  }
  function pointsToPath(pts) { return pts.map((p, i) => `${i ? 'L' : 'M'} ${p.x} ${p.y}`).join(' '); }
  // Automatischer Z-Kanal (wenn keine Wegpunkte gesetzt sind)
  function autoRoute(A, B) {
    const a1 = { x: snap(A.x + A.nx * STUB), y: snap(A.y + A.ny * STUB) };
    const b1 = { x: snap(B.x + B.nx * STUB), y: snap(B.y + B.ny * STUB) };
    const mids = A.nx === 0 ? [{ x: a1.x, y: snap((a1.y + b1.y) / 2) }, { x: b1.x, y: snap((a1.y + b1.y) / 2) }]
                            : [{ x: snap((a1.x + b1.x) / 2), y: a1.y }, { x: snap((a1.x + b1.x) / 2), y: b1.y }];
    return dedupe([A, a1, ...mids, b1, B]);
  }
  function cableRoute(c) {
    const A = portWorld(c.from.deviceId, c.from.portId), B = portWorld(c.to.deviceId, c.to.portId);
    if (!A || !B) return null;
    if (!c.waypoints || !c.waypoints.length) return autoRoute(A, B);
    const stubA = { x: snap(A.x + A.nx * STUB), y: snap(A.y + A.ny * STUB) };
    const stubB = { x: snap(B.x + B.nx * STUB), y: snap(B.y + B.ny * STUB) };
    return orthogonalize([{ x: A.x, y: A.y }, stubA, ...c.waypoints, stubB, { x: B.x, y: B.y }]);
  }

  /* --------------------------------------------------------- Render */
  function render() {
    if (!State.project) return;
    State.recomputeAll();
    renderCables(); renderDevices();
  }

  function dimmed(item) { return highlightGroupId && item.group !== highlightGroupId; }

  function renderCables() {
    gCables.innerHTML = '';
    State.project.cables.forEach((c) => {
      const pts = cableRoute(c); if (!pts) return;
      const d = pointsToPath(pts);
      const grp = c.group ? State.group(c.group) : null;
      const g = e('g', { class: 'nd-cable-g' + (dimmed(c) ? ' nd-dim' : '') + (selectedIds.has(c.id) ? ' selected' : '') });
      g.appendChild(e('path', { class: 'nd-cable-hit', d }));
      if (grp && highlightGroupId === c.group) g.appendChild(e('path', { class: 'nd-cable-halo', d, stroke: grp.color }));
      g.appendChild(e('path', { class: `nd-cable status-${c.status}`, d, stroke: c.status === 'error' ? '#ef4444' : c.color }));
      const mid = pts[Math.floor(pts.length / 2)], std = cableStandard(c.standard);
      const lbl = e('text', { class: 'nd-cable-label', x: mid.x, y: mid.y - 5, 'text-anchor': 'middle' });
      lbl.textContent = `${std.name} · ${c.length} m · ${speedLabel(c.speed)}${c.label ? ' · ' + c.label : ''}`;
      g.appendChild(lbl);
      g.querySelector('.nd-cable-hit').addEventListener('click', (ev) => { ev.stopPropagation(); clickItem(c.id, ev.shiftKey); });
      gCables.appendChild(g);
    });
  }

  function renderDevices() {
    gDevices.innerHTML = '';
    const mode = State.project.meta.mode;
    State.project.devices.forEach((d) => {
      const W = boxWidth(d), cx = d.x + W / 2, cy = d.y + BOX_H / 2, r = d.rotation || 0;
      const grp = d.group ? State.group(d.group) : null;
      const g = e('g', { class: 'nd-device' + (selectedIds.has(d.id) ? ' selected' : '') + (dimmed(d) ? ' nd-dim' : '') + (grp && highlightGroupId === d.group ? ' nd-hl' : '') });
      g.dataset.id = d.id;

      const inner = e('g', { transform: `translate(${cx} ${cy}) rotate(${r})` });
      const box = e('rect', { class: 'nd-device-body', x: -W / 2, y: -BOX_H / 2, width: W, height: BOX_H, rx: 8 });
      if (grp && highlightGroupId === d.group) { box.setAttribute('stroke', grp.color); box.setAttribute('stroke-width', '3'); }
      else if (d.color) { box.setAttribute('stroke', d.color); box.setAttribute('stroke-width', '2.5'); }
      inner.appendChild(box);
      const sym = e('g', { transform: 'translate(0 -8)', class: 'text-slate-500 dark:text-slate-300', color: 'currentColor' }); sym.innerHTML = Symbols.render(d.icon, mode); inner.appendChild(sym);
      d.ports.forEach((p, i) => inner.appendChild(renderPort(d, p, i)));
      g.appendChild(inner);

      const halfY = (r % 180 === 0) ? BOX_H / 2 : W / 2, topY = cy - halfY - 8;
      const label = e('text', { class: 'nd-device-label', x: cx, y: topY, 'text-anchor': 'middle' }); label.textContent = d.props.hostname || d.model; g.appendChild(label);
      if (grp) { const dot = e('circle', { cx: cx - textW(label.textContent) / 2 - 7, cy: topY - 3, r: 3, fill: grp.color }); g.appendChild(dot); }
      if (d.props.ip4) { const s = e('text', { class: 'nd-device-sub', x: cx, y: topY + 11, 'text-anchor': 'middle' }); s.textContent = d.props.ip4; g.appendChild(s); }

      const poe = State.poeLoad(d.id);
      if (poe) { const b = e('text', { class: 'nd-poe-badge ' + (poe.over ? 'over' : 'ok'), x: cx, y: cy + halfY + 12, 'text-anchor': 'middle' }); b.textContent = `PoE ${poe.load}/${poe.budget} W${poe.over ? '  ⚠' : ''}`; g.appendChild(b); }

      enableDeviceInteract(g, d);
      gDevices.appendChild(g);
    });
  }
  function textW(s) { return (s || '').length * 6.5; }

  function renderPort(d, port, i) {
    const loc = portLocal(d, i), lx = loc.x, ly = loc.y;
    const used = State.isPortUsed(d.id, port.id), disabled = State.isPortDisabled(d.id, port.id), status = portStatus(d.id, port.id);
    const armed = wiring && wiring.deviceId === d.id && wiring.portId === port.id;
    const compatible = wiring && !armed && !used && !disabled;
    const g = e('g', { class: 'nd-port' + (armed ? ' armed' : '') + (compatible ? ' compatible' : '') + (disabled ? ' disabled' : '') });
    g.dataset.dev = d.id; g.dataset.port = port.id;
    g.appendChild(e('rect', { class: 'nd-port-body', x: lx - PS / 2, y: ly - PS / 2, width: PS, height: PS, rx: 2 }));
    g.appendChild(e('rect', { class: `nd-led nd-led-green ${status}`, x: lx - PS / 2 + 1.5, y: ly - PS / 2 + 1.5, width: 3, height: 3, rx: 0.5 }));
    g.appendChild(e('rect', { class: `nd-led nd-led-amber ${status}`, x: lx + PS / 2 - 4.5, y: ly - PS / 2 + 1.5, width: 3, height: 3, rx: 0.5 }));
    g.appendChild(e('circle', { class: 'nd-snap-dot', cx: lx, cy: ly, r: 2.4 }));
    const t = e('text', { class: 'nd-port-label', x: lx, y: ly - PS / 2 - 2 }); t.textContent = port.label; g.appendChild(t);
    if (status === 'warning') {
      const badge = e('g', { class: 'nd-warn-badge', transform: `translate(${lx + PS / 2}, ${ly - PS / 2})` });
      badge.appendChild(e('circle', { r: 4.5 })); const bt = e('text', { y: 3 }); bt.textContent = '!'; badge.appendChild(bt);
      badge.addEventListener('click', (ev) => { ev.stopPropagation(); showPortReason(d.id, port.id); });
      g.appendChild(badge);
    }
    g.appendChild(e('rect', { class: 'nd-port-hit', x: lx - PS / 2 - 4, y: ly - PS / 2 - 4, width: PS + 8, height: PS + 8 }));
    g.addEventListener('mousedown', (ev) => ev.stopPropagation());
    g.addEventListener('click', (ev) => { ev.stopPropagation(); onPortClick(d.id, port.id, ev.shiftKey); });
    return g;
  }

  function portStatus(deviceId, portId) {
    const cs = State.project.cables.filter((c) => (c.from.deviceId === deviceId && c.from.portId === portId) || (c.to.deviceId === deviceId && c.to.portId === portId));
    if (!cs.length) return 'idle';
    if (cs.some((c) => c.status === 'error')) return 'error';
    if (cs.some((c) => c.status === 'warning')) return 'warning';
    return 'ok';
  }
  function showPortReason(deviceId, portId) {
    const c = State.project.cables.find((x) => (x.from.deviceId === deviceId && x.from.portId === portId) || (x.to.deviceId === deviceId && x.to.portId === portId));
    if (c) UI.toast(State.cableReason(c), 'warn');
  }

  /* ------------------------------------------- Geräte-Interaktion */
  function enableDeviceInteract(g, d) {
    g.addEventListener('mousedown', (ev) => {
      if (ev.button !== 0 || ev.target.closest('.nd-port')) return;
      ev.preventDefault(); ev.stopPropagation();
      if (tool === 'group') { clickItem(d.id, true); return; }
      const startW = toWorld(ev.clientX, ev.clientY); const orig = { x: d.x, y: d.y }; let moved = false; hideCtxMenu();
      const move = (e2) => { const w = toWorld(e2.clientX, e2.clientY); const nx = snap(orig.x + (w.x - startW.x)), ny = snap(orig.y + (w.y - startW.y)); if (nx !== d.x || ny !== d.y) moved = true; State.moveDevice(d.id, nx, ny); renderCables(); renderDevices(); };
      const up = () => {
        document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up);
        if (moved) return;
        clickItem(d.id, ev.shiftKey);
        if (!ev.shiftKey && selectedIds.size === 1) showCtxMenu(d);
      };
      document.addEventListener('mousemove', move); document.addEventListener('mouseup', up);
    });
  }

  /* ------------------------------------------------- Auswahl */
  function clickItem(id, additive) {
    if (additive) { selectedIds.has(id) ? selectedIds.delete(id) : selectedIds.add(id); }
    else { selectedIds = new Set([id]); }
    emitSel();
  }
  function setSelection(ids) { selectedIds = new Set(ids); emitSel(); hideCtxMenu(); }
  function emitSel() { renderCables(); renderDevices(); Bus.emit('selection', [...selectedIds]); }
  function deleteSelected() {
    [...selectedIds].forEach((id) => { State.device(id) ? State.removeDevice(id) : State.removeCable(id); });
    setSelection([]);
  }

  /* ------------------------------------------------- Kontextmenü */
  function showCtxMenu(d) {
    const W = boxWidth(d), cx = d.x + W / 2, cy = d.y + BOX_H / 2, halfY = ((d.rotation || 0) % 180 === 0) ? BOX_H / 2 : W / 2;
    const top = worldToClient(cx, cy - halfY); ctxMenu.innerHTML = '';
    const mk = (icon, title, fn) => { const b = document.createElement('button'); b.className = 'nd-ctx-btn'; b.title = title; b.innerHTML = icon; b.addEventListener('click', (ev) => { ev.stopPropagation(); fn(); }); return b; };
    ctxMenu.append(
      mk(Icons.get('trash'), 'Löschen', () => { State.removeDevice(d.id); hideCtxMenu(); setSelection([]); }),
      mk(Icons.get('duplicate'), 'Duplizieren', () => { const nd = State.duplicateDevice(d.id); hideCtxMenu(); if (nd) setSelection([nd.id]); }),
      mk(Icons.get('rotate'), 'Rotieren 90°', () => { State.rotateDevice(d.id); showCtxMenu(d); }),
      mk(Icons.get('palette'), 'Farbe', () => colorPalette(d)),
    );
    const rect = wrap.getBoundingClientRect();
    ctxMenu.style.left = (top.x - rect.left) + 'px'; ctxMenu.style.top = (top.y - rect.top - 46) + 'px';
    ctxMenu.classList.remove('hidden');
  }
  function colorPalette(d) {
    ctxMenu.innerHTML = '';
    NETWORK_COLORS.concat([{ name: 'Keine', hex: null }]).forEach((c) => {
      const b = document.createElement('button'); b.className = 'nd-ctx-swatch'; b.title = c.name; b.style.background = c.hex || 'transparent'; if (!c.hex) b.textContent = '∅';
      b.addEventListener('click', (ev) => { ev.stopPropagation(); State.setDeviceColor(d.id, c.hex); hideCtxMenu(); });
      ctxMenu.appendChild(b);
    });
  }
  function hideCtxMenu() { if (ctxMenu) ctxMenu.classList.add('hidden'); }

  /* --------------------------------------------- Verkabelungs-Flow */
  function onPortClick(deviceId, portId, shift) {
    if (tool === 'group') { clickItem(deviceId, true); return; }
    const used = State.isPortUsed(deviceId, portId);
    if (!wiring) {
      if (used) { UI.toast('Port ist bereits belegt.', 'warn'); return; }
      wiring = { deviceId, portId, waypoints: [] }; svg.classList.add('is-wiring');
      UI.toast('Route legen: leere Fläche klicken = Zwischenstop · Ziel-Port klicken = fertig · Esc = abbrechen', 'info');
      renderDevices(); return;
    }
    if (wiring.deviceId === deviceId && wiring.portId === portId) { cancelWiring(); return; }
    if (used) { UI.toast('Ziel-Port ist bereits belegt.', 'warn'); return; }
    State.addCable({ deviceId: wiring.deviceId, portId: wiring.portId }, { deviceId, portId }, wiring.waypoints);
    cancelWiring();
  }

  function wiringBase() {
    const A = portWorld(wiring.deviceId, wiring.portId);
    const stubA = { x: snap(A.x + A.nx * STUB), y: snap(A.y + A.ny * STUB) };
    return { A, pts: [{ x: A.x, y: A.y }, stubA, ...wiring.waypoints] };
  }
  function addWaypointAt(clientX, clientY) {
    const w = toWorld(clientX, clientY); const { pts } = wiringBase();
    const last = pts[pts.length - 1];
    const np = align({ x: snap(w.x), y: snap(w.y) }, last);
    if (np.x === last.x && np.y === last.y) return;
    wiring.waypoints.push(np); onWireMoveXY(clientX, clientY);
  }
  function onWireMove(ev) { if (wiring) onWireMoveXY(ev.clientX, ev.clientY); }
  function onWireMoveXY(clientX, clientY) {
    const w = toWorld(clientX, clientY); const { pts } = wiringBase(); const last = pts[pts.length - 1];
    const snapT = nearestPort(w.x, w.y);
    let end;
    if (snapT) { const pw = portWorld(snapT.deviceId, snapT.portId); const stub = { x: snap(pw.x + pw.nx * STUB), y: snap(pw.y + pw.ny * STUB) }; end = [align(stub, last), stub, { x: pw.x, y: pw.y }]; }
    else { end = [align({ x: snap(w.x), y: snap(w.y) }, last)]; }
    const full = orthogonalize([...pts, ...end]);
    if (!ghost) { ghost = e('path', { class: 'nd-wire-ghost' }); gOverlay.appendChild(ghost); }
    ghost.setAttribute('d', pointsToPath(full));
  }
  function nearestPort(x, y) {
    let best = null, bd = 20 * 20;
    State.project.devices.forEach((d) => d.ports.forEach((p) => {
      if (d.id === wiring.deviceId && p.id === wiring.portId) return;
      if (State.isPortUsed(d.id, p.id) || State.isPortDisabled(d.id, p.id)) return;
      const w = portWorld(d.id, p.id), dd = (w.x - x) ** 2 + (w.y - y) ** 2;
      if (dd < bd) { bd = dd; best = { deviceId: d.id, portId: p.id }; }
    }));
    return best;
  }
  function cancelWiring() { wiring = null; svg.classList.remove('is-wiring'); if (ghost) { ghost.remove(); ghost = null; } renderDevices(); }

  /* ------------------------------------------------------- Werkzeuge */
  function setTool(t) {
    tool = t; if (t !== 'wire' && wiring) cancelWiring();
    svg.style.cursor = t === 'wire' ? 'crosshair' : 'grab';
    Bus.emit('tool', t);
  }

  /* --------------------------------------------------- Highlight */
  function setHighlight(groupId) { highlightGroupId = (highlightGroupId === groupId) ? null : groupId; render(); Bus.emit('highlight', highlightGroupId); }

  /* --------------------------------------------------------- Fit */
  function fitView() {
    const devs = State.project.devices; if (!devs.length) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    devs.forEach((d) => { const W = boxWidth(d); minX = Math.min(minX, d.x); minY = Math.min(minY, d.y - 20); maxX = Math.max(maxX, d.x + W); maxY = Math.max(maxY, d.y + BOX_H + 20); });
    const pad = 60, bw = maxX - minX + pad * 2, bh = maxY - minY + pad * 2;
    const W = wrap.clientWidth || 1200, H = wrap.clientHeight || 800;
    cam.zoom = Math.min(4, Math.max(0.2, Math.min(W / bw, H / bh)));
    cam.x = minX - pad - (W / cam.zoom - bw) / 2; cam.y = minY - pad - (H / cam.zoom - bh) / 2;
    applyView();
  }

  function flashDevice(id) {
    setSelection([id]);
    const d = State.device(id); if (!d) return;
    const W = boxWidth(d), cx = d.x + W / 2, cy = d.y + BOX_H / 2;
    cam.x = cx - (wrap.clientWidth / cam.zoom) / 2; cam.y = cy - (wrap.clientHeight / cam.zoom) / 2; applyView();
    const g = gDevices.querySelector(`[data-id="${id}"]`); if (g) { g.classList.add('jump-flash'); setTimeout(() => g.classList.remove('jump-flash'), 1200); }
  }

  /* ------------------------------------------------- Export-SVG */
  function buildStandaloneSVG(mode) {
    const devs = State.project.devices; if (!devs.length) return { svg: '', width: 0, height: 0 };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    devs.forEach((d) => { const W = boxWidth(d); minX = Math.min(minX, d.x - 20); minY = Math.min(minY, d.y - 30); maxX = Math.max(maxX, d.x + W + 20); maxY = Math.max(maxY, d.y + BOX_H + 40); });
    const pad = 30; minX -= pad; minY -= pad; maxX += pad; maxY += pad;
    const Wd = Math.round(maxX - minX), Hd = Math.round(maxY - minY);
    const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
    const out = [`<rect x="${minX}" y="${minY}" width="${Wd}" height="${Hd}" fill="${mode === 'professional' ? '#fff' : '#f8fafc'}"/>`];
    State.project.cables.forEach((c) => { const pts = cableRoute(c); if (!pts) return; out.push(`<path d="${pointsToPath(pts)}" fill="none" stroke="${c.status === 'error' ? '#ef4444' : c.color}" stroke-width="3" stroke-linejoin="round"/>`); });
    const symColor = mode === 'professional' ? '#334155' : '#000';
    devs.forEach((d) => {
      const W = boxWidth(d), cx = d.x + W / 2, cy = d.y + BOX_H / 2, r = d.rotation || 0, halfY = (r % 180 === 0) ? BOX_H / 2 : W / 2;
      out.push(`<text x="${cx}" y="${cy - halfY - 8}" text-anchor="middle" font-family="sans-serif" font-weight="600" font-size="12" fill="#334155">${esc(d.props.hostname || d.model)}</text>`);
      out.push(`<g transform="translate(${cx} ${cy}) rotate(${r})">`);
      out.push(`<rect x="${-W / 2}" y="${-BOX_H / 2}" width="${W}" height="${BOX_H}" rx="8" fill="#fff" stroke="${d.color || '#94a3b8'}" stroke-width="${d.color ? 2.5 : 1.5}"/>`);
      out.push(`<g transform="translate(0 -8)" color="${symColor}" fill="${mode === 'professional' ? 'none' : symColor}">${Symbols.render(d.icon, mode)}</g>`);
      d.ports.forEach((p, i) => { const loc = portLocal(d, i), st = portStatus(d.id, p.id), on = st === 'ok' || st === 'warning';
        out.push(`<rect x="${loc.x - PS / 2}" y="${loc.y - PS / 2}" width="${PS}" height="${PS}" rx="2" fill="#cbd5e1" stroke="#64748b"/>`);
        out.push(`<rect x="${loc.x - PS / 2 + 1.5}" y="${loc.y - PS / 2 + 1.5}" width="3" height="3" fill="#16a34a" opacity="${on ? 1 : .2}"/>`);
        out.push(`<rect x="${loc.x + PS / 2 - 4.5}" y="${loc.y - PS / 2 + 1.5}" width="3" height="3" fill="#f59e0b" opacity="${on ? 1 : .2}"/>`);
        out.push(`<circle cx="${loc.x}" cy="${loc.y}" r="2.2" fill="#eab308"/>`);
        if (st === 'warning') out.push(`<g transform="translate(${loc.x + PS / 2} ${loc.y - PS / 2})"><circle r="4.5" fill="#dc2626"/><text y="3" text-anchor="middle" font-family="sans-serif" font-weight="700" font-size="8" fill="#fff">!</text></g>`);
      });
      out.push('</g>');
    });
    return { svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${Wd}" height="${Hd}" viewBox="${minX} ${minY} ${Wd} ${Hd}">${out.join('')}</svg>`, width: Wd, height: Hd };
  }

  return {
    init, render, setTool, get tool() { return tool; }, setHighlight, get highlightGroupId() { return highlightGroupId; },
    fitView, flashDevice, deleteSelected, buildStandaloneSVG, setSelection,
    get selectedId() { return selectedIds.size === 1 ? [...selectedIds][0] : null; },
    get selectedIds() { return [...selectedIds]; },
  };
})();
