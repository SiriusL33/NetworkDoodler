/* =========================================================================
   properties.js – Eigenschaften-Sidebar mit strikter Eingabe-Validierung
   -------------------------------------------------------------------------
   - Oeffnet sich bei Auswahl eines Geraets.
   - Strikte Masken: IPv4 (0-255, Auto-Jump), IPv6 (Hex, Auto-Jump), MAC (Hex).
   - Sensible Daten (SSID/Passwort) erfordern ein bestaetigendes Security-Modal.
   ========================================================================= */

const Properties = (() => {
  const el = UI.el;
  let host;
  let sensitiveUnlocked = false;  // pro Session: Warnung akzeptiert?

  function mount(container) {
    host = container;
    Bus.on('selection', (ids) => onSelection(ids));
    Bus.on('state', () => onSelection(Canvas.selectedIds));
    onSelection([]);
  }

  // Dispatch je nach Auswahl: leer / 1 Gerät / 1 Kabel / mehrere.
  function onSelection(ids) {
    host.innerHTML = '';
    ids = ids || [];
    if (ids.length === 0) {
      host.appendChild(el('div.p-4.text-sm.text-slate-400', { text: 'Nichts ausgewählt. Asset auf das Canvas ziehen, oder Gerät/Kabel anklicken. Shift-Klick für Mehrfachauswahl.' }));
      return;
    }
    if (ids.length === 1) {
      const dev = State.device(ids[0]);
      if (dev) return renderDevice(dev);
      const cbl = State.cable(ids[0]);
      if (cbl) return renderCable(cbl);
    }
    renderMulti(ids);
  }

  function renderMulti(ids) {
    const devs = ids.filter((id) => State.device(id)).length, cbls = ids.length - devs;
    host.appendChild(el('div.p-4.space-y-3', {}, [
      el('div.font-semibold', { text: `${ids.length} Elemente ausgewählt` }),
      el('div.text-sm.text-slate-500', { text: `${devs} Gerät(e), ${cbls} Kabel` }),
      el('button.w-full.px-3.py-2.rounded-lg.bg-indigo-600.text-white.text-sm.font-medium', { text: '＋ Gruppe aus Auswahl', onclick: () => { const g = State.createGroup(ids, null, null); UI.toast('Gruppe „' + g.name + '" erstellt.', 'ok'); } }),
      el('button.w-full.px-3.py-2.rounded-lg.bg-red-100.text-red-700.dark\\:bg-red-900\\/40.dark\\:text-red-300.text-sm', { text: 'Auswahl löschen', onclick: () => Canvas.deleteSelected() }),
    ]));
  }

  // -------------------------------------------------------- Kabel-Details
  function renderCable(c) {
    const std = cableStandard(c.standard);
    host.appendChild(el('div.px-4.py-3.border-b.border-slate-200.dark\\:border-slate-700', {}, [
      el('div.text-xs.uppercase.tracking-wide.text-slate-400', { text: 'Verbindung' }),
      el('div.font-semibold', { text: `${std.name} · ${speedLabel(c.speed)}` }),
    ]));
    const body = el('div.p-4.space-y-3');
    const a = State.device(c.from.deviceId), b = State.device(c.to.deviceId);
    body.appendChild(el('div.text-sm', { html: `${UI.escapeHtml(a?.props.hostname || a?.model || '?')} → ${UI.escapeHtml(b?.props.hostname || b?.model || '?')}` }));
    const reason = State.cableReason(c);
    body.appendChild(el('div.text-xs.px-2.py-1.rounded', { class: c.status === 'ok' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700' : c.status === 'warning' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700' : 'bg-red-100 dark:bg-red-900/30 text-red-700', text: reason }));

    body.appendChild(selectField('Standard', CABLE_STANDARDS.map((s) => [s.id, s.name]), c.standard, (v) => State.updateCable(c.id, { standard: v })));
    body.appendChild(numField('Länge (m)', c.length, (v) => State.updateCable(c.id, { length: v })));
    body.appendChild(textFieldRaw('Flag / Bezeichnung', c.label, (v) => State.updateCable(c.id, { label: v })));
    const colWrap = el('div'); colWrap.appendChild(el('label.block.text-xs.font-medium.mb-1', { text: 'Farbe' }));
    const cr = el('div.flex.flex-wrap.gap-2');
    NETWORK_COLORS.forEach((col) => cr.appendChild(el('button', { class: 'w-6 h-6 rounded-full border-2', style: `background:${col.hex};border-color:${c.color === col.hex ? '#6366f1' : 'transparent'}`, title: col.name, onclick: () => State.updateCable(c.id, { color: col.hex }) })));
    colWrap.appendChild(cr); body.appendChild(colWrap);
    if (c.waypoints && c.waypoints.length) body.appendChild(el('button.text-xs.text-indigo-600', { text: `Zwischenstops zurücksetzen (${c.waypoints.length})`, onclick: () => State.updateCable(c.id, { waypoints: [] }) }));
    host.appendChild(body);
    host.appendChild(el('div.px-4.py-3.border-t.border-slate-200.dark\\:border-slate-700', {}, [
      el('button.w-full.px-3.py-2.rounded-lg.bg-red-100.text-red-700.dark\\:bg-red-900\\/40.dark\\:text-red-300.text-sm.font-medium', { text: 'Kabel löschen', onclick: () => { State.removeCable(c.id); Canvas.setSelection([]); } }),
    ]));
  }

  function selectField(label, opts, value, onChange) {
    const w = el('div'); w.appendChild(el('label.block.text-xs.font-medium.mb-1', { text: label }));
    const sel = el('select.w-full.rounded-lg.border.border-slate-300.dark\\:border-slate-600.bg-transparent.px-3.py-2.text-sm', { onchange: (e) => onChange(e.target.value) });
    opts.forEach(([v, l]) => { const o = el('option', { value: v, text: l }); if (v === value) o.selected = true; sel.appendChild(o); });
    w.appendChild(sel); return w;
  }
  function numField(label, value, onChange) {
    const w = el('div'); w.appendChild(el('label.block.text-xs.font-medium.mb-1', { text: label }));
    w.appendChild(el('input', { type: 'number', step: '0.01', min: '0', value, class: 'w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm', onchange: (e) => onChange(parseFloat(e.target.value) || 0) }));
    return w;
  }
  function textFieldRaw(label, value, onChange) {
    const w = el('div'); w.appendChild(el('label.block.text-xs.font-medium.mb-1', { text: label }));
    w.appendChild(el('input', { value: value || '', class: 'w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm', onchange: (e) => onChange(e.target.value) }));
    return w;
  }

  // -------------------------------------------------------- Geräte-Details
  function renderDevice(dev) {

    host.appendChild(el('div.px-4.py-3.border-b.border-slate-200.dark\\:border-slate-700', {}, [
      el('div.text-xs.uppercase.tracking-wide.text-slate-400', { text: dev.category || 'Gerät' }),
      el('div.font-semibold', { text: dev.model }),
    ]));

    const form = el('div.p-4.space-y-3.overflow-y-auto.nd-scroll', { style: 'max-height: calc(100% - 110px)' });

    form.appendChild(textField('Hostname', dev.props.hostname, (v) => State.updateDeviceProps(dev.id, { hostname: v }), 'z. B. core-switch'));
    form.appendChild(maskField('IPv4-Adresse', dev.props.ip4, 'ipv4', (v) => State.updateDeviceProps(dev.id, { ip4: v })));
    form.appendChild(maskField('IPv6-Adresse', dev.props.ip6, 'ipv6', (v) => State.updateDeviceProps(dev.id, { ip6: v })));
    form.appendChild(maskField('MAC-Adresse', dev.props.mac, 'mac', (v) => State.updateDeviceProps(dev.id, { mac: v })));

    // Sensible Daten (SSID / Passwort) hinter Security-Gate.
    form.appendChild(sensitiveSection(dev));

    form.appendChild(textField('Notiz', dev.props.note, (v) => State.updateDeviceProps(dev.id, { note: v }), ''));

    // Port-Uebersicht
    form.appendChild(portsOverview(dev));

    host.appendChild(form);
    host.appendChild(el('div.px-4.py-3.border-t.border-slate-200.dark\\:border-slate-700', {}, [
      el('button.w-full.px-3.py-2.rounded-lg.bg-red-100.text-red-700.dark\\:bg-red-900\\/40.dark\\:text-red-300.text-sm.font-medium', {
        text: 'Gerät löschen', onclick: () => { if (confirm(`„${dev.props.hostname || dev.model}" löschen?`)) Canvas.deleteSelected(); },
      }),
    ]));
  }

  /* --------------------------------------------------------- Felder */
  function textField(label, value, onChange, placeholder) {
    const wrap = el('div');
    wrap.appendChild(el('label.block.text-xs.font-medium.mb-1', { text: label }));
    wrap.appendChild(el('input', {
      value: value || '', placeholder: placeholder || '',
      class: 'w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm',
      onchange: (e) => onChange(e.target.value),
    }));
    return wrap;
  }

  // Feld mit strikter Maske + Live-Validierungs-Status.
  function maskField(label, value, kind, onChange) {
    const wrap = el('div');
    wrap.appendChild(el('label.block.text-xs.font-medium.mb-1', { text: label }));
    const input = el('input', {
      value: value || '',
      class: 'w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm font-mono',
      spellcheck: 'false', autocomplete: 'off',
      placeholder: PLACEHOLDER[kind],
    });
    const hint = el('div.text-xs.mt-1.h-4');
    Masks.attach(input, kind, (valid, val) => {
      hint.textContent = val ? (valid ? '✓ gültig' : '✗ unvollständig / ungültig') : '';
      hint.className = 'text-xs mt-1 h-4 ' + (val ? (valid ? 'text-emerald-500' : 'text-red-500') : '');
      if (valid || !val) onChange(val);
    });
    wrap.append(input, hint);
    return wrap;
  }

  const PLACEHOLDER = { ipv4: '192.168.178.1', ipv6: '2001:db8::1', mac: 'AA:BB:CC:DD:EE:FF' };

  /* ----------------------------------------------- Sensible Daten */
  function sensitiveSection(dev) {
    const wrap = el('div.rounded-lg.border.border-amber-300.dark\\:border-amber-700\\/50.bg-amber-50.dark\\:bg-amber-900\\/20.p-3');
    wrap.appendChild(el('div.text-xs.font-semibold.text-amber-700.dark\\:text-amber-400.mb-2', { text: '🔒 Sensible Daten (SSID / Passwort)' }));

    if (!sensitiveUnlocked && !(dev.props.ssid || dev.props.password)) {
      wrap.appendChild(el('button.text-xs.px-3.py-1.5.rounded.bg-amber-500.text-white', {
        text: 'Freischalten …', onclick: () => confirmSensitive(() => renderDevice(State.device(dev.id))),
      }));
      return wrap;
    }
    wrap.appendChild(textField('SSID', dev.props.ssid, (v) => State.updateDeviceProps(dev.id, { ssid: v }), 'MeinWLAN'));
    const pw = el('div.mt-2');
    pw.appendChild(el('label.block.text-xs.font-medium.mb-1', { text: 'Passwort (Klartext!)' }));
    pw.appendChild(el('input', {
      value: dev.props.password || '', type: 'text',
      class: 'w-full rounded-lg border border-amber-300 dark:border-amber-700 bg-transparent px-3 py-2 text-sm font-mono',
      onchange: (e) => State.updateDeviceProps(dev.id, { password: e.target.value }),
    }));
    wrap.appendChild(pw);
    wrap.appendChild(el('div.text-xs.text-amber-700.dark\\:text-amber-400.mt-2', { text: '⚠ Wird bei Exporten im Klartext ausgegeben.' }));
    return wrap;
  }

  // Pflicht-Warnmodal, bevor sensible Daten sichtbar/bearbeitbar werden.
  function confirmSensitive(onOk) {
    UI.modal({
      title: '⚠ Sicherheitsrisiko',
      body: (n) => {
        n.appendChild(el('p.text-sm.mb-2', { text: 'SSID und Passwörter werden unverschlüsselt im Projekt gespeichert und bei jedem Export im Klartext ausgegeben.' }));
        n.appendChild(el('p.text-sm.text-slate-500', { text: 'Nur fortfahren, wenn dir das bewusst ist.' }));
      },
      actions: [
        { label: 'Abbrechen' },
        { label: 'Verstanden, freischalten', danger: true, onClick: () => { sensitiveUnlocked = true; onOk(); } },
      ],
    });
  }

  /* ----------------------------------------------- Port-Uebersicht */
  function portsOverview(dev) {
    const wrap = el('div');

    // Geräte-Infos (Verbrauch / PoE)
    const info = [];
    if (dev.power) info.push(`${dev.power} W`);
    const poe = State.poeLoad(dev.id);
    if (poe) info.push(`PoE ${poe.load}/${poe.budget} W${poe.over ? ' ⚠ Überlast!' : ''}`);
    else if (dev.poeDraw) info.push(`PoE-Bezug ${dev.poeDraw} W`);
    if (info.length) {
      wrap.appendChild(el('div.text-xs.mb-2.px-2.py-1.rounded.bg-slate-100.dark\\:bg-slate-700\\/50', {
        class: poe && poe.over ? 'text-red-600 font-semibold' : 'text-slate-500', text: info.join('  ·  '),
      }));
    }

    wrap.appendChild(el('div.text-xs.font-semibold.mb-1.mt-1', { text: `Ports (${dev.ports.length})` }));
    const grid = el('div.grid.grid-cols-2.gap-1');
    dev.ports.forEach((p) => {
      const used = State.isPortUsed(dev.id, p.id);
      const disabled = State.isPortDisabled(dev.id, p.id);
      const flags = (p.poe ? ' ⚡' : '') + (p.autosense ? ' ⇄' : '') + (p.exGroup ? ' ⛓' : '');
      grid.appendChild(el('div.text-xs.px-2.py-1.rounded.flex.justify-between', {
        class: disabled ? 'bg-slate-100 dark:bg-slate-700/30 opacity-50 line-through' : used ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-slate-100 dark:bg-slate-700/50',
      }, [
        el('span.font-mono', { text: p.label + flags }),
        el('span.text-slate-500', { text: `${p.type.toUpperCase()} ${speedLabel(p.speed)}` }),
      ]));
    });
    wrap.appendChild(grid);
    wrap.appendChild(el('div.text-\\[10px\\].text-slate-400.mt-1', { text: '⚡ PoE  ⇄ Auto-Sensing  ⛓ Combo (exklusiv)' }));
    return wrap;
  }

  return { mount };
})();

