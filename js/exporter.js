/* =========================================================================
   exporter.js – 5-Wege-Export + Zero-Trust-Beenden
   -------------------------------------------------------------------------
   1) Visual Design Export        (PNG / PDF)  – realistische Piktogramme
   2) Professional Schematic      (PNG / PDF)  – genormte Symbole
   3) HTML Document               (.html)      – lokal nutzbares Dokument
   4) AI-Ready Schema             (.md)        – JSON/Markdown fuer LLM-Kontext
   5) Projektdatei                (.json)      – vollstaendiger State
   Alles rein clientseitig, ohne externe Abhaengigkeiten.
   ========================================================================= */

const Exporter = (() => {
  const el = UI.el;

  /* ------------------------------------------------------- Datei-Downloads */
  function download(filename, content, mime) {
    const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function slug() {
    return (State.project.meta.name || 'projekt').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  }

  /* --------------------------------------------------- SVG -> PNG rastern */
  function svgToPng(svgString, width, height, scale = 2) {
    return new Promise((resolve, reject) => {
      const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = width * scale; canvas.height = height * scale;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        canvas.toBlob((b) => b ? resolve(b) : reject(new Error('toBlob fehlgeschlagen')), 'image/png');
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('SVG konnte nicht geladen werden')); };
      img.src = url;
    });
  }

  async function exportImage(mode, kind) {
    const { svg, width, height } = Canvas.buildStandaloneSVG(mode);
    if (!svg) { UI.toast('Nichts zu exportieren – Canvas ist leer.', 'warn'); return; }
    if (kind === 'png') {
      const png = await svgToPng(svg, width, height);
      download(`${slug()}-${mode}.png`, png, 'image/png');
      UI.toast('PNG exportiert.', 'ok');
    } else {
      // PDF via Druckdialog: PNG in ein Druckfenster legen.
      const png = await svgToPng(svg, width, height);
      const dataUrl = await blobToDataURL(png);
      printImage(dataUrl, `${State.project.meta.name} – ${mode}`);
    }
  }

  function blobToDataURL(blob) {
    return new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(blob); });
  }

  function printImage(dataUrl, title) {
    const w = window.open('', '_blank');
    if (!w) { UI.toast('Popup blockiert – bitte erlauben.', 'warn'); return; }
    w.document.write(`<!doctype html><title>${UI.escapeHtml(title)}</title>
      <style>@page{margin:12mm}body{margin:0}img{max-width:100%}</style>
      <img src="${dataUrl}" onload="setTimeout(()=>{window.print()},150)">`);
    w.document.close();
  }

  /* ----------------------------------------------------- Projektdatei JSON */
  function exportJSON() {
    const json = JSON.stringify(State.project, null, 2);
    download(`${slug()}.json`, json, 'application/json');
    State.markClean();
    UI.toast('Projektdatei gespeichert.', 'ok');
  }

  /* --------------------------------------------------------- AI-Ready Schema */
  function exportAISchema() {
    const p = State.project;
    let md = `# Netzwerk-Schema: ${p.meta.name}\n\n`;
    md += `Modus: ${p.meta.mode} · Geräte: ${p.devices.length} · Verbindungen: ${p.cables.length}\n\n`;
    md += `## Geräte\n\n`;
    p.devices.forEach((d) => {
      md += `### ${d.props.hostname || d.model} (${d.model})\n`;
      md += `- Typ: ${d.category}\n`;
      if (d.props.ip4) md += `- IPv4: ${d.props.ip4}\n`;
      if (d.props.ip6) md += `- IPv6: ${d.props.ip6}\n`;
      if (d.props.mac) md += `- MAC: ${d.props.mac}\n`;
      if (d.props.ssid) md += `- SSID: ${d.props.ssid}\n`;
      md += `- Ports: ${d.ports.map((pt) => `${pt.label}(${pt.type},${speedLabel(pt.speed)})`).join(', ')}\n\n`;
    });
    md += `## Verbindungen\n\n`;
    p.cables.forEach((c) => {
      const a = State.device(c.from.deviceId), b = State.device(c.to.deviceId);
      const std = cableStandard(c.standard);
      md += `- ${a?.props.hostname || a?.model} → ${b?.props.hostname || b?.model}: ${std.name}, ${c.length} m, ${speedLabel(c.speed)}${c.label ? ', "' + c.label + '"' : ''} [${c.status}]${c.status !== 'ok' ? ' – ' + State.cableReason(c) : ''}\n`;
    });
    md += `\n## Roh-JSON\n\n\`\`\`json\n${JSON.stringify(p, null, 2)}\n\`\`\`\n`;
    download(`${slug()}-ai-schema.md`, md, 'text/markdown');
    UI.toast('AI-Ready Schema exportiert.', 'ok');
  }

  /* ------------------------------------------------------ HTML-Dokument */
  function exportHTML() {
    const p = State.project;
    const { svg } = Canvas.buildStandaloneSVG(p.meta.mode);
    const rows = p.devices.map((d) => `
      <tr id="dev-${d.id}">
        <td><b>${UI.escapeHtml(d.props.hostname || d.model)}</b><br><small>${UI.escapeHtml(d.model)}</small></td>
        <td>${UI.escapeHtml(d.props.ip4 || '–')}</td>
        <td>${UI.escapeHtml(d.props.mac || '–')}</td>
        <td>${d.ports.length}</td>
      </tr>`).join('');
    const conns = p.cables.map((c) => {
      const a = State.device(c.from.deviceId), b = State.device(c.to.deviceId);
      return `<tr><td>${UI.escapeHtml(a?.props.hostname || a?.model || '?')} → ${UI.escapeHtml(b?.props.hostname || b?.model || '?')}</td><td>${cableStandard(c.standard).name}</td><td>${c.length} m</td><td>${speedLabel(c.speed)}</td><td>${c.status}</td></tr>`;
    }).join('');

    const html = `<!doctype html><html lang="de"><head><meta charset="utf-8">
<title>${UI.escapeHtml(p.meta.name)} – Netzwerkdokumentation</title>
<style>
  body{font-family:system-ui,sans-serif;margin:0;padding:2rem;color:#1e293b;background:#f8fafc}
  h1{font-size:1.5rem} h2{margin-top:2rem;border-bottom:2px solid #e2e8f0;padding-bottom:.3rem}
  table{border-collapse:collapse;width:100%;margin-top:.5rem;background:#fff}
  th,td{border:1px solid #e2e8f0;padding:.5rem .75rem;text-align:left;font-size:.9rem}
  th{background:#f1f5f9} .diagram{background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:1rem;overflow:auto}
  small{color:#64748b}
</style></head><body>
  <h1>${UI.escapeHtml(p.meta.name)}</h1>
  <small>Erstellt am ${new Date(p.meta.created).toLocaleString('de-DE')} · Modus: ${p.meta.mode}</small>
  <h2>Schaltplan</h2>
  <div class="diagram">${svg || '<i>Kein Diagramm</i>'}</div>
  <h2>Geräte (${p.devices.length})</h2>
  <table><thead><tr><th>Gerät</th><th>IPv4</th><th>MAC</th><th>Ports</th></tr></thead><tbody>${rows}</tbody></table>
  <h2>Verbindungen (${p.cables.length})</h2>
  <table><thead><tr><th>Verbindung</th><th>CAT</th><th>Länge</th><th>Speed</th><th>Status</th></tr></thead><tbody>${conns}</tbody></table>
</body></html>`;
    download(`${slug()}.html`, html, 'text/html');
    UI.toast('HTML-Dokument exportiert.', 'ok');
  }

  /* ------------------------------------------------------- Export-Menue */
  function openMenu() {
    if (!State.project) return;
    UI.modal({
      title: 'Export',
      body: (n, close) => {
        const item = (title, desc, onClick) => el('button.w-full.text-left.p-3.rounded-lg.border.border-slate-200.dark\\:border-slate-700.hover\\:border-indigo-400.hover\\:bg-indigo-50.dark\\:hover\\:bg-indigo-900\\/20.transition.mb-2', {
          onclick: () => { close(); onClick(); },
        }, [
          el('div.font-medium.text-sm', { text: title }),
          el('div.text-xs.text-slate-500', { text: desc }),
        ]);
        n.appendChild(item('1 · Visual Design (PNG)', 'Realistische Piktogramme als Bild', () => exportImage('design', 'png')));
        n.appendChild(item('1 · Visual Design (PDF)', 'Über den Druckdialog als PDF sichern', () => exportImage('design', 'pdf')));
        n.appendChild(item('2 · Professional Schematic (PNG)', 'Genormte Industrie-Symbole als Bild', () => exportImage('professional', 'png')));
        n.appendChild(item('2 · Professional Schematic (PDF)', 'Genormtes Schema als PDF', () => exportImage('professional', 'pdf')));
        n.appendChild(item('3 · HTML-Dokument', 'Eigenständige, teilbare Doku (.html)', exportHTML));
        n.appendChild(item('4 · AI-Ready Schema', 'JSON/Markdown für LLM-Kontext (.md)', exportAISchema));
        n.appendChild(item('5 · Projektdatei speichern', 'Vollständiger State zum Weiterarbeiten (.json)', exportJSON));
      },
      actions: [{ label: 'Schließen' }],
    });
  }

  /* ------------------------------------------------ Zero-Trust-Beenden */
  function requestExit(onConfirmed) {
    UI.modal({
      title: '⚠ Projekt beenden',
      body: (n) => {
        n.appendChild(el('p.text-sm.mb-2', { text: State.isDirty
          ? 'Es gibt ungesicherte Änderungen. Die Session wird beim Beenden vollständig verworfen (Zero-Trust – es wird nichts heimlich gespeichert).'
          : 'Die aktuelle Session wird verworfen. Assets & Presets bleiben erhalten.' }));
        if (State.isDirty) n.appendChild(el('p.text-sm.text-amber-600', { text: 'Empfehlung: vorher als Projektdatei (.json) sichern.' }));
      },
      actions: [
        { label: 'Abbrechen' },
        State.isDirty ? { label: 'Jetzt sichern (.json)', primary: true, onClick: () => { exportJSON(); return false; }, keepOpen: true } : null,
        { label: 'Verwerfen & Beenden', danger: true, onClick: () => onConfirmed() },
      ].filter(Boolean),
    });
  }

  return { openMenu, exportJSON, requestExit };
})();
