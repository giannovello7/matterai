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
  const DOM_NAME = { light: 'Luz', switch: 'Interruptor', cover: 'Cortina / portón', lock: 'Cerradura', camera: 'Cámara', climate: 'Aire', fan: 'Ventilador', media_player: 'Parlante / TV',
    sensor: 'Sensor', binary_sensor: 'Sensor', scene: 'Escena', script: 'Script', automation: 'Automatización', input_boolean: 'Interruptor virtual', button: 'Botón', input_button: 'Botón',
    alarm_control_panel: 'Alarma', vacuum: 'Aspiradora', water_heater: 'Termotanque', person: 'Persona', weather: 'Clima', number: 'Número', select: 'Opción', siren: 'Sirena', valve: 'Válvula', humidifier: 'Humidificador' };
  // lo que puede ir adentro de un ambiente (como en la tarjeta)
  const ROOM_DOMAINS = ['light', 'switch', 'cover', 'climate', 'fan', 'media_player', 'lock', 'camera', 'sensor', 'binary_sensor', 'scene', 'script', 'button', 'input_button', 'input_boolean', 'vacuum', 'valve', 'water_heater', 'humidifier', 'siren'];
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
  .fwrap{position:relative;flex:none}
  .frame{position:absolute;left:0;top:0;transform-origin:0 0;border:10px solid #050608;border-radius:34px;background:#161b21;box-shadow:0 30px 80px rgba(0,0,0,.6);overflow:hidden}
  .frame iframe{display:block;border:0;width:100%;height:100%;background:#161b21;border-radius:24px}
  .pick{display:flex;flex-direction:column;gap:4px}
  .pick input{padding:6px 10px!important;font-size:12.5px!important}
  .pick select{width:100%}
  :host{all:initial}
  .cbv{display:flex;align-items:center;gap:8px;width:100%;padding:8px 10px;border-radius:10px;border:1px solid rgba(160,175,200,.2);background:#0d1116;color:#e9ecf2;text-align:left;min-height:40px}
  .cbv:hover{border-color:#f2b766}.cbv b{font-weight:600;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.cbv small{color:#8f99ab;font-size:11px}
  .cbv .ph{color:#8f99ab;flex:1}
  .dtag{flex:none;padding:2px 7px;border-radius:6px;background:#262e3a;color:#8f99ab;font-size:10.5px;font-weight:700;letter-spacing:.03em}
  .cbp{position:fixed;z-index:80;width:360px;max-height:420px;display:flex;flex-direction:column;background:#161b21;border:1px solid rgba(160,175,200,.25);border-radius:14px;box-shadow:0 20px 60px rgba(0,0,0,.6);overflow:hidden}
  .cbp input{margin:10px;padding:10px 12px;border-radius:10px;border:1px solid #f2b766;background:#0d1116;color:#e9ecf2;font:inherit;outline:0}
  .cbp .cbl{overflow:auto;padding:0 6px 8px}
  .cbo{display:flex;align-items:center;gap:10px;width:100%;padding:8px 8px;border:0;border-radius:10px;background:none;color:#e9ecf2;text-align:left}
  .cbo.on,.cbo:hover{background:#262e3a}.cbo .tx{flex:1;min-width:0}.cbo b{display:block;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .cbo small{display:block;color:#8f99ab;font-size:11.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.cbo .st{color:#8f99ab;font-size:11.5px;flex:none}
  .cbp .none{padding:14px;color:#8f99ab;font-size:13px}
  .rme{display:flex;align-items:center;gap:6px;padding:7px 8px;border-radius:10px;background:#1e242e;margin-bottom:5px}.rme .tx{flex:1;min-width:0}
  .rme b{display:block;font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.rme small{color:#8f99ab;font-size:11px}
  .rme button{border:0;background:none;color:#8f99ab;padding:3px 5px;border-radius:6px}.rme button:hover{background:#262e3a;color:#e9ecf2}
  .rlist{display:flex;flex-direction:column;gap:5px;margin-bottom:10px}.rlist .eb{text-align:left;display:flex;justify-content:space-between;align-items:center}
  .warnbox{padding:10px;border-radius:10px;background:rgba(242,183,102,.1);border:1px solid rgba(242,183,102,.35);font-size:12.5px;color:#e9ecf2;margin-bottom:10px}
  .fld{display:flex;flex-direction:column;gap:4px;margin-bottom:10px}.fld>span{font-size:12px;color:#8f99ab}
  .fld input,.fld select,.fld textarea{width:100%;padding:8px 10px;border-radius:10px;border:1px solid rgba(160,175,200,.2);background:#0d1116;color:#e9ecf2;font:inherit}
  .fld textarea{min-height:60px;font-family:"Red Hat Mono",monospace;font-size:12px}
  .chk{display:flex;align-items:center;gap:8px;margin-bottom:10px}
  .it{display:block;padding:10px;border-radius:12px;background:#1e242e;border:1px solid rgba(160,175,200,.15);margin-bottom:8px}
  .ed-r .fld,.ed-r .act,.ed-r .it>*{max-width:100%}
  .it .row{display:flex;gap:6px;align-items:center;margin-bottom:6px}.it .row b{flex:1}
  .act{display:block;padding:8px;border-radius:10px;background:#161b21;margin-top:4px}
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
  .eseg.sim{align-items:center}.eseg.sim .lbl{padding:0 6px 0 8px;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#8f99ab}
  .eseg.sim button.on{background:#f2b766;color:#1b1408}
  .mbody{overflow:auto;padding:12px 16px 16px}
  .hlist{display:flex;flex-direction:column;gap:6px}.hrow{display:flex;align-items:center;gap:8px;padding:10px 12px;border-radius:12px;background:#1e242e}
  .hrow>span{flex:1;min-width:0}.hrow b{display:block}.hrow small{color:#8f99ab;font-size:12px}
  .ed-top h2 .dirt{font-size:11.5px;font-weight:600;color:#f2b766;margin-left:6px;vertical-align:middle}
  .eb:disabled{opacity:.4;cursor:default}.eb.ico{padding:7px 11px;font-size:16px;line-height:1}
  .eb.pri2{border-color:rgba(242,183,102,.5);color:#f2b766;font-weight:700}
  .emenu{position:relative}.emenu-l{position:absolute;right:0;top:calc(100% + 6px);z-index:30;min-width:240px;display:flex;flex-direction:column;padding:6px;border-radius:12px;background:#1e242e;border:1px solid rgba(160,175,200,.25);box-shadow:0 16px 40px rgba(0,0,0,.5)}
  .emenu-l button{border:0;background:none;text-align:left;padding:9px 10px;border-radius:8px}.emenu-l button:hover{background:#262e3a}.emenu-l button:disabled{opacity:.4}
  .catp{position:fixed;inset:0;z-index:75;background:rgba(5,7,10,.7);display:flex;align-items:flex-start;justify-content:center;padding:8vh 20px 20px}
  .catin{width:min(720px,100%);max-height:80vh;display:flex;flex-direction:column;background:#161b21;border:1px solid rgba(160,175,200,.25);border-radius:18px;box-shadow:0 30px 80px rgba(0,0,0,.6);overflow:hidden}
  .cath{display:flex;align-items:center;justify-content:space-between;padding:14px 16px 0}.cath b{font-size:16px}
  .catin input{margin:12px 16px;padding:10px 12px;border-radius:10px;border:1px solid #f2b766;background:#0d1116;color:#e9ecf2;font:inherit;outline:0}
  .catg{overflow:auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:8px;padding:0 16px 16px}
  .catg button{display:flex;gap:10px;align-items:flex-start;padding:12px;border-radius:14px;background:#1e242e;border:1px solid rgba(160,175,200,.15);text-align:left}
  .catg button:hover{border-color:#f2b766}.catg b{display:block;font-weight:600}.catg small{color:#8f99ab;font-size:12px}
  .cic{flex:none;width:36px;height:36px;border-radius:10px;display:grid;place-items:center;background:#262e3a}.cic svg{width:20px;height:20px;fill:none;stroke:#f2b766;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
  @media (max-width:1100px){.ed{grid-template-columns:240px 1fr 300px}}`;

  function open(panel, viewId) { return new Editor(panel, viewId).start(); }

  class Editor {
    constructor(panel, viewId) { this.p = panel; this.hass = panel._hass; this.viewId = viewId; this.sel = null; this.undo = []; this.redo = []; }

    async start() {
      await loadScript(`${BASE}/vista.js?t=${Date.now()}`);
      this.ver = Date.now();
      const [lst, cfg] = await Promise.all([this.hass.callWS({ type: 'matterai/views/list' }), this.hass.callWS({ type: 'matterai/config' })]);
      const v = lst.views.find((x) => x.id === this.viewId);
      if (!v) { this.p._toast('Ese dashboard no existe'); return; }
      this.cfg = cfg.config || {};
      this.v = Editor.normalize(clone(v));
      this.K = v.kind || 'phone';
      this.saved = clone(this.v);
      // la tarjeta MatterAI sin dibujarse: da el modelo de la casa (ambientes, luces, cámaras…)
      const Card = customElements.get('matterai-home-card');
      this.card = Card ? document.createElement('matterai-home-card') : null;
      if (this.card) { this.card.setAttribute('headless', ''); this.card.setConfig(Object.assign({}, this.cfg)); this.card.hass = this.hass; }
      // estructura: en su propio shadow root, así los estilos del panel no lo desacomodan
      const root = this.p.shadowRoot;
      this.host = document.createElement('div');
      root.appendChild(this.host);
      this.wrap = this.host.attachShadow({ mode: 'open' });
      this.wrap.innerHTML = `<style>${CSS}</style><div class="ed" id="ed"><div class="ed-top" id="edt"></div><div class="ed-l" id="edl"></div>
        <div class="ed-c" id="edc"><div class="fwrap" id="fwrap"><div class="frame" id="frame"></div></div></div><div class="ed-r" id="edr"></div></div><div class="toastE" id="toastE"></div>`;
      this.$ = (s) => this.wrap.querySelector(s);
      // el prearmado necesita el modelo de la casa (ambientes, cámaras, ausente, rutinas): igual que en la app
      for (let i = 0; i < 40 && !(this.model() && this.model().rooms && this.model().rooms.length); i++) await new Promise((res) => setTimeout(res, 100));
      if (!this.blocks().length) this.prearmado(true);
      this.draw();
      this.resH = () => this.sizeFrame();
      window.addEventListener('resize', this.resH);
      this.keyH = (e) => this.onKey(e);
      window.addEventListener('keydown', this.keyH);
      this.unloadH = (e) => { if (this.dirty()) { e.preventDefault(); e.returnValue = ''; } };
      window.addEventListener('beforeunload', this.unloadH);
      // la vista previa sigue el estado de la casa en vivo (luces, portón, música…)
      this.liveT = setInterval(() => {
        const h = this.p._hass;
        if (!h || h === this.hass) return;
        this.hass = h;
        if (this.card) this.card.hass = h;
        if (this.vista) this.vista.render();
      }, 1500);
      return this;
    }
    /** Atajos: Ctrl+Z / Ctrl+Y (o Ctrl+Shift+Z), Ctrl+S, Ctrl+D duplicar, Supr borrar, flechas mover, Esc. */
    onKey(e) {
      const path = e.composedPath ? e.composedPath() : [];
      const typing = path.some((x) => x && /^(INPUT|TEXTAREA|SELECT)$/.test(x.tagName || '') && x.type !== 'checkbox');
      const mod = e.ctrlKey || e.metaKey, k = (e.key || '').toLowerCase();
      if (e.key === 'Escape') {
        if (this.cb) return this.closeCB();
        if (this.catBox) return this.closeCatalog();
        if (this.pe) return this.closePlan();
        if (typing) return undefined;
        if (this.sel) return this.pick(null);
        return this.close();
      }
      if (mod && k === 's') { e.preventDefault(); if (this.dirty()) this.cmd('save'); return undefined; }
      if (typing || this.pe) return undefined;
      if (mod && k === 'z' && !e.shiftKey) { e.preventDefault(); return this.cmd('undo'); }
      if (mod && (k === 'y' || (k === 'z' && e.shiftKey))) { e.preventDefault(); return this.cmd('redo'); }
      if (!this.sel) return undefined;
      if (mod && k === 'd') { e.preventDefault(); return this.blockAct(this.sel, 'dup'); }
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); return this.blockAct(this.sel, 'del'); }
      if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) { e.preventDefault(); return this.blockAct(this.sel, e.key === 'ArrowUp' ? 'up' : 'down'); }
      return undefined;
    }
    /** Lo que se hace con una tarjeta (desde la lista, la barra de la vista previa o el teclado). */
    blockAct(id, act) {
      const B = this.blocks(), i = B.findIndex((b) => b.id === id); if (i < 0) return;
      if (act === 'up' || act === 'down') return this.change(() => this.move(id, act === 'up' ? -1 : 1));
      if (act === 'left' || act === 'right') return this.change(() => { B[i].col = Math.max(0, Math.min(2, (B[i].col || 0) + (act === 'left' ? -1 : 1))); });
      if (act === 'dup') return this.change(() => { const nb = clone(B[i]); nb.id = this.newId(nb.type); B.splice(i + 1, 0, nb); this.sel = nb.id; });
      if (act === 'del') {
        const name = (window.MaeVista.CATALOG[B[i].type] || {}).name || B[i].type;
        this.change(() => { B.splice(i, 1); if (this.sel === id) { this.sel = null; this.roomEd = null; this.rdraft = null; } });
        this.toast(`Tarjeta «${name}» borrada · Ctrl+Z para deshacer`);
      }
      return undefined;
    }
    newId(type) { return `${type}-${window.MaeVista.uid()}`.slice(0, 24); }
    /** Arrastrar dentro de la vista previa: antes / después de otra tarjeta, o al final de una columna. */
    moveTo(from, where) {
      this.change(() => {
        const B = this.blocks(), i = B.findIndex((b) => b.id === from); if (i < 0) return;
        const [b] = B.splice(i, 1);
        if (where.target) {
          const j = B.findIndex((x) => x.id === where.target);
          if (j < 0) { B.splice(i, 0, b); return; }
          b.col = B[j].col || 0;
          B.splice(j + (where.after ? 1 : 0), 0, b);
        } else { b.col = this.K === 'tablet' ? where.col || 0 : 0; B.push(b); }
        this.sel = b.id;
      });
    }
    /** Tarjetas nuevas: con valores que ya muestran algo (no una tarjeta vacía). */
    addBlock(type, col) {
      const K = this.K, CAT = window.MaeVista.CATALOG;
      const cfg = { kpis: { auto: true }, scenes: { auto: true }, routines: { auto: true }, buttons: { items: [] }, rooms: { rooms: [] }, text: { style: 'separator' } }[type] || {};
      const titled = ['rooms', 'scenes', 'routines', 'buttons', 'camera', 'music', 'lock', 'away', 'covers', 'lights', 'people', 'text'];
      const b = { id: this.newId(type), type, col: K === 'tablet' ? (col != null ? col : type === 'plan' ? 0 : 1) : 0, cfg };
      if (titled.includes(type)) b.title = CAT[type].name;
      this.change(() => { this.blocks().push(b); this.sel = b.id; this.roomEd = null; this.rdraft = null; });
    }
    /** Catálogo de tarjetas (como «Agregar tarjeta» de Home Assistant), con buscador. */
    openCatalog(col) {
      this.closeCatalog();
      const CAT = window.MaeVista.CATALOG, K = this.K, ICO = { kpis: 'grid', featured: 'cam', rooms: 'home', scenes: 'spark', buttons: 'power', camera: 'cam', alarm: 'shield', away: 'car', routines: 'robot', music: 'music', lock: 'lock', plan: 'home', clock: 'sun',
        weather: 'cloud', climate: 'snow', covers: 'curt', lights: 'bulb', energy: 'bolt', sensor: 'temp', people: 'user', text: 'list', image: 'film' };
      const box = document.createElement('div');
      box.className = 'catp';
      box.innerHTML = `<div class="catin"><div class="cath"><b>Agregar tarjeta${K === 'tablet' && col != null ? ` · ${col === 0 ? 'columna del plano' : `columna ${col}`}` : ''}</b><button class="eb sm" data-cx>✕</button></div>
        <input placeholder="Buscar tarjeta…" autocomplete="off"><div class="catg"></div></div>`;
      this.wrap.appendChild(box);
      this.catBox = box;
      const inp = box.querySelector('input'), g = box.querySelector('.catg');
      const paint = () => {
        const q = inp.value.trim().toLowerCase();
        const list = Object.entries(CAT).filter(([, c]) => c.kinds.includes(K)).filter(([k, c]) => !q || `${k} ${c.name} ${c.desc}`.toLowerCase().includes(q));
        g.innerHTML = list.map(([k, c]) => `<button data-ck="${k}"><span class="cic">${window.MaeVista.icon(ICO[k] || 'grid')}</span><span><b>${esc(c.name)}</b><small>${esc(c.desc)}</small></span></button>`).join('') || '<p class="hint">No hay tarjetas con ese nombre.</p>';
      };
      inp.oninput = paint;
      inp.onkeydown = (e) => { if (e.key === 'Enter') { const f = g.querySelector('[data-ck]'); if (f) f.click(); } };
      box.onclick = (e) => {
        if (e.target === box || e.target.closest('[data-cx]')) return this.closeCatalog();
        const ck = e.target.closest('[data-ck]'); if (!ck) return undefined;
        this.closeCatalog(); this.addBlock(ck.dataset.ck, col);
        return undefined;
      };
      paint(); inp.focus();
    }
    closeCatalog() { if (this.catBox) { this.catBox.remove(); this.catBox = null; } }
    /** Copia el diseño del otro equipo (celular ↔ tablet) adaptando las columnas. */
    copyFrom(other) {
      const src = ((this.v.layouts || {})[other] || {}).blocks || [];
      if (!src.length) { this.toast('El otro diseño todavía no tiene tarjetas'); return; }
      if (this.blocks().length && !confirm(`¿Reemplazar las tarjetas de ${this.K === 'tablet' ? 'la tablet' : 'el celular'} por las ${other === 'tablet' ? 'de la tablet' : 'del celular'}?`)) return;
      const CAT = window.MaeVista.CATALOG;
      const ordered = other === 'tablet' ? src.slice().sort((a, b) => (a.col || 0) - (b.col || 0)) : src;
      let n = 0;
      const out = ordered.filter((b) => (CAT[b.type] || { kinds: [] }).kinds.includes(this.K)).map((b) => {
        const nb = clone(b); nb.id = this.newId(nb.type);
        nb.col = this.K === 'tablet' ? (nb.type === 'plan' ? 0 : nb.type === 'kpis' ? 1 : 1 + (n++ % 2)) : 0;
        return nb;
      });
      this.change(() => { this.lay().blocks = out; this.sel = null; });
      this.toast(`Listo: copiado ${other === 'tablet' ? 'de la tablet' : 'del celular'}`);
    }
    /** El prearmado que se pone solo al abrir no cuenta como cambio sin guardar. */
    baseline() {
      const s = this.saved; if (!s) return;
      (s.layouts = s.layouts || {})[this.K] = clone(this.lay());
      if (!s.plan && this.v.plan) s.plan = clone(this.v.plan);
    }
    /** Un dashboard tiene el diseño del celular y el de la tablet (layouts); los viejos tenían una sola lista. */
    static normalize(v) {
      v.layouts = v.layouts || {};
      const k = v.kind || 'phone';
      if (Array.isArray(v.blocks) && v.blocks.length && !(v.layouts[k] && v.layouts[k].blocks)) v.layouts[k] = { blocks: v.blocks, orientation: v.orientation || null };
      delete v.blocks; delete v.orientation; delete v.updated; delete v.by;
      return v;
    }
    get K() { return this._k || (this.v && this.v.kind) || 'phone'; }
    set K(k) { this._k = k; }
    lay() { const L = this.v.layouts || (this.v.layouts = {}); return L[this.K] || (L[this.K] = { blocks: [] }); }
    /** Lo que ve el motor: el dashboard con las tarjetas del tipo que se está editando. */
    viewFor() { const l = this.lay(); return Object.assign({}, this.v, { kind: this.K, blocks: l.blocks, orientation: l.orientation || null, layouts: undefined }); }
    model() { return this.card && this.card.model ? this.card.model() : null; }
    states() { return this.hass.states; }
    fname(id) { const s = this.states()[id]; return (s && s.attributes.friendly_name) || id; }
    toast(t) { const e = this.$('#toastE'); e.textContent = t; e.style.display = 'block'; clearTimeout(this.tt); this.tt = setTimeout(() => { e.style.display = 'none'; }, 2200); }
    dirty() { return JSON.stringify(this.v) !== JSON.stringify(this.saved); }
    push() { this.undo.push(JSON.stringify(this.v)); if (this.undo.length > 80) this.undo.shift(); this.redo = []; }
    change(fn) {
      this.push(); fn(); this.draw();
      // probando en el equipo: cada cambio le llega solo (un momento después del último)
      if (this.trying) { clearTimeout(this.tryT); this.tryT = setTimeout(() => this.cmd('try', true), 900); }
    }

    prearmado(silent) {
      const m = this.model();
      const d = window.MaeVista.defaults(this.K, m || { rooms: [], access: [], cams: [], roomOf: {}, scenes: [] }, this.v, this.states(), this.cfg.floorplan);
      if (!silent) this.push();
      const l = this.lay();
      l.blocks = d.blocks;
      if (!this.v.plan && d.plan) this.v.plan = d.plan;
      if (this.K === 'tablet' && !l.orientation) l.orientation = d.orientation || 'landscape';
      if (silent) this.baseline();
      else { this.sel = null; this.draw(); this.toast('Listo: el prearmado con los equipos de esta casa'); }
    }

    /* ───────── dibujo ───────── */
    draw() {
      const v = this.v, K = this.K, ori = this.lay().orientation || 'landscape', dirty = this.dirty();
      const other = K === 'tablet' ? 'phone' : 'tablet', hasOther = !!(((v.layouts || {})[other] || {}).blocks || []).length;
      this.$('#edt').innerHTML = `<button class="eb" data-e="close" title="Volver (Esc)">← Volver</button><h2>${esc(v.name)}${dirty ? ' <span class="dirt" title="Hay cambios sin guardar">● sin guardar</span>' : ''}</h2>
          <span class="eseg" title="Un mismo dashboard tiene su diseño para el celular y para la tablet">${[['phone', 'Celular'], ['tablet', 'Tablet']].map(([k, l]) => `<button data-kind="${k}" class="${K === k ? 'on' : ''}">${l}</button>`).join('')}</span>
          ${K === 'tablet' ? `<span class="eseg">${[['landscape', 'Horizontal'], ['portrait', 'Vertical']].map(([k, l]) => `<button data-ori="${k}" class="${ori === k ? 'on' : ''}">${l}</button>`).join('')}</span>` : ''}
          <button class="eb pri2" data-e="add" title="Agregar una tarjeta">+ Tarjeta</button><button class="eb" data-e="plan">Plano e imágenes</button>
          <span class="eseg sim" title="Simular en la vista previa (no toca la casa)"><span class="lbl">Simular</span>${[['night', 'Noche'], ['alarm', 'Alarma'], ['music', 'Música'], ['gate', 'Portón']].map(([k, l]) => `<button data-sim="${k}" class="${(this.sim || {})[k] ? 'on' : ''}">${l}</button>`).join('')}</span>
          <span class="sp"></span>
          ${this.trying ? `<button class="eb warn" data-e="tryend" title="Los equipos vuelven al diseño guardado">Terminar prueba</button>` : '<button class="eb" data-e="try" title="Los equipos con este dashboard muestran este diseño (sin guardar) por 15 minutos">Probar en el equipo</button>'}
          <button class="eb ico" data-e="undo" ${this.undo.length ? '' : 'disabled'} title="Deshacer (Ctrl+Z)">↶</button><button class="eb ico" data-e="redo" ${this.redo.length ? '' : 'disabled'} title="Rehacer (Ctrl+Y)">↷</button>
          <span class="emenu"><button class="eb" data-e="more" title="Más opciones">Más ▾</button>${this.moreOpen ? `<span class="emenu-l">
            <button data-e="pre">Volver al prearmado</button>${hasOther ? `<button data-e="copy">Copiar el diseño ${other === 'tablet' ? 'de la tablet' : 'del celular'}</button>` : ''}
            <button data-e="history">Historial de versiones…</button>
            <button data-e="export">Exportar como plantilla (archivo)</button><button data-e="import">Importar una plantilla…</button>
            <button data-e="reset" ${dirty ? '' : 'disabled'}>Descartar los cambios</button></span>` : ''}</span>
          <button class="eb pri" data-e="save" ${dirty ? '' : 'disabled'} title="Guardar (Ctrl+S)">Guardar</button>`;
      this.drawList(); this.drawPreview(); this.drawProps(); this.bind();
    }
    blocks() { const l = this.lay(); return l.blocks || (l.blocks = []); }
    drawList() {
      const K = this.K, CAT = window.MaeVista.CATALOG;
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
        <p class="hint" style="margin-top:12px">Tocá una tarjeta en la vista previa para editarla y arrastrala para moverla (también acá, en la lista).</p>
        <p class="hint">Atajos: <b>Ctrl+Z</b> deshacer · <b>Ctrl+Y</b> rehacer · <b>Ctrl+S</b> guardar · <b>Ctrl+D</b> duplicar · <b>Supr</b> borrar · <b>Alt+↑/↓</b> mover · <b>Esc</b> soltar la tarjeta.</p>`;
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
    /** Tamaño de la pantalla de la vista previa (celular 390×800, tablet 1180×760) escalada al lugar libre. */
    sizeFrame() {
      const K = this.K, ori = this.lay().orientation || 'landscape';
      const size = K === 'phone' ? [390, 800] : ori === 'portrait' ? [760, 1180] : [1180, 760];
      const box = this.$('#edc').getBoundingClientRect();
      const W = size[0] + 20, H = size[1] + 20;
      const sc = Math.max(0.2, Math.min(1, (box.width - 48) / W, (box.height - 48) / H));
      const fr = this.$('#frame'), fw = this.$('#fwrap');
      fr.style.width = `${W}px`; fr.style.height = `${H}px`; fr.style.transform = `scale(${sc})`;
      fw.style.width = `${Math.round(W * sc)}px`; fw.style.height = `${Math.round(H * sc)}px`;
      return size;
    }
    /** La vista previa es una pantalla de verdad (un iframe con el motor de la app): la barra de abajo, el alto y el
     *  ancho se comportan como en el equipo, y los estilos del panel no la tocan. */
    drawPreview() {
      const size = this.sizeFrame(), fr = this.$('#frame');
      const ctx = () => ({ kind: this.K, orientation: this.lay().orientation || 'landscape', edit: this.editCtx(), sim: this.sim || null });
      if (this.vista && this.ifr && this.ifr.isConnected) { this.vista.setCtx(ctx()); this.vista.setView(this.viewFor()); return; }
      if (!this.card) { fr.innerHTML = '<p style="padding:20px;color:#8f99ab">La vista previa necesita la tarjeta MatterAI (recargá la página).</p>'; return; }
      fr.innerHTML = '';
      const ifr = this.ifr = document.createElement('iframe');
      ifr.title = 'Vista previa';
      ifr.srcdoc = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Red+Hat+Display:wght@400;500;600;700&family=Red+Hat+Mono:wght@400;500&display=swap">
        <link rel="stylesheet" href="${BASE}/vista.css?t=${this.ver}"><style>html,body{margin:0;background:#161b21}</style></head>
        <body><div id="pv"></div><script src="${BASE}/vista.js?t=${this.ver}"><\/script></body></html>`;
      ifr.onload = () => {
        const W = ifr.contentWindow;
        if (!W || !W.MaeVista) { this.toast('No se pudo cargar la vista previa'); return; }
        this.vista = W.MaeVista.create(W.document.getElementById('pv'), Object.assign({
          card: this.card, hass: () => this.p._hass || this.hass, base: () => '', toast: () => {}, openEntity() {}, openMenu() {},
          sign: async (path) => (await this.hass.callWS({ type: 'auth/sign_path', path, expires: 7200 })).path,
        }, ctx()));
        this.vista.setView(this.viewFor());
      };
      fr.appendChild(ifr);
      void size;
    }
    /** Lo que la vista previa puede hacer en el editor: elegir, la barra de la tarjeta, arrastrar y agregar. */
    editCtx() {
      return { selected: this.sel, onSelect: (x) => this.pick(x), onAction: (id, a) => { this.sel = id; this.blockAct(id, a); },
        onMove: (from, where) => this.moveTo(from, where), onAdd: (col) => this.openCatalog(col) };
    }
    pick(id) {
      id = id || null;
      if (id !== this.sel) { this.roomEd = null; this.rdraft = null; }
      this.sel = id; this.drawList(); this.drawProps();
      if (this.vista) this.vista.setCtx({ edit: this.editCtx() });
      this.bind();
    }

    /* ───────── propiedades ───────── */
    entOptions(domains, val) {
      const S = this.states();
      const ids = Object.keys(S).filter((e) => !domains || domains.includes(e.split('.')[0]));
      if (val && !ids.includes(val)) ids.push(val);
      ids.sort((a, b) => this.fname(a).localeCompare(this.fname(b), 'es'));
      if (domains && domains.length === 1) return ids.map((e) => `<option value="${esc(e)}" ${e === val ? 'selected' : ''}>${esc(this.fname(e))}</option>`).join('');
      const by = {};
      ids.forEach((e) => { (by[e.split('.')[0]] = by[e.split('.')[0]] || []).push(e); });
      return Object.keys(by).sort().map((d) => `<optgroup label="${esc(d)}">${by[d].map((e) => `<option value="${esc(e)}" ${e === val ? 'selected' : ''}>${esc(this.fname(e))}</option>`).join('')}</optgroup>`).join('');
    }
    ent(label, key, val, domains, path) {
      return `<div class="fld"><span>${esc(label)}</span>${this.cbBtn(val, `data-cb="${esc(path || key)}" data-dom="${esc((domains || []).join(','))}"`)}</div>`;
    }
    cbBtn(val, attrs) {
      const d = val ? val.split('.')[0] : '';
      return `<button type="button" class="cbv" ${attrs}>${val ? `<span class="dtag">${esc(DOM_NAME[d] || d)}</span><b>${esc(this.fname(val))}</b><small>${esc(this.areaOf(val))}</small>` : '<span class="ph">Elegir un equipo…</span>'}<span class="hint">▾</span></button>`;
    }
    areaOf(id) {
      const h = this.hass || {}, e = (h.entities || {})[id] || {}, aid = e.area_id || ((h.devices || {})[e.device_id] || {}).area_id;
      return (aid && h.areas && h.areas[aid] && h.areas[aid].name) || '';
    }
    stateTxt(id) {
      const s = this.states()[id]; if (!s) return '';
      const u = s.attributes.unit_of_measurement;
      return { on: 'prendido', off: 'apagado', open: 'abierto', closed: 'cerrado', locked: 'cerrada', unlocked: 'abierta', unavailable: 'sin conexión', playing: 'sonando', idle: 'en espera' }[s.state] || (u ? `${s.state} ${u}` : s.state.length < 14 ? s.state : '');
    }
    /** Buscador de equipos: escribís y filtra por nombre, ambiente, tipo o id; con flechas y Enter. */
    openCB(anchor, domains, onPick, allowNone = true) {
      this.closeCB();
      const S = this.states(), doms = domains && domains.length ? domains : null;
      const all = Object.keys(S).filter((e) => !doms || doms.includes(e.split('.')[0])).map((e) => {
        const d = e.split('.')[0], n = this.fname(e), a = this.areaOf(e);
        return { e, d, n, a, k: `${n} ${a} ${DOM_NAME[d] || ''} ${e}`.toLowerCase() };
      });
      const box = document.createElement('div');
      box.className = 'cbp';
      box.innerHTML = `<input placeholder="Buscar por nombre, ambiente o tipo…" autocomplete="off"><div class="cbl"></div>`;
      this.wrap.appendChild(box);
      const r = anchor.getBoundingClientRect(), H = Math.min(420, innerHeight - 20);
      box.style.left = `${Math.max(10, Math.min(r.left, innerWidth - 370))}px`;
      box.style.top = `${r.bottom + 6 + H > innerHeight ? Math.max(10, r.top - H - 6) : r.bottom + 6}px`;
      const inp = box.querySelector('input'), list = box.querySelector('.cbl');
      let res = [], cur = 0;
      const paint = () => {
        const q = inp.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
        res = all.filter((x) => q.every((w) => x.k.includes(w)));
        res.sort((a, b) => (q.length && a.n.toLowerCase().startsWith(q[0]) ? 0 : 1) - (q.length && b.n.toLowerCase().startsWith(q[0]) ? 0 : 1) || a.n.localeCompare(b.n, 'es'));
        res = res.slice(0, 80);
        if (allowNone && !q.length) res.unshift({ e: '', n: 'Ninguno', a: '', d: '' });
        cur = Math.min(cur, Math.max(0, res.length - 1));
        list.innerHTML = res.length ? res.map((x, i) => `<button type="button" class="cbo ${i === cur ? 'on' : ''}" data-i="${i}">${x.e ? `<span class="dtag">${esc(DOM_NAME[x.d] || x.d)}</span>` : ''}<span class="tx"><b>${esc(x.n)}</b><small>${esc([x.a, x.e].filter(Boolean).join(' · '))}</small></span><span class="st">${esc(x.e ? this.stateTxt(x.e) : '')}</span></button>`).join('')
          : '<div class="none">No hay equipos con ese nombre.</div>';
        const on = list.querySelector('.cbo.on'); if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest' });
      };
      const pick = (i) => { const x = res[i]; if (!x) return; this.closeCB(); onPick(x.e); };
      inp.oninput = () => { cur = 0; paint(); };
      inp.onkeydown = (e) => {
        if (e.key === 'ArrowDown') { cur = Math.min(res.length - 1, cur + 1); paint(); e.preventDefault(); }
        else if (e.key === 'ArrowUp') { cur = Math.max(0, cur - 1); paint(); e.preventDefault(); }
        else if (e.key === 'Enter') { pick(cur); e.preventDefault(); }
        else if (e.key === 'Escape') { this.closeCB(); e.stopPropagation(); }
      };
      list.onclick = (e) => { const b = e.target.closest('[data-i]'); if (b) pick(+b.dataset.i); };
      this.cbOut = (e) => { if (!e.composedPath().includes(box) && !e.composedPath().includes(anchor)) this.closeCB(); };
      setTimeout(() => document.addEventListener('pointerdown', this.cbOut, true), 0);
      this.cb = box; paint(); inp.focus();
    }
    closeCB() { if (this.cb) { this.cb.remove(); this.cb = null; } if (this.cbOut) { document.removeEventListener('pointerdown', this.cbOut, true); this.cbOut = null; } }
    action(a, path, title) {
      a = a || { type: 'none' };
      const m = this.model(), rooms = m ? m.rooms.map((r) => r.name) : [];
      const SCR = window.MaeVista.SCREEN_NAMES;
      return `<div class="act"><label class="fld"><span>${esc(title)}</span><select data-f="${path}.type">${ACTION_TYPES.map(([k, l]) => `<option value="${k}" ${a.type === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        ${a.type === 'room' ? `<label class="fld"><span>Ambiente</span><select data-f="${path}.room">${a.room && !rooms.includes(a.room) ? `<option selected>${esc(a.room)}</option>` : ''}${rooms.map((r) => `<option ${a.room === r ? 'selected' : ''}>${esc(r)}</option>`).join('')}</select></label>` : ''}
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
          <p class="hint">Estás editando el diseño para <b>${this.K === 'tablet' ? 'la tablet' : 'el celular'}</b>. Cambiá arriba entre Celular y Tablet: cada uno tiene el suyo, y los dos se guardan juntos.</p>
          <p class="hint">Tocá una tarjeta en la vista previa (o en la lista) para editarla. Al guardar, les llega a los equipos con este dashboard al instante, sin actualizar la app.</p>`;
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
          h += this.multi('Más cámaras (se pasan con «Otra cámara» o deslizando)', 'entities', c.entities, opts(PICK.camera).filter(([e]) => e !== c.entity));
          if (b.type === 'camera') h += this.items(b, { title: 'Botones extra', hold: true });
          break;
        case 'rooms':
          h += `<label class="fld"><span>Cómo se ve</span><select data-f="cfg.style"><option value="list" ${c.style !== 'grid' ? 'selected' : ''}>Lista</option><option value="grid" ${c.style === 'grid' ? 'selected' : ''}>Grilla</option></select></label>`;
          if (this.roomEd != null) { r.innerHTML = this.roomEditor(); return; }
          h += this.multi('Ambientes (en este orden)', 'rooms', (c.rooms && c.rooms.length) ? c.rooms : (m ? m.rooms.slice(0, 4).map((x) => x.name) : []), (m ? m.rooms : []).map((x) => [x.name, x.name]));
          h += '<p class="hint">Cada persona también puede fijar o sacar ambientes desde su celular (mantener apretado).</p>';
          h += `<h4>Qué hay adentro de cada ambiente</h4><div class="rlist">${(m ? m.rooms : []).map((x) => `<button class="eb sm" data-red="${esc(x.name)}"><span>${esc(x.name)}</span><span class="hint">Editar ›</span></button>`).join('')}
            <button class="eb sm" data-red="">+ Ambiente nuevo</button></div>`;
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
        case 'weather': h += this.ent('Clima (vacío: el de la casa)', 'wx', c.entity, ['weather'], 'cfg.entity') + this.action(c.tap, 'cfg.tap', 'Al tocar (vacío: abre el pronóstico)'); break;
        case 'climate': h += this.ent('Aire o termostato', 'cl', c.entity, ['climate'], 'cfg.entity'); break;
        case 'covers': case 'lights': {
          const dom = b.type === 'covers' ? 'cover' : 'light';
          h += '<p class="hint">Elegí equipos sueltos, o ambientes (se muestran todos los de esos ambientes). Sin nada: los de la casa.</p>';
          h += this.multi(b.type === 'covers' ? 'Cortinas' : 'Luces', 'entities', c.entities, opts([dom]));
          h += this.multi('O los de estos ambientes', 'rooms', c.rooms, (m ? m.rooms : []).map((x) => [x.name, x.name]));
          break;
        }
        case 'energy': h += this.ent('Sensor de consumo (vacío: el de la casa)', 'en', c.entity, ['sensor'], 'cfg.entity'); break;
        case 'sensor':
          h += this.ent('Sensor', 'se', c.entity, ['sensor', 'input_number', 'number'], 'cfg.entity');
          h += `<div style="display:flex;gap:8px"><label class="fld"><span>Mínimo</span><input type="number" data-f="cfg.min" value="${esc(c.min != null ? c.min : '')}" placeholder="0"></label>
            <label class="fld"><span>Máximo</span><input type="number" data-f="cfg.max" value="${esc(c.max != null ? c.max : '')}" placeholder="100"></label></div>`;
          break;
        case 'people': h += '<p class="hint">Muestra las personas de la casa, con quién está y quién no.</p>'; break;
        case 'text':
          h += `<label class="fld"><span>Cómo se ve</span><select data-f="cfg.style"><option value="separator" ${c.style === 'separator' ? 'selected' : ''}>Separador (sólo el título)</option><option value="" ${c.style !== 'separator' ? 'selected' : ''}>Nota con texto</option></select></label>`;
          if (c.style !== 'separator') h += `<label class="fld"><span>Texto</span><textarea data-f="cfg.text" maxlength="600" style="font-family:inherit;font-size:13px;min-height:90px">${esc(c.text || '')}</textarea></label>`;
          break;
        case 'image':
          h += `<div class="slot">${c.image ? `<img data-imgprev="${esc(c.image)}" alt="">` : '<img alt="">'}<span><b>Imagen</b><br><small class="hint">${c.image ? 'Cargada' : 'Sin imagen'}</small></span>
            <label class="eb sm">Subir<input type="file" accept="image/jpeg,image/png,image/webp" data-imgup hidden></label></div>
            <label class="fld"><span>O una dirección de la casa (/local/…)</span><input data-f="cfg.image" value="${esc(c.image && c.image.startsWith('/local/') ? c.image : '')}" placeholder="/local/logo.png"></label>`;
          h += this.action(c.tap, 'cfg.tap', 'Al tocar');
          break;
        default: h += '<p class="hint">Esta tarjeta no tiene opciones.</p>';
      }
      if (b.type === 'buttons') h += `<label class="fld"><span>Botones por fila</span><select data-f="cfg.cols"><option value="">Automático</option>${[1, 2, 3, 4].map((n) => `<option value="${n}" ${c.cols === n ? 'selected' : ''}>${n}</option>`).join('')}</select></label>`;
      h += '<h4>Diseño</h4>';
      if (this.K === 'tablet') h += `<label class="fld"><span>Columna</span><select data-f="col">${[[0, 'Del plano'], [1, 'Columna 1'], [2, 'Columna 2']].map(([k, l]) => `<option value="${k}" ${(b.col || 0) === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>`;
      h += `<label class="fld"><span>Ancho</span><select data-f="size"><option value="">Completo</option><option value="half" ${b.size === 'half' ? 'selected' : ''}>Media columna (van de a dos)</option></select></label>`;
      h += this.condEditor(b);
      h += '<h4>Más</h4><button class="eb sm" data-copyto>Copiar esta tarjeta a otro dashboard…</button>';
      r.innerHTML = h;
      const ip = r.querySelector('[data-imgprev]'); if (ip) this.signed(ip.dataset.imgprev).then((u) => { ip.src = u; }).catch(() => {});
    }
    /** «Mostrar sólo si…»: condiciones como la tarjeta condicional de Home Assistant (se cumplen todas). */
    condEditor(b) {
      const C = b.show || [], CO = window.MaeVista.CONDITIONS;
      return `<h4>Mostrar sólo si…</h4>${C.map((q, i) => {
        const s = q.entity && this.states()[q.entity];
        return `<div class="it"><div class="row"><select data-f="show.${i}.type" style="flex:1">${Object.entries(CO).map(([k, l]) => `<option value="${k}" ${q.type === k ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select><button class="eb sm warn" data-cdel="${i}" title="Sacar">✕</button></div>
          ${/state$/.test(q.type) ? `${this.ent('Equipo', 'ce', q.entity, null, `show.${i}.entity`)}<label class="fld"><span>Estado${s ? ` (ahora: ${esc(s.state)})` : ''}</span><input data-f="show.${i}.state" value="${esc(q.state || '')}" placeholder="on, off, open, home, armed_away…"></label>` : ''}</div>`;
      }).join('')}<button class="eb sm" data-cadd>+ Agregar condición</button>
        <p class="hint">${C.length ? 'Se ve sólo cuando se cumplen todas. En la vista previa, si ahora no se cumple, la tarjeta se ve transparente.' : 'Sin condiciones: se ve siempre.'}</p>`;
    }

    /* ───────── ambientes por dentro (son de la casa: valen para todos los dashboards y la app) ───────── */
    roomsCfg() {
      if (Array.isArray(this.cfg.rooms) && this.cfg.rooms.length) return this.cfg.rooms;
      // todavía se arman solos con las Áreas de HA: se pasan a manual con lo mismo que se ve hoy
      const h = this.hass || {}, areas = h.areas || {}, ents = h.entities || {}, devs = h.devices || {}, S = this.states();
      const rooms = Object.values(areas).map((a) => ({ name: a.name || a.area_id, entities: [], _a: a.area_id }));
      const by = {}; rooms.forEach((x) => { by[x._a] = x; });
      Object.keys(S).sort().forEach((id) => {
        const e = ents[id] || {}; if (e.hidden || e.hidden_by || e.entity_category) return;
        if (!ROOM_DOMAINS.includes(id.split('.')[0])) return;
        const aid = e.area_id || (devs[e.device_id] || {}).area_id; if (aid && by[aid]) by[aid].entities.push(id);
      });
      return rooms.filter((x) => x.entities.length).map(({ _a, ...x }) => x); // eslint-disable-line no-unused-vars
    }
    roomEditor() {
      if (!this.rdraft) {
        const list = this.roomsCfg(), i = list.findIndex((x) => x.name === this.roomEd);
        this.rdraft = i >= 0 ? clone(list[i]) : { name: this.roomEd || 'Ambiente nuevo', entities: [] };
        this.rdraft._orig = i >= 0 ? list[i].name : null;
      }
      const R = this.rdraft, eid = (x) => (x && typeof x === 'object' ? x.entity : x), ICONS = window.MaeVista.ICONS;
      const manual = Array.isArray(this.cfg.rooms) && this.cfg.rooms.length;
      return `<button class="eb sm" data-rx="back">‹ Volver a la tarjeta</button><h4>Ambiente</h4>
        ${manual ? '' : '<div class="warnbox">Hoy los ambientes salen solos de las Áreas de Home Assistant. Al guardar, quedan armados a mano (con lo mismo que se ve ahora) y desde ahí se editan acá.</div>'}
        <label class="fld"><span>Nombre</span><input data-rn="name" value="${esc(R.name)}" maxlength="40"></label>
        <label class="fld"><span>Ícono</span><select data-rn="icon"><option value="">Automático</option>${ICONS.map((n) => `<option ${R.icon === n ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
        <h4>Equipos (en este orden)</h4>
        ${(R.entities || []).map((x, i) => { const id = eid(x), d = id.split('.')[0]; return `<div class="rme"><span class="dtag">${esc(DOM_NAME[d] || d)}</span><span class="tx"><b>${esc((x && x.name) || this.fname(id))}</b><small>${esc(id)}${this.states()[id] ? '' : ' · no existe'}</small></span>
          <button data-rmv="${i}" data-d="-1" title="Subir">↑</button><button data-rmv="${i}" data-d="1" title="Bajar">↓</button><button data-rdel="${i}" title="Sacar">✕</button></div>`; }).join('') || '<p class="hint">Todavía no tiene equipos.</p>'}
        <div class="fld">${this.cbBtn('', 'data-radd="1"').replace('Elegir un equipo…', '+ Agregar un equipo')}</div>
        <div style="display:flex;gap:8px;margin-top:12px"><button class="eb pri" data-rx="save">Guardar ambiente</button>${R._orig ? '<button class="eb warn" data-rx="del">Borrar ambiente</button>' : ''}</div>
        <p class="hint">Los ambientes son de la casa: el cambio se ve en todos los dashboards y en la app al instante.</p>`;
    }
    async saveRoom(del) {
      const R = clone(this.rdraft), orig = R._orig; delete R._orig;
      R.name = String(R.name || '').trim() || 'Ambiente';
      if (!R.icon) delete R.icon;
      const list = clone(this.roomsCfg()), i = orig != null ? list.findIndex((x) => x.name === orig) : -1;
      if (del) { if (i >= 0) list.splice(i, 1); } else if (i >= 0) list[i] = Object.assign({}, list[i], R); else list.push(R);
      if (!del && list.filter((x) => x.name.toLowerCase() === R.name.toLowerCase()).length > 1) { this.toast('Ya hay un ambiente con ese nombre'); return; }
      const cfg = Object.assign({}, this.cfg, { rooms: list });
      try {
        await this.hass.callWS({ type: 'matterai/config/save', config: cfg });
        this.cfg = cfg; if (this.card && this.card.setConfig) this.card.setConfig(Object.assign({}, cfg));
        // si cambió el nombre, las tarjetas y el plano de este dashboard lo siguen
        if (orig && !del && orig !== R.name) {
          Object.values(this.v.layouts || {}).forEach((l) => (l && l.blocks || []).forEach((b) => { if (b.cfg && Array.isArray(b.cfg.rooms)) b.cfg.rooms = b.cfg.rooms.map((n) => (n === orig ? R.name : n)); if (b.cfg && b.cfg.tap && b.cfg.tap.room === orig) b.cfg.tap.room = R.name; (b.cfg && b.cfg.items || []).forEach((it) => { ['tap', 'hold'].forEach((k) => { if (it[k] && it[k].room === orig) it[k].room = R.name; }); }); }));
          ((this.v.plan || {}).zones || []).forEach((z) => { if (z.room === orig) z.room = R.name; });
        }
        this.toast(del ? 'Ambiente borrado' : 'Ambiente guardado: ya se ve en la app');
        this.roomEd = null; this.rdraft = null; setTimeout(() => this.draw(), 150);
      } catch (e) { this.toast(`No se pudo guardar: ${e.message || e}`); }
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
      const ed = W.querySelector('#ed');
      if (ed) ed.onclick = (e) => { if (this.moreOpen && !e.composedPath().some((x) => x.classList && x.classList.contains('emenu'))) { this.moreOpen = false; this.draw(); } };
      W.querySelectorAll('[data-kind]').forEach((x) => { x.onclick = () => {
        if (x.dataset.kind === this.K) return;
        this.K = x.dataset.kind; this.sel = null; this.roomEd = null; this.rdraft = null;
        if (!this.blocks().length) this.prearmado(true); // todavía no tiene diseño para este tipo: arranca del prearmado
        this.draw();
      }; });
      W.querySelectorAll('[data-sim]').forEach((x) => { x.onclick = () => {
        this.sim = Object.assign({}, this.sim || {}, { [x.dataset.sim]: !(this.sim || {})[x.dataset.sim] });
        if (this.vista) this.vista.setCtx({ sim: this.sim });
        this.draw();
      }; });
      W.querySelectorAll('[data-ori]').forEach((x) => { x.onclick = () => this.change(() => { this.lay().orientation = x.dataset.ori; }); });
      W.querySelectorAll('[data-pf]').forEach((x) => { x.oninput = () => {
        const q = x.value.trim().toLowerCase(), sel = x.parentNode.querySelector('select');
        [...sel.options].forEach((o) => { o.hidden = !!q && o.value !== '' && !(`${o.textContent} ${o.value}`.toLowerCase().includes(q)); });
        const first = [...sel.options].find((o) => !o.hidden && o.value); if (q && first) sel.size = Math.min(8, [...sel.options].filter((o) => !o.hidden).length + 1); else sel.size = 0;
      }; });
      W.querySelectorAll('[data-add]').forEach((x) => { x.onclick = () => this.addBlock(x.dataset.add); });
      // lista: flechas, duplicar, borrar, elegir (con on… y no addEventListener: se puede volver a enlazar sin duplicar)
      W.querySelectorAll('[data-bl]').forEach((row) => {
        const id = row.dataset.bl;
        row.onclick = (e) => {
          const t = e.target.closest('[data-mv],[data-col],[data-dup],[data-del]');
          if (t) {
            if (t.dataset.mv) return this.blockAct(id, t.dataset.mv === '-1' ? 'up' : 'down');
            if (t.dataset.col) return this.blockAct(id, t.dataset.col === '-1' ? 'left' : 'right');
            return this.blockAct(id, t.hasAttribute('data-dup') ? 'dup' : 'del');
          }
          return this.pick(id);
        };
        // arrastrar con el mouse
        row.ondragstart = (e) => { this.dragId = id; row.classList.add('drag'); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', id); } catch (_) { /* navegador viejo */ } };
        row.ondragend = () => { row.classList.remove('drag'); W.querySelectorAll('.over').forEach((o) => o.classList.remove('over')); };
        row.ondragover = (e) => { e.preventDefault(); row.classList.add('over'); };
        row.ondragleave = () => row.classList.remove('over');
        row.ondrop = (e) => { e.preventDefault(); e.stopPropagation(); const from = this.dragId; this.dragId = null; if (from && from !== id) this.change(() => this.dropBefore(from, id)); };
      });
      W.querySelectorAll('[data-colbox]').forEach((box) => {
        box.ondragover = (e) => { e.preventDefault(); box.classList.add('over'); };
        box.ondragleave = () => box.classList.remove('over');
        box.ondrop = (e) => { e.preventDefault(); const from = this.dragId; this.dragId = null; if (!from) return; this.moveTo(from, { col: +box.dataset.colbox }); };
      });
      // buscador de equipos
      const b = this.selBlock();
      W.querySelectorAll('#edr [data-cb]').forEach((x) => { x.onclick = () => this.openCB(x, x.dataset.dom ? x.dataset.dom.split(',') : null, (id) => {
        const path = x.dataset.cb;
        this.change(() => this.setPath(b, path, id || ''));
      }); });
      // ambientes por dentro
      W.querySelectorAll('#edr [data-red]').forEach((x) => { x.onclick = () => { this.roomEd = x.dataset.red; this.rdraft = null; this.drawProps(); this.bind(); }; });
      const R = this.rdraft, redraw = () => { this.drawProps(); this.bind(); };
      if (R) {
        W.querySelectorAll('#edr [data-rn]').forEach((x) => { x.onchange = () => { R[x.dataset.rn] = x.value; }; });
        W.querySelectorAll('#edr [data-rdel]').forEach((x) => { x.onclick = () => { R.entities.splice(+x.dataset.rdel, 1); redraw(); }; });
        W.querySelectorAll('#edr [data-rmv]').forEach((x) => { x.onclick = () => { const i = +x.dataset.rmv, j = i + +x.dataset.d; if (j < 0 || j >= R.entities.length) return; [R.entities[i], R.entities[j]] = [R.entities[j], R.entities[i]]; redraw(); }; });
        W.querySelectorAll('#edr [data-radd]').forEach((x) => { x.onclick = () => this.openCB(x, ROOM_DOMAINS, (id) => {
          if (!id) return; R.entities = R.entities || [];
          if (R.entities.some((y) => (y && y.entity) === id || y === id)) { this.toast('Ya está en este ambiente'); return; }
          R.entities.push(id); redraw();
        }, false); });
        W.querySelectorAll('#edr [data-rx]').forEach((x) => { x.onclick = () => {
          const k = x.dataset.rx;
          if (k === 'back') { this.roomEd = null; this.rdraft = null; redraw(); }
          if (k === 'save') this.saveRoom(false);
          if (k === 'del' && confirm(`¿Borrar el ambiente «${R._orig}»? Sus equipos no se borran.`)) this.saveRoom(true);
        }; });
      }
      // propiedades
      W.querySelectorAll('#edr [data-f]').forEach((x) => {
        x.onchange = () => {
          const path = x.dataset.f;
          let val = x.value;
          if (path === 'col') val = +val;
          if (/^cfg\.(cols|min|max)$/.test(path)) val = val === '' ? '' : Number(val);
          if (path === 'cfg.image' && val && !/^\/local\/[\w./-]{1,160}$/.test(val)) { this.toast('La imagen tiene que estar en la casa: /local/archivo.png (o subila)'); return; }
          if (/\.entity$/.test(path) || path === 'cfg.entity' || path === 'cfg.gate') { val = val.trim(); if (val && !this.states()[val]) { this.toast('Ese equipo no existe en la casa'); return; } }
          this.change(() => {
            this.setPath(b, path, val);
            // al elegir «Abrir un ambiente / una pantalla» ya queda uno elegido (antes se veía elegido pero no se guardaba)
            if (/(^|\.)(tap|hold)\.type$/.test(path)) {
              const a = path.split('.').slice(0, -1).reduce((o, k) => (o ? o[/^\d+$/.test(k) ? +k : k] : o), b) || {};
              const m0 = this.model();
              if (val === 'room' && !a.room && m0 && m0.rooms[0]) a.room = m0.rooms[0].name;
              if (val === 'screen' && !a.screen) a.screen = 'agenda';
            }
          });
        };
      });
      W.querySelectorAll('#edr [data-fb]').forEach((x) => { x.onchange = () => this.change(() => {
        if (x.dataset.fb === 'cfg.auto' && !x.checked) this.fromAuto(b); // pasa a manual con lo que se está viendo, para editarlo
        this.setPath(b, x.dataset.fb, x.checked);
      }); });
      W.querySelectorAll('#edr [data-fj]').forEach((x) => { x.onchange = () => { let val = null; try { val = x.value.trim() ? JSON.parse(x.value) : null; } catch (_) { this.toast('Los datos tienen que ser JSON, por ejemplo {"entity_id": "script.riego"}'); return; } this.change(() => this.setPath(b, x.dataset.fj, val)); }; });
      W.querySelectorAll('#edr [data-v]').forEach((x) => { x.onchange = () => this.change(() => { this.v[x.dataset.v] = x.value; }); });
      W.querySelectorAll('#edr [data-iadd]').forEach((x) => { x.onclick = () => this.change(() => { b.cfg.items = b.cfg.items || []; b.cfg.items.push(b.type === 'kpis' ? { kind: 'lights' } : { tap: { type: 'toggle' } }); }); });
      W.querySelectorAll('#edr [data-idel]').forEach((x) => { x.onclick = () => this.change(() => b.cfg.items.splice(+x.dataset.idel, 1)); });
      W.querySelectorAll('#edr [data-imv]').forEach((x) => { x.onclick = () => this.change(() => { const i = +x.dataset.imv, j = i + +x.dataset.d, L = b.cfg.items; if (j < 0 || j >= L.length) return; [L[i], L[j]] = [L[j], L[i]]; }); });
      W.querySelectorAll('#edr [data-mk]').forEach((x) => { x.onchange = () => this.change(() => { const k = x.dataset.mk, m0 = this.model();
        if (k === 'rooms' && b.type === 'rooms' && !(b.cfg.rooms && b.cfg.rooms.length) && m0) b.cfg.rooms = m0.rooms.slice(0, 4).map((r) => r.name); // parte de lo que se ve
        const L = (b.cfg[k] = b.cfg[k] || []); if (x.checked) { if (!L.includes(x.value)) L.push(x.value); } else b.cfg[k] = L.filter((y) => y !== x.value); }); });
      W.querySelectorAll('#edr [data-cadd]').forEach((x) => { x.onclick = () => this.change(() => { b.show = b.show || []; if (b.show.length < 6) b.show.push({ type: 'night' }); }); });
      W.querySelectorAll('#edr [data-cdel]').forEach((x) => { x.onclick = () => this.change(() => { b.show.splice(+x.dataset.cdel, 1); if (!b.show.length) delete b.show; }); });
      W.querySelectorAll('#edr [data-copyto]').forEach((x) => { x.onclick = () => this.copyTo(b); });
      W.querySelectorAll('#edr [data-imgup]').forEach((x) => { x.onchange = async () => {
        const f = x.files[0]; if (!f) return;
        this.toast('Subiendo…');
        try { const p = await this.upload(f); this.change(() => { b.cfg.image = p; }); this.toast('Imagen subida'); } catch (e) { this.toast(`No se pudo subir: ${e.message || e}`); }
      }; });
      W.querySelectorAll('#edr [data-omv]').forEach((x) => { x.onclick = () => this.change(() => { const L = b.cfg[x.dataset.omv], i = +x.dataset.i, j = i + +x.dataset.d; if (j < 0 || j >= L.length) return; [L[i], L[j]] = [L[j], L[i]]; }); });
    }
    /** «Automático» → manual: arranca con lo que la app está mostrando (así se puede cambiar lo que ya está). */
    fromAuto(b) {
      const c = b.cfg = b.cfg || {}, m = this.model(), S = this.states();
      if (b.type === 'kpis' && !(c.items && c.items.length)) {
        const shown = this.vista && this.vista._test && this.vista._test.X.kpiItems && this.vista._test.X.kpiItems[b.id];
        c.items = clone(shown && shown.length ? shown : [{ kind: 'lights' }, { kind: 'temp' }, { kind: 'alarm' }]);
      }
      if (b.type === 'scenes' && !(c.entities && c.entities.length)) c.entities = ((m && m.scenes) || []).filter((id) => S[id]).slice(0, 12);
      if (b.type === 'routines' && !(c.entities && c.entities.length)) c.entities = Object.keys(S).filter((x) => x.startsWith('automation.')).slice(0, 4);
    }
    move(id, d) {
      const B = this.blocks(), i = B.findIndex((b) => b.id === id), col = B[i].col || 0;
      // el vecino de la misma columna
      let j = i + d;
      while (j >= 0 && j < B.length && (B[j].col || 0) !== col && this.K === 'tablet') j += d;
      if (j < 0 || j >= B.length) return;
      [B[i], B[j]] = [B[j], B[i]];
    }
    dropBefore(from, to) {
      const B = this.blocks(), i = B.findIndex((b) => b.id === from); const [b] = B.splice(i, 1);
      const j = B.findIndex((x) => x.id === to); b.col = B[j].col || 0; B.splice(j, 0, b);
    }
    async cmd(k) {
      if (k !== 'more' && this.moreOpen) this.moreOpen = false;
      if (k === 'close') return this.close();
      if (k === 'more') { this.moreOpen = !this.moreOpen; this.draw(); return; }
      if (k === 'add') return this.openCatalog(null);
      if (k === 'copy') return this.copyFrom(this.K === 'tablet' ? 'phone' : 'tablet');
      const fix = () => { if (this.sel && !this.blocks().some((b) => b.id === this.sel)) this.sel = null; this.roomEd = null; this.rdraft = null; this.draw(); };
      if (k === 'undo') { if (this.undo.length) { this.redo.push(JSON.stringify(this.v)); this.v = JSON.parse(this.undo.pop()); fix(); } return; }
      if (k === 'redo') { if (this.redo.length) { this.undo.push(JSON.stringify(this.v)); this.v = JSON.parse(this.redo.pop()); fix(); } return; }
      if (k === 'pre') { if (confirm('¿Reemplazar las tarjetas por el prearmado con los equipos de esta casa?')) this.prearmado(false); else this.draw(); return; }
      if (k === 'reset') { if (!confirm('¿Descartar todos los cambios sin guardar?')) { this.draw(); return; } this.push(); this.v = clone(this.saved); fix(); return; }
      if (k === 'plan') return this.planEditor();
      if (k === 'history') return this.historyDlg();
      if (k === 'export') return this.exportDesign();
      if (k === 'import') return this.importDesign();
      if (k === 'try') {
        try {
          const r = await this.hass.callWS({ type: 'matterai/views/preview', view: this.payload() });
          const first = !this.trying; this.trying = r.until;
          if (first) {
            this.draw();
            this.toast(r.devices === 0 ? 'Ningún equipo tiene este dashboard todavía: asignáselo en la página Dashboards' : `Listo: ${r.devices > 0 ? `${r.devices} equipo${r.devices > 1 ? 's' : ''}` : 'todos los equipos'} muestran este diseño (sin guardar) por ${r.minutes} min. Lo que cambies les llega solo.`);
          }
        } catch (e) { this.toast(`No se pudo probar: ${e.message || e}`); }
        return;
      }
      if (k === 'tryend') { await this.endTry(); this.draw(); this.toast('Prueba terminada: los equipos vuelven al diseño guardado'); return; }
      if (k === 'save') {
        try {
          const res = await this.hass.callWS({ type: 'matterai/views/save', view: this.payload() });
          this.v = Editor.normalize(clone(res)); this.saved = clone(this.v); this.undo = []; this.redo = [];
          if (this.trying) await this.endTry();
          this.draw();
          this.toast('Guardado: los equipos con este dashboard lo ven al instante');
        } catch (e) { this.toast(`No se pudo guardar: ${e.message || e}`); }
      }
    }
    /** Lo que se guarda (o se prueba): los dos diseños, el plano y lo demás del dashboard. */
    payload() {
      const v = this.v, L = v.layouts || {};
      const lay = (k) => (L[k] && L[k].blocks && L[k].blocks.length ? { blocks: L[k].blocks, orientation: k === 'tablet' ? L[k].orientation || 'landscape' : null } : null);
      return { id: v.id, name: v.name, kind: v.kind || 'phone', layouts: { phone: lay('phone'), tablet: lay('tablet') }, blocks: null, orientation: null,
        plan: v.plan || null, pinned: v.pinned || [], featured: v.featured || {}, scenes: v.scenes || null };
    }
    async endTry() {
      clearTimeout(this.tryT); this.trying = null;
      try { await this.hass.callWS({ type: 'matterai/views/preview_end', view_id: this.v.id }); } catch (_) { /* vence solo a los 15 min */ }
    }
    /** Ventana genérica del editor (historial, copiar a otro dashboard). */
    modal(title, body, onClick) {
      this.closeCatalog();
      const box = document.createElement('div');
      box.className = 'catp';
      box.innerHTML = `<div class="catin"><div class="cath"><b>${esc(title)}</b><button class="eb sm" data-cx>✕</button></div><div class="mbody">${body}</div></div>`;
      this.wrap.appendChild(box);
      this.catBox = box;
      box.onclick = (e) => { if (e.target === box || e.target.closest('[data-cx]')) return this.closeCatalog(); return onClick && onClick(e); };
      return box;
    }
    /** Historial: las últimas versiones guardadas; se puede cargar una (queda como cambio sin guardar). */
    async historyDlg() {
      let vers = [];
      try { vers = (await this.hass.callWS({ type: 'matterai/views/history', view_id: this.v.id })).versions || []; } catch (e) { this.toast(`No se pudo: ${e.message || e}`); return; }
      const when = (t) => (t ? new Date(t * 1000).toLocaleString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }) : '');
      this.modal('Historial de versiones', vers.length ? `<div class="hlist">${vers.map((x) => `<div class="hrow"><span><b>${esc(when(x.t))}</b><small>${esc(x.by || '')} · celular ${x.phone} tarjetas · tablet ${x.tablet}</small></span><button class="eb sm" data-hv="${x.index}">Ver y usar</button></div>`).join('')}</div>
        <p class="hint">Al cargar una versión queda como cambio sin guardar: mirala en la vista previa y guardá si te sirve (o Deshacer).</p>` : '<p class="hint">Todavía no hay versiones anteriores: se guardan solas cada vez que guardás.</p>', async (e) => {
        const hv = e.target.closest('[data-hv]'); if (!hv) return;
        try {
          const snap = await this.hass.callWS({ type: 'matterai/views/history_get', view_id: this.v.id, index: +hv.dataset.hv });
          const n = Editor.normalize(clone(snap));
          this.closeCatalog();
          this.change(() => { this.v.layouts = n.layouts || {}; this.v.plan = n.plan || null; if (n.name) this.v.name = n.name; this.sel = null; });
          this.toast('Versión cargada: guardá para quedarte con ella (o Deshacer)');
        } catch (err) { this.toast(`No se pudo: ${err.message || err}`); }
      });
    }
    /** Los equipos que usa una tarjeta (para avisar los que no existen al importar). */
    static entitiesIn(blocks) {
      const out = new Set(), walk = (o) => {
        if (Array.isArray(o)) return o.forEach(walk);
        if (!o || typeof o !== 'object') return undefined;
        Object.entries(o).forEach(([k, val]) => {
          if ((k === 'entity' || k === 'gate') && typeof val === 'string') out.add(val);
          else if (k === 'entities' && Array.isArray(val)) val.forEach((x) => typeof x === 'string' && out.add(x));
          else walk(val);
        });
        return undefined;
      };
      walk(blocks);
      return [...out];
    }
    /** Plantilla: el diseño (celular y tablet) en un archivo, para usarlo en otra casa. El plano no va (es de esta casa). */
    exportDesign() {
      const L = this.v.layouts || {}, keep = (k) => (L[k] && L[k].blocks && L[k].blocks.length ? { blocks: L[k].blocks, orientation: L[k].orientation || null } : null);
      const data = { format: 'matterai-dashboard', version: 1, name: this.v.name, exported: new Date().toISOString(), layouts: { phone: keep('phone'), tablet: keep('tablet') } };
      const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `dashboard-${String(this.v.name || 'matterai').toLowerCase().normalize('NFD').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '')}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      this.toast('Plantilla exportada (sin el plano, que es de esta casa)');
    }
    importDesign() {
      const inp = document.createElement('input');
      inp.type = 'file'; inp.accept = 'application/json,.json';
      inp.onchange = async () => {
        const f = inp.files[0]; if (!f) return;
        let d = null;
        try { d = JSON.parse(await f.text()); } catch (_) { d = null; }
        if (!d || d.format !== 'matterai-dashboard' || !d.layouts) { this.toast('Ese archivo no es una plantilla de MatterAI'); return; }
        const CAT = window.MaeVista.CATALOG, L = {};
        ['phone', 'tablet'].forEach((k) => {
          const l = d.layouts[k];
          if (l && Array.isArray(l.blocks)) L[k] = { blocks: l.blocks.filter((b) => b && CAT[b.type]).slice(0, 30).map((b) => Object.assign(clone(b), { id: this.newId(b.type) })), orientation: l.orientation || null };
        });
        if (!L.phone && !L.tablet) { this.toast('La plantilla no tiene tarjetas'); return; }
        if (!confirm(`¿Reemplazar el diseño por la plantilla «${d.name || 'sin nombre'}»? (Se puede deshacer)`)) return;
        this.change(() => { this.v.layouts = Object.assign({}, this.v.layouts, L); this.sel = null; });
        const miss = Editor.entitiesIn(L).filter((id) => !this.states()[id]);
        this.toast(miss.length ? `Plantilla cargada. ${miss.length} equipo${miss.length > 1 ? 's' : ''} no existe${miss.length > 1 ? 'n' : ''} en esta casa: elegilos de nuevo en cada tarjeta` : 'Plantilla cargada: revisala y guardá');
      };
      inp.click();
    }
    /** Copia la tarjeta elegida al diseño de celular o tablet de otro dashboard (se guarda al toque). */
    async copyTo(b) {
      let lst;
      try { lst = await this.hass.callWS({ type: 'matterai/views/list' }); } catch (e) { this.toast(`No se pudo: ${e.message || e}`); return; }
      const CAT = window.MaeVista.CATALOG, kinds = (CAT[b.type] || { kinds: [] }).kinds;
      const others = (lst.views || []).filter((x) => x.id !== this.v.id);
      const rows = others.map((x) => `<div class="hrow"><span><b>${esc(x.name)}</b></span>${['phone', 'tablet'].filter((k) => kinds.includes(k)).map((k) => `<button class="eb sm" data-ct="${esc(x.id)}" data-k="${k}">${k === 'phone' ? 'Celular' : 'Tablet'}</button>`).join(' ')}</div>`).join('');
      this.modal(`Copiar «${(CAT[b.type] || {}).name || b.type}» a…`, rows ? `<div class="hlist">${rows}</div><p class="hint">Se agrega al final del diseño elegido y se guarda en ese dashboard.</p>` : '<p class="hint">No hay otros dashboards en esta casa.</p>', async (e) => {
        const ct = e.target.closest('[data-ct]'); if (!ct) return;
        const tgt = Editor.normalize(clone(others.find((x) => x.id === ct.dataset.ct))), k = ct.dataset.k;
        const L = tgt.layouts[k] = tgt.layouts[k] || {};
        if (!(L.blocks && L.blocks.length)) {
          // ese diseño usaba el prearmado: se parte de él para no dejarlo con una sola tarjeta
          const m = this.model() || { rooms: [], access: [], cams: [], roomOf: {}, scenes: [] };
          const d = window.MaeVista.defaults(k, m, tgt, this.states(), this.cfg.floorplan);
          L.blocks = d.blocks; if (k === 'tablet') L.orientation = L.orientation || 'landscape';
        }
        const nb = clone(b); nb.id = this.newId(nb.type); nb.col = k === 'tablet' ? (this.K === 'tablet' ? b.col || 1 : (b.type === 'plan' ? 0 : 1)) : 0;
        L.blocks.push(nb);
        const keep = (q) => (tgt.layouts[q] && tgt.layouts[q].blocks && tgt.layouts[q].blocks.length ? { blocks: tgt.layouts[q].blocks, orientation: q === 'tablet' ? tgt.layouts[q].orientation || 'landscape' : null } : null);
        try {
          await this.hass.callWS({ type: 'matterai/views/save', view: { id: tgt.id, name: tgt.name, kind: tgt.kind || 'phone', layouts: { phone: keep('phone'), tablet: keep('tablet') }, blocks: null, orientation: null,
            plan: tgt.plan || null, pinned: tgt.pinned || [], featured: tgt.featured || {}, scenes: tgt.scenes || null } });
          this.closeCatalog();
          this.toast(`Copiada a «${tgt.name}» (${k === 'phone' ? 'celular' : 'tablet'})`);
        } catch (err) { this.toast(`No se pudo copiar: ${err.message || err}`); }
      });
    }
    close() {
      if (this.dirty() && !confirm('Hay cambios sin guardar. ¿Salir igual?')) return;
      window.removeEventListener('keydown', this.keyH);
      window.removeEventListener('resize', this.resH);
      window.removeEventListener('beforeunload', this.unloadH);
      clearInterval(this.liveT);
      if (this.trying) this.endTry();
      this.closeCB(); this.closeCatalog();
      if (this.vista) this.vista.destroy();
      this.host.remove();
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
    closePlan() { if (this.pe) { this.pe.remove(); this.pe = null; } this.drawing = null; this.draw(); }
    async planEditor() {
      if (this.pe) return;
      if (!this.v.plan) { this.push(); this.v.plan = { zones: [] }; }
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
        if (k === 'done') { this.closePlan(); return; }
        if (k === 'new') { this.drawing = []; this.zsel = null; await this.drawPlan(); return; }
        if (k === 'cancel') { this.drawing = null; await this.drawPlan(); return; }
        if (k === 'finish') {
          if (!this.drawing || this.drawing.length < 3) { this.toast('Marcá al menos 3 puntos'); return; }
          // el nombre se pone a la derecha (y toma el del ambiente al elegirlo): sin ventanitas del navegador
          this.push(); P.zones.push({ name: `Ambiente ${(P.zones || []).length + 1}`, room: null, lights: [], poly: this.drawing }); this.zsel = P.zones.length - 1; this.drawing = null;
          await this.drawPlan(); this.drawPreview(); return;
        }
        if (k === 'zdel' && this.zsel != null) { this.push(); P.zones.splice(this.zsel, 1); this.zsel = null; await this.drawPlan(); this.drawPreview(); }
      }; });
      pe.querySelectorAll('[data-z]').forEach((x) => { x.onchange = async () => {
        this.push(); const z = P.zones[this.zsel], k = x.dataset.z;
        if (k === 'room' && x.value && /^Ambiente \d+$/.test(z.name)) z.name = x.value; // toma el nombre del ambiente
        if (k === 'room' && x.value && !z.lights.length) { // y sus luces, si todavía no eligió ninguna
          const r = (this.model() || { rooms: [] }).rooms.find((y) => y.name === x.value);
          if (r && r.lightsCtl) z.lights = r.lightsCtl.slice(0, 24);
        }
        z[k] = x.value || null; if (k === 'name') z.name = (x.value || 'Ambiente').slice(0, 40);
        await this.drawPlan(); this.drawPreview();
      }; });
      pe.querySelectorAll('[data-zl]').forEach((x) => { x.onchange = () => { this.push(); const z = P.zones[this.zsel]; if (x.checked) z.lights.push(x.dataset.zl); else z.lights = z.lights.filter((y) => y !== x.dataset.zl); this.drawPreview(); }; });
    }
  }

  window.MaeEditor = { open, _Editor: Editor };
})();
