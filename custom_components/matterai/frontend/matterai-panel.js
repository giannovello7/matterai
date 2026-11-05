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
    { k: 'views', l: 'Dashboards', i: 'mdi:view-dashboard-edit-outline' },
    { k: 'app', l: 'Vincular celulares', i: 'mdi:qrcode' },
    { g: 'Sistema MatterAI', d: 'Control interno de la instalación' },
    { k: 'health', l: 'Salud y avisos', i: 'mdi:heart-pulse' },
    { k: 'wd', l: 'Mantenimiento', i: 'mdi:shield-sync-outline' },
    { k: 'backup', l: 'Copias de seguridad', i: 'mdi:backup-restore' },
    { k: 'tpl', l: 'Plantillas', i: 'mdi:package-variant-closed' },
    { k: 'conn', l: 'Conexiones', i: 'mdi:lan-connect' },
    { k: 'sec', l: 'Seguridad', i: 'mdi:shield-account-outline' },
    { k: 'voice', l: 'Voz', i: 'mdi:microphone-outline' },
    { k: 'house', l: 'Ficha de la casa', i: 'mdi:home-city-outline' },
  ];
  const PAGES = {
    home: ['Resumen', 'Cómo está esta casa de un vistazo.', null],
    dash: ['Diseño de la app', 'Ambientes, equipos y cámaras que ve la familia. Los cambios llegan a la app recién al tocar Guardar.', 'client'],
    auto: ['Automatizaciones', 'Las del cliente y los equipos del instalador (portón inteligente, sensor de ocupación), que el cliente no ve.', 'client'],
    views: ['Dashboards', 'Qué ve cada persona en su celular y en su tablet. Lo diseñás acá y les llega al instante; lo que fijen desde la app también queda acá.', 'client'],
    app: ['Vincular celulares', 'Código QR y link para que la familia conecte la app MatterAI a esta casa.', 'client'],
    health: ['Salud y avisos', 'Todo lo que hay que atender en esta casa. Lo mismo le llega al panel central.', 'system'],
    wd: ['Mantenimiento', 'Los servicios que MatterAI vigila y recupera solo: complementos e integraciones.', 'system'],
    backup: ['Copias de seguridad', 'El diseño de la app, las automatizaciones y sus ajustes. Restaurar todo o algunas.', 'system'],
    tpl: ['Plantillas', 'Automatizaciones y diseños armados acá para reutilizar en otras casas.', 'system'],
    conn: ['Conexiones', 'Acceso de la app, acceso remoto y panel central.', 'system'],
    sec: ['Seguridad', 'Registro de quién abrió, desarmó o miró qué, y cómo entra el instalador a esta casa.', 'system'],
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
        backup: () => this._renderCopias('backup'), tpl: () => this._renderCopias('tpl'), conn: this._renderConn, voice: this._renderVoice, house: this._renderHouse, sec: this._renderSec, views: this._renderViews };
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
        <p class="mut">Cada código sirve para <b>un solo celular</b> y vence en ${esc(String(p.hours || 24))} horas: cada equipo queda con su propio acceso, que no vence nunca. Desde la app, quien ya está vinculado puede agregar otros celulares (Opciones → Agregar otro celular).</p>
        <div class="link">${esc(p.link)}</div>
        <div class="row"><button class="b pri" id="copy">Copiar link</button><a class="b" href="${esc(wa)}" target="_blank" rel="noopener">Mandar por WhatsApp</a><button class="b" id="print">Imprimir</button><button class="b" id="regen">Otro código</button></div></div></div>
        <div class="box" id="acc"><h2>Accesos a la casa</h2><p class="mut">Cargando…</p></div>
        <div class="box" id="devs"><h2>Celulares y tablets</h2><p class="mut">Cargando…</p></div>`);
      if (!main) return;
      this._renderDevs(main.querySelector('#devs'));
      this._renderAccess(main.querySelector('#acc'));
      const $ = (id) => main.querySelector(`#${id}`);
      $('copy').onclick = async () => { try { await navigator.clipboard.writeText(p.link); this._toast('Link copiado'); } catch (_) { this._toast('No se pudo copiar: seleccionalo a mano'); } };
      $('print').onclick = () => {
        const w = window.open('', '_blank');
        w.document.write(`<html><body style="font-family:sans-serif;text-align:center;padding:40px"><h1>${esc(p.name || 'Tu casa')}</h1><p>Abrí la app <b>MatterAI</b> y escaneá este código</p><div style="width:320px;margin:20px auto">${qr.createSvgTag({ cellSize: 6, margin: 2, scalable: true })}</div><p style="color:#888">MatterAI · Hogar inteligente</p></body></html>`);
        w.document.close(); w.focus(); w.print();
      };
      $('regen').onclick = () => this._renderApp(true);
    }

    /** Un acceso por equipo: cuándo se usó por última vez y cortar uno solo (celular perdido, empleado que ya no está). */
    async _renderAccess(box) {
      let r;
      try { r = await this._hass.callWS({ type: 'matterai/app/access' }); } catch (e) { box.innerHTML = `<h2>Accesos a la casa</h2><p class="mut">${esc(e.message || e)}</p>`; return; }
      const when = (t) => (t ? new Date(t * 1000).toLocaleString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
      const VIA = { pair: 'QR del instalador', invite: 'Agregado desde la app', upgrade: 'Pasado del acceso compartido' };
      const sh = r.shared || {};
      box.innerHTML = `<h2>Accesos a la casa</h2>
        <p class="mut">Cada celular o tablet tiene su propio acceso. Si se pierde un celular, desvinculalo acá: los demás siguen andando.</p>
        ${r.devices.length ? `<table class="tb"><thead><tr><th>Equipo</th><th>Vinculado</th><th>Último uso</th><th></th></tr></thead><tbody>
          ${r.devices.map((d) => `<tr><td><b>${esc(d.name)}</b>${d.apps.length ? `<br><small class="mut">${esc(d.apps.join(', '))}</small>` : ''}</td>
            <td>${esc(when(d.created))}<br><small class="mut">${esc(VIA[d.via] || '')}</small></td><td>${esc(when(d.last_used))}</td>
            <td><button class="b warn" data-rev="${esc(d.user_id)}" data-n="${esc(d.name)}">Desvincular</button></td></tr>`).join('')}
        </tbody></table>` : '<p class="mut">Todavía no hay equipos con acceso propio.</p>'}
        ${sh.active ? `<h3>Acceso compartido (versión anterior)</h3>
          <p class="mut">Los celulares vinculados antes de MatterAI 2.10 usaban un acceso compartido. Se pasan solos a uno propio la próxima vez que abren la app.
          ${sh.devices && sh.devices.length ? `Todavía lo usan: <b>${esc(sh.devices.join(', '))}</b>.` : 'Ya no lo usa ningún equipo registrado.'} Último uso: ${esc(when(sh.last_used))}.</p>
          <div class="row"><button class="b warn" id="shoff">Apagar el acceso compartido</button></div>` : ''}`;
      box.querySelectorAll('[data-rev]').forEach((b) => {
        b.onclick = async () => {
          if (!confirm(`¿Desvincular «${b.dataset.n}»? Ese equipo deja de tener acceso a la casa al instante.`)) return;
          try { await this._hass.callWS({ type: 'matterai/app/revoke', user_id: b.dataset.rev }); this._toast('Equipo desvinculado'); } catch (e) { this._toast(`No se pudo: ${e.message || e}`); }
          this._renderAccess(box);
          const devs = this.shadowRoot ? this.shadowRoot.querySelector('#devs') : null;
          if (devs) this._renderDevs(devs);
        };
      });
      const off = box.querySelector('#shoff');
      if (off) {
        off.onclick = async () => {
          const left = sh.devices && sh.devices.length ? `\n\nTodavía lo usan: ${sh.devices.join(', ')}. Esos equipos tendrán que volver a escanear un código.` : '';
          if (!confirm(`¿Apagar el acceso compartido de la versión anterior?${left}`)) return;
          try { await this._hass.callWS({ type: 'matterai/app/shared_off' }); this._toast('Acceso compartido apagado'); } catch (e) { this._toast(`No se pudo: ${e.message || e}`); }
          this._renderAccess(box);
        };
      }
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

    /* ---------- Dashboards por persona ---------- */
    async _renderViews() {
      const r = await this._hass.callWS({ type: 'matterai/views/list' });
      const people = r.people || [];
      const views = r.views || [];
      if (!this._vopen) { try { this._vopen = new Set(JSON.parse(localStorage.getItem('matterai.panel.vopen') || '[]')); } catch (_) { this._vopen = new Set(); } }
      const saveOpen = () => { try { localStorage.setItem('matterai.panel.vopen', JSON.stringify([...this._vopen])); } catch (_) { /* sin almacenamiento */ } };
      const users = (vid) => people.filter((p) => p.view === vid && !stale(p));
      // celular o tablet: lo que pidió el equipo (si todavía no abrió la app, se adivina por el modelo)
      const kindOf = (p) => p.kind || (/tab|sm-x|sm-t|ipad/i.test((p.model || '') + p.name) ? 'tablet' : 'phone');
      const devIc = (p) => `<ha-icon icon="${kindOf(p) === 'tablet' ? 'mdi:tablet' : 'mdi:cellphone'}"></ha-icon>`;
      /** Qué muestra de verdad un equipo: su dashboard, o el general, o el inicio automático; con el diseño de su tipo. */
      const shows = (p) => {
        const vid = p.view || r.default || null, x = views.find((y) => y.id === vid), k = kindOf(p);
        const kname = k === 'tablet' ? 'tablet' : 'celular';
        if (!x) return `Muestra el <b>inicio automático</b> (${kname})`;
        return `Muestra <b>«${esc(x.name)}»</b>${p.view ? '' : ' (el general)'} · diseño de ${kname} ${lay(x, k) ? '<span class="dv-tag on">diseñado</span>' : '<span class="dv-tag">prearmado</span>'}${p.kind ? '' : ' <span class="mut">· todavía no abrió la app nueva</span>'}`;
      };
      // el mismo equipo vinculado dos veces: mismo nombre y mismo tipo; el que se usó (o vinculó) más tarde es el bueno
      const isTab = (p) => /tab|sm-x|sm-t|ipad/i.test((p.model || '') + p.name);
      const twinsOf = (p) => people.filter((q) => q !== p && q.name.toLowerCase() === p.name.toLowerCase() && (!q.model || !p.model || isTab(q) === isTab(p)));
      const fresh = (p) => Math.max(p.last_used || 0, p.created || 0);
      const stale = (p) => twinsOf(p).some((q) => fresh(q) > fresh(p) || (fresh(q) === fresh(p) && q.user_id > p.user_id));
      // equipos con la app registrada en mobile_app que no son un equipo vinculado (acceso compartido viejo)
      const loose = (r.devices || []).filter((d) => !people.some((p) => (p.devices || []).includes(d.device_id)));
      const lay = (x, k) => { const L = (x.layouts || {})[k]; return (L && L.blocks && L.blocks.length) || ((x.kind || 'phone') === k && x.blocks && x.blocks.length); };
      const state = (x, k) => (lay(x, k) ? '<span class="dv-tag on">diseñado</span>' : '<span class="dv-tag">prearmado</span>');
      const ago = (t) => { if (!t) return 'sin uso todavía'; const m = Math.round((Date.now() / 1000 - t) / 60); return m < 2 ? 'en uso ahora' : m < 60 ? `usado hace ${m} min` : m < 1440 ? `usado hace ${Math.round(m / 60)} h` : `usado hace ${Math.round(m / 1440)} días`; };
      const viewOpts = (sel) => `<option value="">${r.default ? 'El general' : 'Inicio automático'}</option>${views.map((x) => `<option value="${esc(x.id)}" ${sel === x.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}`;
      const card = (x) => {
        const open = this._vopen.has(x.id), us = users(x.id), isDef = r.default === x.id;
        return `<article class="dv-card ${open ? 'open' : ''}">
          <div class="dv-top">
            <button class="dv-hit" data-vtog="${esc(x.id)}" aria-expanded="${open}"><span class="dv-ic"><ha-icon icon="mdi:view-dashboard-outline"></ha-icon></span>
              <span class="dv-t"><b>${esc(x.name)}</b>${isDef ? '<span class="dv-tag gen">general</span>' : ''}
                <small>Diseño de celular ${state(x, 'phone')} · Diseño de tablet ${state(x, 'tablet')}</small>
                <small class="dv-who">${us.length ? `Lo usa${us.length > 1 ? 'n' : ''}: ${us.map((p) => `<span class="dv-dev">${devIc(p)}${esc(p.name)}</span>`).join('')}` : isDef ? `Lo ven los equipos sin uno propio${people.filter((p) => !p.view && !stale(p)).length ? `: ${people.filter((p) => !p.view && !stale(p)).map((p) => `<span class="dv-dev">${devIc(p)}${esc(p.name)}</span>`).join('')}` : ''}` : '<span class="mut">Ningún equipo lo usa todavía</span>'}</small></span></button>
            <button class="b pri" data-ved="${esc(x.id)}"><ha-icon icon="mdi:pencil-ruler"></ha-icon>Editar diseño</button>
            <button class="dv-chev" data-vtog="${esc(x.id)}" aria-label="${open ? 'Achicar' : 'Opciones'}"><ha-icon icon="mdi:chevron-down"></ha-icon></button>
          </div>
          ${open ? `<div class="dv-body">
            <label class="dv-f"><span>Nombre</span><input data-vname="${esc(x.id)}" value="${esc(x.name)}" maxlength="40"></label>
            <div class="dv-f"><span>Equipos que lo usan</span>
              ${people.length ? `<div class="dv-chips">${people.filter((p) => !stale(p)).map((p) => `<label class="dv-chip ${p.view === x.id ? 'on' : ''}"><input type="checkbox" data-vuse="${esc(p.user_id)}" data-v="${esc(x.id)}" ${p.view === x.id ? 'checked' : ''}>${devIc(p)}${esc(p.name)}${p.view && p.view !== x.id ? `<small>ahora: ${esc((views.find((y) => y.id === p.view) || {}).name || '—')}</small>` : ''}</label>`).join('')}</div>`
                : '<p class="mut">Todavía no hay equipos vinculados (se vinculan desde «App del cliente»).</p>'}
              <p class="mut">Una persona con celular y tablet: marcá los dos. El celular usa el diseño de celular y la tablet el de tablet.</p></div>
            <label class="dv-sw"><input type="checkbox" data-vdef="${esc(x.id)}" ${isDef ? 'checked' : ''}><span>Usarlo como dashboard general (lo ven los equipos que no tienen uno propio)</span></label>
            <div class="dv-act"><button class="b" data-vdup="${esc(x.id)}"><ha-icon icon="mdi:content-copy"></ha-icon>Duplicar</button><span class="sp"></span><button class="b warn" data-vdel="${esc(x.id)}"><ha-icon icon="mdi:delete-outline"></ha-icon>Borrar</button></div>
          </div>` : ''}
        </article>`;
      };
      const main = this._page('views', `<style>
        .dv{display:flex;flex-direction:column;gap:16px;max-width:1100px}
        .dv-new{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
        .dv input:not([type]),.dv select{padding:9px 12px;border-radius:10px;border:1px solid var(--divider-color,rgba(127,127,127,.3));background:var(--secondary-background-color,transparent);color:inherit;font:inherit;font-size:14px;min-width:0}
        .dv-new input{flex:1;min-width:220px}
        .dv-list{display:flex;flex-direction:column;gap:10px}
        .dv-card{border-radius:16px;border:1px solid var(--divider-color,rgba(127,127,127,.2));background:var(--card-background-color,#1c1c1e);overflow:hidden;transition:box-shadow .2s}
        .dv-card.open{box-shadow:0 6px 24px rgba(0,0,0,.08);border-color:var(--primary-color,#03a9f4)}
        .dv-top{display:flex;align-items:center;gap:10px;padding:12px 14px}
        .dv-hit{flex:1;min-width:0;display:flex;align-items:center;gap:12px;background:none;border:0;padding:0;color:inherit;font:inherit;text-align:left;cursor:pointer}
        .dv-ic{width:42px;height:42px;border-radius:12px;display:grid;place-items:center;background:rgba(127,127,127,.12);color:var(--primary-color,#03a9f4);flex:none}
        .dv-t{min-width:0}.dv-t b{font-size:15.5px;font-weight:600}.dv-t small{display:block;opacity:.7;font-size:12.5px;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .dv-tag{display:inline-block;margin-left:4px;padding:1px 8px;border-radius:999px;font-size:11px;font-weight:600;background:rgba(127,127,127,.14);opacity:.9}
        .dv-tag.warn{background:rgba(255,152,0,.16);color:var(--warning-color,#ff9800)}.dv-note.warnn{background:rgba(255,152,0,.1);margin-top:8px}
        .dv-tag.on{background:rgba(67,160,71,.16);color:var(--success-color,#43a047)}.dv-tag.gen{background:rgba(3,169,244,.14);color:var(--primary-color,#03a9f4)}
        .dv-chev{width:38px;height:38px;border-radius:10px;border:0;background:none;color:inherit;cursor:pointer;display:grid;place-items:center;opacity:.7}
        .dv-chev:hover{background:rgba(127,127,127,.12)}.dv-card.open .dv-chev ha-icon{transform:rotate(180deg)}
        .dv-body{padding:4px 16px 16px 68px;display:flex;flex-direction:column;gap:14px;border-top:1px solid var(--divider-color,rgba(127,127,127,.15));padding-top:14px}
        @media (max-width:700px){.dv-body{padding-left:16px}.dv-top{flex-wrap:wrap}}
        .dv-f{display:flex;flex-direction:column;gap:6px;max-width:560px}.dv-f>span{font-size:12.5px;font-weight:600;opacity:.75}
        .dv-chips{display:flex;flex-wrap:wrap;gap:8px}
        .dv-chip{display:inline-flex;align-items:center;gap:6px;padding:7px 12px;border-radius:999px;border:1px solid var(--divider-color,rgba(127,127,127,.3));cursor:pointer;font-size:13.5px}
        .dv-chip input{display:none}.dv-chip ha-icon{--mdc-icon-size:18px;opacity:.7}
        .dv-chip.on{border-color:var(--primary-color,#03a9f4);background:rgba(3,169,244,.1);color:var(--primary-color,#03a9f4)}
        .dv-chip small{opacity:.6;font-size:11px}
        .dv-sw{display:flex;align-items:center;gap:10px;font-size:14px;cursor:pointer}
        .dv-act{display:flex;gap:8px;align-items:center}.dv-act .sp{flex:1}
        .dv-auto{display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:16px;border:1px dashed var(--divider-color,rgba(127,127,127,.35))}
        .dv-auto .dv-t{flex:1}
        .dv-eq{display:flex;flex-direction:column;gap:2px}
        .dv-row{display:flex;align-items:center;gap:12px;padding:10px 4px;border-top:1px solid var(--divider-color,rgba(127,127,127,.15))}
        .dv-row:first-of-type{border-top:0}.dv-row .dv-t{flex:1}
        .dv-note{padding:12px 14px;border-radius:12px;background:rgba(127,127,127,.08);font-size:13px;line-height:1.5}
        .dv-who{display:flex!important;flex-wrap:wrap;align-items:center;gap:6px;white-space:normal!important}
        .dv-dev{display:inline-flex;align-items:center;gap:4px;padding:2px 9px 2px 6px;border-radius:999px;background:rgba(3,169,244,.1);color:var(--primary-color,#03a9f4);font-weight:600}
        .dv-dev ha-icon{--mdc-icon-size:15px}
        .dv-shows{display:block;margin-top:4px;font-size:13px;opacity:.95}
        .dv-pick{display:flex;flex-direction:column;gap:3px;font-size:11.5px;font-weight:600;opacity:.95}.dv-pick span{opacity:.7}
        .dv-row{align-items:flex-start}.dv-row .dv-pick,.dv-row .dv-chev{margin-top:4px}
      </style>
      <div class="dv">
        <div class="box"><div class="bh"><h2>Dashboards de esta casa</h2></div>
          <p class="mut" style="margin-top:0">Uno por persona, con su diseño para el celular y para la tablet. Lo que guardes les llega a sus equipos al instante, sin actualizar la app.</p>
          <form class="dv-new" id="vnewf"><input id="vnewn" placeholder="Nombre del dashboard (por ejemplo, «Gianfranco»)" maxlength="40" autocomplete="off"><button class="b pri" type="submit"><ha-icon icon="mdi:plus"></ha-icon>Crear y diseñar</button></form>
        </div>
        <div class="dv-list">
          ${views.map(card).join('')}
          <div class="dv-auto"><span class="dv-ic"><ha-icon icon="mdi:auto-fix"></ha-icon></span><span class="dv-t"><b>Inicio automático</b><small class="mut" style="display:block">${r.default ? 'No se usa: hay un dashboard general.' : 'Lo ven los equipos sin dashboard. Se arma solo con los ambientes, escenas y cámaras de la casa.'}</small></span>
            ${r.default ? '' : '<button class="b" id="vauto"><ha-icon icon="mdi:pencil-ruler"></ha-icon>Personalizarlo</button>'}</div>
        </div>
        <div class="box dv-eq"><div class="bh"><h2>Qué ve cada equipo</h2></div>
          ${people.map((p) => { const st = stale(p), dup = twinsOf(p).length > 0;
            const linked = p.created ? `vinculado el ${new Date(p.created * 1000).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}` : '';
            return `<div class="dv-row ${st ? 'stale' : ''}"><span class="dv-ic">${devIc(p)}</span>
            <span class="dv-t"><b>${esc(p.name)}</b>${st ? ' <span class="dv-tag warn">vínculo viejo (duplicado)</span>' : dup ? ' <span class="dv-tag on">el que se usa</span>' : ''}<small class="mut" style="display:block">${esc([kindOf(p) === 'tablet' ? 'Tablet' : 'Celular', p.model, linked, ago(p.last_used)].filter(Boolean).join(' · '))}</small>
              ${st ? '' : `<small class="dv-shows">${shows(p)}</small>`}</span>
            ${st ? `<button class="b warn" data-unlink="${esc(p.user_id)}" data-n="${esc(p.name)}" data-stale="1"><ha-icon icon="mdi:link-variant-off"></ha-icon>Quitar duplicado</button>`
              : `<label class="dv-pick"><span>Dashboard</span><select data-asgu="${esc(p.user_id)}">${viewOpts(p.view)}</select></label>
            <button class="dv-chev" data-unlink="${esc(p.user_id)}" data-n="${esc(p.name)}" title="Desvincular este equipo" aria-label="Desvincular"><ha-icon icon="mdi:link-variant-off"></ha-icon></button>`}</div>`; }).join('')}
          ${people.some(stale) ? '<div class="dv-note warnn"><b>Hay equipos vinculados dos veces.</b> Pasa al volver a vincular el mismo celular o tablet (por ejemplo, al reinstalar la app). El marcado como «vínculo viejo» es el que no se usa hace más tiempo: «Quitar duplicado» lo borra y su dashboard pasa al que queda. Desde esta versión, si un equipo se vuelve a vincular, la casa reemplaza el vínculo viejo sola.</div>' : ''}
          ${loose.map((d) => `<div class="dv-row"><span class="dv-ic"><ha-icon icon="mdi:cellphone-link"></ha-icon></span><span class="dv-t"><b>${esc(d.name)}</b><small class="mut" style="display:block">${esc(d.model || '')} · acceso compartido</small></span>
            <select data-asg="${esc(d.device_id)}">${viewOpts(d.view)}</select></div>`).join('')}
          ${people.length || loose.length ? '' : '<p class="mut">Todavía no hay equipos con la app.</p>'}
          <div class="dv-note"><b>¿Cómo le doy un dashboard a una persona?</b> Cada celular o tablet aparece acá con su nombre apenas se vincula con su código (sección «App del cliente», o desde la app: Opciones → Agregar otro celular). Elegí el dashboard al lado de cada uno de sus equipos, o marcalos dentro del dashboard. Si un celular no aparece, todavía no está vinculado con su propio código.</div>
        </div>
      </div>`);
      if (!main) return;
      const $ = (id) => main.querySelector(`#${id}`);
      const call = async (msg, ok) => { try { const res = await this._hass.callWS(msg); if (ok) this._toast(ok); return res; } catch (e) { this._toast(`No se pudo: ${e.message || e}`); return null; } };
      const edit = async (id) => {
        try { await loadScript(`${BASE}/matterai-editor.js?t=${Date.now()}`); await window.MaeEditor.open(this, id); } catch (e) { this._toast(`No se pudo abrir el editor: ${e.message || e}`); }
      };
      const full = (x, patch) => Object.assign({}, x, patch); // el servidor descarta lo que no es del dashboard (updated, by)
      $('vnewf').onsubmit = async (e) => {
        e.preventDefault();
        const name = $('vnewn').value.trim(); if (!name) { $('vnewn').focus(); return; }
        const nv = await call({ type: 'matterai/views/save', view: { name, kind: 'phone', pinned: [] } }, 'Dashboard creado');
        if (nv) { this._vopen.add(nv.id); saveOpen(); await this._renderViews(); edit(nv.id); }
      };
      if ($('vauto')) $('vauto').onclick = async () => {
        const nv = await call({ type: 'matterai/views/save', view: { name: 'General', kind: 'phone', pinned: [] } });
        if (!nv) return;
        await call({ type: 'matterai/views/default', view_id: nv.id }, 'Listo: «General» es el dashboard de los equipos sin uno propio');
        await this._renderViews(); edit(nv.id);
      };
      main.querySelectorAll('[data-vtog]').forEach((b) => { b.onclick = () => { const id = b.dataset.vtog; if (this._vopen.has(id)) this._vopen.delete(id); else this._vopen.add(id); saveOpen(); this._renderViews(); }; });
      main.querySelectorAll('[data-ved]').forEach((b) => { b.onclick = () => edit(b.dataset.ved); });
      main.querySelectorAll('[data-vname]').forEach((inp) => { inp.onchange = async () => {
        const x = views.find((y) => y.id === inp.dataset.vname), name = inp.value.trim(); if (!x || !name || name === x.name) return;
        if (await call({ type: 'matterai/views/save', view: full(x, { name }) }, 'Nombre cambiado')) this._renderViews();
      }; });
      main.querySelectorAll('[data-vuse]').forEach((c) => { c.onchange = async () => {
        await call({ type: 'matterai/views/assign_user', user_id: c.dataset.vuse, view_id: c.checked ? c.dataset.v : null }, c.checked ? 'Asignado: el equipo lo toma al instante' : 'Sacado: ese equipo vuelve al general');
        this._renderViews();
      }; });
      main.querySelectorAll('[data-vdef]').forEach((c) => { c.onchange = async () => { await call({ type: 'matterai/views/default', view_id: c.checked ? c.dataset.vdef : null }, 'Guardado'); this._renderViews(); }; });
      main.querySelectorAll('[data-vdup]').forEach((b) => { b.onclick = async () => {
        const x = views.find((y) => y.id === b.dataset.vdup); if (!x) return;
        const nv = await call({ type: 'matterai/views/save', view: full(x, { id: undefined, name: `${x.name} (copia)`.slice(0, 40) }) }, 'Duplicado');
        if (nv) { this._vopen.add(nv.id); saveOpen(); this._renderViews(); }
      }; });
      main.querySelectorAll('[data-vdel]').forEach((b) => { b.onclick = async () => {
        const x = views.find((y) => y.id === b.dataset.vdel); if (!x) return;
        if (!confirm(`¿Borrar «${x.name}»? Sus equipos pasan al dashboard general.`)) return;
        if (await call({ type: 'matterai/views/delete', view_id: x.id }, 'Dashboard borrado')) { this._vopen.delete(x.id); saveOpen(); this._renderViews(); }
      }; });
      main.querySelectorAll('[data-asgu]').forEach((sel) => { sel.onchange = async () => { await call({ type: 'matterai/views/assign_user', user_id: sel.dataset.asgu, view_id: sel.value || null }, 'Asignado: el equipo lo toma al instante'); this._renderViews(); }; });
      main.querySelectorAll('[data-unlink]').forEach((b) => { b.onclick = async () => {
        const p = people.find((q) => q.user_id === b.dataset.unlink); if (!p) return;
        if (b.dataset.stale) {
          if (!confirm(`¿Quitar el vínculo viejo de «${p.name}»? El equipo sigue andando con el vínculo que usa ahora.`)) return;
          // su dashboard pasa al vínculo que queda (si ese no tiene uno)
          const keep = twinsOf(p).sort((a, c) => fresh(c) - fresh(a))[0];
          if (keep && p.view && !keep.view) await call({ type: 'matterai/views/assign_user', user_id: keep.user_id, view_id: p.view });
          if (await call({ type: 'matterai/app/revoke', user_id: p.user_id }, 'Duplicado quitado')) this._renderViews();
          return;
        }
        if (!confirm(`¿Desvincular «${p.name}»? Ese equipo deja de entrar a la casa (se vuelve a vincular con un código nuevo).`)) return;
        if (await call({ type: 'matterai/app/revoke', user_id: p.user_id }, 'Equipo desvinculado')) this._renderViews();
      }; });
      main.querySelectorAll('[data-asg]').forEach((sel) => { sel.onchange = async () => { await call({ type: 'matterai/views/assign', device_id: sel.dataset.asg, view_id: sel.value || null }, 'Asignado: el equipo lo toma al instante'); this._renderViews(); }; });
    }

    /* ---------- Seguridad: registro de auditoría y acceso del instalador ---------- */
    async _renderSec() {
      const r = await this._hass.callWS({ type: 'matterai/audit', limit: 500 });
      const arco = await this._hass.callWS({ type: 'matterai/privacy/arco_list' }).catch(() => ({ requests: [], kinds: {} }));
      const users = (await this._hass.callWS({ type: 'config/auth/list' }).catch(() => [])).filter((u) => u.group_ids && u.group_ids.includes('system-admin') && !u.system_generated);
      const sp = r.support || {};
      const when = (t) => new Date(t * 1000).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
      const KIND = { critical: 'mdi:lock-alert-outline', camera: 'mdi:cctv', access: 'mdi:cellphone-key', support: 'mdi:account-wrench-outline' };
      const integ = r.integrity || {};
      const main = this._page('sec', `<div class="box"><h2>Acceso del instalador a esta casa</h2>
          <p class="mut">Lo normal es <b>permanente</b>: entrás cuando hace falta y queda anotado acá. Si un cliente lo pide, el acceso lo habilita él desde la app (2 horas, 24 horas o 7 días) y se corta solo.</p>
          <div class="row"><label><input type="radio" name="sm" value="always" ${sp.mode !== 'owner' ? 'checked' : ''}> Permanente</label>
            <label><input type="radio" name="sm" value="owner" ${sp.mode === 'owner' ? 'checked' : ''}> Lo habilita el cliente desde la app</label></div>
          <div class="row" id="smu" ${sp.mode === 'owner' ? '' : 'hidden'}><span class="mut">Usuario de soporte:</span>
            <select id="su"><option value="">Elegí…</option>${users.filter((u) => !u.is_owner).map((u) => `<option value="${esc(u.id)}" ${sp.user_id === u.id ? 'selected' : ''}>${esc(u.name)}</option>`).join('')}</select></div>
          <p class="mut" id="smh" ${sp.mode === 'owner' ? '' : 'hidden'}>Creá un administrador aparte para el soporte (por ejemplo «MatterAI Soporte», con verificación en 2 pasos). La cuenta <b>dueña</b> de Home Assistant nunca se desactiva: guardala fuera de línea como llave de emergencia.</p>
          <div class="row"><label><input type="checkbox" id="sn" ${sp.notify ? 'checked' : ''}> Avisar a la app del cliente cada vez que entro</label></div>
          <div class="row"><button class="b pri" id="ss">Guardar</button>${sp.mode === 'owner' ? `<span class="mut">${sp.open ? `Habilitado hasta ${esc(when(sp.until))}` : 'Ahora: cortado (el cliente lo habilita desde Opciones de la app)'}</span>` : ''}</div></div>
        <div class="box"><h2>Pedidos de datos personales (ARCO)</h2>
          <p class="mut">Lo que piden los clientes desde la app (Opciones → Privacidad): ver sus datos, corregirlos, darse de baja. La ley da <b>10 días corridos</b> para el acceso y <b>5 días hábiles</b> para corregir o borrar. Al resolverlo, anotá qué hiciste: queda como constancia.</p>
          ${arco.requests.length ? `<table class="tb"><thead><tr><th>Cuándo</th><th>Pedido</th><th>Estado</th><th></th></tr></thead><tbody>
            ${arco.requests.map((q) => `<tr><td>${esc(when(q.at))}</td><td><b>${esc(arco.kinds[q.kind] || q.kind)}</b> · ${esc(q.device)}${q.detail ? `<br><small class="mut">${esc(q.detail)}</small>` : ''}</td>
              <td>${q.status === 'open' ? '<b class="wn">Pendiente</b>' : `<b class="ok">Resuelto</b> ${esc(when(q.resolved_at))}${q.note ? `<br><small class="mut">${esc(q.note)}</small>` : ''}`}</td>
              <td>${q.status === 'open' ? `<button class="b" data-arco="${esc(q.id)}">Marcar resuelto</button>` : ''}</td></tr>`).join('')}
          </tbody></table>` : '<p class="mut">No hay pedidos.</p>'}</div>
        <div class="box"><h2>Registro de auditoría</h2>
          <p class="mut">Cerraduras, alarma, portones, cámaras vistas desde la app, equipos vinculados o desvinculados, perfiles y cada vez que entra un administrador. No se puede editar: cada entrada guarda la huella (hash) de la anterior.</p>
          <p>${integ.ok ? `<b class="ok">✓ Registro íntegro</b> · ${integ.rows} entradas` : `<b class="bad">⚠️ El registro fue modificado (entrada ${esc(integ.broken_at)})</b>`}</p>
          ${r.entries.length ? `<table class="tb"><thead><tr><th>Cuándo</th><th>Qué</th><th>Quién</th></tr></thead><tbody>
            ${r.entries.map((e) => `<tr><td>${esc(when(e.t))}</td><td><ha-icon icon="${KIND[e.kind] || 'mdi:information-outline'}"></ha-icon> ${esc(e.what)}${e.target ? ` · <b>${esc(e.target)}</b>` : ''}${e.detail ? `<br><small class="mut">${esc(e.detail)}</small>` : ''}</td><td>${esc(e.who || '')}</td></tr>`).join('')}
          </tbody></table>` : '<p class="mut">Todavía no hay nada registrado.</p>'}</div>`);
      if (!main) return;
      const $ = (id) => main.querySelector(`#${id}`);
      main.querySelectorAll('[data-arco]').forEach((b) => {
        b.onclick = async () => {
          const note = prompt('¿Qué hiciste? (queda como constancia, por ejemplo: «Le mandé sus datos por mail el 4/11»)');
          if (note == null) return;
          try { await this._hass.callWS({ type: 'matterai/privacy/arco_resolve', request_id: b.dataset.arco, note }); this._toast('Pedido resuelto'); } catch (e) { this._toast(`No se pudo: ${e.message || e}`); }
          this._renderSec();
        };
      });
      main.querySelectorAll('[name="sm"]').forEach((el) => { el.onchange = () => { const o = el.value === 'owner' && el.checked; $('smu').hidden = !o; $('smh').hidden = !o; }; });
      $('ss').onclick = async () => {
        const mode = main.querySelector('[name="sm"]:checked').value;
        if (mode === 'owner' && !$('su').value) { this._toast('Elegí el usuario de soporte'); return; }
        if (mode === 'owner' && !confirm('Ese usuario queda desactivado hasta que el cliente lo habilite desde la app. ¿Seguir?')) return;
        try {
          await this._hass.callWS({ type: 'matterai/support/set', mode, user_id: mode === 'owner' ? $('su').value : null, notify: $('sn').checked });
          this._toast('Guardado');
        } catch (e) { this._toast(`No se pudo: ${e.message || e}`); }
        this._renderSec();
      };
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
