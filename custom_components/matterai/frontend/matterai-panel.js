/*
 * Panel MatterAI (barra lateral de Home Assistant, sólo administradores = el instalador).
 *   Dashboard: editor visual + vista previa + Guardar (la app de los clientes cambia al momento).
 *   App del cliente: QR y link para vincular el celular; generar un acceso nuevo.
 *   Automatizaciones: las de MatterAI (vista del instalador).
 *   Copias y plantillas: copia de seguridad, restaurar y plantillas para usar en otras casas.
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
  .lst{display:flex;flex-direction:column;gap:6px;max-height:340px;overflow:auto;margin:8px 0}
  .it{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:10px;background:rgba(127,127,127,.08)}
  .it .tx{flex:1;min-width:0}.it .t2{opacity:.65;font-size:12.5px}
  .it input{width:18px;height:18px}
  .fld{width:100%;box-sizing:border-box;padding:9px 11px;border-radius:10px;border:1px solid var(--divider-color,rgba(255,255,255,.2));background:rgba(127,127,127,.08);color:inherit;font:inherit;margin:4px 0}
  .res{padding:10px 12px;border-radius:10px;margin:8px 0;font-size:14px;background:rgba(62,207,142,.12)}
  .res.bad{background:rgba(219,68,55,.14)}
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
        <nav>${[['dash', 'Dashboard'], ['auto', 'Automatizaciones'], ['app', 'App del cliente'], ['copias', 'Copias y plantillas'], ['status', 'Estado']].map(([k, l]) => `<button data-tab="${k}" class="${k === this._tab ? 'on' : ''}">${l}</button>`).join('')}</nav><main id="main"><p class="mut">Cargando…</p></main>`;
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
      if (tab === 'dash') this._renderDash(); else if (tab === 'auto') this._renderAuto(); else if (tab === 'app') this._renderApp(); else if (tab === 'copias') this._renderCopias(); else this._renderStatus();
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

    /* ---------- Mantenimiento del sistema (watchdog) ---------- */
    _wdBox(wd) {
      if (!wd) return '<div class="box"><h2>Mantenimiento del sistema</h2><p class="mut">Iniciando…</p></div>';
      const when = (iso) => { try { return new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); } catch (_) { return ''; } };
      const dur = (secs) => (secs < 120 ? `${secs} s` : secs < 7200 ? `${Math.round(secs / 60)} min` : `${Math.round(secs / 3600)} h`);
      const CLS = { ok: 'ok', recuperando: 'wn', esperando_hardware: 'wn', esperando_dependencia: 'wn', caido: 'bad', atencion_manual: 'bad', mantenimiento: 'mut', sin_datos: 'mut' };
      if (!wd.available) {
        return `<div class="box"><h2>Mantenimiento del sistema</h2><p class="mut">Esta casa no tiene Supervisor (Home Assistant Core o Container): no se pueden vigilar ni recuperar complementos.</p></div>`;
      }
      const svc = wd.services.length ? wd.services.map((x) => `<div class="kv" style="flex-wrap:wrap"><span>${esc(x.name)}${x.version ? ` <span class="mut">${esc(x.version)}</span>` : ''}</span><b class="${CLS[x.status] || ''}">${esc(x.status_text)}</b>
          ${x.detail || x.restarts || x.last_down_secs ? `<div class="mut" style="flex-basis:100%;font-size:12.5px">${esc([x.detail, x.down_since ? `caído desde ${when(x.down_since)}` : '', x.attempts ? `${x.attempts} intento(s)` : '', x.restarts ? `${x.restarts} recuperación(es) automática(s) en total` : '', !x.down_since && x.last_down_secs ? `última caída: ${dur(x.last_down_secs)}${x.recovered_at ? `, volvió el ${when(x.recovered_at)}` : ''}` : '', x.update_note].filter(Boolean).join(' · '))}</div>` : ''}</div>`).join('')
        : '<p class="mut">No hay servicios para vigilar en esta casa (Zigbee2MQTT, Mosquitto…).</p>';
      const bridges = Object.entries(wd.bridges || {});
      return `<div class="box"><h2>Mantenimiento del sistema</h2>
        <p class="mut">MatterAI vigila los servicios críticos y los recupera solo (primero las dependencias, con esperas crecientes entre intentos). Si alguno sigue caído, te avisa por el panel central y en Reparaciones.</p>
        ${svc}
        ${bridges.length ? `<p class="mut">Zigbee2MQTT por MQTT: ${bridges.map(([b, v]) => `${esc(b)} ${v.state === 'online' ? '🟢 online' : '🔴 offline'}`).join(' · ')}</p>` : ''}
        ${wd.coordinator && !wd.coordinator.ok ? `<div class="al warning">${esc(wd.coordinator.detail)}</div>` : ''}
        ${wd.maintenance_until ? `<div class="al warning">🔧 En mantenimiento hasta las ${esc(when(wd.maintenance_until))}: no reinicia nada ni avisa.</div>` : ''}
        <div class="row">${wd.maintenance_until ? '<button class="b pri" id="wdoff">Terminar mantenimiento</button>' : '<button class="b" id="wdmaint">Mantenimiento 1 hora</button>'}<button class="b" id="wdcheck">Revisar ahora</button></div>
        <p class="mut">Usá «Mantenimiento» antes de actualizar el firmware del coordinador o un complemento a mano, así no interviene.</p></div>`;
    }

    /* ---------- Copias y plantillas ---------- */
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
    async _renderCopias() {
      const main = this.shadowRoot.getElementById('main');
      main.innerHTML = '<div class="box"><p class="mut">Cargando…</p></div>';
      let st, rules = [];
      try {
        st = await this._hass.callWS({ type: 'matterai/status' });
        rules = (await this._hass.callWS({ type: 'matterai/backup/export' })).data.automations?.rules || [];
      } catch (e) { main.innerHTML = `<div class="box"><p>${esc(e.message || e)}</p></div>`; return; }
      if (this._tab !== 'copias') return;
      const c = st.central;
      const when = (iso) => { try { return new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); } catch (_) { return ''; } };
      const KIND = { scene: 'Escena', auto: 'Automática', period: 'Horario', timer: 'Temporizador', loop: 'Ciclo', presence: 'Simular presencia', irrigation: 'Riego', circadian: 'Luz circadiana', room: 'Luz por presencia', watch: 'Avisar si quedó abierto', away: 'Me voy / Llego', night: 'Buenas noches', clima: 'Clima', wake: 'Despertador', reminder: 'Recordatorio', calalert: 'Calendario', doorbell: 'Portero', fdetect: 'Cámaras', fface: 'Caras y patentes', tv: 'Tele', guest: 'Invitados', gate: 'Portón inteligente' };
      const noCentral = !c.configured ? '<p class="mut">Las plantillas y las copias automáticas usan el <b>panel central</b>: cargá la clave de la casa en Estado → «Cambiar datos».</p>' : '';
      main.innerHTML = `<div class="st">
        <div class="box"><h2>Copia de seguridad</h2>
          <p class="mut">El dashboard de la app, las automatizaciones y sus ajustes. ${c.configured ? 'Se manda sola al panel central cada vez que cambia algo (revisa cada 15 minutos).' : ''}</p>
          ${c.configured ? `<div class="kv"><span>Última copia en el panel central</span><b class="${c.last_backup ? 'ok' : 'mut'}">${c.last_backup ? esc(when(c.last_backup)) : 'Todavía no'}</b></div>${c.backup_error ? `<p class="bad">${esc(c.backup_error)}</p>` : ''}` : noCentral}
          <div class="row">${c.configured ? '<button class="b pri" id="bsend">Mandar copia ahora</button>' : ''}<button class="b" id="bdl">Bajar copia (archivo)</button></div>
          <h3>Restaurar</h3>
          <p class="mut">Reemplaza el dashboard y las automatizaciones por los de una copia. Antes guarda cómo está ahora, así lo podés deshacer.${c.configured ? ' Las copias del panel central se restauran desde el panel central (botón «Copias» de la casa).' : ''}</p>
          <div class="row"><button class="b" id="bup">Restaurar todo desde un archivo…</button><button class="b" id="bsome">Restaurar algunas automatizaciones…</button><button class="b" id="bundo">Deshacer la última restauración</button></div>
          <div id="bres"></div></div>

        <div class="box"><h2>Plantillas de automatizaciones</h2>
          <p class="mut">Guardá automatizaciones que armaste acá para usarlas en otras casas (por ejemplo «Baño con presencia y extractor»). En la otra casa llegan <b>pausadas</b>: elegís los equipos de esa casa y las activás.</p>
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

        <div class="box"><h2>Plantillas de diseño (dashboard)</h2>
          <p class="mut">Guardá el diseño de la app de esta casa para arrancar otra igual. Al usar una plantilla se carga en el editor del Dashboard: la revisás, ajustás los ambientes y recién ahí la guardás.</p>
          ${noCentral}
          <input class="fld" id="dname" placeholder="Nombre (ej: Casa con pileta y quincho)" maxlength="80">
          <div class="row">${c.configured ? '<button class="b pri" id="dsave">Guardar diseño en el panel central</button>' : ''}<button class="b" id="dfile">Bajar como archivo</button></div>
          <h3>Usar un diseño</h3>
          <div id="dlist">${c.configured ? '<p class="mut">Cargando…</p>' : ''}</div>
          <div class="row"><button class="b" id="dup">Usar un archivo…</button></div></div>
      </div>`;
      const $ = (id) => main.querySelector('#' + id);
      const ws = (m) => this._hass.callWS(m);
      const fail = (e) => this._toast(e.message || String(e));
      const showRes = (box, r) => {
        if (r.kind === 'dashboard') return this._useDashboard(r.config);
        const lines = [`✓ Se sumaron ${r.created.length} automatización(es), <b>pausadas</b>: revisalas en la pestaña Automatizaciones y activalas.`];
        if (r.failed.length) lines.push(`✗ No se pudieron sumar: ${r.failed.map((f) => `${esc(f.name)} (${esc(f.error)})`).join('; ')}`);
        const cand = r.candidates || {};
        const map = r.missing.length && r.created.length ? `<h3>Emparejar equipos</h3>
          <p class="mut">La plantilla usa equipos que en esta casa no existen. Elegí el equivalente de esta casa para cada uno (se cambia en todas las automatizaciones que se sumaron):</p>
          <div class="lst">${r.missing.map((m) => `<div class="it"><span class="tx"><b>${esc(m)}</b></span><select class="fld" style="width:auto;max-width:60%" data-from="${esc(m)}"><option value="">(dejarlo así)</option>${(cand[m] || []).map((o) => `<option value="${esc(o.id)}">${esc(o.name)} · ${esc(o.id)}</option>`).join('')}</select></div>`).join('')}</div>
          <div class="row"><button class="b pri" id="${box}_map">Usar estos equipos</button></div>` : '';
        $(box).innerHTML = `<div class="res ${r.failed.length ? 'bad' : ''}">${lines.join('<br>')}</div>${map}`;
        const mb = $(`${box}_map`);
        if (mb) mb.onclick = () => {
          const mapping = {};
          $(box).querySelectorAll('select[data-from]').forEach((sel) => { if (sel.value) mapping[sel.dataset.from] = sel.value; });
          if (!Object.keys(mapping).length) return this._toast('Elegí al menos un equipo');
          ws({ type: 'matterai/templates/remap', rule_ids: r.created.map((x) => x.id), mapping }).then((x) => {
            $(box).innerHTML = `<div class="res">✓ Equipos cambiados en ${x.changed} automatización(es).${x.missing.length ? ` Todavía faltan: ${x.missing.map(esc).join(', ')} (cambialos en cada automatización).` : ' Revisalas en Automatizaciones y activalas.'}</div>`;
          }, fail);
        };
      };
      const picked = () => [...main.querySelectorAll('#trules input:checked')].map((i) => i.value);
      const fname = (n) => (n || 'matterai').toLowerCase().split(' ').join('-');

      if ($('bsend')) $('bsend').onclick = () => ws({ type: 'matterai/backup/send' }).then(() => { this._toast('Copia mandada al panel central'); this._renderCopias(); }, fail);
      $('bdl').onclick = () => ws({ type: 'matterai/backup/export' }).then((r) => this._download(`copia-${fname(st.name)}-${new Date().toISOString().slice(0, 10)}.json`, r.data), fail);
      $('bup').onclick = async () => {
        const data = await this._pickFile(); if (!data) return;
        if (!confirm('¿Restaurar esta copia? Se reemplazan el dashboard y TODAS las automatizaciones de esta casa (lo actual queda guardado para deshacer).')) return;
        ws({ type: 'matterai/backup/restore', data }).then((r) => { $('bres').innerHTML = `<div class="res">✓ Restaurada: ${r.automations ?? 0} automatizaciones${r.dashboard ? ' y el dashboard' : ''}.</div>`; this._reloadConfig(); }, fail);
      };
      $('bsome').onclick = async () => {
        const data = await this._pickFile(); if (!data) return;
        const list = (data.automations && data.automations.rules) || [];
        if (!list.length) return this._toast('Ese archivo no trae automatizaciones');
        const here = new Set(rules.map((r) => r.id));
        $('bres').innerHTML = `<h3>¿Cuáles restaurar?</h3><p class="mut">Las que ya existen se reemplazan por la versión de la copia; las que no, se suman. El resto queda como está.</p>
          <div class="lst" id="srules">${list.map((r) => `<label class="it"><input type="checkbox" value="${esc(r.id)}"><span class="tx"><b>${esc(r.name)}</b><div class="t2">${esc(KIND[r.kind] || r.kind)} · ${here.has(r.id) ? 'reemplaza la actual' : 'se suma'}</div></span></label>`).join('')}</div>
          <div class="row"><button class="b pri" id="sdo">Restaurar las elegidas</button></div>`;
        $('sdo').onclick = () => {
          const ids = [...main.querySelectorAll('#srules input:checked')].map((i) => i.value);
          if (!ids.length) return this._toast('Elegí al menos una');
          ws({ type: 'matterai/backup/restore_some', data, rule_ids: ids }).then((x) => { $('bres').innerHTML = `<div class="res">✓ Restauradas ${x.restored} automatización(es).</div>`; }, fail);
        };
      };
      $('bundo').onclick = () => { if (confirm('¿Volver a como estaba antes de la última restauración?')) ws({ type: 'matterai/backup/restore', undo: true }).then(() => { this._toast('Listo: volvió a como estaba'); this._reloadConfig(); }, fail); };
      const tsave = (toFile) => {
        const ids = picked(); const name = $('tname').value.trim();
        if (!ids.length) return this._toast('Elegí las automatizaciones');
        if (!name) return this._toast('Ponele un nombre');
        ws({ type: 'matterai/templates/save', kind: 'automations', name, description: $('tdesc').value.trim(), rule_ids: ids, to_file: toFile })
          .then((r) => { if (toFile) this._download(`plantilla-${fname(name)}.json`, r.file); else { this._toast('Plantilla guardada en el panel central'); this._renderCopias(); } }, fail);
      };
      if ($('tsave')) $('tsave').onclick = () => tsave(false);
      if ($('tfile')) $('tfile').onclick = () => tsave(true);
      $('tup').onclick = async () => { const f = await this._pickFile(); if (f) ws({ type: 'matterai/templates/use', file: f }).then((r) => showRes('tres', r), fail); };
      const dsave = (toFile) => {
        const name = $('dname').value.trim(); if (!name) return this._toast('Ponele un nombre');
        ws({ type: 'matterai/templates/save', kind: 'dashboard', name, to_file: toFile })
          .then((r) => { if (toFile) this._download(`diseno-${fname(name)}.json`, r.file); else { this._toast('Diseño guardado en el panel central'); this._renderCopias(); } }, fail);
      };
      if ($('dsave')) $('dsave').onclick = () => dsave(false);
      $('dfile').onclick = () => dsave(true);
      $('dup').onclick = async () => { const f = await this._pickFile(); if (f) ws({ type: 'matterai/templates/use', file: f }).then((r) => showRes('tres', r), fail); };

      if (!c.configured) return;
      const list = (box, kind) => ws({ type: 'matterai/templates/list', kind }).then((r) => {
        if (this._tab !== 'copias') return;
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
      // después de restaurar, el editor del Dashboard arranca de lo que quedó guardado
      try { const r = await this._hass.callWS({ type: 'matterai/config' }); this._saved = JSON.stringify(r.config); this._draft = r.config; } catch (_) { /* se ve al recargar */ }
    }
    _useDashboard(config) {
      if (this._dirty() && !confirm('Hay cambios sin guardar en el dashboard. ¿Reemplazarlos por la plantilla?')) return;
      this._draft = config;
      this._go('dash');
      this._toast('Diseño cargado en el editor: revisalo y tocá Guardar');
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
      let wd = null;
      try { wd = await this._hass.callWS({ type: 'matterai/watchdog' }); } catch (_) { /* iniciando */ }
      let vl = { items: [], on: false };
      try { vl = await this._hass.callWS({ type: 'matterai/voice_log' }); } catch (_) { /* integración vieja */ }
      const WHY = { no: ['bad', 'No entendió'], duda: ['wn', 'Preguntó de vuelta'], ia: ['mut', 'Lo resolvió la IA'] };
      const when = (iso) => { try { return new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); } catch (_) { return ''; } };
      main.innerHTML = `<div class="st">
        <div class="box"><h2>Casa</h2>
          <div class="kv"><span>Cliente</span><b>${esc(s.name)}</b></div>
          <div class="kv"><span>Dirección remota</span><b>${esc(s.url)}</b></div>
          <div class="kv"><span>WhatsApp de soporte</span><b>${esc(s.support_phone || '—')}</b></div>
          <div class="kv"><span>Versión MatterAI</span><b>${esc(s.version)}${c.latest && c.latest !== s.version ? ` <span class="wn">(hay ${esc(c.latest)}: actualizala desde el panel central o HACS)</span>` : c.latest ? ' <span class="ok">· la última</span>' : ''}</b></div>
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
          ${c.configured ? `<div class="kv"><span>Última copia de seguridad</span><b class="${c.last_backup ? 'ok' : 'mut'}">${c.last_backup ? esc(new Date(c.last_backup).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })) : 'Todavía no'}</b></div>` : ''}
          ${c.error ? `<p class="mut">${esc(c.error)}</p>` : ''}
          ${c.configured ? `<div class="row"><button class="b" id="hb">Probar ahora</button>${c.url ? `<a class="b" href="${esc(c.url)}" target="_blank" rel="noopener">Abrir panel central</a>` : ''}</div>` : '<p class="mut">Cargá la clave de la casa en «Cambiar datos» para verla en tu panel central.</p>'}
          <div class="kv"><span>Automatizaciones</span>${yes(s.escenas, 'Activas', 'Iniciando…')}</div>
          <div class="kv"><span>Control por voz</span>${!s.voice.on ? '<b class="mut">Desactivado</b>' : s.voice.ai ? `<b class="ok">${s.voice.mode === 'ai' ? 'Con IA' : 'Gratis + IA'}</b>` : '<b class="ok">Gratis</b>'}</div>
          ${s.voice.on && !s.voice.ai ? '<p class="mut">Entiende los pedidos comunes sin costo. Para que entienda cualquier frase, cargá una clave de Anthropic en «Cambiar datos».</p>' : ''}</div>
        <div class="box"><h2>Avisos</h2>
          <div class="kv"><span>Entidades</span><b>${s.health.stats.entities}</b></div>
          <div class="kv"><span>Equipos sin responder</span><b class="${s.health.stats.unavailable ? 'wn' : 'ok'}">${s.health.stats.unavailable}</b></div>
          ${al.length ? al.map((a) => `<div class="al ${esc(a.level)}">${esc(a.text)}</div>`).join('') : '<p class="ok">Todo en orden</p>'}</div>
        ${this._wdBox(wd)}
        ${vl.on ? `<div class="box vlog"><h2>Frases que la voz no entendió</h2>
          <p class="mut">Lo que el modo gratis no supo resolver. Pasale esta lista a quien mantiene MatterAI para sumar esas formas de hablar.</p>
          ${vl.items.length ? `<div class="vl">${vl.items.map((x) => `<div class="vli"><span class="vlw ${WHY[x.why] ? WHY[x.why][0] : ''}">${esc(WHY[x.why] ? WHY[x.why][1] : x.why)}</span><b>“${esc(x.text)}”</b><small>${esc(when(x.at))}${x.say ? ` · ${esc(x.say)}` : ''}</small></div>`).join('')}</div>
            <div class="row"><button class="b" id="vlcopy">Copiar lista</button><button class="b warn" id="vlclear">Borrar lista</button></div>` : '<p class="ok">Nada por ahora: entendió todo.</p>'}</div>` : ''}</div>`;
      const vc = main.querySelector('#vlclear');
      if (vc) vc.onclick = async () => { if (!confirm('¿Borrar la lista de frases?')) return; await this._hass.callWS({ type: 'matterai/voice_log', clear: true }); this._renderStatus(); };
      const vy = main.querySelector('#vlcopy');
      if (vy) vy.onclick = async () => { try { await navigator.clipboard.writeText(vl.items.map((x) => `${x.why}: ${x.text}`).join(String.fromCharCode(10))); this._toast('Lista copiada'); } catch (_) { this._toast('No se pudo copiar'); } };
      const wdAct = (m, ok) => this._hass.callWS({ type: 'matterai/watchdog', ...m }).then(() => { if (ok) this._toast(ok); this._renderStatus(); }, (e) => this._toast(e.message || String(e)));
      const wm = main.querySelector('#wdmaint'); if (wm) wm.onclick = () => wdAct({ maintenance_minutes: 60 }, 'Mantenimiento activado por 1 hora');
      const wo = main.querySelector('#wdoff'); if (wo) wo.onclick = () => wdAct({ maintenance_minutes: 0 }, 'Mantenimiento desactivado: vuelve a vigilar');
      const wc = main.querySelector('#wdcheck'); if (wc) wc.onclick = () => wdAct({ check: true }, 'Revisado');
      const hbBtn = main.querySelector('#hb');
      if (hbBtn) hbBtn.onclick = async () => { const r = await this._hass.callWS({ type: 'matterai/heartbeat' }); this._toast(r.ok ? 'Panel central: conectado' : `Panel central: ${r.error || 'sin conexión'}`); this._renderStatus(); };
    }
  }
  if (!customElements.get('matterai-admin-panel')) customElements.define('matterai-admin-panel', MatterAIAdminPanel);
})();