/* =========================================================================
   Masks – Strikte Eingabemasken mit Auto-Jump
   ========================================================================= */
const Masks = (() => {

  function attach(input, kind, onState) {
    const handler = {
      ipv4: ipv4Handler, ipv6: ipv6Handler, mac: macHandler,
    }[kind];
    input.addEventListener('input', () => {
      const res = handler(input);
      onState(res.valid, input.value);
    });
    input.addEventListener('blur', () => onState(handler(input).valid, input.value));
  }

  // IPv4: nur Ziffern & Punkte, Oktette 0-255, Auto-Punkt nach 3 Ziffern.
  function ipv4Handler(input) {
    let v = input.value.replace(/[^\d.]/g, '');
    const parts = v.split('.').slice(0, 4).map((p) => p.slice(0, 3));
    // Oktett-Grenze respektieren.
    const clamped = parts.map((p) => (p === '' ? '' : String(Math.min(255, parseInt(p, 10)))));
    // Auto-Jump: volles (dreistelliges) Oktett -> Punkt anhaengen.
    let out = clamped.join('.');
    const last = clamped[clamped.length - 1];
    if (clamped.length < 4 && last && last.length === 3) out += '.';
    input.value = out;
    const valid = /^(\d{1,3}\.){3}\d{1,3}$/.test(out) && out.split('.').every((n) => +n >= 0 && +n <= 255);
    return { valid };
  }

  // IPv6: Hex & Doppelpunkte, Auto-Doppelpunkt nach 4 Hex-Zeichen.
  function ipv6Handler(input) {
    let v = input.value.replace(/[^0-9a-fA-F:]/g, '');
    const groups = v.split(':');
    const last = groups[groups.length - 1];
    if (last.length > 4) {
      groups[groups.length - 1] = last.slice(0, 4);
      groups.push(last.slice(4));
    }
    let out = groups.slice(0, 8).join(':');
    // Auto-Jump nach vollem 4er-Block (ausser Ende).
    const tail = out.split(':').pop();
    if (tail.length === 4 && out.split(':').length < 8 && !out.endsWith('::')) out += ':';
    input.value = out;
    const valid = isValidIPv6(input.value);
    return { valid };
  }

  function isValidIPv6(s) {
    if (!s) return false;
    // Erlaubt Kurzform mit "::" (einmal).
    const dc = (s.match(/::/g) || []).length;
    if (dc > 1) return false;
    const parts = s.split(':').filter((p, i, a) => !(p === '' && (i === 0 || i === a.length - 1) && dc));
    return s.split(':').every((p) => p === '' || /^[0-9a-fA-F]{1,4}$/.test(p)) && (dc === 1 || s.split(':').length === 8);
  }

  // MAC: Hex, Auto-Doppelpunkt nach je 2 Zeichen, max 6 Oktette.
  function macHandler(input) {
    let hex = input.value.replace(/[^0-9a-fA-F]/g, '').toUpperCase().slice(0, 12);
    const out = hex.match(/.{1,2}/g)?.join(':') || '';
    input.value = out;
    const valid = /^([0-9A-F]{2}:){5}[0-9A-F]{2}$/.test(out);
    return { valid };
  }

  return { attach };
})();
