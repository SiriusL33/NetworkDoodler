/* =========================================================================
   data.js – Asset-Datenbank & Kabel-System (Auslieferungszustand)
   -------------------------------------------------------------------------
   Reale, in Deutschland gängige Netzwerkprodukte (2024–2026) mit exakten
   physischen Schnittstellen. Quellen: systematische Spezifikationsdatenbank
   (AVM FRITZ!, TP-Link, Raspberry Pi, Smart-Home/IoT).

   Port-Modell (Mbit/s):
     type:    'rj45'  Kupfer LAN/WAN
              'wan'    dedizierter Kupfer-WAN/Uplink
              'sfp'    SFP-Käfig (1G/2.5G Glas/DAC)
              'sfpplus'SFP+ (10G Glas/DAC)
              'combo'  physischer Slot RJ45 ODER SFP+ (gegenseitig exklusiv)
              'coax'   Kabelanschluss (DOCSIS)
              'dsl'    DSL/TAE (RJ11)
     count:   Anzahl identischer Ports
     poe:     true  -> Port kann Strom liefern (Switch/Injektor)
     autosense: true -> WAN/LAN wird automatisch erkannt (Mesh)
     exGroup: Ports mit gleichem Wert sind gegenseitig exklusiv (Combo-Uplink)
   Geräte-Felder: poeBudget (W, Switch) · poeDraw (W, Verbraucher) · wifi · power
   ========================================================================= */

/* ---------------------------------------------------------- Kategorien */
const ASSET_CATEGORIES = [
  { id: 'router',   label: 'Router' },
  { id: 'switch',   label: 'Switches (Kupfer & SFP)' },
  { id: 'server',   label: 'Server & Nodes' },
  { id: 'endpoint', label: 'Endgeräte (Workstations, RasPi, …)' },
  { id: 'ap',       label: 'Verstärker / Access Points' },
  { id: 'iot',      label: 'Smart-Home / IoT-Bridges' },
];

/* ------------------------------------------------------- Kabel-System */
// medium: copper | fiber | coax  ·  maxSpeed in Mbit/s
const CABLE_STANDARDS = [
  { id: 'cat5e',  name: 'Cat5e',    medium: 'copper', maxSpeed: 1000 },
  { id: 'cat6',   name: 'Cat6',     medium: 'copper', maxSpeed: 10000 },
  { id: 'cat6a',  name: 'Cat6a',    medium: 'copper', maxSpeed: 10000 },
  { id: 'cat7',   name: 'Cat7',     medium: 'copper', maxSpeed: 10000 },
  { id: 'cat7a',  name: 'Cat7A',    medium: 'copper', maxSpeed: 10000 },
  { id: 'cat8',   name: 'Cat8',     medium: 'copper', maxSpeed: 25000 },
  { id: 'dac',    name: 'SFP+ DAC', medium: 'fiber',  maxSpeed: 10000 },
  { id: 'lwl',    name: 'LWL (Glasfaser)', medium: 'fiber', maxSpeed: 10000 },
  { id: 'coax',   name: 'Koax (DOCSIS)',   medium: 'coax',  maxSpeed: 10000 },
];

const NETWORK_COLORS = [
  { name: 'Grau',    hex: '#94a3b8' },
  { name: 'Blau',    hex: '#3b82f6' },
  { name: 'Gelb',    hex: '#eab308' },
  { name: 'Rot',     hex: '#ef4444' },
  { name: 'Grün',    hex: '#22c55e' },
  { name: 'Schwarz', hex: '#0f172a' },
  { name: 'Weiß',    hex: '#e2e8f0' },
  { name: 'Orange',  hex: '#f97316' },
  { name: 'Violett', hex: '#8b5cf6' },
];

const CABLE_LENGTHS = [0.25, 0.5, 0.75, 1, 2, 3, 5, 10];

