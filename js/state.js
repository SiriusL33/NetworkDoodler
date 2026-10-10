/* =========================================================================
   state.js – Zentraler JSON-State + lokale Persistenz + Debug-Engine
   -------------------------------------------------------------------------
   DB    – Assets & Kabel-Presets, DAUERHAFT in localStorage.
   State – Aktuelles Projekt (fluechtig, Zero-Trust).
   Das UI ist eine reine Projektion des States (Bus.emit('state')).
   ========================================================================= */

const Bus = (() => {
  const map = {};
  return { on(e, f) { (map[e] ||= []).push(f); }, emit(e, d) { (map[e] || []).forEach((f) => f(d)); } };
})();

function uid(p = 'id') { return p + '-' + Math.random().toString(36).slice(2, 9); }
function deepClone(o) { return JSON.parse(JSON.stringify(o)); }

/* =============================================================== DB */
const DB = (() => {
  const KEY = 'nd-database-v2';
  let data = { assets: [], cablePresets: [] };

  function load() {
    try { const raw = localStorage.getItem(KEY); if (raw) { data = JSON.parse(raw); return; } }
    catch (e) { console.warn('DB laden:', e); }
    data = { assets: deepClone(DEFAULT_ASSETS), cablePresets: deepClone(DEFAULT_CABLE_PRESETS) };
    save();
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { console.warn('DB speichern:', e); }
    Bus.emit('db');
  }
  return {
    init: load,
    get assets() { return data.assets; },
    get cablePresets() { return data.cablePresets; },
    asset(id) { return data.assets.find((a) => a.id === id); },
    preset(id) { return data.cablePresets.find((p) => p.id === id); },
    assetsByCategory(cat) { return data.assets.filter((a) => a.category === cat); },
    upsertAsset(a) { const i = data.assets.findIndex((x) => x.id === a.id); i >= 0 ? data.assets[i] = a : data.assets.push(a); save(); },
    removeAsset(id) { data.assets = data.assets.filter((a) => a.id !== id); save(); },
    upsertPreset(p) { const i = data.cablePresets.findIndex((x) => x.id === p.id); i >= 0 ? data.cablePresets[i] = p : data.cablePresets.push(p); save(); },
    removePreset(id) { data.cablePresets = data.cablePresets.filter((p) => p.id !== id); save(); },
    resetDefaults() { data = { assets: deepClone(DEFAULT_ASSETS), cablePresets: deepClone(DEFAULT_CABLE_PRESETS) }; save(); },
  };
})();

