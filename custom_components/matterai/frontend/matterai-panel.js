/*
 * Panel MatterAI (barra lateral de Home Assistant, sólo administradores = el instalador).
 * Es el sistema de gestión de MatterAI dentro de cada casa, separado en dos áreas:
 *   Resumen: cómo está la casa de un vistazo.
 *   App del cliente (lo que el instalador configura para la app MatterAI; el cliente nunca entra a este panel):
 *     Diseño de la app (editor + vista previa + Guardar), Automatizaciones, Vincular celulares.
 *   Sistema MatterAI (sólo el instalador):
 *     Salud y avisos, Mantenimiento (watchdog), Copias de seguridad, Plantillas, Conexiones, Voz, Ficha de la casa.
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
  const when = (iso) => { if (!iso) return ''; try { return new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); } catch (_) { return ''; } };
  const dur = (secs) => (secs < 120 ? `${secs} s` : secs < 7200 ? `${Math.round(secs / 60)} min` : `${Math.round(secs / 3600)} h`);
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const STORE_KEY = 'matterai-panel-page';

  /* Menú: k = página; g = título de grupo. scope: client = lo ve el cliente, system = interno. */
  const NAV = [
    { k: 'home', l: 'Resumen', i: 'mdi:view-dashboard-outline' },
    { g: 'App del cliente', d: 'Lo que configurás para la app MatterAI' },
    { k: 'dash', l: 'Diseño de la app', i: 'mdi:cellphone-cog' },
    { k: 'auto', l: 'Automatizaciones', i: 'mdi:robot-outline' },
    { k: 'app', l: 'Vincular celulares', i: 'mdi:qrcode' },
    { g: 'Sistema MatterAI', d: 'Control interno de la instalación' },
    { k: 'health', l: 'Salud y avisos', i: 'mdi:heart-pulse' },
    { k: 'wd', l: 'Mantenimiento', i: 'mdi:shield-sync-outline' },
    { k: 'backup', l: 'Copias de seguridad', i: 'mdi:backup-restore' },
    { k: 'tpl', l: 'Plantillas', i: 'mdi:package-variant-closed' },
    { k: 'conn', l: 'Conexiones', i: 'mdi:lan-connect' },
    { k: 'voice', l: 'Voz', i: 'mdi:microphone-outline' },
    { k: 'house', l: 'Ficha de la casa', i: 'mdi:home-city-outline' },
  ];
  const PAGES = {
    home: ['Resumen', 'Cómo está esta casa de un vistazo.', null],
    dash: ['Diseño de la app', 'Ambientes, equipos y cámaras que ve la familia. Los cambios llegan a la app recién al tocar Guardar.', 'client'],
    auto: ['Automatizaciones', 'Las del cliente y los equipos del instalador (portón inteligente, sensor de ocupación), que el cliente no ve.', 'client'],
    app: ['Vincular celulares', 'Código QR y link para que la familia conecte la app MatterAI a esta casa.', 'client'],
    health: ['Salud y avisos', 'Todo lo que hay que atender en esta casa. Lo mismo le llega al panel central.', 'system'],
    wd: ['Mantenimiento', 'Los servicios que MatterAI vigila y recupera solo: complementos e integraciones.', 'system'],
    backup: ['Copias de seguridad', 'El diseño de la app, las automatizaciones y sus ajustes. Restaurar todo o algunas.', 'system'],
    tpl: ['Plantillas', 'Automatizaciones y diseños armados acá para reutilizar en otras casas.', 'system'],
    conn: ['Conexiones', 'Acceso de la app, acceso remoto y panel central.', 'system'],
    voice: ['Voz', 'Control por voz de la app y las frases que no entendió.', 'system'],
    house: ['Ficha de la casa', 'Datos del cliente, versiones e identificación de la instalación.', 'system'],
  };
  const SCOPE = { client: ['mdi:cellphone', 'Se ve en la app del cliente'], system: ['mdi:lock-outline', 'Interno de MatterAI'] };
  const AUTO_REFRESH = new Set(['home', 'health', 'wd']);

  const CSS = `
  :host{display:block;min-height:100vh;background:var(--primary-background-color,#111);color:var(--primary-text-color,#eee);font-family:var(--paper-font-body1_-_font-family,system-ui,sans-serif)}
  header{position:sticky;top:0;z-index:6;box-sizing:border-box;height:56px;display:flex;align-items:center;gap:12px;padding:0 16px;background:var(--app-header-background-color,#1c1c1e);color:var(--app-header-text-color,#fff);box-shadow:0 2px 8px rgba(0,0,0,.25)}
  header .brand{display:flex;align-items:baseline;gap:8px;flex:1;min-width:0;white-space:nowrap;overflow:hidden}
  header .brand b{font-size:19px;font-weight:600;letter-spacing:.2px}
  header .brand span{font-size:13px;opacity:.7;overflow:hidden;text-overflow:ellipsis}
  header small{opacity:.6;font-size:12px}
  .menu{background:none;border:0;color:inherit;font-size:22px;cursor:pointer;padding:4px 6px}
  .pill{padding:5px 12px;border-radius:999px;font:inherit;font-size:12.5px;font-weight:600;cursor:pointer;border:0;white-space:nowrap;background:rgba(127,127,127,.2);color:inherit}
  .pill.ok{background:rgba(62,207,142,.2);color:#3ecf8e}.pill.wn{background:rgba(255,181,71,.2);color:#ffb547}.pill.bad{background:rgba(219,68,55,.25);color:#ff7a6e}
  .shell{display:grid;grid-template-columns:250px minmax(0,1fr)}
  aside{position:sticky;top:56px;align-self:start;box-sizing:border-box;height:calc(100vh - 56px);overflow:auto;padding:12px 10px 24px;border-right:1px solid var(--divider-color,rgba(255,255,255,.1))}
  aside .g{margin:20px 12px 6px;font-size:11px;letter-spacing:.08em;text-transform:uppercase;opacity:.55;font-weight:700}
  aside .g small{display:block;text-transform:none;letter-spacing:0;font-weight:400;font-size:11.5px;margin-top:2px}
  aside button{display:flex;align-items:center;gap:11px;width:100%;margin:1px 0;padding:9px 12px;border:0;border-radius:10px;background:none;color:inherit;font:inherit;font-size:14px;cursor:pointer;text-align:left;opacity:.82}
  aside button:hover{background:rgba(127,127,127,.12);opacity:1}
  aside button.on{background:rgba(3,169,244,.15);color:var(--primary-color,#03a9f4);opacity:1;font-weight:600}
  aside ha-icon{--mdc-icon-size:20px;flex:none}
  .cnt{margin-left:auto;min-width:18px;padding:1px 7px;border-radius:10px;font-size:11.5px;font-weight:700;text-align:center;background:var(--error-color,#db4437);color:#fff}
  .cnt.wn{background:#ffb547;color:#222}
  @media (max-width:900px){
    .shell{grid-template-columns:minmax(0,1fr)}
    aside{z-index:5;top:56px;height:auto;display:flex;gap:4px;overflow-x:auto;border-right:0;border-bottom:1px solid var(--divider-color,rgba(255,255,255,.1));background:var(--primary-background-color,#111);padding:8px 10px}
    aside .g{display:none}
    aside button{width:auto;flex:none;white-space:nowrap;margin:0}
  }
  main{padding:22px 24px 40px;max-width:1700px;min-width:0;box-sizing:border-box}
  @media (max-width:600px){main{padding:16px}}
  .ph{display:flex;align-items:flex-start;gap:14px;margin:0 0 18px;flex-wrap:wrap}
  .ph>div{flex:1;min-width:220px}
  .ph h1{margin:0;font-size:24px;font-weight:600}
  .ph p{margin:4px 0 0;opacity:.7;font-size:14px}
  .scope{display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:999px;font-size:12.5px;font-weight:600;white-space:nowrap}
  .scope ha-icon{--mdc-icon-size:16px}
  .scope.client{background:rgba(3,169,244,.15);color:var(--primary-color,#03a9f4)}
  .scope.system{background:rgba(127,127,127,.16)}
  /* editor y vista previa lado a lado sólo si hay lugar para los dos; si no, uno abajo del otro */
  .dash{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:18px;align-items:start}
  .dash>.box{min-width:0}
  @media (max-width:1400px){.dash{grid-template-columns:minmax(0,1fr)}.prev{position:static;max-height:none}}
  .box{background:var(--card-background-color,#1c1c1e);border-radius:16px;padding:16px 18px;box-shadow:var(--ha-card-box-shadow,none);border:1px solid var(--divider-color,rgba(255,255,255,.08));min-width:0}
  .prev{position:sticky;top:76px;max-height:calc(100vh - 96px);overflow:auto;border-radius:16px;padding:0}
  .bar{position:sticky;bottom:0;display:flex;gap:10px;align-items:center;justify-content:flex-end;padding:12px 0 4px;background:linear-gradient(transparent,var(--card-background-color,#1c1c1e) 30%)}
  .bar span{margin-right:auto;font-size:13px;opacity:.75}
  button.b{display:inline-flex;align-items:center;gap:6px;padding:9px 16px;border-radius:10px;border:1px solid var(--divider-color,rgba(255,255,255,.2));background:none;color:inherit;font:inherit;font-size:14px;cursor:pointer}
  button.b.pri{background:var(--primary-color,#03a9f4);border-color:transparent;color:#fff}
  a.b{display:inline-flex;align-items:center;padding:9px 16px;border-radius:10px;border:1px solid var(--divider-color,rgba(255,255,255,.2));color:inherit;text-decoration:none;font-size:14px}a.b.pri{color:#fff;background:var(--primary-color,#03a9f4);border-color:transparent}
  button.b:disabled{opacity:.4;cursor:default}
  button.b.warn{color:var(--error-color,#db4437)}
  .lnk{background:none;border:0;padding:0;color:var(--primary-color,#03a9f4);font:inherit;font-size:13.5px;cursor:pointer}
  .pair{display:grid;grid-template-columns:auto 1fr;gap:24px;align-items:start}
  @media (max-width:700px){.pair{grid-template-columns:1fr}}
  .qr{background:#fff;padding:14px;border-radius:14px;width:260px;height:260px;display:grid;place-items:center}
  .qr svg,.qr img{width:100%;height:100%}
  .link{word-break:break-all;font-size:12px;opacity:.8;padding:10px;border-radius:10px;background:rgba(127,127,127,.12);margin:8px 0}
  .row{display:flex;gap:10px;flex-wrap:wrap;margin:12px 0 2px}
  h2{margin:0 0 8px;font-size:17px;font-weight:600}h3{margin:18px 0 6px;font-size:15px}
  .bh{display:flex;align-items:center;gap:10px;margin-bottom:8px}.bh h2{margin:0;flex:1}
  p{margin:6px 0;line-height:1.5}.mut{opacity:.7;font-size:13px}
  .vl{display:flex;flex-direction:column;gap:6px;max-height:520px;overflow:auto;margin:8px 0}
  .vli{display:grid;grid-template-columns:auto 1fr;gap:2px 10px;align-items:baseline;padding:8px 10px;border-radius:10px;background:rgba(127,127,127,.08)}
  .vli small{grid-column:2;opacity:.65}.vlw{font-size:12px;font-weight:600;white-space:nowrap}
  .st{display:grid;grid-template-columns:repeat(auto-fill,minmax(330px,1fr));gap:16px;align-items:start}
  .wide{grid-column:1/-1}
  .tb{width:100%;border-collapse:collapse;font-size:14px;margin-top:8px}.tb th{text-align:left;font-weight:600;opacity:.7;font-size:12px;padding:6px 8px}.tb td{padding:8px;border-top:1px solid var(--divider-color,rgba(255,255,255,.08));vertical-align:top}.tb select{background:var(--card-background-color,#1c1c1c);color:inherit;border:1px solid var(--divider-color,#444);border-radius:8px;padding:4px 6px}
  .kv{display:flex;justify-content:space-between;gap:10px;padding:8px 0;border-bottom:1px solid var(--divider-color,rgba(255,255,255,.08));font-size:14px}
  .kv:last-of-type{border-bottom:0}
  .kv b{font-weight:600;text-align:right;word-break:break-word}
  .ok{color:#3ecf8e}.bad{color:var(--error-color,#db4437)}.wn{color:#ffb547}
  .al{display:flex;gap:10px;align-items:flex-start;padding:10px 12px;border-radius:10px;margin:6px 0;font-size:14px;background:rgba(127,127,127,.1)}
  .al ha-icon{--mdc-icon-size:18px;flex:none;margin-top:1px}
  .al.critical{background:rgba(219,68,55,.16)}.al.warning{background:rgba(255,181,71,.14)}
  .tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:14px;margin-bottom:16px}
  .tile{background:var(--card-background-color,#1c1c1e);border:1px solid var(--divider-color,rgba(255,255,255,.08));border-radius:16px;padding:14px 16px;cursor:pointer;text-align:left;color:inherit;font:inherit}
  .tile:hover{border-color:var(--primary-color,#03a9f4)}
  .tile small{display:flex;align-items:center;gap:6px;opacity:.7;font-size:12.5px}
  .tile small ha-icon{--mdc-icon-size:16px}
  .tile b{display:block;font-size:21px;margin:6px 0 2px;font-weight:600}
  .tile span{font-size:12.5px;opacity:.7}
  .svc{display:flex;flex-wrap:wrap;align-items:center;gap:4px 10px;padding:10px 0;border-bottom:1px solid var(--divider-color,rgba(255,255,255,.08));font-size:14px}
  .svc:last-of-type{border-bottom:0}
  .svc .nm{flex:1;min-width:0}.svc .dt{flex-basis:100%;opacity:.7;font-size:12.5px}
  .tag{font-size:11px;padding:1px 7px;border-radius:6px;background:rgba(127,127,127,.18);opacity:.85;margin-left:6px;font-weight:500}
  .lst{display:flex;flex-direction:column;gap:6px;max-height:340px;overflow:auto;margin:8px 0}
  .it{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:10px;background:rgba(127,127,127,.08)}
  .it .tx{flex:1;min-width:0}.it .t2{opacity:.65;font-size:12.5px}
  .it input{width:18px;height:18px}
  .fld{width:100%;box-sizing:border-box;padding:9px 11px;border-radius:10px;border:1px solid var(--divider-color,rgba(255,255,255,.2));background:rgba(127,127,127,.08);color:inherit;font:inherit;margin:4px 0}
  .res{padding:10px 12px;border-radius:10px;margin:8px 0;font-size:14px;background:rgba(62,207,142,.12)}
  .res.bad{background:rgba(219,68,55,.14)}
  .toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:#323232;color:#fff;padding:10px 18px;border-radius:10px;z-index:20;font-size:14px}
  `;
  const KIND = { scene: 'Escena', auto: 'Automática', period: 'Horario', timer: 'Temporizador', loop: 'Ciclo', presence: 'Simular presencia', irrigation: 'Riego', circadian: 'Luz circadiana', room: 'Luz por presencia', watch: 'Avisar si quedó abierto', away: 'Me voy / Llego', night: 'Buenas noches', clima: 'Clima', wake: 'Despertador', reminder: 'Recordatorio', calalert: 'Calendario', doorbell: 'Portero', fdetect: 'Cámaras', fface: 'Caras y patentes', tv: 'Tele', guest: 'Invitados', gate: 'Portón inteligente' };
  const SVC_CLS = { ok: 'ok', recuperando: 'wn', esperando_hardware: 'wn', esperando_dependencia: 'wn', caido: 'bad', atencion_manual: 'bad', mantenimiento: 'mut', sin_datos: 'mut' };
  const AL_ICON = { critical: 'mdi:alert-octagon', warning: 'mdi:alert', info: 'mdi:information-outline' };

  class MatterAIAdminPanel extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      let saved = null;
      try { saved = localStorage.getItem(STORE_KEY); } catch (_) { /* sin almacenamiento */ }
      this._tab = PAGES[saved] ? saved : 'home';
      this._saved = null; this._draft = null; this._pair = null; this._cache = null;
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
      if (this._hass && this._tab && AUTO_REFRESH.has(this._tab)) this._startRefresh();
    }
    disconnectedCallback() { clearInterval(this._timer); }

    async _init() {
      const nav = NAV.map((n) => (n.g ? `<div class="g">${esc(n.g)}<small>${esc(n.d)}</small></div>`
        : `<button data-tab="${n.k}" class="${n.k === this._tab ? 'on' : ''}"><ha-icon icon="${n.i}"></ha-icon><span>${esc(n.l)}</span><i class="cnt" id="cnt_${n.k}" hidden></i></button>`)).join('');
      this.shadowRoot.innerHTML = `<style>${CSS}</style>
        <header><button class="menu" id="menu" title="Menú">☰</button><div class="brand"><b>MatterAI</b><span id="hname"></span></div><button class="pill" id="pill" hidden></button><small id="ver"></small></header>
        <div class="shell"><aside>${nav}</aside><main id="main"><p class="mut">Cargando…</p></main></div>`;
      const $ = (id) => this.shadowRoot.getElementById(id);
      $('menu').onclick = () => this.dispatchEvent(new Event('hass-toggle-menu', { bubbles: true, composed: true }));
      this.shadowRoot.querySelector('aside').onclick = (e) => { const b = e.target.closest('[data-tab]'); if (b) this._go(b.dataset.tab); };
      $('pill').onclick = () => this._go('health');
      // atajos dentro de las páginas: cualquier botón con data-go
      $('main').addEventListener('click', (e) => { const b = e.target.closest('[data-go]'); if (b) this._go(b.dataset.go); });
      try {
        const cardUrl = (this._panel && this._panel.config && this._panel.config.card_url) || `${BASE}/matterai-home-card.js`;
        if (!customElements.get('matterai-home-card')) await import(/* webpackIgnore: true */ cardUrl);
        loadLovelaceResources(this._hass); // sin esperar: la tarjeta cambia a la de cámaras apenas esté
        const r = await this._hass.callWS({ type: 'matterai/config' });
        this._saved = JSON.stringify(r.config); this._draft = r.config;
        $('hname').textContent = r.name ? `· ${r.name}` : '';
        $('ver').textContent = `v${r.version}`;
      } catch (e) {
        $('main').innerHTML = `<div class="box"><h2>No se pudo cargar</h2><p>${esc(e.message || e)}</p></div>`;
        return;
      }
      this._go(this._tab);
      if (this._tab !== 'home' && this._tab !== 'health') this._data(true).catch(() => {}); // para el estado de arriba
    }
    _go(tab) {
      if (!PAGES[tab]) tab = 'home';
      if (this._tab === 'dash' && tab !== 'dash' && this._dirty() && !confirm('Hay cambios sin guardar en el diseño de la app. ¿Salir igual?')) return;
      this._tab = tab;
      try { localStorage.setItem(STORE_KEY, tab); } catch (_) { /* sin almacenamiento */ }
      this.shadowRoot.querySelectorAll('aside [data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
      const on = this.shadowRoot.querySelector('aside .on'); if (on && on.scrollIntoView && this._narrow) on.scrollIntoView({ inline: 'center', block: 'nearest' });
      this._auto = null; this._card = null; this._editor = null;
      clearInterval(this._timer);
      this._render(tab);
      if (AUTO_REFRESH.has(tab)) this._startRefresh();
    }
    _startRefresh() {
      clearInterval(this._timer);
      // las páginas de estado se actualizan solas (no tienen campos para escribir)
      this._timer = setInterval(() => { if (!document.hidden && AUTO_REFRESH.has(this._tab)) this._render(this._tab, true); }, 30000);
    }
    _render(tab, quiet = false) {
      const R = { home: this._renderHome, dash: this._renderDash, auto: this._renderAuto, app: this._renderApp, health: this._renderHealth, wd: this._renderWd,
        backup: () => this._renderCopias('backup'), tpl: () => this._renderCopias('tpl'), conn: this._renderConn, voice: this._renderVoice, house: this._renderHouse };
      const main = this.shadowRoot.getElementById('main');
      if (!quiet) main.innerHTML = `${this._head(tab)}<div class="box"><p class="mut">Cargando…</p></div>`;
      Promise.resolve(R[tab].call(this, quiet)).catch((e) => {
        if (this._tab === tab) main.innerHTML = `${this._head(tab)}<div class="box"><h2>No se pudo cargar</h2><p>${esc(e.message || e)}</p></div>`;
      });
    }
    /** Encabezado de cada página: título, para qué sirve y si lo ve el cliente o es interno. */
    _head(tab, extra = '') {
      const [t, d, scope] = PAGES[tab];
      const sc = scope ? `<span class="scope ${scope}"><ha-icon icon="${SCOPE[scope][0]}"></ha-icon>${SCOPE[scope][1]}</span>` : '';
      return `<div class="ph"><div><h1>${esc(t)}</h1><p>${esc(d)}</p></div>${extra}${sc}</div>`;
    }
    _page(tab, body) {
      if (this._tab !== tab) return null;
      const main = this.shadowRoot.getElementById('main');
      main.innerHTML = this._head(tab) + body;
      return main;
    }
    _toast(msg) {
      const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
      this.shadowRoot.appendChild(t); setTimeout(() => t.remove(), 2600);
    }
    _dirty() { return this._draft && JSON.stringify(this._draft) !== this._saved; }

    /* ---------- datos compartidos (estado + watchdog), con el resumen de arriba ---------- */
    async _data(force = false) {
      if (!force && this._cache && Date.now() - this._cache.at < 5000) return this._cache;
      const [s, wd] = await Promise.all([
        this._hass.callWS({ type: 'matterai/status' }),
        this._hass.callWS({ type: 'matterai/watchdog' }).catch(() => null),
      ]);
      this._cache = { s, wd, at: Date.now() };
      this._summary(s, wd);
      return this._cache;
    }
    _summary(s, wd) {
      const al = s.health.alerts || [];
      const crit = al.filter((a) => a.level === 'critical').length;
      const warn = al.filter((a) => a.level === 'warning').length;
      const pill = this.shadowRoot.getElementById('pill');
      pill.hidden = false;
      if (wd && wd.maintenance_until) { pill.className = 'pill wn'; pill.textContent = '🔧 En mantenimiento'; }
      else if (crit) { pill.className = 'pill bad'; pill.textContent = `${plural(crit + warn, 'aviso', 'avisos')}`; }
      else if (warn) { pill.className = 'pill wn'; pill.textContent = `${plural(warn, 'aviso', 'avisos')}`; }
      else { pill.className = 'pill ok'; pill.textContent = 'Todo en orden'; }
      const cnt = (k, n, cls) => { const el = this.shadowRoot.getElementById(`cnt_${k}`); if (!el) return; el.hidden = !n; el.textContent = n; el.className = `cnt ${cls}`; };
      cnt('health', crit + warn, crit ? '' : 'wn');
      const bad = wd ? wd.services.filter((x) => !['ok', 'sin_datos', 'mantenimiento'].includes(x.status)).length + (wd.integrations || []).length : 0;
      cnt('wd', bad, wd && wd.services.some((x) => x.status === 'atencion_manual' || x.status === 'caido') ? '' : 'wn');
    }
    _alerts(al, max = 0) {
      const list = max ? al.slice(0, max) : al;
      return list.length ? list.map((a) => `<div class="al ${esc(a.level)}"><ha-icon icon="${AL_ICON[a.level] || AL_ICON.info}"></ha-icon><span>${esc(a.text)}</span></div>`).join('')
        + (max && al.length > max ? `<p class="mut">y ${al.length - max} más…</p>` : '')
        : '<div class="al"><ha-icon icon="mdi:check-circle-outline" class="ok"></ha-icon><span class="ok">Todo en orden</span></div>';
    }

    /* ---------- Resumen ---------- */
    async _renderHome() {
      const { s, wd } = await this._data(true);
      const c = s.central, al = s.health.alerts || [], st = s.health.stats;
      const svcs = wd ? wd.services : [];
      const okSvc = svcs.filter((x) => x.status === 'ok').length;
      const crit = al.some((a) => a.level === 'critical');
      const outdated = c.latest && c.latest !== s.version;
      const tile = (go, icon, label, value, cls, sub) => `<button class="tile" data-go="${go}"><small><ha-icon icon="${icon}"></ha-icon>${esc(label)}</small><b class="${cls}">${value}</b><span>${sub}</span></button>`;
      const alertsN = al.filter((a) => a.level !== 'info').length;
      this._page('home', `<div class="tiles">
          ${tile('health', 'mdi:heart-pulse', 'Estado de la casa', alertsN ? plural(alertsN, 'aviso', 'avisos') : 'Todo en orden', alertsN ? (crit ? 'bad' : 'wn') : 'ok', alertsN ? 'Ver qué hay que atender' : 'Sin nada pendiente')}
          ${tile('wd', 'mdi:shield-sync-outline', 'Servicios vigilados', wd ? (svcs.length ? `${okSvc} de ${svcs.length}` : '—') : '…', wd && okSvc < svcs.length ? 'wn' : 'ok', wd && wd.maintenance_until ? `En mantenimiento hasta ${esc(when(wd.maintenance_until))}` : 'funcionando')}
          ${tile('health', 'mdi:lan-disconnect', 'Equipos sin responder', st.unavailable, st.unavailable ? 'wn' : 'ok', `de ${st.entities} entidades`)}
          ${tile('backup', 'mdi:backup-restore', 'Última copia', c.configured ? (c.last_backup ? esc(when(c.last_backup)) : 'Todavía no') : 'Sin panel central', c.configured && c.last_backup ? 'ok' : 'wn', c.configured ? 'en el panel central' : 'cargá la clave de la casa')}
          ${tile('house', 'mdi:tag-outline', 'Versión MatterAI', esc(s.version), outdated ? 'wn' : 'ok', outdated ? `hay ${esc(c.latest)} disponible` : c.latest ? 'la última' : 'Home Assistant ' + esc(s.health.ha_version))}
        </div>
        <div class="st">
          <div class="box"><div class="bh"><h2>App del cliente</h2><span class="scope client"><ha-icon icon="mdi:cellphone"></ha-icon>Lo que ve en la app</span></div>
            <div class="kv"><span>Casa</span><b>${esc(s.name)}</b></div>
            <div class="kv"><span>Automatizaciones</span><b>${st.automations != null ? st.automations : '—'}</b></div>
            <div class="kv"><span>Control por voz</span><b>${!s.voice.on ? 'Desactivado' : s.voice.ai ? (s.voice.mode === 'ai' ? 'Con IA' : 'Gratis + IA') : 'Gratis'}</b></div>
            <div class="kv"><span>WhatsApp de soporte</span><b>${esc(s.support_phone || '—')}</b></div>
            <div class="row"><button class="b" data-go="dash">Diseño de la app</button><button class="b" data-go="auto">Automatizaciones</button><button class="b" data-go="app">Vincular celulares</button></div></div>
          <div class="box"><div class="bh"><h2>Avisos</h2><button class="lnk" data-go="health">Ver todos</button></div>${this._alerts(al, 5)}</div>
          <div class="box"><div class="bh"><h2>Servicios</h2><button class="lnk" data-go="wd">Mantenimiento</button></div>
            ${svcs.length ? svcs.map((x) => `<div class="kv"><span>${esc(x.name)}</span><b class="${SVC_CLS[x.status] || ''}">${esc(x.status_text)}</b></div>`).join('') : '<p class="mut">Nada para vigilar en esta casa.</p>'}
            ${wd && wd.remote ? `<div class="kv"><span>Acceso remoto</span><b class="${wd.remote.kind === 'ok' ? 'ok' : wd.remote.kind === 'tunnel' ? 'bad' : 'mut'}">${wd.remote.kind === 'ok' ? 'Responde' : wd.remote.kind === 'tunnel' ? 'Túnel caído' : 'Sin internet'}</b></div>` : ''}
            <div class="kv"><span>Panel central</span><b class="${c.ok ? 'ok' : c.configured ? 'bad' : 'mut'}">${!c.configured ? 'No configurado' : c.ok ? 'Conectado' : c.ok === false ? 'Sin conexión' : 'Esperando…'}</b></div></div>
        </div>`);
    }

    /* ---------- Salud y avisos ---------- */
    async _renderHealth() {
      const { s } = await this._data(true);
      const al = s.health.alerts || [], st = s.health.stats;
      const grp = (lvl, title) => { const l = al.filter((a) => a.level === lvl); return l.length ? `<h3>${title} (${l.length})</h3>${this._alerts(l)}` : ''; };
      const main = this._page('health', `<div class="st">
        <div class="box wide"><div class="bh"><h2>Avisos</h2><button class="b" id="rf">Revisar ahora</button></div>
          ${al.length ? grp('critical', 'Urgentes') + grp('warning', 'Para atender') + grp('info', 'Para tener en cuenta') : this._alerts([])}
          <p class="mut">Los urgentes y los «para atender» le llegan también al panel central (y por Telegram si sigue pasando 10 minutos).</p></div>
        <div class="box"><h2>La casa en números</h2>
          <div class="kv"><span>Entidades</span><b>${st.entities}</b></div>
          <div class="kv"><span>Equipos sin responder</span><b class="${st.unavailable ? 'wn' : 'ok'}">${st.unavailable}</b></div>
          <div class="kv"><span>Luces prendidas</span><b>${st.lights_on != null ? st.lights_on : '—'}</b></div>
          <div class="kv"><span>Automatizaciones</span><b>${st.automations != null ? st.automations : '—'}</b></div></div>
        <div class="box"><h2>En Home Assistant</h2>
          <p class="mut">Para revisar a fondo lo que MatterAI no resuelve solo.</p>
          <div class="row"><a class="b" href="/config/repairs">Reparaciones</a><a class="b" href="/config/integrations/dashboard">Integraciones</a><a class="b" href="/config/logs">Registros</a></div></div>
      </div>`);
      if (main) main.querySelector('#rf').onclick = () => this._render('health');
    }

    /* ---------- Mantenimiento del sistema (watchdog) ---------- */
    async _renderWd() {
      const { wd } = await this._data(true);
      const main = this._page('wd', this._wdBox(wd));
      if (!main) return;
      const wdAct = (m, ok) => this._hass.callWS({ type: 'matterai/watchdog', ...m }).then(() => { if (ok) this._toast(ok); this._render('wd'); }, (e) => this._toast(e.message || String(e)));
      const on = (id, fn) => { const el = main.querySelector('#' + id); if (el) el.onclick = fn; };
      on('wdmaint', () => wdAct({ maintenance_minutes: 60 }, 'Mantenimiento activado por 1 hora'));
      on('wdoff', () => wdAct({ maintenance_minutes: 0 }, 'Mantenimiento desactivado: vuelve a vigilar'));
      on('wdcheck', () => wdAct({ check: true }, 'Revisado'));
    }
    _wdBox(wd) {
      if (!wd) return '<div class="box"><p class="mut">El mantenimiento del sistema está iniciando…</p></div>';
      const noSup = wd.available ? '' : '<p class="mut">Esta casa no tiene Supervisor (Home Assistant Core o Container): no se pueden vigilar complementos, sólo integraciones.</p>';
      const svc = wd.services.length ? wd.services.map((x) => {
        const det = [x.detail, x.down_since ? `caído desde ${when(x.down_since)}` : '', x.attempts ? `${x.attempts} intento(s)` : '', x.restarts ? `${x.restarts} recuperación(es) automática(s) en total` : '',
          !x.down_since && x.last_down_secs ? `última caída: ${dur(x.last_down_secs)}${x.recovered_at ? `, volvió el ${when(x.recovered_at)}` : ''}` : '', x.update_note].filter(Boolean).join(' · ');
        return `<div class="svc"><span class="nm">${esc(x.name)}<span class="tag">${x.kind === 'integration' ? 'integración' : 'complemento'}</span>${x.version ? ` <span class="mut">${esc(x.version)}</span>` : ''}</span><b class="${SVC_CLS[x.status] || ''}">${esc(x.status_text)}</b>${det ? `<span class="dt">${esc(det)}</span>` : ''}</div>`;
      }).join('') : '<p class="mut">No hay servicios para vigilar en esta casa (Zigbee2MQTT, Mosquitto, Cloudflared, TTLock…).</p>';
      const ints = (wd.integrations || []).map((x) => `<div class="svc"><span class="nm">${esc(x.title)}<span class="tag">${esc(x.domain)}</span></span><b class="${x.attempts >= 6 ? 'bad' : 'wn'}">${x.attempts ? `recargada ${plural(x.attempts, 'vez', 'veces')}` : 'sin arrancar'}</b><span class="dt">${esc(`no arrancó (${x.state || ''}) desde ${when(x.since)}`)}</span></div>`).join('');
      const bridges = Object.entries(wd.bridges || {});
      const extra = [
        bridges.length ? `<div class="kv"><span>Zigbee2MQTT por MQTT</span><b>${bridges.map(([b, v]) => `${esc(b)} ${v.state === 'online' ? '<span class="ok">online</span>' : '<span class="bad">offline</span>'}`).join(' · ')}</b></div>` : '',
        wd.remote ? `<div class="kv"><span>Acceso remoto</span><b class="${wd.remote.kind === 'ok' ? 'ok' : wd.remote.kind === 'tunnel' ? 'bad' : 'mut'}">${wd.remote.kind === 'ok' ? 'Responde' : esc(wd.remote.detail)}</b></div>` : '',
        wd.coordinator && !wd.coordinator.ok ? `<div class="al warning"><ha-icon icon="mdi:alert"></ha-icon><span>${esc(wd.coordinator.detail)}</span></div>` : '',
      ].join('');
      return `<div class="st">
        <div class="box wide"><div class="bh"><h2>Servicios vigilados</h2><button class="b" id="wdcheck">Revisar ahora</button></div>
          ${noSup}${svc}
          ${ints ? `<h3>Integraciones que no arrancaron</h3><p class="mut">Se recargan solas, con esperas cada vez más largas.</p>${ints}` : ''}
          ${wd.last_check ? `<p class="mut">Último chequeo: ${esc(when(wd.last_check))}. Revisa cada minuto.</p>` : ''}</div>
        <div class="box"><h2>Modo mantenimiento</h2>
          ${wd.maintenance_until ? `<div class="al warning"><ha-icon icon="mdi:wrench-clock"></ha-icon><span>En mantenimiento hasta las ${esc(when(wd.maintenance_until))}: no reinicia nada ni avisa.</span></div>` : '<p>Pausa la vigilancia: no reinicia nada ni avisa. Se apaga sola a la hora.</p>'}
          <p class="mut">Usalo antes de actualizar el firmware del coordinador o un complemento a mano.</p>
          <div class="row">${wd.maintenance_until ? '<button class="b pri" id="wdoff">Terminar mantenimiento</button>' : '<button class="b" id="wdmaint">Activar por 1 hora</button>'}</div></div>
        ${extra ? `<div class="box"><h2>Conexiones de los servicios</h2>${extra}</div>` : ''}
        <div class="box"><h2>Cómo trabaja</h2>
          <p class="mut">Recupera primero las dependencias (Mosquitto antes que Zigbee2MQTT), espera cada vez más entre intentos (1, 2, 5, 15, 30, 60 min) y después de 6 queda en «atención manual». Si un servicio sigue caído, avisa al panel central y, pasados 20 minutos, en Reparaciones.</p></div>
      </div>`;
    }

    /* ---------- Automatizaciones (vista del instalador) ---------- */
    async _renderAuto() {
      // la tarjeta la sirve la integración; puede tardar un momento en definirse
      const ok = customElements.get('matterai-escenas-card') || await Promise.race([
        customElements.whenDefined('matterai-escenas-card').then(() => true),
        new Promise((r) => setTimeout(() => r(false), 4000)),
      ]);
      if (!ok) {
        this._page('auto', '<div class="box"><h2>No se pudieron cargar las automatizaciones</h2><p>Recargá la página (Ctrl+F5). Si sigue igual, reiniciá Home Assistant.</p></div>');
        return;
      }
      const main = this._page('auto', `<div class="box" style="margin-bottom:14px"><p class="mut" style="margin:0">Con <b>⚙</b> elegís qué puede crear el cliente y qué equipos ve. A una automatización tuya le podés poner <b>🔒</b> para que el cliente sólo la active o la pause. Los <b>equipos del instalador</b> (portón inteligente, sensor de ocupación) el cliente no los ve.</p></div><div id="auto"></div>`);
      if (!main) return;
      const card = document.createElement('matterai-escenas-card');
      card.setConfig({ title: 'Automatizaciones' });
      card.hass = this._hass;
      main.querySelector('#auto').appendChild(card);
      this._auto = card;
    }

    /* ---------- Copias de seguridad / Plantillas ---------- */
    _download(name, obj) {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' }));
      a.download = name; a.click();
    }
    _pickFile() {
      return new Promise((res) => {
        const i = document.createElement('input'); i.type = 'file'; i.accept = '.json,application/json';
        i.onchange = async () => { try { res(JSON.parse(await i.files[0].text())); } catch (_) { this._toast('Ese archivo no se puede leer'); res(null); } };
        i.click();
      });
    }
    async _renderCopias(mode) {
      const [{ s: st }, exp] = await Promise.all([this._data(), this._hass.callWS({ type: 'matterai/backup/export' })]);
      const rules = (exp.data.automations && exp.data.automations.rules) || [];
      const c = st.central;
      const noCentral = !c.configured ? '<p class="mut">Esto usa el <b>panel central</b>: cargá la clave de la casa en <button class="lnk" data-go="house">Ficha de la casa → Cambiar datos</button>.</p>' : '';
      const body = mode === 'backup' ? `<div class="st">
        <div class="box"><h2>Copia de seguridad</h2>
          <p class="mut">${c.configured ? 'Se manda sola al panel central cada vez que cambia algo (revisa cada 15 minutos).' : 'Sin panel central, bajala como archivo.'}</p>
          ${c.configured ? `<div class="kv"><span>Última copia en el panel central</span><b class="${c.last_backup ? 'ok' : 'mut'}">${c.last_backup ? esc(when(c.last_backup)) : 'Todavía no'}</b></div>${c.backup_error ? `<p class="bad">${esc(c.backup_error)}</p>` : ''}` : noCentral}
          <div class="row">${c.configured ? '<button class="b pri" id="bsend">Mandar copia ahora</button>' : ''}<button class="b" id="bdl">Bajar copia (archivo)</button></div></div>
        <div class="box"><h2>Restaurar</h2>
          <p class="mut">Antes de restaurar se guarda cómo está ahora, así lo podés deshacer.${c.configured ? ' Las copias del panel central se restauran desde el panel central (botón «Copias» de la casa).' : ''}</p>
          <div class="row"><button class="b" id="bup">Restaurar todo desde un archivo…</button><button class="b" id="bsome">Restaurar algunas automatizaciones…</button></div>
          <div class="row"><button class="b" id="bundo">Deshacer la última restauración</button></div>
          <div id="bres"></div></div></div>`
        : `<div class="st">
        <div class="box"><h2>Automatizaciones</h2>
          <p class="mut">Guardá automatizaciones de esta casa para usarlas en otras (por ejemplo «Baño con presencia y extractor»). En la otra casa llegan <b>pausadas</b>: elegís los equipos de esa casa y las activás.</p>
          ${noCentral}
          <h3>Guardar como plantilla</h3>
          ${rules.length ? `<div class="lst" id="trules">${rules.map((r) => `<label class="it"><input type="checkbox" value="${esc(r.id)}"><span class="tx"><b>${esc(r.name)}</b><div class="t2">${esc(KIND[r.kind] || r.kind)}${r.enabled === false ? ' · pausada' : ''}</div></span></label>`).join('')}</div>
            <input class="fld" id="tname" placeholder="Nombre de la plantilla (ej: Baño con presencia)" maxlength="80">
            <input class="fld" id="tdesc" placeholder="Descripción (opcional)" maxlength="500">
            <div class="row">${c.configured ? '<button class="b pri" id="tsave">Guardar en el panel central</button>' : ''}<button class="b" id="tfile">Bajar como archivo</button></div>` : '<p class="mut">Todavía no hay automatizaciones en esta casa.</p>'}
          <h3>Usar una plantilla</h3>
          <div id="tlist">${c.configured ? '<p class="mut">Cargando plantillas…</p>' : ''}</div>
          <div class="row"><button class="b" id="tup">Usar un archivo…</button></div>
          <div id="tres"></div></div>
        <div class="box"><h2>Diseño de la app</h2>
          <p class="mut">Guardá el diseño de la app de esta casa para arrancar otra igual. Al usar un diseño se carga en <button class="lnk" data-go="dash">Diseño de la app</button>: lo revisás, ajustás los ambientes y recién ahí lo guardás.</p>
          ${noCentral}
          <input class="fld" id="dname" placeholder="Nombre (ej: Casa con pileta y quincho)" maxlength="80">
          <div class="row">${c.configured ? '<button class="b pri" id="dsave">Guardar en el panel central</button>' : ''}<button class="b" id="dfile">Bajar como archivo</button></div>
          <h3>Usar un diseño</h3>
          <div id="dlist">${c.configured ? '<p class="mut">Cargando…</p>' : ''}</div>
          <div class="row"><button class="b" id="dup">Usar un archivo…</button></div></div></div>`;
      const main = this._page(mode, body);
      if (!main) return;
      const $ = (id) => main.querySelector('#' + id);
      const on = (id, fn) => { const el = $(id); if (el) el.onclick = fn; };
      const ws = (m) => this._hass.callWS(m);
      const fail = (e) => this._toast(e.message || String(e));
      const again = () => { this._cache = null; this._render(mode); };
      const fname = (n) => (n || 'matterai').toLowerCase().split(' ').join('-');
      const showRes = (box, r) => {
        if (r.kind === 'dashboard') return this._useDashboard(r.config);
        const lines = [`✓ Se sumaron ${r.created.length} automatización(es), <b>pausadas</b>: revisalas en <button class="lnk" data-go="auto">Automatizaciones</button> y activalas.`];
        if (r.failed.length) lines.push(`✗ No se pudieron sumar: ${r.failed.map((f) => `${esc(f.name)} (${esc(f.error)})`).join('; ')}`);
        const cand = r.candidates || {};
        const map = r.missing.length && r.created.length ? `<h3>Emparejar equipos</h3>
          <p class="mut">La plantilla usa equipos que en esta casa no existen. Elegí el equivalente de esta casa para cada uno (se cambia en todas las automatizaciones que se sumaron):</p>
          <div class="lst">${r.missing.map((m) => `<div class="it"><span class="tx"><b>${esc(m)}</b></span><select class="fld" style="width:auto;max-width:60%" data-from="${esc(m)}"><option value="">(dejarlo así)</option>${(cand[m] || []).map((o) => `<option value="${esc(o.id)}">${esc(o.name)} · ${esc(o.id)}</option>`).join('')}</select></div>`).join('')}</div>
          <div class="row"><button class="b pri" id="${box}_map">Usar estos equipos</button></div>` : '';
        $(box).innerHTML = `<div class="res ${r.failed.length ? 'bad' : ''}">${lines.join('<br>')}</div>${map}`;
        on(`${box}_map`, () => {
          const mapping = {};
          $(box).querySelectorAll('select[data-from]').forEach((sel) => { if (sel.value) mapping[sel.dataset.from] = sel.value; });
          if (!Object.keys(mapping).length) return this._toast('Elegí al menos un equipo');
          ws({ type: 'matterai/templates/remap', rule_ids: r.created.map((x) => x.id), mapping }).then((x) => {
            $(box).innerHTML = `<div class="res">✓ Equipos cambiados en ${x.changed} automatización(es).${x.missing.length ? ` Todavía faltan: ${x.missing.map(esc).join(', ')} (cambialos en cada automatización).` : ' Revisalas en Automatizaciones y activalas.'}</div>`;
          }, fail);
        });
      };

      // copias
      on('bsend', () => ws({ type: 'matterai/backup/send' }).then(() => { this._toast('Copia mandada al panel central'); again(); }, fail));
      on('bdl', () => ws({ type: 'matterai/backup/export' }).then((r) => this._download(`copia-${fname(st.name)}-${new Date().toISOString().slice(0, 10)}.json`, r.data), fail));
      on('bup', async () => {
        const data = await this._pickFile(); if (!data) return;
        if (!confirm('¿Restaurar esta copia? Se reemplazan el diseño de la app y TODAS las automatizaciones de esta casa (lo actual queda guardado para deshacer).')) return;
        ws({ type: 'matterai/backup/restore', data }).then((r) => { $('bres').innerHTML = `<div class="res">✓ Restaurada: ${r.automations ?? 0} automatizaciones${r.dashboard ? ' y el diseño de la app' : ''}.</div>`; this._reloadConfig(); }, fail);
      });
      on('bsome', async () => {
        const data = await this._pickFile(); if (!data) return;
        const list = (data.automations && data.automations.rules) || [];
        if (!list.length) return this._toast('Ese archivo no trae automatizaciones');
        const here = new Set(rules.map((r) => r.id));
        $('bres').innerHTML = `<h3>¿Cuáles restaurar?</h3><p class="mut">Las que ya existen se reemplazan por la versión de la copia; las que no, se suman. El resto queda como está.</p>
          <div class="lst" id="srules">${list.map((r) => `<label class="it"><input type="checkbox" value="${esc(r.id)}"><span class="tx"><b>${esc(r.name)}</b><div class="t2">${esc(KIND[r.kind] || r.kind)} · ${here.has(r.id) ? 'reemplaza la actual' : 'se suma'}</div></span></label>`).join('')}</div>
          <div class="row"><button class="b pri" id="sdo">Restaurar las elegidas</button></div>`;
        on('sdo', () => {
          const ids = [...main.querySelectorAll('#srules input:checked')].map((i) => i.value);
          if (!ids.length) return this._toast('Elegí al menos una');
          ws({ type: 'matterai/backup/restore_some', data, rule_ids: ids }).then((x) => { $('bres').innerHTML = `<div class="res">✓ Restauradas ${x.restored} automatización(es).</div>`; }, fail);
        });
      });
      on('bundo', () => { if (confirm('¿Volver a como estaba antes de la última restauración?')) ws({ type: 'matterai/backup/restore', undo: true }).then(() => { this._toast('Listo: volvió a como estaba'); this._reloadConfig(); }, fail); });

      // plantillas
      const tsave = (toFile) => {
        const ids = [...main.querySelectorAll('#trules input:checked')].map((i) => i.value); const name = $('tname').value.trim();
        if (!ids.length) return this._toast('Elegí las automatizaciones');
        if (!name) return this._toast('Ponele un nombre');
        ws({ type: 'matterai/templates/save', kind: 'automations', name, description: $('tdesc').value.trim(), rule_ids: ids, to_file: toFile })
          .then((r) => { if (toFile) this._download(`plantilla-${fname(name)}.json`, r.file); else { this._toast('Plantilla guardada en el panel central'); again(); } }, fail);
      };
      on('tsave', () => tsave(false));
      on('tfile', () => tsave(true));
      on('tup', async () => { const f = await this._pickFile(); if (f) ws({ type: 'matterai/templates/use', file: f }).then((r) => showRes('tres', r), fail); });
      const dsave = (toFile) => {
        const name = $('dname').value.trim(); if (!name) return this._toast('Ponele un nombre');
        ws({ type: 'matterai/templates/save', kind: 'dashboard', name, to_file: toFile })
          .then((r) => { if (toFile) this._download(`diseno-${fname(name)}.json`, r.file); else { this._toast('Diseño guardado en el panel central'); again(); } }, fail);
      };
      on('dsave', () => dsave(false));
      on('dfile', () => dsave(true));
      on('dup', async () => { const f = await this._pickFile(); if (f) ws({ type: 'matterai/templates/use', file: f }).then((r) => showRes('tres', r), fail); });

      if (mode !== 'tpl' || !c.configured) return;
      const list = (box, kind) => ws({ type: 'matterai/templates/list', kind }).then((r) => {
        if (this._tab !== 'tpl') return;
        $(box).innerHTML = r.templates.length ? `<div class="lst">${r.templates.map((t) => `<div class="it"><span class="tx"><b>${esc(t.name)}</b><div class="t2">${esc([t.description, t.summary && t.summary.count != null ? `${t.summary.count} automatizaciones` : '', t.source ? `de ${t.source}` : ''].filter(Boolean).join(' · '))}</div></span><button class="b" data-use="${esc(t.id)}">Usar</button></div>`).join('')}</div>`
          : '<p class="mut">Todavía no hay plantillas en el panel central.</p>';
        $(box).querySelectorAll('[data-use]').forEach((b) => {
          b.onclick = () => {
            if (kind === 'automations' && !confirm('¿Sumar estas automatizaciones a esta casa? Llegan pausadas.')) return;
            b.disabled = true;
            ws({ type: 'matterai/templates/use', id: b.dataset.use }).then((x) => showRes('tres', x), fail).finally(() => { b.disabled = false; });
          };
        });
      }, (e) => { $(box).innerHTML = `<p class="bad">${esc(e.message || e)}</p>`; });
      list('tlist', 'automations');
      list('dlist', 'dashboard');
    }
    async _reloadConfig() {
      // después de restaurar, el editor del diseño arranca de lo que quedó guardado
      try { const r = await this._hass.callWS({ type: 'matterai/config' }); this._saved = JSON.stringify(r.config); this._draft = r.config; } catch (_) { /* se ve al recargar */ }
    }
    _useDashboard(config) {
      if (this._dirty() && !confirm('Hay cambios sin guardar en el diseño de la app. ¿Reemplazarlos por la plantilla?')) return;
      this._draft = config;
      this._go('dash');
      this._toast('Diseño cargado en el editor: revisalo y tocá Guardar');
    }

    /* ---------- Diseño de la app: editor + vista previa ---------- */
    _renderDash() {
      const main = this._page('dash', '<div class="dash"><div class="box" id="edbox"></div><div class="box prev" id="prev"></div></div>');
      if (!main) return;
      const Ed = customElements.get('matterai-home-card-editor');
      this._editor = new Ed();
      this._editor.hass = this._hass;
      this._editor.setConfig(this._draft);
      this._editor.addEventListener('config-changed', (e) => {
        this._draft = e.detail.config;
        clearTimeout(this._pt); this._pt = setTimeout(() => this._card && this._card.setConfig(this._draft), 250);
        this._bar();
      });
      const edbox = main.querySelector('#edbox');
      edbox.appendChild(this._editor);
      const bar = document.createElement('div'); bar.className = 'bar'; bar.id = 'bar'; edbox.appendChild(bar);
      this._card = document.createElement('matterai-home-card');
      this._card.setConfig(this._draft);
      this._card.hass = this._hass;
      main.querySelector('#prev').appendChild(this._card);
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

    /* ---------- Vincular celulares: QR ---------- */
    async _renderApp(regenerate = false) {
      try {
        await loadScript(`${BASE}/qrcode.js`);
        this._pair = await this._hass.callWS({ type: 'matterai/pairing', regenerate: regenerate === true });
      } catch (e) {
        this._page('app', `<div class="box"><h2>Falta un dato</h2><p>${esc(e.message || e)}</p>
          <div class="row"><button class="b pri" data-go="house">Ir a la ficha de la casa</button></div></div>`);
        return;
      }
      const p = this._pair;
      const qr = window.qrcode(0, 'L'); qr.addData(p.link); qr.make();
      const wa = `https://wa.me/?text=${encodeURIComponent(`¡Hola! Para usar tu casa inteligente bajá la app MatterAI y abrí este link desde el celular:\n${p.link}`)}`;
      const main = this._page('app', `<div class="box pair"><div class="qr">${qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true })}</div><div>
        <h2>Vincular el celular de ${esc(p.name || 'el cliente')}</h2>
        <p>El cliente abre la app MatterAI y escanea este código (o abre el link desde el celular). Queda conectado a <b>${esc(p.url)}</b> sin ver nunca Home Assistant.</p>
        <div class="link">${esc(p.link)}</div>
        <div class="row"><button class="b pri" id="copy">Copiar link</button><a class="b" href="${esc(wa)}" target="_blank" rel="noopener">Mandar por WhatsApp</a><button class="b" id="print">Imprimir</button></div>
        <h3>¿Perdió el celular o querés cortar el acceso?</h3>
        <p class="mut">Un acceso nuevo deja sin conexión a todos los celulares vinculados hasta ahora: hay que volver a escanear.</p>
        <div class="row"><button class="b warn" id="regen">Generar acceso nuevo</button></div></div></div>
        <div class="box" id="devs"><h2>Celulares y tablets</h2><p class="mut">Cargando…</p></div>`);
      if (!main) return;
      this._renderDevs(main.querySelector('#devs'));
      const $ = (id) => main.querySelector(`#${id}`);
      $('copy').onclick = async () => { try { await navigator.clipboard.writeText(p.link); this._toast('Link copiado'); } catch (_) { this._toast('No se pudo copiar: seleccionalo a mano'); } };
      $('print').onclick = () => {
        const w = window.open('', '_blank');
        w.document.write(`<html><body style="font-family:sans-serif;text-align:center;padding:40px"><h1>${esc(p.name || 'Tu casa')}</h1><p>Abrí la app <b>MatterAI</b> y escaneá este código</p><div style="width:320px;margin:20px auto">${qr.createSvgTag({ cellSize: 6, margin: 2, scalable: true })}</div><p style="color:#888">MatterAI · Hogar inteligente</p></body></html>`);
        w.document.close(); w.focus(); w.print();
      };
      $('regen').onclick = () => { if (confirm('¿Generar un acceso nuevo? Los celulares vinculados tendrán que volver a escanear.')) this._renderApp(true); };
    }

    /** Equipos con la app: perfil (qué ve cada uno) y si pide huella para la seguridad. */
    async _renderDevs(box) {
      let r;
      try { r = await this._hass.callWS({ type: 'matterai/app/devices' }); } catch (e) { box.innerHTML = `<h2>Celulares y tablets</h2><p class="mut">${esc(e.message || e)}</p>`; return; }
      const P = r.profiles || {};
      const HELP = { full: 'Ve y maneja todo', kids: 'Sin alarma, cerraduras, portón ni cámaras', basic: 'Sólo luces, clima, persianas y música' };
      box.innerHTML = `<h2>Celulares y tablets</h2>
        <p class="mut">Cada equipo con la app aparece acá solo, la primera vez que se conecta. El perfil decide qué ve (por ejemplo, el de los chicos sin la alarma ni las cámaras) y «Pedir huella» protege la alarma, las cerraduras y el portón en ese equipo.</p>
        ${r.devices.length ? `<table class="tb"><thead><tr><th>Equipo</th><th>Perfil</th><th>Pedir huella</th><th>Avisos</th></tr></thead><tbody>
          ${r.devices.map((d) => `<tr data-dev="${esc(d.device_id)}"><td><b>${esc(d.name)}</b><br><small class="mut">${esc(d.model)}${d.app_version ? ` · app ${esc(d.app_version)}` : ''}</small></td>
            <td><select data-k="profile">${Object.keys(P).map((k) => `<option value="${k}" ${d.profile === k ? 'selected' : ''}>${esc(P[k])}</option>`).join('')}</select><br><small class="mut">${esc(HELP[d.profile] || '')}</small></td>
            <td><input type="checkbox" data-k="secure" ${d.secure ? 'checked' : ''}></td>
            <td>${d.notify ? `<b class="ok">${esc(d.notify)}</b>` : d.push ? '<b class="wn">Reiniciar HA</b>' : '<span class="mut">Sin notificaciones</span>'}</td></tr>`).join('')}
        </tbody></table>` : '<p class="mut">Todavía no hay equipos: aparecen cuando el cliente abre la app vinculada.</p>'}`;
      box.querySelectorAll('[data-dev] [data-k]').forEach((el) => {
        el.onchange = async () => {
          const id = el.closest('[data-dev]').dataset.dev;
          const msg = { type: 'matterai/app/device_set', device_id: id };
          msg[el.dataset.k] = el.type === 'checkbox' ? el.checked : el.value;
          try { await this._hass.callWS(msg); this._toast('Guardado: el equipo lo toma al instante'); this._renderDevs(box); } catch (e) { this._toast(`No se pudo guardar: ${e.message || e}`); }
        };
      });
    }

    /* ---------- Conexiones ---------- */
    async _renderConn() {
      const { s, wd } = await this._data(true);
      const c = s.central;
      const cors = !s.cors.known ? '<b class="wn">No se pudo revisar</b>' : s.cors.missing.length ? '<b class="bad">Falta</b>' : s.cors.needs_restart ? '<b class="wn">Reiniciar HA</b>' : '<b class="ok">OK</b>';
      const central = !c.configured ? '<b class="mut">No configurado</b>' : c.ok === true ? '<b class="ok">Conectado</b>' : c.ok === false ? '<b class="bad">Sin conexión</b>' : '<b class="wn">Esperando…</b>';
      const remote = wd && wd.remote;
      const main = this._page('conn', `<div class="st">
        <div class="box"><h2>App de los clientes</h2>
          <div class="kv"><span>Dirección remota</span><b>${esc(s.url)}</b></div>
          <div class="kv"><span>Permiso de la app (CORS)</span>${cors}</div>
          ${s.cors.missing.length ? `<p class="mut">En <b>Red → Orígenes permitidos por CORS</b> agregá (uno por renglón, sin barra al final):</p><div class="link">${s.cors.missing.map(esc).join('<br>')}</div>
            <div class="row"><a class="b pri" href="${esc(s.cors.page)}">Abrir Ajustes de red</a></div>` : ''}
          ${s.cors.needs_restart ? '<p class="mut">Se aplica al reiniciar Home Assistant.</p>' : ''}
          <div class="kv"><span>Acceso remoto</span>${!remote ? '<b class="mut">Sin Cloudflared vigilado</b>' : remote.kind === 'ok' ? '<b class="ok">Responde</b>' : remote.kind === 'tunnel' ? '<b class="bad">Túnel caído</b>' : '<b class="mut">La casa no tiene internet</b>'}</div>
          ${remote && remote.kind !== 'ok' ? `<p class="mut">${esc(remote.detail)}</p>` : ''}</div>
        <div class="box"><h2>Panel central</h2>
          <div class="kv"><span>Estado</span>${central}</div>
          ${c.configured ? `<div class="kv"><span>Última copia de seguridad</span><b class="${c.last_backup ? 'ok' : 'mut'}">${c.last_backup ? esc(when(c.last_backup)) : 'Todavía no'}</b></div>` : ''}
          ${c.error ? `<p class="mut">${esc(c.error)}</p>` : ''}
          ${c.configured ? `<div class="row"><button class="b" id="hb">Probar ahora</button>${c.url ? `<a class="b" href="${esc(c.url)}" target="_blank" rel="noopener">Abrir panel central</a>` : ''}</div>`
            : '<p class="mut">Cargá la clave de la casa en <button class="lnk" data-go="house">Ficha de la casa → Cambiar datos</button> para verla en tu panel central.</p>'}</div>
        <div class="box"><h2>Motor de automatizaciones</h2>
          <div class="kv"><span>Estado</span>${s.escenas ? '<b class="ok">Activo</b>' : '<b class="wn">Iniciando…</b>'}</div>
          ${s.escenas_conflict ? '<p class="wn">Falta eliminar la integración vieja «MatterAI Escenas»: mientras esté, el motor nuevo no arranca.</p>' : ''}</div>
      </div>`);
      const hb = main && main.querySelector('#hb');
      if (hb) hb.onclick = async () => { const r = await this._hass.callWS({ type: 'matterai/heartbeat' }); this._toast(r.ok ? 'Panel central: conectado' : `Panel central: ${r.error || 'sin conexión'}`); this._cache = null; this._render('conn'); };
    }

    /* ---------- Voz ---------- */
    async _renderVoice() {
      const [{ s }, vl] = await Promise.all([this._data(), this._hass.callWS({ type: 'matterai/voice_log' }).catch(() => ({ items: [], on: false }))]);
      const WHY = { no: ['bad', 'No entendió'], duda: ['wn', 'Preguntó de vuelta'], ia: ['mut', 'Lo resolvió la IA'] };
      const v = s.voice;
      const main = this._page('voice', `<div class="st">
        <div class="box"><h2>Control por voz</h2>
          <div class="kv"><span>Estado</span>${!v.on ? '<b class="mut">Desactivado</b>' : v.ai ? `<b class="ok">${v.mode === 'ai' ? 'Siempre IA' : 'Gratis + IA'}</b>` : '<b class="ok">Gratis</b>'}</div>
          ${v.on && !v.ai ? '<p class="mut">Entiende los pedidos comunes sin costo. Para que entienda cualquier frase, cargá una clave de Anthropic.</p>' : ''}
          ${!v.on ? '<p class="mut">El micrófono de la app no aparece mientras esté desactivado.</p>' : ''}
          <div class="row"><button class="b" data-go="house">Cambiar el modo</button></div></div>
        ${vl.on ? `<div class="box wide"><h2>Frases que no entendió</h2>
          <p class="mut">Lo que el modo gratis no supo resolver. Sirve para sumar esas formas de hablar en una próxima versión.</p>
          ${vl.items.length ? `<div class="vl">${vl.items.map((x) => `<div class="vli"><span class="vlw ${WHY[x.why] ? WHY[x.why][0] : ''}">${esc(WHY[x.why] ? WHY[x.why][1] : x.why)}</span><b>“${esc(x.text)}”</b><small>${esc(when(x.at))}${x.say ? ` · ${esc(x.say)}` : ''}</small></div>`).join('')}</div>
            <div class="row"><button class="b" id="vlcopy">Copiar lista</button><button class="b warn" id="vlclear">Borrar lista</button></div>` : '<p class="ok">Nada por ahora: entendió todo.</p>'}</div>` : ''}
      </div>`);
      if (!main) return;
      const vc = main.querySelector('#vlclear');
      if (vc) vc.onclick = async () => { if (!confirm('¿Borrar la lista de frases?')) return; await this._hass.callWS({ type: 'matterai/voice_log', clear: true }); this._render('voice'); };
      const vy = main.querySelector('#vlcopy');
      if (vy) vy.onclick = async () => { try { await navigator.clipboard.writeText(vl.items.map((x) => `${x.why}: ${x.text}`).join(String.fromCharCode(10))); this._toast('Lista copiada'); } catch (_) { this._toast('No se pudo copiar'); } };
    }

    /* ---------- Ficha de la casa ---------- */
    async _renderHouse() {
      const { s } = await this._data(true);
      const c = s.central;
      this._page('house', `<div class="st">
        <div class="box"><h2>Cliente</h2>
          <div class="kv"><span>Casa</span><b>${esc(s.name)}</b></div>
          <div class="kv"><span>Dirección remota</span><b>${esc(s.url)}</b></div>
          <div class="kv"><span>WhatsApp de soporte</span><b>${esc(s.support_phone || '—')}</b></div>
          <p class="mut">El nombre, la dirección, el WhatsApp de soporte, la clave del panel central y el modo de voz se cambian en la configuración de la integración.</p>
          <div class="row"><a class="b pri" href="/config/integrations/integration/matterai">Cambiar datos</a></div></div>
        <div class="box"><h2>Instalación</h2>
          <div class="kv"><span>Versión MatterAI</span><b>${esc(s.version)}${c.latest && c.latest !== s.version ? ` <span class="wn">(hay ${esc(c.latest)})</span>` : c.latest ? ' <span class="ok">· la última</span>' : ''}</b></div>
          <div class="kv"><span>Home Assistant</span><b>${esc(s.health.ha_version)}</b></div>
          <div class="kv"><span>Id de la casa</span><b>${esc(s.house_id)}</b></div>
          ${c.latest && c.latest !== s.version ? '<p class="mut">Actualizala desde el panel central (botón ⋯ de la casa) o desde HACS.</p>' : ''}
          ${s.imported_from ? `<p class="mut">El diseño de la app se trajo del panel «${esc(s.imported_from)}». Ya podés borrar ese panel si querés.</p>` : ''}</div>
      </div>`);
    }
  }
  if (!customElements.get('matterai-admin-panel')) customElements.define('matterai-admin-panel', MatterAIAdminPanel);
})();