/* ============================================================= Assets */
const DEFAULT_ASSETS = [

  /* -------------------------------------------------- Router: AVM FRITZ! */
  {
    id: 'fb-5690-pro', model: 'FRITZ!Box 5690 Pro', chipset: 'DSL + Glasfaser (SFP)',
    category: 'router', icon: 'router', power: 13, wifi: 'Wi-Fi 7 Triband',
    ports: [
      { label: 'DSL', type: 'dsl', speed: 300, count: 1, exGroup: 'wan' },
      { label: 'SFP', type: 'sfp', speed: 2500, count: 1, exGroup: 'wan' },
      { label: 'WAN/LAN', type: 'rj45', speed: 2500, count: 1 },
      { label: 'LAN', type: 'rj45', speed: 1000, count: 4 },
    ],
  },
  {
    id: 'fb-5690-xgs', model: 'FRITZ!Box 5690 XGS', chipset: 'XGS-PON Glasfaser',
    category: 'router', icon: 'router', power: 8, wifi: 'Wi-Fi 7 Dualband',
    ports: [
      { label: 'WAN/LAN', type: 'wan', speed: 10000, count: 1 },
      { label: 'LAN', type: 'rj45', speed: 1000, count: 4 },
    ],
  },
  {
    id: 'fb-5690', model: 'FRITZ!Box 5690', chipset: 'Glasfaser (SFP)',
    category: 'router', icon: 'router', power: 8, wifi: 'Wi-Fi 7 Dualband',
    ports: [
      { label: 'SFP', type: 'sfp', speed: 2500, count: 1 },
      { label: 'WAN/LAN', type: 'rj45', speed: 2500, count: 1 },
      { label: 'LAN', type: 'rj45', speed: 1000, count: 2 },
    ],
  },
  {
    id: 'fb-7690', model: 'FRITZ!Box 7690', chipset: 'DSL Supervectoring 35b',
    category: 'router', icon: 'router', power: 13, wifi: 'Wi-Fi 7 Dualband',
    ports: [
      { label: 'DSL', type: 'dsl', speed: 300, count: 1 },
      { label: 'WAN/LAN', type: 'rj45', speed: 2500, count: 1 },
      { label: 'LAN2.5', type: 'rj45', speed: 2500, count: 1 },
      { label: 'LAN', type: 'rj45', speed: 1000, count: 2 },
    ],
  },
  {
    id: 'fb-4690', model: 'FRITZ!Box 4690', chipset: 'Ethernet-Router (kein Modem)',
    category: 'router', icon: 'router', power: 10, wifi: 'Wi-Fi 7 Dualband',
    ports: [
      { label: 'WAN', type: 'wan', speed: 10000, count: 1 },
      { label: 'LAN10G', type: 'rj45', speed: 10000, count: 1 },
      { label: 'LAN', type: 'rj45', speed: 2500, count: 3 },
    ],
  },
  {
    id: 'fb-6690', model: 'FRITZ!Box 6690 Pro', chipset: 'Kabel (DOCSIS 3.1)',
    category: 'router', icon: 'router', power: 14, wifi: 'Wi-Fi 7 Triband',
    ports: [
      { label: 'Kabel', type: 'coax', speed: 10000, count: 1 },
      { label: 'LAN2.5', type: 'rj45', speed: 2500, count: 1 },
      { label: 'LAN', type: 'rj45', speed: 1000, count: 3 },
    ],
  },
  {
    id: 'fb-6670', model: 'FRITZ!Box 6670 Cable', chipset: 'Kabel (DOCSIS 3.1)',
    category: 'router', icon: 'router', power: 11, wifi: 'Wi-Fi 7 Dualband',
    ports: [
      { label: 'Kabel', type: 'coax', speed: 10000, count: 1 },
      { label: 'LAN2.5', type: 'rj45', speed: 2500, count: 1 },
      { label: 'LAN', type: 'rj45', speed: 1000, count: 4 },
    ],
  },
  {
    id: 'fb-6860', model: 'FRITZ!Box 6860 5G', chipset: '5G Sub-6 / LTE',
    category: 'router', icon: 'router', power: 12, wifi: 'Wi-Fi 6 Dualband',
    ports: [
      { label: 'LAN (PoE+)', type: 'rj45', speed: 1000, count: 1 },
    ],
  },
  {
    id: 'fb-6835', model: 'FRITZ!Box 6835 5G', chipset: '5G SA/NSA / LTE',
    category: 'router', icon: 'router', power: 9, wifi: 'Wi-Fi 7 Dualband',
    ports: [
      { label: 'LAN2.5', type: 'rj45', speed: 2500, count: 1 },
      { label: 'LAN', type: 'rj45', speed: 1000, count: 1 },
    ],
  },

  /* --------------------------------------------------- Router: TP-Link */
  {
    id: 'archer-be800', model: 'TP-Link Archer BE800', chipset: 'Wi-Fi 7 BE19000',
    category: 'router', icon: 'router', power: 30, wifi: 'Wi-Fi 7 Triband',
    ports: [
      { label: 'WAN/LAN', type: 'rj45', speed: 10000, count: 1 },
      { label: 'Combo', type: 'combo', speed: 10000, count: 1, media: ['copper', 'fiber'] },
      { label: 'LAN', type: 'rj45', speed: 2500, count: 4 },
    ],
  },
  {
    id: 'archer-be550', model: 'TP-Link Archer BE550', chipset: 'Wi-Fi 7 BE9300',
    category: 'router', icon: 'router', power: 20, wifi: 'Wi-Fi 7 Triband',
    ports: [
      { label: 'WAN', type: 'wan', speed: 2500, count: 1 },
      { label: 'LAN', type: 'rj45', speed: 2500, count: 4 },
    ],
  },
  {
    id: 'archer-be230', model: 'TP-Link Archer BE230', chipset: 'Wi-Fi 7 BE3600',
    category: 'router', icon: 'router', power: 15, wifi: 'Wi-Fi 7 Dualband',
    ports: [
      { label: 'WAN', type: 'wan', speed: 2500, count: 1 },
      { label: 'LAN2.5', type: 'rj45', speed: 2500, count: 1 },
      { label: 'LAN', type: 'rj45', speed: 1000, count: 3 },
    ],
  },

  /* ------------------------------------------------- Mesh (Router/AP) */
  {
    id: 'deco-be85', model: 'TP-Link Deco BE85', chipset: 'Wi-Fi 7 Mesh BE19000',
    category: 'router', icon: 'mesh', power: 25, wifi: 'Wi-Fi 7 Mesh',
    ports: [
      { label: 'Combo', type: 'combo', speed: 10000, count: 1, media: ['copper', 'fiber'], autosense: true },
      { label: 'RJ45', type: 'rj45', speed: 10000, count: 1, autosense: true },
      { label: 'LAN', type: 'rj45', speed: 2500, count: 2, autosense: true },
    ],
  },
  {
    id: 'deco-be65', model: 'TP-Link Deco BE65', chipset: 'Wi-Fi 7 Mesh BE9300',
    category: 'router', icon: 'mesh', power: 18, wifi: 'Wi-Fi 7 Mesh',
    ports: [
      { label: 'LAN', type: 'rj45', speed: 2500, count: 4, autosense: true },
    ],
  },

  /* ------------------------------------------------------ Switches */
  {
    id: 'tl-sg105-m2', model: 'TP-Link TL-SG105-M2', chipset: 'Unmanaged 2.5G',
    category: 'switch', icon: 'switch', power: 12,
    ports: [ { label: 'P', type: 'rj45', speed: 2500, count: 5 } ],
  },
  {
    id: 'tl-sg108-m2', model: 'TP-Link TL-SG108-M2', chipset: 'Unmanaged 2.5G',
    category: 'switch', icon: 'switch', power: 16,
    ports: [ { label: 'P', type: 'rj45', speed: 2500, count: 8 } ],
  },
  {
    id: 'sg2210xmp-m2', model: 'TP-Link SG2210XMP-M2', chipset: 'L2+ Managed (Omada)',
    category: 'switch', icon: 'switch', power: 25, poeBudget: 160,
    ports: [
      { label: 'P', type: 'rj45', speed: 2500, count: 8, poe: true },
      { label: 'SFP+', type: 'sfpplus', speed: 10000, count: 2 },
    ],
  },
  {
    id: 'sg3210xhp-m2', model: 'TP-Link SG3210XHP-M2', chipset: 'L2+ Managed (Omada)',
    category: 'switch', icon: 'switch', power: 30, poeBudget: 240,
    ports: [
      { label: 'P', type: 'rj45', speed: 2500, count: 8, poe: true },
      { label: 'SFP+', type: 'sfpplus', speed: 10000, count: 2 },
    ],
  },
  {
    id: 'tl-sg2424p', model: 'TP-Link TL-SG2424P', chipset: 'Smart Managed L2',
    category: 'switch', icon: 'switch', power: 30, poeBudget: 180,
    ports: [
      { label: 'P', type: 'rj45', speed: 1000, count: 24, poe: true },
      { label: 'SFP', type: 'sfp', speed: 1000, count: 4 },
    ],
  },

  /* --------------------------------------------------- Server & Nodes */
  {
    id: 'rpi-5', model: 'Raspberry Pi 5', chipset: 'BCM2712 · PCIe 2.0',
    category: 'server', icon: 'sbc', power: 5,
    ports: [ { label: 'ETH', type: 'rj45', speed: 1000, count: 1 } ],
  },
  {
    id: 'rpi-4b', model: 'Raspberry Pi 4 B', chipset: 'BCM2711',
    category: 'server', icon: 'sbc', power: 4,
    ports: [ { label: 'ETH', type: 'rj45', speed: 1000, count: 1 } ],
  },
  {
    id: 'nas-generic', model: 'NAS (generisch)', chipset: '–',
    category: 'server', icon: 'nas', power: 30,
    ports: [ { label: 'LAN', type: 'rj45', speed: 2500, count: 2 } ],
  },
  {
    id: 'server-generic', model: 'Server (generisch)', chipset: '–',
    category: 'server', icon: 'server', power: 120,
    ports: [
      { label: 'SFP+', type: 'sfpplus', speed: 10000, count: 2 },
      { label: 'LAN', type: 'rj45', speed: 1000, count: 2 },
    ],
  },

  /* ------------------------------------------------------ Endgeräte */
  {
    id: 'pc-generic', model: 'PC / Workstation', chipset: '–',
    category: 'endpoint', icon: 'pc', power: 250,
    ports: [ { label: 'NIC', type: 'rj45', speed: 2500, count: 1 } ],
  },
  {
    id: 'laptop-generic', model: 'Laptop', chipset: '–',
    category: 'endpoint', icon: 'pc', power: 65,
    ports: [ { label: 'NIC', type: 'rj45', speed: 1000, count: 1 } ],
  },
  {
    id: 'printer-generic', model: 'Netzwerkdrucker', chipset: '–',
    category: 'endpoint', icon: 'host', power: 30,
    ports: [ { label: 'LAN', type: 'rj45', speed: 1000, count: 1 } ],
  },
  {
    id: 'ipcam-generic', model: 'IP-Kamera (PoE)', chipset: '–',
    category: 'endpoint', icon: 'host', power: 8, poeDraw: 8,
    ports: [ { label: 'PoE', type: 'rj45', speed: 1000, count: 1 } ],
  },

  /* ----------------------------------------- Verstärker / Access Points */
  {
    id: 'fr-6700-pro', model: 'FRITZ!Repeater 6700 Pro', chipset: 'Wi-Fi 7 Quadband',
    category: 'ap', icon: 'ap', power: 12,
    ports: [
      { label: 'LAN10G', type: 'rj45', speed: 10000, count: 1 },
      { label: 'LAN2.5', type: 'rj45', speed: 2500, count: 1 },
    ],
  },
  {
    id: 'fr-2700', model: 'FRITZ!Repeater 2700', chipset: 'Wi-Fi 7 Dualband',
    category: 'ap', icon: 'ap', power: 4,
    ports: [ { label: 'LAN', type: 'rj45', speed: 2500, count: 1 } ],
  },
  {
    id: 'ap-poe-generic', model: 'Access Point (PoE)', chipset: 'Wi-Fi 7',
    category: 'ap', icon: 'ap', power: 22, poeDraw: 22,
    ports: [ { label: 'PoE', type: 'rj45', speed: 2500, count: 1 } ],
  },

  /* ------------------------------------------- Smart-Home / IoT-Bridges */
  {
    id: 'hue-bridge', model: 'Philips Hue Bridge v2', chipset: 'Zigbee 3.0',
    category: 'iot', icon: 'iot', power: 3,
    ports: [ { label: 'LAN', type: 'rj45', speed: 100, count: 1 } ],
  },
  {
    id: 'hue-bridge-pro', model: 'Philips Hue Bridge Pro', chipset: 'Zigbee + Matter',
    category: 'iot', icon: 'iot', power: 3, wifi: 'Wi-Fi 2.4G',
    ports: [ { label: 'LAN', type: 'rj45', speed: 100, count: 1 } ],
  },
  {
    id: 'aqara-m3', model: 'Aqara Hub M3', chipset: 'Zigbee/Thread/Matter',
    category: 'iot', icon: 'iot', power: 5, poeDraw: 5, wifi: 'Wi-Fi Dualband',
    ports: [ { label: 'LAN (PoE)', type: 'rj45', speed: 1000, count: 1 } ],
  },
  {
    id: 'homey-mini', model: 'Homey Pro Mini', chipset: 'Zigbee/Thread/Matter',
    category: 'iot', icon: 'iot', power: 5,
    ports: [ { label: 'LAN', type: 'rj45', speed: 1000, count: 1 } ],
  },
];

