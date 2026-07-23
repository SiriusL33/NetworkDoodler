# Network Schematic Designer (NSD) · v2.0

Lokaler, JSON-state-basierter **CAD-Netzwerk-Schaltplan-Editor** im Stil von
PCB-Design-Software (EasyEDA). Vanilla JS · HTML5 · Tailwind · ohne Backend.

## Starten

Kein Build nötig. `index.html` im Browser öffnen – oder:

```bash
python3 -m http.server 8000      # dann http://localhost:8000
```

## Bedienung

| Aktion | Bedienung |
|--------|-----------|
| Gerät platzieren | Asset aus der Palette aufs Canvas **ziehen** |
| Verkabeln | **Port klicken → Ziel-Port klicken** (nutzt das aktive Base-Kabel) |
| Kabel wählen | **„Kabel"-Menü** in der Top-Leiste (Standard/Farbe/Länge/Flag) |
| Verschieben | Gerät ziehen (rastet am Grid) |
| Quick-Menü | **Gerät anklicken** → Löschen / Duplizieren / Rotieren / Farbe |
| Pan | Leere Fläche ziehen **oder** mittlere Maustaste |
| Zoom | **Mausrad** (stufenlos, zentriert auf den Zeiger) |
| Eigenschaften | Gerät auswählen → rechte Sidebar (IP/MAC-Masken) |
| Löschen | `Entf` bei ausgewähltem Gerät |

## Was ist neu in v2.0 (Update-Manifest)

1. **CAD-Navigation** – unendliche Fläche, Pan & stufenloses Zoom (viewBox).
2. **Orthogonales Grid-Routing** – Kabel nur im 90°-Winkel, gridbasiert.
3. **Eckige Ports** mit gelbem Snap-Punkt in der Mitte; Status-LEDs sitzen in
   den oberen Ecken (werden vom Kabel nicht mehr verdeckt).
4. **Top-Navigation** mit strukturiertem **Kabel-Menü** (Base-Kabel:
   Cat5e–Cat8 / SFP+ DAC / LWL / Koax, Farbe, Länge, Flag).
5. **Asset-Bibliothek** als **Kategorie-Akkordeons**.
6. **Layout** – Gerätename immer außerhalb & oberhalb der Box, keine
   Überlappungen im Professional Mode.
7. **Kontextmenü** (Quick Actions) – Löschen, Duplizieren, Rotieren (90°),
   Farbe ändern.

## Asset-Datenbank (real & exakt)

Über 30 gängige DE-Produkte (2024–2026) mit **exakten physischen Ports**:

- **Router:** FRITZ!Box 5690 Pro/XGS/Standard, 7690, 4690, 6690 Pro, 6670
  Cable, 6860/6835 5G · TP-Link Archer BE800/BE550/BE230 · Deco BE85/BE65
- **Switches:** TL-SG105-M2 / SG108-M2 (2.5G) · SG2210XMP-M2 / SG3210XHP-M2
  (L2+ PoE) · TL-SG2424P (24-Port PoE)
- **Server & Nodes:** Raspberry Pi 4 B / 5, NAS, Server
- **Endgeräte:** PC, Laptop, Drucker, IP-Kamera (PoE)
- **Access Points:** FRITZ!Repeater 6700 Pro / 2700, PoE-AP
- **Smart-Home / IoT:** Philips Hue Bridge v2 / Pro, Aqara Hub M3, Homey Pro Mini

### Modellierte Sonderfälle aus der Spezifikation

- **Combo-/Uplink-Ports (gegenseitig exklusiv):** z. B. FRITZ!Box 5690 Pro
  DSL **⊕** SFP, oder TP-Link 10G RJ45 **⊕** SFP+. Wird ein Port belegt, sperrt
  der Bruder-Port automatisch (`⛓` in der Port-Liste).
- **Auto-Sensing (Mesh):** Deco-Ports sind nicht statisch WAN/LAN (`⇄`).
- **PoE-Leistungsbudget:** Ein Switch summiert den Verbrauch aller an seinen
  PoE-Ports hängenden Geräte und warnt bei Überschreitung (Badge `PoE x/y W`).
- **Medien-Kompatibilität:** Kupfer- vs. Glas-/DAC-Kabel werden geprüft
  (inkompatibel → *Broken Lane*, rote gestrichelte Leitung).

## Debug-Engine (LED-Logik)

- **🟢 ok** – Speeds passen → LEDs blinken grün/orange.
- **🟠 warning** – Bottleneck (Speed-Mismatch oder bremsendes Kabel) → LEDs an
  + rotes „!" (Klick zeigt Ursache).
- **🔴 error** – inkompatibles Medium → *Broken Lane*, LEDs aus.

## 5-Wege-Export & Zero-Trust

Visual (PNG/PDF) · Professional Schematic (PNG/PDF) · HTML-Dokument ·
AI-Ready Schema (.md) · Projektdatei (.json). Beim Beenden wird die Session
verworfen (Zero-Trust); nur Asset-/Preset-DB & Theme bleiben in `localStorage`.

## Projektstruktur

```
index.html          Shell + Ladereihenfolge
css/styles.css      Ports, LEDs, Grid, Kontextmenü, Modals
js/data.js          Asset-DB + Kabel-System (Standards/Farben/Längen)
js/state.js         Zentraler State, Persistenz, Debug-Engine, PoE, Combo
js/ui.js            DOM-Builder, Modals, Toasts
js/symbols.js       Piktogramme (Design & Professional)
js/canvas.js        CAD-Canvas: Pan/Zoom, orthogonales Routing, Ports, Kontextmenü
js/database.js      Asset-/Preset-Manager
js/properties.js    Eigenschaften-Sidebar + Eingabemasken + Security-Modal
js/livecode.js      Live-Code-View
js/exporter.js      5-Wege-Export + Zero-Trust-Beenden
js/app.js           Bootstrap, Routing, Top-Nav, Kabel-Menü, Palette
```

## Bekannte Grenzen / Nächste Schritte

- **Tailwind** wird per Play-CDN geladen. Für echte Offline-/Standalone-
  Distribution (Tauri/Electron) sollte es lokal gebündelt werden
  (`npx tailwindcss -o css/tailwind.css --minify`); die App-Logik ist bereits
  vollständig abhängigkeitsfrei.
- **PDF-Export** läuft über den Druckdialog (PNG → „Als PDF speichern").
- Orthogonales Routing nutzt einen einfachen Z-Kanal-Router (kein
  Hindernis-Ausweichen).
