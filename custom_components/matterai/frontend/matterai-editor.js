/*
 * MatterAI · editor de dashboards (modo edición, como el de Home Assistant).
 *
 *   window.MaeEditor.open(panel, viewId[, 'phone' | 'tablet'])
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
  /* Tarjetas con elementos adentro: [singular, plural, dominios que se ofrecen al agregar] */
  const ELEM = {
    kpis: ['dato', 'Datos', null], scenes: ['escena', 'Escenas', ['scene', 'script']], routines: ['rutina', 'Rutinas', ['automation', 'script']],
    covers: ['cortina', 'Cortinas', ['cover']], lights: ['luz', 'Luces', ['light', 'switch']], buttons: ['botón', 'Botones', null],
    rooms: ['ambiente', 'Ambientes', null], camera: ['botón', 'Botones', null], featured: [null, null, null],
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
  .pe{position:fixed;inset:0;z-index:60;background:rgba(5,7,10,.94);display:grid;grid-template-columns:1fr 360px;color:#e9ecf2;font:14px/1.4 "Red Hat Display",system-ui,sans-serif}
  .pe *{box-sizing:border-box}.pe button{font:inherit;color:inherit;cursor:pointer}.pe h3,.pe h4{font-family:inherit}
  .pe-lbl{position:absolute;transform:translate(-50%,-50%);padding:3px 10px;border-radius:10px;background:rgba(22,27,33,.85);color:#e9ecf2;font-size:12.5px;font-weight:600;white-space:nowrap;pointer-events:none}
  .pe-lbl.sel{background:#f2b766;color:#1b1408}
  .pe-tip{position:absolute;left:50%;top:10px;transform:translateX(-50%);padding:7px 14px;border-radius:999px;background:rgba(22,27,33,.92);border:1px solid rgba(160,175,200,.25);font-size:12.5px;color:#c4cad6;white-space:nowrap;pointer-events:none}
  .zl{display:flex;align-items:center;gap:6px}.zl .tx{flex:1;min-width:0}.zl .zx{border:0;background:none;color:#8f99ab;padding:3px 7px;border-radius:7px}.zl .zx:hover{background:#262e3a;color:#f08a7c}
  .pe-c{overflow:auto;display:flex;align-items:center;justify-content:center;padding:20px}
  .pe-img{position:relative;display:inline-block;max-height:calc(100vh - 40px)}
  .pe-img img{display:block;max-height:calc(100vh - 40px);max-width:100%;user-select:none;-webkit-user-drag:none}
  .pe-img svg{position:absolute;inset:0;width:100%;height:100%;cursor:crosshair}
  .pe-r{background:#161b21;overflow:auto;padding:14px;border-left:1px solid rgba(160,175,200,.15)}
  .slot{display:flex;align-items:center;gap:8px;padding:8px;border-radius:10px;background:#1e242e;margin-bottom:6px}.slot img{width:44px;height:44px;object-fit:cover;border-radius:6px;background:#0d1116}.slot span{flex:1}
  .zl{padding:8px;border-radius:10px;background:#1e242e;margin-bottom:6px;border:1px solid transparent;cursor:pointer}.zl.sel{border-color:#f2b766}
  .toastE{position:fixed;z-index:70;left:50%;bottom:22px;transform:translateX(-50%);background:#262e3a;border:1px solid rgba(160,175,200,.2);padding:10px 16px;border-radius:12px;display:none}
  .ed{grid-template-columns:270px minmax(0,1fr) 360px}.ed.nolist{grid-template-columns:0 minmax(0,1fr) 380px}.ed.nolist .ed-l{visibility:hidden;padding:0;border:0;overflow:hidden}
  .ed-l{grid-column:1;grid-row:2}.ed-c{grid-column:2;grid-row:2}.ed-r{grid-column:3;grid-row:2}
  .ed-c{min-width:0}.ed-top{min-width:0}.ed *{scrollbar-color:#3a4150 transparent;scrollbar-width:thin}
  .eb.on{border-color:#f2b766;color:#f2b766}
  .rme .dtag{max-width:86px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.rme small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .rme button{flex:none}
  .it.focus{border-color:#f2b766;box-shadow:0 0 0 1px #f2b766}
  .guide{padding:14px;border-radius:14px;background:#1e242e;border:1px solid rgba(160,175,200,.15);margin-bottom:12px}.guide b{display:block;margin-bottom:6px}
  .guide ol{margin:0;padding-left:18px;color:#c4cad6;font-size:13px;line-height:1.6}
  .ed{grid-template-columns:minmax(0,1fr)!important;grid-template-rows:auto 1fr}
  .ed-top{grid-column:1/-1!important;grid-row:1}.ed-c{grid-column:1!important;grid-row:2}.ed-l,.ed-r{display:none!important}
  .ed-c{position:relative;transition:padding .2s}.ed.dlgon .ed-c{padding-right:calc(min(540px,46vw) + 24px)}
  .ed-top .saved{font-size:12.5px;color:#7fd6a4;padding:0 6px}.ed-top .saved.dirty{color:#f2b766}
  .ehint{position:absolute;left:50%;bottom:12px;transform:translateX(-50%);padding:8px 14px;border-radius:999px;background:rgba(30,36,46,.92);border:1px solid rgba(160,175,200,.2);color:#c4cad6;font-size:12.5px;white-space:nowrap;pointer-events:none}
  .ehint:empty{display:none}.ehint b{color:#f2b766}
  .dlg{position:fixed;z-index:40;top:62px;right:12px;bottom:12px;width:min(540px,46vw);display:none;flex-direction:column;background:#161b21;border:1px solid rgba(160,175,200,.22);border-radius:18px;box-shadow:0 24px 70px rgba(0,0,0,.55);overflow:hidden}
  .ed.dlgon .dlg{display:flex}
  .dlg-h{display:flex;flex-wrap:wrap;align-items:center;gap:10px;padding:14px 14px 0;border-bottom:1px solid rgba(160,175,200,.15)}
  .dlg-t{flex:1;min-width:0}.dlg-t b{display:block;font-size:17px}.dlg-t small{color:#8f99ab;font-size:12.5px}
  .tabs{flex-basis:100%;display:flex;gap:2px;margin-top:4px}.tabs button{border:0;background:none;padding:10px 14px;color:#8f99ab;font-weight:600;border-bottom:2px solid transparent}
  .tabs button.on{color:#e9ecf2;border-bottom-color:#f2b766}
  .dlg-b{flex:1;overflow:auto;padding:12px 16px}
  .dlg-f{display:flex;align-items:center;gap:8px;padding:12px 14px;border-top:1px solid rgba(160,175,200,.15)}.dlg-f .sp{flex:1}
  .elr .hd,.rme .hd{cursor:grab;color:#8f99ab;padding:0 4px 0 0;user-select:none;letter-spacing:-2px}
  .elr.drag,.rme.drag{opacity:.4}.elr.over,.rme.over{box-shadow:0 -3px 0 #f2b766}
  .mlist{display:flex;flex-direction:column;gap:4px}.mlist button{border:0;background:#1e242e;text-align:left;padding:12px 14px;border-radius:10px;font-weight:600}
  .mlist button:hover{background:#262e3a}.mlist button.warn{color:#f08a7c}
  .ed.playing .frame{box-shadow:0 0 0 3px #7fd6a4,0 30px 80px rgba(0,0,0,.6)}
  .autobox{padding:10px 12px;border-radius:10px;background:rgba(124,196,240,.08);border:1px solid rgba(124,196,240,.3);font-size:12.5px;color:#c4cad6;margin-bottom:10px}
  .elist{display:flex;flex-direction:column;gap:5px;margin-bottom:8px}
  .elr{display:flex;align-items:center;gap:4px;padding:8px 6px 8px 10px;border-radius:10px;background:#1e242e;border:1px solid transparent;cursor:pointer}
  .elr:hover{border-color:rgba(242,183,102,.5)}.elr .tx{flex:1;min-width:0}.elr b{display:block;font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .elr small{display:block;color:#8f99ab;font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .elr button{flex:none;border:0;background:none;color:#8f99ab;padding:3px 6px;border-radius:6px}.elr button:hover{background:#262e3a;color:#e9ecf2}.elr .go{color:#8f99ab;padding:0 4px}
  .addb{margin-right:6px;border-color:rgba(242,183,102,.5);color:#f2b766}
  .crumb{display:flex;align-items:center;gap:8px;margin-bottom:6px;font-size:13px;color:#8f99ab;min-width:0}.crumb span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .elnav{display:flex;gap:6px;flex-wrap:wrap;margin-top:14px}
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
  .stl{display:grid;grid-template-columns:1fr;gap:8px;margin-bottom:6px}
  .stc{display:grid;grid-template-columns:auto minmax(0,1fr);grid-template-rows:auto auto;column-gap:12px;align-items:center;text-align:left;padding:10px 12px;border-radius:14px;border:1px solid rgba(160,175,200,.18);background:#1e242e;color:inherit;cursor:pointer}
  .stc:hover{border-color:rgba(242,183,102,.6)}.stc.on{border-color:#f2b766;box-shadow:0 0 0 1px #f2b766 inset}
  .stc .sw{grid-row:1/3;width:54px;height:40px;border-radius:10px;display:flex;flex-direction:column;gap:3px;padding:5px;box-sizing:border-box}
  .stc .sw i{display:block;height:8px;border-radius:3px}
  .stc b{font-size:14px}.stc small{font-size:11.5px;color:#8f99ab;line-height:1.3}
  .stp-matterai .sw{background:#161b21}.stp-matterai .sw i{background:#1e242e;border:1px solid rgba(160,175,200,.2)}.stp-matterai .sw i:first-child{background:#f2b766}
  .stp-apple .sw{background:#000}.stp-apple .sw i{background:#1c1c1e;border-radius:6px}.stp-apple .sw i:first-child{background:#0a84ff}
  .stp-cristal .sw{background:linear-gradient(135deg,#2b5876,#4e4376 60%,#1d6b5f)}.stp-cristal .sw i{background:rgba(255,255,255,.28);border-radius:8px;border:1px solid rgba(255,255,255,.4)}
  .bgs{display:grid;grid-template-columns:repeat(auto-fill,minmax(62px,1fr));gap:8px;margin-bottom:6px}
  .bgs>button,.bgs>label{display:flex;flex-direction:column;align-items:center;gap:4px;padding:0;border:0;background:none;color:inherit;cursor:pointer;font:inherit}
  .bgs .bsw{position:relative;width:100%;aspect-ratio:3/4;border-radius:10px;border:2px solid rgba(160,175,200,.2);display:grid;place-items:center;font-size:18px;color:#8f99ab;overflow:hidden;box-sizing:border-box}
  .bgs .bsw.none{background:repeating-linear-gradient(45deg,#1e242e 0 6px,#262e3a 6px 12px)}.bgs .bsw.img{background:#1e242e}
  .bgs .on .bsw{border-color:#f2b766}.bgs small{font-size:10.5px;color:#8f99ab;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
  .bgs input[type=color]{position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer;border:0;padding:0}
  @media (max-width:1100px){.ed{grid-template-columns:230px minmax(0,1fr) 310px}.ed.nolist{grid-template-columns:0 minmax(0,1fr) 330px}}`;

  function open(panel, viewId, kind) { return new Editor(panel, viewId, kind).start(); }

  class Editor {
    constructor(panel, viewId, kind) {
      this.k0 = kind === 'tablet' || kind === 'phone' ? kind : null;
      this.p = panel; this.hass = panel._hass; this.viewId = viewId; this.sel = null; this.undo = []; this.redo = []; this.tab = 'cfg';
    }

    async start() {
      await loadScript(`${BASE}/vista.js?t=${Date.now()}`);
      this.ver = Date.now();
      const [lst, cfg] = await Promise.all([this.hass.callWS({ type: 'matterai/views/list' }), this.hass.callWS({ type: 'matterai/config' })]);
      const v = lst.views.find((x) => x.id === this.viewId);
      if (!v) { this.p._toast('Ese dashboard no existe'); return; }
      this.cfg = cfg.config || {};
      this.v = Editor.normalize(clone(v));
      this.K = this.k0 || v.kind || 'phone';
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
      this.wrap.innerHTML = `<style>${CSS}</style><div class="ed" id="ed"><div class="ed-top" id="edt"></div>
        <div class="ed-c" id="edc"><div class="fwrap" id="fwrap"><div class="frame" id="frame"></div></div><div class="ehint" id="ehint"></div></div>
        <aside class="dlg" id="dlg"><div class="dlg-h" id="dlgh"></div><div class="dlg-b" id="edr"></div><div class="dlg-f" id="dlgf"></div></aside></div><div class="toastE" id="toastE"></div>`;
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
        if (this.pcard) this.pcard.hass = h;
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
        if (this.dlgOpen()) return this.dlgCancel();
        if (typing) return undefined;
        return this.close();
      }
      if (mod && k === 's') { e.preventDefault(); if (this.dirty()) this.cmd('save'); return undefined; }
      if (typing) return undefined;
      const again = () => { if (this.pe) { if (this.zsel != null && !((this.v.plan || {}).zones || [])[this.zsel]) this.zsel = null; this.drawPlan(); } };
      if (mod && k === 'z' && !e.shiftKey) { e.preventDefault(); return this.cmd('undo').then(again); }
      if (mod && (k === 'y' || (k === 'z' && e.shiftKey))) { e.preventDefault(); return this.cmd('redo').then(again); }
      if (this.pe) return undefined;
      if (!this.sel || this.dlgOpen()) return undefined;
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
        this.change(() => { B.splice(i, 1); if (this.sel === id) { this.sel = null; this.el = null; this.roomEd = null; this.rdraft = null; } });
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
      const titled = ['frigate', 'rooms', 'scenes', 'routines', 'buttons', 'camera', 'music', 'lock', 'away', 'covers', 'lights', 'people', 'text'];
      const b = { id: this.newId(type), type, col: K === 'tablet' ? (col != null ? col : type === 'plan' ? 0 : 1) : 0, cfg };
      if (titled.includes(type)) b.title = type === 'frigate' ? 'Cámaras' : CAT[type].name;
      this.change(() => { this.blocks().push(b); this.sel = b.id; this.roomEd = null; this.rdraft = null; });
    }
    /** Catálogo de tarjetas (como «Agregar tarjeta» de Home Assistant), con buscador. */
    openCatalog(col) {
      this.closeCatalog();
      const CAT = window.MaeVista.CATALOG, K = this.K, ICO = { kpis: 'grid', featured: 'cam', rooms: 'home', scenes: 'spark', buttons: 'power', camera: 'cam', alarm: 'shield', away: 'car', routines: 'robot', music: 'music', lock: 'lock', plan: 'home', clock: 'sun',
        weather: 'cloud', climate: 'snow', covers: 'curt', lights: 'bulb', energy: 'bolt', sensor: 'temp', people: 'user', text: 'list', image: 'film', activity: 'list', frigate: 'cam' };
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
    /** Estilo prearmado y fondo del diseño: se elige tocando, como en una galería. */
    lookEditor() {
      const V = window.MaeVista || {}, L = this.lay(), st = L.style || 'matterai', bg = L.bg || { kind: 'none' };
      const SL = V.STYLE_LIST || [], GL = V.GRAD_LIST || [];
      return `<h4>Estilo</h4><div class="stl">${SL.map(([k, n, d]) => `<button class="stc stp-${k} ${st === k ? 'on' : ''}" data-stl="${k}"><span class="sw"><i></i><i></i><i></i></span><b>${esc(n)}</b><small>${esc(d)}</small></button>`).join('')}</div>
        <h4>Fondo</h4><div class="bgs">
          <button data-bgk="none" class="${bg.kind === 'none' ? 'on' : ''}" title="El del estilo"><span class="bsw none"></span><small>Del estilo</small></button>
          ${GL.map(([k, n, css]) => `<button data-bgg="${k}" class="${bg.kind === 'gradient' && bg.gradient === k ? 'on' : ''}" title="${esc(n)}"><span class="bsw" style="background:${esc(css)}"></span><small>${esc(n)}</small></button>`).join('')}
          <label class="bgc ${bg.kind === 'color' ? 'on' : ''}" title="Un color liso"><span class="bsw" style="background:${esc(bg.kind === 'color' && bg.color ? bg.color : '#1e242e')}"><input type="color" data-bgc value="${esc(bg.color || '#1e242e')}"></span><small>Color</small></label>
          <button data-bgi class="${bg.kind === 'image' ? 'on' : ''}" title="Una foto de la casa"><span class="bsw img">${bg.kind === 'image' ? '✓' : '+'}</span><small>Imagen</small></button>
          <input type="file" accept="image/*" data-bgf hidden></div>
        ${bg.kind === 'image' ? `<label class="fld"><span>Oscurecer la imagen (para que se lea bien)</span><input type="range" min="0" max="0.8" step="0.05" data-bgd value="${esc(String(bg.dim == null ? 0.35 : bg.dim))}"></label>` : ''}
        <p class="hint">«Del estilo» usa el fondo propio de cada estilo. Los fondos «(claro)» quedan mejor con el modo Claro.</p>`;
    }
    /** Lo que ve el motor: el dashboard con las tarjetas del tipo que se está editando. */
    viewFor() { const l = this.lay(); return Object.assign({}, this.v, { kind: this.K, blocks: l.blocks, orientation: l.orientation || null, header: l.header || null, dock: l.dock || null, theme: l.theme || null, style: l.style || null, bg: l.bg || null, layouts: undefined }); }
    model() { return this.card && this.card.model ? this.card.model() : null; }
    states() { return this.hass.states; }
    fname(id) { const s = this.states()[id]; return (s && s.attributes.friendly_name) || id; }
    toast(t) { const e = this.$('#toastE'); e.textContent = t; e.style.display = 'block'; clearTimeout(this.tt); this.tt = setTimeout(() => { e.style.display = 'none'; }, 2200); }
    dirty() { return JSON.stringify(this.v) !== JSON.stringify(this.saved); }
    push() { this.undo.push(JSON.stringify(this.v)); if (this.undo.length > 80) this.undo.shift(); this.redo = []; }
    change(fn) {
      this.push(); fn(); this.draw();
      if (!this.dlgOpen()) this.autosave();
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

    /** Se guarda solo un momento después del último cambio (los equipos lo ven al instante). */
    autosave() {
      if (!this.wrap) return; // en las pruebas no hay pantalla
      clearTimeout(this.saveT);
      this.saveT = setTimeout(() => { if (this.dirty() && !this.dlgOpen()) this.cmd('save', true); }, 700);
    }
    dlgOpen() { return !!(this.sel || this.zone); }
    /** Abre la ventana de una tarjeta (o de la parte de arriba / la barra): guarda cómo estaba para «Cancelar». */
    dlgStart() { if (!this.dlgSnap) { this.dlgSnap = JSON.stringify(this.v); this.dlgUndo = this.undo.length; this.tab = 'cfg'; } }
    dlgCancel() {
      if (this.dlgSnap) { this.v = JSON.parse(this.dlgSnap); this.undo.length = Math.min(this.undo.length, this.dlgUndo); }
      this.dlgClose();
    }
    async dlgOk() {
      if (this.rdraft && this.roomDirty()) await this.saveRoom(false);
      this.dlgClose();
      this.autosave();
    }
    dlgClose() {
      this.dlgSnap = null; this.sel = null; this.el = null; this.zone = null; this.pz = null; this.roomEd = null; this.rdraft = null; this.tab = 'cfg';
      this.draw();
    }
    /** Encabezado, pestañas y botones de la ventana (como el editor de tarjetas de Lovelace). */
    drawDlg() {
      const d = this.$ && this.$('#dlg'); if (!d) return;
      const open = this.dlgOpen();
      this.$('#ed').classList.toggle('dlgon', open);
      if (!open) { this.$('#dlgh').innerHTML = ''; this.$('#dlgf').innerHTML = ''; return; }
      const b = this.selBlock(), CAT = window.MaeVista.CATALOG;
      const title = this.zone === 'header' ? 'Parte de arriba' : this.zone === 'dock' ? 'Barra de abajo' : this.zone === 'dash' ? 'Estilo y fondo' : this.zone === 'allb' ? 'Botón «Toda la casa»'
        : b ? `${(CAT[b.type] || {}).name || b.type}${b.title && b.title !== (CAT[b.type] || {}).name ? ` · ${b.title}` : ''}` : '';
      const sub = this.roomEd != null || this.el != null || this.pz != null;
      const tabs = b && !sub ? `<div class="tabs">${[['cfg', 'Configuración'], ['vis', 'Visibilidad'], ['lay', 'Diseño']].map(([k, l]) => `<button data-tab="${k}" class="${this.tab === k ? 'on' : ''}">${l}</button>`).join('')}</div>` : '';
      this.$('#dlgh').innerHTML = `<div class="dlg-t"><b>${b ? 'Editar tarjeta' : 'Editar'}</b><small>${esc(title)}</small></div><button class="eb ico" data-dx="cancel" title="Cerrar sin guardar (Esc)">✕</button>${tabs}`;
      this.$('#dlgf').innerHTML = `${b ? '<button class="eb warn" data-dx="del">Borrar</button>' : ''}<span class="sp"></span><button class="eb" data-dx="cancel">Cancelar</button><button class="eb pri" data-dx="ok">Guardar</button>`;
    }

    /* ───────── dibujo ───────── */
    draw() {
      const v = this.v, K = this.K, ori = this.lay().orientation || 'landscape', dirty = this.dirty();
      const other = K === 'tablet' ? 'phone' : 'tablet', hasOther = !!(((v.layouts || {})[other] || {}).blocks || []).length;
      this.$('#edt').innerHTML = `<button class="eb" data-e="close" title="Volver">← Volver</button><h2>${esc(v.name)}</h2>
          <span class="eseg" title="Un mismo dashboard tiene su diseño para el celular y para la tablet">${[['phone', 'Celular'], ['tablet', 'Tablet']].map(([k, l]) => `<button data-kind="${k}" class="${K === k ? 'on' : ''}">${l}</button>`).join('')}</span>
          ${K === 'tablet' ? `<span class="eseg">${[['landscape', 'Horizontal'], ['portrait', 'Vertical']].map(([k, l]) => `<button data-ori="${k}" class="${ori === k ? 'on' : ''}">${l}</button>`).join('')}</span>` : ''}
          <span class="eseg" title="Modo de día o de noche de este diseño (el cliente también lo puede cambiar en Opciones)">${[['dark', '☾ Oscuro'], ['light', '☀ Claro'], ['auto', 'Auto']].map(([k, l]) => `<button data-theme="${k}" class="${(this.lay().theme || 'dark') === k ? 'on' : ''}">${l}</button>`).join('')}</span>
          <button class="eb" data-e="dash" title="Estilo, fondo, modo y nombre de este diseño">🎨 Estilo</button>
          <button class="eb ${this.playing ? 'pri' : ''}" data-e="play" title="${this.playing ? 'Volver a editar' : 'Usar la pantalla como en el celular (prender luces, cambiar de cámara, entrar a un ambiente)'}">${this.playing ? '✎ Editar' : '▶ Probar'}</button>
          <button class="eb pri2" data-e="add" title="Agregar una tarjeta" ${this.playing ? 'disabled' : ''}>+ Tarjeta</button><button class="eb" data-e="plan">Plano e imágenes</button>
          <span class="emenu"><button class="eb ${Object.values(this.sim || {}).some(Boolean) ? 'pri2' : ''}" data-e="simm" title="Ver cómo queda en otras situaciones (no toca la casa)">Simular${Object.values(this.sim || {}).filter(Boolean).length ? ` (${Object.values(this.sim || {}).filter(Boolean).length})` : ''} ▾</button>${this.simOpen ? `<span class="emenu-l" style="left:0;right:auto">
            ${[['night', 'De noche'], ['alarm', 'Alarma disparada'], ['music', 'Música sonando'], ['gate', 'Portón abierto']].map(([k, l]) => `<button data-sim="${k}">${(this.sim || {})[k] ? '✓ ' : ''}${l}</button>`).join('')}</span>` : ''}</span>
          <span class="sp"></span>
          <button class="eb ico" data-e="undo" ${this.undo.length ? '' : 'disabled'} title="Deshacer (Ctrl+Z)">↶</button><button class="eb ico" data-e="redo" ${this.redo.length ? '' : 'disabled'} title="Rehacer (Ctrl+Y)">↷</button>
          <span class="emenu"><button class="eb" data-e="more" title="Más opciones">Más ▾</button>${this.moreOpen ? `<span class="emenu-l">
            <button data-e="pre">Volver al prearmado</button>${hasOther ? `<button data-e="copy">Copiar el diseño ${other === 'tablet' ? 'de la tablet' : 'del celular'}</button>` : ''}
            <button data-e="history">Historial de versiones…</button>
            <button data-e="export">Exportar como plantilla (archivo)</button><button data-e="import">Importar una plantilla…</button>
            </span>` : ''}</span>
          <span class="saved ${dirty ? 'dirty' : ''}">${this.saving ? 'Guardando…' : dirty ? (this.dlgOpen() ? 'Editando…' : 'Guardando…') : '✓ Guardado'}</span>
          <button class="eb pri" data-e="close" title="Terminar de editar">Listo</button>`;
      const hint = this.$('#ehint');
      this.$('#ed').classList.toggle('playing', !!this.playing);
      if (hint && this.playing) hint.innerHTML = 'Modo prueba: usalo como en el celular (luces, cámaras, ambientes). Los equipos se mueven de verdad. <b>✎ Editar</b> vuelve al editor.';
      else if (hint) hint.innerHTML = this.dlgOpen() ? '' : 'Tocá una tarjeta para editarla · Arrastrala para moverla · <b>+ Agregar tarjeta</b> al final de cada columna · Tocá arriba o la barra de abajo para cambiarlas';
      this.drawPreview(); this.drawProps(); this.drawDlg(); this.bind();
    }
    blocks() { const l = this.lay(); return l.blocks || (l.blocks = []); }
    drawList() {
      if (!this.$('#edl')) return; // ya no hay lista a la izquierda: se edita en la pantalla (como Lovelace)
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
      const ctx = () => ({ kind: this.K, orientation: this.lay().orientation || 'landscape', edit: this.playing ? null : this.editCtx(), sim: this.sim || null });
      if (this.vista && this.ifr && this.ifr.isConnected) { this.vista.setCtx(ctx()); this.vista.setView(this.viewFor()); this.previewRoom(); return; }
      if (!this.card) { fr.innerHTML = '<p style="padding:20px;color:#8f99ab">La vista previa necesita la tarjeta MatterAI (recargá la página).</p>'; return; }
      fr.innerHTML = '';
      const ifr = this.ifr = document.createElement('iframe');
      ifr.title = 'Vista previa';
      ifr.srcdoc = `<!doctype html><html lang="es" class="mae-ed"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Red+Hat+Display:wght@400;500;600;700&family=Red+Hat+Mono:wght@400;500&display=swap">
        <link rel="stylesheet" href="${BASE}/vista.css?t=${this.ver}"><style>html,body{margin:0;background:#161b21}</style></head>
        <body><div id="pv"></div><script src="${BASE}/matterai-home-card.js?t=${this.ver}"><\/script><script src="${BASE}/vista.js?t=${this.ver}"><\/script></body></html>`;
      ifr.onload = () => {
        const W = ifr.contentWindow;
        if (!W || !W.MaeVista) { this.toast('No se pudo cargar la vista previa'); return; }
        // la tarjeta de la app adentro de la pantalla (sin dibujarse): ambientes, clima, luces… se abren como en el celular
        const PC = W.customElements && W.customElements.get('matterai-home-card');
        this.pcard = null;
        if (PC) {
          try {
            const pc = W.document.createElement('matterai-home-card');
            pc.setAttribute('headless', ''); pc.setAttribute('theme', 'sobrio');
            pc.setConfig(Object.assign({}, this.cfg, { camera_inline: false }));
            W.document.body.appendChild(pc);
            pc.hass = this.p._hass || this.hass;
            pc.addEventListener('matterai-model', () => { if (this.vista) this.vista.render(); });
            this.pcard = pc;
          } catch (e) { this.pcard = null; }
        }
        this.vista = W.MaeVista.create(W.document.getElementById('pv'), Object.assign({
          card: this.pcard || this.card, hass: () => this.p._hass || this.hass, base: () => '', toast: () => {}, openEntity() {}, openMenu() {},
          sign: async (path) => (await this.hass.callWS({ type: 'auth/sign_path', path, expires: 7200 })).path,
        }, ctx()));
        this.vista.setView(this.viewFor());
        this.previewRoom();
      };
      fr.appendChild(ifr);
      void size;
    }
    /** Lo que la vista previa puede hacer en el editor: elegir, la barra de la tarjeta, arrastrar y agregar. */
    editCtx() {
      const R = this.rdraft;
      return { selected: this.sel, el: this.el != null ? this.el : null, zone: this.zone || null, pz: this.pz != null ? this.pz : null,
        onPin: (i, pos) => this.change(() => { const z = ((this.v.plan || {}).zones || [])[i]; if (z) { z.pin = pos; this.pz = i; } }), onSelect: (x, sub) => this.pick(x, sub), onAction: (id, a) => (a === 'edit' ? this.pick(id) : a === 'menu' ? this.cardMenu(id) : this.blockAct(id, a)),
        onElem: (id, a, i) => this.onElem(id, a, i),
        onMove: (from, where) => this.moveTo(from, where), onAdd: (col) => this.openCatalog(col), onRoom: (a, i) => this.roomAct(a, i),
        room: R && !this.pcard ? { name: R.name, icon: R.icon, entities: R.entities || [], dirty: this.roomDirty() } : null };
    }
    /** Tocar algo en la pantalla del medio: la tarjeta, y si fue un ambiente, se abre por dentro para editarlo. */
    pick(id, sub) {
      id = id || null;
      if (!id && !(sub && sub.zone)) { if (this.dlgOpen()) this.dlgOk(); return; }
      if (this.dlgOpen() && (id !== this.sel || ((sub && sub.zone) || null) !== (this.zone || null))) { this.dlgSnap = null; this.autosaveAfter = true; } // otra tarjeta: la anterior queda
      this.dlgStart(); if (!sub || (sub.el == null && !sub.room && sub.pz == null)) this.tab = this.tab || 'cfg';
      if (id !== this.sel || !(sub && sub.room)) { this.roomEd = null; this.rdraft = null; }
      this.sel = id; this.focus = sub && sub.item != null ? sub.item : null;
      this.el = sub && sub.el != null ? sub.el : null;
      this.zone = sub && sub.zone ? sub.zone : null;
      this.pz = sub && sub.pz != null ? sub.pz : null;
      // tocar algo de adentro de una tarjeta automática la arma a mano con lo mismo que se ve (para poder editarlo)
      const bb = this.selBlock();
      if (bb && this.el != null && this.el !== 'cam' && this.isAuto(bb)) { this.push(); this.materialize(bb); }
      if (sub && sub.room) {
        const r = (this.model() || { byId: {} }).byId[sub.room];
        if (r) { this.roomEd = r.name; this.rdraft = null; this.ensureDraft(); }
      }
      this.drawList(); this.drawProps(); this.drawDlg(); this.syncPreview(); this.bind();
      if (this.$ && this.$('#ed')) this.draw();
      if (this.autosaveAfter) { this.autosaveAfter = false; if (this.dirty()) this.cmd('save', true); }
    }
    /** ⋮ de una tarjeta: editar, duplicar, copiar a otro dashboard, columna y borrar. */
    cardMenu(id) {
      const b = this.blocks().find((x) => x.id === id); if (!b) return;
      const K = this.K, CAT = window.MaeVista.CATALOG;
      this.modal(`${(CAT[b.type] || {}).name || b.type}${b.title ? ` · ${b.title}` : ''}`, `<div class="mlist">
        <button data-cm="edit">✎ Editar</button><button data-cm="dup">⧉ Duplicar</button><button data-cm="copy">↗ Copiar a otro dashboard…</button>
        ${K === 'tablet' ? [[0, 'columna del plano'], [1, 'columna 1'], [2, 'columna 2']].filter(([c]) => c !== (b.col || 0)).map(([c, l]) => `<button data-cm="col" data-c="${c}">⇄ Pasar a la ${l}</button>`).join('') : ''}
        <button data-cm="del" class="warn">✕ Borrar la tarjeta</button></div>`, (e) => {
        const x = e.target.closest('[data-cm]'); if (!x) return;
        this.closeCatalog();
        const k = x.dataset.cm;
        if (k === 'edit') this.pick(id);
        else if (k === 'copy') this.copyTo(b);
        else if (k === 'col') this.change(() => { b.col = +x.dataset.c; });
        else this.blockAct(id, k);
      });
    }
    syncPreview() { if (this.vista) this.vista.setCtx({ edit: this.playing ? null : this.editCtx() }); if (!this.playing) this.previewRoom(); }
    /** El ambiente que se edita se ve abierto en la pantalla, como lo ve el cliente (la ventana de la app), con los
     *  cambios que se van haciendo (todavía sin guardar en la casa). */
    previewRoom() {
      const pc = this.pcard; if (!pc || typeof pc.openRoom !== 'function') return;
      const R = this.rdraft;
      if (!R) {
        if (this.pcRoomOn) { this.pcRoomOn = false; try { pc._closeRoom(); pc.setConfig(Object.assign({}, this.cfg, { camera_inline: false })); pc.hass = this.p._hass || this.hass; } catch (_) { /* nada */ } }
        return;
      }
      const list = clone(this.roomsCfg()), i = R._orig != null ? list.findIndex((x) => x.name === R._orig) : -1;
      const d = clone(R); delete d._orig;
      if (i >= 0) list[i] = Object.assign({}, list[i], d); else list.push(d);
      const sig = JSON.stringify(d);
      try {
        if (sig !== this.pcRoomSig) { this.pcRoomSig = sig; pc.setConfig(Object.assign({}, this.cfg, { rooms: list, camera_inline: false })); pc.hass = this.p._hass || this.hass; }
        const m = pc.model && pc.model(), r = m && m.rooms.find((x) => x.name === d.name);
        if (r && (pc._room !== r.id || !this.pcRoomOn)) { pc.openRoom(r.id); }
        this.pcRoomOn = true;
      } catch (_) { /* si algo falla, queda la pantalla como estaba */ }
    }
    roomDirty() {
      const R = this.rdraft; if (!R) return false;
      if (R._orig == null) return true;
      const o = this.roomsCfg().find((x) => x.name === R._orig) || {};
      return JSON.stringify([o.name, o.icon || '', o.entities || []]) !== JSON.stringify([R.name, R.icon || '', R.entities || []]);
    }
    ensureDraft() {
      if (this.rdraft) return this.rdraft;
      const list = this.roomsCfg(), i = list.findIndex((x) => x.name === this.roomEd);
      this.rdraft = i >= 0 ? clone(list[i]) : { name: this.roomEd || 'Ambiente nuevo', entities: [] };
      this.rdraft._orig = i >= 0 ? list[i].name : null;
      return this.rdraft;
    }
    /** Lo que se hace desde el ambiente abierto en la pantalla del medio. */
    roomAct(a, i) {
      const R = this.rdraft; if (!R) return;
      const L = R.entities = R.entities || [];
      const redraw = () => { this.drawProps(); this.syncPreview(); this.bind(); };
      if (a === 'close') { this.roomEd = null; this.rdraft = null; return redraw(); }
      if (a === 'move' && i && typeof i === 'object') { this.reorder('room', i.from, i.to); return undefined; }
      if (a === 'save') return this.saveRoom(false);
      if (a === 'del') { L.splice(i, 1); return redraw(); }
      if (a === 'up' || a === 'down') { const j = i + (a === 'up' ? -1 : 1); if (j < 0 || j >= L.length) return undefined; [L[i], L[j]] = [L[j], L[i]]; return redraw(); }
      if (a === 'add') {
        return this.openCB(null, ROOM_DOMAINS, (id) => {
          if (!id) return;
          if (L.some((y) => (y && y.entity) === id || y === id)) { this.toast('Ya está en este ambiente'); return; }
          L.push(id); redraw();
        }, false);
      }
      return undefined;
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
      const H = Math.min(420, innerHeight - 20);
      if (anchor) {
        const r = anchor.getBoundingClientRect();
        box.style.left = `${Math.max(10, Math.min(r.left, innerWidth - 370))}px`;
        box.style.top = `${r.bottom + 6 + H > innerHeight ? Math.max(10, r.top - H - 6) : r.bottom + 6}px`;
      } else { // pedido desde la pantalla del medio: en el centro
        box.style.left = `${Math.max(10, (innerWidth - 360) / 2)}px`; box.style.top = `${Math.max(10, (innerHeight - H) / 3)}px`;
      }
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
      this.cbOut = (e) => { if (!e.composedPath().includes(box) && !(anchor && e.composedPath().includes(anchor))) this.closeCB(); };
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
      return `<h4>${esc(opts.title)}</h4>${items.map((it, i) => `<div class="it ${this.focus === i ? 'focus' : ''}"><div class="row"><b>${esc(it.name || (it.kind ? (KPI_KINDS.find((k) => k[0] === it.kind) || [, it.kind])[1] : '') || this.fname(it.entity) || 'Elemento ' + (i + 1))}</b>
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
      // las elegidas se ordenan arrastrando (⋮⋮) y se sacan con ✕; abajo, la lista para sumar o sacar
      return `<h4>${esc(label)}</h4><div class="elist">${(chosen || []).map((x, i) => `<div class="elr" draggable="true" data-sr="m:${key}" data-i="${i}"><span class="hd" title="Arrastrar para ordenar">⋮⋮</span><span class="tx"><b>${esc(options.find((o) => o[0] === x) ? options.find((o) => o[0] === x)[1] : x)}</b></span><button data-mdel="${key}" data-i="${i}" title="Sacar">✕</button></div>`).join('')}</div>
        <div class="ml">${options.map(([v, l]) => `<label><input type="checkbox" data-mk="${key}" value="${esc(v)}" ${set.has(v) ? 'checked' : ''}> ${esc(l)}</label>`).join('')}</div>`;
    }
    drawProps() {
      const b = this.blocks().find((x) => x.id === this.sel);
      const r = this.$('#edr');
      this.drawDlg(); // título, pestañas y botones de la ventana (al volver de un elemento o un ambiente también)
      if (!b && this.zone === 'header') { r.innerHTML = this.headerEditor(); return; }
      if (!b && this.zone === 'dock') { r.innerHTML = this.dockEditor(); return; }
      if (!b && this.zone === 'allb') {
        const H = this.lay().header || {};
        r.innerHTML = `<h4>Botón «Toda la casa»</h4><label class="chk"><input type="checkbox" data-hd="casa" ${H.casa !== false ? 'checked' : ''}> Mostrarlo (abre todos los ambientes de la casa)</label>
          <p class="hint">Va al final del inicio del celular. Si lo sacás, los ambientes siguen en la barra de abajo con el botón «Casa» (si lo agregás).</p>`;
        return;
      }
      if (!b && this.zone === 'dash') {
        r.innerHTML = `${this.lookEditor()}<h4>Dashboard</h4><label class="fld"><span>Nombre</span><input data-v="name" value="${esc(this.v.name)}" maxlength="40"></label>
          <label class="fld"><span>Modo de ${this.K === 'tablet' ? 'la tablet' : 'el celular'}</span><select data-lt="theme">${[['', 'Oscuro'], ['light', 'Claro'], ['auto', 'Automático (como el modo claro u oscuro del equipo)']]
            .map(([k, l]) => `<option value="${k}" ${(this.lay().theme || '') === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
          <p class="hint">Cada diseño (celular y tablet) tiene su estilo, su fondo y su modo. El cliente lo puede cambiar en la app: Opciones → Pantalla → Modo de día o de noche.</p>
          <p class="hint">«Simular → De noche» (arriba) es otra cosa: muestra cómo se ve el plano y las tarjetas que dependen de la hora, sin cambiar el modo.</p>`;
        return;
      }
      if (b && b.type === 'plan' && this.pz != null) { r.innerHTML = this.zoneEditor(this.pz); return; }
      if (!b) {
        if (r.closest && r.closest('.dlg') && !this.$('#edl')) { r.innerHTML = ''; return; } // sin tarjeta elegida: la ventana está cerrada
        r.innerHTML = `<div class="guide"><b>Cómo se edita</b><ol>
            <li><b style="display:inline">Tocá cualquier cosa</b> en la pantalla del medio: una tarjeta, un ambiente, un dato del resumen o un botón. Acá aparece para editarla.</li>
            <li>Tocá un <b style="display:inline">ambiente</b> para abrirlo por dentro: ordená, sacá o agregá sus equipos.</li>
            <li>Tocá <b style="display:inline">la parte de arriba</b> (hora, clima…) o <b style="display:inline">la barra de abajo</b> para elegir qué muestran.</li>
            <li>En el <b style="display:inline">plano</b>, tocá un ambiente para elegir sus luces y arrastrá su cartel para ubicarlo.</li>
            <li>Arrastrá las tarjetas para moverlas. Con <b style="display:inline">+ Agregar tarjeta</b> sumás una nueva.</li>
            <li><b style="display:inline">Guardar</b> (arriba a la derecha) se lo manda a los equipos al instante.</li></ol></div>
          <h4>Dashboard</h4><label class="fld"><span>Nombre</span><input data-v="name" value="${esc(this.v.name)}"></label>
          <label class="fld"><span>Tema ${this.K === 'tablet' ? 'de la tablet' : 'del celular'}</span><select data-lt="theme">${[['', 'Oscuro (grafito)'], ['light', 'Claro'], ['auto', 'Automático (igual que el modo claro u oscuro del equipo)']]
            .map(([k, l]) => `<option value="${k}" ${(this.lay().theme || '') === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
          <p class="hint">Estás editando el diseño para <b>${this.K === 'tablet' ? 'la tablet' : 'el celular'}</b>. Cambiá arriba entre Celular y Tablet: cada uno tiene el suyo, y los dos se guardan juntos.</p>`;
        return;
      }
      b.cfg = b.cfg || {};
      const c = b.cfg, CAT = window.MaeVista.CATALOG, m = this.model();
      const S = this.states(), opts = (doms) => Object.keys(S).filter((e) => doms.includes(e.split('.')[0])).sort().map((e) => [e, this.fname(e)]);
      if (this.el != null && b.type !== 'rooms') { r.innerHTML = this.elemEditor(b, this.el, opts); return; }
      let h = `<h4>${esc((CAT[b.type] || {}).name || b.type)}</h4><label class="fld"><span>Título (vacío: sin título)</span><input data-f="title" value="${esc(b.title || '')}"></label>`;
      const autoChk = (txt) => `<label class="chk"><input type="checkbox" data-fb="cfg.auto" ${c.auto ? 'checked' : ''}> ${txt}</label>`;
      switch (b.type) {
        case 'kpis': h += this.elemSection(b); break;
        case 'featured': case 'camera': case 'frigate':
          h += this.camFields(b, opts);
          if (b.type === 'camera') h += this.elemSection(b);
          break;
        case 'rooms':
          h += `<label class="fld"><span>Cómo se ve</span><select data-f="cfg.style"><option value="list" ${c.style !== 'grid' ? 'selected' : ''}>Lista</option><option value="grid" ${c.style === 'grid' ? 'selected' : ''}>Grilla</option></select></label>`;
          if (this.roomEd != null) { r.innerHTML = this.roomEditor(); return; }
          h += this.elemSection(b);
          h += '<p class="hint">Cada persona también puede fijar o sacar ambientes desde su celular (mantener apretado).</p>';
          break;
        case 'scenes': h += this.elemSection(b); break;
        case 'routines':
          h += `<label class="fld"><span>Cómo se ve</span><select data-f="cfg.style"><option value="">Un botón que abre todas las rutinas</option><option value="list" ${c.style === 'list' ? 'selected' : ''}>Lista en la pantalla (las primeras 4)</option></select></label>`;
          h += this.elemSection(b); break;
        case 'buttons':
          h += `<label class="fld"><span>Cómo se ve</span><select data-f="cfg.style"><option value="grid" ${c.style !== 'list' ? 'selected' : ''}>Grilla</option><option value="list" ${c.style === 'list' ? 'selected' : ''}>Lista</option></select></label>`;
          h += this.elemSection(b); break;
        case 'alarm': h += this.ent('Alarma (vacío: la de la casa)', 'al', c.entity, PICK.alarm, 'cfg.entity'); break;
        case 'away': h += this.ent('Interruptor, escena o script', 'aw', c.entity, PICK.away, 'cfg.entity'); break;
        case 'lock': h += this.ent('Cerradura', 'lk', c.entity, PICK.lock, 'cfg.entity'); break;
        case 'plan': h += '<p class="hint">El plano se arma en «Plano e imágenes» (arriba): subís el render y dibujás los ambientes.</p><button class="eb" data-e="plan">Editar el plano</button>'; break;
        case 'weather': h += this.ent('Clima (vacío: el de la casa)', 'wx', c.entity, ['weather'], 'cfg.entity') + this.action(c.tap, 'cfg.tap', 'Al tocar (vacío: abre el pronóstico)'); break;
        case 'climate': h += this.ent('Aire o termostato', 'cl', c.entity, ['climate'], 'cfg.entity'); break;
        case 'covers': case 'lights': h += this.elemSection(b); break;
        case 'energy': h += this.ent('Sensor de consumo (vacío: el de la casa)', 'en', c.entity, ['sensor'], 'cfg.entity'); break;
        case 'sensor':
          h += this.ent('Sensor', 'se', c.entity, ['sensor', 'input_number', 'number'], 'cfg.entity');
          h += `<div style="display:flex;gap:8px"><label class="fld"><span>Mínimo</span><input type="number" data-f="cfg.min" value="${esc(c.min != null ? c.min : '')}" placeholder="0"></label>
            <label class="fld"><span>Máximo</span><input type="number" data-f="cfg.max" value="${esc(c.max != null ? c.max : '')}" placeholder="100"></label></div>`;
          break;
        case 'people': h += '<p class="hint">Muestra las personas de la casa, con quién está y quién no.</p>'; break;
        case 'activity':
          h += `<label class="fld"><span>De qué</span><select data-actroom><option value="">Toda la casa</option>${(m ? m.rooms : []).map((x) => `<option ${(c.rooms || [])[0] === x.name ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label>
            <p class="hint">Abre la Actividad con filtros por día, tipo, ambiente y un buscador de equipos. Tocar un evento muestra el historial de ese equipo (como en Home Assistant).</p>`;
          break;
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
      let lay = '<h4>Diseño</h4>';
      if (this.K === 'tablet') lay += `<label class="fld"><span>Columna</span><select data-f="col">${[[0, 'Del plano'], [1, 'Columna 1'], [2, 'Columna 2']].map(([k, l]) => `<option value="${k}" ${(b.col || 0) === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>`;
      lay += `<label class="fld"><span>Ancho</span><select data-f="size"><option value="">Completo</option><option value="half" ${b.size === 'half' ? 'selected' : ''}>Media columna (van de a dos)</option></select></label>
        <p class="hint">Para moverla, arrastrala en la pantalla. Con ⋮ (en la tarjeta) se duplica, se copia a otro dashboard o se borra.</p>`;
      const tab = this.$('#edl') ? 'all' : (this.tab || 'cfg');
      r.innerHTML = tab === 'vis' ? this.condEditor(b) : tab === 'lay' ? lay : tab === 'all' ? h + lay + this.condEditor(b) : h;
      const ip = r.querySelector('[data-imgprev]'); if (ip) this.signed(ip.dataset.imgprev).then((u) => { ip.src = u; }).catch(() => {});
    }
    /* ───────── elementos de adentro de las tarjetas (como las filas de la tarjeta de entidades de Home Assistant) ───────── */
    /** ¿La tarjeta muestra lo que elige la app sola? (todavía no está armada a mano) */
    isAuto(b) {
      const c = b.cfg || {};
      if (b.type === 'rooms') return !(c.rooms && c.rooms.length);
      if (['kpis', 'scenes', 'routines', 'covers', 'lights'].includes(b.type)) return !!c.auto || !((c.items && c.items.length) || (c.entities && c.entities.length));
      return false;
    }
    /** Automática → armada a mano con lo mismo que se está viendo (nada cambia en la pantalla). */
    materialize(b) {
      const c = b.cfg = b.cfg || {};
      const shown = this.vista && this.vista.shown ? this.vista.shown(b.id) : null;
      if (b.type === 'rooms') { if (!(c.rooms && c.rooms.length)) c.rooms = (shown || (this.model() || { rooms: [] }).rooms.slice(0, 4).map((x) => x.name)).slice(0, 24); c.auto = false; return; }
      if (b.type === 'kpis') { if (c.auto || !(c.items && c.items.length)) { c.auto = false; c.items = null; this.fromAuto(b); if (shown && shown.length) c.items = clone(shown); } c.auto = false; return; }
      if (!['scenes', 'routines', 'covers', 'lights'].includes(b.type)) return;
      if (!(c.items && c.items.length) || c.auto) {
        const base = !c.auto && c.entities && c.entities.length ? c.entities.map((e) => ({ entity: e })) : (shown || []);
        c.items = base.slice(0, 24).map((x) => Object.assign({ entity: x.entity }, x.name ? { name: x.name } : {}, x.icon ? { icon: x.icon } : {}, x.mode ? { mode: x.mode } : {}));
      }
      delete c.entities; delete c.rooms; c.auto = false;
    }
    /** La lista de elementos de la tarjeta (la de verdad, para cambiarla). */
    elemList(b) {
      const c = b.cfg = b.cfg || {};
      if (b.type === 'rooms') return (c.rooms = c.rooms || []);
      return (c.items = c.items || []);
    }
    elemLabel(b, x) {
      if (b.type === 'rooms') return String(x);
      if (!x) return '';
      if (b.type === 'kpis') return x.name || (x.kind === 'entity' ? this.fname(x.entity) : ((KPI_KINDS.find((k) => k[0] === x.kind) || [, x.kind])[1]));
      return x.name || (x.entity ? this.fname(x.entity) : 'Botón');
    }
    /** Ordenar arrastrando una fila: de la posición «from» a la de «to». */
    reorder(g, from, to) {
      if (from === to) return;
      const mv = (L) => { if (!L || from < 0 || from >= L.length || to < 0 || to >= L.length) return; const [x] = L.splice(from, 1); L.splice(to, 0, x); };
      if (g === 'room') { if (this.rdraft) { mv(this.rdraft.entities); this.drawProps(); this.syncPreview(); this.bind(); } return; }
      if (g.startsWith('m:')) { const b0 = this.selBlock(); if (b0) this.change(() => mv((b0.cfg || {})[g.slice(2)])); return; }
      if (g === 'dock') { this.change(() => { const D = this.dockKeys(); mv(D); this.lay().dock = D; }); return; }
      const b = this.selBlock(); if (!b) return;
      this.change(() => { this.materialize(b); mv(this.elemList(b)); if (this.el === from) this.el = to; });
    }
    /** Subir, bajar, sacar o agregar un elemento (desde la pantalla del medio o desde el panel). */
    onElem(id, act, i) {
      if (this.sel !== id) { this.sel = id; this.roomEd = null; this.rdraft = null; }
      const b = this.selBlock(); if (!b) return;
      if (act === 'add' && b.type === 'plan') { this.planEditor().then(() => { this.drawing = []; this.zsel = null; return this.drawPlan(); }); return; }
      if (act === 'add') { this.elemAdd(b); return; }
      if (act === 'move' && i && typeof i === 'object') { this.change(() => { this.materialize(b); const L = this.elemList(b); if (i.from < L.length && i.to < L.length) { const [x] = L.splice(i.from, 1); L.splice(i.to, 0, x); } }); return; }
      if (i == null || i === 'cam') return;
      this.change(() => {
        this.materialize(b);
        const L = this.elemList(b);
        if (act === 'up' || act === 'down') { const j = i + (act === 'up' ? -1 : 1); if (j < 0 || j >= L.length) return; [L[i], L[j]] = [L[j], L[i]]; this.el = j; }
        if (act === 'del') { L.splice(i, 1); this.el = null; this.roomEd = null; this.rdraft = null; }
      });
    }
    /** «+ Agregar …» de cada tarjeta: el buscador con lo que tiene sentido para esa tarjeta. */
    elemAdd(b) {
      const E = ELEM[b.type]; if (!E) return;
      const addItem = (it) => this.change(() => { this.materialize(b); const L = this.elemList(b); L.push(it); this.el = L.length - 1; });
      if (b.type === 'kpis') return addItem({ kind: 'lights' });
      if (b.type === 'buttons' || b.type === 'camera') return addItem({ tap: { type: 'toggle' } });
      if (b.type === 'rooms') return this.roomAddDlg(b);
      return this.openCB(null, E[2], (eid) => {
        if (!eid) return;
        const L = (b.cfg.items || []);
        if (!this.isAuto(b) && L.some((x) => x && x.entity === eid)) { this.toast('Ya está en esta tarjeta'); return; }
        addItem({ entity: eid });
      }, false);
    }
    roomAddDlg(b) {
      const m = this.model() || { rooms: [] }, cur = new Set(this.isAuto(b) ? ((this.vista && this.vista.shown && this.vista.shown(b.id)) || []) : (b.cfg.rooms || []));
      const free = m.rooms.filter((x) => !cur.has(x.name));
      this.modal('Agregar un ambiente', `<div class="hlist">${free.map((x) => `<div class="hrow"><span><b>${esc(x.name)}</b><small>${x.count || 0} equipos</small></span><button class="eb sm" data-ra="${esc(x.name)}">Agregar</button></div>`).join('') || '<p class="hint">Todos los ambientes de la casa ya están en esta tarjeta.</p>'}
        <div class="hrow"><span><b>Ambiente nuevo</b><small>Lo creás y elegís sus equipos</small></span><button class="eb sm" data-ra="">Crear</button></div></div>`, (e) => {
        const ra = e.target.closest('[data-ra]'); if (!ra) return;
        this.closeCatalog();
        if (!ra.dataset.ra) { this.roomEd = ''; this.rdraft = null; this.el = null; this.ensureDraft(); this.newRoomFor = b.id; this.drawProps(); this.syncPreview(); this.bind(); return; }
        this.change(() => { this.materialize(b); const L = this.elemList(b); L.push(ra.dataset.ra); this.el = L.length - 1; });
      });
    }
    /** Panel de la tarjeta: su lista de elementos (como el editor de la tarjeta de entidades). */
    elemSection(b) {
      const E = ELEM[b.type]; if (!E || !E[0]) return '';
      const auto = this.isAuto(b);
      const L = auto ? ((this.vista && this.vista.shown && this.vista.shown(b.id)) || []) : this.elemList(b);
      const m = this.model();
      const sub = (x) => {
        if (b.type === 'rooms') { const r = m && m.rooms.find((y) => y.name === x); return r ? `${r.count || 0} equipos` : 'no existe en la casa'; }
        if (x && x.entity) return `${x.entity}${this.states()[x.entity] ? '' : ' · no existe'}`;
        if (b.type === 'kpis') return 'dato del resumen';
        return x && x.tap ? (ACTION_TYPES.find((a) => a[0] === x.tap.type) || [, ''])[1] : '';
      };
      return `<h4>${esc(E[1])}</h4>
        ${auto ? '<div class="autobox"><b>Automático:</b> la app elige qué mostrar según la casa. Tocá cualquiera (acá o en la pantalla) y queda armada a mano para cambiarla.</div>' : ''}
        <div class="elist">${L.map((x, i) => `<div class="elr" draggable="true" data-sr="el" data-i="${i}" data-elpick="${i}"><span class="hd" title="Arrastrar para ordenar">⋮⋮</span><span class="tx"><b>${esc(this.elemLabel(b, x))}</b><small>${esc(sub(x))}</small></span>
          <button data-elpick2="${i}" title="Editar">✎</button><button data-elact2="del" data-i="${i}" title="Sacar">✕</button></div>`).join('') || `<p class="hint">Todavía no hay ${esc(E[1].toLowerCase())}.</p>`}</div>
        <button class="eb sm addb" data-eladd2>+ Agregar ${esc(E[0])}</button>
        ${!auto && ['kpis', 'scenes', 'routines', 'covers', 'lights', 'rooms'].includes(b.type) ? '<button class="eb sm" data-toauto title="Que la app vuelva a elegir sola">Volver a automático</button>' : ''}`;
    }
    /** Campos de la cámara (la cámara principal, el botón grande y las demás cámaras). */
    camFields(b, opts) {
      const c = b.cfg;
      return `<label class="fld"><span>Imagen</span><select data-f="cfg.video"><option value="">Video en vivo (visor de Frigate)</option><option value="photo" ${c.video === 'photo' ? 'selected' : ''}>Foto cada 10 s (para internet lento)</option></select></label>
        <p class="hint" style="margin-top:-4px">En el equipo se ve con el visor de Frigate (eventos y grabaciones); acá, en la vista previa, se ve el video en vivo de la cámara.</p>`
        + this.ent('Cámara', 'cam', c.entity, PICK.camera, 'cfg.entity') + this.ent('Botón grande (portón, puerta)', 'gate', c.gate, PICK.gate, 'cfg.gate')
        + this.multi('Más cámaras (se pasan con «Otra cámara» o deslizando)', 'entities', c.entities, opts(PICK.camera).filter(([e]) => e !== c.entity));
    }
    /** Campos de un dato del resumen o de un botón. */
    itemFields(b, i, o) {
      const it = (b.cfg.items || [])[i] || {}, ICONS = window.MaeVista.ICONS;
      return `${o.kpi ? `<label class="fld"><span>Qué muestra</span><select data-f="cfg.items.${i}.kind">${KPI_KINDS.map(([k, l]) => `<option value="${k}" ${it.kind === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>` : ''}
        ${!o.kpi || it.kind === 'entity' ? this.ent(o.kpi ? 'Equipo' : 'Equipo (opcional)', 'it', it.entity, o.doms || null, `cfg.items.${i}.entity`) : ''}
        <label class="fld"><span>Nombre (vacío: el del equipo)</span><input data-f="cfg.items.${i}.name" value="${esc(it.name || '')}" maxlength="60"></label>
        ${o.icon === false ? '' : `<label class="fld"><span>Ícono</span><select data-f="cfg.items.${i}.icon"><option value="">Automático</option>${ICONS.map((n) => `<option ${it.icon === n ? 'selected' : ''}>${n}</option>`).join('')}</select></label>`}
        ${o.mode ? `<label class="fld"><span>Cómo se muestra</span><select data-f="cfg.items.${i}.mode"><option value="">Interruptor (activar o desactivar)</option><option value="run" ${it.mode === 'run' ? 'selected' : ''}>Botón «Ejecutar» (la hace ahora)</option></select></label>` : ''}
        ${o.tap === false ? '' : this.action(it.tap, `cfg.items.${i}.tap`, 'Al tocar')}${o.hold ? this.action(it.hold, `cfg.items.${i}.hold`, 'Al mantener apretado') : ''}`;
    }
    /** Panel de un elemento: «Tarjeta › elemento», sus campos y moverlo o sacarlo. */
    elemEditor(b, i, opts) {
      const CAT = window.MaeVista.CATALOG, cardName = b.title || (CAT[b.type] || {}).name || b.type;
      const back = `<div class="crumb"><button class="eb sm" data-elback>‹ ${esc(cardName)}</button>`;
      if (i === 'cam') return `${back}<span>› Cámara</span></div><h4>Cámara</h4>${this.camFields(b, opts)}`;
      const L = this.elemList(b), x = L[i];
      if (x == null) { this.el = null; return `${back}</div><p class="hint">Ese elemento ya no está.</p>`; }
      let f = '';
      switch (b.type) {
        case 'kpis': f = this.itemFields(b, i, { kpi: true }); break;
        case 'buttons': case 'camera': f = this.itemFields(b, i, { hold: true }); break;
        case 'scenes': f = this.itemFields(b, i, { doms: ['scene', 'script'], tap: false }); break;
        case 'routines': f = this.itemFields(b, i, { doms: ['automation', 'script'], tap: false, icon: false, mode: true }); break;
        case 'covers': f = this.itemFields(b, i, { doms: ['cover'], tap: false, icon: false }); break;
        case 'lights': f = this.itemFields(b, i, { doms: ['light', 'switch'], tap: false, icon: false }); break;
        default: f = '';
      }
      return `${back}<span>› ${esc(this.elemLabel(b, x))}</span></div><h4>${esc((ELEM[b.type] || ['Elemento'])[0] || 'Elemento')}</h4>${f}
        <div class="elnav"><button class="eb sm warn" data-elact2="del" data-i="${i}">Sacar de la tarjeta</button></div>`;
    }
    /* ───────── encabezado, barra de abajo y zonas del plano ───────── */
    headerEditor() {
      const H = this.lay().header || {};
      return `<h4>Qué se ve arriba</h4>
        ${[['clock', 'Hora y fecha (al tocarla abre la agenda)'], ['weather', 'Clima (al tocarlo abre el pronóstico)'], ['bell', 'Campanita de avisos'], ['menu', 'Menú (opciones y soporte)']]
          .map(([k, l]) => `<label class="chk"><input type="checkbox" data-hd="${k}" ${H[k] !== false ? 'checked' : ''}> ${l}</label>`).join('')}
        <p class="hint">Vale para ${this.K === 'tablet' ? 'la tablet' : 'el celular'} de este dashboard. Si sacás el menú, las opciones siguen en la barra de abajo (si tiene «Menú»).</p>`;
    }
    dockKeys() { const l = this.lay(); return (l.dock && l.dock.length ? l.dock : window.MaeVista.DOCK_DEF[this.K]).slice(); }
    dockEditor() {
      const D = this.dockKeys(), ALL = window.MaeVista.DOCK, free = Object.keys(ALL).filter((k) => !D.includes(k));
      const custom = !!(this.lay().dock && this.lay().dock.length);
      return `<h4>Botones (arrastralos para ordenarlos)</h4>
        <div class="elist">${D.map((k, i) => `<div class="elr" draggable="true" data-sr="dock" data-i="${i}"><span class="hd" title="Arrastrar para ordenar">⋮⋮</span><span class="tx"><b>${esc(ALL[k] ? ALL[k][1] : k)}</b><small>${k === 'voice' ? 'redondo, para hablarle a la casa' : k === 'top' ? 'vuelve arriba' : 'abre su pantalla'}</small></span>
          <button data-dk="del" data-i="${i}" title="Sacar">✕</button></div>`).join('')}</div>
        ${free.length && D.length < 10 ? `<label class="fld"><span>Agregar un botón</span><select data-dkadd><option value="">Elegir…</option>${free.map((k) => `<option value="${k}">${esc(ALL[k][1])}</option>`).join('')}</select></label>` : ''}
        ${custom ? '<button class="eb sm" data-dkreset>Volver a la barra de siempre</button>' : ''}
        <p class="hint">Lo que la casa no tiene (cámaras, música, agenda) no aparece aunque esté en la lista. El micrófono queda lindo en el medio.</p>`;
    }
    zoneEditor(i) {
      const P = this.v.plan || {}, z = (P.zones || [])[i];
      if (!z) { this.pz = null; return '<p class="hint">Esa zona ya no está.</p>'; }
      const m = this.model(), rooms = m ? m.rooms.map((x) => x.name) : [];
      const lights = Object.keys(this.states()).filter((e) => /^(light|switch)\./.test(e)).sort((a, c) => this.fname(a).localeCompare(this.fname(c), 'es'));
      return `<div class="crumb"><button class="eb sm" data-pzback>‹ Plano</button><span>› ${esc(z.name)}</span></div><h4>Ambiente del plano</h4>
        <label class="fld"><span>Nombre del cartel</span><input data-pzf="name" value="${esc(z.name)}" maxlength="40"></label>
        <label class="fld"><span>Ambiente que abre al mantener apretado</span><select data-pzf="room"><option value="">—</option>${rooms.map((r) => `<option ${z.room === r ? 'selected' : ''}>${esc(r)}</option>`).join('')}</select></label>
        <h4>Luces que lo iluminan (${z.lights.length})</h4><div class="ml">${lights.map((e) => `<label><input type="checkbox" data-pzl="${esc(e)}" ${z.lights.includes(e) ? 'checked' : ''}> ${esc(this.fname(e))}</label>`).join('')}</div>
        <p class="hint">Arrastrá el cartel en la pantalla del medio para ubicarlo. ${z.pin ? '<button class="eb sm" data-pzpin>Volver a ponerlo en el centro</button>' : ''}</p>
        <div class="elnav"><button class="eb sm" data-e="plan">Cambiar la forma o las imágenes</button><button class="eb sm warn" data-pzdel>Borrar este ambiente del plano</button></div>`;
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
      this.ensureDraft();
      const R = this.rdraft, eid = (x) => (x && typeof x === 'object' ? x.entity : x), ICONS = window.MaeVista.ICONS;
      const manual = Array.isArray(this.cfg.rooms) && this.cfg.rooms.length;
      const b = this.selBlock(), inCard = b && b.type === 'rooms' && R._orig && ((b.cfg && b.cfg.rooms) || []).includes(R._orig);
      return `<div class="crumb"><button class="eb sm" data-rx="back">‹ Ambientes</button><span>› ${esc(R.name)}</span></div>
        <p class="hint" style="margin-top:0">Lo ves abierto en la pantalla: así lo ve el cliente. Ordená los equipos arrastrándolos (acá o en la pantalla).</p>
        ${manual ? '' : '<div class="warnbox">Hoy los ambientes salen solos de las Áreas de Home Assistant. Al guardar, quedan armados a mano (con lo mismo que se ve ahora) y desde ahí se editan acá.</div>'}
        ${inCard ? '<button class="eb sm" data-rx="unpin" style="margin-bottom:10px">Sacarlo de esta tarjeta (sigue en «Toda la casa»)</button>' : ''}
        <label class="fld"><span>Nombre</span><input data-rn="name" value="${esc(R.name)}" maxlength="40"></label>
        <label class="fld"><span>Ícono</span><select data-rn="icon"><option value="">Automático</option>${ICONS.map((n) => `<option ${R.icon === n ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
        <h4>Equipos (arrastralos para ordenarlos)</h4>
        ${(R.entities || []).map((x, i) => { const id = eid(x), d = id.split('.')[0]; return `<div class="rme" draggable="true" data-sr="room" data-i="${i}"><span class="hd" title="Arrastrar para ordenar">⋮⋮</span><span class="dtag">${esc(DOM_NAME[d] || d)}</span><span class="tx"><b>${esc((x && x.name) || this.fname(id))}</b><small>${esc(id)}${this.states()[id] ? '' : ' · no existe'}</small></span>
          <button data-rdel="${i}" title="Sacar">✕</button></div>`; }).join('') || '<p class="hint">Todavía no tiene equipos.</p>'}
        <div class="fld">${this.cbBtn('', 'data-radd="1"').replace('Elegir un equipo…', '+ Agregar un equipo')}</div>
        <div style="display:flex;gap:8px;margin-top:12px">${R._orig ? '<button class="eb warn sm" data-rx="del">Borrar este ambiente de la casa</button>' : ''}</div>
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
        if (!del && orig == null && this.newRoomFor) {
          const bb = this.blocks().find((x) => x.id === this.newRoomFor);
          if (bb) { this.push(); this.materialize(bb); this.elemList(bb).push(R.name); }
        }
        this.newRoomFor = null;
        this.toast(del ? 'Ambiente borrado' : 'Ambiente guardado: ya se ve en la app');
        this.roomEd = null; this.rdraft = null; setTimeout(() => this.draw(), 150); this.syncPreview();
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
      if (ed) ed.onclick = (e) => { if ((this.moreOpen || this.simOpen) && !e.composedPath().some((x) => x.classList && x.classList.contains('emenu'))) { this.moreOpen = false; this.simOpen = false; this.draw(); } };
      W.querySelectorAll('[data-kind]').forEach((x) => { x.onclick = () => {
        if (x.dataset.kind === this.K) return;
        this.K = x.dataset.kind; this.sel = null; this.roomEd = null; this.rdraft = null;
        if (!this.blocks().length) this.prearmado(true); // todavía no tiene diseño para este tipo: arranca del prearmado
        this.draw();
      }; });
      W.querySelectorAll('[data-theme]').forEach((x) => { x.onclick = () => this.change(() => { this.lay().theme = x.dataset.theme === 'dark' ? null : x.dataset.theme; }); });
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
      W.querySelectorAll('#edr [data-red]').forEach((x) => { x.onclick = () => { this.roomEd = x.dataset.red; this.rdraft = null; this.ensureDraft(); this.drawProps(); this.syncPreview(); this.bind(); }; });
      const R = this.rdraft, redraw = () => { this.drawProps(); this.syncPreview(); this.bind(); };
      if (R) {
        W.querySelectorAll('#edr [data-rn]').forEach((x) => { x.onchange = () => { R[x.dataset.rn] = x.dataset.rn === 'name' ? (x.value.trim() || R.name) : x.value; this.syncPreview(); }; });
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
          if (k === 'unpin') { const bb = this.selBlock(), orig = R._orig; this.roomEd = null; this.rdraft = null; this.change(() => { bb.cfg.rooms = (bb.cfg.rooms || []).filter((n) => n !== orig); bb.cfg.auto = false; }); }
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
      W.querySelectorAll('[data-tab]').forEach((x) => { x.onclick = () => { this.tab = x.dataset.tab; this.drawProps(); this.drawDlg(); this.bind(); }; });
      W.querySelectorAll('[data-dx]').forEach((x) => { x.onclick = () => {
        const k = x.dataset.dx;
        if (k === 'cancel') return this.dlgCancel();
        if (k === 'ok') return this.dlgOk();
        if (k === 'del' && this.sel) { const id = this.sel; this.dlgSnap = null; this.sel = null; this.blockAct(id, 'del'); this.dlgClose(); this.autosave(); }
        return undefined;
      }; });
      W.querySelectorAll('#edr [data-elpick2]').forEach((x) => { x.onclick = (e) => { e.stopPropagation(); const r = x.closest('[data-elpick]'); if (r) r.click(); }; });
      // filas que se ordenan arrastrando (elementos de la tarjeta, equipos del ambiente, botones de la barra)
      W.querySelectorAll('#edr [data-sr]').forEach((row) => {
        row.ondragstart = (e) => { this.srDrag = { g: row.dataset.sr, i: +row.dataset.i }; row.classList.add('drag'); try { e.dataTransfer.setData('text/plain', 'x'); e.dataTransfer.effectAllowed = 'move'; } catch (_) { /* navegador viejo */ } };
        row.ondragend = () => { row.classList.remove('drag'); W.querySelectorAll('#edr .over').forEach((o) => o.classList.remove('over')); };
        row.ondragover = (e) => { if (this.srDrag && this.srDrag.g === row.dataset.sr) { e.preventDefault(); row.classList.add('over'); } };
        row.ondragleave = () => row.classList.remove('over');
        row.ondrop = (e) => { e.preventDefault(); const d = this.srDrag; this.srDrag = null; if (d && d.g === row.dataset.sr) this.reorder(d.g, d.i, +row.dataset.i); };
      });
      W.querySelectorAll('#edr [data-actroom]').forEach((x) => { x.onchange = () => this.change(() => { if (x.value) b.cfg.rooms = [x.value]; else delete b.cfg.rooms; }); });
      W.querySelectorAll('#edr [data-lt]').forEach((x) => { x.onchange = () => this.change(() => { this.lay()[x.dataset.lt] = x.value || null; }); });
      // estilo y fondo
      W.querySelectorAll('#edr [data-stl]').forEach((x) => { x.onclick = () => this.change(() => { this.lay().style = x.dataset.stl === 'matterai' ? null : x.dataset.stl; }); });
      W.querySelectorAll('#edr [data-bgk]').forEach((x) => { x.onclick = () => this.change(() => { this.lay().bg = null; }); });
      W.querySelectorAll('#edr [data-bgg]').forEach((x) => { x.onclick = () => this.change(() => { this.lay().bg = { kind: 'gradient', gradient: x.dataset.bgg }; }); });
      W.querySelectorAll('#edr [data-bgc]').forEach((x) => { x.onchange = () => this.change(() => { this.lay().bg = { kind: 'color', color: x.value }; }); });
      W.querySelectorAll('#edr [data-bgd]').forEach((x) => { x.onchange = () => this.change(() => { const g = this.lay().bg; if (g) g.dim = Number(x.value); }); });
      const bgf = W.querySelector('#edr [data-bgf]');
      W.querySelectorAll('#edr [data-bgi]').forEach((x) => { x.onclick = () => { if (bgf) bgf.click(); }; });
      if (bgf) bgf.onchange = async () => {
        const f = bgf.files && bgf.files[0]; if (!f) return;
        try { const pth = await this.upload(f); this.change(() => { this.lay().bg = { kind: 'image', image: pth, dim: 0.35 }; }); this.toast('Fondo subido'); } catch (e) { this.toast(`No se pudo subir: ${e.message || e}`); }
      };
      const back = () => { this.zone = null; this.pz = null; this.drawProps(); this.syncPreview(); this.bind(); };
      W.querySelectorAll('#edr [data-zback],#edr [data-pzback]').forEach((x) => { x.onclick = back; });
      W.querySelectorAll('#edr [data-hd]').forEach((x) => { x.onchange = () => this.change(() => { const l = this.lay(), H = Object.assign({}, l.header || {}); if (x.checked) delete H[x.dataset.hd]; else H[x.dataset.hd] = false; l.header = Object.keys(H).length ? H : null; }); });
      W.querySelectorAll('#edr [data-dk]').forEach((x) => { x.onclick = () => this.change(() => {
        const D = this.dockKeys(), i = +x.dataset.i, a = x.dataset.dk;
        if (a === 'del') D.splice(i, 1);
        else { const j = i + (a === 'up' ? -1 : 1); if (j < 0 || j >= D.length) return; [D[i], D[j]] = [D[j], D[i]]; }
        this.lay().dock = D;
      }); });
      W.querySelectorAll('#edr [data-dkadd]').forEach((x) => { x.onchange = () => { if (!x.value) return; this.change(() => { const D = this.dockKeys(); D.push(x.value); this.lay().dock = D; }); }; });
      W.querySelectorAll('#edr [data-dkreset]').forEach((x) => { x.onclick = () => this.change(() => { this.lay().dock = null; }); });
      const Z = () => ((this.v.plan || {}).zones || [])[this.pz];
      W.querySelectorAll('#edr [data-pzf]').forEach((x) => { x.onchange = () => this.change(() => {
        const z = Z(); if (!z) return;
        if (x.dataset.pzf === 'name') z.name = (x.value.trim() || 'Ambiente').slice(0, 40);
        else { z.room = x.value || null; if (x.value && /^Ambiente \d+$/.test(z.name)) z.name = x.value; }
      }); });
      W.querySelectorAll('#edr [data-pzl]').forEach((x) => { x.onchange = () => this.change(() => { const z = Z(); if (!z) return; if (x.checked) { if (!z.lights.includes(x.dataset.pzl)) z.lights.push(x.dataset.pzl); } else z.lights = z.lights.filter((y) => y !== x.dataset.pzl); }); });
      W.querySelectorAll('#edr [data-pzpin]').forEach((x) => { x.onclick = () => this.change(() => { const z = Z(); if (z) delete z.pin; }); });
      W.querySelectorAll('#edr [data-pzdel]').forEach((x) => { x.onclick = () => { if (!confirm('¿Borrar este ambiente del plano? (Se puede deshacer)')) return; this.change(() => { this.v.plan.zones.splice(this.pz, 1); this.pz = null; }); }; });
      W.querySelectorAll('#edr [data-elback]').forEach((x) => { x.onclick = () => { this.el = null; this.drawProps(); this.syncPreview(); this.bind(); }; });
      W.querySelectorAll('#edr [data-elact2]').forEach((x) => { x.onclick = (e) => { e.stopPropagation(); this.onElem(this.sel, x.dataset.elact2, +x.dataset.i); }; });
      W.querySelectorAll('#edr [data-elpick]').forEach((x) => { x.onclick = () => {
        const i = +x.dataset.elpick, bb = this.selBlock();
        if (bb && bb.type === 'rooms') {
          const nm = this.isAuto(bb) ? ((this.vista && this.vista.shown && this.vista.shown(bb.id)) || [])[i] : (bb.cfg.rooms || [])[i];
          const rr = (this.model() || { rooms: [] }).rooms.find((y) => y.name === nm);
          return this.pick(bb.id, rr ? { el: i, room: rr.id } : { el: i });
        }
        return this.pick(this.sel, { el: i });
      }; });
      W.querySelectorAll('#edr [data-eladd2]').forEach((x) => { x.onclick = () => { const bb = this.selBlock(); if (bb) this.elemAdd(bb); }; });
      W.querySelectorAll('#edr [data-toauto]').forEach((x) => { x.onclick = () => this.change(() => {
        const c = b.cfg; delete c.items; delete c.entities; delete c.rooms; c.auto = true; this.el = null;
        if (b.type === 'rooms') delete c.auto;
      }); });
      W.querySelectorAll('#edr [data-cadd]').forEach((x) => { x.onclick = () => this.change(() => { b.show = b.show || []; if (b.show.length < 6) b.show.push({ type: 'night' }); }); });
      W.querySelectorAll('#edr [data-cdel]').forEach((x) => { x.onclick = () => this.change(() => { b.show.splice(+x.dataset.cdel, 1); if (!b.show.length) delete b.show; }); });
      W.querySelectorAll('#edr [data-copyto]').forEach((x) => { x.onclick = () => this.copyTo(b); });
      W.querySelectorAll('#edr [data-imgup]').forEach((x) => { x.onchange = async () => {
        const f = x.files[0]; if (!f) return;
        this.toast('Subiendo…');
        try { const p = await this.upload(f); this.change(() => { b.cfg.image = p; }); this.toast('Imagen subida'); } catch (e) { this.toast(`No se pudo subir: ${e.message || e}`); }
      }; });
      W.querySelectorAll('#edr [data-mdel]').forEach((x) => { x.onclick = () => this.change(() => { const L = b.cfg[x.dataset.mdel]; if (L) L.splice(+x.dataset.i, 1); }); });
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
    async cmd(k, quiet) {
      if (k !== 'more' && this.moreOpen) this.moreOpen = false;
      if (k !== 'simm' && this.simOpen) this.simOpen = false;
      if (k === 'close') return this.close();
      if (k === 'more') { this.moreOpen = !this.moreOpen; this.draw(); return; }
      if (k === 'play') {
        if (this.dlgOpen()) await this.dlgOk();
        this.playing = !this.playing;
        this.draw();
        this.toast(this.playing ? 'Modo prueba: tocá como en el celular' : 'De vuelta al editor');
        return;
      }
      if (k === 'dash') return this.pick(null, { zone: 'dash' });
      if (k === 'simm') { this.simOpen = !this.simOpen; this.draw(); return; }
      if (k === 'list') { this.showList = !this.showList; try { localStorage.setItem('matterai.editor.list', this.showList ? '1' : '0'); } catch (_) { /* sin almacenamiento */ } this.draw(); this.sizeFrame(); return; }
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
        this.saving = true;
        try {
          const before = JSON.stringify(this.v);
          const res = await this.hass.callWS({ type: 'matterai/views/save', view: this.payload() });
          // si mientras se guardaba no se tocó nada, queda igual a lo guardado; si se siguió editando, eso va en el próximo guardado
          if (JSON.stringify(this.v) === before) { this.v = Editor.normalize(clone(res)); this.saved = clone(this.v); this.undo = this.undo.slice(-80); }
          else { this.saved = Editor.normalize(clone(res)); this.autosave(); }
          if (this.trying) await this.endTry();
          if (!quiet) this.toast('Guardado: los equipos con este dashboard lo ven al instante');
        } catch (e) { this.toast(`No se pudo guardar: ${e.message || e}`); }
        this.saving = false;
        if (this.$ && this.$('#edt')) this.draw();
      }
    }
    payloadAsView() { return Object.assign({}, this.payload(), { layouts: this.payload().layouts }); }
    /** Lo que se guarda (o se prueba): los dos diseños, el plano y lo demás del dashboard. */
    payload() {
      const v = this.v, L = v.layouts || {};
      // un diseño sin tarjetas propias (prearmado) igual guarda su estilo, fondo, modo, arriba y barra
      const has = (x) => x && ((x.blocks && x.blocks.length) || x.style || x.bg || x.theme || x.header || x.dock);
      const lay = (k) => (has(L[k]) ? { blocks: L[k].blocks && L[k].blocks.length ? L[k].blocks : null, orientation: k === 'tablet' ? L[k].orientation || 'landscape' : null, header: L[k].header || null, dock: L[k].dock || null, theme: L[k].theme || null, style: L[k].style || null, bg: L[k].bg || null } : null);
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
    /** Una plantilla de otra casa se adapta a esta: lo que no existe se saca, y la tarjeta que queda vacía vuelve a
     *  automático (se arma sola con los equipos, ambientes, escenas y rutinas de ESTA casa). */
    adaptBlocks(blocks) {
      const S = this.states(), has = (id) => !!(id && S[id]), m = this.model() || { rooms: [] };
      const rooms = new Set(m.rooms.map((r) => r.name));
      (blocks || []).forEach((b) => {
        const c = b.cfg = b.cfg || {};
        ['entity', 'gate'].forEach((k) => { if (c[k] && !has(c[k])) delete c[k]; });
        if (Array.isArray(c.entities)) c.entities = c.entities.filter(has);
        if (Array.isArray(c.items)) c.items = c.items.filter((x) => !x || !x.entity || has(x.entity) || (b.type === 'kpis' && x.kind !== 'entity'));
        if (Array.isArray(c.rooms)) c.rooms = c.rooms.filter((n) => rooms.has(n));
        if (Array.isArray(b.show)) { b.show = b.show.filter((q) => !q.entity || has(q.entity)); if (!b.show.length) delete b.show; }
        const empty = (k) => !(Array.isArray(c[k]) && c[k].length);
        if (['kpis', 'scenes', 'routines', 'covers', 'lights'].includes(b.type) && empty('items') && empty('entities')) { delete c.items; delete c.entities; c.auto = true; }
        if (b.type === 'rooms' && empty('rooms')) delete c.rooms;
      });
      return blocks;
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
        const miss = Editor.entitiesIn(L).filter((id) => !this.states()[id]);
        Object.values(L).forEach((l) => this.adaptBlocks(l.blocks));
        this.change(() => { this.v.layouts = Object.assign({}, this.v.layouts, L); this.sel = null; this.el = null; });
        this.toast(miss.length ? `Plantilla adaptada a esta casa: ${miss.length} equipo${miss.length > 1 ? 's' : ''} de la otra casa no estaba${miss.length > 1 ? 'n' : ''}; esas tarjetas quedaron en automático o para elegir` : 'Plantilla cargada: revisala y guardá');
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
    async close() {
      if (this.dlgOpen()) await this.dlgOk();
      clearTimeout(this.saveT);
      if (this.dirty()) await this.cmd('save', true);
      if (this.dirty() && !confirm('No se pudieron guardar los últimos cambios. ¿Salir igual?')) return;
      window.removeEventListener('keydown', this.keyH);
      window.removeEventListener('resize', this.resH);
      window.removeEventListener('beforeunload', this.unloadH);
      clearInterval(this.liveT);
      if (this.trying) this.endTry();
      this.closeCB(); this.closeCatalog();
      if (this.vista) this.vista.destroy();
      this.pcard = null;
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
    /** Ambientes del plano ya dibujados (archivo ambientes.json): nombre, ambiente de la casa, luces y forma.
     *  Las luces que no existen en esta casa se sacan; si un ambiente no trae luces, toma las de su ambiente de la casa. */
    importZones() {
      const inp = document.createElement('input');
      inp.type = 'file'; inp.accept = 'application/json,.json';
      inp.onchange = async () => {
        const f = inp.files[0]; if (!f) return;
        let d = null;
        try { d = JSON.parse(await f.text()); } catch (_) { d = null; }
        if (!d || d.format !== 'matterai-plan-zones' || !Array.isArray(d.zones)) { this.toast('Ese archivo no tiene ambientes del plano de MatterAI'); return; }
        const S = this.states(), m = this.model() || { rooms: [] };
        let miss = 0;
        const zones = d.zones.filter((z) => z && Array.isArray(z.poly) && z.poly.length >= 3).slice(0, 60).map((z) => {
          const room = z.room && m.rooms.find((r) => r.name.toLowerCase() === String(z.room).toLowerCase());
          let lights = (z.lights || []).filter((id) => { const ok = !!S[id]; if (!ok) miss++; return ok; });
          if (!lights.length && room && room.lightsCtl) lights = room.lightsCtl.slice(0, 24);
          return { name: String(z.name || 'Ambiente').slice(0, 40), room: room ? room.name : null, lights,
            poly: z.poly.map((q) => [Math.min(1, Math.max(0, +q[0] || 0)), Math.min(1, Math.max(0, +q[1] || 0))]) };
        });
        if (this.v.plan.zones && this.v.plan.zones.length && !confirm(`¿Reemplazar los ${this.v.plan.zones.length} ambientes del plano por los ${zones.length} del archivo?`)) return;
        this.push();
        this.v.plan.zones = zones;
        if (d.aspect) this.v.plan.aspect = Math.round(+d.aspect * 1000) / 1000;
        this.zsel = null;
        await this.drawPlan(); this.drawPreview();
        this.toast(`Listo: ${zones.length} ambientes${miss ? `. ${miss} luz${miss > 1 ? 'ces' : ''} no existe${miss > 1 ? 'n' : ''} en la casa: tocá cada ambiente para elegir sus luces` : ''}`);
      };
      inp.click();
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
      const cen = (q) => [q.poly.reduce((a, t) => a + t[0], 0) / q.poly.length, q.poly.reduce((a, t) => a + t[1], 0) / q.poly.length];
      const lbls = Z.map((q, i) => { const [cx, cy] = cen(q); return `<span class="pe-lbl ${i === this.zsel ? 'sel' : ''}" style="left:${(cx * 100).toFixed(2)}%;top:${(cy * 100).toFixed(2)}%">${esc(q.name)}</span>`; }).join('');
      const tip = this.drawing ? 'Tocá cada esquina del ambiente · doble clic (o «Terminar») para cerrarlo'
        : z ? 'Arrastrá los puntos · el «+» de cada lado agrega un punto · doble clic en un punto lo borra · arrastrá adentro para moverlo'
          : 'Tocá un ambiente para editarlo · Ctrl+Z deshace';
      this.pe.innerHTML = `<div class="pe-c">${src ? `<div class="pe-img"><img id="peimg" src="${esc(src)}" alt="" draggable="false"><svg id="pesvg" viewBox="0 0 1000 1000" preserveAspectRatio="none"></svg>${lbls}<span class="pe-tip">${tip}</span></div>` : '<p class="hint">Subí primero la imagen apagada (o de noche) del render.</p>'}</div>
        <div class="pe-r"><div class="row" style="display:flex;gap:8px;align-items:center"><h3 style="margin:0;flex:1">Plano</h3><button class="eb pri" data-pe="done">Listo</button></div>
          <h4>Imágenes</h4>${await slot('image', 'Apagado / de noche')}${await slot('image_on', 'Con las luces prendidas')}${await slot('image_day', 'De día (opcional)')}
          <p class="hint">Mismo tamaño y encuadre en las tres. JPG, PNG o WebP, hasta 12 MB. Quedan guardadas en la casa, privadas.</p>
          <h4>Ambientes en el plano</h4>
          ${Z.map((q, i) => `<div class="zl ${i === this.zsel ? 'sel' : ''}" data-zsel="${i}"><span class="tx"><b>${esc(q.name)}</b> <small class="hint">${q.lights.length} luces${q.room ? ' · ' + esc(q.room) : ''}</small></span><button class="zx" data-zx="${i}" title="Borrar este ambiente">✕</button></div>`).join('') || '<p class="hint">Todavía no dibujaste ningún ambiente.</p>'}
          ${Z.length > 1 && !this.drawing ? '<button class="eb sm warn" data-pe="clear" style="margin-bottom:8px">Borrar todos los ambientes</button>' : ''}
          <button class="eb" data-pe="new" ${src ? '' : 'disabled'}>${this.drawing ? 'Dibujando… tocá los vértices y «Terminar»' : '+ Dibujar un ambiente'}</button>
          ${this.drawing ? '' : '<button class="eb" data-pe="import" title="Cargar los ambientes ya dibujados (archivo ambientes.json)">Importar ambientes (archivo)</button>'}
          ${this.drawing ? '<button class="eb pri" data-pe="finish">Terminar</button> <button class="eb" data-pe="cancel">Cancelar</button>' : ''}
          ${z ? `<h4>«${esc(z.name)}»</h4><label class="fld"><span>Nombre</span><input data-z="name" value="${esc(z.name)}"></label>
            <label class="fld"><span>Ambiente que abre al mantener</span><select data-z="room"><option value="">—</option>${rooms.map((r) => `<option ${z.room === r ? 'selected' : ''}>${esc(r)}</option>`).join('')}</select></label>
            <h4>Luces que lo iluminan</h4><div class="ml">${lights.map((e) => `<label><input type="checkbox" data-zl="${esc(e)}" ${z.lights.includes(e) ? 'checked' : ''}> ${esc(this.fname(e))}</label>`).join('')}</div>
            <p class="hint">Arrastrá los puntos para ajustar la forma. Con el «+» del medio de cada lado agregás un punto (para ambientes de más de 4 paredes); doble clic o clic derecho en un punto lo borra. Arrastrando desde adentro movés el ambiente entero.</p><button class="eb warn" data-pe="zdel">Borrar este ambiente</button>` : ''}</div>`;
      this.bindPlan();
    }
    bindPlan() {
      const pe = this.pe, P = this.v.plan;
      const img = pe.querySelector('#peimg'), svg = pe.querySelector('#pesvg');
      const ptsOf = (poly) => poly.map(([x, y]) => `${x * 1000},${y * 1000}`).join(' ');
      const paint = () => {
        if (!svg) return;
        svg.innerHTML = (P.zones || []).map((q, i) => `<polygon points="${ptsOf(q.poly)}" fill="${i === this.zsel ? 'rgba(242,183,102,.28)' : 'rgba(124,196,240,.16)'}" stroke="${i === this.zsel ? '#f2b766' : '#7cc4f0'}" stroke-width="3" vector-effect="non-scaling-stroke" data-zp="${i}"/>`).join('')
          + (this.zsel != null && P.zones[this.zsel] ? (() => {
            const poly = P.zones[this.zsel].poly;
            // «+» en el medio de cada lado: arrastrándolo se crea un punto nuevo (ambientes de más de 4 paredes)
            const mids = poly.map(([x, y], j) => { const [x2, y2] = poly[(j + 1) % poly.length]; return `<g data-mid="${j}" style="cursor:copy"><circle cx="${((x + x2) / 2) * 1000}" cy="${((y + y2) / 2) * 1000}" r="8" fill="#161b21" stroke="#f2b766" stroke-width="2" vector-effect="non-scaling-stroke"/><text x="${((x + x2) / 2) * 1000}" y="${((y + y2) / 2) * 1000 + 4}" text-anchor="middle" font-size="13" font-weight="700" fill="#f2b766" style="pointer-events:none">+</text></g>`; }).join('');
            return mids + poly.map(([x, y], j) => `<circle cx="${x * 1000}" cy="${y * 1000}" r="9" fill="#f2b766" stroke="#1b1408" stroke-width="2" vector-effect="non-scaling-stroke" data-vx="${j}" style="cursor:move"/>`).join('');
          })() : '')
          + (this.drawing ? `<polyline points="${ptsOf(this.drawing)}" fill="rgba(242,183,102,.15)" stroke="#f2b766" stroke-width="3" vector-effect="non-scaling-stroke"/>${this.drawing.map(([x, y]) => `<circle cx="${x * 1000}" cy="${y * 1000}" r="7" fill="#f2b766"/>`).join('')}` : '');
      };
      if (img) img.onload = () => { if (img.naturalWidth && img.naturalHeight) P.aspect = Math.round((img.naturalWidth / img.naturalHeight) * 1000) / 1000; };
      const norm = (e) => { const r = svg.getBoundingClientRect(); return [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))].map((v) => Math.round(v * 10000) / 10000); };
      if (svg) {
        const zone = () => P.zones[this.zsel];
        svg.onpointerdown = (e) => {
          if (e.button === 2) return; // el clic derecho borra un punto (contextmenu)
          const vx = e.target.closest('[data-vx]'), mid = e.target.closest('[data-mid]');
          if (vx && this.zsel != null) { this.push(); this.dragVx = +vx.dataset.vx; svg.setPointerCapture(e.pointerId); return; }
          if (mid && this.zsel != null) { // agrega un punto en el medio de ese lado y lo empieza a arrastrar
            this.push(); const j = +mid.dataset.mid, poly = zone().poly, a = poly[j], b = poly[(j + 1) % poly.length];
            poly.splice(j + 1, 0, [Math.round(((a[0] + b[0]) / 2) * 10000) / 10000, Math.round(((a[1] + b[1]) / 2) * 10000) / 10000]);
            this.dragVx = j + 1; svg.setPointerCapture(e.pointerId); paint(); return;
          }
          if (this.drawing) { this.drawing.push(norm(e)); paint(); return; }
          const zp = e.target.closest('[data-zp]');
          if (zp && +zp.dataset.zp === this.zsel) { this.push(); this.dragZone = { at: norm(e), poly: zone().poly.map((q) => q.slice()) }; svg.setPointerCapture(e.pointerId); return; }
          if (zp) { this.zsel = +zp.dataset.zp; this.drawPlan(); }
        };
        svg.onpointermove = (e) => {
          if (this.dragVx != null) { zone().poly[this.dragVx] = norm(e); paint(); return; }
          if (this.dragZone) { // mover el ambiente entero (sin salirse de la imagen)
            const [x, y] = norm(e), D = this.dragZone, xs = D.poly.map((q) => q[0]), ys = D.poly.map((q) => q[1]);
            const dx = Math.max(-Math.min(...xs), Math.min(1 - Math.max(...xs), x - D.at[0])), dy = Math.max(-Math.min(...ys), Math.min(1 - Math.max(...ys), y - D.at[1]));
            zone().poly = D.poly.map(([px, py]) => [Math.round((px + dx) * 10000) / 10000, Math.round((py + dy) * 10000) / 10000]); paint();
          }
        };
        svg.onpointerup = () => { if (this.dragVx != null || this.dragZone) { this.dragVx = null; this.dragZone = null; this.drawPlan(); this.drawPreview(); } };
        const dropVx = (e) => {
          const vx = e.target.closest('[data-vx]'); if (!vx || this.zsel == null) return false;
          const poly = zone().poly; if (poly.length <= 3) { this.toast('Un ambiente necesita al menos 3 puntos'); return true; }
          this.push(); poly.splice(+vx.dataset.vx, 1); this.drawPlan(); this.drawPreview(); return true;
        };
        svg.ondblclick = (e) => {
          if (this.drawing) { // doble clic: cierra el ambiente que se está dibujando (el doble clic sumó 2 puntos iguales)
            e.preventDefault(); this.drawing.splice(-1, 1);
            const fin = this.pe.querySelector('[data-pe="finish"]'); if (fin) fin.click(); return;
          }
          dropVx(e);
        };
        svg.oncontextmenu = (e) => { if (dropVx(e)) e.preventDefault(); };
      }
      paint();
      pe.querySelectorAll('[data-up]').forEach((x) => { x.onchange = async () => {
        const f = x.files[0]; if (!f) return;
        this.toast('Subiendo…');
        try { const p = await this.upload(f); this.push(); P[x.dataset.up] = p; this.toast('Imagen subida'); await this.drawPlan(); this.drawPreview(); } catch (e) { this.toast(`No se pudo subir: ${e.message || e}`); }
      }; });
      pe.querySelectorAll('[data-rmimg]').forEach((x) => { x.onclick = async () => { this.push(); delete P[x.dataset.rmimg]; await this.drawPlan(); this.drawPreview(); }; });
      pe.querySelectorAll('[data-zsel]').forEach((x) => { x.onclick = (e) => {
        const zx = e.target.closest('[data-zx]');
        if (zx) { this.push(); P.zones.splice(+zx.dataset.zx, 1); if (this.zsel != null && this.zsel >= P.zones.length) this.zsel = null; this.drawPlan(); this.drawPreview(); this.toast('Ambiente borrado · Ctrl+Z para deshacer'); return; }
        this.zsel = +x.dataset.zsel; this.drawPlan();
      }; });
      pe.querySelectorAll('[data-pe]').forEach((x) => { x.onclick = async () => {
        const k = x.dataset.pe;
        if (k === 'done') { this.closePlan(); return; }
        if (k === 'new') { this.drawing = []; this.zsel = null; await this.drawPlan(); return; }
        if (k === 'import') { this.importZones(); return; }
        if (k === 'cancel') { this.drawing = null; await this.drawPlan(); return; }
        if (k === 'finish') {
          if (!this.drawing || this.drawing.length < 3) { this.toast('Marcá al menos 3 puntos'); return; }
          // el nombre se pone a la derecha (y toma el del ambiente al elegirlo): sin ventanitas del navegador
          this.push(); P.zones.push({ name: `Ambiente ${(P.zones || []).length + 1}`, room: null, lights: [], poly: this.drawing }); this.zsel = P.zones.length - 1; this.drawing = null;
          await this.drawPlan(); this.drawPreview(); return;
        }
        if (k === 'clear') { if (!confirm(`¿Borrar los ${P.zones.length} ambientes del plano? (Se puede deshacer con Ctrl+Z)`)) return; this.push(); P.zones = []; this.zsel = null; await this.drawPlan(); this.drawPreview(); return; }
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