/* ============================================================ State */
const State = (() => {
  let project = null;
  let dirty = false;

  // Aktives "Base-Kabel" fuer die naechste Verkabelung (Top-Nav Kabel-Menue).
  let activeCable = { standard: 'cat6', color: '#3b82f6', length: 1, label: '' };

  function emit() { dirty = true; Bus.emit('state', project); }

  function blank(name = 'Unbenanntes Projekt') {
    project = { meta: { name, mode: 'design', created: new Date().toISOString() }, devices: [], cables: [], groups: [] };
    dirty = false; Bus.emit('state', project); return project;
  }
  function loadFrom(json) {
    if (!json || !Array.isArray(json.devices) || !Array.isArray(json.cables)) throw new Error('Ungültige Projektdatei.');
    project = {
      meta: Object.assign({ name: 'Import', mode: 'design', created: new Date().toISOString() }, json.meta || {}),
      devices: json.devices, cables: json.cables, groups: json.groups || [],
    };
    project.devices.forEach((d) => { d.rotation ||= 0; d.group = d.group || null; });
    project.cables.forEach((c) => { c.waypoints = c.waypoints || []; c.group = c.group || null; });
    dirty = false; Bus.emit('state', project); return project;
  }

  /* ------------------------------------------------------- Geraete */
  function expandPorts(asset) {
    const ports = [];
    asset.ports.forEach((g) => {
      for (let i = 1; i <= g.count; i++) {
        ports.push({
          id: uid('port'),
          label: g.count > 1 ? `${g.label}${i}` : g.label,
          type: g.type, speed: g.speed,
          poe: !!g.poe, autosense: !!g.autosense,
          exGroup: g.exGroup || null,
          media: g.media || null,
        });
      }
    });
    return ports;
  }

  function addDevice(assetId, x, y) {
    const asset = DB.asset(assetId);
    if (!asset) return null;
    const d = {
      id: uid('dev'), assetId, model: asset.model, icon: asset.icon, category: asset.category,
      x, y, rotation: 0, color: null, group: null,
      poeBudget: asset.poeBudget || 0, poeDraw: asset.poeDraw || 0, power: asset.power || 0,
      props: { hostname: '', ip4: '', ip6: '', mac: '', ssid: '', password: '', note: '' },
      ports: expandPorts(asset),
    };
    project.devices.push(d); emit(); return d;
  }

  function duplicateDevice(id) {
    const src = device(id); if (!src) return null;
    const d = deepClone(src);
    d.id = uid('dev'); d.x += 40; d.y += 40;
    d.ports.forEach((p) => { p.id = uid('port'); });
    project.devices.push(d); emit(); return d;
  }
  function rotateDevice(id) { const d = device(id); if (d) { d.rotation = ((d.rotation || 0) + 90) % 360; emit(); } }
  function setDeviceColor(id, c) { const d = device(id); if (d) { d.color = c; emit(); } }
  function moveDevice(id, x, y) { const d = device(id); if (d) { d.x = x; d.y = y; Bus.emit('state', project); dirty = true; } }
  function removeDevice(id) {
    project.cables = project.cables.filter((c) => c.from.deviceId !== id && c.to.deviceId !== id);
    project.devices = project.devices.filter((d) => d.id !== id); emit();
  }
  function updateDeviceProps(id, props) { const d = device(id); if (d) { Object.assign(d.props, props); emit(); } }

  /* --------------------------------------------------------- Kabel */
  function addCable(from, to, waypoints = []) {
    const std = cableStandard(activeCable.standard);
    const cable = {
      id: uid('cbl'),
      standard: activeCable.standard, medium: std.medium,
      color: activeCable.color, length: activeCable.length, label: activeCable.label || '',
      waypoints: waypoints.map((p) => ({ x: p.x, y: p.y })), group: null,
      from: { deviceId: from.deviceId, portId: from.portId },
      to: { deviceId: to.deviceId, portId: to.portId },
    };
    cable.speed = effectiveSpeed(cable);
    cable.status = evaluateCable(cable);
    project.cables.push(cable); emit(); return cable;
  }
  function removeCable(id) { project.cables = project.cables.filter((c) => c.id !== id); emit(); }
  function updateCable(id, patch) {
    const c = project.cables.find((x) => x.id === id); if (!c) return;
    Object.assign(c, patch);
    if (patch.standard) c.medium = cableStandard(patch.standard).medium;
    c.speed = effectiveSpeed(c); c.status = evaluateCable(c); emit();
  }
  function cable(id) { return project.cables.find((c) => c.id === id); }

  /* --------------------------------------------------------- Gruppen */
  function createGroup(memberIds, name, color) {
    const g = { id: uid('grp'), name: name || ('Gruppe ' + (project.groups.length + 1)), color: color || '#6366f1' };
    project.groups.push(g);
    assignToGroup(memberIds, g.id); emit(); return g;
  }
  function assignToGroup(memberIds, groupId) {
    memberIds.forEach((id) => {
      const d = device(id); if (d) { d.group = groupId; return; }
      const c = cable(id); if (c) c.group = groupId;
    });
    emit();
  }
  function removeFromGroup(memberIds) { assignToGroup(memberIds, null); }
  function updateGroup(id, patch) { const g = project.groups.find((x) => x.id === id); if (g) { Object.assign(g, patch); emit(); } }
  function dissolveGroup(id) {
    project.devices.forEach((d) => { if (d.group === id) d.group = null; });
    project.cables.forEach((c) => { if (c.group === id) c.group = null; });
    project.groups = project.groups.filter((g) => g.id !== id); emit();
  }
  function group(id) { return project.groups.find((g) => g.id === id); }
  function groupMembers(id) {
    return [...project.devices.filter((d) => d.group === id).map((d) => d.id),
            ...project.cables.filter((c) => c.group === id).map((c) => c.id)];
  }

  /* ------------------------------------------------- Debug-Engine */
  function acceptsMedium(port, medium) {
    if (port.type === 'combo') return (port.media || ['copper', 'fiber']).includes(medium);
    return portMedium(port.type) === medium;
  }
  function effectiveSpeed(cable) {
    const pf = portOf(cable.from), pt = portOf(cable.to);
    const std = cableStandard(cable.standard);
    if (!pf || !pt) return 0;
    return Math.min(pf.speed, pt.speed, std.maxSpeed);
  }
  function evaluateCable(cable) {
    const pf = portOf(cable.from), pt = portOf(cable.to);
    if (!pf || !pt) return 'error';
    // Medien-Kompatibilitaet: Kabel-Medium muss zu beiden Ports passen.
    if (!acceptsMedium(pf, cable.medium) || !acceptsMedium(pt, cable.medium)) return 'error';
    const link = effectiveSpeed(cable);
    const best = Math.min(pf.speed, pt.speed);
    if (link < best) return 'warning';        // Kabelstandard bremst
    if (pf.speed !== pt.speed) return 'warning'; // Port-Speed-Mismatch
    return 'ok';
  }
  function cableReason(cable) {
    const pf = portOf(cable.from), pt = portOf(cable.to);
    if (!pf || !pt) return 'Verbindung unvollständig.';
    if (!acceptsMedium(pf, cable.medium) || !acceptsMedium(pt, cable.medium)) {
      return `Inkompatibles Medium: Kabel ist ${cable.medium}, Ports ${pf.type.toUpperCase()}/${pt.type.toUpperCase()} (Broken Lane).`;
    }
    const link = effectiveSpeed(cable), best = Math.min(pf.speed, pt.speed);
    if (link < best) return `Kabel/Standard bremst: Link ${speedLabel(link)}, Geräte könnten ${speedLabel(best)}.`;
    if (pf.speed !== pt.speed) return `Port-Mismatch: ${speedLabel(pf.speed)} ↔ ${speedLabel(pt.speed)} – Link ${speedLabel(link)}.`;
    return 'Verbindung optimal.';
  }
  function recomputeAll() { project.cables.forEach((c) => { c.speed = effectiveSpeed(c); c.status = evaluateCable(c); }); }

  /* --------------------------------------------------- PoE-Budget
     Summiert den Verbrauch aller Geräte, die an PoE-Ports dieses
     Switches haengen, und vergleicht mit dem Budget.               */
  function poeLoad(switchId) {
    const sw = device(switchId);
    if (!sw || !sw.poeBudget) return null;
    let load = 0;
    project.cables.forEach((c) => {
      let localPort = null, otherRef = null;
      if (c.from.deviceId === switchId) { localPort = portOf(c.from); otherRef = c.to; }
      else if (c.to.deviceId === switchId) { localPort = portOf(c.to); otherRef = c.from; }
      if (localPort && localPort.poe) {
        const other = device(otherRef.deviceId);
        if (other && other.poeDraw) load += other.poeDraw;
      }
    });
    return { load, budget: sw.poeBudget, over: load > sw.poeBudget };
  }

  /* ------------------------------------------------------ Helpers */
  function device(id) { return project?.devices.find((d) => d.id === id); }
  function portOf(ref) { return device(ref.deviceId)?.ports.find((p) => p.id === ref.portId) || null; }
  function isPortUsed(deviceId, portId) {
    return project.cables.some((c) =>
      (c.from.deviceId === deviceId && c.from.portId === portId) ||
      (c.to.deviceId === deviceId && c.to.portId === portId));
  }
  // Combo/Uplink-Exklusivitaet: belegter exGroup-Bruder sperrt den Port.
  function isPortDisabled(deviceId, portId) {
    const d = device(deviceId); if (!d) return false;
    const port = d.ports.find((p) => p.id === portId);
    if (!port || !port.exGroup) return false;
    return d.ports.some((p) => p.id !== portId && p.exGroup === port.exGroup && isPortUsed(deviceId, p.id));
  }

  return {
    blank, loadFrom,
    get project() { return project; },
    get isDirty() { return dirty; },
    markClean() { dirty = false; },
    setMode(m) { project.meta.mode = m; Bus.emit('state', project); },
    setName(n) { project.meta.name = n; dirty = true; },

    get activeCable() { return activeCable; },
    setActiveCable(patch) { Object.assign(activeCable, patch); Bus.emit('activecable', activeCable); },

    addDevice, duplicateDevice, rotateDevice, setDeviceColor, moveDevice, removeDevice, updateDeviceProps,
    addCable, removeCable, updateCable, cable,
    device, portOf, isPortUsed, isPortDisabled,
    evaluateCable, cableReason, recomputeAll, poeLoad,
    get groups() { return project ? project.groups : []; },
    createGroup, assignToGroup, removeFromGroup, updateGroup, dissolveGroup, group, groupMembers,
  };
})();