/* ---------------------------------------------- Standard-Kabel-Presets
   (Schnellzugriff im Kabel-Menü der Top-Nav)                            */
const DEFAULT_CABLE_PRESETS = [
  { id: 'preset-cat6-1',   name: 'Cat6 · 1 m · Blau',      standard: 'cat6',  color: '#3b82f6', length: 1,   label: '' },
  { id: 'preset-cat6a-2',  name: 'Cat6a · 2 m · Gelb',     standard: 'cat6a', color: '#eab308', length: 2,   label: '' },
  { id: 'preset-cat7-5',   name: 'Cat7 · 5 m · Grau',      standard: 'cat7',  color: '#94a3b8', length: 5,   label: '' },
  { id: 'preset-dac-1',    name: 'SFP+ DAC · 1 m · Schwarz',standard: 'dac',  color: '#0f172a', length: 1,   label: '' },
  { id: 'preset-lwl-10',   name: 'LWL · 10 m · Gelb',      standard: 'lwl',   color: '#eab308', length: 10,  label: 'Uplink' },
];

/* ------------------------------------------------------------ Helpers */
function cableStandard(id) { return CABLE_STANDARDS.find((c) => c.id === id) || CABLE_STANDARDS[1]; }

// Medium eines Ports (fuer Kompatibilitaetsprüfung).
function portMedium(type) {
  if (type === 'sfp' || type === 'sfpplus') return 'fiber';
  if (type === 'coax') return 'coax';
  if (type === 'dsl')  return 'tel';
  return 'copper'; // rj45, wan, combo(kupferseitig)
}

// Menschlich lesbare Geschwindigkeit.
function speedLabel(mbit) {
  if (!mbit) return '–';
  if (mbit >= 1000) return (Number.isInteger(mbit / 1000) ? mbit / 1000 : (mbit / 1000).toFixed(1)) + ' G';
  return mbit + ' M';
}
