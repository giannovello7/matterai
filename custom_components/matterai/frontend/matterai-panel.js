/*
 * Panel MatterAI (barra lateral de Home Assistant, sólo administradores = el instalador).
 *   Dashboard: editor visual + vista previa + Guardar (la app de los clientes cambia al momento).
 *   App del cliente: QR y link para vincular el celular; generar un acceso nuevo.
 *   Estado: versión, acceso de la app (CORS), panel central, alertas de la casa.
 */
(() => {
  const BASE = '/matterai_static';
  const loadScript = (src) => new Promise((res, rej) => {
    if (document.querySelector(`script[data-mae="${src}"]`)) return res();
    const s = document.createElement('script'); s.src = src; s.dataset.mae = src; s.onload = res; s.onerror = rej; document.head.appendChild(s);
  });
  /** Este panel no es un dashboard: HA no carga solo las tarjetas de HACS (Frigate/advanced-camera-card…).
   *  Se cargan acá, como hace Lovelace, para que la vista previa se vea igual que la app. */
  const loaded = new Set();
  const loadLovelaceResources = async (hass) => {
    let list = [];
    try { list = (await hass.callWS({ type: 'lovelace/resources' })) || []; } catch (_) { return; }
    await Promise.all(list.map(async (r) => {
      const url = String(r.url || '');
      if (!url || /matterai-home-card/.test(url) || loaded.has(url)) return;
      loaded.add(url);
      try {
        if (r.type === 'css') { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = url; document.head.appendChild(l); return; }
        if (r.type === 'js') { await loadScript(url); return; }
        await import(/* webpackIgnore: true */ url);
      } catch (e) { console.warn('MatterAI: no se pudo cargar', url, e); }
    }));
  };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const CSS = `
  :host{display:block;min-height:100vh;background:var(--primary-background-color,#111);color:var(--primary-text-color,#eee);font-family:var(--paper-font-body1_-_font-family,system-ui,sans-serif)}
  header{position:sticky;top:0;z-index:5;display:flex;align-items:center;gap:14px;padding:10px 18px;background:var(--app-header-background-color,#1c1c1e);color:var(--app-header-text-color,#fff);box-shadow:0 2px 8px rgba(0,0,0,.25)}
  header h1{margin:0;font-size:19px;font-weight:500;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  header small{opacity:.7;font-size:12px}
  .menu{background:none;border:0;color:inherit;font-size:22px;cursor:pointer;padding:4px 8px}
  nav{display:flex;gap:4px;padding:10px 18px 0;border-bottom:1px solid var(--divider-color,rgba(255,255,255,.12));flex-wrap:wrap}
  nav button{padding:10px 16px;border:0;background:none;color:inherit;font:inherit;cursor:pointer;border-bottom:3px solid transparent;opacity:.7}
  nav button.on{opacity:1;border-bottom-color:var(--primary-color,#03a9f4);font-weight:600}
  main{padding:18px;max-width:1800px;margin:0 auto}
  /* editor y vista previa lado a lado sólo si hay lugar para los dos; si no, uno abajo del otro */
  .dash{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:18px;align-items:start}
  .dash>.box{min-width:0}
  @media (max-width:1250px){.dash{grid-template-columns:minmax(0,1fr)}.prev{position:static;max-height:none}}
  .box{background:var(--card-background-color,#1c1c1e);border-radius:16px;padding:16px;box-shadow:var(--ha-card-box-shadow,none);border:1px solid var(--divider-color,rgba(255,255,255,.08))}
  .prev{position:sticky;top:120px;max-height:calc(100vh - 140px);overflow:auto;border-radius:16px;padding:0}
  .bar{position:sticky;bottom:0;display:flex;gap:10px;align-items:center;justify-content:flex-end;padding:12px 0 4px;background:linear-gradient(transparent,var(--card-background-color,#1c1c1e) 30%)}
  .bar span{margin-right:auto;font-size:13px;opacity:.75}
  button.b{display:inline-flex;align-items:center;gap:6px;padding:9px 16px;border-radius:10px;border:1px solid var(--divider-color,rgba(255,255,255,.2));background:none;color:inherit;font:inherit;cursor:pointer}
  button.b.pri{background:var(--primary-color,#03a9f4);border-color:transparent;color:#fff}
  a.b{color:inherit;text-decoration:none}a.b.pri{color:#fff}
  button.b:disabled{opacity:.4;cursor:default}
  button.b.warn{color:var(--error-color,#db4437)}
  .pair{display:grid;grid-template-columns:auto 1fr;gap:24px;align-items:start}
  @media (max-width:700px){.pair{grid-template-columns:1fr}}
  .qr{background:#fff;padding:14px;border-radius:14px;width:260px;height:260px;display:grid;place-items:center}
  .qr svg,.qr img{width:100%;height:100%}
  .link{word-break:break-all;font-size:12px;opacity:.8;padding:10px;border-radius:10px;background:rgba(127,127,127,.12);margin:8px 0}
  .row{display:flex;gap:10px;flex-wrap:wrap;margin:10px 0}
  h2{margin:0 0 6px;font-size:18px}h3{margin:18px 0 6px;font-size:15px}
  p{margin:6px 0;line-height:1.5}.mut{opacity:.7;font-size:13px}
  .vlog{grid-column:1/-1}.vl{display:flex;flex-direction:column;gap:6px;max-height:420px;overflow:auto;margin:8px 0}
  .vli{display:grid;grid-template-columns:auto 1fr;gap:2px 10px;align-items:baseline;padding:8px 10px;border-radius:10px;background:rgba(127,127,127,.08)}
  .vli small{grid-column:2;opacity:.65}.vlw{font-size:12px;font-weight:600;white-space:nowrap}
  .st{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px}
  .kv{display:flex;justify-content:space-between;gap:10px;padding:7px 0;border-bottom:1px solid var(--divider-color,rgba(255,255,255,.08));font-size:14px}
  .kv b{font-weight:600;text-align:right}
  .ok{color:#3ecf8e}.bad{color:var(--error-color,#db4437)}.wn{color:#ffb547}
  .al{padding:9px 12px;border-radius:10px;margin:6px 0;font-size:14px;background:rgba(127,127,127,.12)}
  .al.critical{background:rgba(219,68,55,.18)}.al.warning{background:rgba(255,181,71,.16)}
  .toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:#323232;color:#fff;padding:10px 18px;border-radius:10px;z-index:20;font-size:14px}
  `;

  class MatterAIAdminPanel extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this._tab = 'dash';
      this._saved = null; this._draft = null; this._status = null; this._pair = null;
    }
    set hass(h) {
      const first = !this._hass; this._hass = h;
      if (this._card) this._card.hass = h;
      if (this._editor) this._editor.hass = h;
      if (this._auto) this._auto.hass = h;
      if (first) this._init();
    }
    set panel(p) { this._panel = p; }
    set narrow(n) { this._narrow = n; }
    connectedCallback() {
      // HA a veces arma el panel antes de que este archivo termine de bajar y le deja los datos a un elemento
      // "vacío": quedan tapando los setters y la pantalla queda en blanco. Se recogen acá (panel antes que hass).
      for (const k of ['panel', 'narrow', 'hass']) {
        if (Object.prototype.hasOwnProperty.call(this, k)) { const v = this[k]; delete this[k]; this[k] = v; }
      }
    }

    async _init() {
      this.shadowRoot.innerHTML = `<style>${CSS}</style><header><button class="menu" id="menu" title="Menú">☰</button><h1>MatterAI <small id="hname"></small></h1><small id="ver"></small></header>
        <nav>${[['dash', 'Dashboard'], ['auto', 'Automatizaciones'], ['app', 'App del cliente'], ['status', 'Estado']].map(([k, l]) => `<button data-tab="${k}" class="${k === this._tab ? 'on' : ''}">${l}</button>`).join('')}</nav><main id="main"><p class="mut">Cargando…</p></main>`;
      this.shadowRoot.getElementById('menu').onclick = () => this.dispatchEvent(new Event('hass-toggle-menu', { bubbles: true, composed: true }));
      this.shadowRoot.querySelector('nav').onclick = (e) => { const b = e.target.closest('[data-tab]'); if (b) this._go(b.dataset.tab); };
      try {
        const cardUrl = (this._panel && this._panel.config && this._panel.config.card_url) || `${BASE}/matterai-home-card.js`;
        if (!customElements.get('matterai-home-card')) await import(/* webpackIgnore: true */ cardUrl);
        loadLovelaceResources(this._hass); // sin esperar: la tarjeta cambia a la de cámaras apenas esté
        const r = await this._hass.callWS({ type: 'matterai/config' });
        this._saved = JSON.stringify(r.config); this._draft = r.config;
        this.shadowRoot.getElementById('hname').textContent = r.name ? `· ${r.name}` : '';
        this.shadowRoot.getElementById('ver').textContent = `v${r.version}`;
      } catch (e) {
        this.shadowRoot.getElementById('main').innerHTML = `<div class="box"><h2>No se pudo cargar</h2><p>${esc(e.message || e)}</p></div>`;
        return;
      }
      this._go(this._tab);
    }
    _go(tab) {
      if (this._tab === 'dash' && tab !== 'dash' && this._dirty() && !confirm('Hay cambios sin guardar en el dashboard. ¿Salir igual?')) return;
      this._tab = tab;
      this.shadowRoot.querySelectorAll('nav button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
      this._auto = null;
      if (tab === 'dash') this._renderDash(); else if (tab === 'auto') this._renderAuto(); else if (tab === 'app') this._renderApp(); else this._renderStatus();
    }
    _toast(msg) {
      const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
      this.shadowRoot.appendChild(t); setTimeout(() => t.remove(), 2600);
    }
    _dirty() { return this._draft && JSON.stringify(this._draft) !== this._saved; }

    /* ---------- Automatizaciones (MatterAI Escenas, vista del instalador) ---------- */
    async _renderAuto() {
      const main = this.shadowRoot.getElementById('main');
      main.innerHTML = '<p class="mut">Cargando…</p>';
      // la tarjeta la sirve la integración MatterAI Escenas; puede tardar un momento en definirse
      const ok = customElements.get('matterai-escenas-card') || await Promise.race([
        customElements.whenDefined('matterai-escenas-card').then(() => true),
        new Promise((r) => setTimeout(() => r(false), 4000)),
      ]);
      if (this._tab !== 'auto') return;
      if (!ok) {
        main.innerHTML = `<div class="box"><h2>No se pudieron cargar las automatizaciones</h2><p>Recargá la página (Ctrl+F5). Si sigue igual, reiniciá Home Assistant.</p></div>`;
        return;
      }
      main.innerHTML = `<div class="box" style="margin-bottom:12px"><p class="mut" style="margin:0">Acá ves todo: lo que arma el cliente y los <b>equipos del instalador</b> (portón inteligente, sensor de ocupación), que el cliente no ve. Con <b>⚙</b> elegís qué puede crear el cliente y qué equipos ve. A una automatización tuya le podés poner <b>🔒</b> para que el cliente sólo la active o la pause.</p></div><div id="auto"></div>`;
      const card = document.createElement('matterai-escenas-card');
      card.setConfig({ title: 'Automatizaciones' });
      card.hass = this._hass;
      this.shadowRoot.getElementById('auto').appendChild(card);
      this._auto = card;
    }

    /* ---------- Dashboard: editor + vista previa ---------- */
    _renderDash() {
      const main = this.shadowRoot.getElementById('main');
      main.innerHTML = `<div class="dash"><div class="box" id="edbox"></div><div class="box prev" id="prev"></div></div>`;
      const Ed = customElements.get('matterai-home-card-editor');
      this._editor = new Ed();
      this._editor.hass = this._hass;
      this._editor.setConfig(this._draft);
      this._editor.addEventListener('config-changed', (e) => {
        this._draft = e.detail.config;
        clearTimeout(this._pt); this._pt = setTimeout(() => this._card && this._card.setConfig(this._draft), 250);
        this._bar();
      });
      const edbox = this.shadowRoot.getElementById('edbox');
      edbox.appendChild(this._editor);
      const bar = document.createElement('div'); bar.className = 'bar'; bar.id = 'bar'; edbox.appendChild(bar);
      this._card = document.createElement('matterai-home-card');
      this._card.setConfig(this._draft);
      this._card.hass = this._hass;
      this.shadowRoot.getElementById('prev').appendChild(this._card);
      this._bar();
    }
    _bar() {
      const bar = this.shadowRoot.getElementById('bar'); if (!bar) return;
      const d = this._dirty();
      bar.innerHTML = `<span>${d ? 'Cambios sin guardar · la app de los clientes no los ve todavía' : 'Todo guardado · la app muestra esto'}</span>
        <button class="b" id="undo" ${d ? '' : 'disabled'}>Descartar</button><button class="b pri" id="save" ${d ? '' : 'disabled'}>Guardar</button>`;
      bar.querySelector('#undo').onclick = () => { this._draft = JSON.parse(this._saved); this._renderDash(); };
      bar.querySelector('#save').onclick = async () => {
        try {
          await this._hass.callWS({ type: 'matterai/config/save', config: this._draft });
          this._saved = JSON.stringify(this._draft); this._bar(); this._toast('Guardado: la app de los clientes ya lo muestra');
        } catch (e) { this._toast(`No se pudo guardar: ${e.message || e}`); }
      };
    }

    /* ---------- App del cliente: QR de vinculación ---------- */
    async _renderApp(regenerate = false) {
      const main = this.shadowRoot.getElementById('main');
      main.innerHTML = '<div class="box"><p class="mut">Preparando el acceso…</p></div>';
      try {
        await loadScript(`${BASE}/qrcode.js`);
        this._pair = await this._hass.callWS({ type: 'matterai/pairing', regenerate });
      } catch (e) {
        main.innerHTML = `<div class="box"><h2>Falta un dato</h2><p>${esc(e.message || e)}</p>
          <p><a href="/config/integrations/integration/matterai" style="color:var(--primary-color)">Ir a la configuración de MatterAI</a></p></div>`;
        return;
      }
      const p = this._pair;
      const qr = window.qrcode(0, 'L'); qr.addData(p.link); qr.make();
      const wa = `https://wa.me/?text=${encodeURIComponent(`¡Hola! Para usar tu casa inteligente bajá la app MatterAI y abrí este link desde el celular:\n${p.link}`)}`;
      main.innerHTML = `<div class="box pair"><div class="qr">${qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true })}</div><div>
        <h2>Vincular el celular de ${esc(p.name || 'el cliente')}</h2>
        <p>El cliente abre la app MatterAI y escanea este código (o abre el link desde el celular). Queda conectado a <b>${esc(p.url)}</b> sin ver nunca Home Assistant.</p>
        <div class="link" id="lnk">${esc(p.link)}</div>
        <div class="row"><button class="b pri" id="copy">Copiar link</button><a class="b" href="${esc(wa)}" target="_blank" rel="noopener" style="text-decoration:none">Mandar por WhatsApp</a><button class="b" id="print">Imprimir</button></div>
        <h3>¿Perdió el celular o querés cortar el acceso?</h3>
        <p class="mut">Un acceso nuevo deja sin conexión a todos los celulares vinculados hasta ahora: hay que volver a escanear.</p>
        <div class="row"><button class="b warn" id="regen">Generar acceso nuevo</button></div></div></div>`;
      const $ = (id) => main.querySelector(`#${id}`);
      $('copy').onclick = async () => { try { await navigator.clipboard.writeText(p.link); this._toast('Link copiado'); } catch (_) { this._toast('No se pudo copiar: seleccionalo a mano'); } };
      $('print').onclick = () => {
        const w = window.open('', '_blank');
        w.document.write(`<html><body style="font-family:sans-serif;text-align:center;padding:40px"><h1>${esc(p.name || 'Tu casa')}</h1><p>Abrí la app <b>MatterAI</b> y escaneá este código</p><div style="width:320px;margin:20px auto">${qr.createSvgTag({ cellSize: 6, margin: 2, scalable: true })}</div><p style="color:#888">MatterAI · Hogar inteligente</p></body></html>`);
        w.document.close(); w.focus(); w.print();
      };
      $('regen').onclick = () => { if (confirm('¿Generar un acceso nuevo? Los celulares vinculados tendrán que volver a escanear.')) this._renderApp(true); };
    }

    /* ---------- Estado ---------- */
    async _renderStatus() {
      const main = this.shadowRoot.getElementById('main');
      main.innerHTML = '<div class="box"><p class="mut">Revisando…</p></div>';
      let s;
      try { s = await this._hass.callWS({ type: 'matterai/status' }); } catch (e) { main.innerHTML = `<div class="box"><p>${esc(e.message || e)}</p></div>`; return; }
      const yes = (v, t = 'Sí', f = 'No') => (v ? `<b class="ok">${t}</b>` : `<b class="bad">${f}</b>`);
      const cors = !s.cors.known ? '<b class="wn">No se pudo revisar</b>' : s.cors.missing.length ? `<b class="bad">Falta</b>` : s.cors.needs_restart ? '<b class="wn">Reiniciar HA</b>' : '<b class="ok">OK</b>';
      const c = s.central;
      const central = !c.configured ? '<b class="mut">No configurado</b>' : c.ok === true ? '<b class="ok">Conectado</b>' : c.ok === false ? `<b class="bad">Sin conexión</b>` : '<b class="wn">Esperando…</b>';
      const al = s.health.alerts;
      let vl = { items: [], on: false };
      try { vl = await this._hass.callWS({ type: 'matterai/voice_log' }); } catch (_) { /* integración vieja */ }
      const WHY = { no: ['bad', 'No entendió'], duda: ['wn', 'Preguntó de vuelta'], ia: ['mut', 'Lo resolvió la IA'] };
      const when = (iso) => { try { return new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); } catch (_) { return ''; } };
      main.innerHTML = `<div class="st">
        <div class="box"><h2>Casa</h2>
          <div class="kv"><span>Cliente</span><b>${esc(s.name)}</b></div>
          <div class="kv"><span>Dirección remota</span><b>${esc(s.url)}</b></div>
          <div class="kv"><span>WhatsApp de soporte</span><b>${esc(s.support_phone || '—')}</b></div>
          <div class="kv"><span>Versión MatterAI</span><b>${esc(s.version)}</b></div>
          <div class="kv"><span>Home Assistant</span><b>${esc(s.health.ha_version)}</b></div>
          <div class="kv"><span>Id de la casa</span><b>${esc(s.house_id)}</b></div>
          ${s.imported_from ? `<p class="mut">El dashboard se trajo del panel «${esc(s.imported_from)}». Ya podés borrar ese panel si querés.</p>` : ''}
          <div class="row"><a class="b" style="text-decoration:none" href="/config/integrations/integration/matterai">Cambiar datos</a></div></div>
        <div class="box"><h2>Conexiones</h2>
          <div class="kv"><span>Acceso de la app (CORS)</span>${cors}</div>
          ${s.cors.missing.length ? `<p class="mut">En <b>Red → Orígenes permitidos por CORS</b> agregá (uno por renglón, sin barra al final):</p><div class="link">${s.cors.missing.map(esc).join('<br>')}</div>
            <div class="row"><a class="b pri" style="text-decoration:none" href="${esc(s.cors.page)}">Abrir Ajustes de red</a></div>` : ''}
          ${s.cors.needs_restart ? '<p class="mut">Se aplica al reiniciar Home Assistant.</p>' : ''}
          <div class="kv"><span>Panel central</span>${central}</div>
          ${c.error ? `<p class="mut">${esc(c.error)}</p>` : ''}
          ${c.configured ? `<div class="row"><button class="b" id="hb">Probar ahora</button>${c.url ? `<a class="b" href="${esc(c.url)}" target="_blank" rel="noopener">Abrir panel central</a>` : ''}</div>` : '<p class="mut">Cargá la clave de la casa en «Cambiar datos» para verla en tu panel central.</p>'}
          <div class="kv"><span>Automatizaciones</span>${yes(s.escenas, 'Activas', 'Iniciando…')}</div>
          <div class="kv"><span>Control por voz</span>${!s.voice.on ? '<b class="mut">Desactivado</b>' : s.voice.ai ? `<b class="ok">${s.voice.mode === 'ai' ? 'Con IA' : 'Gratis + IA'}</b>` : '<b class="ok">Gratis</b>'}</div>
          ${s.voice.on && !s.voice.ai ? '<p class="mut">Entiende los pedidos comunes sin costo. Para que entienda cualquier frase, cargá una clave de Anthropic en «Cambiar datos».</p>' : ''}</div>
        <div class="box"><h2>Avisos</h2>
          <div class="kv"><span>Entidades</span><b>${s.health.stats.entities}</b></div>
          <div class="kv"><span>Equipos sin responder</span><b class="${s.health.stats.unavailable ? 'wn' : 'ok'}">${s.health.stats.unavailable}</b></div>
          ${al.length ? al.map((a) => `<div class="al ${esc(a.level)}">${esc(a.text)}</div>`).join('') : '<p class="ok">Todo en orden</p>'}</div>
        ${vl.on ? `<div class="box vlog"><h2>Frases que la voz no entendió</h2>
          <p class="mut">Lo que el modo gratis no supo resolver. Pasale esta lista a quien mantiene MatterAI para sumar esas formas de hablar.</p>
          ${vl.items.length ? `<div class="vl">${vl.items.map((x) => `<div class="vli"><span class="vlw ${WHY[x.why] ? WHY[x.why][0] : ''}">${esc(WHY[x.why] ? WHY[x.why][1] : x.why)}</span><b>“${esc(x.text)}”</b><small>${esc(when(x.at))}${x.say ? ` · ${esc(x.say)}` : ''}</small></div>`).join('')}</div>
            <div class="row"><button class="b" id="vlcopy">Copiar lista</button><button class="b warn" id="vlclear">Borrar lista</button></div>` : '<p class="ok">Nada por ahora: entendió todo.</p>'}</div>` : ''}</div>`;
      const vc = main.querySelector('#vlclear');
      if (vc) vc.onclick = async () => { if (!confirm('¿Borrar la lista de frases?')) return; await this._hass.callWS({ type: 'matterai/voice_log', clear: true }); this._renderStatus(); };
      const vy = main.querySelector('#vlcopy');
      if (vy) vy.onclick = async () => { try { await navigator.clipboard.writeText(vl.items.map((x) => `${x.why}: ${x.text}`).join(String.fromCharCode(10))); this._toast('Lista copiada'); } catch (_) { this._toast('No se pudo copiar'); } };
      const hbBtn = main.querySelector('#hb');
      if (hbBtn) hbBtn.onclick = async () => { const r = await this._hass.callWS({ type: 'matterai/heartbeat' }); this._toast(r.ok ? 'Panel central: conectado' : `Panel central: ${r.error || 'sin conexión'}`); this._renderStatus(); };
    }
  }
  if (!customElements.get('matterai-admin-panel')) customElements.define('matterai-admin-panel', MatterAIAdminPanel);
})();
