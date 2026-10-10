/* =========================================================================
   livecode.js – Live-Code-View
   -------------------------------------------------------------------------
   Rendert den aktuellen State parallel als strukturierten HTML-Baum mit
   anklickbaren Anker-Links, die zum jeweiligen Geraet auf dem Canvas
   springen (Observer auf 'state').
   ========================================================================= */

const LiveCode = (() => {
  const el = UI.el;
  let host;

  function mount(container) {
    host = container;
    Bus.on('state', render);
    Bus.on('selection', (ids) => highlight(ids && ids[0]));
    render();
  }

  function render() {
    if (!host) return;
    host.innerHTML = '';
    const p = State.project;
    if (!p) return;

    host.appendChild(el('div.text-xs.text-slate-400.mb-2', {
      text: `${p.devices.length} Geräte · ${p.cables.length} Verbindungen`,
    }));

    p.devices.forEach((dev) => {
      const conns = p.cables.filter((c) => c.from.deviceId === dev.id || c.to.deviceId === dev.id);
      const block = el('div.mb-2.rounded.border.border-slate-200.dark\\:border-slate-700.overflow-hidden', { dataset: { dev: dev.id } });

      const head = el('a.block.px-2.py-1.bg-slate-100.dark\\:bg-slate-800.text-xs.font-mono.flex.justify-between.items-center', {
        onclick: () => Canvas.flashDevice(dev.id),
      }, [
        el('span', { html: `<span class="text-indigo-500">&lt;device&gt;</span> ${UI.escapeHtml(dev.props.hostname || dev.model)}` }),
        el('span.text-slate-400', { text: `#${dev.id.slice(-4)}` }),
      ]);
      block.appendChild(head);

      const body = el('div.px-3.py-1.text-xs.font-mono.text-slate-500.space-y-0\\.5');
      if (dev.props.ip4) body.appendChild(el('div', { html: `ipv4: <span class="text-emerald-600 dark:text-emerald-400">${UI.escapeHtml(dev.props.ip4)}</span>` }));
      if (dev.props.ip6) body.appendChild(el('div', { html: `ipv6: <span class="text-emerald-600 dark:text-emerald-400">${UI.escapeHtml(dev.props.ip6)}</span>` }));
      if (dev.props.mac) body.appendChild(el('div', { html: `mac:  <span class="text-sky-600 dark:text-sky-400">${UI.escapeHtml(dev.props.mac)}</span>` }));
      body.appendChild(el('div', { text: `ports: ${dev.ports.length}` }));

      conns.forEach((c) => {
        const otherRef = c.from.deviceId === dev.id ? c.to : c.from;
        const other = State.device(otherRef.deviceId);
        const icon = c.status === 'ok' ? '🟢' : c.status === 'warning' ? '🟠' : '🔴';
        const std = cableStandard(c.standard);
        body.appendChild(el('a.block.pl-2.hover\\:text-indigo-500', {
          onclick: () => other && Canvas.flashDevice(other.id),
        }, [ document.createTextNode(`${icon} ${std.name} ${c.length}m ${speedLabel(c.speed)}${c.label ? ' (' + c.label + ')' : ''} → ${other ? (other.props.hostname || other.model) : '?'}`) ]));
      });
      block.appendChild(body);
      host.appendChild(block);
    });

    if (!p.devices.length) {
      host.appendChild(el('div.text-xs.text-slate-400.italic', { text: '// Noch keine Geräte. Der Baum aktualisiert sich live.' }));
    }
  }

  function highlight(id) {
    if (!host || !id) return;
    const node = host.querySelector(`[data-dev="${id}"]`);
    if (node) { node.classList.add('flash'); node.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); setTimeout(() => node.classList.remove('flash'), 1000); }
  }

  return { mount };
})();
