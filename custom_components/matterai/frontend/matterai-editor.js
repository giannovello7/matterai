/*
 * MatterAI · editor de dashboards (modo edición, como el de Home Assistant).
 *
 *   window.MaeEditor.open(panel, viewId)
 *
 * - Vista previa real (el mismo motor que la app: vista.js) del celular o la tablet, horizontal o vertical.
 * - Tarjetas: agregar del catálogo, mover arrastrando con el mouse o con flechas, pasar de columna, duplicar, borrar.
 * - Propiedades de cada tarjeta: título, equipos (con buscador), acción al tocar y al mantener de cada botón.
 * - Plano: subir las imágenes (apagado, prendido, de día) y dibujar cada ambiente encima con sus luces.
 * - «Prearmado»: arranca del diseño de los prototipos con los equipos de esta casa.
 * Lo que se guarda le llega al instante a los equipos que tienen ese dashboard (sin actualizar la app).
 */
(function () {
  'use strict';
  const BASE = '/matterai_static';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clone = (o) => JSON.parse(JSON.stringify(o == null ? null : o));
  const loadScript = (src) => new Promise((res, rej) => {
    if (document.querySelector(`script[data-mae-ed="${src.split('?')[0]}"]`)) return res();
    const s = document.createElement('script'); s.src = src; s.dataset.maeEd = src.split('?')[0]; s.onload = res; s.onerror = rej; document.head.appendChild(s);
  });

  const ACTION_TYPES = [['none', 'Nada'], ['toggle', 'Prender / apagar / abrir'], ['more_info', 'Ver más (ventana del equipo)'], ['room', 'Abrir un ambiente'], ['screen', 'Abrir una pantalla'], ['service', 'Llamar a un servicio']];
  const KPI_KINDS = [['alarm', 'Alarma'], ['lights', 'Luces prendidas'], ['temp', 'Temperatura adentro'], ['acs', 'Aires'], ['curtains', 'Cortinas'], ['power', 'Consumo'], ['people', 'Quién está'], ['entity', 'Un equipo (portón, sensor…)']];
  const PICK = { // qué equipos se ofrecen en cada campo
    camera: ['camera'], gate: ['cover', 'lock'], alarm: ['alarm_control_panel'], lock: ['lock'], away: ['input_boolean', 'switch', 'scene', 'script'],
    scenes: ['scene', 'script'], routines: ['automation'], any: null,
  };
  const CSS = `
  .ed{position:fixed;inset:0;z-index:50;display:grid;grid-template-columns:290px 1fr 340px;grid-template-rows:auto 1fr;background:#11151a;color:#e9ecf2;font:14px/1.4 "Red Hat Display",system-ui,sans-serif}
  .ed *{box-sizing:border-box}.ed button{font:inherit;color:inherit;cursor:pointer}
  .ed-top{grid-column:1/4;display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid rgba(160,175,200,.15);background:#161b21;flex-wrap:wrap}
  .ed-top h2{margin:0 10px 0 0;font-size:17px}.ed-top .sp{flex:1}
  .eb{padding:8px 13px;border-radius:10px;border:1px solid rgba(160,175,200,.2);background:#1e242e}.eb:hover{background:#262e3a}
  .eb.pri{background:#f2b766;color:#1b1408;border:0;font-weight:700}.eb.warn{color:#f08a7c}.eb.sm{padding:5px 9px;font-size:12.5px}
  .eseg{display:inline-flex;background:#0d1116;border-radius:10px;padding:3px}.eseg button{border:0;background:none;padding:6px 11px;border-radius:8px;color:#8f99ab;font-weight:600}.eseg button.on{background:#262e3a;color:#e9ecf2}
  .ed-l,.ed-r{overflow:auto;padding:12px;background:#161b21}.ed-l{border-right:1px solid rgba(160,175,200,.15)}.ed-r{border-left:1px solid rgba(160,175,200,.15)}
  .ed h4{margin:14px 2px 8px;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#8f99ab}
  .bl{display:flex;align-items:center;gap:6px;padding:8px;margin-bottom:6px;border-radius:12px;background:#1e242e;border:1px solid rgba(160,175,200,.15);cursor:grab;user-select:none}
  .bl.sel{border-color:#f2b766}.bl.drag{opacity:.4}.bl.over{box-shadow:0 -3px 0 #f2b766}
  .bl .h{color:#8f99ab;cursor:grab}.bl .n{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.bl .n small{display:block;color:#8f99ab;font-size:11.5px}
  .bl button{border:0;background:none;color:#8f99ab;padding:3px 5px;border-radius:6px}.bl button:hover{background:#262e3a;color:#e9ecf2}
  .colbox{min-height:44px;padding:6px;border-radius:12px;border:1px dashed rgba(160,175,200,.2);margin-bottom:8px}.colbox.over{border-color:#f2b766}
  .cat{display:grid;grid-template-columns:1fr 1fr;gap:6px}
  .cat button{padding:10px;border-radius:12px;background:#1e242e;border:1px solid rgba(160,175,200,.15);text-align:left}.cat button b{display:block}.cat button small{color:#8f99ab;font-size:11.5px}
  .ed-c{overflow:auto;display:flex;align-items:flex-start;justify-content:center;padding:24px;background:#0b0e12}
  .frame{position:relative;transform:translateZ(0);overflow:auto;border:10px solid #050608;border-radius:34px;background:#161b21;box-shadow:0 30px 80px rgba(0,0,0,.6);flex:none}
  .frame .vista{min-height:100%!important;height:100%}
  .fld{display:flex;flex-direction:column;gap:4px;margin-bottom:10px}.fld>span{font-size:12px;color:#8f99ab}
  .fld input,.fld select,.fld textarea{width:100%;padding:8px 10px;border-radius:10px;border:1px solid rgba(160,175,200,.2);background:#0d1116;color:#e9ecf2;font:inherit}
  .fld textarea{min-height:60px;font-family:"Red Hat Mono",monospace;font-size:12px}
  .chk{display:flex;align-items:center;gap:8px;margin-bottom:10px}
  .it{padding:10px;border-radius:12px;background:#1e242e;border:1px solid rgba(160,175,200,.15);margin-bottom:8px}
  .it .row{display:flex;gap:6px;align-items:center;margin-bottom:6px}.it .row b{flex:1}
  .act{padding:8px;border-radius:10px;background:#161b21;margin-top:4px}
  .ml{display:flex;flex-direction:column;gap:4px;max-height:220px;overflow:auto;padding:6px;border-radius:10px;background:#0d1116;border:1px solid rgba(160,175,200,.2)}
  .ml label{display:flex;align-items:center;gap:8px;font-size:13px}
  .ord{display:flex;align-items:center;gap:6px;padding:6px 8px;border-radius:9px;background:#1e242e;margin-bottom:4px}.ord span{flex:1}
  .ord button{border:0;background:none;color:#8f99ab}
  .hint{color:#8f99ab;font-size:12.5px}
  .pe{position:fixed;inset:0;z-index:60;background:rgba(5,7,10,.92);display:grid;grid-template-columns:1fr 340px}
  .pe-c{overflow:auto;display:flex;align-items:center;justify-content:center;padding:20px}
  .pe-img{position:relative;display:inline-block;max-height:calc(100vh - 40px)}
  .pe-img img{display:block;max-height:calc(100vh - 40px);max-width:100%;user-select:none;-webkit-user-drag:none}
  .pe-img svg{position:absolute;inset:0;width:100%;height:100%;cursor:crosshair}
  .pe-r{background:#161b21;overflow:auto;padding:14px;border-left:1px solid rgba(160,175,200,.15)}
  .slot{display:flex;align-items:center;gap:8px;padding:8px;border-radius:10px;background:#1e242e;margin-bottom:6px}.slot img{width:44px;height:44px;object-fit:cover;border-radius:6px;background:#0d1116}.slot span{flex:1}
  .zl{padding:8px;border-radius:10px;background:#1e242e;margin-bottom:6px;border:1px solid transparent;cursor:pointer}.zl.sel{border-color:#f2b766}
  .toastE{position:fixed;z-index:70;left:50%;bottom:22px;transform:translateX(-50%);background:#262e3a;border:1px solid rgba(160,175,200,.2);padding:10px 16px;border-radius:12px;display:none}
  @media (max-width:1100px){.ed{grid-template-columns:240px 1fr 300px}}`;

  function open(panel, viewId) { return new Editor(panel, viewId).start(); }

  class Editor {
    constructor(panel, viewId) { this.p = panel; this.hass = panel._hass; this.viewId = viewId; this.sel = null; this.undo = []; }

    async start() {
      await loadScript(`${BASE}/vista.js?t=${Date.now()}`);
      const css = await fetch(`${BASE}/vista.css?t=${Date.now()}`).then((r) => r.text()).catch(() => '');
      const [lst, cfg] = await Promise.all([this.hass.callWS({ type: 'matterai/views/list' }), this.hass.callWS({ type: 'matterai/config' })]);
      const v = lst.views.find((x) => x.id === this.viewId);
      if (!v) { this.p._toast('Ese dashboard no existe'); return; }
      this.cfg = cfg.config || {};
      this.saved = clone(v);
      this.v = clone(v);
      // la tarjeta MatterAI sin dibujarse: da el modelo de la casa (ambientes, luces, cámaras…)
      const Card = customElements.get('matterai-home-card');
      this.card = Card ? document.createElement('matterai-home-card') : null;
      if (this.card) { this.card.setAttribute('headless', ''); this.card.setConfig(Object.assign({}, this.cfg)); this.card.hass = this.hass; }
      // estructura
      const root = this.p.shadowRoot;
      this.wrap = document.createElement('div');
      this.wrap.innerHTML = `<style>${CSS}</style><style>${css}</style><div class="ed" id="ed"></div><div class="toastE" id="toastE"></div>`;
      root.appendChild(this.wrap);
      this.$ = (s) => this.wrap.querySelector(s);
      if (!Array.isArray(this.v.blocks) || !this.v.blocks.length) this.prearmado(true);
      this.draw();
      this.keyH = (e) => { if (e.key === 'Escape' && !this.pe) this.close(); };
      window.addEventListener('keydown', this.keyH);
      return this;
    }
    model() { return this.card && this.card.model ? this.card.model() : null; }
    states() { return this.hass.states; }
    fname(id) { const s = this.states()[id]; return (s && s.attributes.friendly_name) || id; }
    toast(t) { const e = this.$('#toastE'); e.textContent = t; e.style.display = 'block'; clearTimeout(this.tt); this.tt = setTimeout(() => { e.style.display = 'none'; }, 2200); }
    dirty() { return JSON.stringify(this.v) !== JSON.stringify(this.saved); }
    push() { this.undo.push(JSON.stringify(this.v)); if (this.undo.length > 60) this.undo.shift(); }
    change(fn) { this.push(); fn(); this.draw(); }

    prearmado(silent) {
      const m = this.model();
      const d = window.MaeVista.defaults(this.v.kind || 'phone', m || { rooms: [], access: [], cams: [], roomOf: {}, scenes: [] }, this.v, this.states(), this.cfg.floorplan);
      if (!silent) this.push();
      this.v.blocks = d.blocks;
      if (!this.v.plan && d.plan) this.v.plan = d.plan;
      if (!this.v.orientation) this.v.orientation = d.orientation;
      if (!silent) { this.sel = null; this.draw(); this.toast('Listo: el prearmado con los equipos de esta casa'); }
    }

    /* ───────── dibujo ───────── */
    draw() {
      const v = this.v, K = v.kind || 'phone';
      this.$('#ed').innerHTML = `
        <div class="ed-top"><button class="eb" data-e="close">← Volver</button><h2>${esc(v.name)}</h2>
          <span class="eseg">${[['phone', 'Celular'], ['tablet', 'Tablet']].map(([k, l]) => `<button data-kind="${k}" class="${K === k ? 'on' : ''}">${l}</button>`).join('')}</span>
          ${K === 'tablet' ? `<span class="eseg">${[['landscape', 'Horizontal'], ['portrait', 'Vertical']].map(([k, l]) => `<button data-ori="${k}" class="${(v.orientation || 'landscape') === k ? 'on' : ''}">${l}</button>`).join('')}</span>` : ''}
          <button class="eb" data-e="plan">Plano e imágenes</button><span class="sp"></span>
          <button class="eb" data-e="undo" ${this.undo.length ? '' : 'disabled'}>Deshacer</button><button class="eb" data-e="pre">Prearmado</button>
          <button class="eb" data-e="reset" ${this.dirty() ? '' : 'disabled'}>Descartar cambios</button><button class="eb pri" data-e="save" ${this.dirty() ? '' : 'disabled'}>Guardar</button></div>
        <div class="ed-l" id="edl"></div><div class="ed-c"><div class="frame" id="frame"></div></div><div class="ed-r" id="edr"></div>`;
      this.drawList(); this.drawPreview(); this.drawProps(); this.bind();
    }
    blocks() { return this.v.blocks || (this.v.blocks = []); }
    drawList() {
      const K = this.v.kind || 'phone', CAT = window.MaeVista.CATALOG;
      const row = (b) => `<div class="bl ${this.sel === b.id ? 'sel' : ''}" draggable="true" data-bl="${esc(b.id)}"><span class="h">⋮⋮</span>
        <span class="n">${esc((CAT[b.type] || {}).name || b.type)}<small>${esc(b.title || this.summary(b))}</small></span>
        <button data-mv="-1" title="Subir">↑</button><button data-mv="1" title="Bajar">↓</button>${K === 'tablet' ? '<button data-col="-1" title="Columna a la izquierda">←</button><button data-col="1" title="Columna a la derecha">→</button>' : ''}
        <button data-dup title="Duplicar">⧉</button><button data-del title="Borrar">✕</button></div>`;
      const B = this.blocks();
      let h = '<h4>Tarjetas</h4>';
      if (K === 'tablet') {
        [['Columna del plano', 0], ['Columna 1', 1], ['Columna 2', 2]].forEach(([t, c]) => { h += `<h4 style="margin-top:6px">${t}</h4><div class="colbox" data-colbox="${c}">${B.filter((b) => (b.col || 0) === c).map(row).join('') || '<span class="hint">Arrastrá tarjetas acá</span>'}</div>`; });
      } else h += `<div class="colbox" data-colbox="0">${B.map(row).join('') || '<span class="hint">Agregá tarjetas del catálogo</span>'}</div>`;
      h += `<h4>Agregar tarjeta</h4><div class="cat">${Object.entries(CAT).filter(([, c]) => c.kinds.includes(K)).map(([k, c]) => `<button data-add="${k}"><b>${esc(c.name)}</b><small>${esc(c.desc)}</small></button>`).join('')}</div>
        <p class="hint" style="margin-top:12px">Arrastrá las tarjetas con el mouse (o usá las flechas) para ordenarlas. Tocá una en la vista previa para editarla.</p>`;
      this.$('#edl').innerHTML = h;
    }
    summary(b) {
      const c = b.cfg || {};
      if (c.auto) return 'automático';
      if (c.entity) return this.fname(c.entity);
      if (c.items && c.items.length) return `${c.items.length} elementos`;
      if (c.rooms && c.rooms.length) return c.rooms.join(', ');
      if (c.entities && c.entities.length) return `${c.entities.length} elegidas`;
      return '';
    }
    drawPreview() {
      const K = this.v.kind || 'phone', ori = this.v.orientation || 'landscape';
      const fr = this.$('#frame');
      const size = K === 'phone' ? [390, 800] : ori === 'portrait' ? [760, 1180] : [1180, 760];
      const box = this.$('.ed-c').getBoundingClientRect();
      const scale = Math.min(1, (box.width - 48) / (size[0] + 20), (box.height - 48) / (size[1] + 20));
      fr.style.width = `${size[0]}px`; fr.style.height = `${size[1]}px`;
      fr.style.transform = `translateZ(0) scale(${scale > 0 ? scale : 1})`; fr.style.transformOrigin = 'top center';
      fr.innerHTML = '<div id="pv"></div>';
      if (this.vista) this.vista.destroy();
      this.vista = window.MaeVista.create(fr.querySelector('#pv'), {
        card: this.card, hass: () => this.p._hass || this.hass, base: () => '', toast: () => {}, openEntity() {}, openMenu() {},
        sign: async (path) => (await this.hass.callWS({ type: 'auth/sign_path', path, expires: 7200 })).path,
        kind: K, orientation: ori, edit: { selected: this.sel, onSelect: (id) => { this.sel = id; this.drawList(); this.drawProps(); this.vista.setCtx({ edit: { selected: id, onSelect: this.vista._onSel } }); this.bind(); } },
      });
      this.vista._onSel = (id) => { this.sel = id; this.drawList(); this.drawProps(); this.vista.setCtx({ edit: { selected: id, onSelect: this.vista._onSel } }); this.bind(); };
      this.vista.setView(this.v);
      if (!this.card) fr.querySelector('#pv').innerHTML = '<p style="padding:20px;color:#8f99ab">La vista previa necesita la tarjeta MatterAI (recargá la página).</p>';
    }

    /* ───────── propiedades ───────── */
    datalist(id, domains) {
      const ids = Object.keys(this.states()).filter((e) => !domains || domains.includes(e.split('.')[0])).sort();
      return `<datalist id="${id}">${ids.map((e) => `<option value="${esc(e)}">${esc(this.fname(e))}</option>`).join('')}</datalist>`;
    }
    ent(label, key, val, domains, path) {
      const dl = `dl-${key}-${(path || '').replace(/\W/g, '')}`;
      return `<label class="fld"><span>${esc(label)}</span><input list="${dl}" data-f="${esc(path || key)}" value="${esc(val || '')}" placeholder="Buscar equipo…">${this.datalist(dl, domains)}${val ? `<small class="hint">${esc(this.fname(val))}</small>` : ''}</label>`;
    }
    action(a, path, title) {
      a = a || { type: 'none' };
      const m = this.model(), rooms = m ? m.rooms.map((r) => r.name) : [];
      const SCR = window.MaeVista.SCREEN_NAMES;
      return `<div class="act"><label class="fld"><span>${esc(title)}</span><select data-f="${path}.type">${ACTION_TYPES.map(([k, l]) => `<option value="${k}" ${a.type === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        ${a.type === 'room' ? `<label class="fld"><span>Ambiente</span><select data-f="${path}.room">${rooms.map((r) => `<option ${a.room === r ? 'selected' : ''}>${esc(r)}</option>`).join('')}</select></label>` : ''}
        ${a.type === 'screen' ? `<label class="fld"><span>Pantalla</span><select data-f="${path}.screen">${Object.entries(SCR).map(([k, l]) => `<option value="${k}" ${a.screen === k ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>` : ''}
        ${a.type === 'more_info' || a.type === 'toggle' ? this.ent('Equipo (vacío: el del botón)', 'ae', a.entity, null, `${path}.entity`) : ''}
        ${a.type === 'service' ? `<label class="fld"><span>Servicio (dominio.servicio)</span><input data-f="${path}.service" value="${esc(a.service || '')}" placeholder="script.turn_on"></label>
          <label class="fld"><span>Datos (JSON)</span><textarea data-fj="${path}.data">${esc(a.data ? JSON.stringify(a.data, null, 1) : '')}</textarea></label>` : ''}
        ${a.type !== 'none' ? `<label class="chk"><input type="checkbox" data-fb="${path}.confirm" ${a.confirm ? 'checked' : ''}> Pedir confirmación</label>` : ''}</div>`;
    }
    items(b, opts) {
      const items = (b.cfg.items || []);
      const ICONS = window.MaeVista.ICONS;
      return `<h4>${esc(opts.title)}</h4>${items.map((it, i) => `<div class="it"><div class="row"><b>${esc(it.name || (it.kind ? (KPI_KINDS.find((k) => k[0] === it.kind) || [, it.kind])[1] : '') || this.fname(it.entity) || 'Elemento ' + (i + 1))}</b>
          <button class="eb sm" data-imv="${i}" data-d="-1">↑</button><button class="eb sm" data-imv="${i}" data-d="1">↓</button><button class="eb sm warn" data-idel="${i}">✕</button></div>
        ${opts.kpi ? `<label class="fld"><span>Qué muestra</span><select data-f="cfg.items.${i}.kind">${KPI_KINDS.map(([k, l]) => `<option value="${k}" ${it.kind === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>` : ''}
        ${!opts.kpi || it.kind === 'entity' ? this.ent('Equipo', 'it', it.entity, null, `cfg.items.${i}.entity`) : ''}
        <label class="fld"><span>Nombre (vacío: el del equipo)</span><input data-f="cfg.items.${i}.name" value="${esc(it.name || '')}"></label>
        <label class="fld"><span>Ícono</span><select data-f="cfg.items.${i}.icon"><option value="">Automático</option>${ICONS.map((n) => `<option ${it.icon === n ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
        ${this.action(it.tap, `cfg.items.${i}.tap`, 'Al tocar')}${opts.hold ? this.action(it.hold, `cfg.items.${i}.hold`, 'Al mantener apretado') : ''}</div>`).join('')}
        <button class="eb" data-iadd>+ Agregar</button>`;
    }
    multi(label, key, chosen, options) {
      const set = new Set(chosen || []);
      return `<h4>${esc(label)}</h4>${(chosen || []).map((x, i) => `<div class="ord"><span>${esc(options.find((o) => o[0] === x) ? options.find((o) => o[0] === x)[1] : x)}</span><button data-omv="${key}" data-i="${i}" data-d="-1">↑</button><button data-omv="${key}" data-i="${i}" data-d="1">↓</button></div>`).join('')}
        <div class="ml">${options.map(([v, l]) => `<label><input type="checkbox" data-mk="${key}" value="${esc(v)}" ${set.has(v) ? 'checked' : ''}> ${esc(l)}</label>`).join('')}</div>`;
    }
    drawProps() {
      const b = this.blocks().find((x) => x.id === this.sel);
      const r = this.$('#edr');
      if (!b) {
        r.innerHTML = `<h4>Dashboard</h4><label class="fld"><span>Nombre</span><input data-v="name" value="${esc(this.v.name)}"></label>
          <p class="hint">Tocá una tarjeta en la vista previa (o en la lista) para editarla. Los cambios se ven al instante acá; al guardar, les llegan a los equipos con este dashboard, sin actualizar la app.</p>`;
        return;
      }
      b.cfg = b.cfg || {};
      const c = b.cfg, CAT = window.MaeVista.CATALOG, m = this.model();
      const S = this.states(), opts = (doms) => Object.keys(S).filter((e) => doms.includes(e.split('.')[0])).sort().map((e) => [e, this.fname(e)]);
      let h = `<h4>${esc((CAT[b.type] || {}).name || b.type)}</h4><label class="fld"><span>Título (vacío: sin título)</span><input data-f="title" value="${esc(b.title || '')}"></label>`;
      const autoChk = (txt) => `<label class="chk"><input type="checkbox" data-fb="cfg.auto" ${c.auto ? 'checked' : ''}> ${txt}</label>`;
      switch (b.type) {
        case 'kpis': h += autoChk('Automático (lo elige la app según la casa)') + (c.auto ? '' : this.items(b, { title: 'Datos', kpi: true, hold: false })); break;
        case 'featured': case 'camera':
          h += this.ent('Cámara', 'cam', c.entity, PICK.camera, 'cfg.entity') + this.ent('Botón grande (portón, puerta)', 'gate', c.gate, PICK.gate, 'cfg.gate');
          if (b.type === 'camera') h += this.items(b, { title: 'Botones extra', hold: true });
          break;
        case 'rooms':
          h += `<label class="fld"><span>Cómo se ve</span><select data-f="cfg.style"><option value="list" ${c.style !== 'grid' ? 'selected' : ''}>Lista</option><option value="grid" ${c.style === 'grid' ? 'selected' : ''}>Grilla</option></select></label>`;
          h += this.multi('Ambientes (en este orden)', 'rooms', c.rooms, (m ? m.rooms : []).map((x) => [x.name, x.name]));
          h += '<p class="hint">Cada persona también puede fijar o sacar ambientes desde su celular (mantener apretado).</p>';
          break;
        case 'scenes': h += autoChk('Todas las escenas de la casa') + (c.auto ? '' : this.multi('Escenas (en este orden)', 'entities', c.entities, opts(PICK.scenes))); break;
        case 'routines': h += autoChk('Las primeras automatizaciones') + (c.auto ? '' : this.multi('Automatizaciones', 'entities', c.entities, opts(PICK.routines))); break;
        case 'buttons':
          h += `<label class="fld"><span>Cómo se ve</span><select data-f="cfg.style"><option value="grid" ${c.style !== 'list' ? 'selected' : ''}>Grilla</option><option value="list" ${c.style === 'list' ? 'selected' : ''}>Lista</option></select></label>`;
          h += this.items(b, { title: 'Botones', hold: true }); break;
        case 'alarm': h += this.ent('Alarma (vacío: la de la casa)', 'al', c.entity, PICK.alarm, 'cfg.entity'); break;
        case 'away': h += this.ent('Interruptor, escena o script', 'aw', c.entity, PICK.away, 'cfg.entity'); break;
        case 'lock': h += this.ent('Cerradura', 'lk', c.entity, PICK.lock, 'cfg.entity'); break;
        case 'plan': h += '<p class="hint">El plano se arma en «Plano e imágenes» (arriba): subís el render y dibujás los ambientes.</p><button class="eb" data-e="plan">Editar el plano</button>'; break;
        default: h += '<p class="hint">Esta tarjeta no tiene opciones.</p>';
      }
      if ((this.v.kind || 'phone') === 'tablet') h += `<label class="fld"><span>Columna</span><select data-f="col">${[[0, 'Del plano'], [1, 'Columna 1'], [2, 'Columna 2']].map(([k, l]) => `<option value="${k}" ${(b.col || 0) === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>`;
      r.innerHTML = h;
    }

    /* ───────── edición ───────── */
    setPath(obj, path, val) {
      const ks = path.split('.'); let o = obj;
      for (let i = 0; i < ks.length - 1; i++) { const k = /^\d+$/.test(ks[i]) ? +ks[i] : ks[i]; if (o[k] == null) o[k] = /^\d+$/.test(ks[i + 1]) ? [] : {}; o = o[k]; }
      const last = ks[ks.length - 1];
      if (val === '' || val == null) delete o[last]; else o[last] = val;
    }
    selBlock() { return this.blocks().find((x) => x.id === this.sel); }
    bind() {
      const W = this.wrap;
      W.querySelectorAll('[data-e]').forEach((x) => { x.onclick = () => this.cmd(x.dataset.e); });
      W.querySelectorAll('[data-kind]').forEach((x) => { x.onclick = () => this.change(() => { this.v.kind = x.dataset.kind; if (!confirm('¿Rearmar las tarjetas para este tipo de equipo? (Cancelar deja las tarjetas como están)')) return; this.prearmado(true); }); });
      W.querySelectorAll('[data-ori]').forEach((x) => { x.onclick = () => this.change(() => { this.v.orientation = x.dataset.ori; }); });
      W.querySelectorAll('[data-add]').forEach((x) => { x.onclick = () => this.change(() => {
        const K = this.v.kind || 'phone', id = `${x.dataset.add}-${window.MaeVista.uid()}`.slice(0, 24);
        const cfg = { kpis: { auto: true }, scenes: { auto: true }, routines: { auto: true }, buttons: { items: [] }, rooms: { rooms: [] } }[x.dataset.add] || {};
        this.blocks().push({ id, type: x.dataset.add, col: K === 'tablet' ? (x.dataset.add === 'plan' ? 0 : 1) : 0, title: window.MaeVista.CATALOG[x.dataset.add].name, cfg });
        this.sel = id;
      }); });
      // lista: flechas, duplicar, borrar, elegir
      W.querySelectorAll('[data-bl]').forEach((row) => {
        const id = row.dataset.bl;
        row.onclick = (e) => {
          const B = this.blocks(), i = B.findIndex((b) => b.id === id); if (i < 0) return;
          if (e.target.closest('[data-mv]')) { const d = +e.target.closest('[data-mv]').dataset.mv; return this.change(() => this.move(id, d)); }
          if (e.target.closest('[data-col]')) { const d = +e.target.closest('[data-col]').dataset.col; return this.change(() => { B[i].col = Math.max(0, Math.min(2, (B[i].col || 0) + d)); }); }
          if (e.target.closest('[data-dup]')) return this.change(() => { const nb = clone(B[i]); nb.id = `${nb.type}-${window.MaeVista.uid()}`.slice(0, 24); B.splice(i + 1, 0, nb); this.sel = nb.id; });
          if (e.target.closest('[data-del]')) return this.change(() => { B.splice(i, 1); if (this.sel === id) this.sel = null; });
          this.sel = id; this.draw();
        };
        // arrastrar con el mouse
        row.addEventListener('dragstart', (e) => { this.dragId = id; row.classList.add('drag'); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', id); } catch (_) { /* navegador viejo */ } });
        row.addEventListener('dragend', () => { row.classList.remove('drag'); W.querySelectorAll('.over').forEach((o) => o.classList.remove('over')); });
        row.addEventListener('dragover', (e) => { e.preventDefault(); row.classList.add('over'); });
        row.addEventListener('dragleave', () => row.classList.remove('over'));
        row.addEventListener('drop', (e) => { e.preventDefault(); e.stopPropagation(); const from = this.dragId; this.dragId = null; if (from && from !== id) this.change(() => this.dropBefore(from, id)); });
      });
      W.querySelectorAll('[data-colbox]').forEach((box) => {
        box.addEventListener('dragover', (e) => { e.preventDefault(); box.classList.add('over'); });
        box.addEventListener('dragleave', () => box.classList.remove('over'));
        box.addEventListener('drop', (e) => { e.preventDefault(); const from = this.dragId; this.dragId = null; if (!from) return; this.change(() => { const B = this.blocks(), i = B.findIndex((b) => b.id === from); const [b] = B.splice(i, 1); b.col = +box.dataset.colbox; B.push(b); }); });
      });
      // propiedades
      const b = this.selBlock();
      W.querySelectorAll('#edr [data-f]').forEach((x) => {
        x.onchange = () => {
          const path = x.dataset.f;
          let val = x.value;
          if (path === 'col') val = +val;
          if (/\.entity$/.test(path) || path === 'cfg.entity' || path === 'cfg.gate') { val = val.trim(); if (val && !this.states()[val]) { this.toast('Ese equipo no existe en la casa'); return; } }
          this.change(() => this.setPath(b, path, val));
        };
      });
      W.querySelectorAll('#edr [data-fb]').forEach((x) => { x.onchange = () => this.change(() => this.setPath(b, x.dataset.fb, x.checked)); });
      W.querySelectorAll('#edr [data-fj]').forEach((x) => { x.onchange = () => { let val = null; try { val = x.value.trim() ? JSON.parse(x.value) : null; } catch (_) { this.toast('Los datos tienen que ser JSON, por ejemplo {"entity_id": "script.riego"}'); return; } this.change(() => this.setPath(b, x.dataset.fj, val)); }; });
      W.querySelectorAll('#edr [data-v]').forEach((x) => { x.onchange = () => this.change(() => { this.v[x.dataset.v] = x.value; }); });
      W.querySelectorAll('#edr [data-iadd]').forEach((x) => { x.onclick = () => this.change(() => { b.cfg.items = b.cfg.items || []; b.cfg.items.push(b.type === 'kpis' ? { kind: 'lights' } : { tap: { type: 'toggle' } }); }); });
      W.querySelectorAll('#edr [data-idel]').forEach((x) => { x.onclick = () => this.change(() => b.cfg.items.splice(+x.dataset.idel, 1)); });
      W.querySelectorAll('#edr [data-imv]').forEach((x) => { x.onclick = () => this.change(() => { const i = +x.dataset.imv, j = i + +x.dataset.d, L = b.cfg.items; if (j < 0 || j >= L.length) return; [L[i], L[j]] = [L[j], L[i]]; }); });
      W.querySelectorAll('#edr [data-mk]').forEach((x) => { x.onchange = () => this.change(() => { const k = x.dataset.mk, L = (b.cfg[k] = b.cfg[k] || []); if (x.checked) { if (!L.includes(x.value)) L.push(x.value); } else b.cfg[k] = L.filter((y) => y !== x.value); }); });
      W.querySelectorAll('#edr [data-omv]').forEach((x) => { x.onclick = () => this.change(() => { const L = b.cfg[x.dataset.omv], i = +x.dataset.i, j = i + +x.dataset.d; if (j < 0 || j >= L.length) return; [L[i], L[j]] = [L[j], L[i]]; }); });
    }
    move(id, d) {
      const B = this.blocks(), i = B.findIndex((b) => b.id === id), col = B[i].col || 0;
      // el vecino de la misma columna
      let j = i + d;
      while (j >= 0 && j < B.length && (B[j].col || 0) !== col && (this.v.kind || 'phone') === 'tablet') j += d;
      if (j < 0 || j >= B.length) return;
      [B[i], B[j]] = [B[j], B[i]];
    }
    dropBefore(from, to) {
      const B = this.blocks(), i = B.findIndex((b) => b.id === from); const [b] = B.splice(i, 1);
      const j = B.findIndex((x) => x.id === to); b.col = B[j].col || 0; B.splice(j, 0, b);
    }
    async cmd(k) {
      if (k === 'close') return this.close();
      if (k === 'undo' && this.undo.length) { this.v = JSON.parse(this.undo.pop()); this.draw(); return; }
      if (k === 'pre') { if (confirm('¿Reemplazar las tarjetas por el prearmado con los equipos de esta casa?')) this.prearmado(false); return; }
      if (k === 'reset') { this.push(); this.v = clone(this.saved); this.draw(); return; }
      if (k === 'plan') return this.planEditor();
      if (k === 'save') {
        const v = this.v;
        const out = { id: v.id, name: v.name, kind: v.kind || 'phone', orientation: v.orientation || null, blocks: v.blocks || [], plan: v.plan || null, pinned: v.pinned || [], featured: v.featured || {}, scenes: v.scenes || null };
        try {
          const res = await this.hass.callWS({ type: 'matterai/views/save', view: out });
          this.saved = clone(res); this.v = clone(res); this.undo = []; this.draw();
          this.toast('Guardado: los equipos con este dashboard lo ven al instante');
        } catch (e) { this.toast(`No se pudo guardar: ${e.message || e}`); }
      }
    }
    close() {
      if (this.dirty() && !confirm('Hay cambios sin guardar. ¿Salir igual?')) return;
      window.removeEventListener('keydown', this.keyH);
      if (this.vista) this.vista.destroy();
      this.wrap.remove();
      if (this.p._renderViews) this.p._renderViews();
    }

    /* ───────── plano: imágenes y ambientes dibujados ───────── */
    async upload(file) {
      const fd = new FormData(); fd.append('file', file, file.name);
      const r = await this.hass.fetchWithAuth('/api/matterai/media', { method: 'POST', body: fd });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.path) throw new Error(j.msg || `HTTP ${r.status}`);
      return j.path;
    }
    async signed(path) {
      if (!path) return '';
      if (!path.startsWith('/api/matterai/media/')) return path;
      return (await this.hass.callWS({ type: 'auth/sign_path', path, expires: 7200 })).path;
    }
    async planEditor() {
      this.v.plan = this.v.plan || { zones: [] };
      this.pe = document.createElement('div');
      this.pe.className = 'pe';
      this.wrap.appendChild(this.pe);
      this.zsel = null; this.drawing = null;
      await this.drawPlan();
    }
    async drawPlan() {
      const P = this.v.plan, m = this.model(), rooms = m ? m.rooms.map((r) => r.name) : [];
      const src = await this.signed(P.image);
      const slot = async (k, t) => `<div class="slot">${P[k] ? `<img src="${esc(await this.signed(P[k]))}" alt="">` : '<img alt="">'}<span><b>${t}</b><br><small class="hint">${P[k] ? 'Cargada' : 'Sin imagen'}</small></span>
        <label class="eb sm">Subir<input type="file" accept="image/jpeg,image/png,image/webp" data-up="${k}" hidden></label>${P[k] ? `<button class="eb sm warn" data-rmimg="${k}">✕</button>` : ''}</div>`;
      const Z = P.zones || (P.zones = []);
      const z = this.zsel != null ? Z[this.zsel] : null;
      const lights = Object.keys(this.states()).filter((e) => /^(light|switch)\./.test(e)).sort();
      this.pe.innerHTML = `<div class="pe-c">${src ? `<div class="pe-img"><img id="peimg" src="${esc(src)}" alt="" draggable="false"><svg id="pesvg" viewBox="0 0 1000 1000" preserveAspectRatio="none"></svg></div>` : '<p class="hint">Subí primero la imagen apagada (o de noche) del render.</p>'}</div>
        <div class="pe-r"><div class="row" style="display:flex;gap:8px;align-items:center"><h3 style="margin:0;flex:1">Plano</h3><button class="eb pri" data-pe="done">Listo</button></div>
          <h4>Imágenes</h4>${await slot('image', 'Apagado / de noche')}${await slot('image_on', 'Con las luces prendidas')}${await slot('image_day', 'De día (opcional)')}
          <p class="hint">Mismo tamaño y encuadre en las tres. JPG, PNG o WebP, hasta 12 MB. Quedan guardadas en la casa, privadas.</p>
          <h4>Ambientes en el plano</h4>
          ${Z.map((q, i) => `<div class="zl ${i === this.zsel ? 'sel' : ''}" data-zsel="${i}"><b>${esc(q.name)}</b> <small class="hint">${q.lights.length} luces${q.room ? ' · ' + esc(q.room) : ''}</small></div>`).join('') || '<p class="hint">Todavía no dibujaste ningún ambiente.</p>'}
          <button class="eb" data-pe="new" ${src ? '' : 'disabled'}>${this.drawing ? 'Dibujando… tocá los vértices y «Terminar»' : '+ Dibujar un ambiente'}</button>
          ${this.drawing ? '<button class="eb pri" data-pe="finish">Terminar</button> <button class="eb" data-pe="cancel">Cancelar</button>' : ''}
          ${z ? `<h4>«${esc(z.name)}»</h4><label class="fld"><span>Nombre</span><input data-z="name" value="${esc(z.name)}"></label>
            <label class="fld"><span>Ambiente que abre al mantener</span><select data-z="room"><option value="">—</option>${rooms.map((r) => `<option ${z.room === r ? 'selected' : ''}>${esc(r)}</option>`).join('')}</select></label>
            <h4>Luces que lo iluminan</h4><div class="ml">${lights.map((e) => `<label><input type="checkbox" data-zl="${esc(e)}" ${z.lights.includes(e) ? 'checked' : ''}> ${esc(this.fname(e))}</label>`).join('')}</div>
            <p class="hint">Arrastrá los puntos para ajustar la forma.</p><button class="eb warn" data-pe="zdel">Borrar este ambiente</button>` : ''}</div>`;
      this.bindPlan();
    }
    bindPlan() {
      const pe = this.pe, P = this.v.plan;
      const img = pe.querySelector('#peimg'), svg = pe.querySelector('#pesvg');
      const ptsOf = (poly) => poly.map(([x, y]) => `${x * 1000},${y * 1000}`).join(' ');
      const paint = () => {
        if (!svg) return;
        svg.innerHTML = (P.zones || []).map((q, i) => `<polygon points="${ptsOf(q.poly)}" fill="${i === this.zsel ? 'rgba(242,183,102,.28)' : 'rgba(124,196,240,.16)'}" stroke="${i === this.zsel ? '#f2b766' : '#7cc4f0'}" stroke-width="3" vector-effect="non-scaling-stroke" data-zp="${i}"/>`).join('')
          + (this.zsel != null && P.zones[this.zsel] ? P.zones[this.zsel].poly.map(([x, y], j) => `<circle cx="${x * 1000}" cy="${y * 1000}" r="9" fill="#f2b766" data-vx="${j}" style="cursor:move"/>`).join('') : '')
          + (this.drawing ? `<polyline points="${ptsOf(this.drawing)}" fill="rgba(242,183,102,.15)" stroke="#f2b766" stroke-width="3" vector-effect="non-scaling-stroke"/>${this.drawing.map(([x, y]) => `<circle cx="${x * 1000}" cy="${y * 1000}" r="7" fill="#f2b766"/>`).join('')}` : '');
      };
      if (img) img.onload = () => { if (img.naturalWidth && img.naturalHeight) P.aspect = Math.round((img.naturalWidth / img.naturalHeight) * 1000) / 1000; };
      const norm = (e) => { const r = svg.getBoundingClientRect(); return [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))].map((v) => Math.round(v * 10000) / 10000); };
      if (svg) {
        svg.onpointerdown = (e) => {
          const vx = e.target.closest('[data-vx]');
          if (vx && this.zsel != null) { this.dragVx = +vx.dataset.vx; svg.setPointerCapture(e.pointerId); return; }
          if (this.drawing) { this.drawing.push(norm(e)); paint(); return; }
          const zp = e.target.closest('[data-zp]'); if (zp) { this.zsel = +zp.dataset.zp; this.drawPlan(); }
        };
        svg.onpointermove = (e) => { if (this.dragVx == null) return; P.zones[this.zsel].poly[this.dragVx] = norm(e); paint(); };
        svg.onpointerup = () => { if (this.dragVx != null) { this.dragVx = null; this.drawPreview(); } };
      }
      paint();
      pe.querySelectorAll('[data-up]').forEach((x) => { x.onchange = async () => {
        const f = x.files[0]; if (!f) return;
        this.toast('Subiendo…');
        try { const p = await this.upload(f); this.push(); P[x.dataset.up] = p; this.toast('Imagen subida'); await this.drawPlan(); this.drawPreview(); } catch (e) { this.toast(`No se pudo subir: ${e.message || e}`); }
      }; });
      pe.querySelectorAll('[data-rmimg]').forEach((x) => { x.onclick = async () => { this.push(); delete P[x.dataset.rmimg]; await this.drawPlan(); this.drawPreview(); }; });
      pe.querySelectorAll('[data-zsel]').forEach((x) => { x.onclick = () => { this.zsel = +x.dataset.zsel; this.drawPlan(); }; });
      pe.querySelectorAll('[data-pe]').forEach((x) => { x.onclick = async () => {
        const k = x.dataset.pe;
        if (k === 'done') { this.pe.remove(); this.pe = null; this.draw(); return; }
        if (k === 'new') { this.drawing = []; this.zsel = null; await this.drawPlan(); return; }
        if (k === 'cancel') { this.drawing = null; await this.drawPlan(); return; }
        if (k === 'finish') {
          if (!this.drawing || this.drawing.length < 3) { this.toast('Marcá al menos 3 puntos'); return; }
          const name = prompt('Nombre del ambiente', `Ambiente ${(P.zones || []).length + 1}`) || `Ambiente ${(P.zones || []).length + 1}`;
          this.push(); P.zones.push({ name: name.slice(0, 40), room: null, lights: [], poly: this.drawing }); this.zsel = P.zones.length - 1; this.drawing = null;
          await this.drawPlan(); this.drawPreview(); return;
        }
        if (k === 'zdel' && this.zsel != null) { this.push(); P.zones.splice(this.zsel, 1); this.zsel = null; await this.drawPlan(); this.drawPreview(); }
      }; });
      pe.querySelectorAll('[data-z]').forEach((x) => { x.onchange = async () => { this.push(); const z = P.zones[this.zsel]; z[x.dataset.z] = x.value || null; if (x.dataset.z === 'name') z.name = x.value || 'Ambiente'; await this.drawPlan(); this.drawPreview(); }; });
      pe.querySelectorAll('[data-zl]').forEach((x) => { x.onchange = () => { this.push(); const z = P.zones[this.zsel]; if (x.checked) z.lights.push(x.dataset.zl); else z.lights = z.lights.filter((y) => y !== x.dataset.zl); this.drawPreview(); }; });
    }
  }

  window.MaeEditor = { open, _Editor: Editor };
})();
