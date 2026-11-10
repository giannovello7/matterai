/*!
 * MatterAI Home Card — v1.0.0
 * Dashboard "generativo" para Home Assistant: se arma solo a partir de las Áreas
 * de cada instalación. Un solo archivo, sin dependencias.
 *
 *   type: custom:matterai-home-card
 *   installer: MatterAI
 *   support_phone: "5491112345678"
 */
(() => {
  'use strict';
  const VERSION = '1.5.4';

  /* ───────────────────────── Iconos (trazos propios, 24×24) ───────────────────────── */
  const P = {
    home: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-5h4v5"/>',
    sofa: '<path d="M4 11V8a2 2 0 012-2h12a2 2 0 012 2v3"/><path d="M2 13a2 2 0 014 0v2h12v-2a2 2 0 014 0v5H2z"/><path d="M5 18v2M19 18v2"/>',
    bed: '<path d="M3 19V6"/><path d="M3 14h18v5"/><path d="M21 14a3 3 0 00-3-3h-7v3"/><circle cx="7" cy="11" r="1.6"/>',
    pot: '<path d="M4 10h16v5a5 5 0 01-5 5H9a5 5 0 01-5-5z"/><path d="M2 10h2M20 10h2"/><path d="M9 6c0-1 1-1 1-2M14 6c0-1 1-1 1-2"/>',
    bath: '<path d="M3 12h18v2a5 5 0 01-5 5H8a5 5 0 01-5-5z"/><path d="M6 12V6a2 2 0 014 0"/><path d="M7 19l-1 2M17 19l1 2"/>',
    dining: '<path d="M7 3v8M5 3v5a2 2 0 004 0V3M7 11v10"/><path d="M17 3c-2 2-2 6 0 8v10"/>',
    garage: '<path d="M3 21V9l9-5 9 5v12"/><path d="M7 21v-8h10v8M7 16h10"/>',
    tree: '<path d="M12 22v-6"/><path d="M12 16a5 5 0 005-5 5 5 0 00-2-4 5 5 0 00-6 0 5 5 0 00-2 4 5 5 0 005 5z"/>',
    desk: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
    door: '<path d="M6 21V4a1 1 0 011-1h10a1 1 0 011 1v17"/><path d="M4 21h16"/><circle cx="15" cy="12" r=".8"/>',
    laundry: '<rect x="4" y="3" width="16" height="18" rx="2"/><circle cx="12" cy="13" r="4"/><path d="M8 6.5h.01M11 6.5h.01"/>',
    tv: '<rect x="3" y="5" width="18" height="12" rx="2"/><path d="M8 21h8"/>',
    bulb: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 00-4 10.5c.8.8 1 1.5 1 2.5h6c0-1 .2-1.7 1-2.5A6 6 0 0012 3z"/>',
    power: '<path d="M12 3v9"/><path d="M6.4 6.4a8 8 0 1011.2 0"/>',
    shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
    shieldOk: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
    thermo: '<path d="M14 14.8V5a2 2 0 00-4 0v9.8a4 4 0 104 0z"/>',
    drop: '<path d="M12 3s6 6.5 6 11a6 6 0 01-12 0c0-4.5 6-11 6-11z"/>',
    fan: '<circle cx="12" cy="12" r="1.5"/><path d="M12 10.5C12 6 13 3 15.5 3S19 6 12 10.5zM13.5 12c4.5 0 7.5 1 7.5 3.5S18 19 13.5 12zM12 13.5c0 4.5-1 7.5-3.5 7.5S5 18 12 13.5zM10.5 12C6 12 3 11 3 8.5S6 5 10.5 12z"/>',
    blind: '<path d="M4 3h16M5 3v10M19 3v10"/><path d="M5 7h14M5 11h14"/><path d="M12 13v5"/><circle cx="12" cy="19.5" r="1.5"/>',
    up: '<path d="M6 15l6-6 6 6"/>',
    down: '<path d="M6 9l6 6 6-6"/>',
    stop: '<rect x="7" y="7" width="10" height="10" rx="2"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    play: '<path d="M8 5l11 7-11 7z"/>',
    pause: '<path d="M9 5v14M15 5v14"/>',
    music: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
    plug: '<path d="M9 3v5M15 3v5"/><path d="M6 8h12v3a6 6 0 01-12 0z"/><path d="M12 17v4"/>',
    motion: '<circle cx="13" cy="4" r="2"/><path d="M10 21l2-6 3 3v3M9 12l2-4 4 1 2 3M11 8l-3 3"/>',
    window: '<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M12 3v18M4 12h16"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/>',
    unlock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 017.5-2"/>',
    cam: '<rect x="3" y="7" width="12" height="10" rx="2"/><path d="M15 10l6-3v10l-6-3"/>',
    sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z"/>',
    moon: '<path d="M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    cloud: '<path d="M7 18a4 4 0 010-8 6 6 0 0111.5 1.5A3.5 3.5 0 0118 18z"/>',
    rain: '<path d="M7 15a4 4 0 010-8 6 6 0 0111.5 1.5A3.5 3.5 0 0118 15z"/><path d="M8 18l-1 3M12 18l-1 3M16 18l-1 3"/>',
    bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
    snow: '<path d="M12 2v20M4 6l16 12M20 6L4 18"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    check: '<path d="M5 12l5 5 9-10"/>',
    chat: '<path d="M21 12a8.5 8.5 0 01-12.6 7.4L3 21l1.6-5.2A8.5 8.5 0 1121 12z"/>',
    alert: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18h.01"/>',
    cook: '<path d="M6 13h12M7 13a5 5 0 0110 0"/><path d="M4 17h16"/><path d="M12 6V4"/>',
    heart: '<path d="M12 20s-7-4.5-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.5-7 10-7 10z"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h10"/>',
    history: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    back: '<path d="M15 5l-7 7 7 7"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4.2-4.2"/>',
    prev: '<path d="M18 6l-8 6 8 6z"/><path d="M6 6v12"/>', next: '<path d="M6 6l8 6-8 6z"/><path d="M18 6v12"/>',
    vol: '<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 9a4 4 0 010 6M18.5 6.5a8 8 0 010 11"/>',
    mute: '<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M17 9l5 6M22 9l-5 6"/>',
    shuffle: '<path d="M3 7h3l9 10h6M3 17h3l3-3.5M15 7h6M18 4l3 3-3 3M18 14l3 3-3 3"/>',
    repeat: '<path d="M4 12V9a3 3 0 013-3h12M17 3l3 3-3 3M20 12v3a3 3 0 01-3 3H5M7 21l-3-3 3-3"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/>',
    speaker: '<rect x="6" y="2" width="12" height="20" rx="3"/><circle cx="12" cy="14" r="3.5"/><circle cx="12" cy="6.5" r="1"/>',
    queue: '<path d="M4 6h12M4 11h12M4 16h7"/><path d="M15 15l5 3-5 3z"/>',
    dots: '<circle cx="12" cy="5" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="12" cy="19" r="1.4"/>',
    library: '<path d="M5 3v18M10 3v18"/><path d="M15 4l5 16"/>',
    disc: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.5"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0116 0"/>',
    cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    bell: '<path d="M6 16V11a6 6 0 0112 0v5l2 2H4z"/><path d="M10 20a2 2 0 004 0"/>',
    alarmclock: '<circle cx="12" cy="13" r="7"/><path d="M12 10v3l2 2M5 4L3 6M19 4l2 2"/>',
    wind: '<path d="M3 8h11a3 3 0 10-3-3M3 12h15a3 3 0 11-3 3M3 16h7"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  };
  const ic = (n, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true">${P[n] || P.home}</svg>`;

  /* ───────────────────────── Diccionarios ───────────────────────── */
  const ROOM_RULES = [
    [/living|estar|sala|lounge/i, 'sofa'],
    [/dormi|habitaci|cuarto|suite|bed|pieza|nene|nena|chicos/i, 'bed'],
    [/cocina|kitchen/i, 'pot'],
    [/ba[ñn]o|toilette|toilet|bath|ducha|vestuario/i, 'bath'],
    [/comedor|dining/i, 'dining'],
    [/garage|garaje|cochera|parking/i, 'garage'],
    [/jard[ií]n|patio|parque|garden|terraza|balc[oó]n|galer[ií]a|quincho|pileta|piscina|exterior|fondo|parrilla/i, 'tree'],
    [/oficina|escritorio|estudio|office|taller|local/i, 'desk'],
    [/entrada|hall|recibidor|pasillo|acceso|frente|palier/i, 'door'],
    [/lavadero|laundry/i, 'laundry'],
    [/tv|cine|media|juegos|play/i, 'tv'],
  ];
  const roomIcon = (name) => (ROOM_RULES.find(([re]) => re.test(name || '')) || [0, 'home'])[1];
  const LIGHT_KW = /luz|luces|light|l[aá]mpara|spot|led|velador|tira|aplique|farol|faro|ara[ñn]a|plaf[oó]n|dicroica|guirnalda/i;
  const MOTION_DC = new Set(['motion', 'occupancy', 'presence']);
  const OPEN_DC = new Set(['door', 'window', 'garage_door', 'opening']);
  const HVAC = { off: 'Apagado', cool: 'Frío', heat: 'Calor', heat_cool: 'Auto', auto: 'Auto', dry: 'Seco', fan_only: 'Ventilar' };
  const WX = {
    'clear-night': ['moon', 'Despejado', 'despejado'], sunny: ['sun', 'Soleado', 'soleado'],
    partlycloudy: ['cloud', 'Algo nublado', 'parcialmente nublado'], cloudy: ['cloud', 'Nublado', 'nublado'],
    fog: ['cloud', 'Niebla', 'con niebla'], rainy: ['rain', 'Lluvia', 'lloviendo'], pouring: ['rain', 'Lluvia fuerte', 'lloviendo fuerte'],
    lightning: ['bolt', 'Tormenta', 'con tormenta'], 'lightning-rainy': ['bolt', 'Tormenta', 'con tormenta'],
    snowy: ['snow', 'Nieve', 'nevando'], 'snowy-rainy': ['snow', 'Aguanieve', 'con aguanieve'],
    windy: ['cloud', 'Ventoso', 'ventoso'], 'windy-variant': ['cloud', 'Ventoso', 'ventoso'], hail: ['rain', 'Granizo', 'granizando'],
  };
  const ALARM = {
    disarmed: ['Desactivada', 'off'], armed_home: ['Activada · En casa', 'on'], armed_away: ['Activada · Ausente', 'on'],
    armed_night: ['Activada · Noche', 'on'], armed_vacation: ['Activada · Vacaciones', 'on'], armed_custom_bypass: ['Activada', 'on'],
    arming: ['Activando…', 'wait'], pending: ['Ingreso detectado…', 'wait'], disarming: ['Desactivando…', 'wait'], triggered: ['¡Alarma disparada!', 'alert'],
  };
  const ALARM_SVC = { alarm_disarm: 'Desactivar alarma', alarm_arm_home: 'Activar · En casa', alarm_arm_away: 'Activar · Ausente', alarm_arm_night: 'Activar · Noche' };
  const MEDIA = { off: 'Apagado', on: 'Encendido', idle: 'En espera', standby: 'En espera', playing: 'Reproduciendo', paused: 'En pausa', buffering: 'Cargando…' };
  const SCENE_RULES = [
    [/cine|pel[ií]|movie|tv/i, 'tv'], [/noche|dormir|night|sleep|apagar/i, 'moon'], [/d[ií]a|ma[ñn]ana|morning|despert/i, 'sun'],
    [/cena|almuerzo|comer|dinner|asado/i, 'dining'], [/fiesta|party|m[uú]sica|music/i, 'music'], [/rom[aá]nt|amor/i, 'heart'],
    [/salgo|salir|away|vacacion|me voy/i, 'shield'], [/llegu|llegar|bienven|welcome/i, 'home'], [/cocin/i, 'cook'],
  ];
  const GRADS = [['#7c5cff', '#3fa9ff'], ['#ff6a8a', '#ff9e4a'], ['#16c8a6', '#3a7bff'], ['#f5a524', '#ff5e3a'], ['#b44cff', '#ff4fa3'], ['#2fd3ff', '#5b6cff'], ['#7ddc5a', '#14b8a6'], ['#ff7a59', '#c2408f']];

  /* ───────────────────────── Utilidades ───────────────────────── */
  /** El instalador apagó esta sección con `features: { clave: false }` (o las claves viejas: cameras/weather/people/alarm: false). */
  // iPhone / iPad: el visor de go2rtc y el video MJPEG hacen que iOS cierre la página (la app usa su propio video, vista.js)
  const IOS_DEV = typeof navigator !== 'undefined' && (/iPhone|iPad|iPod/.test(navigator.userAgent || '') || (/Macintosh/.test(navigator.userAgent || '') && navigator.maxTouchPoints > 1));
  const featOff = (c, k) => { const f = c.features || {}; return f[k] === false || (k === 'cameras' && c.cameras === false) || (k === 'weather' && c.weather === false) || (k === 'people' && c.people === false); };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const dom = (id) => id.slice(0, id.indexOf('.'));
  const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : null; };
  const fmt = (n, d = 1) => (n == null ? '–' : Number(n).toLocaleString('es-AR', { maximumFractionDigits: d }));
  const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
  const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
  const joinY = (a, max = 3) => {
    if (a.length > max) return a.slice(0, max).join(', ') + ` y ${a.length - max} más`;
    return a.length < 2 ? (a[0] || '') : a.slice(0, -1).join(', ') + ' y ' + a[a.length - 1];
  };
  const ago = (iso) => {
    const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
    if (m < 1) return 'recién';
    if (m < 60) return `hace ${m} min`;
    const h = Math.round(m / 60);
    return h < 24 ? `hace ${h} h` : `hace ${Math.round(h / 24)} d`;
  };
  /* Registro por tiempos */
  const ACT_CATS = [['all', 'Todo', 'sparkle'], ['luces', 'Luces', 'bulb'], ['aberturas', 'Aberturas', 'door'], ['movimiento', 'Movimiento', 'motion'],
    ['seguridad', 'Seguridad', 'shield'], ['clima', 'Clima', 'thermo'], ['multimedia', 'Multimedia', 'music'], ['equipos', 'Equipos', 'plug'], ['personas', 'Personas', 'home']];
  const ACT_ICON = Object.fromEntries(ACT_CATS.map(([k, , i]) => [k, i]));
  const ACT_ON_LABEL = { luces: 'encendida', aberturas: 'abierta', movimiento: 'con movimiento', personas: 'en casa', clima: 'encendido', multimedia: 'reproduciendo' };
  const isOnState = (s) => s === 'on' || s === 'open' || s === 'opening' || s === 'playing' || s === 'unlocked' || s === 'home'
    || ['heat', 'cool', 'heat_cool', 'auto', 'dry', 'fan_only'].includes(s) || String(s).startsWith('armed') || s === 'triggered';
  const fmtDur = (ms) => {
    const s = Math.max(0, Math.round(ms / 1000));
    if (s < 60) return `${s} s`;
    const m = Math.round(s / 60);
    if (m < 60) return `${m} min`;
    const h = Math.floor(m / 60), mm = m % 60;
    if (h < 24) return mm ? `${h} h ${mm} min` : `${h} h`;
    const d = Math.floor(h / 24), hh = h % 24;
    return hh ? `${d} d ${hh} h` : `${d} d`;
  };
  const periodOffset = (p) => (p === 'yesterday' ? 1 : /^day:\d+$/.test(p || '') ? Number(p.slice(4)) : 0);
  const periodLabel = (p) => {
    if (p === 'week') return 'Últimos 7 días';
    const n = periodOffset(p);
    if (n === 0) return 'Hoy';
    if (n === 1) return 'Ayer';
    const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - n);
    return cap(d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, ''));
  };
  const hhmm = (t) => new Date(t).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
  const dayLabel = (t) => {
    const d = new Date(t), today = new Date(); today.setHours(0, 0, 0, 0);
    const day = new Date(d); day.setHours(0, 0, 0, 0);
    const diff = Math.round((today - day) / 864e5);
    return diff === 0 ? 'Hoy' : diff === 1 ? 'Ayer' : diff === -1 ? 'Mañana' : cap(d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }));
  };
  const pad2 = (n) => String(n).padStart(2, '0');
  const mmss = (sec) => { const t = Math.max(0, Math.round(sec || 0)); const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), x = t % 60; return h ? `${h}:${pad2(m)}:${pad2(x)}` : `${m}:${pad2(x)}`; };
  const ymd = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  /** 42 días (6 semanas, de lunes a domingo) que muestra el calendario del mes. */
  const agGrid = (y, m) => { const off = (new Date(y, m, 1).getDay() + 6) % 7; return Array.from({ length: 42 }, (_, i) => new Date(y, m, 1 - off + i)); };
  const slug = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const minsSince = (iso) => (Date.now() - new Date(iso).getTime()) / 60000;
  const lightRGB = (st) => {
    const a = st.attributes;
    if (Array.isArray(a.rgb_color) && a.rgb_color.length === 3) {
      const [r, g, b] = a.rgb_color; const mx = Math.max(r, g, b, 1);
      const k = mx < 160 ? 160 / mx : 1; // evita colores apagados que no brillan
      return [r, g, b].map((v) => Math.min(255, Math.round(v * k))).join(',');
    }
    const kel = a.color_temp_kelvin || (a.color_temp ? Math.round(1e6 / a.color_temp) : null);
    if (kel) {
      const t = Math.min(1, Math.max(0, (kel - 2200) / 4300));
      return [255 - 25 * t, 170 + 66 * t, 90 + 165 * t].map(Math.round).join(',');
    }
    return '255,184,108';
  };

  /* ───────────────────────── Estilos ───────────────────────── */
  /* Estilos del historial: los usa la tarjeta y también la app (ventana de cada dispositivo). */
  const HIST_CSS = `
  .day-h{margin:18px 0 6px;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--mut)}
  .ev{position:relative;display:grid;grid-template-columns:58px 34px 1fr;gap:12px;align-items:start;padding:9px 6px;border-radius:14px}
  .ev[data-action]{cursor:pointer}.ev[data-action]:hover{background:rgba(255,255,255,.04)}
  .ev::before{content:"";position:absolute;left:calc(6px + 58px + 12px + 16px);top:44px;bottom:-9px;width:2px;background:rgba(255,255,255,.06)}
  .ev:last-child::before{display:none}
  .ev-time{text-align:right;font-variant-numeric:tabular-nums;padding-top:7px;line-height:1}.ev-time b{font-size:14px;font-weight:600}.ev-time small{font-size:10.5px;color:var(--mut)}
  .ev-dot{position:relative;width:34px;height:34px;border-radius:12px;display:grid;place-items:center;background:rgba(255,255,255,.06);color:var(--mut)}
  .ev-dot .ic{width:17px;height:17px}
  .ev.t-on .ev-dot{background:rgba(255,196,107,.16);color:#ffc46b}
  .ev.t-warn .ev-dot{background:rgba(255,120,90,.16);color:#ff9a7a}
  .ev.t-info .ev-dot{background:rgba(124,156,255,.16);color:#a9bcff}
  .ev-b{min-width:0;padding-top:1px}.ev-b b{display:block;font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .ev-b span{font-size:13px;color:rgba(238,241,248,.85)}.ev-b em{font-style:normal;color:var(--mut)}
  .ev-b small{display:block;font-size:11.5px;color:var(--mut);margin-top:2px}
  .ev-empty{padding:44px 10px;text-align:center;color:var(--mut);font-size:14px;line-height:1.6}
  .ev-empty .ic{width:30px;height:30px;display:block;margin:0 auto 10px;opacity:.6}
  .ev-more{display:flex;justify-content:center;margin-top:14px}
  .tl{margin:8px 0 6px;padding:16px;border-radius:20px;background:rgba(255,255,255,.04);border:1px solid var(--line)}
  .tl-l{display:flex;justify-content:space-between;font-size:11.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--mut);margin-bottom:10px}
  .tl-bar{position:relative;height:30px;border-radius:10px;background:rgba(255,255,255,.06);overflow:hidden}
  .tl-bar i{position:absolute;top:3px;bottom:3px;min-width:2px;border-radius:6px;background:linear-gradient(90deg,#ffb547,#ffd28a);box-shadow:0 0 12px rgba(255,181,71,.45)}
  .tl-bar.c-aberturas i{background:linear-gradient(90deg,#ff7a5a,#ffb08f);box-shadow:0 0 12px rgba(255,122,90,.45)}
  .tl-bar.c-movimiento i,.tl-bar.c-personas i{background:linear-gradient(90deg,#3ee6c4,#8ff5e0);box-shadow:0 0 12px rgba(62,230,196,.4)}
  .tl-bar.c-clima i,.tl-bar.c-multimedia i,.tl-bar.c-equipos i,.tl-bar.c-seguridad i{background:linear-gradient(90deg,#5b8cff,#a9bcff);box-shadow:0 0 12px rgba(91,140,255,.45)}
  .tl-bar u{position:absolute;top:0;bottom:0;width:1px;background:rgba(255,255,255,.08)}
  .tl-ticks{display:flex;justify-content:space-between;margin-top:6px;font-size:10.5px;color:var(--mut);font-variant-numeric:tabular-nums}
  .tl-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:14px}
  .tl-stats div{padding:10px 12px;border-radius:14px;background:rgba(255,255,255,.04)}.tl-stats b{display:block;font-size:17px;font-weight:600;font-variant-numeric:tabular-nums}.tl-stats small{font-size:11px;color:var(--mut)}
  .ev-time em{display:block;margin-top:4px;font-style:normal;font-size:10.5px;color:var(--mut);white-space:nowrap}
  .tl-bar i{cursor:pointer}
  .tl-bar i.na{background:repeating-linear-gradient(45deg,rgba(255,255,255,.18) 0 4px,transparent 4px 8px);box-shadow:none}
  .tl-bar .now{position:absolute;top:-3px;bottom:-3px;width:2px;margin-left:-1px;border-radius:2px;background:#fff;box-shadow:0 0 8px #fff}
  .tl-legend{display:flex;flex-wrap:wrap;gap:6px 14px;margin-top:12px;font-size:12px;color:var(--mut)}
  .tl-legend span{display:inline-flex;align-items:center;gap:6px}.tl-legend b{color:var(--txt,#eef1f8);font-weight:600}
  .tl-legend i{width:10px;height:10px;border-radius:3px;display:inline-block}
  .tl-legend i.na{background:repeating-linear-gradient(45deg,rgba(255,255,255,.35) 0 2px,transparent 2px 4px)}
  .tl-info{margin-top:10px;padding:9px 12px;border-radius:12px;background:rgba(255,255,255,.04);font-size:12.5px;color:var(--mut);font-variant-numeric:tabular-nums}
  .tl-info.on{color:var(--txt,#eef1f8);background:rgba(124,156,255,.14)}
  .hnav{display:inline-flex;align-items:center;gap:4px;padding:3px;border-radius:999px;background:rgba(255,255,255,.06);border:1px solid var(--line)}
  .hnav b{min-width:92px;text-align:center;font-size:13px;font-weight:600}
  .hnav button{width:30px;height:30px;border-radius:50%;display:grid;place-items:center;border:0;background:none;color:inherit;cursor:pointer}
  .hnav button:hover{background:rgba(255,255,255,.1)}.hnav button[disabled]{opacity:.25;pointer-events:none}
  .hnav .ic{width:16px;height:16px}.hnav .fwd .ic{transform:rotate(180deg)}
  .hchip{padding:7px 13px;border-radius:999px;font:inherit;font-size:12.5px;background:rgba(255,255,255,.05);border:1px solid var(--line);color:var(--mut);cursor:pointer}
  .hchip.on{background:#fff;color:#0b0e1a;border-color:transparent;font-weight:600}
  .stale{opacity:.45;pointer-events:none;transition:opacity .2s}
  `;

  const SCROLL_IDLE = 180; // ms sin eventos de scroll = el dedo paró
  const SCROLL_MAX_WAIT = 1500; // un cambio de estado nunca espera más que esto
  const CSS = `
  :host{display:block;--accent:#7c9cff;--txt:#eef1f8;--mut:rgba(238,241,248,.58);--line:rgba(255,255,255,.08);--glass:rgba(255,255,255,.045);--glass2:rgba(255,255,255,.075)}
  /* headless: la app dibuja su propio inicio; la tarjeta sólo abre sus ventanas (ambiente, clima, agenda, música, actividad, alarma, voz) */
  :host([headless]) .wrap,:host([headless]) .foot,:host([headless]) .aurora,:host([headless]) .dots{display:none!important}
  :host([headless]) .app{min-height:0;padding:0;background:transparent;overflow:visible}
  /* tema sobrio (grafito y acento cálido, como el inicio nuevo de la app) */
  :host([theme=sobrio]){--accent:#f2b766;--txt:#e9ecf2;--mut:#8f99ab;--line:rgba(160,175,200,.15);--glass:#262e3a;--glass2:#2e3644}
  :host([theme=sobrio]) .app,:host([theme=sobrio]) .app[data-phase]{--bg:#161b21;font-family:"Red Hat Display",system-ui,-apple-system,"Segoe UI",sans-serif}
  :host([theme=sobrio]) .sheet,:host([theme=sobrio]) .actv,:host([theme=sobrio]) .app.fluid .sheet,:host([theme=sobrio]) .app.fluid .actv{background:#1e242e!important;border-color:rgba(160,175,200,.15)!important}
  :host([theme=sobrio]) .backdrop,:host([theme=sobrio]) .app.fluid .backdrop{background:rgba(8,10,14,.6)!important}
  :host([theme=sobrio]) .glass,:host([theme=sobrio]) .app.fluid .glass{background:#262e3a!important;border-color:rgba(160,175,200,.15)!important;box-shadow:none!important}
  :host([theme=sobrio]) .toast,:host([theme=sobrio]) .app.fluid .toast{background:#262e3a!important;border:1px solid rgba(160,175,200,.15)}
  /* el estilo del dashboard (look=…, lo pone la vista) también en las ventanas: ambientes, paneles, actividad, música */
  :host([look=vision]),:host([look=vision][theme]){--accent:#fff;--txt:#fff;--mut:rgba(255,255,255,.6);--line:rgba(255,255,255,.14);--glass:rgba(255,255,255,.1);--glass2:rgba(255,255,255,.17)}
  :host([look=vision]) .app,:host([look=vision][theme]) .app,:host([look=vision][theme]) .app[data-phase]{font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","SF Pro Display","Helvetica Neue",system-ui,sans-serif}
  :host([look=vision][theme]) .app.fluid .sheet,:host([look=vision][theme]) .app.lite .sheet,:host([look=vision][theme]) .app .sheet,:host([look=vision]) .app.fluid .sheet,:host([look=vision]) .app .sheet,:host([look=vision]) .sheet,:host([look=vision][theme]) .app.fluid .actv,:host([look=vision][theme]) .app.lite .actv,:host([look=vision][theme]) .app .actv,:host([look=vision]) .app.fluid .actv,:host([look=vision]) .app .actv,:host([look=vision]) .actv,:host([look=vision][theme]) .app.fluid .pin,:host([look=vision][theme]) .app.lite .pin,:host([look=vision][theme]) .app .pin,:host([look=vision]) .app.fluid .pin,:host([look=vision]) .app .pin,:host([look=vision]) .pin,:host([look=vision][theme]) .app.fluid .toast,:host([look=vision][theme]) .app.lite .toast,:host([look=vision][theme]) .app .toast,:host([look=vision]) .app.fluid .toast,:host([look=vision]) .app .toast,:host([look=vision]) .toast{background:rgba(48,52,60,.76)!important;-webkit-backdrop-filter:blur(40px) saturate(1.7)!important;backdrop-filter:blur(40px) saturate(1.7)!important;border:0!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.24),inset 0 0 0 1px rgba(255,255,255,.08),0 -18px 60px rgba(0,0,0,.34)!important}
  :host([look=vision][theme]) .app.fluid .sheet,:host([look=vision][theme]) .app.lite .sheet,:host([look=vision][theme]) .app .sheet,:host([look=vision]) .app.fluid .sheet,:host([look=vision]) .app .sheet,:host([look=vision]) .sheet{border-radius:40px 40px 0 0}
  @media (min-width:900px){:host([look=vision][theme]) .app.fluid .sheet,:host([look=vision][theme]) .app.lite .sheet,:host([look=vision][theme]) .app .sheet,:host([look=vision]) .app.fluid .sheet,:host([look=vision]) .app .sheet,:host([look=vision]) .sheet{border-radius:40px}}
  :host([look=vision][theme]) .app.fluid .glass,:host([look=vision][theme]) .app.lite .glass,:host([look=vision][theme]) .app .glass,:host([look=vision]) .app.fluid .glass,:host([look=vision]) .app .glass,:host([look=vision]) .glass{background:rgba(255,255,255,.08)!important;border-color:transparent!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.12)!important}
  :host([look=vision][theme]) .app.fluid .backdrop,:host([look=vision][theme]) .app.lite .backdrop,:host([look=vision][theme]) .app .backdrop,:host([look=vision]) .app.fluid .backdrop,:host([look=vision]) .app .backdrop,:host([look=vision]) .backdrop{background:rgba(0,0,0,.28)!important}
  :host([look=vision][theme]) .app.fluid .actv.mus,:host([look=vision][theme]) .app.lite .actv.mus,:host([look=vision][theme]) .app .actv.mus,:host([look=vision]) .app.fluid .actv.mus,:host([look=vision]) .app .actv.mus,:host([look=vision]) .actv.mus{--mu-acc:#64d2ff;--mu-acc2:#0a84ff;--mu-grad:linear-gradient(135deg,#0a84ff,#64d2ff);--mu-bg:transparent;--mu-card:rgba(255,255,255,.08);--mu-mut:rgba(255,255,255,.6)}
  :host([look=apple]),:host([look=apple][theme]){--accent:#0a84ff;--txt:#fff;--mut:rgba(235,235,245,.6);--line:rgba(84,84,88,.55);--glass:#2c2c2e;--glass2:#3a3a3c}
  :host([look=apple]) .app,:host([look=apple][theme]) .app,:host([look=apple][theme]) .app[data-phase]{font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","SF Pro Display","Helvetica Neue",system-ui,sans-serif}
  :host([look=apple][theme]) .app.fluid .sheet,:host([look=apple][theme]) .app.lite .sheet,:host([look=apple][theme]) .app .sheet,:host([look=apple]) .app.fluid .sheet,:host([look=apple]) .app .sheet,:host([look=apple]) .sheet,:host([look=apple][theme]) .app.fluid .actv,:host([look=apple][theme]) .app.lite .actv,:host([look=apple][theme]) .app .actv,:host([look=apple]) .app.fluid .actv,:host([look=apple]) .app .actv,:host([look=apple]) .actv,:host([look=apple][theme]) .app.fluid .pin,:host([look=apple][theme]) .app.lite .pin,:host([look=apple][theme]) .app .pin,:host([look=apple]) .app.fluid .pin,:host([look=apple]) .app .pin,:host([look=apple]) .pin,:host([look=apple][theme]) .app.fluid .toast,:host([look=apple][theme]) .app.lite .toast,:host([look=apple][theme]) .app .toast,:host([look=apple]) .app.fluid .toast,:host([look=apple]) .app .toast,:host([look=apple]) .toast{background:#1c1c1e!important;border-color:rgba(84,84,88,.5)!important}
  :host([look=apple][theme]) .app.fluid .sheet,:host([look=apple][theme]) .app.lite .sheet,:host([look=apple][theme]) .app .sheet,:host([look=apple]) .app.fluid .sheet,:host([look=apple]) .app .sheet,:host([look=apple]) .sheet{border-radius:26px 26px 0 0}
  @media (min-width:900px){:host([look=apple][theme]) .app.fluid .sheet,:host([look=apple][theme]) .app.lite .sheet,:host([look=apple][theme]) .app .sheet,:host([look=apple]) .app.fluid .sheet,:host([look=apple]) .app .sheet,:host([look=apple]) .sheet{border-radius:26px}}
  :host([look=apple][theme]) .app.fluid .glass,:host([look=apple][theme]) .app.lite .glass,:host([look=apple][theme]) .app .glass,:host([look=apple]) .app.fluid .glass,:host([look=apple]) .app .glass,:host([look=apple]) .glass{background:#2c2c2e!important;border-color:transparent!important;box-shadow:none!important}
  :host([look=apple][theme]) .app.fluid .backdrop,:host([look=apple][theme]) .app.lite .backdrop,:host([look=apple][theme]) .app .backdrop,:host([look=apple]) .app.fluid .backdrop,:host([look=apple]) .app .backdrop,:host([look=apple]) .backdrop{background:rgba(0,0,0,.5)!important}
  :host([look=cristal]),:host([look=cristal][theme]){--accent:#7cc4f0;--txt:#f2f6fb;--mut:rgba(242,246,251,.62);--line:rgba(255,255,255,.14);--glass:rgba(255,255,255,.08);--glass2:rgba(255,255,255,.14)}
  :host([look=cristal]) .app,:host([look=cristal][theme]) .app,:host([look=cristal][theme]) .app[data-phase]{font-family:"Inter",system-ui,-apple-system,"Segoe UI",sans-serif}
  :host([look=cristal][theme]) .app.fluid .sheet,:host([look=cristal][theme]) .app.lite .sheet,:host([look=cristal][theme]) .app .sheet,:host([look=cristal]) .app.fluid .sheet,:host([look=cristal]) .app .sheet,:host([look=cristal]) .sheet,:host([look=cristal][theme]) .app.fluid .actv,:host([look=cristal][theme]) .app.lite .actv,:host([look=cristal][theme]) .app .actv,:host([look=cristal]) .app.fluid .actv,:host([look=cristal]) .app .actv,:host([look=cristal]) .actv,:host([look=cristal][theme]) .app.fluid .pin,:host([look=cristal][theme]) .app.lite .pin,:host([look=cristal][theme]) .app .pin,:host([look=cristal]) .app.fluid .pin,:host([look=cristal]) .app .pin,:host([look=cristal]) .pin,:host([look=cristal][theme]) .app.fluid .toast,:host([look=cristal][theme]) .app.lite .toast,:host([look=cristal][theme]) .app .toast,:host([look=cristal]) .app.fluid .toast,:host([look=cristal]) .app .toast,:host([look=cristal]) .toast{background:rgba(24,38,58,.93)!important;border-color:rgba(255,255,255,.14)!important}
  :host([look=cristal][theme]) .app.fluid .sheet,:host([look=cristal][theme]) .app.lite .sheet,:host([look=cristal][theme]) .app .sheet,:host([look=cristal]) .app.fluid .sheet,:host([look=cristal]) .app .sheet,:host([look=cristal]) .sheet{border-radius:30px 30px 0 0}
  @media (min-width:900px){:host([look=cristal][theme]) .app.fluid .sheet,:host([look=cristal][theme]) .app.lite .sheet,:host([look=cristal][theme]) .app .sheet,:host([look=cristal]) .app.fluid .sheet,:host([look=cristal]) .app .sheet,:host([look=cristal]) .sheet{border-radius:30px}}
  :host([look=cristal][theme]) .app.fluid .glass,:host([look=cristal][theme]) .app.lite .glass,:host([look=cristal][theme]) .app .glass,:host([look=cristal]) .app.fluid .glass,:host([look=cristal]) .app .glass,:host([look=cristal]) .glass{background:rgba(255,255,255,.08)!important;border-color:rgba(255,255,255,.12)!important}
  :host([look=cristal][theme]) .app.fluid .backdrop,:host([look=cristal][theme]) .app.lite .backdrop,:host([look=cristal][theme]) .app .backdrop,:host([look=cristal]) .app.fluid .backdrop,:host([look=cristal]) .app .backdrop,:host([look=cristal]) .backdrop{background:rgba(4,10,20,.55)!important}
  :host([look=control4]),:host([look=control4][theme]){--accent:#5aa2ff;--txt:#f3f2f7;--mut:#a3a0b2;--line:rgba(255,255,255,.07);--glass:#2a2836;--glass2:#363345}
  :host([look=control4]) .app,:host([look=control4][theme]) .app,:host([look=control4][theme]) .app[data-phase]{font-family:"Roboto","Helvetica Neue","Segoe UI",system-ui,sans-serif}
  :host([look=control4][theme]) .app.fluid .sheet,:host([look=control4][theme]) .app.lite .sheet,:host([look=control4][theme]) .app .sheet,:host([look=control4]) .app.fluid .sheet,:host([look=control4]) .app .sheet,:host([look=control4]) .sheet,:host([look=control4][theme]) .app.fluid .actv,:host([look=control4][theme]) .app.lite .actv,:host([look=control4][theme]) .app .actv,:host([look=control4]) .app.fluid .actv,:host([look=control4]) .app .actv,:host([look=control4]) .actv,:host([look=control4][theme]) .app.fluid .pin,:host([look=control4][theme]) .app.lite .pin,:host([look=control4][theme]) .app .pin,:host([look=control4]) .app.fluid .pin,:host([look=control4]) .app .pin,:host([look=control4]) .pin,:host([look=control4][theme]) .app.fluid .toast,:host([look=control4][theme]) .app.lite .toast,:host([look=control4][theme]) .app .toast,:host([look=control4]) .app.fluid .toast,:host([look=control4]) .app .toast,:host([look=control4]) .toast{background:#1f1d29!important;border-color:rgba(255,255,255,.07)!important}
  :host([look=control4][theme]) .app.fluid .sheet,:host([look=control4][theme]) .app.lite .sheet,:host([look=control4][theme]) .app .sheet,:host([look=control4]) .app.fluid .sheet,:host([look=control4]) .app .sheet,:host([look=control4]) .sheet{border-radius:16px 16px 0 0}
  @media (min-width:900px){:host([look=control4][theme]) .app.fluid .sheet,:host([look=control4][theme]) .app.lite .sheet,:host([look=control4][theme]) .app .sheet,:host([look=control4]) .app.fluid .sheet,:host([look=control4]) .app .sheet,:host([look=control4]) .sheet{border-radius:16px}}
  :host([look=control4][theme]) .app.fluid .glass,:host([look=control4][theme]) .app.lite .glass,:host([look=control4][theme]) .app .glass,:host([look=control4]) .app.fluid .glass,:host([look=control4]) .app .glass,:host([look=control4]) .glass{background:#2a2836!important;border-color:transparent!important;box-shadow:none!important}
  :host([look=control4][theme]) .app.fluid .backdrop,:host([look=control4][theme]) .app.lite .backdrop,:host([look=control4][theme]) .app .backdrop,:host([look=control4]) .app.fluid .backdrop,:host([look=control4]) .app .backdrop,:host([look=control4]) .backdrop{background:rgba(10,8,16,.6)!important}
  :host([look=control4][theme]) .app.fluid .actv.mus,:host([look=control4][theme]) .app.lite .actv.mus,:host([look=control4][theme]) .app .actv.mus,:host([look=control4]) .app.fluid .actv.mus,:host([look=control4]) .app .actv.mus,:host([look=control4]) .actv.mus{--mu-acc:#5aa2ff;--mu-acc2:#5aa2ff;--mu-grad:linear-gradient(135deg,#3d7ff0,#5aa2ff);--mu-bg:#17141f;--mu-card:#2a2836}
  :host([look=savant]),:host([look=savant][theme]){--accent:#c9a96e;--txt:#f4f1ea;--mut:#8b877e;--line:rgba(255,255,255,.07);--glass:#161616;--glass2:#1f1f1f}
  :host([look=savant]) .app,:host([look=savant][theme]) .app,:host([look=savant][theme]) .app[data-phase]{font-family:"Helvetica Neue","Segoe UI Light","Segoe UI",system-ui,sans-serif}
  :host([look=savant][theme]) .app.fluid .sheet,:host([look=savant][theme]) .app.lite .sheet,:host([look=savant][theme]) .app .sheet,:host([look=savant]) .app.fluid .sheet,:host([look=savant]) .app .sheet,:host([look=savant]) .sheet,:host([look=savant][theme]) .app.fluid .actv,:host([look=savant][theme]) .app.lite .actv,:host([look=savant][theme]) .app .actv,:host([look=savant]) .app.fluid .actv,:host([look=savant]) .app .actv,:host([look=savant]) .actv,:host([look=savant][theme]) .app.fluid .pin,:host([look=savant][theme]) .app.lite .pin,:host([look=savant][theme]) .app .pin,:host([look=savant]) .app.fluid .pin,:host([look=savant]) .app .pin,:host([look=savant]) .pin,:host([look=savant][theme]) .app.fluid .toast,:host([look=savant][theme]) .app.lite .toast,:host([look=savant][theme]) .app .toast,:host([look=savant]) .app.fluid .toast,:host([look=savant]) .app .toast,:host([look=savant]) .toast{background:#0b0b0b!important;border-color:rgba(255,255,255,.07)!important}
  :host([look=savant][theme]) .app.fluid .sheet,:host([look=savant][theme]) .app.lite .sheet,:host([look=savant][theme]) .app .sheet,:host([look=savant]) .app.fluid .sheet,:host([look=savant]) .app .sheet,:host([look=savant]) .sheet{border-radius:8px 8px 0 0}
  @media (min-width:900px){:host([look=savant][theme]) .app.fluid .sheet,:host([look=savant][theme]) .app.lite .sheet,:host([look=savant][theme]) .app .sheet,:host([look=savant]) .app.fluid .sheet,:host([look=savant]) .app .sheet,:host([look=savant]) .sheet{border-radius:8px}}
  :host([look=savant][theme]) .app.fluid .glass,:host([look=savant][theme]) .app.lite .glass,:host([look=savant][theme]) .app .glass,:host([look=savant]) .app.fluid .glass,:host([look=savant]) .app .glass,:host([look=savant]) .glass{background:#161616!important;border-color:transparent!important;box-shadow:none!important}
  :host([look=savant][theme]) .app.fluid .backdrop,:host([look=savant][theme]) .app.lite .backdrop,:host([look=savant][theme]) .app .backdrop,:host([look=savant]) .app.fluid .backdrop,:host([look=savant]) .app .backdrop,:host([look=savant]) .backdrop{background:rgba(0,0,0,.66)!important}
  :host([look=savant][theme]) .app.fluid .actv.mus,:host([look=savant][theme]) .app.lite .actv.mus,:host([look=savant][theme]) .app .actv.mus,:host([look=savant]) .app.fluid .actv.mus,:host([look=savant]) .app .actv.mus,:host([look=savant]) .actv.mus{--mu-acc:#c9a96e;--mu-acc2:#c9a96e;--mu-grad:linear-gradient(135deg,#a7843f,#c9a96e);--mu-bg:#050505;--mu-card:#161616}
  *{box-sizing:border-box}
  button{font:inherit;color:inherit;border:0;background:none;cursor:pointer;padding:0}
  .ic{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round;flex:none}
  .app{position:relative;min-height:calc(100vh - var(--header-height,56px));padding:22px clamp(16px,3.5vw,44px) 36px;color:var(--txt);background:var(--bg);overflow:hidden;
    font-family:"Inter","SF Pro Display",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;-webkit-font-smoothing:antialiased;transition:background 2s}
  .app[data-phase=night]{--bg:#05060d;--au1:#2b1d8f;--au2:#0b4fa8;--au3:#4b1680}
  .app[data-phase=golden]{--bg:#0c0710;--au1:#b8442e;--au2:#7a2c9e;--au3:#c27a1f}
  .app[data-phase=day]{--bg:#06101f;--au1:#1360c9;--au2:#0e8f8a;--au3:#4f43c9}
  .aurora{position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:0}
  /* modo liviano (tablets): el desenfoque en vivo y los fondos animados son lo que traba al deslizar */
  .app.lite .aurora i{animation:none!important;filter:none!important;opacity:.22}
  .app.lite *,.app.lite *::before,.app.lite *::after{-webkit-backdrop-filter:none!important;backdrop-filter:none!important}
  .app.lite .orb i,.app.lite .orb::before,.app.lite .eq i,.app.lite .pill.on.k-fan .pi .ic{animation:none!important}
  .app.lite .sheet,.app.lite .actv,.app.lite .vo{background:rgba(14,16,28,.98)}
  /* modo fluido (celulares y tablets): el mismo diseño sin lo que el teléfono recalcula en cada cuadro al deslizar.
     - Fondo: manchas de borde suave (máscara) en vez de un desenfoque de 90px; sólo se mueven, eso lo hace la GPU sin redibujar.
     - Vidrio: sin desenfoque en vivo de lo que hay detrás (sobre un fondo ya difuso casi no se nota); un tono un poco más denso. */
  .app.fluid .aurora i,.app.lite .aurora i{filter:none;-webkit-mask-image:radial-gradient(closest-side,#000 35%,transparent);mask-image:radial-gradient(closest-side,#000 35%,transparent)}
  .app.fluid .aurora i{will-change:transform}
  .app.lite .aurora i{opacity:.32}
  .app.fluid *,.app.fluid *::before,.app.fluid *::after{-webkit-backdrop-filter:none!important;backdrop-filter:none!important}
  .app.fluid .glass{background:linear-gradient(180deg,rgba(255,255,255,.075),rgba(255,255,255,.035)),rgba(10,12,24,.42)}
  .app.fluid .pz-l,.app.fluid .plan-tag,.app.fluid .pdev:not(.on),.app.fluid .ppin{background-color:rgba(8,10,20,.82)}
  .app.fluid .plan-hint{background:rgba(8,10,20,.88)}
  .app.fluid .cam-l{background:rgba(0,0,0,.62)}
  .app.fluid .orb-core{background:rgba(6,8,18,.72)}
  .app.fluid .orb i{animation-name:spin}
  .app.fluid .orb i:nth-child(3){filter:none;opacity:.2}
  .app.fluid .backdrop{background:rgba(3,4,10,.72)}
  .app.fluid .vo-wrap .backdrop{background:rgba(3,4,10,.9)}
  .app.fluid .sheet{background:rgba(14,16,28,.985)}
  .app.fluid .actv{background:rgba(8,10,20,.99)}
  .app.fluid .mf{background:linear-gradient(180deg,rgba(var(--mc),.78) 0%,rgba(var(--mc),.42) 50%,rgba(7,9,18,.62) 100%),#080a14}
  .app.fluid .toast{background:rgba(20,23,38,.97)}
  .aurora i{position:absolute;width:60vmax;height:60vmax;border-radius:50%;filter:blur(90px);opacity:.5;animation:drift 28s ease-in-out infinite alternate;transition:background 3s}
  .aurora .a1{background:var(--au1);top:-28vmax;left:-18vmax}
  .aurora .a2{background:var(--au2);top:8vmax;right:-28vmax;animation-duration:36s}
  .aurora .a3{background:var(--au3);top:70vmax;left:15vmax;animation-duration:44s;opacity:.35}
  .dots{position:absolute;inset:0;pointer-events:none;z-index:0;background-image:radial-gradient(rgba(255,255,255,.07) 1px,transparent 1.2px);background-size:22px 22px;
    -webkit-mask-image:linear-gradient(to bottom,#000,transparent 55%);mask-image:linear-gradient(to bottom,#000,transparent 55%)}
  @keyframes drift{to{transform:translate(9vmax,7vmax) scale(1.18)}}
  @keyframes spin{to{transform:rotate(360deg)}}
  @keyframes rise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
  @keyframes pulse{0%{box-shadow:0 0 0 0 rgba(var(--pc,62,230,196),.6)}100%{box-shadow:0 0 0 10px rgba(var(--pc,62,230,196),0)}}
  @keyframes morph{0%{transform:rotate(0)}50%{border-radius:58% 42% 37% 63%/56% 59% 41% 44%}100%{transform:rotate(360deg)}}
  @keyframes blink{50%{opacity:0}}
  .wrap{position:relative;z-index:1;max-width:1480px;margin:0 auto;container:mae/inline-size}
  .glass{background:var(--glass);border:1px solid var(--line);border-radius:28px;-webkit-backdrop-filter:blur(22px) saturate(1.3);backdrop-filter:blur(22px) saturate(1.3)}

  /* Barra superior */
  .top{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:22px}
  .brand{display:flex;align-items:center;gap:10px;font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:var(--mut)}
  .brand b{color:var(--txt);font-weight:700}
  .mono{width:30px;height:30px;border-radius:10px;display:grid;place-items:center;font-weight:800;font-size:14px;letter-spacing:0;color:#fff;background:linear-gradient(135deg,var(--accent),#3ee6c4);box-shadow:0 6px 20px rgba(124,156,255,.35)}
  .brand img{height:30px;width:auto;border-radius:8px}
  .top-r{display:flex;align-items:center;gap:18px}
  .wx{display:flex;align-items:center;gap:8px;padding:8px 14px;border-radius:999px;background:var(--glass);border:1px solid var(--line);font-size:13px;color:var(--mut)}
  .wx b{color:var(--txt);font-size:15px}
  .clock{text-align:right;line-height:1}
  .clock b{display:block;font-size:34px;font-weight:300;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
  .clock span{font-size:12px;color:var(--mut);text-transform:capitalize}
  .clock.static{cursor:default;pointer-events:none}

  .layout{display:grid;grid-template-columns:minmax(330px,430px) 1fr;gap:24px;align-items:start}
  .col-l,.col-r{display:flex;flex-direction:column;gap:18px;min-width:0}
  .col-l{position:sticky;top:12px}
  section:empty{display:none}

  /* Hero */
  .hero{padding:24px;position:relative;overflow:hidden}
  .hero-row{display:flex;gap:20px;align-items:center}
  .orb{--o1:#3ee6c4;--o2:#4a7dff;position:relative;width:118px;height:118px;flex:none;transition:filter .6s}
  .orb i{position:absolute;inset:8px;border-radius:42% 58% 63% 37%/41% 44% 56% 59%;background:linear-gradient(135deg,var(--o1),var(--o2));opacity:.6;animation:morph 8s linear infinite;transition:background 1s}
  .orb i:nth-child(2){animation-duration:11s;animation-direction:reverse;opacity:.45;background:linear-gradient(45deg,var(--o2),var(--o1))}
  .orb i:nth-child(3){inset:-4px;opacity:.35;filter:blur(20px);animation-duration:14s}
  .orb::before{content:"";position:absolute;inset:-7px;border-radius:50%;background:conic-gradient(from 0deg,transparent 0 60%,var(--o1) 85%,transparent);animation:spin 5s linear infinite;
    -webkit-mask:radial-gradient(farthest-side,transparent calc(100% - 2px),#000 calc(100% - 1.5px));mask:radial-gradient(farthest-side,transparent calc(100% - 2px),#000 calc(100% - 1.5px));opacity:.8}
  .orb-core{position:absolute;inset:27px;border-radius:50%;background:rgba(6,8,18,.5);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);display:grid;place-items:center;text-align:center;border:1px solid rgba(255,255,255,.16);line-height:1}
  .orb-core b{font-size:22px;font-weight:600;letter-spacing:-.02em}
  .orb-core small{display:block;font-size:9.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--mut);margin-top:3px}
  .orb[data-level=attention]{--o1:#ffc04d;--o2:#ff6a3d}
  .orb[data-level=alert]{--o1:#ff3d5a;--o2:#ff9a3d}
  .orb[data-level=alert] i{animation-duration:2.2s}
  .orb[data-level=armed]{--o1:#9b87ff;--o2:#3fa9ff}
  .hello{font-size:13.5px;color:var(--mut);margin-bottom:4px}
  .hero h1{margin:0;font-size:clamp(24px,2.3vw,30px);line-height:1.12;font-weight:650;letter-spacing:-.025em;background:linear-gradient(100deg,#fff 30%,rgba(255,255,255,.62));-webkit-background-clip:text;background-clip:text;color:transparent}
  .ai-tag{display:inline-flex;align-items:center;gap:6px;margin-top:18px;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--accent)}
  .ai-tag .ic{width:14px;height:14px}
  .insight{margin:8px 0 0;font-size:14.5px;line-height:1.55;color:rgba(238,241,248,.82);min-height:3.1em}
  .insight.typing::after{content:"";display:inline-block;width:2px;height:1em;margin-left:2px;vertical-align:-2px;background:var(--accent);animation:blink .8s steps(1) infinite}
  .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:20px}
  .stat{padding:12px 10px;border-radius:18px;background:rgba(255,255,255,.04);border:1px solid var(--line);display:flex;flex-direction:column;gap:6px}
  .stat .ic{width:18px;height:18px;color:var(--mut)}
  .stat b{font-size:19px;font-weight:600;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
  .stat small{font-size:11px;color:var(--mut)}
  .stat.hot .ic{color:#ffc46b}.stat.warn{border-color:rgba(255,170,70,.35)}.stat.warn .ic{color:#ffb04d}.stat.ok .ic{color:#3ee6c4}
  button.stat{position:relative;font:inherit;color:inherit;text-align:left;cursor:pointer;transition:transform .15s,border-color .25s,background .25s}
  button.stat:hover{border-color:rgba(255,255,255,.2);background:rgba(255,255,255,.07)}
  button.stat:active{transform:scale(.96)}
  .stat em{font-style:normal;font-size:10.5px;color:var(--mut);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:-2px}
  .stat.warn em{color:#ffc46b}
  .stat .go{position:absolute;top:10px;right:10px;opacity:.35;transition:opacity .2s}
  .stat .go .ic{width:13px;height:13px;transform:rotate(180deg)}
  button.stat:hover .go{opacity:.9}
  .ilink{font:inherit;color:#fff;font-weight:600;background:none;border:0;padding:0;cursor:pointer;text-decoration:underline;text-decoration-color:rgba(124,156,255,.55);text-decoration-thickness:2px;text-underline-offset:3px}
  .ilink:hover{text-decoration-color:var(--accent)}
  #headline,#orb{cursor:pointer}
  .ptabs{display:flex;gap:4px;padding:4px;margin:0 0 6px;border-radius:999px;background:rgba(255,255,255,.06);border:1px solid var(--line)}
  .ptabs button{flex:1;padding:9px 12px;border-radius:999px;font-size:13px;font-weight:500;color:var(--mut)}
  .ptabs button.on{background:#fff;color:#0b0e1a;font-weight:600}
  .pbig{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;margin-top:20px;padding:15px;border-radius:18px;font-size:15px;font-weight:600;
    background:rgba(255,255,255,.07);border:1px solid var(--line)}
  .pbig:active{transform:scale(.98)}
  .pempty{display:flex;flex-direction:column;align-items:center;gap:6px;padding:30px 10px;text-align:center;color:var(--mut);font-size:13px}
  .pempty .ic{width:34px;height:34px;opacity:.7;margin-bottom:6px}.pempty b{color:var(--txt);font-size:16px}
  .pempty.ok .ic{color:#3ee6c4;opacity:1}
  .blk-h h4.lk{cursor:pointer}.blk-h h4.lk:hover{color:var(--txt)}
  .tsum{display:grid;grid-template-columns:repeat(auto-fit,minmax(90px,1fr));gap:8px;margin:10px 0 8px}
  .tsum div{padding:12px 14px;border-radius:18px;background:rgba(255,255,255,.04);border:1px solid var(--line)}
  .tsum small{display:block;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--mut)}.tsum b{font-size:24px;font-weight:300;letter-spacing:-.02em}
  .trow{display:flex;align-items:center;gap:12px;padding:12px;margin-top:8px;border-radius:20px;background:rgba(255,255,255,.04);border:1px solid var(--line);cursor:pointer;transition:background .2s}
  .trow:hover{background:rgba(255,255,255,.07)}
  .trow .ri{width:42px;height:42px;border-radius:14px;flex:none}
  .tt{flex:1;min-width:0}.tt b{display:flex;align-items:center;flex-wrap:wrap;gap:6px;font-size:14.5px;font-weight:600}
  .tt span{display:block;font-size:12px;color:var(--mut);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .tb{font-style:normal;font-size:10px;font-weight:600;letter-spacing:.04em;padding:2px 7px;border-radius:999px;background:rgba(124,156,255,.18);color:#c9d5ff}
  .tbar{position:relative;height:6px;margin-top:9px;border-radius:6px;background:linear-gradient(90deg,#46a0ff,#3ee6c4 45%,#ffc04d 75%,#ff6a3d)}
  .tbar.h{background:linear-gradient(90deg,#ffc04d,#3ee6c4 40%,#46a0ff 75%,#7c5cff)}
  .tbar i{position:absolute;top:50%;width:14px;height:14px;margin:-7px 0 0 -7px;border-radius:50%;background:#fff;box-shadow:0 0 0 3px rgba(8,10,20,.8),0 0 12px rgba(255,255,255,.7)}
  .tv{text-align:right;flex:none;min-width:62px}.tv b{display:block;font-size:22px;font-weight:300;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
  /* clima y reloj tocables */
  .wx{cursor:pointer;transition:border-color .2s,background .2s}.wx:hover{border-color:rgba(255,255,255,.2);background:rgba(255,255,255,.08)}
  .clock{cursor:pointer;border-radius:14px;padding:4px 8px;margin:-4px -8px;transition:background .2s}.clock:hover{background:rgba(255,255,255,.06)}
  /* pronóstico */
  .wnow{margin:2px 0 6px}
  .wbig{display:flex;align-items:center;gap:14px}.wbig>.ic{width:54px;height:54px;color:#ffd28a}
  .wbig b{font-size:60px;font-weight:200;letter-spacing:-.04em;line-height:1}
  .wbig span{display:flex;flex-direction:column;font-size:16px;font-weight:600}.wbig small{font-size:12.5px;font-weight:400;color:var(--mut);margin-top:3px}
  .wchips{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}
  .wloc{display:flex;align-items:flex-start;gap:10px;margin:12px 2px 4px;font-size:13px;color:rgba(255,255,255,.8)}.wloc .ic{width:17px;height:17px;flex:none;margin-top:1px;opacity:.75}
  .wloc b{font-weight:600}.wloc small{display:block;font-size:11.5px;opacity:.6;margin-top:2px}
  .wchips span{display:inline-flex;align-items:center;gap:6px;padding:8px 12px;border-radius:999px;background:rgba(255,255,255,.05);border:1px solid var(--line);font-size:12.5px;color:var(--mut)}
  .wchips b{color:var(--txt)}.wchips .ic{width:15px;height:15px}
  .hrs{display:flex;gap:8px;overflow-x:auto;scrollbar-width:none;padding-bottom:4px}.hrs::-webkit-scrollbar{display:none}
  .hr{flex:none;width:62px;display:flex;flex-direction:column;align-items:center;gap:6px;padding:12px 4px;border-radius:18px;background:rgba(255,255,255,.04);border:1px solid var(--line)}
  .hr small{font-size:11.5px;color:var(--mut)}.hr .ic{width:22px;height:22px}.hr b{font-size:15px}
  .hr em{font-style:normal;font-size:10.5px;color:#7cc8ff;display:inline-flex;align-items:center;gap:2px}.hr em .ic{width:11px;height:11px}
  .dy{display:grid;grid-template-columns:76px 26px 34px 34px 1fr 34px;align-items:center;gap:8px;padding:10px 4px;border-bottom:1px solid var(--line)}
  .dy:last-child{border-bottom:0}.dy b{font-size:14px;font-weight:600}.dy .ic{width:22px;height:22px}
  .dy em{font-style:normal;font-size:11.5px;color:#7cc8ff}.dy .lo{text-align:right;color:var(--mut);font-variant-numeric:tabular-nums}.dy .hi{font-weight:600;font-variant-numeric:tabular-nums}
  .dbar{position:relative;height:6px;border-radius:6px;background:rgba(255,255,255,.07)}
  .dbar i{position:absolute;top:0;bottom:0;border-radius:6px;background:linear-gradient(90deg,#46a0ff,#ffc04d,#ff6a3d)}
  /* agenda */
  .cal{margin:14px 0 4px;padding:14px;border-radius:24px;background:rgba(255,255,255,.035);border:1px solid var(--line);transition:opacity .2s}
  .cal-h{display:flex;align-items:center;gap:8px;margin-bottom:10px}
  .cal-h b{flex:1;text-align:center;font-size:16px;font-weight:650;letter-spacing:-.01em}
  .cal-h .fwd .ic{transform:rotate(180deg)}
  .cal-w{display:grid;grid-template-columns:repeat(7,1fr);margin-bottom:4px}
  .cal-w span{text-align:center;font-size:11px;font-weight:600;letter-spacing:.06em;color:var(--mut);padding:4px 0}
  .cal-g{display:grid;grid-template-columns:repeat(7,1fr);gap:4px}
  .cd{position:relative;aspect-ratio:1;max-height:54px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;border-radius:14px;font:inherit;color:var(--txt);transition:background .15s,transform .1s}
  .cd b{font-size:14.5px;font-weight:500;font-variant-numeric:tabular-nums}
  .cd:hover{background:rgba(255,255,255,.07)}.cd:active{transform:scale(.92)}
  .cd.o{color:rgba(238,241,248,.28)}.cd.we:not(.o) b{color:rgba(238,241,248,.75)}
  .cd.t{box-shadow:inset 0 0 0 2px var(--accent)}.cd.t b{color:#c9d5ff;font-weight:700}
  .cd.s{background:linear-gradient(135deg,#2f6bff,#003eff);box-shadow:0 8px 20px -8px rgba(0,62,255,.9)}.cd.s b{color:#fff;font-weight:700}
  .dots{display:flex;gap:3px;height:5px}.dots i{width:5px;height:5px;border-radius:50%}
  .cd.s .dots i{box-shadow:0 0 0 1px rgba(255,255,255,.6)}
  .pempty.sm{padding:16px 10px;flex-direction:row;justify-content:center;gap:10px}.pempty.sm .ic{width:20px;height:20px;margin:0}
  .agclock{text-align:center;margin:-4px 0 14px}.agclock b{font-size:64px;font-weight:200;letter-spacing:-.03em;font-variant-numeric:tabular-nums}
  .agbtns{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:6px}
  .agbtns button{display:flex;flex-direction:column;align-items:center;gap:7px;padding:14px 6px;border-radius:20px;background:rgba(255,255,255,.06);border:1px solid var(--line);font-size:13px;font-weight:600}
  .agbtns button .ic{width:24px;height:24px;color:#a9bcff}.agbtns button[disabled]{opacity:.35}
  .agbtns button:active{transform:scale(.96)}
  .agi{display:flex;align-items:center;gap:12px;padding:10px 6px;border-radius:14px}
  .agi+.agi{border-top:1px solid var(--line)}
  .agt{width:58px;text-align:right;flex:none;line-height:1.15;font-variant-numeric:tabular-nums}.agt b{font-size:14px;font-weight:600}.agt small{display:block;font-size:11px;color:var(--mut)}
  .agc{width:10px;height:36px;border-radius:6px;flex:none}
  .agc.ic2{width:34px;height:34px;border-radius:12px;display:grid;place-items:center;background:rgba(247,184,79,.16);color:#ffc46b}
  .agi.alarm .agc.ic2{background:rgba(255,107,107,.16);color:#ff8f8f}
  .agc .ic{width:17px;height:17px}
  .agb{flex:1;min-width:0}.agb b{display:block;font-size:14.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.agb span{display:block;font-size:12px;color:var(--mut);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .agi.off{opacity:.5}
  .agform{padding:4px 2px}
  .agform h3{display:flex;align-items:center;gap:8px;margin:0 0 6px;font-size:16px}.agform h3 .ic{width:20px;height:20px;color:#a9bcff}
  .fl{display:flex;flex-direction:column;gap:6px;margin-top:12px;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--mut);flex:1;min-width:0}
  .fin{width:100%;padding:13px 14px;border-radius:14px;border:1px solid var(--line);background:rgba(255,255,255,.06);color:var(--txt);font:inherit;font-size:15px;letter-spacing:0;text-transform:none;outline:none;color-scheme:dark}
  .fin:focus{border-color:rgba(124,156,255,.7)}
  .frow{display:flex;gap:10px;flex-wrap:wrap}
  .agform .lbl{display:block;margin:16px 0 8px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--mut)}
  .agform .opts{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}
  .agform .opt{display:inline-flex;align-items:center;gap:7px;padding:10px 14px;border-radius:14px;background:rgba(255,255,255,.06);border:1px solid var(--line);font-size:13.5px}
  .agform .opt .ic{width:15px;height:15px}
  .agform .opt.on{background:linear-gradient(135deg,#2f6bff,#003eff);border-color:transparent;color:#fff;font-weight:600}
  .agform .opts.days .opt{width:42px;justify-content:center;padding:10px 0}
  .agfb{display:grid;grid-template-columns:1fr 1.4fr;gap:10px;margin-top:20px}.agfb .pbig{margin-top:0}
  .pbig.main{background:linear-gradient(135deg,#2f6bff,#003eff);border-color:transparent;color:#fff}
  .hint2{margin:12px 2px 0;font-size:12px;color:var(--mut)}.hint2.warn{color:#ffc46b}
  .mtrs{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:8px}
  .mtr{display:grid;grid-template-columns:auto auto 1fr;align-items:center;gap:5px;opacity:.75}
  .mtr.main{opacity:1}.mtr .ic{width:14px;height:14px}.mtr b{font-size:12.5px;font-weight:700;font-variant-numeric:tabular-nums;min-width:38px}
  .mtr .tbar{margin-top:0;height:5px}.mtr .tbar i{width:11px;height:11px;margin:-5.5px 0 0 -5.5px}
  .cf{font-size:10.5px;font-weight:600}.cf.ok{color:#7ff0d6}.cf.warm{color:#ffb070}.cf.cool{color:#8fc2ff}
  .ib.sm{width:36px;height:36px}.ib.sm .ic{width:16px;height:16px}.ib.sm.on{background:#2f6bff;color:#fff}

  /* Sugerencias */
  .sug{display:flex;gap:14px;padding:16px;border-radius:22px;background:linear-gradient(135deg,rgba(124,156,255,.14),rgba(62,230,196,.06));border:1px solid rgba(124,156,255,.25);position:relative;animation:rise .5s both}
  .sug+.sug{margin-top:10px}
  .sug .si{width:40px;height:40px;border-radius:14px;display:grid;place-items:center;background:rgba(124,156,255,.2);color:#c9d5ff;flex:none}
  .sug b{display:block;font-size:14px;font-weight:600}
  .sug p{margin:3px 0 10px;font-size:12.5px;color:var(--mut);line-height:1.45}
  .sug .sx{position:absolute;top:10px;right:10px;color:var(--mut);opacity:.7}
  .sug .sx .ic{width:16px;height:16px}
  .sug-h{display:flex;align-items:center;gap:8px;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--mut);margin:0 4px 10px}
  .sug-h .ic{width:14px;height:14px;color:var(--accent)}
  .btn{display:inline-flex;align-items:center;gap:8px;padding:9px 16px;border-radius:999px;background:#fff;color:#0b0e1a;font-size:13px;font-weight:600;transition:transform .15s}
  .btn:active{transform:scale(.95)}
  .btn.ghost{background:rgba(255,255,255,.08);color:var(--txt);border:1px solid var(--line)}

  /* Seguridad */
  .secu{padding:20px}
  .alarm{display:flex;align-items:center;gap:16px}
  .shield{position:relative;width:56px;height:56px;border-radius:20px;display:grid;place-items:center;flex:none;background:rgba(255,255,255,.06);color:var(--mut)}
  .shield .ic{width:28px;height:28px}
  .al-on .shield{background:linear-gradient(135deg,#8f7bff,#3fa9ff);color:#fff;box-shadow:0 10px 30px rgba(110,120,255,.45)}
  .al-wait .shield{background:linear-gradient(135deg,#ffc04d,#ff7a3d);color:#1c1003;--pc:255,180,70;animation:pulse 1.2s infinite}
  .al-alert .shield{background:linear-gradient(135deg,#ff3d5a,#ff8a3d);color:#fff;--pc:255,61,90;animation:pulse .8s infinite}
  .alarm small{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--mut)}
  .alarm b{display:block;font-size:18px;font-weight:600;margin:2px 0}
  .alarm span{font-size:12.5px;color:var(--mut)}
  .abtns{display:flex;gap:8px;margin-top:16px;flex-wrap:wrap}
  .abtn{flex:1;min-width:92px;display:flex;flex-direction:column;align-items:center;gap:6px;padding:12px 8px;border-radius:18px;background:rgba(255,255,255,.05);border:1px solid var(--line);font-size:12.5px;font-weight:500;transition:background .2s,transform .15s}
  .abtn:hover{background:rgba(255,255,255,.09)}.abtn:active{transform:scale(.96)}
  .abtn.danger{background:rgba(255,80,100,.12);border-color:rgba(255,80,100,.3)}
  .acc{margin-top:16px;padding-top:14px;border-top:1px solid var(--line);display:flex;flex-direction:column;gap:8px}
  .acc-i{display:flex;align-items:center;gap:12px}
  .acc-i .ai{width:36px;height:36px;border-radius:12px;display:grid;place-items:center;background:rgba(255,255,255,.06)}
  .acc-i.open .ai{background:rgba(255,176,77,.18);color:#ffc46b}
  .acc-i .at{flex:1;min-width:0}.acc-i .at b{display:block;font-size:13.5px;font-weight:600}.acc-i .at span{font-size:12px;color:var(--mut)}
  .opn{display:flex;flex-wrap:wrap;gap:6px;margin-top:14px}
  .tag{display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border-radius:999px;font-size:12px;background:rgba(255,255,255,.05);border:1px solid var(--line);color:var(--mut)}
  .tag .ic{width:14px;height:14px}
  .tag.ok{color:#7ff0d6;border-color:rgba(62,230,196,.25)}.tag.warn{color:#ffc46b;border-color:rgba(255,176,77,.3);background:rgba(255,176,77,.08)}

  /* Personas */
  .people{padding:18px 20px}
  .ppl{display:flex;gap:16px;flex-wrap:wrap;margin-top:12px}
  .person{display:flex;align-items:center;gap:10px}
  .av{width:42px;height:42px;border-radius:50%;background:#2a2f45 center/cover;display:grid;place-items:center;font-weight:700;font-size:15px;position:relative;box-shadow:0 0 0 2px rgba(255,255,255,.12)}
  .person.home .av{box-shadow:0 0 0 2px #3ee6c4,0 0 18px rgba(62,230,196,.35)}
  .person b{display:block;font-size:13.5px;font-weight:600}.person span{font-size:12px;color:var(--mut)}
  .person.home span{color:#7ff0d6}

  /* Encabezados de sección */
  .sec-h{display:flex;align-items:baseline;justify-content:space-between;margin:6px 4px 12px}
  .sec-h h2,.sec-h h3{margin:0;font-size:13px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--mut)}
  .sec-h span{font-size:12px;color:var(--mut)}

  /* Modos / escenas */
  .modes{display:flex;gap:12px;overflow-x:auto;padding:2px 2px 8px;scrollbar-width:none;-webkit-mask-image:linear-gradient(90deg,#000 92%,transparent);mask-image:linear-gradient(90deg,#000 92%,transparent)}
  .modes::-webkit-scrollbar{display:none}
  .mode{position:relative;flex:none;display:flex;align-items:center;gap:12px;padding:12px 18px 12px 12px;border-radius:22px;background:var(--glass);border:1px solid var(--line);overflow:hidden;transition:transform .2s,border-color .3s}
  .mode::before{content:"";position:absolute;inset:0;background:linear-gradient(135deg,var(--g1),var(--g2));opacity:.12;transition:opacity .3s}
  .mode:hover::before{opacity:.22}.mode:active{transform:scale(.96)}
  .mode .mi{position:relative;width:40px;height:40px;border-radius:14px;display:grid;place-items:center;background:linear-gradient(135deg,var(--g1),var(--g2));color:#fff;box-shadow:0 8px 22px -6px var(--g1)}
  .mode span{position:relative;text-align:left}.mode b{display:block;font-size:14px;font-weight:600;white-space:nowrap}.mode small{font-size:11.5px;color:var(--mut)}
  .mode.fired::after{content:"";position:absolute;inset:0;background:radial-gradient(circle,rgba(255,255,255,.5),transparent 70%);animation:flash .9s ease-out forwards}
  @keyframes flash{from{opacity:1;transform:scale(.3)}to{opacity:0;transform:scale(2)}}
  .mode.off{--g1:#5b6275;--g2:#2e3446}

  /* Ambientes */
  .rooms{display:grid;grid-template-columns:repeat(auto-fill,minmax(172px,1fr));gap:14px}
  .room{position:relative;min-height:146px;padding:16px;border-radius:26px;background:var(--glass);border:1px solid var(--line);overflow:hidden;cursor:pointer;text-align:left;
    display:flex;flex-direction:column;transition:transform .25s cubic-bezier(.2,.8,.2,1),border-color .4s,background .4s;-webkit-tap-highlight-color:transparent}
  .room:hover{transform:translateY(-3px);border-color:rgba(255,255,255,.16)}
  .room:active{transform:scale(.97)}
  .room::before{content:"";position:absolute;inset:-60%;background:radial-gradient(circle at 30% 30%,rgba(var(--lc),calc(var(--glow)*.5)),transparent 45%);opacity:0;transition:opacity .6s;pointer-events:none}
  .room.on{border-color:rgba(var(--lc),.32);background:rgba(255,255,255,.06)}
  .room.on::before{opacity:1}
  .rtop{position:relative;display:flex;align-items:center;gap:8px}
  .ri{width:46px;height:46px;border-radius:16px;display:grid;place-items:center;background:rgba(255,255,255,.07);transition:all .4s}
  .room.on .ri,.ri.on{background:rgb(var(--lc));color:#1d1306;box-shadow:0 0 26px rgba(var(--lc),.55)}
  .rtemp{margin-left:auto;font-size:13px;font-weight:500;color:var(--mut);font-variant-numeric:tabular-nums}
  .rpw{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;background:rgba(255,255,255,.07);color:var(--mut);transition:all .25s}
  .rtemp+.rpw{margin-left:4px}.rpw:first-child{margin-left:auto}
  .rclim{display:inline-flex;align-items:center;gap:8px}
  .rclim i{font-style:normal;display:inline-flex;align-items:center;gap:3px;font-weight:600}
  .rclim .ic{width:13px;height:13px}
  .rclim .t,.sh-sub .mt,.mtr.t{color:#ffb070}.rclim .h,.sh-sub .mh,.mtr.h{color:#7cc8ff}
  .room.on .rclim .t{color:#ffd0a0}.room.on .rclim .h{color:#b5e0ff}
  .rpw .ic{width:17px;height:17px}
  .room.on .rpw{background:rgba(255,255,255,.92);color:#151a2b}
  .rpw:active{transform:scale(.9)}
  .rname{position:relative;margin-top:auto;padding-top:16px;font-size:16px;font-weight:600;letter-spacing:-.01em}
  .rmeta{position:relative;font-size:12.5px;color:var(--mut);margin-top:2px;display:flex;align-items:center;gap:6px;flex-wrap:wrap}
  .room.on .rmeta{color:rgba(255,255,255,.75)}
  .live{width:7px;height:7px;border-radius:50%;background:#3ee6c4;--pc:62,230,196;animation:pulse 1.6s infinite;display:inline-block;flex:none}
  .warnb{display:inline-flex;align-items:center;gap:4px;color:#ffc46b}.warnb .ic{width:13px;height:13px}
  .rbar{position:absolute;left:16px;right:16px;bottom:9px;height:3px;border-radius:3px;background:rgba(255,255,255,.07);overflow:hidden}
  .rbar i{display:block;height:100%;border-radius:3px;background:rgb(var(--lc));box-shadow:0 0 10px rgb(var(--lc))}
  .empty{padding:28px;text-align:center;color:var(--mut);font-size:14px;line-height:1.6}

  /* Plano de la casa */
  .col-c{display:none;flex-direction:column;gap:18px;min-width:0}
  .layout.fp{grid-template-columns:minmax(300px,360px) minmax(0,1fr) minmax(280px,340px);grid-template-areas:"l c r"}
  .layout.fp .col-l{grid-area:l}.layout.fp .col-c{grid-area:c;display:flex}.layout.fp .col-r{grid-area:r}
  /* con plano: resumen en 2×2 (la columna es angosta) y Modos en grilla debajo del plano */
  .layout.fp .rooms{display:block} /* la lista de ambientes ocupa todo el ancho de su columna */
  .layout.fp .stats{grid-template-columns:1fr 1fr}
  .layout.fp .stat{position:relative;padding:12px 14px}
  .layout.fp .stat em{white-space:normal;line-height:1.25}
  .layout.fp .modes{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(190px,42vw),1fr));overflow:visible;-webkit-mask-image:none;mask-image:none;padding:0}
  .layout.fp .mode{min-width:0}.layout.fp .mode span{min-width:0}
  .layout.fp .mode b,.layout.fp .mode small{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .layout.fp #modes .sec-h{margin-top:4px}
  .ib[hidden]{display:none}
  .plan{padding:10px}
  /* pestañas Casa / Seguridad */
  .ctabs{display:flex;gap:10px}.ctabs:empty{display:none}
  .ctab{flex:1;min-width:0;position:relative;display:flex;align-items:center;gap:12px;padding:12px 34px 12px 16px;border-radius:18px;text-align:left;color:var(--txt);
    background:var(--glass);border:1px solid var(--line);transition:background .25s,border-color .25s,transform .1s}
  .ctab:hover{background:var(--glass2)}.ctab:active{transform:scale(.98)}
  .ctab>.ic{width:22px;height:22px;flex:none;color:var(--mut);transition:color .25s}
  .ctab span{min-width:0}.ctab b{display:block;font-size:15px}.ctab small{display:block;font-size:12px;color:var(--mut);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .ctab.on{background:linear-gradient(135deg,rgba(47,107,255,.28),rgba(62,230,196,.12));border-color:rgba(124,156,255,.45)}.ctab.on>.ic{color:#fff}
  .cdot{position:absolute;right:14px;top:50%;width:10px;height:10px;margin-top:-5px;border-radius:50%;background:#3ee6c4;box-shadow:0 0 10px rgba(62,230,196,.7)}
  .cdot.on{background:#9b7bff;box-shadow:0 0 10px #9b7bff}.cdot.warn{background:#ffb04d;box-shadow:0 0 10px #ffb04d}
  .cdot.alert{background:#ff4d5e;box-shadow:0 0 12px #ff4d5e;animation:cblink 1s infinite}
  @keyframes cblink{50%{opacity:.3}}
  .secpane{display:flex;flex-direction:column;gap:18px;min-width:0}.secpane>section:empty{display:none}
  .col-c[data-tab="casa"] .secpane{display:none}
  .col-c[data-tab="seg"] #plan{display:none}
  .plan-stage{position:relative;width:100%;aspect-ratio:16/10;border-radius:20px;overflow:hidden;background:#0a0d18}
  .plan-img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;display:block;-webkit-user-select:none;user-select:none;-webkit-user-drag:none}
  .plan-dim{position:absolute;inset:0;background:#04050c;opacity:0;transition:opacity 2s;pointer-events:none}
  .app[data-phase=night] .plan-dim{opacity:var(--dimn,.42)}.app[data-phase=golden] .plan-dim{opacity:calc(var(--dimn,.42)*.5)}
  .planfx{position:absolute;inset:0}
  .glow{position:absolute;width:calc(var(--r)*2);aspect-ratio:1;transform:translate(-50%,-50%);border-radius:50%;pointer-events:none;mix-blend-mode:screen;opacity:0;transition:opacity .9s,background 1s;
    background:radial-gradient(circle,rgba(var(--lc),var(--a)) 0%,rgba(var(--lc),calc(var(--a)*.5)) 30%,transparent 68%)}
  .glow.on{opacity:1}
  .pz{position:absolute;z-index:1;border-radius:10px;background:none;cursor:pointer;-webkit-tap-highlight-color:transparent;transition:background .5s,box-shadow .5s;outline:none}
  .pz::before{content:"";position:absolute;inset:0;border-radius:inherit;opacity:0;transition:opacity .7s;mix-blend-mode:screen;
    background:radial-gradient(ellipse at 50% 45%,rgba(var(--lc),var(--a)) 0%,rgba(var(--lc),calc(var(--a)*.55)) 45%,rgba(var(--lc),calc(var(--a)*.18)) 100%)}
  .pz.on::before{opacity:1}
  .pz.on{box-shadow:inset 0 0 40px rgba(var(--lc),.35),0 0 30px rgba(var(--lc),.18)}
  .pz:hover{background:rgba(255,255,255,.05);box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.25)}
  .pz.on:hover{box-shadow:inset 0 0 40px rgba(var(--lc),.35),inset 0 0 0 1.5px rgba(var(--lc),.6)}
  .pz:active{transform:scale(.995)}
  .pz-l{position:absolute;left:50%;bottom:8px;transform:translateX(-50%);padding:3px 10px;border-radius:999px;font-size:11.5px;font-weight:600;color:#fff;white-space:nowrap;
    background:rgba(8,10,20,.6);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);opacity:0;transition:opacity .25s;pointer-events:none}
  .pz:hover .pz-l,.pz.edit .pz-l,.pz:focus-visible .pz-l{opacity:1}
  .pz.edit{box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.5);background:rgba(124,156,255,.08)}
  .pz.none{cursor:help}
  /* con render prendido: cada espacio revela su pedazo del render con las luces encendidas */
  .pzi{left:0;top:0;width:100%;height:100%;border-radius:0;box-shadow:none!important}
  .pzi:active{transform:none}
  .pzi::before{display:none}
  .pzi .pz-on,.pzi .pz-glow{position:absolute;inset:0;opacity:var(--o);transition:opacity .9s ease;pointer-events:none}
  .pzi .pz-on{background:center/100% 100% no-repeat}
  .pzi .pz-glow{mix-blend-mode:screen;background:rgba(var(--lc),calc(var(--a)*.45))}
  .pzi:hover{background:rgba(255,255,255,.07)}
  .pzi.on:hover{background:rgba(255,255,255,.04)}
  .pzi .pz-l{bottom:auto;transform:translate(-50%,-50%)}
  .pzi.edit{background:rgba(124,156,255,.14)}
  .plan-help{font-style:normal;text-transform:none;letter-spacing:0;color:rgba(255,255,255,.6);margin-left:2px}
  @container mae (max-width:700px){.plan-help{display:none}}
  .plan-hint{position:absolute;left:50%;bottom:12px;transform:translateX(-50%);z-index:4;display:flex;align-items:center;gap:6px;padding:6px 12px;border-radius:999px;font-size:11.5px;white-space:nowrap;
    background:rgba(8,10,20,.72);border:1px dashed rgba(255,176,77,.6);color:rgba(255,255,255,.85);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);pointer-events:none}
  .plan-hint .ic{width:13px;height:13px;color:#ffb04d}
  @container mae (max-width:700px){.plan-hint{display:none}}
  .pzone{position:absolute;width:calc(var(--r)*1.5);aspect-ratio:1;transform:translate(-50%,-50%);border-radius:50%;background:none;cursor:pointer;-webkit-tap-highlight-color:transparent}
  .pzone:active{background:radial-gradient(circle,rgba(255,255,255,.12),transparent 70%)}
  .pdev{position:absolute;z-index:2;width:30px;height:30px;transform:translate(-50%,-50%);border-radius:50%;display:grid;place-items:center;color:rgba(255,255,255,.75);
    background:rgba(8,10,20,.55);border:1px solid rgba(255,255,255,.18);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);transition:background .35s,color .35s,box-shadow .35s,transform .12s;cursor:pointer}
  .pdev .ic{width:15px;height:15px}
  .pdev:hover{transform:translate(-50%,-50%) scale(1.12)}.pdev:active{transform:translate(-50%,-50%) scale(.9)}
  .pdev.on{background:rgb(var(--lc));color:#1d1306;border-color:rgba(255,255,255,.6);box-shadow:0 0 0 4px rgba(var(--lc),.18),0 0 22px rgba(var(--lc),.85)}
  .pdev.edit{cursor:grab;touch-action:none;border-style:dashed}
  .ppin{z-index:3}
  @container mae (max-width:700px){.pdev{width:24px;height:24px}.pdev .ic{width:12px;height:12px}}
  .glow.edit{outline:1px dashed rgba(255,255,255,.35)}
  .ppin{position:absolute;transform:translate(-50%,-50%);display:flex;align-items:center;gap:7px;padding:4px 11px 4px 4px;border-radius:999px;white-space:nowrap;
    background:rgba(8,10,20,.62);border:1px solid rgba(255,255,255,.16);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);font-size:12px;color:#fff;
    box-shadow:0 6px 18px rgba(0,0,0,.35);transition:transform .2s,background .3s,border-color .3s;-webkit-tap-highlight-color:transparent}
  .ppin:hover{transform:translate(-50%,-50%) scale(1.06)}
  .ppi{width:26px;height:26px;border-radius:50%;display:grid;place-items:center;background:rgba(255,255,255,.12);flex:none;transition:all .4s}
  .ppi .ic{width:15px;height:15px}
  .ppin.on{border-color:rgba(var(--lc),.6)}.ppin.on .ppi{background:rgb(var(--lc));color:#1d1306;box-shadow:0 0 14px rgba(var(--lc),.8)}
  .ppin.warn{border-color:rgba(255,176,77,.8)}
  .ppt b{font-weight:600}.ppt small{margin-left:6px;color:rgba(255,255,255,.65);font-variant-numeric:tabular-nums}
  .ppin .live{margin-left:2px}
  .ppin.edit{cursor:grab;touch-action:none;border-style:dashed}.ppin.edit:active{cursor:grabbing}
  .plan-tag{position:absolute;left:12px;top:12px;display:flex;align-items:center;gap:8px;padding:6px 12px;border-radius:999px;font-size:11.5px;letter-spacing:.08em;text-transform:uppercase;
    background:rgba(8,10,20,.6);border:1px solid rgba(255,255,255,.12);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);color:rgba(255,255,255,.8);pointer-events:none}
  .fpedit{padding:16px 8px 6px}.fpedit p{margin:0 0 10px;font-size:12.5px;color:var(--mut);line-height:1.5}
  .fpedit pre{margin:0;padding:14px;border-radius:14px;background:rgba(0,0,0,.35);border:1px solid var(--line);font-size:12px;line-height:1.55;overflow:auto;-webkit-user-select:all;user-select:all}
  .rlist{display:flex;flex-direction:column;gap:8px}
  .rrow{position:relative;display:flex;align-items:center;gap:12px;padding:10px 12px 10px 10px;border-radius:20px;background:var(--glass);border:1px solid var(--line);cursor:pointer;overflow:hidden;transition:border-color .4s,background .4s}
  .rrow::before{content:"";position:absolute;inset:0;background:radial-gradient(circle at 0% 50%,rgba(var(--lc),calc(var(--glow)*.35)),transparent 60%);opacity:0;transition:opacity .6s;pointer-events:none}
  .rrow.on{border-color:rgba(var(--lc),.3)}.rrow.on::before{opacity:1}
  .rrow .ri{width:40px;height:40px;border-radius:14px;position:relative}.rrow.on .ri{background:rgb(var(--lc));color:#1d1306;box-shadow:0 0 20px rgba(var(--lc),.5)}
  .rrt{position:relative;flex:1;min-width:0}.rrt b{display:block;font-size:14.5px;font-weight:600}.rrt span{font-size:12px;color:var(--mut);display:flex;align-items:center;gap:6px}
  .rrow .rtemp{position:relative;margin:0}
  .tog{position:relative;width:46px;height:28px;border-radius:999px;background:rgba(255,255,255,.12);flex:none;transition:background .3s,box-shadow .3s}
  .tog i{position:absolute;top:3px;left:3px;width:22px;height:22px;border-radius:50%;background:#fff;transition:transform .3s cubic-bezier(.2,.8,.2,1);box-shadow:0 2px 6px rgba(0,0,0,.3)}
  .tog.on{background:rgb(var(--lc));box-shadow:0 0 16px rgba(var(--lc),.45)}.tog.on i{transform:translateX(18px)}
  @container mae (max-width:1200px){.layout.fp{grid-template-columns:minmax(0,1fr) minmax(0,1fr);grid-template-areas:"c c" "l r"}.layout.fp .col-l{position:static}}
  @container mae (max-width:700px){.layout.fp{grid-template-columns:minmax(0,1fr);grid-template-areas:"c" "r" "l"}.ppt{display:none}.ppin{padding:4px}.plan{padding:6px}}

  /* Cámaras */
  .cams{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:14px}
  .cam{position:relative;aspect-ratio:16/9;border-radius:22px;overflow:hidden;background:#0d1020;border:1px solid var(--line);cursor:pointer}
  .cam img{width:100%;height:100%;object-fit:cover;display:block}
  .cam-l{position:absolute;left:10px;bottom:10px;display:flex;align-items:center;gap:7px;padding:6px 10px;border-radius:999px;font-size:12px;font-weight:500;background:rgba(0,0,0,.45);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}
  .rec{width:7px;height:7px;border-radius:50%;background:#ff4d5e;animation:blink 1.4s infinite}
  .camcard{border-radius:24px;overflow:hidden;border:1px solid var(--line);background:#0b0e18;min-height:200px;
    --ha-card-background:transparent;--ha-card-border-radius:0;--ha-card-border-width:0;--card-background-color:#0f1222;--primary-color:#2f6bff;--rgb-primary-color:47,107,255;
    --primary-text-color:#eef1f8;--secondary-text-color:rgba(238,241,248,.6);--secondary-background-color:#0d1020;--divider-color:rgba(255,255,255,.08)}
  .camcard .camload{display:flex;align-items:center;justify-content:center;gap:10px;aspect-ratio:16/9;color:var(--mut);font-size:13.5px}
  .sec-h .tbtn{display:inline-flex;align-items:center;gap:6px}.sec-h .tbtn .ic{width:16px;height:16px}

  /* Pie */
  .foot{position:relative;z-index:1;max-width:1480px;margin:28px auto 0;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding-top:18px;border-top:1px solid var(--line);font-size:12.5px;color:var(--mut)}
  .foot b{color:var(--txt)}
  .fbrand{display:flex;align-items:center;gap:10px}.fbrand .mono{width:24px;height:24px;font-size:11px;border-radius:8px}

  /* Hoja de ambiente */
  .sheet-wrap{position:fixed;inset:0;z-index:20;pointer-events:none}
  .backdrop{position:absolute;inset:0;background:rgba(3,4,10,.55);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);opacity:0;transition:opacity .35s}
  .sheet{position:absolute;left:0;right:0;bottom:0;max-height:90vh;overflow:auto;overscroll-behavior:contain;padding:10px 20px 26px;border-radius:30px 30px 0 0;
    background:rgba(14,16,28,.92);border:1px solid rgba(255,255,255,.1);border-bottom:0;-webkit-backdrop-filter:blur(30px) saturate(1.4);backdrop-filter:blur(30px) saturate(1.4);
    transform:translateY(105%);transition:transform .45s cubic-bezier(.2,.9,.2,1);color:var(--txt);font-family:inherit;box-shadow:0 -30px 80px rgba(0,0,0,.5)}
  .sheet-wrap.open{pointer-events:auto}.sheet-wrap.open .backdrop{opacity:1}.sheet-wrap.open .sheet{transform:none}
  .grab{width:44px;height:5px;border-radius:5px;background:rgba(255,255,255,.18);margin:0 auto 14px}
  .sh-head{display:flex;align-items:center;gap:14px;padding-bottom:18px;position:sticky;top:-10px;z-index:2;background:linear-gradient(rgba(14,16,28,.96) 75%,transparent);padding-top:6px}
  .ri.big{width:56px;height:56px;border-radius:20px}.ri.big .ic{width:28px;height:28px}
  .sh-t{flex:1;min-width:0}.sh-t h2{margin:0;font-size:24px;font-weight:650;letter-spacing:-.02em}
  .sh-sub{display:flex;flex-wrap:wrap;align-items:center;gap:12px;font-size:13px;color:var(--mut);margin-top:4px}
  .sh-sub span{display:inline-flex;align-items:center;gap:5px}.sh-sub .ic{width:15px;height:15px}
  .ib{width:42px;height:42px;border-radius:50%;display:grid;place-items:center;background:rgba(255,255,255,.07);flex:none;transition:background .2s}
  .ib:hover{background:rgba(255,255,255,.12)}.ib .ic{width:19px;height:19px}
  .blk{margin-top:18px}
  .blk-h{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
  .blk-h h4{margin:0;display:flex;align-items:center;gap:8px;font-size:12px;font-weight:600;letter-spacing:.13em;text-transform:uppercase;color:var(--mut)}
  .blk-h h4 .ic{width:15px;height:15px}
  .tbtn{font-size:12.5px;font-weight:600;padding:7px 13px;border-radius:999px;background:rgba(255,255,255,.07);border:1px solid var(--line)}
  .pills{display:grid;grid-template-columns:repeat(auto-fill,minmax(158px,1fr));gap:10px}
  .pill{position:relative;overflow:hidden;display:flex;align-items:center;gap:12px;padding:13px;border-radius:20px;background:rgba(255,255,255,.05);border:1px solid var(--line);cursor:pointer;
    -webkit-user-select:none;user-select:none;touch-action:pan-y;transition:border-color .3s,transform .15s;-webkit-tap-highlight-color:transparent}
  .pill:active{transform:scale(.975)}
  .pill .fill{position:absolute;left:0;top:0;bottom:0;width:var(--b);background:linear-gradient(90deg,rgba(var(--lc),.22),rgba(var(--lc),.46));transition:width .35s cubic-bezier(.2,.8,.2,1)}
  .pill.dragging{transform:none}.pill.dragging .fill{transition:none}
  .pill.on{border-color:rgba(var(--lc),.45)}
  .pill .pi{position:relative;width:38px;height:38px;border-radius:13px;display:grid;place-items:center;background:rgba(255,255,255,.07);flex:none;transition:all .3s}
  .pill.on .pi{background:rgb(var(--lc));color:#1b1206;box-shadow:0 0 18px rgba(var(--lc),.55)}
  .pill.on.k-fan .pi .ic{animation:spin 1.4s linear infinite}
  .pt{position:relative;display:flex;flex-direction:column;min-width:0;flex:1}
  .pt b{font-size:13.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .st{font-size:12px;color:var(--mut);font-variant-numeric:tabular-nums}.pill.on .st{color:rgba(255,255,255,.88)}
  .pill.dim::after{content:"";position:absolute;right:9px;top:50%;width:3px;height:18px;margin-top:-9px;border-radius:3px;background:rgba(255,255,255,.22)}
  .pill.busy{opacity:.7}

  .clim{position:relative;padding:18px;border-radius:24px;background:rgba(255,255,255,.04);border:1px solid var(--line);overflow:hidden;--cc:150,160,190}
  .clim+.clim{margin-top:10px}
  .clim::before{content:"";position:absolute;inset:0;background:radial-gradient(circle at 50% 120%,rgba(var(--cc),.35),transparent 65%);opacity:0;transition:opacity .5s}
  .clim.on::before{opacity:1}
  .clim.m-cool{--cc:70,160,255}.clim.m-heat{--cc:255,128,64}.clim.m-heat_cool,.clim.m-auto{--cc:150,120,255}.clim.m-dry{--cc:90,220,190}.clim.m-fan_only{--cc:150,200,255}
  .clim>*{position:relative}
  .clim-top{display:flex;align-items:center;justify-content:space-between;gap:10px}
  .clim-top b{display:block;font-size:15px;font-weight:600}.clim-top span{font-size:12.5px;color:var(--mut)}
  .clim.on .ib.pw{background:rgb(var(--cc));color:#081020}
  .dial{display:flex;align-items:center;justify-content:center;gap:26px;margin:14px 0 10px}
  .rb{width:52px;height:52px;border-radius:50%;display:grid;place-items:center;background:rgba(255,255,255,.07);border:1px solid var(--line);transition:transform .12s,background .2s}
  .rb:active{transform:scale(.9);background:rgba(255,255,255,.14)}
  .tgt{text-align:center;line-height:1;min-width:110px}
  .tgt b{font-size:56px;font-weight:250;letter-spacing:-.04em;font-variant-numeric:tabular-nums}
  .tgt sup{font-size:22px;font-weight:300;vertical-align:top;margin-left:2px;color:var(--mut)}
  .tgt small{display:block;margin-top:6px;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--mut)}
  .chips{display:flex;gap:6px;flex-wrap:wrap;justify-content:center}
  .chip{padding:7px 13px;border-radius:999px;font-size:12.5px;background:rgba(255,255,255,.05);border:1px solid var(--line);color:var(--mut);transition:all .2s}
  .chip.act{background:rgb(var(--cc));color:#081020;border-color:transparent;font-weight:600}

  .row{display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:20px;background:rgba(255,255,255,.04);border:1px solid var(--line)}
  .row+.row{margin-top:8px}
  .row .pi{width:38px;height:38px;border-radius:13px;display:grid;place-items:center;background:rgba(255,255,255,.07);flex:none}
  .row.on .pi{background:linear-gradient(135deg,#7c9cff,#3ee6c4);color:#081020}
  .row .rt{flex:1;min-width:0}.row .rt b{display:block;font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.row .rt span{font-size:12px;color:var(--mut);display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .row .bt{display:flex;gap:6px}
  .sb{width:38px;height:38px;border-radius:13px;display:grid;place-items:center;background:rgba(255,255,255,.07);transition:transform .12s,background .2s}
  .sb:hover{background:rgba(255,255,255,.13)}.sb:active{transform:scale(.9)}.sb .ic{width:18px;height:18px}
  .sb.pp{background:#fff;color:#0b0e1a}
  .pos{height:4px;border-radius:4px;background:rgba(255,255,255,.08);margin-top:7px;overflow:hidden}.pos i{display:block;height:100%;background:linear-gradient(90deg,#7c9cff,#3ee6c4)}
  .art{background:#20253a center/cover}
  .sh-cams{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px}
  .hint{margin:24px 0 0;text-align:center;font-size:12px;color:var(--mut);opacity:.75}

  /* Actividad (registro por tiempos) */
  .actv-wrap{position:fixed;inset:0;z-index:22;pointer-events:none}
  .actv-wrap.open{pointer-events:auto}.actv-wrap.open .backdrop{opacity:1}
  .actv{position:absolute;inset:0;overflow:auto;overscroll-behavior:contain;background:rgba(8,10,20,.97);-webkit-backdrop-filter:blur(30px);backdrop-filter:blur(30px);
    transform:translateY(24px);opacity:0;transition:transform .4s cubic-bezier(.2,.9,.2,1),opacity .3s;color:var(--txt);font-family:inherit}
  .actv-wrap.open .actv{transform:none;opacity:1}
  @media (min-width:900px){.actv{inset:4vh auto 4vh 50%;width:min(860px,94vw);transform:translate(-50%,24px);border-radius:30px;border:1px solid rgba(255,255,255,.1);box-shadow:0 30px 90px rgba(0,0,0,.55)}
    .actv-wrap.open .actv{transform:translate(-50%,0)}}
  .act-h{position:sticky;top:0;z-index:2;padding:18px 20px 14px;background:linear-gradient(rgba(8,10,20,.99) 82%,rgba(8,10,20,0))}
  .act-top{display:flex;align-items:center;gap:14px}
  .act-t{flex:1;min-width:0}.act-t h2{margin:0;font-size:22px;font-weight:650;letter-spacing:-.02em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.act-t span{font-size:12.5px;color:var(--mut)}
  .act-f{display:flex;gap:6px;margin-top:12px}
  .act-f.scroll{overflow-x:auto;scrollbar-width:none;margin-top:8px;-webkit-mask-image:linear-gradient(90deg,#000 90%,transparent);mask-image:linear-gradient(90deg,#000 90%,transparent)}
  .act-f.scroll::-webkit-scrollbar{display:none}
  .act-f .chip{flex:none;display:inline-flex;align-items:center;gap:6px}.act-f .chip .ic{width:14px;height:14px}
  .act-f .chip i{font-style:normal;opacity:.6;font-size:11px}
  .act-f .chip.on{background:#fff;color:#0b0e1a;border-color:transparent;font-weight:600}
  .act-body{padding:2px 20px 34px}
  ${HIST_CSS}
  .act-search{display:flex;align-items:center;gap:10px;margin-top:12px;padding:0 14px;border-radius:14px;background:rgba(255,255,255,.06);border:1px solid var(--line)}
  .act-search .ic{width:17px;height:17px;color:var(--mut)}
  .act-ents{margin-top:8px;max-height:46vh;overflow:auto;padding:6px;border-radius:14px;background:rgba(255,255,255,.04);border:1px solid var(--line)}
  .act-ents>button[data-v]:not(.tbtn){display:flex;align-items:center;gap:10px;width:100%;padding:9px 8px;border-radius:10px;text-align:left}
  .act-ents>button.on{background:rgba(255,255,255,.07)}.act-ents .tx{flex:1;min-width:0}.act-ents b{display:block;font-size:13.5px;font-weight:600}
  .act-ents small{display:block;font-size:11.5px;opacity:.65}
  .act-ents .ck{width:20px;height:20px;border-radius:6px;border:2px solid var(--line);display:grid;place-items:center;font-size:12px;flex:none}.act-ents button.on .ck{background:#fff;color:#0b0e1a;border-color:#fff}
  .act-search input{flex:1;min-width:0;height:42px;border:0;background:none;outline:none;color:var(--txt);font:inherit;font-size:14px}
  .act-f{flex-wrap:nowrap;align-items:center}
  .act-sum{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:6px 0 4px}
  .act-sum div{padding:10px 12px;border-radius:16px;background:rgba(255,255,255,.04);border:1px solid var(--line)}
  .act-sum b{display:block;font-size:19px;font-weight:600;font-variant-numeric:tabular-nums}.act-sum small{font-size:11px;color:var(--mut)}
  @media (max-width:560px){.act-sum{grid-template-columns:repeat(2,1fr)}}
  .sh-act .ev{grid-template-columns:52px 30px 1fr;gap:10px;padding:6px 4px}.sh-act .ev::before{left:calc(4px + 52px + 10px + 14px);top:38px}
  .sh-act .ev-dot{width:30px;height:30px;border-radius:10px}.sh-act .ev-dot .ic{width:15px;height:15px}

  /* Música (experiencia tipo Spotify, con la marca MatterAI) */
  .actv.mus{--mu-acc:#3ee6c4;--mu-acc2:#2f6bff;--mu-grad:linear-gradient(135deg,#2f6bff,#3ee6c4);--mu-bg:#070912;--mu-card:#141a2c;--mu-mut:rgba(238,241,248,.6);background:radial-gradient(120% 60% at 0% 0%,rgba(47,107,255,.16),transparent 60%),radial-gradient(90% 50% at 100% 100%,rgba(62,230,196,.08),transparent 60%),var(--mu-bg);overflow:hidden;color:#fff;container-type:inline-size}
  @media (min-width:900px){.actv.mus{width:min(980px,92vw);top:max(3vh,calc(50vh - 370px));bottom:max(3vh,calc(50vh - 370px))}}
  .mu-main{position:absolute;inset:0;overflow-y:auto;overscroll-behavior:contain;padding:0 16px 150px;scrollbar-width:none}
  .mu-main::-webkit-scrollbar{display:none}
  .mu-head{display:flex;align-items:center;gap:6px;padding:20px 0 10px}
  .mu-head h2{flex:1;margin:0;font-size:24px;font-weight:700;letter-spacing:-.02em}
  .mt-x{width:40px;height:40px;border-radius:50%;display:grid;place-items:center;color:#fff;flex:none;transition:background .15s,transform .1s}
  .mt-x:hover{background:rgba(255,255,255,.08)}.mt-x:active{transform:scale(.9)}.mt-x .ic{width:22px;height:22px}
  .mt-x.on .ic{color:var(--mu-acc)}.mt-x.sm{width:34px;height:34px}.mt-x.sm .ic{width:18px;height:18px}.mt-x.hide{display:none}
  .mt-x.big .ic{width:26px;height:26px;fill:currentColor}
  /* accesos rápidos */
  .mq{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:4px 0 8px}
  .mq-i{display:flex;align-items:center;gap:10px;height:56px;border-radius:12px;background:rgba(255,255,255,.07);overflow:hidden;text-align:left;transition:background .15s}
  .mq-i:hover{background:rgba(255,255,255,.14)}
  .mq-i span{width:56px;height:56px;flex:none;background:var(--mu-card) center/cover;display:grid;place-items:center;color:var(--mu-mut)}
  .mq-i b{font-size:12.5px;font-weight:700;line-height:1.25;padding-right:8px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
  .mu-sec{margin-top:22px}.mu-sec h3{margin:0 0 12px;font-size:20px;font-weight:700;letter-spacing:-.02em}
  /* carruseles */
  .mcar{display:flex;gap:14px;overflow-x:auto;scrollbar-width:none;margin:0 -16px;padding:0 16px}.mcar::-webkit-scrollbar{display:none}
  .mc{position:relative;flex:none;width:140px}
  .mc-a{width:140px;height:140px;border-radius:14px;background:var(--mu-card) center/cover;display:grid;place-items:center;color:var(--mu-mut);box-shadow:0 8px 24px rgba(0,0,0,.5);transition:transform .15s}
  .mc-a.round{border-radius:50%}.mc-a:active{transform:scale(.96)}.mc-a .ic{width:40px;height:40px}
  .mc-p{position:absolute;right:8px;top:92px;width:42px;height:42px;border-radius:50%;background:var(--mu-grad);color:#fff;display:grid;place-items:center;box-shadow:0 8px 22px rgba(47,107,255,.45);opacity:0;transform:translateY(8px);transition:all .2s}
  .mc:hover .mc-p,.mc-p.show{opacity:1;transform:none}.mc-p .ic{width:18px;height:18px;fill:currentColor}
  @media (hover:none){.mc-p{opacity:1;transform:none;width:36px;height:36px;top:98px}}
  .mc b{display:block;margin-top:8px;font-size:13px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .mc small{display:block;font-size:12px;color:var(--mu-mut);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  /* filas */
  .mt{display:flex;align-items:center;gap:4px}
  .mt-m{flex:1;min-width:0;display:flex;align-items:center;gap:12px;padding:6px 0;text-align:left}
  .mt-i{width:48px;height:48px;border-radius:9px;background:var(--mu-card) center/cover;flex:none;display:grid;place-items:center;color:var(--mu-mut)}.mt-i.round{border-radius:50%}
  .mt-n{width:24px;text-align:center;flex:none;font-size:14px;color:var(--mu-mut);font-variant-numeric:tabular-nums}
  .mt-t{flex:1;min-width:0}.mt-t b{display:block;font-size:15px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .mt-t small{display:block;font-size:13px;color:var(--mu-mut);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .mt.now .mt-t b{color:var(--mu-acc)}
  .mt-m em{font-style:normal;font-size:12px;color:var(--mu-mut)}
  .ml{display:flex;align-items:center;gap:12px;width:100%;padding:7px 0;text-align:left}
  .ml-i{width:64px;height:64px;border-radius:12px;background:var(--mu-card) center/cover;flex:none;display:grid;place-items:center;color:var(--mu-mut)}.ml-i.round{border-radius:50%}
  /* buscar */
  .mu-search{display:flex;align-items:center;gap:10px;padding:0 6px 0 12px;height:48px;border-radius:14px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.1);color:#fff;margin-bottom:10px}
  .mu-search>.ic{width:22px;height:22px;color:var(--mu-mut)}
  .mu-search:focus-within{border-color:rgba(62,230,196,.6);box-shadow:0 0 0 3px rgba(62,230,196,.15)}
  .mu-search input{flex:1;min-width:0;height:100%;border:0;background:none;outline:none;color:#fff;font:inherit;font-size:16px;font-weight:600}
  .mu-search input::placeholder{color:var(--mu-mut)}
  .mu-search .mt-x{color:#fff}
  .mchips{display:flex;gap:8px;overflow-x:auto;scrollbar-width:none;padding:2px 0 6px}.mchips::-webkit-scrollbar{display:none}
  .mchips button{flex:none;padding:7px 14px;border-radius:999px;background:rgba(255,255,255,.1);font-size:13.5px;font-weight:600;color:#fff}
  .mchips button.on{background:var(--mu-grad);color:#fff}
  .mexp{display:grid;grid-template-columns:1fr 1fr;gap:10px}
  .mexp button{position:relative;height:96px;border-radius:14px;overflow:hidden;text-align:left;padding:12px;color:#fff}
  .mexp b{font-size:16px;font-weight:700}
  .mexp .ic{position:absolute;right:-8px;bottom:-6px;width:62px;height:62px;transform:rotate(25deg);opacity:.85}
  .mtop{position:relative;padding:18px;border-radius:18px;background:rgba(255,255,255,.07)}
  .mtop-a{display:block;text-align:left;width:100%}
  .mtop-a span{display:grid;place-items:center;width:92px;height:92px;border-radius:6px;background:var(--mu-card) center/cover;box-shadow:0 8px 24px rgba(0,0,0,.5);color:var(--mu-mut)}
  .mtop-a span.round{border-radius:50%}
  .mtop-a b{display:block;margin-top:14px;font-size:28px;font-weight:800;letter-spacing:-.02em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .mtop-a small{font-size:13px;color:var(--mu-mut)}
  .mtop .mc-p{top:auto;bottom:18px;right:18px;width:48px;height:48px}
  /* página de álbum / playlist / artista */
  .md{margin:0 -16px;padding:0 16px 10px;background:linear-gradient(180deg,rgb(var(--mc)) 0%,rgba(var(--mc),.55) 55%,transparent 100%);text-align:center}
  .md-top{display:flex;padding:14px 0 4px}
  .md-a{width:min(220px,58vw);height:min(220px,58vw);margin:6px auto 14px;border-radius:16px;background:var(--mu-card) center/cover;box-shadow:0 12px 40px rgba(0,0,0,.6);display:grid;place-items:center;color:var(--mu-mut)}
  .md-a.round{border-radius:50%}
  .md h2{margin:0;font-size:24px;font-weight:800;letter-spacing:-.02em}.md small{display:block;margin-top:4px;font-size:13px;color:rgba(255,255,255,.75)}
  .md-act{display:flex;align-items:center;justify-content:flex-end;gap:14px;margin-top:6px}
  .md-play{width:56px;height:56px;border-radius:50%;background:var(--mu-grad);color:#fff;display:grid;place-items:center;box-shadow:0 8px 20px rgba(0,0,0,.4);transition:transform .1s}
  .md-play:active{transform:scale(.92)}.md-play .ic{width:24px;height:24px;fill:currentColor}
  /* mini reproductor y barra inferior */
  .mu-mini{position:absolute;left:8px;right:8px;bottom:64px;z-index:3}
  .mm{position:relative;touch-action:pan-y;display:flex;align-items:center;gap:10px;height:58px;padding:0 6px 0 8px;border-radius:16px;overflow:hidden;cursor:pointer;
    background:rgb(var(--mc,40,40,40));box-shadow:0 8px 24px rgba(0,0,0,.5);transition:background .6s}
  .mm-a{width:42px;height:42px;border-radius:9px;background:var(--mu-card) center/cover;flex:none;display:grid;place-items:center}
  .mm-t{flex:1;min-width:0}.mm-t b{display:block;font-size:13.5px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .mm-t small{display:flex;align-items:center;gap:4px;font-size:12px;color:rgba(255,255,255,.75);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .mm-t small.g{color:var(--mu-acc)}.mm-t small .ic{width:12px;height:12px}
  .mm-p{position:absolute;left:8px;right:8px;bottom:2px;height:2px;border-radius:2px;background:#fff;max-width:calc(100% - 16px)}
  .mu-nav{position:absolute;left:0;right:0;bottom:0;z-index:2;height:64px;display:flex;background:linear-gradient(transparent,rgba(0,0,0,.92) 35%)}
  .mu-nav button{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;padding-top:10px;font-size:11px;color:var(--mu-mut)}
  .mu-nav button.on{color:#fff}.mu-nav .ic{width:24px;height:24px}
  /* reproductor completo */
  .mu-full{position:absolute;inset:0;z-index:5;transform:translateY(102%);transition:transform .4s cubic-bezier(.2,.9,.2,1);pointer-events:none}
  .mu-full.open{transform:none;pointer-events:auto}
  .mf{height:100%;overflow-y:auto;display:flex;flex-direction:column;padding:12px 22px 24px;transition:background .6s;
    background:linear-gradient(180deg,rgba(var(--mc),.78) 0%,rgba(var(--mc),.42) 50%,rgba(7,9,18,.62) 100%);-webkit-backdrop-filter:blur(34px) saturate(1.25);backdrop-filter:blur(34px) saturate(1.25)}
  .mf-top{display:flex;align-items:center;gap:6px;text-align:center}
  .mf-top div{flex:1;min-width:0}.mf-top small{display:block;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.75)}
  .mf-top b{display:block;font-size:13.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .mf-art{width:min(100%,380px,44vh);flex:none;aspect-ratio:1;margin:clamp(12px,3vh,28px) auto clamp(12px,3vh,24px);border-radius:18px;background:var(--mu-card) center/cover;box-shadow:0 18px 50px rgba(0,0,0,.55);display:grid;place-items:center;color:var(--mu-mut);transition:transform .4s}
  .mf-art .ic{width:70px;height:70px}.mf-art:not(.pl){transform:scale(.92)}
  .mf-t b{display:block;font-size:22px;font-weight:800;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.mf-t span{display:block;font-size:15px;color:rgba(255,255,255,.75);margin-top:2px}
  .mf .mp-seek{margin-top:16px}
  .mf-ctl{display:flex;align-items:center;justify-content:space-between;margin-top:8px}
  .mf-b{width:52px;height:52px;border-radius:50%;display:grid;place-items:center;color:#fff;transition:transform .1s}
  .mf-b .ic{width:30px;height:30px;fill:currentColor}.mf-b:active{transform:scale(.9)}
  .mf-b.sm .ic{width:22px;height:22px;fill:none}.mf-b.on .ic{color:var(--mu-acc)}
  .mf-b.one{position:relative}.mf-b.one::after{content:"1";position:absolute;right:10px;top:8px;font-size:9px;font-weight:800;color:var(--mu-acc)}
  .mf-b.main{width:68px;height:68px;background:var(--mu-grad);color:#fff;box-shadow:0 10px 30px rgba(47,107,255,.45)}.mf-b.main .ic{width:28px;height:28px}
  .mf-bot{display:flex;align-items:center;gap:6px;margin-top:auto;padding-top:22px}
  .mf-dev{display:flex;align-items:center;gap:6px;max-width:42%;color:var(--mu-acc);font-size:12.5px;font-weight:600;padding:6px 4px}
  .mf-dev .ic{width:18px;height:18px}.mf-dev span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .mf-bot .mvol{flex:1;margin:0}
  /* barras (volumen, posición) */
  .mvol{display:flex;align-items:center;gap:8px;margin-top:8px}.mvol>.ic{width:17px;height:17px;color:var(--mu-mut)}
  .mp-seek{display:flex;align-items:center;gap:10px;font-size:11.5px;color:rgba(255,255,255,.7);font-variant-numeric:tabular-nums}
  .mvol input,.mp-seek input{flex:1;-webkit-appearance:none;appearance:none;height:4px;border-radius:4px;outline:none;cursor:pointer;
    background:linear-gradient(90deg,#fff var(--p,0%),rgba(255,255,255,.25) var(--p,0%))}
  .mvol input:hover,.mp-seek input:hover{background:linear-gradient(90deg,var(--mu-acc) var(--p,0%),rgba(255,255,255,.25) var(--p,0%))}
  .mvol input::-webkit-slider-thumb,.mp-seek input::-webkit-slider-thumb{-webkit-appearance:none;width:13px;height:13px;border-radius:50%;background:#fff;box-shadow:0 2px 6px rgba(0,0,0,.4)}
  .mvol input::-moz-range-thumb,.mp-seek input::-moz-range-thumb{width:13px;height:13px;border:0;border-radius:50%;background:#fff}
  /* hojas (parlantes, cola, menú) */
  .mu-sheet{position:absolute;inset:0;z-index:7;pointer-events:none}
  .mu-sheet.open{pointer-events:auto}
  .ms-bg{position:absolute;inset:0;background:rgba(0,0,0,.6);animation:mufade .25s both}
  @keyframes mufade{from{opacity:0}}
  .ms{position:absolute;left:0;right:0;bottom:0;max-height:82%;overflow-y:auto;padding:10px 18px 26px;border-radius:24px 24px 0 0;background:#11162a;border-top:1px solid rgba(255,255,255,.08);animation:up .35s cubic-bezier(.2,.9,.2,1) both}
  @keyframes up{from{transform:translateY(100%)}}
  .ms-h{margin:10px 0 10px;font-size:18px;font-weight:700}.ms-s{margin:16px 0 4px;font-size:14px;font-weight:700;color:var(--mu-mut)}
  .msd{padding:8px 0;border-bottom:1px solid rgba(255,255,255,.06)}
  .msd-n{display:flex;align-items:center;gap:12px;width:100%;text-align:left}.msd-n>span:nth-child(2){flex:1;min-width:0}
  .msd-n b{display:block;font-size:15px}.msd-n small{display:block;font-size:12.5px;color:var(--mu-mut);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .msd.sel .msd-n b,.msd.sel .msd-n small{color:var(--mu-acc)}
  .msd .hchip{margin-top:6px}
  .eq{width:36px;height:36px;border-radius:8px;display:flex;align-items:flex-end;justify-content:center;gap:3px;padding:10px;background:rgba(255,255,255,.08);flex:none;color:var(--mu-mut)}
  .eq .ic{width:18px;height:18px;align-self:center}
  .eq i{width:3px;background:var(--mu-acc);border-radius:2px;animation:eq 1s ease-in-out infinite}.eq i:nth-child(2){animation-delay:.2s}.eq i:nth-child(3){animation-delay:.4s}
  .eq.sm{width:18px;height:16px;padding:0;background:none;display:inline-flex}
  @keyframes eq{0%,100%{height:30%}50%{height:100%}}
  .ms-row{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px}.ms-row .hchip{display:inline-flex;align-items:center;gap:6px}.ms-row .ic{width:15px;height:15px}
  .mmenu{display:flex;flex-direction:column;margin-top:8px}
  .mmenu button{display:flex;align-items:center;gap:16px;padding:14px 4px;font-size:15px;text-align:left;color:#fff}
  .mmenu .ic{width:22px;height:22px;color:var(--mu-mut)}

  /* marca y gestos */
  .mu-logo{width:34px;height:34px;border-radius:50%;flex:none;display:grid;place-items:center;background:var(--mu-grad);overflow:hidden;font-weight:800;font-size:14px;box-shadow:0 6px 18px rgba(47,107,255,.35)}
  .mu-logo img{width:100%;height:100%;object-fit:cover}
  .mu-head .mu-hi{flex:1;min-width:0}.mu-head .mu-hi small{display:block;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--mu-acc);font-weight:700}
  .mu-head .mu-hi h2{font-size:24px}
  .mf{touch-action:pan-x}
  .mf-sw{width:40px;height:4px;border-radius:4px;background:rgba(255,255,255,.35);margin:0 auto 6px}
  /* pantallas anchas (PC, tablet): más columnas y el reproductor en dos mitades */
  /* barra de arriba y "lo que suena" (sólo en pantallas anchas) */
  .mu-top,.mu-now{display:none}
  .mu-arr{display:none}
  .mu-tt small{display:block;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--mu-acc);font-weight:700}.mu-tt b{font-size:16px}
  .mu-tabs{display:flex;gap:4px;margin-left:8px}
  .mu-tabs button{display:flex;align-items:center;gap:7px;padding:8px 14px;border-radius:999px;font-size:13.5px;font-weight:600;color:var(--mu-mut);transition:background .15s,color .15s}
  .mu-tabs button:hover{color:#fff;background:rgba(255,255,255,.06)}.mu-tabs button.on{color:#fff;background:rgba(255,255,255,.1)}.mu-tabs .ic{width:17px;height:17px}
  .mu-tq{flex:1;max-width:440px;display:flex;align-items:center;gap:8px;height:40px;padding:0 4px 0 14px;margin-left:auto;border-radius:999px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.09);transition:border-color .15s,box-shadow .15s}
  .mu-tq:focus-within{border-color:rgba(62,230,196,.6);box-shadow:0 0 0 3px rgba(62,230,196,.14)}
  .mu-tq>.ic{width:18px;height:18px;color:var(--mu-mut)}
  .mu-tq input{flex:1;min-width:0;height:100%;border:0;background:none;outline:none;color:#fff;font:inherit;font-size:14px}.mu-tq input::placeholder{color:var(--mu-mut)}
  .mn{display:grid;grid-template-columns:52px minmax(0,1fr) minmax(0,1.35fr) minmax(0,1fr);align-items:center;gap:14px;height:100%;padding:0 12px;border-radius:16px;
    background:linear-gradient(90deg,rgba(var(--mc),.55),rgba(var(--mc),.18) 60%,rgba(255,255,255,.04));border:1px solid rgba(255,255,255,.07);transition:background .6s}
  .mn-a{width:52px;height:52px;border-radius:10px;background:var(--mu-card) center/cover;display:grid;place-items:center;color:var(--mu-mut);box-shadow:0 6px 16px rgba(0,0,0,.4)}
  .mn-t{min-width:0;text-align:left}.mn-t b{display:block;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .mn-t small{display:flex;align-items:center;gap:4px;font-size:12px;color:rgba(255,255,255,.7);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.mn-t small .ic{width:12px;height:12px;flex:none}
  .mn>*{min-width:0}
  .mn-c{display:flex;flex-direction:column;gap:2px;min-width:0;max-width:440px;width:100%;justify-self:center}
  .mn .mp-seek input{min-width:0;width:100%}
  .mn-b{display:flex;align-items:center;justify-content:center;gap:6px}
  .mn-b .mf-b{width:34px;height:34px}.mn-b .mf-b .ic{width:20px;height:20px}.mn-b .mf-b.sm .ic{width:17px;height:17px}
  .mn-b .mf-b.main{width:38px;height:38px;box-shadow:0 6px 16px rgba(47,107,255,.4)}.mn-b .mf-b.main .ic{width:18px;height:18px}
  .mn-b .mf-b.one::after{right:4px;top:3px}
  .mn .mp-seek{font-size:10.5px;gap:8px}
  .mn-r{display:flex;align-items:center;justify-content:flex-end;gap:2px;min-width:0}
  .mn-r .mvol{flex:0 1 110px;min-width:56px;margin:0}.mn-r .mvol input{min-width:0;width:100%}
  .mn-r .mf-dev{flex:0 1 auto;min-width:0;max-width:130px}
  .mn-r .mt-x{flex:none}
  /* reproductor de arriba rediseñado: el parlante se lee entero y el volumen tiene su fila, ancha y con el porcentaje */
  .mn{grid-template-columns:56px minmax(0,1fr) minmax(0,1.25fr) minmax(230px,1fr)}
  .mn-a{width:56px;height:56px}
  .mn-r{flex-direction:column;align-items:stretch;justify-content:center;gap:4px}
  .mn-r1{display:flex;align-items:center;gap:2px;min-width:0}
  .mn-r1 .mf-dev{flex:1;min-width:0;max-width:none;justify-content:flex-start}
  .mn-r1 .mf-dev span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .mn-r .mvol{flex:none;width:100%;margin:0;gap:6px}
  .mvol.big input{height:6px;border-radius:6px}
  .mvol.big input::-webkit-slider-thumb{width:18px;height:18px}.mvol.big input::-moz-range-thumb{width:18px;height:18px}
  .mv-p{flex:none;min-width:34px;text-align:right;font-size:11.5px;color:rgba(255,255,255,.75);font-variant-numeric:tabular-nums}
  .mcar.drag{cursor:grabbing}.mcar.drag *{pointer-events:none}
  .mcar{user-select:none;-webkit-user-select:none}
  @container (min-width:720px){
    .mu-top{display:flex;position:absolute;left:0;right:0;top:0;height:64px;z-index:4;align-items:center;gap:10px;padding:0 18px 0 22px;border-bottom:1px solid rgba(255,255,255,.06)}
    .mu-now{display:block;position:absolute;left:0;right:0;top:64px;height:96px;z-index:4;padding:10px 18px}
    .mu-main{top:160px;padding:4px 26px 28px}
    .mu-mini,.mu-nav,.mu-search,.mu-head .mu-logo,.mu-head .mt-x,.mu-head .mu-hi small{display:none}
    .mu-head{padding:14px 0 6px}.mu-head h2,.mu-head .mu-hi h2{font-size:22px}
    .mq{grid-template-columns:repeat(4,1fr);gap:8px}.mq-i{height:48px}.mq-i span{width:48px;height:48px}
    .mu-sec{margin-top:18px}.mu-sec h3{display:flex;align-items:center;font-size:17px;margin-bottom:10px}
    .mu-arr{display:flex;gap:4px;margin-left:auto}.mu-arr .mt-x{background:rgba(255,255,255,.06)}.mu-arr .mt-x:hover{background:rgba(255,255,255,.14)}
    .mu-arr .r .ic{transform:rotate(180deg)}
    .mexp{grid-template-columns:repeat(4,1fr)}.mexp button{height:80px}
    .mcar{margin:0 -26px;padding:0 26px;gap:12px}
    .mc,.mc-a{width:136px}.mc-a{height:136px}.mc-p{top:88px;width:38px;height:38px}
    .mtop-a b{font-size:22px}
    .md{margin:0 -26px;padding:0 26px 12px;text-align:left}
    .md-a{width:150px;height:150px;margin:6px 0 12px}
    .mf{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);grid-template-areas:"top top" "art info" "bot bot";grid-template-rows:auto minmax(0,1fr) auto;
      column-gap:clamp(28px,5cqw,64px);padding:16px max(40px,calc((100% - 980px) / 2)) 24px;overflow:hidden}
    .mf-info{grid-area:info;align-self:center;min-width:0;max-width:440px}
    .mf-top{grid-area:top}.mf-sw{display:none}
    .mf-art{grid-area:art;align-self:center;justify-self:end;width:min(100%,52vh,420px);margin:0}
    .mf-t b{font-size:30px;white-space:normal;line-height:1.15}.mf-t span{font-size:17px}
    .mf-bot{grid-area:bot;margin:0;padding-top:12px}.mf-bot .mvol{flex:0 1 320px;margin-left:auto}
    .ms{left:0;right:0;margin:0 auto;width:min(560px,100%);border-radius:24px 24px 0 0}
  }
  @media (max-height:640px){.mf-art{width:min(100%,34vh)}}
  @media (hover:none){.mu-arr{display:none!important}}
  /* PIN */
  .pin-wrap{position:fixed;inset:0;z-index:30;display:none;place-items:center}
  .pin-wrap.open{display:grid}
  .pin-wrap .backdrop{opacity:1}
  .pin{position:relative;width:min(330px,92vw);padding:26px 22px 18px;text-align:center;background:rgba(14,16,28,.94);animation:rise .3s both;color:var(--txt);font-family:inherit}
  .pin-ic{width:54px;height:54px;margin:0 auto 12px;border-radius:18px;display:grid;place-items:center;background:linear-gradient(135deg,#8f7bff,#3fa9ff)}
  .pin>b{display:block;font-size:17px}.pin>small{color:var(--mut);font-size:12.5px}
  .pdots{height:22px;display:flex;justify-content:center;align-items:center;gap:10px;margin:16px 0}
  .pdots i{width:11px;height:11px;border-radius:50%;background:#fff;animation:rise .2s both}
  .pdots em{color:var(--mut);font-style:normal;letter-spacing:.3em}
  .keys{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
  .key{height:58px;border-radius:20px;background:rgba(255,255,255,.06);font-size:22px;font-weight:400;display:grid;place-items:center;transition:background .15s,transform .1s}
  .key:active{background:rgba(255,255,255,.16);transform:scale(.95)}
  .key.ok{background:linear-gradient(135deg,#8f7bff,#3fa9ff)}
  .link{margin-top:14px;font-size:13px;color:var(--mut);padding:8px}

  /* voz */
  .ib.mic{background:linear-gradient(135deg,rgba(47,107,255,.35),rgba(62,230,196,.25))}
  .vo-wrap{position:fixed;inset:0;z-index:35;display:none}
  .vo-wrap.open{display:block}
  .vo-wrap.open .backdrop{opacity:1;pointer-events:auto}
  .vo-wrap .backdrop{position:absolute;inset:0;background:rgba(3,4,10,.72);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);animation:vofade .25s both}
  @keyframes vofade{from{opacity:0}}
  .vo{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(520px,90vw);display:flex;flex-direction:column;align-items:center;gap:16px;text-align:center;color:var(--txt);animation:voup .35s cubic-bezier(.2,.9,.2,1) both}
  @keyframes voup{from{opacity:0;transform:translate(-50%,-44%)}}
  .vo-orb{position:relative;width:112px;height:112px;border-radius:50%;display:grid;place-items:center;color:#fff;background:linear-gradient(135deg,#2f6bff,#3ee6c4);box-shadow:0 18px 60px rgba(47,107,255,.5);border:0;cursor:pointer}
  .vo-orb .ic{width:40px;height:40px;position:relative;z-index:1}
  .vo.listening .vo-orb{transform:scale(calc(1 + var(--lv,0) * .18));transition:transform .12s ease-out}
  .vo-orb i{position:absolute;inset:0;border-radius:50%;border:2px solid rgba(62,230,196,.6);opacity:0}
  .vo.listening .vo-orb i{animation:voring 1.8s ease-out infinite}.vo.listening .vo-orb i:nth-child(2){animation-delay:.6s}.vo.listening .vo-orb i:nth-child(3){animation-delay:1.2s}
  @keyframes voring{0%{transform:scale(1);opacity:.8}100%{transform:scale(1.9);opacity:0}}
  .vo.thinking .vo-orb{animation:vothink 1.1s ease-in-out infinite}
  @keyframes vothink{50%{transform:scale(.92);filter:brightness(1.2)}}
  .vo.error .vo-orb{background:linear-gradient(135deg,#ff5c6c,#ffb04d);box-shadow:0 18px 60px rgba(255,92,108,.4)}
  .vo-l{font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:#3ee6c4;font-weight:700}
  .vo-t{font-size:clamp(20px,4vw,26px);font-weight:600;line-height:1.3;min-height:1.3em}.vo-t span{font-size:15px;font-weight:400;color:var(--mut)}.vo-t b{color:var(--txt);font-weight:600}
  .vo-s{font-size:17px;color:var(--mut);max-width:440px}
  .vo-why{max-width:340px;text-align:center;font-size:14px;line-height:1.45;color:var(--txt2,rgba(255,255,255,.75))}
  .vo-retry{font-size:12.5px;opacity:.6}
  .vo-go{display:inline-flex;align-items:center;gap:8px;padding:12px 20px;border-radius:999px;background:linear-gradient(135deg,#2f6bff,#3ee6c4);color:#fff;font-weight:600;text-decoration:none}.vo-go .ic{width:18px;height:18px}
  .vo-hf{margin-top:6px;display:inline-flex;align-items:center;gap:8px;padding:9px 14px;border-radius:999px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.06);color:var(--mut);font:inherit;font-size:13px;cursor:pointer}
  .vo-hf.on{border-color:rgba(62,230,196,.5);color:#3ee6c4}.vo-hf .ic{width:15px;height:15px}
  .ib.mic.hf{box-shadow:0 0 0 2px rgba(62,230,196,.7),0 0 18px rgba(62,230,196,.5);animation:hfpulse 2.4s ease-in-out infinite}
  @keyframes hfpulse{50%{box-shadow:0 0 0 2px rgba(62,230,196,.35),0 0 8px rgba(62,230,196,.2)}}
  .vo-a{display:flex;align-items:center;gap:6px;font-size:13px;color:#3ee6c4}.vo-a .ic{width:14px;height:14px}
  .toast{position:fixed;left:50%;bottom:28px;z-index:40;transform:translate(-50%,30px);opacity:0;pointer-events:none;display:flex;align-items:center;gap:10px;padding:12px 18px;border-radius:999px;
    background:rgba(20,23,38,.92);border:1px solid rgba(255,255,255,.12);color:var(--txt);font-size:13.5px;box-shadow:0 18px 50px rgba(0,0,0,.45);transition:all .35s cubic-bezier(.2,.9,.2,1);
    -webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);font-family:inherit;white-space:nowrap}
  .toast.show{opacity:1;transform:translate(-50%,0)}
  .toast .ic{width:18px;height:18px;color:var(--accent)}

  .app.intro .hero,.app.intro .room,.app.intro .mode,.app.intro .secu,.app.intro .people,.app.intro .cam{animation:rise .7s both;animation-delay:calc(var(--i,0)*55ms)}

  @media (min-width:900px){
    .sheet{left:50%;right:auto;bottom:50%;width:min(760px,92vw);max-height:86vh;border-radius:30px;border-bottom:1px solid rgba(255,255,255,.1);transform:translate(-50%,58%) scale(.96);opacity:0;transition:transform .45s cubic-bezier(.2,.9,.2,1),opacity .3s}
    .sheet-wrap.open .sheet{transform:translate(-50%,50%);opacity:1}
    .grab{display:none}
  }
  @container mae (max-width:920px){.layout{grid-template-columns:minmax(0,1fr)}.col-l{position:static}}
  @media (max-width:560px){
    .app{padding:16px 16px 28px}
    .tgt b{font-size:48px}
  }
  @container mae (max-width:520px){
    .clock b{font-size:26px}.wx span{display:none}.brand em{display:none}
    .hero{padding:20px}.orb{width:92px;height:92px}.orb-core{inset:21px}.orb-core b{font-size:18px}
    .stats{grid-template-columns:repeat(2,1fr)}
    .rooms{grid-template-columns:repeat(2,1fr);gap:10px}
    .room{min-height:136px;padding:14px;border-radius:22px}
  }
  @media (prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}}
  `;

  /* ───────────────────────── Tarjeta ───────────────────────── */
  class MatterAIHomeCard extends HTMLElement {
    constructor() {
      super();
      this._cache = {};
      this._pt = {}; // temperatura objetivo pendiente (debounce)
      this._ptT = {};
      this._dismissed = new Set();
      this._room = null;
      this._drag = null;
      this._pin = null;
    }

    static getStubConfig() { return { installer: 'MatterAI' }; }
    /** Editor visual de Home Assistant (sólo administradores: el instalador). */
    static getConfigElement() { return document.createElement('matterai-home-card-editor'); }
    getCardSize() { return 14; }
    getGridOptions() { return { columns: 'full', rows: 'auto' }; }

    setConfig(config) {
      this._config = Object.assign({ installer: 'MatterAI', suggestions: true, max_scenes: 8, max_cameras: 4, idle_minutes: 20 }, config || {});
      this._cache = {};
      this._camEl = null; this._camFail = false; this._camWait = false;
      const fp = this._fp();
      this._fpPos = {};
      if (fp && fp.rooms) Object.entries(fp.rooms).forEach(([k, v]) => { if (v && v.x != null && v.y != null) this._fpPos[String(k).toLowerCase()] = { x: +v.x, y: +v.y, r: v.r != null ? +v.r : 14 }; });
      if (fp && fp.devices) Object.entries(fp.devices).forEach(([k, v]) => { if (v && v.x != null && v.y != null) this._fpPos[`dev:${k}`] = { x: +v.x, y: +v.y, fixed: true }; });
      if (this._root) { this._applyBrand(); this._applyLayout(); this._applyPerf(); this._schedule(); }
    }

    _fp() { const f = this._config && this._config.floorplan; return f && f.image ? f : null; }
    _planSrc() {
      const f = this._fp(); if (!f) return '';
      const ph = this._phase();
      return this._url((ph === 'night' && f.image_night) || (ph === 'day' && f.image_day) || f.image);
    }

    /* Con plano: 3 columnas (info · plano · ambientes). Sin plano: 2 columnas. */
    _applyLayout() {
      const E = this._els, fp = this._fp();
      // lugar original de cada bloque (después se acomoda según haya plano y según el diseño elegido)
      [E.hero, E.suggest, E.security, E.people].forEach((el) => el && E.coll && E.coll.appendChild(el));
      [E.modes, E.roomshead, E.rooms, E.cams].forEach((el) => el && E.colr && E.colr.appendChild(el));
      E.layout.classList.toggle('fp', !!fp);
      if (fp) {
        // Pestañas: "Casa" (el plano) y "Seguridad" (alarma, accesos y cámaras)
        if (typeof document !== 'undefined' && document.createElement) {
          if (!E.ctabs) { E.ctabs = document.createElement('div'); E.ctabs.className = 'ctabs'; E.ctabs.id = 'ctabs'; }
          if (!E.secpane) { E.secpane = document.createElement('div'); E.secpane.className = 'secpane'; E.secpane.id = 'secpane'; }
          E.colc.insertBefore(E.ctabs, E.plan);
          E.colc.appendChild(E.secpane);
          E.secpane.appendChild(E.security); E.secpane.appendChild(E.cams);
          delete this._cache.ctabs;
        } else E.colc.appendChild(E.cams);
        E.colc.appendChild(E.modes); // accesos rápidos debajo del plano: a mano y en grilla
        E.plan.innerHTML = `<div class="plan glass"><div class="plan-stage" id="stage"><img class="plan-img" id="planimg" alt="" draggable="false">
          <div class="plan-dim"></div><div class="planfx" id="planfx"></div></div><div id="planyaml"></div></div>`;
        E.plan.querySelectorAll('[id]').forEach((el) => { E[el.id] = el; });
        if (fp.night_dim != null) E.app.style.setProperty('--dimn', fp.night_dim); else E.app.style.removeProperty('--dimn');
        E.planimg.addEventListener('load', () => {
          const w = E.planimg.naturalWidth, h = E.planimg.naturalHeight;
          if (w && h) E.stage.style.aspectRatio = `${w} / ${h}`;
        });
        E.planimg.src = this._planSrc();
      } else {
        E.plan.innerHTML = '';
        E.colr.insertBefore(E.modes, E.colr.firstChild);
        if (E.ctabs) { E.ctabs.remove(); E.secpane.remove(); E.ctabs = null; E.secpane = null; E.coll.insertBefore(E.security, E.people); delete E.colc.dataset.tab; }
        E.colr.appendChild(E.cams);
      }
      this._applyBlocks(fp);
      delete this._cache.planfx; delete this._cache.planyaml; delete this._cache.rooms;
    }

    /**
     * Diseño elegido por el instalador (editor → Diseño):
     * layout: { left: [resumen, sugerencias, ...], center: [modos], right: [ambientes] }.
     * Con plano, seguridad y cámaras quedan en su pestaña; sin plano, "center" va a la derecha.
     */
    _applyBlocks(fp) {
      const Lc = this._config.layout; if (!Lc || typeof Lc !== 'object') return;
      const E = this._els, B = MatterAIHomeCard.blocks(E, fp && !!E.secpane);
      const cols = { left: E.coll, center: fp ? E.colc : E.colr, right: E.colr };
      ['left', 'center', 'right'].forEach((k) => (Array.isArray(Lc[k]) ? Lc[k] : []).forEach((name) => (B[name] || []).forEach((el) => el && cols[k] && cols[k].appendChild(el))));
    }
    static blocks(E, tabs) {
      const B = { resumen: [E.hero], sugerencias: [E.suggest], personas: [E.people], modos: [E.modes], ambientes: [E.roomshead, E.rooms] };
      if (!tabs) { B.seguridad = [E.security]; B.camaras = [E.cams]; }
      return B;
    }

    set hass(h) {
      this._hass = h;
      if (!this._root) this._build();
      this._schedule();
    }
    get hass() { return this._hass; }

    connectedCallback() {
      // si HA le pasó hass antes de que la tarjeta terminara de cargar, quedó tapando el setter: se recoge acá
      if (Object.prototype.hasOwnProperty.call(this, 'hass')) { const v = this.hass; delete this.hass; if (this._config) this.hass = v; else this._hass = v; }
      this._clockT = setInterval(() => this._tick(), 15000);
      this._camT = setInterval(() => this._refreshCams(), 10000);
      this._keyH = (e) => { if (e.key === 'Escape' && this._vo) { this._voiceStop(true); return; } if (e.key === 'Escape') { if (this._pin) { this._pin = null; this._renderPin(); } else if (this._mus) this._closeMusic(); else if (this._act) this._closeAct(); else this._closeRoom(); } };
      window.addEventListener('keydown', this._keyH);
      this._visH = () => this._pauseCams(document.hidden);
      this._scrollH = () => this._onScroll();
      window.addEventListener('scroll', this._scrollH, { capture: true, passive: true });
      document.addEventListener('visibilitychange', this._visH);
      if (this._root) { this._tick(); this._pauseCams(false); }
    }
    disconnectedCallback() {
      clearInterval(this._clockT); clearInterval(this._camT);
      window.removeEventListener('keydown', this._keyH);
      document.removeEventListener('visibilitychange', this._visH);
      window.removeEventListener('scroll', this._scrollH, { capture: true });
      this._pauseCams(true);
    }

    /** Cómo se dibuja, según el equipo (`performance: lite | fluid | full` lo fuerza):
     *  - full: vidrio esmerilado y fondos con desenfoque en vivo (computadoras).
     *  - fluid: el mismo diseño sin desenfoques en vivo, que son lo que traba al deslizar (celulares y tablets).
     *  - lite: además sin animaciones de fondo (equipos muy chicos o «reducir movimiento»). */
    _perf() {
      const p = this._config && this._config.performance;
      if (p === 'lite' || p === 'fluid' || p === 'full') return p;
      if (typeof navigator === 'undefined') return 'full';
      const mem = navigator.deviceMemory, cores = navigator.hardwareConcurrency;
      const mq = (q) => typeof matchMedia === 'function' && matchMedia(q).matches;
      if (mq('(prefers-reduced-motion: reduce)') || (mem != null && mem <= 2) || (cores != null && cores <= 2)) return 'lite';
      if (mq('(pointer: coarse)') || (mem != null && mem <= 4) || (cores != null && cores <= 4)) return 'fluid';
      return 'full';
    }
    _applyPerf() {
      const app = this._els && this._els.app; if (!app) return;
      const p = this._perf();
      app.classList.toggle('lite', p === 'lite');
      app.classList.toggle('fluid', p === 'fluid');
    }

    /* Mientras se desliza no se redibuja nada (los cambios de estado esperan a que el dedo pare, máx. 1,5 s):
     * cambiar el contenido en pleno scroll obliga a recalcular la página y es lo que se siente como "trabado". */
    _onScroll() { this._scrollAt = Date.now(); }
    _scrolling() { return Date.now() - (this._scrollAt || 0) < SCROLL_IDLE; }

    /* ---------- estructura fija ---------- */
    _build() {
      const root = this.attachShadow({ mode: 'open' });
      // las hojas que se abren adentro de la tarjeta también cuentan como «deslizando»
      root.addEventListener('scroll', () => this._onScroll(), { capture: true, passive: true });
      root.innerHTML = `<style>${CSS}</style>
      <div class="app intro ${this._perf()}" id="app" data-phase="night">
        <div class="aurora"><i class="a1"></i><i class="a2"></i><i class="a3"></i></div><div class="dots"></div>
        <div class="wrap">
          <header class="top">
            <div class="brand" id="brand"></div>
            <div class="top-r"><div id="weather"></div><button class="clock" id="clockbtn" data-action="panel" data-v="agenda" title="Agenda, recordatorios y alarmas"><b id="time"></b><span id="date"></span></button><div id="topx"></div></div>
          </header>
          <div class="layout" id="layout">
            <div class="col-c" id="colc"><section id="plan"></section></div>
            <aside class="col-l" id="coll">
              <section class="hero glass" id="hero">
                <div class="hero-row">
                  <div class="orb" id="orb"><i></i><i></i><i></i><div class="orb-core" id="orbcore"></div></div>
                  <div><div class="hello" id="hello"></div><h1 id="headline"></h1></div>
                </div>
                <div class="ai-tag">${ic('sparkle')} Resumen en tiempo real</div>
                <p class="insight" id="insight"></p>
                <div class="stats" id="stats"></div>
              </section>
              <section id="suggest"></section>
              <section id="security"></section>
              <section id="people"></section>
            </aside>
            <main class="col-r" id="colr">
              <section id="modes"></section>
              <div class="sec-h" id="roomshead"><h2>Ambientes</h2><span id="roomsmeta"></span></div>
              <section class="rooms" id="rooms"></section>
              <section id="cams"></section>
            </main>
          </div>
        </div>
        <footer class="foot" id="footer"></footer>
        <div class="sheet-wrap" id="sheetwrap"><div class="backdrop" data-action="close"></div><div class="sheet" id="sheet"></div></div>
        <div class="actv-wrap" id="muswrap"><div class="backdrop" data-action="musclose"></div><div class="actv mus" id="mus"></div></div>
        <div class="actv-wrap" id="actwrap"><div class="backdrop" data-action="actclose"></div><div class="actv" id="act"></div></div>
        <div class="pin-wrap" id="pinwrap"></div>
        <div class="vo-wrap" id="vowrap"></div>
        <div class="toast" id="toast"></div>
      </div>`;
      this._root = root;
      this._els = {};
      root.querySelectorAll('[id]').forEach((el) => { this._els[el.id] = el; });
      root.addEventListener('click', (e) => this._onClick(e));
      root.addEventListener('pointerdown', (e) => this._onDown(e));
      root.addEventListener('pointermove', (e) => this._onMove(e));
      root.addEventListener('pointerup', (e) => this._onUp(e));
      root.addEventListener('pointercancel', () => this._cancelDrag());
      root.addEventListener('contextmenu', (e) => { if (e.target.closest('[data-pill],[data-eid]')) e.preventDefault(); });
      root.addEventListener('wheel', (e) => this._onWheel(e), { passive: false });
      root.addEventListener('focusout', (e) => { if (e.target && e.target.id === 'actq' && this._act) this._act.typing = 0; });
      const formField = (e) => {
        const f = this._ag && this._ag.form, k = e.target && e.target.dataset && e.target.dataset.f;
        if (f && k && e.target.closest && e.target.closest('.agform')) f[k] = e.target.value;
      };
      root.addEventListener('change', formField);
      // Música: volumen, posición y buscador
      root.addEventListener('pointerdown', (e) => { if (e.target && e.target.matches && e.target.matches('input[type=range][data-mvol],input[type=range][data-mseek]')) this._musDrag = true; }, true);
      const musEnd = () => { if (this._musDrag) { this._musDrag = false; setTimeout(() => this._mus && this._muLive(), 600); } };
      root.addEventListener('pointerup', musEnd, true);
      // Carruseles: con el mouse se arrastran de costado (como en el celular con el dedo)
      root.addEventListener('pointerdown', (e) => {
        const car = this._mus && e.pointerType === 'mouse' && e.button === 0 && e.target.closest && e.target.closest('.mcar');
        this._musCar = car ? { el: car, x: e.clientX, sl: car.scrollLeft, moved: false } : null;
      }, true);
      root.addEventListener('pointermove', (e) => {
        const d = this._musCar; if (!d) return;
        const dx = e.clientX - d.x;
        if (!d.moved && Math.abs(dx) > 6) { d.moved = true; d.el.classList.add('drag'); }
        if (d.moved) d.el.scrollLeft = d.sl - dx;
      });
      const carEnd = () => { const d = this._musCar; this._musCar = null; if (d && d.moved) { d.el.classList.remove('drag'); this._musSwiped = Date.now(); } };
      root.addEventListener('pointerup', carEnd, true);
      root.addEventListener('pointercancel', carEnd, true);
      root.addEventListener('pointerdown', (e) => {
        if (!this._mus) return;
        const t = e.target, el = t && t.closest && t.closest('.mf,.mm');
        this._musSw = el && !(t.matches && t.matches('input')) ? { el: el.classList.contains('mm') ? 'mini' : 'full', x: e.clientX, y: e.clientY, t: Date.now() } : null;
      }, true);
      root.addEventListener('pointerup', (e) => {
        const sw = this._musSw; this._musSw = null;
        if (!sw || !this._mus || Date.now() - sw.t > 700) return;
        const dx = e.clientX - sw.x, dy = e.clientY - sw.y;
        if (sw.el === 'full' && dy > 90 && Math.abs(dx) < 70) { this._musSwiped = Date.now(); this._musAction('full0', {}); }
        else if (sw.el === 'mini' && Math.abs(dx) > 60 && Math.abs(dy) < 40) { this._musSwiped = Date.now(); this._musCtl(dx < 0 ? 'media_next_track' : 'media_previous_track'); }
      }, true);
      root.addEventListener('pointercancel', musEnd, true);
      root.addEventListener('input', (e) => {
        const t = e.target; if (!t || !this._mus) return;
        if (t.id === 'muqtop') { // buscador de la barra de arriba (PC): lleva a la página de búsqueda
          const u = this._mus;
          if (u.page !== 'search' || u.stack.length) { u.stack = []; u.page = 'search'; u.full = false; u.mainKey = null; this._muR('munav'); this._muR('mufull'); }
        }
        if (t.id === 'muq' || t.id === 'muqtop') {
          this._muSearch(t.value);
          const x = t.parentNode && t.parentNode.querySelector('[data-action="m_clear"]');
          if (x) x.classList.toggle('hide', !t.value);
          return;
        }
        if (t.dataset && (t.dataset.mvol || t.dataset.mseek)) {
          t.style.setProperty('--p', `${(t.value / (t.max || 100) * 100).toFixed(1)}%`);
          if (t.dataset.mseek) { const t0 = t.previousElementSibling; if (t0) t0.textContent = mmss(Number(t.value)); }
          if (t.dataset.mvol) { const pv = t.nextElementSibling; if (pv && pv.classList && pv.classList.contains('mv-p')) pv.textContent = `${t.value}%`; }
        }
      });
      root.addEventListener('change', (e) => {
        const t = e.target; if (!t || !t.dataset || !this._mus) return;
        if (t.dataset.mvol) this._call('media_player', 'volume_set', { entity_id: t.dataset.mvol, volume_level: Number(t.value) / 100 });
        if (t.dataset.mseek && this._mus.player) this._call('media_player', 'media_seek', { entity_id: this._mus.player, seek_position: Number(t.value) });
        this._musDrag = false;
      });
      root.addEventListener('input', formField);
      root.addEventListener('input', (e) => {
        if (e.target && e.target.id === 'actq' && this._act) { this._act.q = e.target.value; this._act.typing = e.target.selectionStart || e.target.value.length; this._act.shown = 150; this._renderAct(); }
      });
      this._applyBrand();
      this._applyLayout();
      this._tick();
      setTimeout(() => this._els.app.classList.remove('intro'), 1600);
    }

    _applyBrand() {
      const c = this._config;
      if (c.accent) this.style.setProperty('--accent', c.accent);
      const logo = c.logo ? `<img src="${esc(this._url(c.logo))}" alt="">` : `<span class="mono">${esc((c.installer || 'M').charAt(0))}</span>`;
      this._els.brand.innerHTML = `${logo}<span><b>${esc(c.installer)}</b> <em>· Smart Home</em></span>`;
      this._els.topx.innerHTML = `<div style="display:flex;gap:8px"><button class="ib mic" id="topmic" data-action="voice" aria-label="Hablar" title="Hablarle a la casa" hidden>${ic('mic')}</button><button class="ib" id="topmus" data-action="music" aria-label="Música" title="Música" hidden>${ic('music')}</button><button class="ib" data-action="act" aria-label="Actividad" title="Actividad">${ic('history')}</button>${c.menu ? `<button class="ib" data-action="menu" aria-label="Menú">${ic('menu')}</button>` : ''}</div>`;
    }

    /* Rutas de Home Assistant ("/api/…", "/local/…") cuando la tarjeta corre fuera de HA (app MatterAI). */
    _url(u) {
      const b = this._config && this._config.base_url;
      return u && b && u.charAt(0) === '/' ? b.replace(/\/+$/, '') + u : u;
    }

    _tick() {
      if (!this._els) return;
      const d = new Date();
      this._els.time.textContent = d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
      this._els.date.textContent = d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
      this._els.app.dataset.phase = this._phase();
      if (this._fp() && this._els.planimg) { const s = this._planSrc(); if (this._els.planimg.getAttribute('src') !== s) this._els.planimg.src = s; }
      this._schedule(); // refresca "hace X min" y sugerencias
    }

    _phase() {
      const sun = this._hass && this._hass.states['sun.sun'];
      let e = sun ? num(sun.attributes.elevation) : null;
      if (e == null) { const d = new Date(); e = 60 * Math.sin(((d.getHours() + d.getMinutes() / 60) - 6.5) / 12 * Math.PI); }
      return e > 12 ? 'day' : e > -4 ? 'golden' : 'night';
    }

    _schedule() {
      if (this._raf || !this._root) return;
      if (this._scrolling() && Date.now() - (this._deferSince || (this._deferSince = Date.now())) < SCROLL_MAX_WAIT) {
        if (!this._deferT) this._deferT = setTimeout(() => { this._deferT = null; this._schedule(); }, SCROLL_IDLE);
        return;
      }
      this._deferSince = 0;
      this._raf = requestAnimationFrame(() => { this._raf = null; try { this._update(); } catch (err) { console.error('[matterai-home-card]', err); } });
    }

    _set(id, html) {
      if (this._cache[id] === html) return;
      this._cache[id] = html;
      this._els[id].innerHTML = html;
    }

    /* ---------- modelo de la casa ---------- */
    _name(id, room) {
      if (this._names && this._names[id]) return this._names[id];
      const st = this._hass.states[id];
      const orig = (st && st.attributes.friendly_name) || id.split('.')[1].replace(/_/g, ' ');
      let n = orig;
      if (room) {
        const rn = room.name.toLowerCase(), l = n.toLowerCase();
        if (l.startsWith(rn + ' ')) n = n.slice(rn.length + 1);
        else if (l.endsWith(' ' + rn)) n = n.slice(0, -(rn.length + 1)).replace(/\s+(del|de la|de|en)$/i, '');
        n = n.trim();
      }
      return cap(n || orig);
    }

    /** Nombre con su ambiente cuando hace falta: "Puerta (Dormitorio)". */
    _label(id) {
      const r = this._roomOf && this._roomOf[id];
      const n = this._name(id, r);
      return r && !n.toLowerCase().includes(r.name.toLowerCase()) ? `${n} (${r.name})` : n;
    }

    _model() {
      const h = this._hass, c = this._config, S = h.states;
      const reg = h.entities || {}, devs = h.devices || {}, areas = h.areas || {};
      const exA = new Set((c.exclude_areas || []).map((x) => String(x).toLowerCase()));
      const exE = new Set(c.exclude_entities || []);
      const lightKw = c.light_keywords ? new RegExp(c.light_keywords, 'i') : LIGHT_KW;
      const explicit = Array.isArray(c.rooms) && c.rooms.length > 0;
      const rooms = [], byId = {};
      const newRoom = (id, name, icon) => {
        const r = { id, name, icon: icon && P[icon] ? icon : roomIcon(name),
          lights: [], covers: [], climates: [], fans: [], media: [], switches: [], temps: [], hums: [], motion: [], openings: [], locks: [], cams: [], sensors: [], actions: [] };
        rooms.push(r); byId[id] = r; return r;
      };
      // Nombres propios: cualquier entidad de la config puede venir como { entity, name }.
      this._names = {};
      const entOf = (x) => {
        if (x && typeof x === 'object') { if (x.entity && x.name) this._names[x.entity] = x.name; return x.entity; }
        return x;
      };
      const place = (r, eid) => {
        const st = S[eid], d = dom(eid), dc = st.attributes.device_class;
        switch (d) {
          case 'light': r.lights.push(eid); break;
          case 'switch': (dc !== 'outlet' && lightKw.test(this._names[eid] || st.attributes.friendly_name || eid) ? r.lights : r.switches).push(eid); break;
          case 'input_boolean': case 'automation': r.switches.push(eid); break;
          case 'cover': r.covers.push(eid); break;
          case 'climate': r.climates.push(eid); break;
          case 'fan': r.fans.push(eid); break;
          case 'media_player': r.media.push(eid); break;
          case 'lock': r.locks.push(eid); break;
          case 'camera': r.cams.push(eid); break;
          case 'script': case 'scene': case 'button': case 'input_button': r.actions.push(eid); break;
          case 'sensor':
            if (dc === 'temperature') r.temps.push(eid); else if (dc === 'humidity') r.hums.push(eid);
            if (explicit && dc !== 'temperature' && dc !== 'humidity') r.sensors.push(eid);
            break;
          case 'binary_sensor':
            if (MOTION_DC.has(dc)) r.motion.push(eid); else if (OPEN_DC.has(dc)) r.openings.push(eid); else if (explicit) r.sensors.push(eid);
            break;
          default: break;
        }
      };

      if (explicit) {
        // Ambientes definidos por el instalador: mismas entidades y mismo orden que su dashboard.
        c.rooms.forEach((rc, i) => {
          if (!rc || !rc.name) return;
          const id = String(rc.id || slug(rc.name) || `room${i}`);
          const r = byId[id] || newRoom(id, rc.name, rc.icon);
          if (rc.cameras_position) r.camPos = rc.cameras_position; // top · after (por defecto) · end
          r.ord = r.ord || {}; // orden que eligió el instalador: los bloques de la ventana salen en ese orden
          (rc.entities || []).forEach((x) => {
            const eid = entOf(x);
            if (!eid || exE.has(eid) || !S[eid] || S[eid].state === 'unavailable') return;
            if (!(eid in r.ord)) r.ord[eid] = Object.keys(r.ord).length;
            place(r, eid);
          });
        });
      } else {
        for (const a of Object.values(areas)) {
          if (exA.has(String(a.area_id).toLowerCase()) || exA.has(String(a.name || '').toLowerCase())) continue;
          newRoom(a.area_id, a.name || a.area_id, (c.area_icons || {})[a.area_id]);
        }
      }
      ['people', 'access', 'security_entities', 'scenes', 'cameras'].forEach((k) => { if (Array.isArray(c[k])) c[k].forEach(entOf); });

      const g = { scenes: [], people: [], cams: [], access: [], openings: [], weather: null, alarm: null };
      for (const eid in S) {
        if (exE.has(eid)) continue;
        const st = S[eid], d = dom(eid), e = reg[eid];
        if (e && (e.hidden || e.hidden_by || e.entity_category)) continue;
        if (st.state === 'unavailable') continue;
        const dc = st.attributes.device_class;
        if (d === 'scene') g.scenes.push(eid);
        else if (d === 'person') g.people.push(eid);
        else if (d === 'camera') g.cams.push(eid);
        else if (d === 'weather' && !g.weather) g.weather = eid;
        else if (d === 'alarm_control_panel' && !g.alarm) g.alarm = eid;
        else if (d === 'lock' || (d === 'cover' && (dc === 'garage' || dc === 'gate'))) g.access.push(eid);
        else if (d === 'binary_sensor' && OPEN_DC.has(dc)) g.openings.push(eid);
        if (explicit) continue;
        const aid = e ? (e.area_id || (devs[e.device_id] || {}).area_id) : null;
        const r = aid && byId[aid];
        if (r) place(r, eid);
      }
      const isOn = (id) => S[id].state === 'on';
      for (const r of rooms) {
        // Grupos de luces: en modo automático se ocultan si están sus luces sueltas;
        // en modo manual se muestran (el instalador los eligió) pero no se cuentan dos veces.
        const groups = r.lights.filter((id) => Array.isArray(S[id].attributes.entity_id));
        if (!explicit && groups.length && groups.length < r.lights.length) r.lights = r.lights.filter((id) => !groups.includes(id));
        r.lightsCtl = groups.length && groups.length < r.lights.length ? r.lights.filter((id) => !groups.includes(id)) : r.lights;
        r.lightsOn = r.lightsCtl.filter(isOn);
        r.climOn = r.climates.filter((id) => S[id].state !== 'off');
        r.mediaOn = r.media.filter((id) => S[id].state === 'playing');
        r.fansOn = r.fans.filter(isOn);
        r.motionOn = r.motion.some(isOn);
        r.openNow = r.openings.filter(isOn);
        r.temp = num(r.temps.map((id) => S[id].state).find((v) => num(v) != null));
        if (r.temp == null) { const cl = r.climates.find((id) => num(S[id].attributes.current_temperature) != null); if (cl) r.temp = num(S[cl].attributes.current_temperature); }
        r.hum = num(r.hums.map((id) => S[id].state).find((v) => num(v) != null));
        r.count = r.lights.length + r.covers.length + r.climates.length + r.fans.length + r.media.length + r.switches.length + r.locks.length + r.actions.length;
        const cols = r.lightsOn.map((id) => lightRGB(S[id]).split(',').map(Number));
        r.rgb = cols.length ? [0, 1, 2].map((k) => Math.round(avg(cols.map((cc) => cc[k])))).join(',') : '255,184,108';
        const bris = r.lightsOn.map((id) => (S[id].attributes.brightness != null ? S[id].attributes.brightness / 2.55 : 100));
        r.bri = bris.length ? Math.max(4, Math.round(avg(bris))) : 0;
        r.glow = (0.35 + 0.65 * r.bri / 100).toFixed(2);
      }
      const off = (k) => featOff(c, k);
      if (off('cameras')) rooms.forEach((r) => { r.cams = []; });
      const order = (c.area_order || []).map((x) => String(x).toLowerCase());
      const rank = (r) => { const i = order.findIndex((o) => o === String(r.id).toLowerCase() || o === r.name.toLowerCase()); return i < 0 ? 999 : i; };
      const list = rooms.filter((r) => r.count + r.temps.length + r.cams.length + r.sensors.length + r.motion.length + r.openings.length > 0)
        .map((r, i) => [r, i]).sort((a, b) => rank(a[0]) - rank(b[0]) || a[1] - b[1]).map((x) => x[0]);

      const ids = (k) => (Array.isArray(c[k]) ? c[k].map(entOf).filter((id) => id && S[id]) : null);
      const pick = (key, fallback) => (c[key] === false ? null : typeof c[key] === 'string' && S[c[key]] ? c[key] : fallback);
      const weather = off('weather') ? null : pick('weather', g.weather);
      const alarms = off('security') ? [] : ids('alarm') || (pick('alarm', g.alarm) ? [pick('alarm', g.alarm)] : []);
      const alarm = alarms[0];
      const people = off('people') ? [] : ids('people') || (c.people === false ? [] : g.people);
      const secEnts = off('security') ? [] : ids('security_entities') || [];
      const scenes = (ids('scenes') || (c.scenes === false ? [] : g.scenes)).slice(0, c.max_scenes);
      const cams = off('cameras') ? [] : (ids('cameras') || (c.cameras === false ? [] : g.cams)).slice(0, c.max_cameras);
      const access = off('security') ? [] : ids('access') || g.access;
      const openBin = [...new Set([...g.openings, ...secEnts.filter((id) => dom(id) === 'binary_sensor' && OPEN_DC.has(S[id].attributes.device_class))])].filter(isOn);
      const openAcc = access.filter((id) => dom(id) === 'cover' && ['open', 'opening'].includes(S[id].state));
      // A qué ambiente pertenece cada dispositivo (el primero donde aparece): para nombrarlo sin ambigüedad.
      const roomOf = {};
      list.forEach((r) => ['lights', 'covers', 'climates', 'fans', 'media', 'switches', 'locks', 'openings', 'motion', 'sensors', 'temps', 'hums', 'cams', 'actions']
        .forEach((k) => r[k].forEach((id) => { if (!roomOf[id]) roomOf[id] = r; })));
      this._roomOf = roomOf;
      // Todas las aberturas (puertas, ventanas, portones, cerraduras), abiertas o no
      const openAll = [...new Set([...list.flatMap((r) => r.openings), ...g.openings,
        ...secEnts.filter((id) => dom(id) === 'binary_sensor' && OPEN_DC.has(S[id].attributes.device_class)),
        ...access, ...list.flatMap((r) => r.covers.filter((id) => ['garage', 'gate', 'door'].includes(S[id].attributes.device_class))), ...list.flatMap((r) => r.locks)])]
        .filter((id) => S[id]);
      const openNames = [...openBin, ...openAcc].map((id) => this._label(id));
      const indoor = list.filter((r) => r.icon !== 'tree' && r.temp != null);
      const hum = list.filter((r) => r.icon !== 'tree' && r.hum != null);
      const lightsAll = new Set(list.flatMap((r) => r.lightsCtl)).size;
      const f = this._features({ lightsAll, openAll, weather, alarms, access, secEnts, people, cams, power: c.power && S[c.power] });
      return {
        f, lightsAll,
        rooms: list, byId, weather: weather && S[weather], alarm: alarm && S[alarm], alarms: alarms.map((id) => S[id]), secEnts,
        people: people.map((id) => S[id]), scenes, cams, access, roomOf, openAll, indoor,
        openBin, openAcc, openNames,
        lightsOn: new Set(list.flatMap((r) => r.lightsOn)).size, // una luz puede estar en dos ambientes
        tempIn: indoor.length ? avg(indoor.map((r) => r.temp)) : null,
        humIn: hum.length ? avg(hum.map((r) => r.hum)) : null,
        power: c.power && S[c.power] ? S[c.power] : null,
      };
    }

    /**
     * Qué secciones muestra esta casa. Cada una aparece sola si la casa tiene con qué (auto) y
     * el instalador la puede apagar o forzar con `features: { music: false, cameras: false, ... }`.
     * Devuelve { clave: true|false } y guarda el porqué en this._featWhy (para el instalador).
     */
    _features(x) {
      const c = this._config, h = this._hass || {}, sv = h.services || {}, S = h.states || {};
      const ws = typeof h.callWS === 'function';
      const cals = Object.keys(S).some((id) => id.startsWith('calendar.'));
      // automatizaciones: MatterAI 2.0+ (matterai.run) o la integración vieja MatterAI Escenas
      const hasAuto = !!((sv.matterai && sv.matterai.run) || sv.matterai_escenas);
      const auto = {
        lights: [x.lightsAll > 0, x.lightsAll ? `${x.lightsAll} luces` : 'no hay luces'],
        openings: [x.openAll.length > 0, x.openAll.length ? `${x.openAll.length} aberturas` : 'no hay sensores de puertas/ventanas'],
        security: [!!(x.alarms.length || x.access.length || x.secEnts.length), x.alarms.length ? 'hay alarma' : x.access.length ? 'hay accesos' : 'no hay alarma ni accesos'],
        people: [x.people.length > 0, x.people.length ? `${x.people.length} personas` : 'no hay personas (person.*)'],
        cameras: [!!(x.cams.length || c.camera_card), x.cams.length ? `${x.cams.length} cámaras` : c.camera_card ? 'camera_card configurada' : 'no hay cámaras'],
        music: [ws && this._musPlayers().length > 0, this._musPlayers().length ? `${this._musPlayers().length} parlantes` : 'no hay parlantes'],
        weather: [!!x.weather, x.weather ? x.weather : 'no hay weather.*'],
        agenda: [ws && (cals || hasAuto), cals ? 'hay calendarios' : hasAuto ? 'recordatorios de las automatizaciones' : 'sin calendarios ni automatizaciones MatterAI'],
        activity: [ws, ws ? 'historial de HA' : 'sin conexión WebSocket'],
        automations: [!!c.automations, c.automations ? 'MatterAI Escenas' : 'sin MatterAI Escenas en la app'],
        energy: [!!x.power, x.power ? c.power : 'sin power:'],
        suggestions: [c.suggestions !== false, 'sugerencias'],
      };
      const fc = c.features || {}, out = {}, why = {};
      Object.keys(auto).forEach((k) => {
        const forced = fc[k] === true || fc[k] === false ? fc[k] : null;
        out[k] = forced == null ? auto[k][0] : forced;
        why[k] = forced == null ? `auto: ${auto[k][1]}` : `forzado ${forced ? 'sí' : 'no'} (features.${k})`;
      });
      if (c.music === false) { out.music = false; why.music = 'music: false'; }
      this._featWhy = why;
      return out;
    }
    /** Para la app y el instalador: qué se muestra en esta casa y por qué. */
    features() { const m = this._m || (this._hass && this._config ? this._model() : null); return m ? Object.assign({}, m.f) : {}; }
    featuresReport() { this.features(); const m = this._m && this._m.f; return m ? Object.keys(m).map((k) => `${m[k] ? '✓' : '·'} ${k} — ${this._featWhy[k]}`).join('\n') : ''; }

    /* ---------- "inteligencia": resumen y sugerencias ---------- */
    _insight(m) {
      const a = m.alarm, bits = [];
      let level = 'calm', head = 'Todo en orden';
      if (a && a.state === 'triggered') { level = 'alert'; head = '¡Alarma disparada!'; }
      else if (m.openNames.length) { level = 'attention'; head = m.openNames.length > 1 ? 'Quedaron cosas abiertas' : 'Algo quedó abierto'; }
      else if (a && a.state.startsWith('armed')) { level = 'armed'; head = 'Tu casa está protegida'; }
      else if (!m.lightsOn) head = 'Todo tranquilo en casa';
      const main = m.f.openings ? 'open' : m.f.lights ? 'lights' : m.indoor.length ? 'temp' : null;

      // Cada frase es una lista de trozos: texto o enlace (abre un panel o un ambiente).
      const L = (txt, action, v) => ({ txt, action, v });
      const list = (items, max = 3) => { // "a, b y c" con enlaces
        const out = [], shown = items.slice(0, max);
        shown.forEach((it, i) => { if (i) out.push(i === shown.length - 1 && items.length <= max ? ' y ' : ', '); out.push(it); });
        if (items.length > max) out.push(` y ${items.length - max} más`);
        return out;
      };
      const roomLinks = (rs) => list(rs.map((r) => L(r.name, 'room', r.id)));
      if (m.people.length) {
        const home = m.people.filter((p) => p.state === 'home').map((p) => ((this._names && this._names[p.entity_id]) || p.attributes.friendly_name || '').split(' ')[0]);
        bits.push([home.length ? `${joinY(home)} ${home.length > 1 ? 'están' : 'está'} en casa.` : 'No hay nadie en casa.']);
      }
      if (m.openNames.length) bits.push(['Sin cerrar: ', ...list(m.openNames.map((n) => L(n, 'panel', 'open')), 4), '.']);
      const lr = m.rooms.filter((r) => r.lightsOn.length);
      if (m.lightsOn) bits.push(['Hay ', L(m.lightsOn === 1 ? '1 luz encendida' : `${m.lightsOn} luces encendidas`, 'panel', 'lights'), ' en ', ...roomLinks(lr), '.']);
      else if (m.f.lights) bits.push(['Todas las luces están ', L('apagadas', 'panel', 'lights'), '.']);
      if (m.indoor.length > 1) {
        const srt = m.indoor.slice().sort((x, y) => x.temp - y.temp), lo = srt[0], hi = srt[srt.length - 1];
        if (hi.temp - lo.temp >= 0.5) bits.push(['Adentro va de ', L(`${fmt(lo.temp)}° en ${lo.name}`, 'panel', 'temp'), ' a ', L(`${fmt(hi.temp)}° en ${hi.name}`, 'panel', 'temp'), '.']);
        else bits.push(['Adentro hay ', L(`${fmt(avg(srt.map((r) => r.temp)))}° parejos`, 'panel', 'temp'), ' en todos los ambientes.']);
      } else if (m.indoor.length === 1) bits.push(['Adentro hace ', L(`${fmt(m.indoor[0].temp)}° en ${m.indoor[0].name}`, 'panel', 'temp'), '.']);
      const cr = m.rooms.filter((r) => r.climOn.length);
      if (cr.length) bits.push(['Climatización funcionando en ', ...roomLinks(cr), '.']);
      const mr = m.rooms.filter((r) => r.mediaOn.length);
      if (mr.length) bits.push(['Sonando en ', ...roomLinks(mr), '.']);
      if (m.weather && m.weather.attributes.temperature != null) {
        const w = WX[m.weather.state];
        bits.push([`Afuera hace ${fmt(m.weather.attributes.temperature, 0)}°${w ? ` y está ${w[2]}` : ''}.`]);
      }
      const segs = bits.flatMap((b, i) => (i ? [' ', ...b] : b));
      const text = segs.map((s) => (typeof s === 'string' ? s : s.txt)).join('');
      const html = segs.map((s) => (typeof s === 'string' ? esc(s)
        : `<button class="ilink" data-action="${s.action}" ${s.action === 'room' ? `data-id="${esc(s.v)}"` : `data-v="${esc(s.v)}"`}>${esc(s.txt)}</button>`)).join('');
      return { level, head, text, html, panel: level === 'attention' || level === 'armed' || level === 'alert' ? 'open' : m.f.lights ? 'lights' : main };
    }

    _suggestions(m) {
      const c = this._config, S = this._hass.states, out = [];
      if (c.suggestions === false || (m.f && !m.f.suggestions)) return out;
      const nobody = m.people.length > 0 && m.people.every((p) => p.state !== 'home');
      if (nobody && m.lightsOn) out.push({ key: 'away-lights', icon: 'bulb', title: 'No hay nadie en casa', text: `Quedaron ${m.lightsOn} ${m.lightsOn > 1 ? 'luces encendidas' : 'luz encendida'}.`, btn: 'Apagar todo', act: 'alloff' });
      if (nobody && m.alarm && m.alarm.state === 'disarmed') out.push({ key: 'away-alarm', icon: 'shield', title: 'La casa está sola', text: 'La alarma está desactivada.', btn: 'Activar alarma', act: 'arm' });
      for (const r of m.rooms) {
        if (r.lightsOn.length && r.motion.length && !r.motionOn) {
          const last = r.motion.map((id) => S[id].last_changed).sort().pop();
          if (minsSince(last) >= c.idle_minutes) out.push({ key: `idle-${r.id}-${last}`, icon: 'motion', title: `${r.name}: luces sin uso`, text: `No se detecta movimiento desde ${ago(last)}.`, btn: 'Apagar', act: 'roomoff', id: r.id });
        }
        if (r.climOn.length && r.openNow.length) out.push({ key: `clim-${r.id}`, icon: 'window', title: `Abertura abierta en ${r.name}`, text: 'El clima está funcionando con una puerta o ventana abierta.', btn: 'Apagar clima', act: 'climoff', id: r.id });
      }
      return out.filter((s) => !this._dismissed.has(s.key)).slice(0, 3);
    }

    /* ---------- render ---------- */
    _update() {
      if (!this._hass || !this._root) return;
      const m = this._m = this._model();
      if (this.hasAttribute('headless')) {
        this._sugs = this._suggestions(m);
        if (this._room || this._panel) { if (this._drag) this._sheetDirty = true; else this._renderSheet(); }
        this._actLive();
        if (this._act) this._renderAct();
        if (this._mus) this._muLive();
        this.dispatchEvent(new CustomEvent('matterai-model', { detail: m }));
        return;
      }
      const ins = this._insight(m);
      const u = this._hass.user, first = u && u.name ? u.name.split(' ')[0] : '';
      const hr = new Date().getHours();
      const greet = hr >= 5 && hr < 12 ? 'Buen día' : hr >= 12 && hr < 20 ? 'Buenas tardes' : 'Buenas noches';
      this._set('hello', esc(first ? `${greet}, ${first}` : greet));
      this._set('headline', esc(ins.head));
      // El título y la esfera también se tocan: abren lo más importante en ese momento
      [this._els.headline, this._els.orb].forEach((el) => { if (ins.panel) { el.dataset.action = 'panel'; el.dataset.v = ins.panel; } else delete el.dataset.action; });
      this._els.orb.dataset.level = ins.level;
      this._set('orbcore', m.tempIn != null ? `<div><b>${fmt(m.tempIn)}°</b><small>interior</small></div>` : ic(ins.level === 'calm' ? 'sparkle' : 'shield'));
      this._type(ins.text, ins.html);
      this._set('weather', this._hWeather(m));
      const cb = this._els.clockbtn;
      if (cb) { if (m.f.agenda) cb.dataset.action = 'panel'; else delete cb.dataset.action; cb.classList.toggle('static', !m.f.agenda); }
      this._set('stats', this._hStats(m));
      const tm = this._els.topx && this._els.topx.querySelector && this._els.topx.querySelector('#topmus');
      if (tm) tm.hidden = !m.f.music;
      const tv = this._els.topx && this._els.topx.querySelector && this._els.topx.querySelector('#topmic');
      if (tv) tv.hidden = !this._voiceAvailable();
      if (!this._hfBoot && this._hfSupported() && this._hfEnabled()) { this._hfBoot = true; setTimeout(() => this._hfStart(), 1200); }
      this._sugs = this._suggestions(m);
      this._set('suggest', this._hSuggest(this._sugs));
      this._set('security', this._hSecurity(m));
      this._set('people', this._hPeople(m));
      this._set('modes', this._hModes(m));
      this._set('roomsmeta', m.rooms.length ? `${m.rooms.length} ambientes · ${m.rooms.filter((r) => r.lightsOn.length).length} activos` : '');
      this._set('rooms', this._hRooms(m));
      if (this._fp() && this._els.planfx) {
        if (!this._fpDrag) this._set('planfx', this._hPlan(m));
        this._set('planyaml', this._fp().edit ? this._hPlanYaml(m) : '');
      }
      this._set('cams', this._hCams(m));
      if (this._els.ctabs) {
        const on = this._config.security_tab !== false && (m.f.security || m.f.cameras);
        const a = m.alarm && m.alarm.state;
        if (a === 'triggered' && this._lastAlarm !== 'triggered') this._ctab = 'seg'; // si se dispara, mostrar seguridad
        this._lastAlarm = a;
        if (!this._ctab) { try { this._ctab = localStorage.getItem('matterai.tab') || 'casa'; } catch (_) { this._ctab = 'casa'; } }
        this._set('ctabs', on ? this._hCTabs(m) : '');
        this._els.colc.dataset.tab = on ? this._ctab : 'all';
      }
      this._mountCamCard();
      this._set('footer', this._hFooter());
      if (this._room || this._panel) { if (this._drag) this._sheetDirty = true; else this._renderSheet(); }
      this._actLive();
      if (this._act) this._renderAct();
      if (this._mus) this._muLive();
    }

    /** Escribe el resumen letra por letra y al terminar lo deja con sus partes tocables (html). */
    _type(text, html) {
      const el = this._els.insight;
      if (this._typed === text) {
        if (html && this._typedHtml !== html && !this._typing) { this._typedHtml = html; el.innerHTML = html; }
        return;
      }
      const first = this._typed == null;
      this._typed = text; this._typedHtml = html;
      clearInterval(this._tw);
      const done = () => { this._typing = false; el.classList.remove('typing'); if (html) el.innerHTML = html; else el.textContent = text; };
      if (!first && document.hidden) { done(); return; }
      let i = 0;
      this._typing = true;
      el.classList.add('typing');
      this._tw = setInterval(() => {
        i += 2;
        el.textContent = text.slice(0, i);
        if (i >= text.length) { clearInterval(this._tw); done(); }
      }, 16);
    }

    _hWeather(m) {
      const w = m.weather; if (!w || !m.f.weather) return '';
      const x = WX[w.state] || ['cloud', w.state];
      return `<button class="wx" data-action="panel" data-v="weather" title="Ver el pronóstico">${ic(x[0])}<b>${fmt(w.attributes.temperature, 0)}°</b><span>${esc(x[1])}</span></button>`;
    }

    /** Cuadritos del resumen: cada uno se toca y abre su panel con el detalle. */
    _hStats(m) {
      const s = [];
      const tile = (panel, cls, icon, big, small, extra) => `<button class="stat ${cls}" data-action="panel" data-v="${panel}">
        <span class="go">${ic('back')}</span>${ic(icon)}<b>${big}</b><small>${esc(small)}</small>${extra ? `<em>${esc(extra)}</em>` : ''}</button>`;
      const lr = m.rooms.filter((r) => r.lightsOn.length).length;
      if (m.f.lights) s.push(tile('lights', m.lightsOn ? 'hot' : '', 'bulb', m.lightsOn, m.lightsOn === 1 ? 'luz encendida' : 'luces encendidas',
        m.lightsOn ? `en ${lr} ${lr === 1 ? 'ambiente' : 'ambientes'}` : 'tocá para encender'));
      if (m.tempIn != null) {
        const t = m.indoor.map((r) => r.temp), mn = Math.min(...t), mx = Math.max(...t);
        s.push(tile('temp', '', 'thermo', `${fmt(m.tempIn)}°`, 'temp. interior', t.length > 1 && mx - mn >= 0.5 ? `de ${fmt(mn)}° a ${fmt(mx)}°` : m.indoor[0].name));
      }
      if (m.humIn != null) {
        const hs = m.rooms.filter((r) => r.icon !== 'tree' && r.hum != null).map((r) => r.hum), mn = Math.min(...hs), mx = Math.max(...hs);
        s.push(tile('hum', '', 'drop', `${fmt(m.humIn, 0)}%`, 'humedad', hs.length > 1 && mx - mn >= 2 ? `de ${fmt(mn, 0)}% a ${fmt(mx, 0)}%` : (m.humIn > 65 ? 'alta' : m.humIn < 35 ? 'baja' : 'ideal')));
      }
      if (m.power && m.f.energy) s.push(`<div class="stat">${ic('bolt')}<b>${fmt(m.power.state, 1)}</b><small>${esc(m.power.attributes.unit_of_measurement || '')} consumo</small></div>`);
      const n = m.openNames.length;
      if (m.f.openings) s.push(n ? tile('open', 'warn', 'door', n, n > 1 ? 'abiertas' : 'abierta', m.openNames[0] + (n > 1 ? ` y ${n - 1} más` : ''))
        : tile('open', 'ok', 'shieldOk', 'OK', 'todo cerrado', m.openAll.length ? `${m.openAll.length} aberturas controladas` : ''));
      return s.slice(0, 4).join('');
    }

    /** Medidor chico: temperatura (escala 10–32°) o humedad (20–90%). El de la pestaña activa va destacado. */
    _meter(kind, v, main) {
      if (v == null) return '';
      const [a, b] = kind === 't' ? [10, 32] : [20, 90];
      const pos = Math.max(0, Math.min(100, (v - a) / (b - a) * 100));
      return `<div class="mtr ${kind} ${main ? 'main' : ''}">${ic(kind === 't' ? 'thermo' : 'drop')}<b>${kind === 't' ? `${fmt(v)}°` : `${fmt(v, 0)}%`}</b>
        <div class="tbar ${kind === 'h' ? 'h' : ''}"><i style="left:${pos.toFixed(1)}%"></i></div></div>`;
    }

    /* ---------- Paneles del resumen (luces, temperatura, humedad, aberturas) ---------- */
    _openPanel(kind) {
      this._panel = kind; this._panelOpt = null;
      this._room = null;
      this._els.sheet.innerHTML = '<div id="sheetdyn"></div><div id="sheetcam"></div>'; this._els.sheetdyn2 = null;
      this._els.sheetdyn = this._els.sheet.querySelector('#sheetdyn');
      this._els.sheetcam = this._els.sheet.querySelector('#sheetcam');
      this._cache.sheetdyn = null;
      this._roomCamEl = null; this._roomCamKey = null; this._roomAct = null;
      if (kind === 'weather') this._loadWeather();
      if (kind === 'agenda') { this._closeAgenda(); this._loadAgenda(); }
      this._renderSheet();
      this._els.sheet.scrollTop = 0;
      this._els.sheetwrap.classList.add('open');
      this._haptic('light');
    }

    _panelHead(icon, title, sub, on, color) {
      return `<div class="grab"></div><div class="sh-head" ${color ? `style="--lc:${color}"` : ''}><div class="ri big ${on ? 'on' : ''}">${ic(icon)}</div>
        <div class="sh-t"><h2>${esc(title)}</h2><div class="sh-sub"><span>${sub}</span></div></div>
        <button class="ib" data-action="close" aria-label="Cerrar">${ic('x')}</button></div>`;
    }

    _hPanel(kind) {
      const m = this._m, S = this._hass.states;
      if (kind === 'lights') {
        const opt = this._panelOpt || (m.lightsOn ? 'on' : 'all');
        const seen = new Set();
        const groups = m.rooms.map((r) => ({ r, ids: r.lights.filter((id) => !seen.has(id) && seen.add(id)) }))
          .map((g) => ({ r: g.r, ids: opt === 'on' ? g.ids.filter((id) => S[id].state === 'on') : g.ids })).filter((g) => g.ids.length);
        const nRooms = m.rooms.filter((r) => r.lightsOn.length).length;
        let h = this._panelHead('bulb', 'Luces', m.lightsOn ? `${m.lightsOn} encendida${m.lightsOn > 1 ? 's' : ''} en ${nRooms} ambiente${nRooms > 1 ? 's' : ''}` : 'Todas apagadas', m.lightsOn > 0, '255,184,108');
        h += `<div class="ptabs"><button class="${opt === 'on' ? 'on' : ''}" data-action="popt" data-v="on">Encendidas · ${m.lightsOn}</button><button class="${opt === 'all' ? 'on' : ''}" data-action="popt" data-v="all">Todas · ${seen.size}</button></div>`;
        if (!groups.length) h += `<div class="pempty">${ic('moon')}<b>Todas las luces están apagadas</b><span>Tocá "Todas" para encender alguna.</span></div>`;
        groups.forEach((g) => {
          const anyOn = g.r.lightsOn.length > 0;
          h += `<div class="blk"><div class="blk-h"><h4 class="lk" data-action="room" data-id="${esc(g.r.id)}">${ic(g.r.icon)}${esc(g.r.name)}</h4>
            <button class="tbtn" data-action="roomall" data-id="${esc(g.r.id)}" data-on="${anyOn ? 0 : 1}">${anyOn ? 'Apagar' : 'Encender'}</button></div>
            <div class="pills">${g.ids.map((id) => this._pill(id, g.r)).join('')}</div></div>`;
        });
        if (m.lightsOn) h += `<button class="pbig" data-action="alloff">${ic('power')}Apagar ${m.lightsOn === 1 ? 'la luz encendida' : `las ${m.lightsOn} luces encendidas`}</button>`;
        return h + '<p class="hint">Tocá para prender o apagar · Deslizá para el brillo · Mantené apretado para más</p>';
      }

      if (kind === 'temp' || kind === 'hum') {
        const hum = (this._panelOpt || kind) === 'hum';
        const val = (r) => (hum ? r.hum : r.temp);
        const rows = m.rooms.filter((r) => val(r) != null || r.climates.length);
        const inside = rows.filter((r) => r.icon !== 'tree' && val(r) != null);
        const vs = inside.map(val), mn = vs.length ? Math.min(...vs) : null, mx = vs.length ? Math.max(...vs) : null;
        const w = m.weather && m.weather.attributes;
        const out = w ? (hum ? w.humidity : w.temperature) : null;
        const sub = hum ? `Promedio interior ${fmt(m.humIn, 0)}%` : `Promedio interior ${fmt(m.tempIn)}°`;
        let h = this._panelHead(hum ? 'drop' : 'thermo', hum ? 'Humedad' : 'Temperatura', esc(sub), true, hum ? '90,200,255' : '255,160,90');
        h += `<div class="ptabs"><button class="${!hum ? 'on' : ''}" data-action="popt" data-v="temp">Temperatura</button><button class="${hum ? 'on' : ''}" data-action="popt" data-v="hum">Humedad</button></div>`;
        h += `<div class="tsum">
          <div><small>Adentro</small><b>${hum ? `${fmt(m.humIn, 0)}%` : `${fmt(m.tempIn)}°`}</b></div>
          ${out != null ? `<div><small>Afuera</small><b>${hum ? `${fmt(out, 0)}%` : `${fmt(out, 0)}°`}</b></div>` : ''}
          ${mn != null && inside.length > 1 ? `<div><small>Diferencia</small><b>${hum ? `${fmt(mx - mn, 0)}%` : `${fmt(mx - mn)}°`}</b></div>` : ''}</div>`;
        const sorted = rows.slice().sort((x, y) => (val(x) == null) - (val(y) == null) || (val(y) || 0) - (val(x) || 0));
        const scale = hum ? [20, 90] : [10, 32];
        const comfort = (v) => (hum ? (v > 65 ? ['Húmedo', 'warm'] : v < 35 ? ['Seco', 'cool'] : ['Ideal', 'ok']) : (v >= 26 ? ['Caluroso', 'warm'] : v < 18 ? ['Fresco', 'cool'] : ['Confortable', 'ok']));
        sorted.forEach((r) => {
          const v = val(r), other = hum ? r.temp : r.hum;
          const cl = r.climates[0] && S[r.climates[0]];
          const clOn = cl && cl.state !== 'off';
          const pos = v != null ? Math.max(0, Math.min(100, (v - scale[0]) / (scale[1] - scale[0]) * 100)) : null;
          const badges = [];
          if (v != null && inside.length > 1 && r.icon !== 'tree') {
            if (v === mx) badges.push(hum ? 'Más húmedo' : 'Más cálido');
            if (v === mn) badges.push(hum ? 'Más seco' : 'Más fresco');
          }
          if (r.icon === 'tree') badges.push('Exterior');
          const cf = v != null && r.icon !== 'tree' ? comfort(v) : null;
          const subs = [];
          if (other != null) subs.push(hum ? `${fmt(other)}°` : `${fmt(other, 0)}% humedad`);
          if (cl) subs.push(clOn ? `Aire en ${(HVAC[cl.state] || cl.state).toLowerCase()}${cl.attributes.temperature != null ? ` a ${fmt(cl.attributes.temperature)}°` : ''}` : 'Aire apagado');
          h += `<div class="trow" data-action="room" data-id="${esc(r.id)}">
            <div class="ri">${ic(r.icon)}</div>
            <div class="tt"><b>${esc(r.name)}${badges.map((b) => `<i class="tb">${esc(b)}</i>`).join('')}</b>
              <span>${cl ? esc(subs[subs.length - 1]) : '&nbsp;'}</span>
              <div class="mtrs">${this._meter('t', r.temp, !hum)}${this._meter('h', r.hum, hum)}</div></div>
            <div class="tv">${v != null ? `<b>${hum ? `${fmt(v, 0)}%` : `${fmt(v)}°`}</b>` : '<b>—</b>'}${cf ? `<small class="cf ${cf[1]}">${cf[0]}</small>` : ''}</div>
            ${cl ? `<button class="ib sm ${clOn ? 'on' : ''}" data-action="clpower" data-eid="${cl.entity_id}" aria-label="Encender o apagar el aire">${ic('power')}</button>` : ''}</div>`;
        });
        return h + '<p class="hint">Tocá un ambiente para ver todo lo que tiene</p>';
      }

      if (kind === 'open') {
        const isOpen = (id) => { const s = S[id].state, d = dom(id); return d === 'lock' ? s !== 'locked' : d === 'cover' ? s === 'open' || s === 'opening' : s === 'on'; };
        const items = m.openAll.map((id) => ({ id, open: isOpen(id), t: S[id].last_changed }));
        const op = items.filter((x) => x.open).sort((a, b) => (b.t > a.t ? 1 : -1)), cl = items.filter((x) => !x.open);
        let h = this._panelHead(op.length ? 'door' : 'shieldOk', 'Aberturas', op.length ? `${op.length} abierta${op.length > 1 ? 's' : ''} · ${cl.length} cerrada${cl.length === 1 ? '' : 's'}` : `Todo cerrado · ${cl.length} controladas`, op.length > 0, op.length ? '255,150,90' : '62,230,196');
        const row = (x) => {
          const st = S[x.id], d = dom(x.id), dc = st.attributes.device_class;
          const masc = d === 'cover' && ['garage', 'gate'].includes(dc);
          const icon = d === 'lock' ? (x.open ? 'unlock' : 'lock') : d === 'cover' ? 'garage' : dc === 'window' ? 'window' : 'door';
          const word = d === 'lock' ? (x.open ? 'Destrabada' : 'Trabada') : x.open ? (masc ? 'Abierto' : 'Abierta') : (masc ? 'Cerrado' : 'Cerrada');
          const btn = d === 'lock' ? `<button class="btn ghost" data-action="access" data-eid="${x.id}">${x.open ? 'Trabar' : 'Destrabar'}</button>`
            : d === 'cover' ? `<button class="btn ghost" data-action="access" data-eid="${x.id}">${x.open ? 'Cerrar' : 'Abrir'}</button>` : '';
          return `<div class="acc-i ${x.open ? 'open' : ''}" data-eid="${x.id}"><div class="ai">${ic(icon)}</div>
            <div class="at"><b>${esc(this._label(x.id))}</b><span>${word} ${x.t ? `desde ${ago(x.t)}` : ''}</span></div>${btn}</div>`;
        };
        if (!op.length) h += `<div class="pempty ok">${ic('shieldOk')}<b>Todo cerrado</b><span>Puertas, ventanas y portones en orden.</span></div>`;
        else h += `<div class="blk"><div class="blk-h"><h4>${ic('alert')}Abiertas ahora</h4></div><div class="acc" style="margin:0;padding:0;border:0">${op.map(row).join('')}</div></div>`;
        if (cl.length) h += `<div class="blk"><div class="blk-h"><h4>${ic('check')}Cerradas</h4></div><div class="acc" style="margin:0;padding:0;border:0">${cl.map(row).join('')}</div></div>`;
        return h + '<p class="hint">Los portones y cerraduras piden un segundo toque · Mantené apretado para ver el historial</p>';
      }
      if (kind === 'weather') return this._hWeatherPanel();
      if (kind === 'agenda') return this._hAgenda();
      return '';
    }

    /* ---------- Pronóstico (al tocar el clima) ---------- */
    async _forecast(eid, type) {
      const res = await this._hass.callWS({ type: 'call_service', domain: 'weather', service: 'get_forecasts', service_data: { type }, target: { entity_id: eid }, return_response: true });
      const r = res && (res.response || res);
      return (r && r[eid] && r[eid].forecast) || [];
    }
    _loadWeather() {
      const w = this._m.weather; if (!w || typeof this._hass.callWS !== 'function') return;
      if (this._wx && this._wx.eid === w.entity_id && Date.now() - this._wx.t < 10 * 60000) return;
      const f = w.attributes.supported_features || 0;
      const st = this._wx = { eid: w.entity_id, loading: true, t: Date.now() };
      const safe = (p) => p.catch(() => null);
      Promise.all([(!f || f & 1) ? safe(this._forecast(w.entity_id, 'daily')) : null, f & 2 ? safe(this._forecast(w.entity_id, 'hourly')) : null])
        .then(([d, hr]) => { st.daily = d || []; st.hourly = hr || []; })
        .finally(() => { st.loading = false; if (this._wx === st && this._panel === 'weather') { this._cache.sheetdyn = null; this._renderSheet(); } });
    }
    _hWeatherPanel() {
      const w = this._m.weather;
      if (!w) return this._panelHead('cloud', 'Pronóstico', 'No hay un servicio del clima configurado', false) + '<div class="pempty">Agregá una integración del clima en Home Assistant (por ejemplo Met.no).</div>';
      const a = w.attributes, x = WX[w.state] || ['cloud', w.state], st = this._wx || {};
      const daily = st.daily || [], hourly = st.hourly || [];
      const today = daily[0];
      const dir = (b) => (b == null ? '' : typeof b === 'string' ? b : ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'][Math.round(((b % 360) + 360) % 360 / 45) % 8]);
      let h = this._panelHead(x[0], 'Pronóstico', `${esc(x[1])} · ${fmt(a.temperature, 0)}° ahora`, true, '124,156,255');
      h += `<div class="wnow"><div class="wbig">${ic(x[0])}<b>${fmt(a.temperature, 0)}°</b><span>${esc(x[1])}${today && today.temperature != null ? `<small>Máx ${fmt(today.temperature, 0)}° · Mín ${fmt(today.templow, 0)}°</small>` : ''}</span></div>
        <div class="wchips">
          ${a.apparent_temperature != null ? `<span>${ic('thermo')}Sensación <b>${fmt(a.apparent_temperature, 0)}°</b></span>` : ''}
          ${a.humidity != null ? `<span class="mh">${ic('drop')}Humedad <b>${fmt(a.humidity, 0)}%</b></span>` : ''}
          ${a.wind_speed != null ? `<span>${ic('wind')}Viento <b>${fmt(a.wind_speed, 0)} ${esc(a.wind_speed_unit || 'km/h')}</b> ${esc(dir(a.wind_bearing))}</span>` : ''}
          ${a.uv_index != null ? `<span>${ic('sun')}UV <b>${fmt(a.uv_index, 0)}</b></span>` : ''}
          ${a.pressure != null ? `<span>${ic('gauge')}Presión <b>${fmt(a.pressure, 0)} ${esc(a.pressure_unit || 'hPa')}</b></span>` : ''}
        </div></div>`;
      // de dónde sale el pronóstico: la ubicación de la casa en Home Assistant y el servicio del clima
      const hc = (this._hass && this._hass.config) || {}, lat = Number(hc.latitude), lon = Number(hc.longitude);
      const where = [hc.location_name, Number.isFinite(lat) && Number.isFinite(lon) && (lat || lon) ? `${lat.toFixed(2)}, ${lon.toFixed(2)}` : ''].filter(Boolean).join(' · ');
      h += `<div class="wloc">${ic('home')}<span>Pronóstico para <b>${esc(where || 'la ubicación de la casa')}</b>${a.attribution ? `<small>${esc(a.attribution)} · ${esc(a.friendly_name || w.entity_id)}</small>` : `<small>${esc(a.friendly_name || w.entity_id)}</small>`}</span></div>`;
      if (st.loading && !daily.length) return h + '<div class="pempty">Buscando el pronóstico…</div>';
      if (hourly.length) {
        h += `<div class="blk"><div class="blk-h"><h4>${ic('history')}Próximas horas</h4></div><div class="hrs">${hourly.slice(0, 24).map((f) => {
          const fx = WX[f.condition] || ['cloud', f.condition];
          return `<div class="hr"><small>${hhmm(f.datetime)}</small>${ic(fx[0])}<b>${fmt(f.temperature, 0)}°</b>${f.precipitation_probability ? `<em>${ic('drop')}${fmt(f.precipitation_probability, 0)}%</em>` : '<em>&nbsp;</em>'}</div>`;
        }).join('')}</div></div>`;
      }
      if (daily.length) {
        const lows = daily.map((f) => (f.templow != null ? f.templow : f.temperature)), highs = daily.map((f) => f.temperature);
        const mn = Math.min(...lows), mx = Math.max(...highs), span = mx - mn || 1;
        const dn = (dt, i) => { const d = new Date(dt); const t0 = new Date(); t0.setHours(0, 0, 0, 0); const diff = Math.round((new Date(d).setHours(0, 0, 0, 0) - t0) / 864e5); return diff === 0 || (i === 0 && diff < 0) ? 'Hoy' : diff === 1 ? 'Mañana' : cap(d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric' }).replace('.', '')); };
        h += `<div class="blk"><div class="blk-h"><h4>${ic('cal')}Próximos días</h4></div>${daily.slice(0, 8).map((f, i) => {
          const fx = WX[f.condition] || ['cloud', f.condition], lo = lows[i], hi = highs[i];
          return `<div class="dy" title="${esc(fx[1])}"><b>${esc(dn(f.datetime, i))}</b>${ic(fx[0])}<em>${f.precipitation_probability ? `${fmt(f.precipitation_probability, 0)}%` : ''}</em>
            <span class="lo">${fmt(lo, 0)}°</span><div class="dbar"><i style="left:${((lo - mn) / span * 100).toFixed(1)}%;width:${Math.max(4, (hi - lo) / span * 100).toFixed(1)}%"></i></div><span class="hi">${fmt(hi, 0)}°</span></div>`;
        }).join('')}</div>`;
      } else if (!st.loading) h += '<div class="pempty">Este servicio del clima no da pronóstico.</div>';
      return h;
    }

    /* ---------- Agenda (al tocar la hora): calendario, recordatorios y alarmas ---------- */
    _loadAgenda() {
      const h = this._hass, ag = this._ag = this._ag || {};
      ag.loading = true;
      const cals = Object.keys(h.states).filter((id) => id.startsWith('calendar.') && h.states[id].state !== 'unavailable');
      ag.cals = cals;
      const now = new Date();
      if (!ag.month) ag.month = { y: now.getFullYear(), m: now.getMonth() };
      if (!ag.sel) ag.sel = ymd(now);
      const grid = agGrid(ag.month.y, ag.month.m);
      const start = grid[0], end = new Date(grid[41].getFullYear(), grid[41].getMonth(), grid[41].getDate() + 1);
      const req = ag.req = {};
      const evP = cals.length && typeof h.callWS === 'function'
        ? h.callWS({ type: 'call_service', domain: 'calendar', service: 'get_events', service_data: { start_date_time: start.toISOString(), end_date_time: end.toISOString() }, target: { entity_id: cals }, return_response: true })
          .then((res) => {
            if (ag.req !== req) return; // ya se pidió otro mes
            const r = (res && (res.response || res)) || {};
            ag.events = Object.entries(r).flatMap(([cal, v]) => ((v && v.events) || []).map((e) => Object.assign({ cal }, e)));
          }, (e) => { if (ag.req === req) { ag.events = []; ag.evErr = e && e.message; } })
        : Promise.resolve().then(() => { ag.events = []; });
      evP.finally(() => { if (ag.req === req) { ag.loading = false; this._agRender(); } });
      // Recordatorios: integración MatterAI Escenas (avisa al celular)
      if (!ag.unsub && h.connection && typeof h.connection.subscribeMessage === 'function') {
        ag.unsub = h.connection.subscribeMessage((msg) => {
          ag.hasEsc = true;
          ag.rems = (msg.rules || []).filter((r) => r.kind === 'reminder');
          this._agRender();
        }, { type: 'matterai_escenas/subscribe' }).catch(() => { ag.hasEsc = false; ag.unsub = null; this._agRender(); });
      } else if (!h.connection) ag.hasEsc = false;
    }
    _closeAgenda() {
      const ag = this._ag;
      if (ag && ag.unsub) { Promise.resolve(ag.unsub).then((u) => typeof u === 'function' && u()).catch(() => {}); }
      this._ag = null;
    }
    _agRender() { if (this._panel === 'agenda' && !(this._ag && this._ag.form)) { this._cache.sheetdyn = null; this._renderSheet(); } }
    _mobiles() { return Object.keys((this._hass.services || {}).notify || {}).filter((x) => x.startsWith('mobile_app_')); }

    _agForm(type) {
      const pad = (n) => String(n).padStart(2, '0');
      const today = ymd(new Date()), sel = this._ag.sel || today;
      const t = sel === today ? new Date(Date.now() + 60 * 60000) : new Date(`${sel}T09:00:00`);
      const iso = sel > today ? sel : `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
      const writable = (this._ag.cals || []).filter((id) => ((this._hass.states[id].attributes.supported_features || 0) & 1));
      return { type, text: '', date: iso, time: `${pad(t.getHours())}:00`, end: `${pad((t.getHours() + 1) % 24)}:00`, allDay: false,
        repeat: 'none', days: [], recipients: this._mobiles(), critical: type === 'alarm', cal: writable[0] || null, err: '' };
    }

    _hAgenda() {
      const ag = this._ag || {}, S = this._hass.states, now = new Date();
      const longDate = cap(now.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }));
      let h = `<div class="grab"></div><div class="sh-head"><div class="ri big on" style="--lc:124,156,255">${ic('cal')}</div>
        <div class="sh-t"><h2>Agenda</h2><div class="sh-sub"><span>${esc(longDate)}</span></div></div>
        <button class="ib" data-action="close" aria-label="Cerrar">${ic('x')}</button></div>`;
      h += `<div class="agclock"><b>${hhmm(now)}</b></div>`;
      if (ag.form) return h + this._hAgForm(ag.form);
      h += `<div class="agbtns">
        <button data-action="agnew" data-v="rem">${ic('bell')}<span>Recordatorio</span></button>
        <button data-action="agnew" data-v="alarm">${ic('alarmclock')}<span>Alarma</span></button>
        <button data-action="agnew" data-v="event" ${(ag.cals || []).length ? '' : 'disabled'}>${ic('cal')}<span>Evento</span></button></div>`;
      h += this._hAgCalendar(ag);
      // Todos los recordatorios (para pausar o borrar)
      if (ag.hasEsc === false) h += '<p class="hint2">Los recordatorios con aviso al celular necesitan la integración MatterAI Escenas.</p>';
      if ((ag.rems || []).length) {
        h += `<div class="blk"><div class="blk-h"><h4>${ic('bell')}Tus recordatorios y alarmas</h4></div>${ag.rems.map((r) => {
          const u = r.ui || {}, on = r.enabled !== false && !u.done;
          return `<div class="agi rem ${u.critical ? 'alarm' : ''} ${on ? '' : 'off'}"><i class="agc ic2">${ic(u.critical ? 'alarmclock' : 'bell')}</i>
            <div class="agb"><b>${esc(u.text || r.name)}</b><span>${esc(u.done ? 'Hecho' : r.enabled === false ? 'Pausado' : r.next_at ? `${dayLabel(Date.parse(r.next_at)).toLowerCase()} ${hhmm(Date.parse(r.next_at))}` : 'Ya pasó')} · ${esc(this._remSub(u))}</span></div>
            <button class="ib sm ${on ? 'on' : ''}" data-action="agtoggle" data-id="${esc(r.id)}" aria-label="Activar o pausar">${ic('power')}</button>
            <button class="ib sm" data-action="agdel" data-id="${esc(r.id)}" aria-label="Borrar">${ic('trash')}</button></div>`;
        }).join('')}</div>`;
      }
      return h;
    }

    /** Todo lo de cada día del calendario: eventos (también los de varios días) y cada repetición de los recordatorios. */
    _agByDay(ag, grid) {
      const S = this._hass.states, by = {};
      const add = (k, it) => { (by[k] = by[k] || []).push(it); };
      const first = ymd(grid[0]), last = ymd(grid[41]);
      const colors = ['#7c9cff', '#3ee6c4', '#ffb547', '#ff6a8a', '#b44cff', '#2fd3ff'];
      const calColor = (c) => colors[Math.max(0, (ag.cals || []).indexOf(c)) % colors.length];
      (ag.events || []).forEach((e) => {
        const allDay = !String(e.start).includes('T');
        const st = allDay ? new Date(`${e.start}T00:00:00`) : new Date(e.start);
        const en = allDay ? new Date(`${e.end || e.start}T00:00:00`) : new Date(e.end || e.start);
        const it = { kind: 'ev', allDay, t: st.getTime(), end: allDay ? null : en.getTime(), title: e.summary || '(sin título)', sub: (S[e.cal] && S[e.cal].attributes.friendly_name) || e.cal, color: calColor(e.cal) };
        const d = new Date(st); d.setHours(0, 0, 0, 0);
        for (let n = 0; n < 62; n++) {
          const k = ymd(d);
          if (k > last) break;
          if (n > 0 && (allDay ? d >= en : d > en)) break;
          if (k >= first) add(k, n ? Object.assign({}, it, { cont: true }) : it);
          d.setDate(d.getDate() + 1);
        }
      });
      const WK = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
      (ag.rems || []).forEach((r) => {
        const u = r.ui || {};
        if (r.enabled === false || u.done) return;
        const [hh, mm] = String(u.time || '09:00').split(':').map(Number);
        const base = u.date || first;
        const bd = new Date(`${base}T00:00:00`);
        grid.forEach((d) => {
          const k = ymd(d);
          if (k < base) return;
          const hit = ({ none: k === base, daily: true, weekly: (u.days || []).includes(WK[d.getDay()]),
            monthly: d.getDate() === bd.getDate(), yearly: d.getDate() === bd.getDate() && d.getMonth() === bd.getMonth() })[u.repeat || 'none'];
          if (hit) add(k, { kind: 'rem', r, t: new Date(d.getFullYear(), d.getMonth(), d.getDate(), hh || 0, mm || 0).getTime(), color: u.critical ? '#ff6b6b' : '#ffc04d' });
        });
      });
      Object.values(by).forEach((l) => l.sort((x, y) => ((y.allDay || y.cont) ? 1 : 0) - ((x.allDay || x.cont) ? 1 : 0) || x.t - y.t));
      return by;
    }

    /** Calendario del mes (como el de Windows, con nuestro diseño) y, abajo, lo del día elegido. */
    _hAgCalendar(ag) {
      const now = new Date(), today = ymd(now);
      const { y, m } = ag.month || { y: now.getFullYear(), m: now.getMonth() };
      const grid = agGrid(y, m), by = this._agByDay(ag, grid), sel = ag.sel || today;
      const title = cap(new Date(y, m, 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }));
      const cells = grid.map((d) => {
        const k = ymd(d), items = by[k] || [];
        const dots = [...new Set(items.map((it) => it.color))].slice(0, 3).map((c) => `<i style="background:${c}"></i>`).join('');
        const label = d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
        return `<button class="cd ${d.getMonth() !== m ? 'o' : ''} ${k === today ? 't' : ''} ${k === sel ? 's' : ''} ${d.getDay() === 0 || d.getDay() === 6 ? 'we' : ''}" data-action="agsel" data-v="${k}" aria-label="${esc(label)}">
          <b>${d.getDate()}</b><span class="dots">${dots}</span></button>`;
      }).join('');
      let h = `<div class="cal ${ag.loading ? 'stale' : ''}"><div class="cal-h">
          <button class="ib sm" data-action="agmonth" data-d="-1" aria-label="Mes anterior">${ic('back')}</button>
          <b>${esc(title)}</b>
          <button class="ib sm fwd" data-action="agmonth" data-d="1" aria-label="Mes siguiente">${ic('back')}</button>
          ${sel !== today || y !== now.getFullYear() || m !== now.getMonth() ? '<button class="hchip" data-action="agtoday">Hoy</button>' : ''}</div>
        <div class="cal-w">${['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'].map((x) => `<span>${x}</span>`).join('')}</div>
        <div class="cal-g">${cells}</div></div>`;
      // Lo del día elegido
      const sd = new Date(`${sel}T00:00:00`), items = by[sel] || [];
      const dl = sel === today ? 'Hoy' : dayLabel(sd.getTime());
      const longD = sd.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
      h += `<div class="day-h">${esc(['Hoy', 'Ayer', 'Mañana'].includes(dl) ? `${dl} · ${longD}` : dl)}</div>`;
      if (!items.length) h += `<div class="pempty sm">${ic('cal')}<span>Nada para este día. Usá los botones de arriba para agendar algo.</span></div>`;
      items.forEach((it) => {
        if (it.kind === 'ev') {
          h += `<div class="agi"><div class="agt"><b>${it.allDay || it.cont ? 'Todo el día' : hhmm(it.t)}</b>${it.end && !it.cont ? `<small>${hhmm(it.end)}</small>` : ''}</div>
            <i class="agc" style="background:${it.color}"></i><div class="agb"><b>${esc(it.title)}</b><span>${esc(it.sub)}</span></div></div>`;
        } else {
          const u = it.r.ui || {};
          h += `<div class="agi rem ${u.critical ? 'alarm' : ''}"><div class="agt"><b>${hhmm(it.t)}</b></div><i class="agc ic2">${ic(u.critical ? 'alarmclock' : 'bell')}</i>
            <div class="agb"><b>${esc(u.text || it.r.name)}</b><span>${esc(this._remSub(u))}</span></div></div>`;
        }
      });
      return h;
    }

    _remSub(u) {
      const D = { mon: 'lun', tue: 'mar', wed: 'mié', thu: 'jue', fri: 'vie', sat: 'sáb', sun: 'dom' };
      const rep = ({ none: 'Una vez', daily: 'Todos los días', weekly: `Los ${(u.days || []).map((d) => D[d]).join(', ')}`, monthly: 'Todos los meses', yearly: 'Todos los años' })[u.repeat || 'none'];
      const n = (u.recipients || []).length;
      return [rep, n ? `avisa a ${n} celular${n > 1 ? 'es' : ''}` : 'aviso en la app', u.critical ? 'suena en silencio' : ''].filter(Boolean).join(' · ');
    }

    _hAgForm(f) {
      const S = this._hass.states;
      const chip = (field, v, label, on) => `<button class="opt ${on ? 'on' : ''}" data-action="agset" data-f="${field}" data-v="${esc(v)}">${esc(label)}</button>`;
      const title = f.type === 'event' ? 'Nuevo evento' : f.type === 'alarm' ? 'Nueva alarma' : 'Nuevo recordatorio';
      let h = `<div class="agform"><h3>${ic(f.type === 'event' ? 'cal' : f.type === 'alarm' ? 'alarmclock' : 'bell')}${title}</h3>
        <label class="fl">${f.type === 'event' ? 'Título' : f.type === 'alarm' ? 'Nombre de la alarma' : '¿Qué te recuerdo?'}
          <input class="fin" data-f="text" value="${esc(f.text)}" placeholder="${f.type === 'event' ? 'Cumpleaños de Lucía' : f.type === 'alarm' ? 'Despertador' : 'Sacar la basura'}" autocomplete="off"></label>
        <div class="frow"><label class="fl">Día<input class="fin" type="date" data-f="date" value="${esc(f.date)}"></label>
          ${f.type === 'event' && f.allDay ? '' : `<label class="fl">${f.type === 'event' ? 'Desde' : 'Hora'}<input class="fin" type="time" data-f="time" value="${esc(f.time)}"></label>`}
          ${f.type === 'event' && !f.allDay ? `<label class="fl">Hasta<input class="fin" type="time" data-f="end" value="${esc(f.end)}"></label>` : ''}</div>`;
      if (f.type === 'event') {
        h += `<div class="opts">${chip('allDay', f.allDay ? '0' : '1', 'Todo el día', f.allDay)}</div>`;
        const writable = (this._ag.cals || []).filter((id) => ((S[id].attributes.supported_features || 0) & 1));
        h += writable.length ? `<div class="lbl">Calendario</div><div class="opts">${writable.map((id) => chip('cal', id, S[id].attributes.friendly_name || id, f.cal === id)).join('')}</div>`
          : '<p class="hint2 warn">Ningún calendario permite agregar eventos desde acá (por ejemplo, un "Calendario local" de Home Assistant sí).</p>';
      } else {
        h += `<div class="lbl">Repetir</div><div class="opts">${[['none', 'Una vez'], ['daily', 'Todos los días'], ['weekly', 'Algunos días'], ['monthly', 'Todos los meses'], ['yearly', 'Todos los años']]
          .map(([v, l]) => chip('repeat', v, l, f.repeat === v)).join('')}</div>`;
        if (f.repeat === 'weekly') {
          h += `<div class="opts days">${[['mon', 'L'], ['tue', 'M'], ['wed', 'M'], ['thu', 'J'], ['fri', 'V'], ['sat', 'S'], ['sun', 'D']]
            .map(([v, l]) => `<button class="opt ${f.days.includes(v) ? 'on' : ''}" data-action="agday" data-v="${v}">${l}</button>`).join('')}</div>`;
        }
        const mob = this._mobiles();
        h += `<div class="lbl">Avisar a</div>${mob.length ? `<div class="opts">${mob.map((x) => `<button class="opt ${f.recipients.includes(x) ? 'on' : ''}" data-action="agrcp" data-v="${esc(x)}">${ic('bell')}${esc(cap(x.slice(11).replace(/_/g, ' ')))}</button>`).join('')}</div>`
          : '<p class="hint2">No hay celulares con la app de Home Assistant: el aviso va a quedar en la app.</p>'}`;
        h += `<div class="opts">${chip('critical', f.critical ? '0' : '1', 'Que suene aunque el celular esté en silencio', f.critical)}</div>`;
        if (f.critical) h += '<p class="hint2">Insiste cada 5 minutos hasta que lo marques como hecho.</p>';
      }
      if (f.err) h += `<p class="hint2 warn">${esc(f.err)}</p>`;
      return h + `<div class="agfb"><button class="pbig" data-action="agcancel">Cancelar</button><button class="pbig main" data-action="agsave">${ic('check')}Guardar</button></div></div>`;
    }

    async _agSave() {
      const ag = this._ag, f = ag && ag.form; if (!f) return;
      const h = this._hass;
      const text = String(f.text || '').trim();
      f.err = '';
      if (!text) f.err = f.type === 'event' ? 'Poné un título' : 'Escribí qué te recuerdo';
      else if (!f.date || (!f.allDay && !f.time)) f.err = 'Elegí el día y la hora';
      else if (f.type !== 'event' && f.repeat === 'weekly' && !f.days.length) f.err = 'Elegí los días';
      else if (f.type === 'event' && !f.cal) f.err = 'Elegí el calendario';
      if (f.err) { this._agForceRender(); return; }
      try {
        if (f.type === 'event') {
          const data = { summary: text };
          if (f.allDay) {
            const d = new Date(`${f.date}T00:00:00`); d.setDate(d.getDate() + 1);
            const pad = (n) => String(n).padStart(2, '0');
            Object.assign(data, { start_date: f.date, end_date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` });
          } else Object.assign(data, { start_date_time: `${f.date} ${f.time}:00`, end_date_time: `${f.date} ${(f.end && f.end > f.time ? f.end : f.time)}:00` });
          await h.callWS({ type: 'call_service', domain: 'calendar', service: 'create_event', service_data: data, target: { entity_id: f.cal } });
          this._toast(`${ic('check')} Evento agendado`);
        } else {
          const rule = {
            kind: 'reminder', name: text.slice(0, 80), icon: f.critical ? 'mdi:alarm' : 'mdi:bell-ring-outline', color: f.critical ? '#FF6B6B' : '#F7B84F', enabled: true, mode: 'restart',
            ui: { text, date: f.date, time: f.time, repeat: f.repeat, days: f.repeat === 'weekly' ? f.days : [], recipients: f.recipients, critical: !!f.critical, nag_min: f.critical ? 5 : 0 },
          };
          await h.callWS({ type: 'matterai_escenas/save', rule });
          this._toast(`${ic('check')} ${f.type === 'alarm' ? 'Alarma' : 'Recordatorio'} guardado`);
        }
        ag.form = null;
        this._loadAgenda();
      } catch (e) {
        f.err = e && e.code === 'unknown_command' ? 'Para recordatorios y alarmas hace falta la integración MatterAI Escenas.' : `No se pudo guardar: ${e && e.message ? e.message : e}`;
        this._agForceRender();
      }
    }
    _agForceRender() { this._cache.sheetdyn = null; if (this._panel === 'agenda') this._set('sheetdyn', this._hPanel('agenda')); }

    _hSuggest(list) {
      if (!list.length) return '';
      return `<div class="sug-h">${ic('sparkle')} Sugerencias inteligentes</div>` + list.map((s) => `
        <div class="sug"><div class="si">${ic(s.icon)}</div><div><b>${esc(s.title)}</b><p>${esc(s.text)}</p>
          <button class="btn" data-action="sug" data-key="${esc(s.key)}">${esc(s.btn)}</button></div>
          <button class="sx" data-action="dismiss" data-key="${esc(s.key)}" aria-label="Descartar">${ic('x')}</button></div>`).join('');
    }

    _hSecurity(m) {
      const S = this._hass.states, a = m.alarm;
      if (!m.f.security || (!a && !m.access.length && !m.openBin.length && !m.secEnts.length)) return '';
      let h = '<div class="glass secu" style="--i:2">';
      if (a) {
        m.alarms.forEach((al, k) => {
          const [label, cls] = ALARM[al.state] || [al.state, 'off'];
          const f = al.attributes.supported_features || 0;
          const btns = [];
          if (al.state === 'disarmed') {
            if (!f || f & 1) btns.push(['alarm_arm_home', 'En casa', 'home']);
            if (!f || f & 2) btns.push(['alarm_arm_away', 'Ausente', 'shield']);
            if (f & 4) btns.push(['alarm_arm_night', 'Noche', 'moon']);
          } else btns.push(['alarm_disarm', 'Desactivar', 'unlock', 'danger']);
          const sub = k === 0 ? (m.openNames.length ? `${m.openNames.length} abertura${m.openNames.length > 1 ? 's' : ''} sin cerrar` : 'Puertas y ventanas cerradas') : this._name(al.entity_id);
          h += `<div class="alarm al-${cls}" ${k ? 'style="margin-top:18px;padding-top:16px;border-top:1px solid var(--line)"' : ''}><div class="shield">${ic(al.state === 'disarmed' ? 'shield' : 'shieldOk')}</div>
            <div><small>${k === 0 ? 'Seguridad' : 'Alarma'}</small><b>${esc(label)}</b><span>${esc(sub)}</span></div></div>
            <div class="abtns">${btns.map(([svc, l, i, x]) => `<button class="abtn ${x || ''}" data-action="alarm" data-svc="${svc}" data-eid="${al.entity_id}">${ic(i)}${l}</button>`).join('')}</div>`;
        });
      } else {
        h += `<div class="sec-h" style="margin-top:0"><h3>Accesos</h3></div>`;
      }
      if (m.access.length) {
        h += `<div class="acc" ${a ? '' : 'style="margin-top:0;padding-top:0;border:0"'}>` + m.access.map((id) => {
          const st = S[id], isLock = dom(id) === 'lock';
          const open = isLock ? st.state !== 'locked' : ['open', 'opening'].includes(st.state);
          const stx = isLock ? ({ locked: 'Trabada', unlocked: 'Destrabada', locking: 'Trabando…', unlocking: 'Destrabando…', jammed: 'Trabada con error', open: 'Abierta' }[st.state] || st.state)
            : ({ open: 'Abierto', closed: 'Cerrado', opening: 'Abriendo…', closing: 'Cerrando…' }[st.state] || st.state);
          const act = isLock ? (open ? 'Trabar' : 'Destrabar') : (open ? 'Cerrar' : 'Abrir');
          return `<div class="acc-i ${open ? 'open' : ''}" data-eid="${id}"><div class="ai">${ic(isLock ? (open ? 'unlock' : 'lock') : 'garage')}</div>
            <div class="at"><b>${esc(this._name(id))}</b><span>${esc(stx)} · ${ago(st.last_changed)}</span></div>
            <button class="btn ghost" data-action="access" data-eid="${id}">${act}</button></div>`;
        }).join('') + '</div>';
      }
      // Interruptores de seguridad (simulación de presencia, sirenas…) y zonas de la alarma
      const sw = m.secEnts.filter((id) => ['switch', 'input_boolean'].includes(dom(id)));
      if (sw.length) {
        h += `<div class="acc">${sw.map((id) => {
          const on = S[id].state === 'on';
          return `<div class="acc-i ${on ? 'open' : ''}"><div class="ai">${ic(on ? 'shieldOk' : 'shield')}</div><div class="at"><b>${esc(this._name(id))}</b><span>${on ? 'Activada' : 'Desactivada'}</span></div>
            <button class="btn ghost" data-action="toggle" data-eid="${id}">${on ? 'Desactivar' : 'Activar'}</button></div>`;
        }).join('')}</div>`;
      }
      const zones = m.secEnts.filter((id) => !sw.includes(id));
      if (zones.length) h += `<div class="opn">${zones.map((id) => this._chip(id)).join('')}</div>`;
      else if (m.openBin.length) h += `<div class="opn">${m.openBin.map((id) => `<span class="tag warn">${ic(S[id].attributes.device_class === 'window' ? 'window' : 'door')}${esc(this._name(id))}</span>`).join('')}</div>`;
      return h + '</div>';
    }

    /** Etiqueta de estado para cualquier sensor (puertas, zonas, batería, luz, presencia…) */
    _chip(id, r) {
      const st = this._hass.states[id], a = st.attributes, d = dom(id), dc = a.device_class, n = this._name(id, r);
      if (d === 'binary_sensor') {
        const on = st.state === 'on';
        const L = OPEN_DC.has(dc) ? ['Abierta', 'Cerrada'] : MOTION_DC.has(dc) ? ['Detectado', 'Sin movimiento'] : dc === 'moisture' ? ['Agua', 'Seco'] : dc === 'smoke' ? ['¡Humo!', 'OK'] : ['Activo', 'Normal'];
        const icn = dc === 'window' ? 'window' : OPEN_DC.has(dc) ? 'door' : MOTION_DC.has(dc) ? 'motion' : 'shield';
        const warn = on && (OPEN_DC.has(dc) || ['moisture', 'smoke', 'gas', 'problem', 'safety', 'tamper'].includes(dc));
        return `<span class="tag ${warn ? 'warn' : on ? '' : 'ok'}" data-action="more" data-eid="${id}">${ic(icn)}${esc(n)} · ${esc(on ? L[0] : L[1])}</span>`;
      }
      const v = num(st.state);
      const val = v != null ? `${fmt(v, a.unit_of_measurement === '%' ? 0 : 1)}${a.unit_of_measurement ? (a.unit_of_measurement === '%' || a.unit_of_measurement === '°C' ? '' : ' ') + a.unit_of_measurement : ''}` : cap(String(st.state).replace(/_/g, ' '));
      const icn = dc === 'battery' ? 'bolt' : dc === 'illuminance' ? 'sun' : dc === 'temperature' ? 'thermo' : dc === 'humidity' ? 'drop' : dc === 'power' || dc === 'energy' ? 'bolt' : 'sparkle';
      const low = dc === 'battery' && v != null && v <= 20;
      return `<span class="tag ${low ? 'warn' : ''}" data-action="more" data-eid="${id}">${ic(icn)}${esc(n)} · ${esc(val)}</span>`;
    }

    _hPeople(m) {
      if (!m.people.length || !m.f.people) return '';
      return `<div class="glass people" style="--i:3"><div class="sec-h" style="margin:0"><h3>Quiénes están</h3></div><div class="ppl">${m.people.map((p) => {
        const home = p.state === 'home', n = (this._names && this._names[p.entity_id]) || p.attributes.friendly_name || '', pic = this._url(p.attributes.entity_picture);
        const where = home ? 'En casa' : p.state === 'not_home' ? 'Fuera' : p.state;
        return `<div class="person ${home ? 'home' : ''}" data-eid="${p.entity_id}"><div class="av" ${pic ? `style="background-image:url('${esc(pic)}')"` : ''}>${pic ? '' : esc(n.charAt(0))}</div>
          <div><b>${esc(n.split(' ')[0])}</b><span>${esc(where)}</span></div></div>`;
      }).join('')}</div></div>`;
    }

    _hModes(m) {
      const items = [];
      if (m.f.lights) items.push(`<button class="mode off" data-action="alloff" style="--i:0"><span class="mi">${ic('power')}</span><span><b>Apagar luces</b><small>${m.lightsOn ? `${m.lightsOn} encendidas` : 'Ya están apagadas'}</small></span></button>`);
      m.scenes.forEach((id, i) => {
        const n = this._name(id), [g1, g2] = GRADS[i % GRADS.length];
        const icn = (SCENE_RULES.find(([re]) => re.test(n)) || [0, 'sparkle'])[1];
        items.push(`<button class="mode" data-action="scene" data-eid="${id}" style="--g1:${g1};--g2:${g2};--i:${i + 1}"><span class="mi">${ic(icn)}</span><span><b>${esc(n)}</b><small>${dom(id) === 'script' ? 'Rutina' : 'Escena'}</small></span></button>`);
      });
      if (m.f.activity) {
        items.splice(Math.min(1, items.length), 0, `<button class="mode" data-action="act" style="--g1:#5b6cff;--g2:#2fd3ff;--i:1"><span class="mi">${ic('history')}</span><span><b>Actividad</b><small>Qué pasó y cuándo</small></span></button>`);
      }
      if (m.f.music) {
        items.splice(Math.min(2, items.length), 0, `<button class="mode" data-action="music" style="--g1:#1db954;--g2:#0b7a35;--i:2"><span class="mi">${ic('music')}</span><span><b>Música</b><small>Elegí qué escuchar</small></span></button>`);
      }
      if (m.f.automations) {
        items.push(`<button class="mode" data-action="automations" style="--g1:#2f6bff;--g2:#3ee6c4;--i:${m.scenes.length + 1}"><span class="mi">${ic('sparkle')}</span><span><b>Automatizaciones</b><small>Creá las tuyas</small></span></button>`);
      }
      if (!items.length) return '';
      return `<div class="sec-h" style="margin-top:0"><h2>Modos</h2><span>Un toque y la casa se acomoda</span></div><div class="modes">${items.join('')}</div>`;
    }

    _hRooms(m) {
      if (!m.rooms.length) {
        return `<div class="glass empty">${ic('home')}<br><b>Todavía no hay ambientes</b><br>Asigná los dispositivos a Áreas en Home Assistant<br>(Ajustes → Áreas) y aparecerán acá automáticamente.</div>`;
      }
      if (this._fp()) return `<div class="rlist">${m.rooms.map((r, i) => this._hRoomRow(r, i)).join('')}</div>`;
      return m.rooms.map((r, i) => {
        const on = r.lightsOn.length > 0, meta = this._roomMeta(r);
        return `<div class="room ${on ? 'on' : ''}" data-action="room" data-id="${esc(r.id)}" style="--lc:${r.rgb};--glow:${r.glow};--i:${i}" role="button" tabindex="0">
          <div class="rtop"><div class="ri">${ic(r.icon)}</div>${this._climBadge(r)}
          ${r.lights.length ? `<button class="rpw" data-action="roomlights" data-id="${esc(r.id)}" aria-label="Luces de ${esc(r.name)}">${ic('power')}</button>` : ''}</div>
          <div class="rname">${esc(r.name)}</div><div class="rmeta">${meta}</div>
          ${on ? `<div class="rbar"><i style="width:${r.bri}%"></i></div>` : ''}</div>`;
      }).join('');
    }

    _roomMeta(r) {
      const S = this._hass.states, on = r.lightsOn.length > 0, parts = [];
      if (r.lights.length) parts.push(on ? `${r.lightsOn.length} de ${r.lightsCtl.length} ${r.lightsCtl.length > 1 ? 'luces' : 'luz'}` : 'Apagado');
      if (r.climOn.length) parts.push(HVAC[S[r.climOn[0]].state] || 'Clima');
      if (r.mediaOn.length) parts.push('Sonando');
      if (r.fansOn.length) parts.push('Ventilador');
      if (!r.lights.length && !parts.length) parts.push(`${r.count || r.temps.length} ${r.count === 1 ? 'equipo' : 'equipos'}`);
      const pre = (r.motionOn ? '<i class="live" title="Movimiento"></i>' : '') + (r.openNow.length ? `<span class="warnb">${ic('alert')}</span>` : '');
      return pre + esc(parts.join(' · '));
    }

    /** Temperatura (naranja, termómetro) y humedad (celeste, gota) de un ambiente, bien diferenciadas. */
    _climBadge(r) {
      if (r.temp == null && r.hum == null) return '';
      return `<span class="rtemp rclim">${r.temp != null ? `<i class="t">${ic('thermo')}${fmt(r.temp)}°</i>` : ''}${r.hum != null ? `<i class="h">${ic('drop')}${fmt(r.hum, 0)}%</i>` : ''}</span>`;
    }

    _hRoomRow(r, i) {
      const on = r.lightsOn.length > 0;
      return `<div class="rrow ${on ? 'on' : ''}" data-action="room" data-id="${esc(r.id)}" style="--lc:${r.rgb};--glow:${r.glow};--i:${i}" role="button" tabindex="0">
        <div class="ri">${ic(r.icon)}</div><div class="rrt"><b>${esc(r.name)}</b><span>${this._roomMeta(r)}</span></div>
        ${this._climBadge(r)}
        ${r.lights.length ? `<button class="tog ${on ? 'on' : ''}" data-action="roomlights" data-id="${esc(r.id)}" aria-label="Luces de ${esc(r.name)}"><i></i></button>` : ''}</div>`;
    }

    /* ---------- plano ---------- */
    _posOf(r) { return this._fpPos[String(r.id).toLowerCase()] || this._fpPos[r.name.toLowerCase()] || null; }

    /** Zonas del render (floorplan.zones): cada espacio se toca y se ilumina con sus luces. Sin pines ni foquitos. */
    _planZones() {
      const z = this._fp().zones;
      return Array.isArray(z) ? z.filter((x) => x && ((Array.isArray(x.area) && x.area.length === 4) || (Array.isArray(x.points) && x.points.length >= 3))) : [];
    }
    _zoneRoom(z) {
      const m = this._m; if (!m) return null;
      const key = (x) => String(x || '').toLowerCase().trim();
      const want = key(z.room || z.name);
      const r = m.rooms.find((x) => key(x.id) === want || key(x.name) === want);
      if (r) return r;
      const first = this._zoneEnts(z)[0];
      return first && this._roomOf ? this._roomOf[first] || null : null;
    }
    _zoneEnts(z) { return [].concat(z.lights || z.light || z.entities || []).map((x) => (typeof x === 'string' ? x : x && x.entity)).filter((id) => id && this._hass.states[id]); }
    _hZones() {
      const S = this._hass.states, fp = this._fp(), edit = !!fp.edit;
      const imgOn = fp.image_on ? this._url(fp.image_on) : '';
      let lit = 0;
      const html = this._planZones().map((z, i) => {
        const ids = this._zoneEnts(z), onIds = ids.filter((id) => ['on', 'open'].includes(S[id].state));
        const on = onIds.length > 0; if (on) lit++;
        const cols = onIds.filter((id) => dom(id) === 'light').map((id) => lightRGB(S[id]).split(',').map(Number));
        const rgb = cols.length ? [0, 1, 2].map((k) => Math.round(avg(cols.map((c) => c[k])))).join(',') : '255,196,120';
        const bris = onIds.map((id) => (S[id].attributes.brightness != null ? S[id].attributes.brightness / 2.55 : 100));
        const a = on ? (0.45 + 0.5 * avg(bris) / 100).toFixed(2) : '0';
        const label = `${esc(z.name || '')}${ids.length ? '' : ' · sin luz'}`;
        // mantener apretado: abre el ambiente con todos sus equipos (si no hay ambiente, la ventana de su luz)
        const zr = this._zoneRoom(z);
        const hold = zr ? `data-hold-room="${esc(zr.id)}"` : ids[0] ? `data-eid="${esc(ids[0])}"` : '';
        const common = `data-action="zone" data-i="${i}" ${hold} aria-label="${esc(z.name || 'Espacio')}"`;
        const cls = `${on ? 'on' : ''} ${ids.length ? '' : 'none'} ${edit ? 'edit' : ''}`;
        if (imgOn || z.points) {
          // El espacio ocupa todo el plano recortado con su forma: así el render prendido calza exacto con el apagado
          const pts = z.points ? z.points.map((q) => q.map(Number)) : (([x, y, w, h]) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]])(z.area.map(Number));
          const cx = avg(pts.map((q) => q[0])), cy = avg(pts.map((q) => q[1]));
          const op = on ? Math.min(1, 0.55 + 0.45 * avg(bris) / 100).toFixed(2) : '0';
          return `<button class="pz pzi ${cls}" ${common} style="clip-path:polygon(${pts.map((q) => `${q[0]}% ${q[1]}%`).join(',')});--lc:${rgb};--a:${a};--o:${op}">
            ${imgOn ? `<i class="pz-on" style="background-image:url('${esc(imgOn)}')"></i>` : '<i class="pz-glow"></i>'}<span class="pz-l" style="left:${cx.toFixed(1)}%;top:${cy.toFixed(1)}%">${label}</span></button>`;
        }
        const [x, y, w, h] = z.area.map(Number);
        return `<button class="pz ${cls}" ${common}
          style="left:${x}%;top:${y}%;width:${w}%;height:${h}%;--lc:${rgb};--a:${a}"><span class="pz-l">${label}</span></button>`;
      }).join('');
      return { html, lit };
    }

    _hPlan(m) {
      const edit = !!this._fp().edit;
      if (this._planZones().length) {
        const z = this._hZones();
        const tag = edit ? `${ic('sparkle')} Modo edición` : `<i class="live"></i> En vivo · ${z.lit ? `${z.lit} ${z.lit > 1 ? 'espacios iluminados' : 'espacio iluminado'}` : 'todo apagado'}<em class="plan-help">· Tocá un espacio para prender o apagar · mantenelo apretado para ver todo</em>`;
        return z.html + `<div class="plan-tag">${tag}</div>`;
      }
      let k = 0;
      const glows = [], pins = [], zones = [], devHtml = [];
      const unplaced = m.rooms.filter((r) => { const q = this._posOf(r); return !q || q.auto; });
      for (const r of m.rooms) {
        const key = String(r.id).toLowerCase();
        let p = this._posOf(r);
        if (!p) {
          // Sin ubicación en floorplan.rooms: igual se muestra (repartido sobre el plano) para que siempre se pueda tocar
          const n = unplaced.length, cols = Math.min(4, Math.max(2, Math.ceil(Math.sqrt(n * 1.6))));
          const kk = k++, row = Math.floor(kk / cols);
          p = { x: Math.round(18 + (kk % cols) * (64 / Math.max(1, cols - 1))), y: Math.round(26 + row * (48 / Math.max(1, Math.ceil(n / cols) - 1 || 1))), r: 12, auto: true };
        }
        this._fpPos[key] = p; // normaliza: siempre accesible por area_id
        const on = r.lightsOn.length > 0, id = esc(key);
        const a = on ? (0.3 + 0.55 * r.bri / 100).toFixed(2) : '0.22';
        if (r.lights.length || edit) glows.push(`<i class="glow ${on || edit ? 'on' : ''} ${edit ? 'edit' : ''}" data-gid="${id}" style="left:${p.x}%;top:${p.y}%;--r:${p.r}%;--lc:${on ? r.rgb : '150,170,255'};--a:${a}"></i>`);
        if (r.lights.length && !edit) zones.push(`<button class="pzone" data-action="roomlights" data-id="${esc(r.id)}" style="left:${p.x}%;top:${p.y}%;--r:${p.r}%" aria-label="Luces de ${esc(r.name)}"></button>`);
        // Equipos del ambiente: en su lugar (floorplan.devices) o en ronda alrededor del nombre
        const devs = this._planDevs(r);
        devs.forEach((eid, i) => {
          const dk = `dev:${eid}`;
          let q = this._fpPos[dk];
          if (!q || !q.fixed) {
            const ang = -Math.PI / 2 + (i + 0.5) * (2 * Math.PI / devs.length), rr = Math.max(5, Math.min(p.r * 0.62, 10));
            q = { x: Math.round((p.x + Math.cos(ang) * rr) * 10) / 10, y: Math.round((p.y + Math.sin(ang) * rr * 1.6) * 10) / 10 };
            if (edit) this._fpPos[dk] = q; // en edición se guarda para poder arrastrarlo y copiarlo al YAML
          }
          devHtml.push(this._planDev(eid, q, edit));
        });
        const tgt = edit ? `data-fp="${id}"` : `data-action="room" data-id="${esc(r.id)}"`;
        pins.push(`<button class="ppin ${on ? 'on' : ''} ${r.openNow.length ? 'warn' : ''} ${edit ? 'edit' : ''}" ${tgt} style="left:${p.x}%;top:${p.y}%;--lc:${r.rgb}" aria-label="${esc(r.name)}">
          <span class="ppi">${ic(r.icon)}</span><span class="ppt"><b>${esc(r.name)}</b>${r.temp != null ? `<small>${fmt(r.temp)}°</small>` : ''}</span>${r.motionOn ? '<i class="live"></i>' : ''}</button>`);
      }
      const act = m.rooms.filter((r) => r.lightsOn.length).length;
      const tag = edit ? `${ic('sparkle')} Modo edición` : `<i class="live"></i> En vivo · ${act ? `${act} ${act > 1 ? 'ambientes iluminados' : 'ambiente iluminado'}` : 'todo apagado'}`;
      // Aviso para el instalador: ambientes repartidos a ojo (falta ubicarlos con edit: true)
      const hint = !edit && unplaced.length ? `<div class="plan-hint">${ic('sparkle')} ${unplaced.length === m.rooms.length ? 'Ambientes sin ubicar' : `${unplaced.length} sin ubicar`} · activá <b>edit: true</b> en floorplan para ponerlos en su lugar</div>` : '';
      return glows.join('') + zones.join('') + devHtml.join('') + pins.join('') + `<div class="plan-tag">${tag}</div>${hint}`;
    }

    /** Equipos que van sobre el plano: luces, enchufes, cortinas, clima, ventiladores, cerraduras y teles/parlantes. */
    _planDevs(r) {
      const fp = this._fp();
      if (!fp.show_devices) return []; // por defecto el plano queda limpio: se tocan los espacios
      return [...new Set([...r.lights, ...r.switches, ...r.covers, ...r.climates, ...r.fans, ...r.locks, ...r.media])].filter((id) => this._hass.states[id]);
    }
    _planDev(eid, q, edit) {
      const S = this._hass.states, st = S[eid], d = dom(eid), a = st.attributes;
      const on = d === 'cover' ? ['open', 'opening'].includes(st.state) : d === 'lock' ? st.state !== 'locked' : d === 'climate' ? st.state !== 'off' : ['on', 'playing'].includes(st.state);
      const icon = { light: 'bulb', switch: this._m.rooms.some((r) => r.lights.includes(eid)) ? 'bulb' : 'plug', cover: ['garage', 'gate'].includes(a.device_class) ? 'garage' : 'blind',
        climate: 'snow', fan: 'fan', lock: on ? 'unlock' : 'lock', media_player: 'tv' }[d] || 'power';
      const lc = d === 'light' && on ? lightRGB(st) : d === 'climate' ? '120,190,255' : d === 'cover' || d === 'lock' ? '255,176,77' : '255,214,140';
      const tgt = edit ? `data-fp="dev:${esc(eid)}"` : `data-action="pdev"`;
      return `<button class="pdev ${on ? 'on' : ''} ${edit ? 'edit' : ''}" ${tgt} data-eid="${esc(eid)}" style="left:${q.x}%;top:${q.y}%;--lc:${lc}" title="${esc(this._name(eid))}" aria-label="${esc(this._name(eid))}">${ic(icon)}</button>`;
    }

    _planYamlText(m) {
      const lines = ['floorplan:', `  image: ${this._fp().image}`, '  rooms:'];
      for (const r of m.rooms) {
        const p = this._posOf(r);
        if (p) lines.push(`    ${r.id}: { x: ${p.x}, y: ${p.y}, r: ${p.r} }`);
      }
      const devs = Object.entries(this._fpPos).filter(([k]) => k.startsWith('dev:'));
      if (devs.length) { lines.push('  devices:'); devs.forEach(([k, q]) => lines.push(`    ${k.slice(4)}: { x: ${q.x}, y: ${q.y} }`)); }
      return lines.join('\n');
    }

    _hPlanYaml(m) {
      return `<div class="fpedit"><div class="blk-h"><h4>${ic('sparkle')}Ubicar ambientes en el plano</h4><button class="tbtn" data-action="fpcopy">Copiar YAML</button></div>
        <p>Arrastrá cada ambiente a su lugar. Con la rueda del mouse sobre un ambiente agrandás o achicás su brillo.
        Cuando termines, copiá esto, reemplazá el bloque <b>floorplan</b> de la tarjeta y sacá <b>edit: true</b>.</p>
        <pre id="fpyamltxt">${esc(this._planYamlText(m))}</pre></div>`;
    }

    _copyYaml() {
      const txt = this._planYamlText(this._m);
      const ok = () => this._toast(`${ic('check')} YAML copiado`);
      const fallback = () => {
        const pre = this._root.getElementById('fpyamltxt');
        if (pre) { const rg = document.createRange(); rg.selectNodeContents(pre); const s = window.getSelection(); s.removeAllRanges(); s.addRange(rg); }
        this._toast(`${ic('alert')} Texto seleccionado: copialo con Ctrl+C`);
      };
      try { navigator.clipboard.writeText(txt).then(ok, fallback); } catch (_) { fallback(); }
    }

    _onWheel(e) {
      const pin = e.target.closest('[data-fp]'); if (!pin || pin.dataset.fp.startsWith('dev:')) return;
      e.preventDefault();
      const p = this._fpPos[pin.dataset.fp]; if (!p) return;
      p.r = Math.min(45, Math.max(4, p.r + (e.deltaY < 0 ? 1 : -1)));
      const g = [...this._els.planfx.querySelectorAll('[data-gid]')].find((x) => x.dataset.gid === pin.dataset.fp);
      if (g) g.style.setProperty('--r', p.r + '%');
      this._set('planyaml', this._hPlanYaml(this._m));
    }

    /* Vista previa en vivo (MJPEG de HA). Con camera_preview: snapshot se usan fotos cada 10 s. */
    _cam(id, i = 0, snap = false) {
      const st = this._hass.states[id], a = st.attributes, pv = this._config.camera_preview;
      const live = !IOS_DEV && pv !== 'snapshot' && (pv === 'live' || !snap) && a.access_token;
      const src = live ? `/api/camera_proxy_stream/${id}?token=${a.access_token}` : (a.entity_picture || '');
      const poster = a.entity_picture || '';
      return `<div class="cam" data-action="more" data-eid="${id}" style="--i:${i}"><img src="${esc(this._url(src))}" data-src="${esc(src)}" data-poster="${esc(this._url(poster))}" ${live ? 'data-live="1"' : ''} alt="">
        <div class="cam-l"><i class="rec"></i>${esc(this._name(id))}${live ? ' · en vivo' : ''}</div></div>`;
    }

    // Fuera de la vista: cortar los videos para no gastar datos; al volver, reconectarlos.
    _pauseCams(paused) {
      if (!this._root) return;
      this._root.querySelectorAll('.cam img[data-live]').forEach((img) => {
        if (paused) { if (img.dataset.poster) img.src = img.dataset.poster; else img.removeAttribute('src'); }
        else img.src = this._url(img.dataset.src);
      });
    }

    /** Pestañas de la columna del medio: Casa (plano) · Seguridad (alarma, accesos y cámaras). */
    _hCTabs(m) {
      const t = this._ctab || 'casa', a = m.alarm, nOpen = m.openNames.length, nCam = m.cams.length || (this._camInline() ? (this._config.camera_card.cameras || []).length : 0);
      const [alab, acls] = a ? (ALARM[a.state] || [a.state, 'off']) : [null, 'off'];
      const sub = [alab, nOpen ? `${nOpen} ${nOpen === 1 ? 'abierta' : 'abiertas'}` : null, nCam ? `${nCam} ${nCam === 1 ? 'cámara' : 'cámaras'}` : null].filter(Boolean).join(' · ') || 'Todo cerrado';
      const dot = acls === 'alert' ? 'alert' : acls === 'wait' || nOpen ? 'warn' : acls === 'on' ? 'on' : 'ok';
      const lr = m.rooms.filter((r) => r.lightsOn.length).length;
      return `<button class="ctab ${t === 'casa' ? 'on' : ''}" data-action="ctab" data-v="casa">${ic('home')}<span><b>Casa</b><small>${m.f.lights ? (m.lightsOn ? `${m.lightsOn} ${m.lightsOn === 1 ? 'luz' : 'luces'} en ${lr} ${lr === 1 ? 'ambiente' : 'ambientes'}` : 'Luces apagadas') : `${m.rooms.length} ambientes`}</small></span></button>
        <button class="ctab ${t === 'seg' ? 'on' : ''}" data-action="ctab" data-v="seg">${ic('shield')}<span><b>Seguridad</b><small>${esc(sub)}</small></span><i class="cdot ${dot}"></i></button>`;
    }

    _hCams(m) {
      if (this._camInline()) {
        // HTML fijo: la Advanced Camera Card se monta adentro una sola vez y no se recrea en cada actualización.
        return `<div class="sec-h" style="margin-top:12px"><h2>Cámaras</h2><button class="tbtn" data-action="camfull">${ic('cam')} Pantalla completa</button></div><div class="camcard" id="camcard"></div>`;
      }
      if (!m.cams.length) return '';
      const snap = m.cams.length > 2; // muchos videos a la vez traban celulares y tablets: fotos que se actualizan solas
      return `<div class="sec-h" style="margin-top:12px"><h2>Cámaras</h2><span>${m.cams.length} ${snap ? 'cámaras · tocá para ver en vivo' : 'en vivo'}</span></div><div class="cams">${m.cams.map((id, i) => this._cam(id, i, snap)).join('')}</div>`;
    }

    /* Advanced Camera Card dentro del dashboard (una cámara a la vez, con flechas, video fluido por go2rtc).
       Si la tarjeta no está disponible en 20 s, se vuelve a las miniaturas. */
    _camInline() { const c = this._config; return !!(c.camera_card && c.camera_inline !== false && !this._camFail && !featOff(c, 'cameras')); }

    /** Dentro de HA pero fuera de un dashboard (el panel MatterAI), HA no carga las tarjetas de HACS:
     *  se trae la de cámaras (Frigate / advanced-camera-card) de los recursos de Lovelace. En la app la carga la app. */
    _ensureCamCard() {
      const TAG = 'advanced-camera-card', h = this._hass;
      if (customElements.get(TAG) || MatterAIHomeCard._camLoading || this._config.base_url || !h || typeof h.callWS !== 'function') return;
      MatterAIHomeCard._camLoading = true;
      Promise.resolve(h.callWS({ type: 'lovelace/resources' })).then((list) => {
        const r = (list || []).find((x) => /advanced-camera-card|frigate-hass-card/.test(String(x.url || '')));
        if (r && !customElements.get(TAG)) return import(/* webpackIgnore: true */ r.url);
        return null;
      }).catch(() => { MatterAIHomeCard._camLoading = false; });
    }
    _mountCamCard() {
      const host = this._root && this._root.getElementById('camcard');
      if (!host) { this._camEl = null; return; }
      if (this._camEl && this._camEl.parentNode === host) { this._camEl.hass = this._hass; return; }
      const TAG = 'advanced-camera-card';
      if (!customElements.get(TAG)) {
        this._ensureCamCard();
        if (!this._camWait) {
          this._camWait = true;
          const t = setTimeout(() => { if (!customElements.get(TAG)) { this._camFail = true; delete this._cache.cams; this._schedule(); } }, 20000);
          // si llega tarde, igual se usa (antes quedaban las miniaturas hasta recargar)
          customElements.whenDefined(TAG).then(() => { clearTimeout(t); if (this._camFail) { this._camFail = false; delete this._cache.cams; this._roomCamKey = null; } this._schedule(); });
        }
        if (!host.firstChild) host.innerHTML = `<div class="camload">${ic('cam')}<span>Conectando cámaras…</span></div>`;
        return;
      }
      const el = document.createElement(TAG);
      try { el.setConfig(Object.assign({}, this._config.camera_card, { type: `custom:${TAG}` })); } catch (e) {
        host.innerHTML = `<div class="camload">${ic('alert')}<span>Error en camera_card: ${esc(e.message || e)}</span></div>`;
        return;
      }
      el.hass = this._hass;
      host.innerHTML = '';
      host.appendChild(el);
      this._camEl = el;
    }

    _refreshCams() {
      if (!this._root || document.hidden || this._scrolling()) return;
      this._root.querySelectorAll('.cam img[data-src]').forEach((img) => {
        const s = img.dataset.src;
        if (!img.dataset.live && s.startsWith('/api/camera_proxy/')) img.src = this._url(s) + (s.includes('?') ? '&' : '?') + '_t=' + Date.now();
      });
    }

    _hFooter() {
      const c = this._config;
      const logo = c.logo ? '' : `<span class="mono">${esc((c.installer || 'M').charAt(0))}</span>`;
      const phone = String(c.support_phone || '').replace(/\D/g, '');
      return `<div class="fbrand">${logo}<span>Hogar inteligente diseñado e instalado por <b>${esc(c.installer)}</b></span></div>
        ${phone ? `<a class="btn ghost" href="https://wa.me/${phone}?text=${encodeURIComponent('Hola! Necesito ayuda con mi casa inteligente')}" target="_blank" rel="noopener" style="text-decoration:none">${ic('chat')} Soporte técnico</a>` : ''}
        <span style="opacity:.5">v${VERSION}</span>`;
    }

    /* ---------- hoja de ambiente ---------- */
    _openRoom(id) {
      this._room = id; this._panel = null;
      // Dos partes: lo que se redibuja con cada cambio (luces, clima…) y las cámaras, que no se tocan para no cortar el video.
      this._els.sheet.innerHTML = `<div id="sheettop" class="mae-xtra"></div><div id="sheetdyn"></div><div id="sheetcam"></div><div id="sheetdyn2"></div><div id="sheetbot" class="mae-xtra"></div>
        <p class="hint">Tocá para encender · Deslizá para regular · Mantené presionado para más opciones</p>`;
      this._els.sheetdyn = this._els.sheet.querySelector('#sheetdyn');
      this._els.sheetcam = this._els.sheet.querySelector('#sheetcam');
      this._els.sheetdyn2 = this._els.sheet.querySelector('#sheetdyn2');
      this._cache.sheetdyn = null; this._cache.sheetdyn2 = null;
      this._roomCamEl = null; this._roomCamKey = null;
      this._renderSheet();
      // tarjetas que el instalador agregó a este ambiente (arriba y abajo de sus equipos): las dibuja el motor de dashboards
      const rr = this._m && this._m.byId && this._m.byId[id];
      if (rr && typeof this.roomExtra === 'function') { try { this.roomExtra(rr, this._els.sheet.querySelector('#sheettop'), this._els.sheet.querySelector('#sheetbot')); } catch (_) { /* sin tarjetas extra */ } }
      this._els.sheet.scrollTop = 0;
      this._els.sheetwrap.classList.add('open');
      this._haptic('light');
    }
    _closeRoom() {
      if (!this._room && !this._panel) return;
      if (this._panel === 'agenda') this._closeAgenda();
      this._room = null; this._panel = null;
      this._els.sheetwrap.classList.remove('open');
      if (typeof this.roomExtraClose === 'function') { try { this.roomExtraClose(); } catch (_) { /* nada */ } }
      // cortar el video de las cámaras del ambiente
      this._roomCamEl = null; this._roomCamKey = null;
      this._roomAct = null; clearTimeout(this._raT);
      if (this._els.sheetcam) this._els.sheetcam.innerHTML = '';
    }
    _renderSheet() {
      if (this._panel) {
        if (this._panel === 'agenda' && this._ag && this._ag.form) return; // formulario abierto: no borrar lo que se escribe
        this._set('sheetdyn', this._hPanel(this._panel)); if (this._els.sheetdyn2) this._set('sheetdyn2', ''); return;
      }
      const r = this._m && this._m.byId[this._room];
      if (!r) return this._closeRoom();
      const [a, b] = this._hSheet(r); // las cámaras quedan entre las dos partes
      this._set('sheetdyn', a);
      if (this._els.sheetdyn2) this._set('sheetdyn2', b);
      this._mountRoomCam(r);
    }

    /* Cámaras del ambiente: la misma Advanced Camera Card, sólo con las cámaras de ese ambiente. */
    _roomCamConfig(r) {
      const base = this._config.camera_card || {};
      const known = base.cameras || [];
      let cfg = Object.assign({}, base, {
        cameras: r.cams.map((id) => known.find((k) => k && k.camera_entity === id) || { camera_entity: id }),
      });
      if (typeof window.__maeAdaptCamera === 'function') cfg = window.__maeAdaptCamera(cfg); // app: modo de video que anda fuera de HA
      return Object.assign(cfg, { type: 'custom:advanced-camera-card' });
    }

    _mountRoomCam(r) {
      const host = this._els.sheetcam;
      if (!host) return;
      if (!r.cams.length) { if (host.firstChild) host.innerHTML = ''; this._roomCamEl = null; this._roomCamKey = null; return; }
      const TAG = 'advanced-camera-card';
      if (this._camInline() && !customElements.get(TAG)) this._ensureCamCard();
      const inline = this._camInline() && customElements.get(TAG);
      const key = `${r.id}|${inline ? 'card' : 'tiles'}|${r.cams.join(',')}`;
      if (this._roomCamKey === key) {
        if (this._roomCamEl) this._roomCamEl.hass = this._hass;
        return;
      }
      this._roomCamKey = key; this._roomCamEl = null;
      const head = `<div class="blk"><div class="blk-h"><h4>${ic('cam')}Cámaras</h4></div>`;
      if (!inline) {
        host.innerHTML = `${head}<div class="sh-cams">${r.cams.map((id) => this._cam(id, 0, r.cams.length > 2)).join('')}</div></div>`;
        // Si la tarjeta de cámaras termina de cargar, se reemplazan las miniaturas.
        if (this._camInline()) customElements.whenDefined(TAG).then(() => { if (this._room === r.id) { this._roomCamKey = null; this._schedule(); } });
        return;
      }
      host.innerHTML = `${head}<div class="camcard"></div></div>`;
      const el = document.createElement(TAG);
      try { el.setConfig(this._roomCamConfig(r)); } catch (e) {
        host.querySelector('.camcard').innerHTML = `<div class="camload">${ic('alert')}<span>Error en camera_card: ${esc(e.message || e)}</span></div>`;
        return;
      }
      el.hass = this._hass;
      host.querySelector('.camcard').appendChild(el);
      this._roomCamEl = el;
    }

    _pill(id, r) {
      const st = this._hass.states[id], d = dom(id), on = st.state === 'on';
      const lightish = r.lights.includes(id);
      const dim = d === 'light' && (st.attributes.supported_color_modes || []).some((x) => x !== 'onoff');
      const pct = on ? (dim && st.attributes.brightness != null ? Math.max(1, Math.round(st.attributes.brightness / 2.55)) : 100) : 0;
      const icn = d === 'fan' ? 'fan' : lightish ? 'bulb' : 'plug';
      const stx = on ? (dim ? `${pct}%` : lightish ? 'Encendida' : 'Encendido') : (lightish ? 'Apagada' : 'Apagado');
      const lc = lightish ? lightRGB(st) : '124,156,255';
      return `<div class="pill ${on ? 'on' : ''} ${dim ? 'dim' : ''} k-${icn}" data-pill data-eid="${id}" data-dim="${dim ? 1 : 0}" style="--b:${on ? pct : 0}%;--lc:${lc}">
        <div class="fill"></div><span class="pi">${ic(icn)}</span><span class="pt"><b>${esc(this._name(id, r))}</b><span class="st">${stx}</span></span></div>`;
    }

    _clim(id, r) {
      const st = this._hass.states[id], a = st.attributes, on = st.state !== 'off';
      const tgt = this._pt[id] != null ? this._pt[id] : a.temperature;
      const modes = a.hvac_modes || [];
      return `<div class="clim ${on ? 'on' : ''} m-${st.state}" data-eid="${id}">
        <div class="clim-top"><div><b>${esc(this._name(id, r))}</b><span>${esc(HVAC[st.state] || st.state)}${a.current_temperature != null ? ` · ambiente ${fmt(a.current_temperature)}°` : ''}</span></div>
          <button class="ib pw" data-action="clpower" data-eid="${id}" aria-label="Encender o apagar">${ic('power')}</button></div>
        ${tgt != null ? `<div class="dial"><button class="rb" data-action="temp" data-eid="${id}" data-d="-1" aria-label="Bajar">${ic('minus')}</button>
          <div class="tgt"><b>${fmt(tgt)}</b><sup>°</sup><small>Objetivo</small></div>
          <button class="rb" data-action="temp" data-eid="${id}" data-d="1" aria-label="Subir">${ic('plus')}</button></div>` : '<div style="height:12px"></div>'}
        <div class="chips">${modes.map((x) => `<button class="chip ${st.state === x ? 'act' : ''}" data-action="hvac" data-eid="${id}" data-mode="${x}">${esc(HVAC[x] || x)}</button>`).join('')}</div></div>`;
    }

    _cover(id, r) {
      const st = this._hass.states[id], a = st.attributes, f = a.supported_features || 0, pos = a.current_position;
      const masc = ['garage', 'gate', 'awning'].includes(a.device_class);
      const stx = ({ open: masc ? 'Abierto' : 'Abierta', closed: masc ? 'Cerrado' : 'Cerrada', opening: 'Abriendo…', closing: 'Cerrando…' }[st.state] || st.state);
      const on = st.state !== 'closed';
      const b = (svc, i, l) => `<button class="sb" data-action="cover" data-svc="${svc}" data-eid="${id}" aria-label="${l}">${ic(i)}</button>`;
      return `<div class="row ${on ? 'on' : ''}" data-eid="${id}"><span class="pi">${ic(masc ? 'garage' : 'blind')}</span>
        <div class="rt"><b>${esc(this._name(id, r))}</b><span>${esc(stx)}${pos != null ? ` · ${pos}%` : ''}</span>${pos != null ? `<div class="pos"><i style="width:${pos}%"></i></div>` : ''}</div>
        <div class="bt">${!f || f & 1 ? b('open_cover', 'up', 'Abrir') : ''}${f & 8 ? b('stop_cover', 'stop', 'Detener') : ''}${!f || f & 2 ? b('close_cover', 'down', 'Cerrar') : ''}</div></div>`;
    }

    _media(id, r) {
      const st = this._hass.states[id], off = ['off', 'standby'].includes(st.state);
      const a = Object.assign({}, st.attributes, { entity_picture: this._url(st.attributes.entity_picture) });
      const title = a.media_title || this._name(id, r);
      const sub = a.media_title ? [a.media_artist || a.app_name, this._name(id, r)].filter(Boolean).join(' · ') : (MEDIA[st.state] || st.state);
      const b = (svc, i, cls = '') => `<button class="sb ${cls}" data-action="media" data-svc="${svc}" data-eid="${id}">${ic(i)}</button>`;
      return `<div class="row ${st.state === 'playing' ? 'on' : ''}" data-eid="${id}"><span class="pi art" ${a.entity_picture ? `style="background-image:url('${esc(a.entity_picture)}')"` : ''}>${a.entity_picture ? '' : ic(dom(id) === 'media_player' && /tv|tele/i.test(a.friendly_name || '') ? 'tv' : 'music')}</span>
        <div class="rt"><b>${esc(title)}</b><span>${esc(sub)}</span></div>
        <div class="bt">${off ? b('turn_on', 'power') : `${b('volume_down', 'minus')}${b('media_play_pause', st.state === 'playing' ? 'pause' : 'play', 'pp')}${b('volume_up', 'plus')}${b('turn_off', 'power')}`}</div></div>`;
    }

    _hSheet(r) {
      const S = this._hass.states, sub = [];
      if (r.temp != null) sub.push(`<span class="mt">${ic('thermo')}${fmt(r.temp)}°</span>`);
      if (r.hum != null) sub.push(`<span class="mh">${ic('drop')}${fmt(r.hum, 0)}%</span>`);
      if (r.motion.length) {
        const last = r.motion.map((id) => S[id].last_changed).sort().pop();
        sub.push(r.motionOn ? '<span><i class="live"></i>Hay movimiento</span>' : `<span>${ic('motion')}Sin movimiento · ${ago(last)}</span>`);
      }
      const on = r.lightsOn.length > 0;
      const pos = r.camPos === 'top' || r.camPos === 'end' ? r.camPos : 'after';
      let h = `<div class="grab"></div><div class="sh-head" style="--lc:${r.rgb}"><div class="ri big ${on ? 'on' : ''}">${ic(r.icon)}</div>
        <div class="sh-t"><h2>${esc(r.name)}</h2><div class="sh-sub">${sub.join('')}</div></div>
        <button class="ib" data-action="close" aria-label="Cerrar">${ic('x')}</button></div>`;
      const head = h; if (pos === 'top') h = '';
      const blk = (icon, title, body, extra = '') => `<div class="blk"><div class="blk-h"><h4>${ic(icon)}${title}</h4>${extra}</div>${body}</div>`;
      // En el orden exacto de la lista del instalador: las entidades seguidas del mismo tipo forman un bloque
      // (si el toldo está al final de la lista, va al final aunque el portón también sea una abertura).
      const sens = [...r.motion, ...r.openings, ...r.sensors];
      const groups = [['light', r.lights], ['clim', [...r.climates, ...r.fans]], ['cover', r.covers], ['media', r.media], ['switch', r.switches], ['lock', r.locks], ['action', r.actions], ['sensor', sens]];
      const kindOf = {};
      groups.forEach(([k, ids]) => ids.forEach((id) => { if (!(id in kindOf)) kindOf[id] = k; }));
      let seq = [];
      if (r.ord) {
        const place = (id) => (id in r.ord ? r.ord[id] : 1e6);
        Object.keys(kindOf).sort((x, y) => place(x) - place(y)).forEach((id) => {
          const k = kindOf[id], prev = seq[seq.length - 1];
          if (prev && prev.k === k) prev.ids.push(id); else seq.push({ k, ids: [id] });
        });
      } else seq = groups.filter(([, ids]) => ids.length).map(([k, ids]) => ({ k, ids }));
      let allBtn = true;
      const render = ({ k, ids }) => {
        if (k === 'light') {
          const extra = allBtn ? `<button class="tbtn" data-action="roomall" data-id="${esc(r.id)}" data-on="${on ? 0 : 1}">${on ? 'Apagar todas' : 'Encender todas'}</button>` : '';
          allBtn = false;
          return blk('bulb', 'Iluminación', `<div class="pills">${ids.map((id) => this._pill(id, r)).join('')}</div>`, extra);
        }
        if (k === 'clim') {
          const cl = ids.filter((id) => r.climates.includes(id)), fans = ids.filter((id) => r.fans.includes(id));
          return blk('thermo', 'Climatización', cl.map((id) => this._clim(id, r)).join('') +
            (fans.length ? `<div class="pills" style="${cl.length ? 'margin-top:10px' : ''}">${fans.map((id) => this._pill(id, r)).join('')}</div>` : ''));
        }
        if (k === 'cover') return blk('blind', 'Cortinas y aberturas', ids.map((id) => this._cover(id, r)).join(''));
        if (k === 'media') return blk('music', 'Multimedia', ids.map((id) => this._media(id, r)).join(''));
        if (k === 'switch') return blk('plug', 'Equipos', `<div class="pills">${ids.map((id) => this._pill(id, r)).join('')}</div>`);
        if (k === 'lock') {
          return blk('lock', 'Cerraduras', ids.map((id) => {
            const lk = S[id].state === 'locked';
            return `<div class="row ${lk ? 'on' : ''}" data-eid="${id}"><span class="pi">${ic(lk ? 'lock' : 'unlock')}</span><div class="rt"><b>${esc(this._name(id, r))}</b><span>${lk ? 'Trabada' : 'Destrabada'}</span></div><button class="btn ghost" data-action="access" data-eid="${id}">${lk ? 'Destrabar' : 'Trabar'}</button></div>`;
          }).join(''));
        }
        if (k === 'action') {
          return blk('sparkle', 'Acciones', `<div class="pills">${ids.map((id) => `<button class="pill k-act" data-action="run" data-eid="${id}" style="--b:0%;--lc:124,156,255">
          <div class="fill"></div><span class="pi">${ic(dom(id) === 'scene' ? 'sparkle' : 'play')}</span><span class="pt"><b>${esc(this._name(id, r))}</b><span class="st">Tocá para ejecutar</span></span></button>`).join('')}</div>`);
        }
        return blk('motion', 'Sensores', `<div class="opn" style="margin:0">${ids.map((id) => this._chip(id, r)).join('')}</div>`);
      };
      seq.forEach((g) => { h += render(g); });
      // las cámaras van aparte (_mountRoomCam) para que el video no se corte al redibujar: [antes de las cámaras, después]
      if (pos === 'top') return [head, h + this._hRoomAct(r)];
      if (pos === 'end') return [h + this._hRoomAct(r), ''];
      return [h, this._hRoomAct(r)];
    }

    /* ---------- Voz: "prendé la música en el living" ----------
     * El celular pasa la voz a texto (reconocimiento del sistema); la integración MatterAI entiende
     * el pedido y lo ejecuta; la respuesta se dice en voz alta. */
    _speechRec() {
      if (typeof window === 'undefined') return null;
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SR && this._isNative()) return SR; // app nativa: reconocimiento del sistema (voz-nativa.js)
      if (!SR || MatterAIHomeCard.iosNoSpeech((window.navigator || {}).userAgent || '', (window.navigator || {}).maxTouchPoints || 0)) return null;
      return SR;
    }
    static iosWeb() {
      if (typeof window === 'undefined' || !window.navigator) return false;
      const ua = window.navigator.userAgent || '', ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && window.navigator.maxTouchPoints > 1);
      const native = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
      return ios && !native;
    }
    /** En iPhone/iPad sólo Safari escucha de verdad: Chrome, Firefox, Edge y las apps (la de HA) lo muestran pero no devuelven nada. */
    static iosNoSpeech(ua, touch) {
      const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && touch > 1);
      if (!ios) return false;
      if (/CriOS|FxiOS|EdgiOS|OPiOS|GSA\/|Home ?Assistant|HomeAssistant/i.test(ua)) return true;
      return !/Safari\//.test(ua); // WKWebView de apps: sin "Safari/" en el agente
    }
    _voiceAvailable() {
      const h = this._hass, comps = (h && h.config && h.config.components) || [];
      // en la app lo avisa la integración (config.voice); dentro de HA alcanza con que esté instalada
      const on = this._config.voice === true || (this._config.voice !== false && comps.includes('matterai'));
      return !!(on && h && typeof h.callWS === 'function'); // sin reconocimiento: se graba y transcribe la casa
    }
    _voiceStart() {
      if (this._vo && this._vo.state === 'listening') return this._vo.finish ? this._vo.finish() : this._voiceStop();
      if (this._vo) this._voiceStop(); // "probar de nuevo" desde un error
      const SR = this._speechRec();
      if (!SR) { // sin reconocimiento en el celular: se graba y lo pasa a texto la casa
        if (this._canRecord()) { this._recStart(); return; }
        this._voiceFail(this._micBlockedWhy());
        return;
      }
      if (this._hf) this._hfStop();
      try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (_) { /* sin voz */ }
      const rec = new SR();
      rec.lang = 'es-AR'; rec.interimResults = true; rec.continuous = false; rec.maxAlternatives = 1;
      const vo = this._vo = { state: 'listening', text: '', rec };
      rec.onresult = (e) => {
        let t = ''; let final = false;
        for (let i = e.resultIndex; i < e.results.length; i++) { t += e.results[i][0].transcript; if (e.results[i].isFinal) final = true; }
        vo.text = (final ? '' : '') + t; this._voiceRender();
        if (final) { vo.final = true; this._voiceSend(t); }
      };
      rec.onerror = (e) => {
        if (this._vo !== vo) return;
        // despertado con «Mate»: el permiso del micrófono ya está dado (Mate estaba escuchando). Si falla al arrancar es
        // que Android todavía no lo soltó: se reintenta solo, sin mostrar «no tengo permiso»
        if (vo.mate && !vo.text && e.error !== 'no-speech' && e.error !== 'aborted' && (this._mateTry || 0) < 3) {
          this._mateTry = (this._mateTry || 0) + 1;
          this._vo = null;
          setTimeout(() => { if (this._vo) return; this._voiceStart(); if (this._vo) this._vo.mate = true; }, 700);
          return;
        }
        // el reconocimiento del celular falló por algo que no es el permiso: se graba y lo transcribe la casa
        if (e.error !== 'not-allowed' && e.error !== 'service-not-allowed' && e.error !== 'no-speech' && e.error !== 'aborted' && this._canRecord() && !this._isNative()) {
          clearTimeout(this._voWD); this._vo = null; this._recStart(); return;
        }
        vo.state = 'error'; vo.why = e.message ? `(${e.error}: ${e.message})` : '';
        vo.say = e.error === 'not-allowed' || e.error === 'service-not-allowed' ? 'Permití el uso del micrófono para poder escucharte.'
          : e.error === 'no-speech' ? 'No escuché nada. Tocá el micrófono y hablá.' : 'No te pude escuchar, probá de nuevo.';
        this._voiceRender(); this._voiceAutoClose(3500);
      };
      rec.onend = () => { if (this._vo === vo && vo.state === 'listening' && !vo.final) { if (vo.text) this._voiceSend(vo.text); else this._voiceStop(true); } };
      this._voiceRender(true);
      this._haptic('light');
      clearTimeout(this._voWD);
      this._voWD = setTimeout(() => { // escucha "muda" (pasa en algunos navegadores): se graba y transcribe la casa
        if (this._vo === vo && vo.state === 'listening' && !vo.text) {
          try { rec.abort(); } catch (_) { /* ya terminó */ }
          if (this._canRecord() && !this._isNative()) { this._vo = null; this._recStart(); return; }
          this._voiceFail('No te pude escuchar desde acá.', this._isNative() ? 'Probá de nuevo en un momento.' : this._micBlockedWhy());
        }
      }, 7000);
      try { rec.start(); } catch (_) { vo.state = 'error'; vo.say = 'No pude usar el micrófono.'; this._voiceRender(); }
    }
    async _voiceSend(text) {
      const vo = this._vo; if (!vo || vo.state !== 'listening') return;
      vo.state = 'thinking'; vo.text = text; this._voiceRender();
      try { if (vo.rec) vo.rec.abort(); } catch (_) { /* ya terminó */ }
      try {
        const r = await this._hass.callWS({ type: 'matterai/voice', text });
        if (this._vo !== vo) return;
        vo.state = r.ok === false ? 'error' : 'done'; vo.say = r.say || 'Listo.'; vo.actions = r.actions || [];
      } catch (e) {
        if (this._vo !== vo) return;
        vo.state = 'error'; vo.say = MatterAIHomeCard.voiceErr(e);
      }
      this._voiceRender();
      this._voiceSpeak(vo.say, () => this._voiceAutoClose(1600));
    }
    static voiceErr(e) {
      return e && e.code === 'unknown_command' ? 'La casa todavía no tiene la voz lista: hay que reiniciar Home Assistant.'
        : e && e.code === 'no_voice' ? 'El control por voz no está activado en esta casa.' : 'No me pude comunicar con la casa.';
    }
    /* ---- Grabar y que transcriba la casa (iPhone con Chrome o con la app de HA, donde el celular no reconoce la voz) ----
     * Se graba en el celular, se corta solo cuando dejás de hablar y el audio (16 kHz) va a la integración,
     * que lo pasa a texto con el motor de voz de HA (Whisper, Google Cloud, HA Cloud…). */
    _canRecord() {
      if (typeof window === 'undefined' || this._config.voice_record === false) return false;
      const md = window.navigator && window.navigator.mediaDevices;
      return !!(md && md.getUserMedia && (window.AudioContext || window.webkitAudioContext));
    }
    _recStart() {
      if (this._hf) this._hfStop();
      try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (_) { /* sin voz */ }
      const AC = window.AudioContext || window.webkitAudioContext;
      let ctx; try { ctx = new AC(); if (ctx.resume) ctx.resume(); } catch (_) { ctx = null; } // dentro del toque: si no, iPhone no deja
      const vo = this._vo = { state: 'listening', text: '', mode: 'rec' };
      const chunks = []; const t0 = Date.now(); let stream = null, node = null, src = null, lastVoice = 0, floor = 0, n = 0;
      vo.cleanup = () => {
        try { if (node) { node.onaudioprocess = null; node.disconnect(); } if (src) src.disconnect(); } catch (_) { /* ya */ }
        try { if (stream) stream.getTracks().forEach((t) => t.stop()); } catch (_) { /* ya */ }
        try { if (ctx && ctx.close && ctx.state !== 'closed') ctx.close(); } catch (_) { /* ya */ }
      };
      vo.finish = () => {
        if (this._vo !== vo || vo.state !== 'listening') return;
        const rate = (ctx && ctx.sampleRate) || 48000;
        vo.cleanup();
        if (!lastVoice) { vo.state = 'error'; vo.say = 'No escuché nada. Tocá el micrófono y hablá.'; this._voiceRender(); this._voiceAutoClose(3000); return; }
        this._voiceSendAudio(MatterAIHomeCard.b64(MatterAIHomeCard.pcm16k(chunks, rate)));
      };
      const fail = (say, why) => { vo.cleanup(); if (this._vo === vo) this._voiceFail(say, why); };
      this._voiceRender(true);
      this._haptic('light');
      if (!ctx) { fail('No pude usar el micrófono.', this._micBlockedWhy()); return; }
      window.navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } }).then((st) => {
        stream = st;
        if (this._vo !== vo) { vo.cleanup(); return; }
        src = ctx.createMediaStreamSource(st);
        node = ctx.createScriptProcessor(4096, 1, 1);
        node.onaudioprocess = (e) => {
          if (this._vo !== vo || vo.state !== 'listening') return;
          const d = e.inputBuffer.getChannelData(0); chunks.push(new Float32Array(d));
          let sum = 0; for (let i = 0; i < d.length; i++) sum += d[i] * d[i];
          const rms = Math.sqrt(sum / d.length), now = Date.now();
          if (n++ < 3) floor = Math.max(floor, rms); // los primeros instantes: ruido del ambiente
          if (rms > Math.max(0.012, floor * 2.2)) lastVoice = now;
          const orb = this._els.vowrap && this._els.vowrap.querySelector && this._els.vowrap.querySelector('.vo-orb');
          if (orb && orb.style) orb.style.setProperty('--lv', Math.min(1, rms * 12).toFixed(2));
          if (lastVoice && now - lastVoice > 1300) vo.finish(); // dejaste de hablar
          else if (!lastVoice && now - t0 > 6000) vo.finish(); // nunca habló
          else if (now - t0 > 9000) vo.finish(); // tope
        };
        src.connect(node); node.connect(ctx.destination); // la salida va vacía: no se escucha nada
      }, (err) => fail(...MatterAIHomeCard.micErr(err)));
    }
    _voiceFail(say, why) {
      this._vo = { state: 'error', text: '', say, why: why || '', go: this._secureUrl() };
      this._voiceRender(true);
      this._haptic('medium');
    }
    /** Entrando por la dirección local (http) el celular no presta el micrófono: la misma pantalla por la dirección https de la casa. */
    _secureUrl() {
      if (typeof window === 'undefined' || window.isSecureContext !== false) return '';
      const ext = String((this._hass && this._hass.config && this._hass.config.external_url) || '').replace(/\/+$/, '');
      if (!/^https:\/\//.test(ext)) return '';
      const loc = window.location || {};
      return ext + (loc.pathname || '/') + (loc.search || '');
    }
    _micBlockedWhy() {
      if (typeof window === 'undefined') return '';
      if (window.isSecureContext === false) return 'El micrófono sólo anda entrando por la dirección segura (https). Abrí la app desde el enlace de MatterAI.';
      return 'Este navegador no deja usar el micrófono. Probá con Safari o con la app MatterAI.';
    }
    /** Error de getUserMedia → [qué pasó, cómo se arregla]. */
    static micErr(err) {
      const n = (err && err.name) || '';
      if (n === 'NotAllowedError' || n === 'SecurityError') {
        return ['No tengo permiso para usar el micrófono.', 'En el iPhone: Ajustes → la app que estás usando (Chrome, Safari o Home Assistant) → Micrófono activado. En Android: mantené apretado el ícono de la app → Información → Permisos → Micrófono.'];
      }
      if (n === 'NotFoundError' || n === 'OverconstrainedError') return ['No encontré un micrófono en este equipo.', ''];
      if (n === 'NotReadableError' || n === 'AbortError') return ['El micrófono lo está usando otra app.', 'Cerrá la llamada o la app que lo esté usando y probá de nuevo.'];
      return ['No pude usar el micrófono.', n ? `(${n}${err.message ? `: ${err.message}` : ''})` : ''];
    }
    /** Audio del micrófono (a la frecuencia del celular) → PCM 16 bits a 16 kHz, mono. */
    static pcm16k(chunks, rate) {
      let len = 0; for (const c of chunks) len += c.length;
      const all = new Float32Array(len); let o = 0; for (const c of chunks) { all.set(c, o); o += c.length; }
      const ratio = rate / 16000, out = new Int16Array(Math.floor(len / ratio));
      for (let i = 0; i < out.length; i++) {
        const a = Math.floor(i * ratio), b = Math.max(a + 1, Math.min(len, Math.floor((i + 1) * ratio))); let s = 0;
        for (let j = a; j < b; j++) s += all[j];
        const v = Math.max(-1, Math.min(1, s / (b - a)));
        out[i] = v < 0 ? v * 0x8000 : v * 0x7fff;
      }
      return out;
    }
    static b64(int16) {
      const u8 = new Uint8Array(int16.buffer, int16.byteOffset, int16.byteLength); let bin = '';
      for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
      return btoa(bin);
    }
    async _voiceSendAudio(audio) {
      const vo = this._vo; if (!vo) return;
      vo.state = 'thinking'; this._voiceRender();
      try {
        const r = await this._hass.callWS({ type: 'matterai/voice_audio', audio });
        if (this._vo !== vo) return;
        vo.text = r.text || '';
        vo.state = r.ok === false ? 'error' : 'done'; vo.say = r.say || 'Listo.'; vo.actions = r.actions || [];
      } catch (e) {
        if (this._vo !== vo) return;
        vo.state = 'error'; vo.say = MatterAIHomeCard.voiceErr(e);
      }
      this._voiceRender();
      this._voiceSpeak(vo.say, () => this._voiceAutoClose(1600));
    }
    _voiceSpeak(text, done) {
      const synth = typeof window !== 'undefined' && window.speechSynthesis;
      if (!synth || !text || this._config.voice_reply === false) { done && done(); return; }
      // iPhone / iPad en el navegador: después de hablar en voz alta, el micrófono de la vez siguiente queda mudo
      // («no escuché nada» hasta cerrar la app). Ahí la respuesta queda en pantalla. (La app nativa de iPhone usará la voz de Apple.)
      if (MatterAIHomeCard.iosWeb() && this._config.voice_reply !== true) { done && done(); return; }
      try {
        const u = new SpeechSynthesisUtterance(text);
        const voices = synth.getVoices() || [];
        u.voice = voices.find((v) => /es[-_](AR|UY)/i.test(v.lang)) || voices.find((v) => /^es/i.test(v.lang)) || null;
        u.lang = (u.voice && u.voice.lang) || 'es-AR'; u.rate = 1.03;
        u.onend = () => done && done();
        u.onerror = () => done && done();
        synth.speak(u);
      } catch (_) { done && done(); }
    }
    /* ---- Manos libres: «Mate» con la app abierta (ideal para la tablet de pared) ----
     * Se activa por dispositivo. Escucha continuo con el reconocimiento del navegador y sólo
     * reacciona a "hey/oye/che matte" (con prefijo: "mate" solo aparece en cualquier charla). */
    _isNative() { return !!(typeof window !== 'undefined' && window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()); }
    _hfMate() { return this._isNative() && !!window.MaeMate; }
    _hfSupported() { return this._voiceAvailable() && !!this._speechRec() && (!this._isNative() || this._hfMate()); }
    _hfEnabled() { try { return localStorage.getItem('matterai.handsfree') === '1'; } catch (_) { return false; } }
    _hfSet(on) {
      const save = (v) => { try { localStorage.setItem('matterai.handsfree', v ? '1' : '0'); } catch (_) { /* sin almacenamiento */ } };
      if (on && this._hfMate()) {
        // la primera vez se baja la voz de Mate (unos 40 MB, sin internet después): el % queda en el botón
        if (window.MaeMate.dl != null) return; // ya se está bajando
        const show = (p) => { this._mateDl = p; if (this._vo) this._voiceRender(); this._toast(`${ic('mic')} Bajando la voz de Mate: ${p}%`); };
        window.MaeMate.ensure(show)
          .finally(() => { this._mateDl = null; if (this._vo) this._voiceRender(); })
          .then(() => { save(true); this._hfStart(); this._toast(`${ic('mic')} Decí <b>&nbsp;«Mate»&nbsp;</b>, esperá el tilín y pedí lo que necesites`); this._hfMark(); })
          .catch((e) => { save(false); this._toast(`${ic('alert')} No se pudo preparar «Mate»: ${esc((e && e.message) || e)}`); this._hfMark(); });
        return;
      }
      save(on);
      if (on) { this._hfStart(); this._toast(`${ic('mic')} Decí <b>&nbsp;«Mate»&nbsp;</b> y lo que necesites`); } else { this._hfStop(); this._toast(`${ic('mic')} Manos libres apagado`); }
      this._hfMark();
    }
    _hfMark() {
      const b = this._els.topx && this._els.topx.querySelector && this._els.topx.querySelector('#topmic');
      if (b) b.classList.toggle('hf', !!(this._hf && this._hf.on));
    }
    static wakeSplit(text) {
      // devuelve el pedido que sigue a la palabra de activación ('' si sólo dijo «Mate»), o null si no la dijo.
      // «Mate» sola sólo al principio de la frase (así no se activa con «tomamos mate»); con «hey / oye / che» en cualquier parte
      const t = String(text || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[,.!¡?¿]/g, ' ');
      const m = t.match(/^\s*mat+(?:e|i|ei)?(?=\s|$)/) || t.match(/(?:^|\s)(?:hey|ei|ey|he|oye|che)\s+mat+(?:e|i|ei)?(?=\s|$)/);
      return m ? t.slice(m.index + m[0].length).trim() : null;
    }
    _hfStart() {
      if (!this._hfSupported() || !this._hfEnabled() || this._vo) return;
      if (this._hfMate()) {
        // app Android: escucha el equipo (MateWake); al oír «Mate» abre el asistente
        const M = window.MaeMate;
        if (M.listening) return;
        this._hf = { on: true, native: true };
        M.onWake = () => { if (this._hf && this._hf.native && !this._vo) { this._hf.on = false; this._mateTry = 0; this._voiceStart(); if (this._vo) this._vo.mate = true; } };
        M.onRestart = () => this._hfStart();
        M.start().catch((e) => { this._hf = null; this._hfMark(); if (!document.hidden) this._toast(`${ic('alert')} «Mate» no puede escuchar: ${esc((e && e.message) || e)}`); });
        this._hfMark();
        return;
      }
      if (this._hf && this._hf.on) return;
      const SR = this._speechRec();
      const hf = this._hf = { on: true, rec: new SR() };
      const rec = hf.rec;
      rec.lang = 'es-AR'; rec.continuous = true; rec.interimResults = true; rec.maxAlternatives = 1;
      rec.onresult = (e) => {
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const txt = e.results[i][0].transcript, cmd = MatterAIHomeCard.wakeSplit(txt);
          if (cmd === null) continue;
          if (!e.results[i].isFinal && cmd.length < 4) continue; // esperar a que termine la frase
          hf.on = false; try { rec.abort(); } catch (_) { /* ya terminó */ }
          this._hfMark();
          this._haptic('medium');
          if (cmd.length >= 4) { this._voiceStart(); if (this._vo) { this._vo.text = cmd; this._vo.final = true; this._voiceSend(cmd); } } else this._voiceStart();
          return;
        }
      };
      rec.onerror = (e) => {
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { hf.on = false; this._hfSet(false); this._toast(`${ic('alert')} Permití el micrófono para usar «Mate»`); }
      };
      rec.onend = () => { // el navegador corta cada tanto: se vuelve a escuchar
        if (this._hf === hf && hf.on) setTimeout(() => { if (this._hf === hf && hf.on && !this._vo && !(typeof document !== 'undefined' && document.hidden)) { try { rec.start(); } catch (_) { /* ya estaba */ } } }, 350);
      };
      try { rec.start(); } catch (_) { hf.on = false; }
      this._hfMark();
    }
    _hfStop() {
      const hf = this._hf; this._hf = null;
      if (hf && hf.native && window.MaeMate) { window.MaeMate.stop(); window.MaeMate.onWake = null; window.MaeMate.onRestart = null; }
      else if (hf) { hf.on = false; try { hf.rec.abort(); } catch (_) { /* ya terminó */ } }
      this._hfMark();
    }

    _voiceAutoClose(ms) { const vo = this._vo; clearTimeout(this._voT); this._voT = setTimeout(() => { if (this._vo === vo) this._voiceStop(true); }, ms); }
    _voiceStop(close) {
      const vo = this._vo; clearTimeout(this._voT);
      if (vo && vo.rec) { try { vo.rec.abort(); } catch (_) { /* ya terminó */ } }
      if (vo && vo.cleanup) vo.cleanup();
      if (close) {
        this._vo = null;
        try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (_) { /* sin voz */ }
        if (this._els.vowrap) this._els.vowrap.classList.remove('open');
        if (this._hfEnabled()) setTimeout(() => this._hfStart(), 700);
      }
    }
    _voiceRender(open) {
      const el = this._els.vowrap, vo = this._vo; if (!el || !vo) return;
      const label = { listening: 'Te escucho…', thinking: 'Dale, ya va…', done: '', error: '' }[vo.state];
      const ok = (vo.actions || []).filter((a) => a.ok).length;
      el.innerHTML = `<div class="backdrop" data-action="voiceclose"></div><div class="vo ${vo.state}">
        <button class="vo-orb" data-action="${vo.state === 'listening' || vo.state === 'error' ? 'voice' : 'voiceclose'}" aria-label="${vo.state === 'listening' ? 'Terminar' : vo.state === 'error' ? 'Probar de nuevo' : 'Cerrar'}"><i></i><i></i><i></i>${ic(vo.state === 'done' ? 'check' : vo.state === 'error' ? 'alert' : 'mic')}</button>
        ${label ? `<div class="vo-l">${label}</div>` : ''}
        <div class="vo-t">${vo.text ? `“${esc(vo.text)}”` : vo.state === 'listening' ? `<span>Por ejemplo: <b>prendé la luz del living</b> o <b>poné música en el quincho</b>${vo.mode === 'rec' ? '<br>Cuando terminás de hablar se corta solo (o tocá el círculo).' : ''}</span>` : ''}</div>
        ${vo.say && vo.state !== 'listening' && vo.state !== 'thinking' ? `<div class="vo-s">${esc(vo.say)}</div>` : ''}
        ${vo.state === 'error' && vo.why ? `<div class="vo-why">${esc(vo.why)}</div>` : ''}
        ${vo.state === 'error' && vo.go ? `<a class="vo-go" href="${esc(vo.go)}" target="_self">${ic('mic')} Abrir con micrófono</a>` : ''}
        ${vo.state === 'error' ? `<div class="vo-retry">Tocá el círculo para probar de nuevo</div>` : ''}
        ${vo.state === 'done' && ok ? `<div class="vo-a">${ic('sparkle')} ${ok} ${ok === 1 ? 'acción' : 'acciones'}</div>` : ''}
        ${this._hfSupported() ? (this._mateDl != null ? `<button class="vo-hf dl" disabled>${ic('mic')} Bajando la voz de Mate… ${this._mateDl}% <small>(unos 40 MB, una sola vez)</small></button>`
          : `<button class="vo-hf ${this._hfEnabled() ? 'on' : ''}" data-action="handsfree">${ic('mic')} ${this._hfEnabled() ? '«Mate» escuchando en este equipo · apagar' : 'Activar «Mate» en este equipo (decís «Mate» y pedís, sin tocar)'}</button>`) : ''}
      </div>`;
      if (open) el.classList.add('open');
    }

    /* ---------- Música: experiencia tipo Spotify (Music Assistant por detrás) ---------- */
    /** Parlantes: los de Music Assistant; si no hay, todos los reproductores. */
    _musPlayers() {
      const S = this._hass.states, reg = this._hass.entities || {};
      const ok = (id) => S[id].state !== 'unavailable' && !(reg[id] && (reg[id].hidden || reg[id].entity_category));
      const all = Object.keys(S).filter((id) => id.startsWith('media_player.') && ok(id));
      const ma = all.filter((id) => reg[id] && reg[id].platform === 'music_assistant');
      return (this._config.music && Array.isArray(this._config.music.players)) ? this._config.music.players.filter((id) => S[id]) : ma.length ? ma : all;
    }
    /** Integración de Music Assistant (se saca del dispositivo de un parlante: no hace falta ser admin). */
    _musEntry() {
      const c = this._config.music || {};
      if (c.config_entry_id) return c.config_entry_id;
      if (!(this._hass.services || {}).music_assistant) return null;
      const reg = this._hass.entities || {}, devs = this._hass.devices || {};
      for (const id of this._musPlayers()) {
        const e = reg[id], d = e && devs[e.device_id];
        if (d && Array.isArray(d.config_entries) && d.config_entries.length) return d.config_entries[0];
      }
      return null;
    }
    /** Servicio de Music Assistant con respuesta. withEntry: los de biblioteca piden la integración; get_queue / transfer no. */
    _ma(service, data, withEntry = true) {
      const sd = Object.assign(withEntry ? { config_entry_id: this._mus.entry } : {}, data || {});
      return this._hass.callWS({ type: 'call_service', domain: 'music_assistant', service, return_response: true, service_data: sd })
        .then((r) => (r && (r.response || r)) || {});
    }

    /* ---------- para el inicio de la app (tarjeta en modo headless) ---------- */
    model() { if (!this._m && this._hass && this._root) this._m = this._model(); return this._m; }
    suggestions() { return this._sugs || []; }
    runSuggestion(key) { this._runSuggestion(key); }
    dismissSuggestion(key) { this._dismissed.add(key); this._schedule(); }
    openRoom(id) { this._openRoom(id); }
    openPanel(kind) { this._openPanel(kind); }
    alarm(svc, eid) { this._alarm(svc, eid); }
    access(eid) { this._access(eid); }
    roomLights(id, on) { this._roomLights(this._m && this._m.byId[id], on); }
    call(domain, service, data) { return this._call(domain, service, data); }
    moreInfo(eid) { this._moreInfo(eid); }
    voiceAvailable() { return this._voiceAvailable(); }
    voice() { this._voiceStart(); }
    players() { return this._musPlayers(); }
    /** Para el motor de dashboards: el visor de Frigate (Advanced Camera Card) con estas cámaras, en vivo.
     *  Devuelve null si todavía no cargó (la pide y avisa con whenDefined) o si no se puede armar. */
    liveCam(ids) {
      const TAG = 'advanced-camera-card';
      if (!ids || !ids.length || typeof customElements === 'undefined') return null;
      if (!customElements.get(TAG)) { this._ensureCamCard(); return null; }
      const base = this._config.camera_card || {}, known = base.cameras || [];
      let cfg = Object.assign({}, base, { cameras: ids.map((id) => known.find((k) => k && k.camera_entity === id) || { camera_entity: id }) });
      if (typeof window.__maeAdaptCamera === 'function') cfg = window.__maeAdaptCamera(cfg); // app: modo de video que anda fuera de HA
      // en el dashboard el recuadro manda (16:9): el visor lo llena entero y el video lo cubre. Si no, en la tablet
      // (que escala la pantalla) el visor queda un par de píxeles más bajo y se ve una línea negra abajo.
      cfg.dimensions = Object.assign({}, cfg.dimensions, { aspect_ratio_mode: 'unconstrained', height: '100%' });
      cfg.cameras = cfg.cameras.map((c) => { const d = c.dimensions || {}, L = d.layout || {};
        return Object.assign({}, c, { dimensions: Object.assign({}, d, { layout: Object.assign({ fit: 'cover' }, L) }) }); });
      const el = document.createElement(TAG);
      try { el.setConfig(Object.assign(cfg, { type: `custom:${TAG}` })); } catch (_) { return null; }
      el.hass = this._hass;
      return el;
    }
    openCameras() {
      const ev = new CustomEvent('matterai-camera-card', { detail: { config: this._config.camera_card }, bubbles: true, composed: true, cancelable: true });
      if (this.dispatchEvent(ev) && this._m && this._m.cams[0]) this._moreInfo(this._m.cams[0]);
    }

    openMusic(opts) {
      if (!this._root || !this._m) return;
      const players = this._musPlayers();
      let saved = null; try { saved = localStorage.getItem('matterai.music.player'); } catch (_) { /* sin almacenamiento */ }
      const st = (id) => this._hass.states[id].state;
      const playing = players.find((id) => st(id) === 'playing') || players.find((id) => st(id) === 'paused');
      this._mus = {
        player: (opts && opts.player) || playing || (players.includes(saved) ? saved : players[0] || null),
        page: 'home', stack: [], q: '', filter: 'all', libTab: 'playlist', lib: {}, home: null, res: null,
        full: false, sheet: null, menu: null, ctx: null, colors: {}, queue: null, added: [], lists: {}, entry: this._musEntry(),
      };
      const el = this._els.mus;
      const c = this._config, logo = c.logo ? `<img src="${esc(this._url(c.logo))}" alt="">` : esc((c.installer || 'M').charAt(0));
      // En PC: barra de arriba con buscador siempre a mano y lo que suena debajo (en el celular se usan el mini y la barra de abajo)
      const top = `<span class="mu-logo">${logo}</span><div class="mu-tt"><small>${esc(c.installer || 'MatterAI')}</small><b>Música</b></div><nav class="mu-tabs" id="mutabs"></nav>
        <label class="mu-tq">${ic('search')}<input id="muqtop" type="search" placeholder="¿Qué querés escuchar?" autocomplete="off"><button class="mt-x sm hide" data-action="m_clear" aria-label="Borrar">${ic('x')}</button></label>
        <button class="mt-x" data-action="m_sheet" data-v="devices" aria-label="Parlantes">${ic('speaker')}</button><button class="mt-x" data-action="musclose" aria-label="Cerrar">${ic('x')}</button>`;
      el.innerHTML = `<div class="mu-top" id="mutop"></div><div class="mu-now" id="munow"></div><div class="mu-main" id="mumain"></div><div class="mu-mini" id="mumini"></div><nav class="mu-nav" id="munav"></nav><div class="mu-full" id="mufull"></div><div class="mu-sheet" id="musheet"></div>`;
      ['mutop', 'munow', 'mumain', 'mumini', 'munav', 'mufull', 'musheet'].forEach((k) => { this._els[k] = el.querySelector(`#${k}`); delete this._cache[k]; });
      this._els.mutop.innerHTML = top; // fija: no se redibuja (así no se pierde lo que escribís en el buscador)
      this._els.mutabs = this._els.mutop.querySelector ? this._els.mutop.querySelector('#mutabs') : null; delete this._cache.mutabs;
      this._els.muswrap.classList.add('open');
      this._muAll();
      this._muLoadHome();
      clearInterval(this._musT);
      this._musT = setInterval(() => this._musTick(), 1000);
      this._haptic('light');
    }
    _closeMusic() {
      if (!this._mus) return;
      this._mus = null; clearInterval(this._musT); clearTimeout(this._musQT);
      this._els.muswrap.classList.remove('open');
    }

    _muAll() { ['mumain', 'munow', 'mumini', 'munav', 'mufull', 'musheet'].forEach((p) => this._muR(p)); }
    /** Partes que cambian con lo que suena (se redibujan con cada actualización de HA). */
    _muLive() { this._muR('munow'); this._muR('mumini'); this._muR('mufull'); if (this._mus && (this._mus.sheet === 'devices' || this._mus.sheet === 'queue')) this._muR('musheet'); }
    _muR(part) {
      const u = this._mus; if (!u || !this._els[part]) return;
      if ((part === 'mufull' || part === 'musheet' || part === 'munow') && this._musDrag) return; // arrastrando volumen o posición
      if (part === 'mumain') return this._muMainRender();
      if (part === 'munav' && this._els.mutabs) this._muR('mutabs');
      const html = part === 'mumini' ? this._hMuMini() : part === 'munav' ? this._hMuNav() : part === 'mutabs' ? this._hMuTabs() : part === 'munow' ? this._hMuNow() : part === 'mufull' ? this._hMuFull() : this._hMuSheet();
      this._set(part, html);
      if (part === 'mufull') this._els.mufull.classList.toggle('open', !!u.full);
      if (part === 'musheet') this._els.musheet.classList.toggle('open', !!u.sheet);
    }

    /* ---- utilidades ---- */
    _muSt() {
      const u = this._mus, real = u && u.player && this._hass.states[u.player];
      // respuesta al instante: lo que se tocó (play/pausa, aleatorio, repetir, silencio) se ve ya, sin esperar a Music Assistant;
      // cuando llega el estado de verdad (o pasan 4 s) manda el estado real
      const o = this._musOpt;
      if (!real || !o || o.player !== u.player) return real;
      const done = Date.now() > o.until || (o.state && real.state === o.state && real.last_updated !== o.from) ||
        (o.attrs && Object.keys(o.attrs).every((k) => real.attributes[k] === o.attrs[k]));
      if (done) { this._musOpt = null; return real; }
      return Object.assign({}, real, { state: o.state || real.state, attributes: Object.assign({}, real.attributes, o.attrs || {}) });
    }
    _musPos(st) {
      const a = st.attributes;
      if (a.media_position == null) return null;
      let p = a.media_position;
      if (st.state === 'playing' && a.media_position_updated_at) p += (Date.now() - Date.parse(a.media_position_updated_at)) / 1000;
      return a.media_duration ? Math.min(p, a.media_duration) : p;
    }
    _musTick() {
      const u = this._mus, st = this._muSt(); if (!u || !st || this._musDrag) return;
      const pos = this._musPos(st), dur = st.attributes.media_duration;
      if (pos == null || !dur) return;
      const pct = `${(pos / dur * 100).toFixed(2)}%`;
      const mm = this._els.mumini && this._els.mumini.querySelector && this._els.mumini.querySelector('.mm-p');
      if (mm) mm.style.width = pct;
      ['mufull', 'munow'].forEach((k) => {
        const f = this._els[k] && this._els[k].querySelector && this._els[k].querySelector('[data-mseek]');
        if (f) { f.value = Math.round(pos); f.style.setProperty('--p', pct); const t0 = f.previousElementSibling; if (t0) t0.textContent = mmss(pos); }
      });
    }
    _musImg(it) {
      const img = it && (it.image || it.thumbnail || (it.album && it.album.image));
      return img ? this._url(img) : '';
    }
    _musSub(it, short) {
      const t = it.media_type;
      const arts = (it.artists || []).map((x) => x.name).filter(Boolean).join(', ');
      if (t === 'track') return short ? arts : [arts, it.album && it.album.name].filter(Boolean).join(' · ');
      if (t === 'album') return `Álbum${arts ? ` · ${arts}` : ''}`;
      if (t === 'playlist') return `Playlist${it.owner ? ` · ${it.owner}` : ''}`;
      if (t === 'artist') return 'Artista';
      if (t === 'radio') return 'Radio';
      return '';
    }
    /** Color de la tapa (como Spotify). Si la imagen no deja leerse, un color fijo según el nombre. */
    _muColor(url, seed) {
      const u = this._mus;
      const hash = (x) => { let h = 0; for (const ch of String(x || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return ['83,52,160', '29,120,84', '160,52,72', '40,86,160', '150,92,30', '20,110,120', '120,40,130', '70,90,40'][h % 8]; };
      if (!url) return hash(seed);
      if (u.colors[url]) return u.colors[url];
      if (u.colors[url] === undefined && typeof Image !== 'undefined' && typeof document !== 'undefined' && document.createElement) {
        u.colors[url] = null;
        const img = new Image();
        img.crossOrigin = 'anonymous';
        const done = (c) => { if (this._mus !== u) return; u.colors[url] = c; delete this._cache.mufull; this._muR('mufull'); this._muR('mumini'); if (u.stack.length) this._muMainRender(true); };
        img.onload = () => {
          try {
            const cv = document.createElement('canvas'); cv.width = cv.height = 12;
            const x = cv.getContext('2d'); x.drawImage(img, 0, 0, 12, 12);
            const d = x.getImageData(0, 0, 12, 12).data;
            let r = 0, g = 0, b = 0, n = 0;
            for (let i = 0; i < d.length; i += 4) { const w = 1 + (Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2])) / 24; r += d[i] * w; g += d[i + 1] * w; b += d[i + 2] * w; n += w; }
            const k = Math.min(1.2, 125 / Math.max(r / n, g / n, b / n, 1));
            done([r, g, b].map((v) => Math.round(Math.min(150, (v / n) * k))).join(','));
          } catch (_) { done(hash(url)); }
        };
        img.onerror = () => done(hash(url));
        img.src = url;
      }
      return hash(seed || url);
    }
    /** Guarda una lista para poder tocar sus ítems (reproducir desde ahí, menú ⋯). */
    _muList(key, items) { this._mus.lists[key] = items || []; return key; }
    _muItem(d) { const l = this._mus.lists[d.list]; return l && l[Number(d.i)]; }

    /* ---- piezas ---- */
    _muCard(it, list, i) {
      const img = this._musImg(it), round = it.media_type === 'artist';
      return `<div class="mc"><button class="mc-a ${round ? 'round' : ''}" data-action="m_open" data-list="${list}" data-i="${i}" ${img ? `style="background-image:url('${esc(img)}')"` : ''}>${img ? '' : ic('music')}</button>
        ${it.media_type !== 'artist' ? `<button class="mc-p" data-action="m_playitem" data-list="${list}" data-i="${i}" aria-label="Reproducir">${ic('play')}</button>` : ''}
        <b>${esc(it.name)}</b><small>${esc(this._musSub(it))}</small></div>`;
    }
    _muCarousel(title, items, key) {
      if (!items || !items.length) return '';
      const list = this._muList(key, items);
      return `<section class="mu-sec"><h3>${esc(title)}<span class="mu-arr"><button class="mt-x sm" data-action="m_scroll" data-v="-1" aria-label="Anterior">${ic('back')}</button><button class="mt-x sm r" data-action="m_scroll" data-v="1" aria-label="Siguiente">${ic('back')}</button></span></h3><div class="mcar">${items.map((it, i) => this._muCard(it, list, i)).join('')}</div></section>`;
    }
    _muTrack(it, list, i, opts) {
      const o = opts || {}, img = this._musImg(it), st = this._muSt();
      const now = st && st.attributes.media_title === it.name && (st.state === 'playing' || st.state === 'paused');
      return `<div class="mt ${now ? 'now' : ''}"><button class="mt-m" data-action="m_play" data-list="${list}" data-i="${i}">
          ${o.num ? `<span class="mt-n">${now && st.state === 'playing' ? '<span class="eq sm"><i></i><i></i><i></i></span>' : i + 1}</span>` : `<span class="mt-i ${it.media_type === 'artist' ? 'round' : ''}" ${img ? `style="background-image:url('${esc(img)}')"` : ''}>${img ? '' : ic('music')}</span>`}
          <span class="mt-t"><b>${esc(it.name)}</b><small>${o.type ? `${esc(({ track: 'Canción', artist: 'Artista', album: 'Álbum', playlist: 'Playlist', radio: 'Radio' })[it.media_type] || '')} · ` : ''}${esc(this._musSub(it, true))}</small></span></button>
        <button class="mt-x" data-action="m_menu" data-list="${list}" data-i="${i}" aria-label="Más opciones">${ic('dots')}</button></div>`;
    }
    _muTracks(title, items, key, opts) {
      if (!items || !items.length) return '';
      const list = this._muList(key, items);
      return `<section class="mu-sec">${title ? `<h3>${esc(title)}</h3>` : ''}${items.map((it, i) => this._muTrack(it, list, i, opts)).join('')}</section>`;
    }
    _muRow(it, list, i) { // fila de biblioteca (playlist, artista, álbum, radio)
      const img = this._musImg(it);
      return `<button class="ml" data-action="${it.media_type === 'track' || it.media_type === 'radio' ? 'm_play' : 'm_open'}" data-list="${list}" data-i="${i}">
        <span class="ml-i ${it.media_type === 'artist' ? 'round' : ''}" ${img ? `style="background-image:url('${esc(img)}')"` : ''}>${img ? '' : ic('music')}</span>
        <span class="mt-t"><b>${esc(it.name)}</b><small>${esc(this._musSub(it))}</small></span></button>`;
    }

    /* ---- páginas ---- */
    _muMainRender(force) {
      const u = this._mus, el = this._els.mumain;
      if (u.stack.length) { const html = this._hMuDetail(u.stack[u.stack.length - 1]); if (force || this._cache.mumain !== html) { this._cache.mumain = html; el.innerHTML = html; } return; }
      if (u.page === 'search') {
        // la barra queda fija; sólo cambian los filtros y los resultados (no se pierde lo que escribís)
        if (u.mainKey !== 'search' || !el.querySelector || !el.querySelector('#muq')) {
          u.mainKey = 'search'; delete this._cache.mumain;
          el.innerHTML = `<div class="mu-head"><h2>Buscar</h2></div><div class="mu-search">${ic('search')}<input id="muq" type="search" placeholder="¿Qué querés escuchar?" value="${esc(u.q)}" autocomplete="off">
            <button class="mt-x ${u.q ? '' : 'hide'}" data-action="m_clear" aria-label="Borrar">${ic('x')}</button></div><div id="muchips"></div><div id="mures"></div>`;
          this._els.muchips = el.querySelector ? el.querySelector('#muchips') : { innerHTML: '' };
          this._els.mures = el.querySelector ? el.querySelector('#mures') : { innerHTML: '' };
          delete this._cache.muchips; delete this._cache.mures;
        }
        this._set('muchips', this._hMuChips());
        this._set('mures', this._hMuResults());
        return;
      }
      u.mainKey = u.page;
      const html = u.page === 'lib' ? this._hMuLib() : this._hMuHome();
      if (force || this._cache.mumain !== html) { this._cache.mumain = html; el.innerHTML = html; }
    }

    _hMuHome() {
      const u = this._mus, hr = new Date().getHours();
      const hello = hr >= 5 && hr < 12 ? 'Buen día' : hr >= 12 && hr < 20 ? 'Buenas tardes' : 'Buenas noches';
      const c = this._config, logo = c.logo ? `<img src="${esc(this._url(c.logo))}" alt="">` : esc((c.installer || 'M').charAt(0));
      let h = `<div class="mu-head"><span class="mu-logo">${logo}</span><div class="mu-hi"><small>${esc(c.installer || 'MatterAI')} · Música</small><h2>${hello}</h2></div><button class="mt-x" data-action="m_sheet" data-v="devices" aria-label="Parlantes">${ic('speaker')}</button>
        <button class="mt-x" data-action="musclose" aria-label="Cerrar">${ic('x')}</button></div>`;
      if (!u.entry) return h + '<div class="pempty">Para elegir música (Spotify, playlists, radios…) hace falta <b>Music Assistant</b> en Home Assistant. Igual podés controlar lo que está sonando con el reproductor de abajo.</div>';
      const L = u.home;
      if (!L || L.loading) return h + '<div class="pempty">Cargando tu música…</div>';
      if (L.err) return h + `<div class="pempty">No se pudo leer tu biblioteca de Music Assistant.<br><small>${esc(L.err)}</small></div>`;
      const quick = [...(L.playlists || []).slice(0, 4), ...(L.albums || []).slice(0, 4)].slice(0, 6);
      if (quick.length) {
        const ql = this._muList('quick', quick);
        h += `<div class="mq">${quick.map((it, i) => { const img = this._musImg(it); return `<button class="mq-i" data-action="m_open" data-list="${ql}" data-i="${i}">
          <span ${img ? `style="background-image:url('${esc(img)}')"` : ''}>${img ? '' : ic('music')}</span><b>${esc(it.name)}</b></button>`; }).join('')}</div>`;
      }
      h += this._muCarousel('Escuchado recientemente', L.albums, 'h_alb') + this._muCarousel('Tus playlists', L.playlists, 'h_pl')
        + this._muCarousel('Tus artistas', L.artists, 'h_art') + this._muCarousel('Radios', L.radio, 'h_radio');
      if (!quick.length && !(L.artists || []).length && !(L.radio || []).length) h += '<div class="pempty">Tu biblioteca está vacía. Agregá tu cuenta de Spotify (u otra) en Music Assistant.</div>';
      return h;
    }

    _hMuChips() {
      const u = this._mus;
      if (!u.q.trim()) return '';
      const F = [['all', 'Todo'], ['track', 'Canciones'], ['artist', 'Artistas'], ['album', 'Álbumes'], ['playlist', 'Playlists'], ['radio', 'Radio']];
      return `<div class="mchips">${F.map(([k, l]) => `<button class="${u.filter === k ? 'on' : ''}" data-action="m_filter" data-v="${k}">${l}</button>`).join('')}</div>`;
    }
    _hMuResults() {
      const u = this._mus;
      if (!u.entry) return '<div class="pempty">Para buscar música hace falta Music Assistant.</div>';
      if (!u.q.trim()) {
        const T = [['playlist', 'Playlists', '#8d67ab'], ['artist', 'Artistas', '#e8115b'], ['album', 'Álbumes', '#1e3264'], ['track', 'Canciones', '#148a08'], ['radio', 'Radio', '#e13300'], ['home', 'Para vos', '#477d95']];
        return `<section class="mu-sec"><h3>Explorar todo</h3><div class="mexp">${T.map(([k, l, c]) => `<button style="background:${c}" data-action="m_explore" data-v="${k}"><b>${l}</b>${ic(k === 'artist' ? 'user' : k === 'radio' ? 'vol' : 'music')}</button>`).join('')}</div></section>`;
      }
      const r = u.res;
      if (!r) return '<div class="pempty">Buscando…</div>';
      if (r.err) return `<div class="pempty">${esc(r.err)}</div>`;
      const K = { track: 'tracks', artist: 'artists', album: 'albums', playlist: 'playlists', radio: 'radio' };
      if (u.filter !== 'all') {
        const items = r[K[u.filter]] || [];
        if (!items.length) return `<div class="pempty">No encontré nada con “${esc(u.q)}”.</div>`;
        if (u.filter === 'track') return this._muTracks('', items, 'r_one');
        const l = this._muList('r_one', items);
        return `<section class="mu-sec">${items.map((it, i) => this._muRow(it, l, i)).join('')}</section>`;
      }
      const top = (r.artists || [])[0] || (r.playlists || [])[0] || (r.albums || [])[0] || (r.tracks || [])[0];
      if (!top) return `<div class="pempty">No encontré nada con “${esc(u.q)}”.</div>`;
      const tl = this._muList('r_top', [top]), timg = this._musImg(top);
      let h = `<div class="mres-top"><section class="mu-sec"><h3>Resultado principal</h3>
        <div class="mtop"><button class="mtop-a" data-action="m_open" data-list="${tl}" data-i="0"><span class="${top.media_type === 'artist' ? 'round' : ''}" ${timg ? `style="background-image:url('${esc(timg)}')"` : ''}>${timg ? '' : ic('music')}</span>
          <b>${esc(top.name)}</b><small>${esc(this._musSub(top))}</small></button>
          <button class="mc-p show" data-action="m_playitem" data-list="${tl}" data-i="0" aria-label="Reproducir">${ic('play')}</button></div></section>
        ${this._muTracks('Canciones', (r.tracks || []).slice(0, 4), 'r_tr')}</div>`;
      h += this._muCarousel('Artistas', r.artists, 'r_art') + this._muCarousel('Álbumes', r.albums, 'r_alb') + this._muCarousel('Playlists', r.playlists, 'r_pl') + this._muCarousel('Radio', r.radio, 'r_ra');
      return h;
    }

    _hMuLib() {
      const u = this._mus;
      const T = [['playlist', 'Playlists'], ['artist', 'Artistas'], ['album', 'Álbumes'], ['track', 'Canciones'], ['radio', 'Radio']];
      let h = `<div class="mu-head"><h2>Tu biblioteca</h2><button class="mt-x" data-action="m_page" data-v="search" aria-label="Buscar">${ic('search')}</button></div>
        <div class="mchips">${T.map(([k, l]) => `<button class="${u.libTab === k ? 'on' : ''}" data-action="m_libtab" data-v="${k}">${l}</button>`).join('')}</div>`;
      if (!u.entry) return h + '<div class="pempty">Hace falta Music Assistant.</div>';
      const L = u.lib[u.libTab];
      if (!L || L.loading) return h + '<div class="pempty">Cargando…</div>';
      if (L.err) return h + `<div class="pempty">${esc(L.err)}</div>`;
      if (!L.items.length) return h + '<div class="pempty">No hay nada acá todavía.</div>';
      if (u.libTab === 'track') return h + this._muTracks('', L.items, 'lib_tr');
      const l = this._muList('lib', L.items);
      return h + `<section class="mu-sec">${L.items.map((it, i) => this._muRow(it, l, i)).join('')}</section>`;
    }

    _hMuDetail(top) {
      const img = top.img || '', col = this._muColor(img, top.name);
      const kind = ({ album: 'Álbum', playlist: 'Playlist', artist: 'Artista' })[top.type] || '';
      const tracks = (top.items || []).filter((x) => x.media_type === 'track');
      const albums = (top.items || []).filter((x) => x.media_type === 'album' || x.media_type === 'playlist');
      const st = this._muSt(), u = this._mus;
      const playingHere = u.ctx && u.ctx.uri === top.uri && st && st.state === 'playing';
      let h = `<div class="md" style="--mc:${col}"><div class="md-top"><button class="mt-x" data-action="m_back" aria-label="Volver">${ic('back')}</button></div>
        <div class="md-a ${top.type === 'artist' ? 'round' : ''}" ${img ? `style="background-image:url('${esc(img)}')"` : ''}>${img ? '' : ic('music')}</div>
        <h2>${esc(top.name)}</h2><small>${esc(kind)}${top.sub ? ` · ${esc(top.sub)}` : ''}${tracks.length && top.type !== 'artist' ? ` · ${tracks.length} canciones` : ''}</small>
        <div class="md-act"><button class="mt-x ${u.shuffleNext ? 'on' : ''}" data-action="m_shufnext" aria-label="Aleatorio">${ic('shuffle')}</button>
          <button class="md-play" data-action="${playingHere ? 'm_ctl' : 'm_playtop'}" data-v="media_play_pause" aria-label="Reproducir">${ic(playingHere ? 'pause' : 'play')}</button></div></div>`;
      if (top.loading) return h + '<div class="pempty">Cargando…</div>';
      if (top.err) return h + `<div class="pempty">${esc(top.err)}</div>`;
      if (top.type === 'artist') {
        h += this._muTracks('Populares', tracks.slice(0, 10), 'd_tr', { num: true }) + this._muCarousel('Discografía', albums, 'd_alb');
      } else {
        h += this._muTracks('', tracks, 'd_tr', { num: top.type === 'album' });
        h += this._muCarousel('Más', albums, 'd_alb');
      }
      return h + ((top.items || []).length ? '' : '<div class="pempty">No hay canciones para mostrar.</div>');
    }

    /* ---- mini reproductor, barra inferior, reproductor completo ---- */
    _hMuMini() {
      const u = this._mus, st = this._muSt();
      if (!st) return '';
      const a = st.attributes, img = a.entity_picture ? this._url(a.entity_picture) : '', col = this._muColor(img, a.media_title);
      const has = !!a.media_title, playing = st.state === 'playing';
      const pos = this._musPos(st), dur = a.media_duration;
      return `<div class="mm" style="--mc:${col}" data-action="m_full">
        <span class="mm-a" ${img ? `style="background-image:url('${esc(img)}')"` : ''}>${img ? '' : ic('music')}</span>
        <span class="mm-t"><b>${esc(has ? a.media_title : 'Elegí qué escuchar')}</b>
          <small class="${playing ? 'g' : ''}">${playing || !has ? `${ic('speaker')}${esc(this._label(u.player))}` : esc(a.media_artist || '')}</small></span>
        <button class="mt-x" data-action="m_sheet" data-v="devices" aria-label="Parlantes">${ic('speaker')}</button>
        <button class="mt-x big" data-action="m_ctl" data-v="media_play_pause" aria-label="${playing ? 'Pausa' : 'Reproducir'}">${ic(playing ? 'pause' : 'play')}</button>
        ${dur && pos != null ? `<i class="mm-p" style="width:${(pos / dur * 100).toFixed(2)}%"></i>` : ''}</div>`;
    }
    _hMuTabs() {
      const u = this._mus, p = u.stack.length ? '' : u.page;
      const b = (k, icon, l) => `<button class="${p === k ? 'on' : ''}" data-action="m_page" data-v="${k}">${ic(icon)}<span>${l}</span></button>`;
      return b('home', 'home', 'Inicio') + b('lib', 'library', 'Tu biblioteca');
    }
    /** Lo que suena, arriba (PC): tapa, canción, controles, barra de tiempo, parlante, volumen, cola y ⋯. */
    _hMuNow() {
      const u = this._mus, st = this._muSt();
      if (!st) return '';
      const a = st.attributes, f = a.supported_features || 0, img = a.entity_picture ? this._url(a.entity_picture) : '';
      const col = this._muColor(img, a.media_title), playing = st.state === 'playing', has = !!a.media_title;
      const pos = this._musPos(st), dur = a.media_duration, vol = a.volume_level != null ? Math.round(a.volume_level * 100) : null;
      const b = (svc, icon, label, cls) => `<button class="mf-b ${cls || ''}" data-action="m_ctl" data-v="${svc}" aria-label="${label}">${ic(icon)}</button>`;
      return `<div class="mn" style="--mc:${col}">
        <button class="mn-a" data-action="m_full" ${img ? `style="background-image:url('${esc(img)}')"` : ''} aria-label="Ver en grande">${img ? '' : ic('music')}</button>
        <button class="mn-t" data-action="m_full"><b>${esc(has ? a.media_title : 'Nada sonando')}</b><small>${has ? esc(a.media_artist || '') : `${ic('speaker')}${esc(this._label(u.player))}`}</small></button>
        <div class="mn-c"><div class="mn-b">
          ${b('shuffle', 'shuffle', 'Aleatorio', `sm ${a.shuffle ? 'on' : ''}`)}${b('media_previous_track', 'prev', 'Anterior')}
          ${b('media_play_pause', playing ? 'pause' : 'play', playing ? 'Pausa' : 'Reproducir', 'main')}
          ${b('media_next_track', 'next', 'Siguiente')}${b('repeat', 'repeat', 'Repetir', `sm ${a.repeat && a.repeat !== 'off' ? 'on' : ''} ${a.repeat === 'one' ? 'one' : ''}`)}</div>
          <div class="mp-seek"><span class="mp-t0">${mmss(pos || 0)}</span>
            <input type="range" min="0" max="${Math.round(dur || 1)}" value="${Math.round(pos || 0)}" data-mseek="1" style="--p:${dur ? ((pos || 0) / dur * 100).toFixed(2) : 0}%" aria-label="Posición" ${dur && f & 2 ? '' : 'disabled'}>
            <span>${dur ? mmss(dur) : '–:––'}</span></div></div>
        <div class="mn-r">
          <div class="mn-r1"><button class="mf-dev" data-action="m_sheet" data-v="devices" title="Elegir parlante: ${esc(this._label(u.player))}">${ic('speaker')}<span>${esc(this._label(u.player))}</span></button>
            <button class="mt-x sm" data-action="m_sheet" data-v="queue" aria-label="Cola" title="Cola">${ic('queue')}</button>
            <button class="mt-x sm" data-action="m_nowmenu" aria-label="Más opciones" ${has ? '' : 'disabled'}>${ic('dots')}</button></div>
          ${vol != null ? `<div class="mvol big"><button class="mt-x sm" data-action="m_ctl" data-v="mute" aria-label="Silenciar">${ic(a.is_volume_muted ? 'mute' : 'vol')}</button>
            <input type="range" min="0" max="100" value="${vol}" data-mvol="${u.player}" style="--p:${vol}%" aria-label="Volumen"><span class="mv-p">${a.is_volume_muted ? '—' : `${vol}%`}</span></div>` : ''}</div></div>`;
    }
    _hMuNav() {
      const u = this._mus, p = u.stack.length ? '' : u.page;
      const b = (k, icon, l) => `<button class="${p === k ? 'on' : ''}" data-action="m_page" data-v="${k}">${ic(icon)}<span>${l}</span></button>`;
      return b('home', 'home', 'Inicio') + b('search', 'search', 'Buscar') + b('lib', 'library', 'Tu biblioteca');
    }
    _hMuFull() {
      const u = this._mus, st = this._muSt();
      if (!u.full || !st) return '';
      const a = st.attributes, f = a.supported_features || 0, img = a.entity_picture ? this._url(a.entity_picture) : '';
      const col = this._muColor(img, a.media_title), playing = st.state === 'playing';
      const pos = this._musPos(st), dur = a.media_duration, vol = a.volume_level != null ? Math.round(a.volume_level * 100) : null;
      const ctx = u.ctx;
      const b = (svc, icon, label, cls) => `<button class="mf-b ${cls || ''}" data-action="m_ctl" data-v="${svc}" aria-label="${label}">${ic(icon)}</button>`;
      return `<div class="mf" style="--mc:${col}"><div class="mf-sw"></div>
        <div class="mf-top"><button class="mt-x" data-action="m_full0" aria-label="Cerrar">${ic('down')}</button>
          <div><small>${ctx ? `Reproduciendo desde ${esc(({ playlist: 'playlist', album: 'álbum', artist: 'artista', radio: 'radio', search: 'la búsqueda' })[ctx.type] || 'tu música')}` : 'Reproduciendo en'}</small>
          <b>${esc(ctx ? ctx.name : this._label(u.player))}</b></div>
          <button class="mt-x" data-action="m_nowmenu" aria-label="Más opciones" ${a.media_title ? '' : 'disabled'}>${ic('dots')}</button></div>
        <div class="mf-art ${playing ? 'pl' : ''}" ${img ? `style="background-image:url('${esc(img)}')"` : ''}>${img ? '' : ic('music')}</div>
        <div class="mf-info"><div class="mf-t"><b>${esc(a.media_title || 'Nada sonando')}</b><span>${esc(a.media_artist || (a.media_title ? '' : 'Elegí algo para escuchar'))}</span></div>
        <div class="mp-seek"><span class="mp-t0">${mmss(pos || 0)}</span>
          <input type="range" min="0" max="${Math.round(dur || 1)}" value="${Math.round(pos || 0)}" data-mseek="1" style="--p:${dur ? ((pos || 0) / dur * 100).toFixed(2) : 0}%" aria-label="Posición" ${dur && f & 2 ? '' : 'disabled'}>
          <span>${dur ? mmss(dur) : '–:––'}</span></div>
        <div class="mf-ctl">
          ${b('shuffle', 'shuffle', 'Aleatorio', `sm ${a.shuffle ? 'on' : ''}`)}
          ${b('media_previous_track', 'prev', 'Anterior')}
          ${b('media_play_pause', playing ? 'pause' : 'play', playing ? 'Pausa' : 'Reproducir', 'main')}
          ${b('media_next_track', 'next', 'Siguiente')}
          ${b('repeat', 'repeat', 'Repetir', `sm ${a.repeat && a.repeat !== 'off' ? 'on' : ''} ${a.repeat === 'one' ? 'one' : ''}`)}</div></div>
        <div class="mf-bot">
          <button class="mf-dev" data-action="m_sheet" data-v="devices">${ic('speaker')}<span>${esc(this._label(u.player))}</span></button>
          ${vol != null ? `<div class="mvol"><button class="mt-x sm" data-action="m_ctl" data-v="mute" aria-label="Silenciar">${ic(a.is_volume_muted ? 'mute' : 'vol')}</button>
            <input type="range" min="0" max="100" value="${vol}" data-mvol="${u.player}" style="--p:${vol}%" aria-label="Volumen"></div>` : ''}
          <button class="mt-x" data-action="m_sheet" data-v="queue" aria-label="Cola">${ic('queue')}</button></div></div>`;
    }

    /* ---- hojas: parlantes, cola, menú de canción ---- */
    _hMuSheet() {
      const u = this._mus; if (!u.sheet) return '';
      const S = this._hass.states;
      let h = '<div class="ms-bg" data-action="m_sheet0"></div><div class="ms"><div class="grab"></div>';
      if (u.sheet === 'devices') {
        const cur = this._muSt(), group = (cur && cur.attributes.group_members) || [];
        const canJoin = cur && (cur.attributes.supported_features || 0) & 524288;
        const row = (id) => {
          const st = S[id], a = st.attributes, sel = id === u.player, inG = !sel && group.includes(id);
          const vol = a.volume_level != null ? Math.round(a.volume_level * 100) : null;
          return `<div class="msd ${sel ? 'sel' : ''}"><button class="msd-n" data-action="m_dev" data-eid="${id}">
              <span class="eq ${st.state === 'playing' ? '' : 'off'}">${st.state === 'playing' ? '<i></i><i></i><i></i>' : ic('speaker')}</span>
              <span><b>${esc(this._label(id))}</b><small>${esc(sel ? 'Este parlante' : st.state === 'playing' ? `Sonando: ${a.media_title || ''}` : inG ? 'Sonando junto' : 'Disponible')}</small></span></button>
            ${!sel && canJoin ? `<button class="hchip ${inG ? 'on' : ''}" data-action="m_group" data-eid="${id}">${inG ? 'Quitar' : 'Sumar'}</button>` : ''}
            ${vol != null ? `<div class="mvol">${ic('vol')}<input type="range" min="0" max="100" value="${vol}" data-mvol="${id}" style="--p:${vol}%" aria-label="Volumen"></div>` : ''}</div>`;
        };
        const others = this._musPlayers().filter((id) => id !== u.player);
        h += `<h3 class="ms-h">Escuchando en</h3>${u.player ? row(u.player) : ''}${others.length ? `<h3 class="ms-h">Elegí un parlante</h3><p class="hint2" style="margin:-4px 0 8px">Tocalo y la música pasa a ese parlante. "Sumar" lo hace sonar junto.</p>${others.map(row).join('')}` : ''}`;
      } else if (u.sheet === 'queue') {
        const st = this._muSt(), a = st ? st.attributes : {}, q = u.queue;
        const img = a.entity_picture ? this._url(a.entity_picture) : '';
        h += `<h3 class="ms-h">Cola</h3>`;
        if (a.media_title) h += `<h4 class="ms-s">Sonando ahora</h4><div class="mt now"><span class="mt-m"><span class="mt-i" ${img ? `style="background-image:url('${esc(img)}')"` : ''}></span><span class="mt-t"><b>${esc(a.media_title)}</b><small>${esc(a.media_artist || '')}</small></span></span></div>`;
        if (!q) h += '<div class="pempty sm">Cargando la cola…</div>';
        else if (q.err) h += `<p class="hint2">${esc(q.err)}</p>`;
        else {
          const nx = q.next_item;
          if (nx) {
            const it = nx.media_item || {}, nimg = this._musImg(it) || (nx.image && this._url(nx.image)) || '';
            h += `<h4 class="ms-s">A continuación</h4><div class="mt"><span class="mt-m"><span class="mt-i" ${nimg ? `style="background-image:url('${esc(nimg)}')"` : ''}></span>
              <span class="mt-t"><b>${esc(it.name || nx.name || '')}</b><small>${esc((it.artists || []).map((x) => x.name).join(', '))}</small></span><em>${nx.duration ? mmss(nx.duration) : ''}</em></span></div>`;
          }
          if (u.added.length) h += `<h4 class="ms-s">Agregaste</h4>${u.added.slice(-8).map((it) => `<div class="mt"><span class="mt-m"><span class="mt-i" ${this._musImg(it) ? `style="background-image:url('${esc(this._musImg(it))}')"` : ''}></span><span class="mt-t"><b>${esc(it.name)}</b><small>${esc(this._musSub(it, true))}</small></span></span></div>`).join('')}`;
          const left = q.items != null && q.current_index != null ? Math.max(0, q.items - q.current_index - 1) : null;
          if (q.items != null) h += `<p class="hint2">${q.items} ${q.items === 1 ? 'canción' : 'canciones'} en la cola${left != null ? ` · ${left === 0 ? 'es la última' : `${left === 1 ? 'falta 1' : `faltan ${left}`}`}` : ''}</p>`;
          if (!nx && !q.items) h += '<div class="pempty sm">La cola está vacía.</div>';
        }
        const f = (st && st.attributes.supported_features) || 0;
        h += `<div class="ms-row">${f & 32768 ? `<button class="hchip ${a.shuffle ? 'on' : ''}" data-action="m_ctl" data-v="shuffle">${ic('shuffle')} Aleatorio</button>` : ''}
          ${f & 262144 ? `<button class="hchip ${a.repeat && a.repeat !== 'off' ? 'on' : ''}" data-action="m_ctl" data-v="repeat">${ic('repeat')} ${a.repeat === 'one' ? 'Repetir una' : 'Repetir'}</button>` : ''}
          <button class="hchip" data-action="m_clearq">${ic('trash')} Vaciar cola</button></div>`;
      } else if (u.sheet === 'menu' && u.menu) {
        const it = u.menu, img = this._musImg(it);
        h += `<div class="mt"><span class="mt-m"><span class="mt-i ${it.media_type === 'artist' ? 'round' : ''}" ${img ? `style="background-image:url('${esc(img)}')"` : ''}></span><span class="mt-t"><b>${esc(it.name)}</b><small>${esc(this._musSub(it))}</small></span></span></div>
          <div class="mmenu">
            ${u.menuNow ? '' : `<button data-action="m_do" data-v="add">${ic('plus')}Agregar a la cola</button>
            <button data-action="m_do" data-v="next">${ic('next')}Reproducir a continuación</button>
            <button data-action="m_do" data-v="play">${ic('play')}Reproducir ahora</button>`}
            ${it.album && (it.album.uri || u.menuNow) && it.album.name ? `<button data-action="m_do" data-v="album">${ic('disc')}Ir al álbum</button>` : ''}
            ${it.artists && it.artists[0] && (it.artists[0].uri || u.menuNow) && it.artists[0].name ? `<button data-action="m_do" data-v="artist">${ic('user')}Ir al artista</button>` : ''}
            ${u.entry && it.uri && (it.media_type === 'track' || it.media_type === 'artist') ? `<button data-action="m_do" data-v="radio">${ic('vol')}Iniciar radio (canciones parecidas)</button>` : ''}
            ${u.menuNow ? `<button data-action="m_sheet" data-v="devices">${ic('speaker')}Elegir parlante</button>
            <button data-action="m_sheet" data-v="queue">${ic('queue')}Ver la cola</button>` : ''}
          </div>`;
      }
      return h + '</div>';
    }

    /* ---- datos ---- */
    _muLoadHome() {
      const u = this._mus; if (!u || !u.entry || u.home) return;
      const L = u.home = { loading: true };
      const lib = (media_type, extra) => this._ma('get_library', Object.assign({ media_type, limit: 20 }, extra)).then((r) => r.items || []);
      Promise.all([lib('playlist', { order_by: 'last_played_desc' }), lib('album', { order_by: 'last_played_desc', limit: 16 }),
        lib('artist', { order_by: 'last_played_desc', limit: 16 }).catch(() => []), lib('radio', { limit: 16 }).catch(() => [])])
        .then(([pl, al, ar, ra]) => Object.assign(L, { playlists: pl, albums: al, artists: ar, radio: ra }))
        .catch((e) => { L.err = e && e.message ? e.message : String(e); })
        .finally(() => { L.loading = false; if (this._mus === u) this._muMainRender(); });
    }
    _muLoadLib(tab) {
      const u = this._mus; if (!u || !u.entry || (u.lib[tab] && !u.lib[tab].err)) return;
      const L = u.lib[tab] = { loading: true, items: [] };
      this._ma('get_library', { media_type: tab, limit: 120, order_by: tab === 'playlist' || tab === 'album' ? 'last_played_desc' : 'sort_name' })
        .then((r) => { L.items = r.items || []; }, (e) => { L.err = e && e.message ? e.message : String(e); })
        .finally(() => { L.loading = false; if (this._mus === u && u.page === 'lib') this._muMainRender(); });
    }
    _muSearch(q) {
      const u = this._mus; if (!u) return;
      u.q = q; u.res = null;
      clearTimeout(this._musQT);
      this._muMainRender();
      if (!q.trim()) return;
      this._musQT = setTimeout(() => {
        const asked = q;
        this._ma('search', { name: q, limit: 12 }).then((r) => { if (this._mus === u && u.q === asked) { u.res = r; this._muMainRender(); } },
          (e) => { if (this._mus === u && u.q === asked) { u.res = { err: e && e.message ? e.message : String(e) }; this._muMainRender(); } });
      }, 300);
    }
    /** Entrar a un álbum, playlist o artista (navegador de medios de HA sobre Music Assistant). */
    _muOpen(it) {
      const u = this._mus; if (!u || !it) return;
      const node = { uri: it.uri, type: it.media_type, name: it.name, img: this._musImg(it), sub: it.media_type === 'album' ? (it.artists || []).map((x) => x.name).join(', ') : it.owner || '', loading: true, items: [] };
      u.stack.push(node); u.full = false; u.sheet = null;
      this._muMainRender(); this._muR('munav'); this._muR('mufull'); this._muR('musheet');
      if (this._els.mumain) this._els.mumain.scrollTop = 0;
      Promise.resolve(this._hass.callWS({ type: 'media_player/browse_media', entity_id: u.player, media_content_id: it.uri, media_content_type: it.media_type }))
        .then((res) => {
          node.items = ((res && res.children) || []).map((ch) => ({
            uri: ch.media_content_id, media_type: ({ music: 'track', track: 'track', album: 'album', playlist: 'playlist', artist: 'artist' })[ch.media_content_type] || (ch.can_expand ? 'album' : 'track'),
            name: ch.title, image: ch.thumbnail, artists: node.type === 'artist' ? [{ name: node.name, uri: node.uri }] : [], album: node.type === 'album' ? { name: node.name, uri: node.uri, image: node.img } : null,
          }));
        }, () => { node.err = 'No se pudo abrir. Igual podés reproducirlo con el botón verde.'; })
        .finally(() => { node.loading = false; if (this._mus === u) this._muMainRender(); });
    }
    _muQueue() {
      const u = this._mus; if (!u || !u.player) return;
      u.queue = null;
      if (!u.entry) { u.queue = { err: 'La cola necesita Music Assistant.' }; return; }
      this._ma('get_queue', { entity_id: u.player }, false).then((r) => { if (this._mus === u) u.queue = r[u.player] || Object.values(r)[0] || {}; },
        () => { if (this._mus === u) u.queue = { err: 'No se pudo leer la cola.' }; })
        .finally(() => { if (this._mus === u && u.sheet === 'queue') { delete this._cache.musheet; this._muR('musheet'); } });
    }

    /* ---- reproducir ---- */
    _muPlay(ids, type, enqueue, ctx, extra) {
      const u = this._mus; if (!u || !u.player) { this._toast(`${ic('alert')} Elegí un parlante`); return; }
      const list = [].concat(ids).filter(Boolean);
      if (!list.length) return;
      if (u.entry) this._call('music_assistant', 'play_media', Object.assign({ entity_id: u.player, media_id: list.length === 1 ? list[0] : list, media_type: type, enqueue: enqueue || 'replace' }, extra || {}));
      else this._call('media_player', 'play_media', { entity_id: u.player, media_content_id: list[0], media_content_type: type });
      if (!enqueue || enqueue === 'replace' || enqueue === 'play') { if (ctx) u.ctx = ctx; }
    }
    _musCtl(v) {
      const st = this._muSt(); if (!st) return;
      const a = st.attributes, E = { entity_id: this._mus.player };
      const opt = (state, attrs) => { this._musOpt = { player: this._mus.player, until: Date.now() + 4000, from: (this._hass.states[this._mus.player] || {}).last_updated, state, attrs }; this._muLive(); };
      if (v === 'media_play_pause') opt(st.state === 'playing' ? 'paused' : 'playing');
      else if (v === 'shuffle') opt(null, { shuffle: !a.shuffle });
      else if (v === 'repeat') opt(null, { repeat: ({ off: 'all', all: 'one', one: 'off' })[a.repeat || 'off'] || 'off' });
      else if (v === 'mute') opt(null, { is_volume_muted: !a.is_volume_muted });
      if (v === 'shuffle') return this._call('media_player', 'shuffle_set', Object.assign({ shuffle: !a.shuffle }, E));
      if (v === 'repeat') return this._call('media_player', 'repeat_set', Object.assign({ repeat: ({ off: 'all', all: 'one', one: 'off' })[a.repeat || 'off'] || 'off' }, E));
      if (v === 'mute') return this._call('media_player', 'volume_mute', Object.assign({ is_volume_muted: !a.is_volume_muted }, E));
      return this._call('media_player', v, E);
    }

    /* ---- acciones (data-action="m_…") ---- */
    _musAction(a, d, t) {
      const u = this._mus; if (!u) return;
      const it = d.list != null ? this._muItem(d) : null;
      switch (a) {
        case 'page':
          u.stack = []; u.page = d.v; u.full = false;
          if (d.v === 'lib') this._muLoadLib(u.libTab);
          this._muMainRender(); this._muR('munav'); this._muR('mufull');
          if (this._els.mumain) this._els.mumain.scrollTop = 0;
          if (d.v === 'search' && this._els.mumain.querySelector) { const q = this._els.mumain.querySelector('#muq'); if (q && !u.q) q.focus(); }
          break;
        case 'libtab': u.libTab = d.v; this._muLoadLib(d.v); this._muMainRender(); break;
        case 'explore': if (d.v === 'home') { u.page = 'home'; } else { u.page = 'lib'; u.libTab = d.v; this._muLoadLib(d.v); } this._muMainRender(); this._muR('munav'); break;
        case 'filter': u.filter = d.v; this._muMainRender(); break;
        case 'clear': {
          u.filter = 'all'; this._muSearch('');
          const qs = [this._els.mutop, this._els.mumain].map((e) => e && e.querySelector && e.querySelector(e === this._els.mutop ? '#muqtop' : '#muq')).filter(Boolean);
          qs.forEach((q) => { q.value = ''; const x = q.parentNode && q.parentNode.querySelector && q.parentNode.querySelector('[data-action="m_clear"]'); if (x) x.classList.add('hide'); });
          const vis = qs.find((q) => q.offsetParent); if (vis) vis.focus();
          break;
        }
        case 'open': this._muOpen(it); break;
        case 'back': u.stack.pop(); this._muMainRender(); this._muR('munav'); break;
        case 'full': u.full = true; this._muR('mufull'); break;
        case 'full0': u.full = false; this._muR('mufull'); break;
        case 'sheet': u.sheet = d.v; if (d.v === 'queue') this._muQueue(); delete this._cache.musheet; this._muR('musheet'); break;
        case 'sheet0': u.sheet = null; u.menu = null; this._muR('musheet'); break;
        case 'ctl': this._musCtl(d.v); break;
        case 'scroll': {
          const sec = t && t.closest && t.closest('.mu-sec'), el = sec && sec.querySelector('.mcar');
          if (el) el.scrollBy({ left: Number(d.v) * Math.max(200, el.clientWidth * 0.8), behavior: 'smooth' });
          break;
        }
        case 'clearq': if (this._confirm('clearq', 'vaciar la cola')) { this._call('media_player', 'clear_playlist', { entity_id: u.player }); u.added = []; setTimeout(() => this._muQueue(), 800); } break;
        case 'dev': {
          if (d.eid === u.player) break;
          const cur = this._muSt();
          if (u.entry && cur && (cur.state === 'playing' || cur.state === 'paused') && cur.attributes.media_title) {
            this._call('music_assistant', 'transfer_queue', { entity_id: d.eid, source_player: u.player });
            this._toast(`${ic('speaker')} Pasando la música a ${esc(this._label(d.eid))}`);
          }
          u.player = d.eid;
          try { localStorage.setItem('matterai.music.player', d.eid); } catch (_) { /* noop */ }
          u.sheet = null; this._muAll();
          break;
        }
        case 'group': {
          const g = (this._muSt().attributes.group_members) || [];
          if (g.includes(d.eid)) this._call('media_player', 'unjoin', { entity_id: d.eid });
          else this._call('media_player', 'join', { entity_id: u.player, group_members: [d.eid] });
          break;
        }
        case 'play': { // tocar una canción: suena desde ahí, con el resto de la lista detrás (como Spotify)
          if (!it) break;
          const list = u.lists[d.list] || [];
          if (it.media_type === 'track') {
            const top = u.stack[u.stack.length - 1];
            const from = list.slice(Number(d.i)).filter((x) => x.media_type === 'track').slice(0, 100).map((x) => x.uri);
            this._muPlay(from, 'track', 'replace', top ? { name: top.name, type: top.type, uri: top.uri } : { name: u.q || 'tu música', type: 'search' });
          } else this._muPlay(it.uri, it.media_type, 'replace', { name: it.name, type: it.media_type, uri: it.uri });
          break;
        }
        case 'playitem': if (it) this._muPlay(it.uri, it.media_type, 'replace', { name: it.name, type: it.media_type, uri: it.uri }); break;
        case 'playtop': {
          const top = u.stack[u.stack.length - 1]; if (!top) break;
          this._muPlay(top.uri, top.type, 'replace', { name: top.name, type: top.type, uri: top.uri });
          if (u.shuffleNext) setTimeout(() => this._call('media_player', 'shuffle_set', { entity_id: u.player, shuffle: true }), 600);
          break;
        }
        case 'shufnext': u.shuffleNext = !u.shuffleNext; this._muMainRender(true); break;
        case 'menu': u.menu = it; u.menuNow = false; u.sheet = 'menu'; delete this._cache.musheet; this._muR('musheet'); break;
        case 'nowmenu': {
          const st = this._muSt(); if (!st || !st.attributes.media_title) break;
          const a = st.attributes;
          const base = { media_type: 'track', uri: a.media_content_id, name: a.media_title, artists: a.media_artist ? [{ name: a.media_artist }] : [],
            album: a.media_album_name ? { name: a.media_album_name } : null, image: a.entity_picture ? this._url(a.entity_picture) : '' };
          u.menu = base; u.menuNow = true; u.sheet = 'menu'; delete this._cache.musheet; this._muR('musheet');
          // Music Assistant sabe el álbum y el artista exactos de lo que suena
          if (u.entry) this._ma('get_queue', { entity_id: u.player }, false).then((r) => {
            const q = r[u.player] || Object.values(r)[0] || {}, mi = q.current_item && q.current_item.media_item;
            if (!mi || this._mus !== u || u.menu !== base) return;
            u.menu = Object.assign({}, base, mi, { image: this._musImg(mi) || base.image });
            delete this._cache.musheet; this._muR('musheet');
          }).catch(() => {});
          break;
        }
        case 'do': {
          const m = u.menu; u.sheet = null; u.menu = null; this._muR('musheet');
          if (!m) break;
          if (d.v === 'album' || d.v === 'artist') { u.full = false; this._muR('mufull'); }
          const by = (name) => { u.stack = []; u.page = 'search'; u.mainKey = null; u.q = name; u.filter = 'all'; this._muR('munav'); this._muSearch(name); this._muMainRender(); };
          if (d.v === 'album' && !(m.album && m.album.uri)) { if (m.album && m.album.name) by(m.album.name); break; }
          if (d.v === 'artist' && !(m.artists && m.artists[0] && m.artists[0].uri)) { if (m.artists && m.artists[0]) by(m.artists[0].name); break; }
          if (d.v === 'add' || d.v === 'next') { this._muPlay(m.uri, m.media_type, d.v); u.added.push(m); this._toast(`${ic(d.v === 'add' ? 'plus' : 'next')} ${d.v === 'add' ? 'Agregado a la cola' : 'Suena a continuación'}`); }
          else if (d.v === 'play') this._muPlay(m.uri, m.media_type, 'replace', { name: m.name, type: m.media_type, uri: m.uri });
          else if (d.v === 'album') this._muOpen({ uri: m.album.uri, media_type: 'album', name: m.album.name, image: m.album.image || m.image, artists: m.artists });
          else if (d.v === 'artist') this._muOpen({ uri: m.artists[0].uri, media_type: 'artist', name: m.artists[0].name, image: m.artists[0].image });
          else if (d.v === 'radio') { this._muPlay(m.uri, m.media_type, 'replace', { name: `Radio de ${m.name}`, type: 'radio', uri: m.uri }, { radio_mode: true }); this._toast(`${ic('vol')} Radio de ${esc(m.name)}`); }
          break;
        }
        default: break;
      }
    }

    /* ---------- Actividad: registro por tiempos (logbook de Home Assistant) ---------- */
    /** Abre la pantalla de actividad. opts: { period: today|yesterday|week, cat, room, entity } */
    openActivity(opts) {
      if (!this._root || !this._m) return;
      const o = opts || {};
      this._act = { period: o.period || 'today', cat: o.cat || 'all', room: o.room || null, entity: o.entity || null,
        from: null, events: null, loading: false, error: null, shown: 150, sig: null };
      this._cache.act = null;
      this._els.actwrap.classList.add('open');
      this._els.act.scrollTop = 0;
      this._loadAct();
      this._haptic('light');
    }
    _closeAct() {
      if (!this._act) return;
      this._act = null;
      clearTimeout(this._actT);
      this._els.actwrap.classList.remove('open');
    }

    /** Categoría y ambiente de cada entidad del dashboard (sólo se registra lo que el cliente ve). */
    _actMeta() {
      const m = this._m, S = this._hass.states, meta = {};
      const add = (id, cat, room) => { if (!id || !S[id] || dom(id) === 'camera') return; if (!meta[id]) meta[id] = { cat, room: room || null }; else if (!meta[id].room && room) meta[id].room = room; };
      for (const r of m.rooms) {
        r.lights.forEach((id) => add(id, 'luces', r));
        [...r.covers, ...r.locks, ...r.openings].forEach((id) => add(id, 'aberturas', r));
        r.motion.forEach((id) => add(id, 'movimiento', r));
        [...r.climates, ...r.fans].forEach((id) => add(id, 'clima', r));
        r.media.forEach((id) => add(id, 'multimedia', r));
        [...r.switches, ...r.actions].forEach((id) => add(id, 'equipos', r));
        r.sensors.filter((id) => dom(id) === 'binary_sensor').forEach((id) => add(id, 'seguridad', r));
      }
      m.alarms.forEach((a) => add(a.entity_id, 'seguridad'));
      m.secEnts.forEach((id) => add(id, dom(id) === 'binary_sensor' && OPEN_DC.has(S[id].attributes.device_class) ? 'aberturas' : 'seguridad'));
      m.access.forEach((id) => add(id, 'aberturas'));
      m.people.forEach((p) => add(p.entity_id, 'personas'));
      return meta;
    }

    /** Períodos: 'today' | 'yesterday' | 'day:N' (N días atrás) | 'week'.
     *  Un día ocupa siempre la barra completa (00 a 24); lo que todavía no pasó queda vacío. */
    _actRange(p) {
      const now = new Date(), mid = new Date(now); mid.setHours(0, 0, 0, 0);
      if (p === 'week') return { start: new Date(now.getTime() - 7 * 864e5), end: now, spanEnd: now, week: true };
      const n = periodOffset(p);
      const start = new Date(mid.getTime() - n * 864e5), dayEnd = new Date(start.getTime() + 864e5);
      return { start, end: n === 0 ? now : dayEnd, spanEnd: dayEnd, week: false, offset: n };
    }
    _actSig(ids) { const S = this._hass.states; return ids.map((id) => (S[id] ? S[id].last_changed : '')).join('|'); }

    /** Pide el registro a HA y lo deja ordenado (más nuevo primero), con la duración de cada período. */
    async _fetchLog(ids, start, end) {
      const h = this._hass;
      if (!ids.length) return [];
      const res = await h.callWS({ type: 'logbook/get_events', start_time: start.toISOString(), end_time: end.toISOString(), entity_ids: ids });
      const want = new Set(ids);
      const ev = (res || []).filter((e) => e && e.entity_id && want.has(e.entity_id) && (e.state != null || e.message))
        .map((e) => Object.assign({}, e, { t: typeof e.when === 'number' ? e.when * 1000 : Date.parse(e.when) }))
        .filter((e) => Number.isFinite(e.t))
        .sort((a, b) => a.t - b.t);
      const last = {}, out = [];
      for (const e of ev) {
        const p = last[e.entity_id];
        if (p && e.state != null && p.state === e.state) continue; // repetido
        if (p && isOnState(p.state) && !isOnState(e.state)) e.dur = e.t - p.t;
        last[e.entity_id] = e;
        out.push(e);
      }
      return out.reverse();
    }

    async _loadAct() {
      const a = this._act; if (!a) return;
      if (!this._hass || typeof this._hass.callWS !== 'function') { a.error = 'El registro no está disponible.'; a.events = []; this._renderAct(); return; }
      a.meta = this._actMeta();
      if (a.entity && !a.meta[a.entity] && this._hass.states[a.entity]) a.meta[a.entity] = { cat: 'equipos', room: null }; // historial de un equipo fuera del dashboard
      a.range = this._actRange(a.period);
      a.loading = !a.events;
      this._renderAct();
      const req = a.req = {};
      const ids = Object.keys(a.meta);
      try {
        const evs = await this._fetchLog(ids, a.range.start, a.range.end);
        await this._appWho(evs, a.range.start);
        if (this._act !== a || a.req !== req) return;
        a.events = evs; a.error = null;
      } catch (e) {
        if (this._act !== a || a.req !== req) return;
        a.error = e && e.message ? e.message : String(e); a.events = a.events || [];
      }
      a.loading = false;
      a.sig = this._actSig(ids);
      if (a.entity) { this._loadEntHist(); return; }
      a.stale = false;
      this._renderAct();
    }

    /** Mientras está abierta (hoy / 7 días), se actualiza sola cuando algo cambia. */
    _actLive() {
      const a = this._act;
      if (a && (a.period === 'week' || periodOffset(a.period) === 0) && a.meta && !a.loading) {
        const sig = this._actSig(Object.keys(a.meta));
        if (sig !== a.sig) { a.sig = sig; clearTimeout(this._actT); this._actT = setTimeout(() => this._loadAct(), 2000); }
      }
      const ra = this._roomAct;
      if (ra && this._room === ra.room && !ra.loading) {
        const sig = this._actSig(ra.ids);
        if (sig !== ra.sig) { ra.sig = sig; clearTimeout(this._raT); this._raT = setTimeout(() => this._loadRoomAct(this._m.byId[ra.room], true), 2000); }
      }
    }

    _renderAct() {
      const a = this._act; if (!a) return;
      const html = this._hAct(a);
      if (this._cache.act === html) return;
      this._cache.act = html;
      const el = this._els.act, top = el.scrollTop;
      el.innerHTML = html;
      el.scrollTop = top;
      if (a.typing && el.querySelector) { // seguir escribiendo en el buscador
        const inp = el.querySelector('#actq');
        if (inp) { inp.focus(); try { inp.setSelectionRange(a.typing, a.typing); } catch (_) { /* noop */ } }
      }
    }

    _actText(e) {
      const st = this._hass.states[e.entity_id], d = dom(e.entity_id), dc = st && st.attributes.device_class, s = e.state;
      const T = (txt, tone) => ({ txt, tone: tone || 'info' });
      if (s === 'unavailable') return T('Sin conexión', 'warn');
      if (s === 'unknown') return T('Sin datos (el equipo no informó su estado)', 'warn');
      if (s == null) return T(e.message ? cap(e.message) : 'Sin datos', 'info');
      switch (d) {
        case 'light': case 'switch': case 'fan': case 'input_boolean':
          return s === 'on' ? T('Se encendió', 'on') : s === 'off' ? T('Se apagó', 'off') : T(cap(s));
        case 'automation': return s === 'on' ? T('Automatización activada', 'on') : T('Automatización desactivada', 'off');
        case 'script': return s === 'on' ? T('Se ejecutó', 'on') : T('Terminó', 'off');
        case 'scene': return T('Se activó la escena', 'on');
        case 'button': case 'input_button': return T('Se presionó', 'on');
        case 'cover': return ({ open: T('Se abrió', 'warn'), closed: T('Se cerró', 'off'), opening: T('Abriendo…', 'warn'), closing: T('Cerrando…', 'off') })[s] || T(cap(s));
        case 'lock': return ({ locked: T('Se trabó', 'off'), unlocked: T('Se destrabó', 'warn'), jammed: T('Trabada con error', 'warn'), open: T('Se abrió', 'warn') })[s] || T(cap(s));
        case 'binary_sensor':
          if (OPEN_DC.has(dc)) return s === 'on' ? T('Se abrió', 'warn') : T('Se cerró', 'off');
          if (dc === 'motion') return s === 'on' ? T('Detectó movimiento', 'on') : T('Sin movimiento', 'off');
          if (dc === 'occupancy' || dc === 'presence') return s === 'on' ? T('Detectó presencia', 'on') : T('Sin presencia', 'off');
          if (dc === 'moisture') return s === 'on' ? T('¡Detectó agua!', 'warn') : T('Seco', 'off');
          if (dc === 'smoke' || dc === 'gas' || dc === 'carbon_monoxide') return s === 'on' ? T(`¡Alarma de ${dc === 'smoke' ? 'humo' : 'gas'}!`, 'warn') : T('Normal', 'off');
          return s === 'on' ? T('Se activó', 'on') : T('Volvió a normal', 'off');
        case 'alarm_control_panel':
          if (s === 'triggered') return T('¡Alarma disparada!', 'warn');
          if (s === 'disarmed') return T('Alarma desactivada', 'off');
          if (s.startsWith('armed')) return T((ALARM[s] || ['Activada'])[0].replace(/^Activada/, 'Alarma activada'), 'on');
          return T((ALARM[s] || [cap(s)])[0]);
        case 'climate': return s === 'off' ? T('Se apagó', 'off') : T(`Se encendió en ${(HVAC[s] || s).toLowerCase()}`, 'on');
        case 'media_player': return ({ playing: T('Empezó a reproducir', 'on'), paused: T('En pausa', 'off'), off: T('Se apagó', 'off'), on: T('Se encendió', 'on'), idle: T('En espera', 'off'), standby: T('En espera', 'off') })[s] || T(cap(s));
        case 'person': case 'device_tracker': return s === 'home' ? T('Llegó a casa', 'on') : s === 'not_home' ? T('Salió de casa', 'off') : T(`Llegó a ${s}`);
        default: return T(cap(String(s).replace(/_/g, ' ')));
      }
    }

    /** Qué celular o tablet dio cada orden desde la app (MatterAI 2.9+: la app lo avisa a la casa). */
    async _appWho(evs, start) {
      const h = this._hass;
      if (!evs.length || !h.services || !h.services.matterai || !h.services.matterai.app_command) return;
      let acts;
      try { acts = await h.callWS({ type: 'matterai/app/actions', since: start.getTime() / 1000 - 10 }); } catch (_) { return; }
      if (!Array.isArray(acts) || !acts.length) return;
      for (const e of evs) {
        if (!e.context_user_id) continue;
        let best = null, gap = 6000;
        for (const x of acts) {
          const d = Math.abs(x.t * 1000 - e.t);
          if (d < gap && (x.entity_ids || []).includes(e.entity_id)) { gap = d; best = x; }
        }
        if (best && best.device) e.appDev = best.device;
      }
    }

    /** Quién lo hizo: una automatización, una rutina, alguien desde la app o a mano (tecla, sensor). */
    /** Quién lo hizo (como "triggered by" de Home Assistant): automatización y qué la disparó, rutina, app, sistema o el propio equipo. */
    _actWho(e, cat) {
      const S = this._hass.states;
      const n = e.context_entity_id_name || e.context_name || '';
      const ce = e.context_entity_id || '';
      const src = `${e.context_source || ''} ${e.context_message || ''}`;
      let trig = '';
      const mm = src.match(/\b([a-z_]+\.[a-z0-9_]+)\b/);
      if (mm && S[mm[1]] && mm[1] !== ce) trig = `la activó ${this._name(mm[1])}`;
      else if (/\btime\b|horario|time pattern/i.test(src)) trig = 'por horario';
      else if (/\bsun\b|sunset|sunrise/i.test(src)) trig = 'por el sol';
      else if (/webhook/i.test(src)) trig = 'por un aviso externo';
      const auto = (kind) => `${kind}${n ? ` «${n}»` : ''}${trig ? ` · ${trig}` : ''}`;
      if (/^automation\./.test(ce) || e.context_domain === 'automation') return auto('Automatización');
      if (/^script\./.test(ce) || e.context_domain === 'script') return auto('Rutina');
      if (e.context_domain === 'matterai_escenas' || e.context_domain === 'matterai' || /matterai/.test(ce)) return auto('Automatización');
      if (e.context_user_id) return e.appDev ? `Desde la app · ${e.appDev}` : 'Desde la app';
      if (e.context_event_type === 'call_service') return 'Orden del sistema';
      if (['luces', 'equipos', 'aberturas', 'clima', 'multimedia'].includes(cat) && e.state != null && e.state !== 'unavailable' && e.state !== 'unknown') return 'Desde el equipo (tecla o control)';
      return '';
    }

    _evRow(e, meta, opts) {
      const o = opts || {}, M = meta[e.entity_id] || {}, cat = M.cat || 'equipos';
      const { txt, tone } = this._actText(e);
      const d = new Date(e.t), hh = hhmm(e.t);
      const ss = String(d.getSeconds()).padStart(2, '0');
      const st = this._hass.states[e.entity_id];
      const icn = cat === 'aberturas' && st && st.attributes.device_class === 'window' ? 'window' : cat === 'aberturas' && dom(e.entity_id) === 'cover' && ['garage', 'gate'].includes(st && st.attributes.device_class) ? 'garage' : ACT_ICON[cat] || 'sparkle';
      const dur = e.dur ? ` <em>· ${ACT_ON_LABEL[cat] ? `estuvo ${ACT_ON_LABEL[cat]}` : 'duró'} ${fmtDur(e.dur)}</em>` : '';
      const recent = Date.now() - e.t < 864e5 ? ago(new Date(e.t).toISOString()) : '';
      const who = this._actWho(e, cat);
      const sub = [o.room !== false && M.room ? M.room.name : '', who].filter(Boolean).join(' · ');
      return `<div class="ev t-${tone}" ${o.link === false ? '' : `data-action="actent" data-eid="${e.entity_id}"`}>
        <div class="ev-time"><b>${hh}</b><small>:${ss}</small>${recent ? `<em>${esc(recent)}</em>` : ''}</div><div class="ev-dot">${ic(icn)}</div>
        <div class="ev-b"><b>${esc(this._name(e.entity_id, M.room))}</b><span>${esc(txt)}</span>${dur}${sub ? `<small>${esc(sub)}</small>` : ''}</div></div>`;
    }

    _hActList(evs, meta, max, opts) {
      let html = '', day = '';
      evs.slice(0, max).forEach((e) => {
        const dl = dayLabel(e.t);
        if (dl !== day) { day = dl; html += `<div class="day-h">${esc(dl)}</div>`; }
        html += this._evRow(e, meta, opts);
      });
      return html;
    }

    /** Nombre y color de cada estado en la línea de tiempo. color null = estado "de reposo" (apagado, cerrado): no se pinta. */
    _stateStyle(id, s, cat) {
      const st = this._hass.states[id], d = dom(id), dc = st && st.attributes.device_class;
      if (s === 'unavailable' || s === 'unknown') return { label: 'Sin conexión', color: null, na: true };
      const W = '#ffb547', CO = '#ff7a5a', TE = '#3ee6c4', BL = '#5b8cff', VI = '#9b87ff', RD = '#ff3d5a';
      const on = (label, color) => ({ label, color }), off = (label) => ({ label, color: null });
      switch (d) {
        case 'light': return s === 'on' ? on('Encendida', W) : off('Apagada');
        case 'switch': case 'input_boolean': return s === 'on' ? on(cat === 'luces' ? 'Encendida' : 'Encendido', cat === 'luces' ? W : BL) : off('Apagado');
        case 'fan': return s === 'on' ? on('Encendido', BL) : off('Apagado');
        case 'automation': return s === 'on' ? on('Activada', BL) : off('Desactivada');
        case 'cover': return s === 'open' || s === 'opening' ? on(['garage', 'gate', 'awning'].includes(dc) ? 'Abierto' : 'Abierta', CO) : s === 'closing' ? on('Cerrando', W) : off('Cerrada');
        case 'lock': return s === 'unlocked' || s === 'open' ? on('Destrabada', CO) : s === 'jammed' ? on('Con error', RD) : off('Trabada');
        case 'binary_sensor':
          if (s !== 'on') return off('Normal');
          if (OPEN_DC.has(dc)) return on('Abierta', CO);
          if (dc === 'motion') return on('Con movimiento', TE);
          if (dc === 'occupancy' || dc === 'presence') return on('Con presencia', TE);
          if (['moisture', 'smoke', 'gas', 'carbon_monoxide', 'problem', 'safety', 'tamper'].includes(dc)) return on('Alerta', RD);
          return on('Activo', VI);
        case 'climate': return ({ cool: on('Frío', '#46a0ff'), heat: on('Calor', '#ff8040'), heat_cool: on('Auto', VI), auto: on('Auto', VI), dry: on('Seco', '#5adcbe'), fan_only: on('Ventilar', '#96c8ff') })[s] || off('Apagado');
        case 'media_player': return ({ playing: on('Reproduciendo', '#7c9cff'), paused: on('En pausa', '#5b6275'), on: on('Encendido', '#4a5a85'), idle: on('Encendido', '#4a5a85'), buffering: on('Cargando', '#4a5a85') })[s] || off('Apagado');
        case 'alarm_control_panel':
          if (s === 'triggered') return on('¡Disparada!', RD);
          if (s === 'arming' || s === 'pending') return on(s === 'arming' ? 'Activando' : 'Ingreso detectado', W);
          return String(s).startsWith('armed') ? on((ALARM[s] || ['Activada'])[0], VI) : off('Desactivada');
        case 'person': case 'device_tracker': return s === 'home' ? on('En casa', TE) : s === 'not_home' ? off('Fuera') : on(cap(s), BL);
        default: return isOnState(s) ? on(cap(String(s).replace(/_/g, ' ')), BL) : off(cap(String(s).replace(/_/g, ' ')));
      }
    }

    /** Estados exactos de un equipo en el período (historial de HA: incluye el estado al empezar). null si no se pudo. */
    async _fetchStates(id, start, end) {
      try {
        const res = await this._hass.callWS({ type: 'history/history_during_period', start_time: start.toISOString(), end_time: end.toISOString(),
          entity_ids: [id], minimal_response: true, no_attributes: true, significant_changes_only: false });
        const list = res && res[id];
        if (!Array.isArray(list)) return null;
        return list.map((x) => {
          const sec = x.lc != null ? x.lc : x.lu;
          return { s: x.s != null ? x.s : x.state, t: sec != null ? sec * 1000 : Date.parse(x.last_changed || x.last_updated) };
        }).filter((x) => x.s != null && Number.isFinite(x.t)).sort((p, q) => p.t - q.t);
      } catch (_) { return null; }
    }

    /** Línea de tiempo de un equipo: un color por estado, leyenda con el tiempo en cada uno y franjas que se pueden tocar. */
    _hActTimeline(a, evs, hist) {
      const id = a.entity, S = this._hass.states, M = a.meta[id] || {}, cat = M.cat || this._catOf(id);
      const start = a.range.start.getTime(), now = Date.now();
      const end = Math.min(a.range.end.getTime(), now), spanEnd = a.range.spanEnd.getTime(), span = spanEnd - start;
      const week = !!a.range.week;
      let pts = hist && hist.length ? hist.slice() : null;
      if (!pts) { // sin historial: se arma con el registro (estado inicial estimado)
        const asc = evs.slice().reverse().filter((e) => e.state != null);
        const init = asc.length ? (isOnState(asc[0].state) ? 'off' : 'on') : (S[id] ? S[id].state : 'off');
        pts = [{ s: init, t: start }].concat(asc.map((e) => ({ s: e.state, t: e.t })));
      }
      const segs = [];
      for (let i = 0; i < pts.length; i++) {
        const from = Math.max(start, pts[i].t), to = Math.min(end, i + 1 < pts.length ? pts[i + 1].t : end);
        if (to > from) segs.push({ s: pts[i].s, from, to, st: this._stateStyle(id, pts[i].s, cat) });
      }
      const by = {}; let total = 0, count = 0;
      segs.forEach((g) => {
        const k = g.st.label, c = g.st.color || (g.st.na ? 'na' : null);
        if (!c) return;
        (by[k] = by[k] || { c, ms: 0 }).ms += g.to - g.from;
        if (g.st.color) total += g.to - g.from;
      });
      pts.forEach((p, i) => {
        if (p.t < start || p.t > end) return;
        const st = this._stateStyle(id, p.s, cat), prev = i > 0 ? this._stateStyle(id, pts[i - 1].s, cat) : null;
        if (st.color && (!prev || prev.label !== st.label)) count++;
      });
      const pct = (t) => ((t - start) / span * 100).toFixed(2);
      const tfmt = (t) => (week ? `${new Date(t).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric' }).replace('.', '')} ${hhmm(t)}` : hhmm(t));
      const bars = segs.filter((g) => g.st.color || g.st.na).map((g) => {
        const info = `${g.st.label} · ${tfmt(g.from)} → ${g.to >= now - 1000 ? 'ahora' : tfmt(g.to)} · ${fmtDur(g.to - g.from)}`;
        const bg = g.st.color ? `background:linear-gradient(90deg,${g.st.color},${g.st.color}b3);box-shadow:0 0 12px ${g.st.color}66` : '';
        return `<i class="${g.st.na ? 'na' : ''}" data-seg data-info="${esc(info)}" title="${esc(info)}" style="left:${pct(g.from)}%;width:${(Math.max(g.to - g.from, span * 0.003) / span * 100).toFixed(2)}%;${bg}"></i>`;
      }).join('');
      const ticks = week
        ? Array.from({ length: 8 }, (_, i) => new Date(start + i * 864e5).toLocaleDateString('es-AR', { weekday: 'short' }).replace('.', ''))
        : ['00', '06', '12', '18', '24'];
      const grid = week ? Array.from({ length: 6 }, (_, i) => `<u style="left:${(i + 1) / 7 * 100}%"></u>`).join('') : [25, 50, 75].map((p) => `<u style="left:${p}%"></u>`).join('');
      const nowMark = !week && now > start && now < spanEnd ? `<b class="now" style="left:${pct(now)}%"></b>` : '';
      const labels = Object.keys(by).filter((k) => by[k].c !== 'na');
      const main = labels.length === 1 ? labels[0].toLowerCase() : (ACT_ON_LABEL[cat] || 'activo');
      const legend = Object.entries(by).map(([k, v]) => `<span><i class="${v.c === 'na' ? 'na' : ''}" ${v.c !== 'na' ? `style="background:${v.c}"` : ''}></i>${esc(k)} <b>${fmtDur(v.ms)}</b></span>`).join('');
      const changes = pts.filter((p) => p.t >= start && p.t <= end);
      const lastT = changes.length ? changes[changes.length - 1].t : null;
      return `<div class="tl"><div class="tl-l"><span>${esc(cap(main))}</span><span>${esc(periodLabel(a.period))}</span></div>
        <div class="tl-bar">${grid}${bars}${nowMark}</div>
        <div class="tl-ticks">${ticks.map((t) => `<span>${esc(t)}</span>`).join('')}</div>
        ${legend ? `<div class="tl-legend">${legend}</div>` : ''}
        <div class="tl-info">Tocá una franja para ver desde y hasta qué hora.</div>
        <div class="tl-stats"><div><b>${fmtDur(total)}</b><small>${esc(main)} en total</small></div>
          <div><b>${count}</b><small>${count === 1 ? 'vez' : 'veces'}</small></div>
          <div><b>${lastT ? hhmm(lastT) : '—'}</b><small>último cambio</small></div></div></div>`;
    }

    _hAct(a) {
      const m = this._m, meta = a.meta || {};
      let evs = a.events || [];
      const inCat = (e, c) => c === 'all' || (meta[e.entity_id] && meta[e.entity_id].cat === c);
      const inRoom = (e) => !a.room || (meta[e.entity_id] && meta[e.entity_id].room && meta[e.entity_id].room.id === a.room);
      const norm = (x) => String(x || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      const q = norm(a.q);
      if (a.entity) evs = evs.filter((e) => e.entity_id === a.entity);
      else {
        evs = evs.filter((e) => inRoom(e));
        if (a.ents && a.ents.length) evs = evs.filter((e) => a.ents.includes(e.entity_id));
        if (q) evs = evs.filter((e) => norm(this._name(e.entity_id, meta[e.entity_id] && meta[e.entity_id].room)).includes(q) || norm(meta[e.entity_id] && meta[e.entity_id].room && meta[e.entity_id].room.name).includes(q));
      }
      const counts = {}; ACT_CATS.forEach(([k]) => { counts[k] = evs.filter((e) => inCat(e, k)).length; });
      // resumen (antes de filtrar por tipo)
      const catOn = (c, test) => evs.filter((e) => meta[e.entity_id] && meta[e.entity_id].cat === c && test(e.state)).length;
      const summary = a.entity ? '' : `<div class="act-sum">
        <div><b>${catOn('luces', (s) => s === 'on')}</b><small>luces encendidas</small></div>
        <div><b>${catOn('aberturas', (s) => s === 'on' || s === 'open' || s === 'unlocked')}</b><small>aperturas</small></div>
        <div><b>${catOn('movimiento', (s) => s === 'on')}</b><small>movimientos</small></div>
        <div><b>${evs.filter((e) => this._actText(e).tone === 'warn').length}</b><small>avisos</small></div></div>`;
      if (!a.entity) evs = evs.filter((e) => inCat(e, a.cat));
      const room = a.room && m.byId[a.room];
      const M = a.entity ? (meta[a.entity] || {}) : null;
      const title = a.entity ? this._name(a.entity, M.room) : room ? `Actividad · ${room.name}` : 'Actividad';
      const sub = a.entity ? [M.room ? M.room.name : '', 'Historial'].filter(Boolean).join(' · ')
        : a.loading ? 'Buscando lo que pasó…' : `${evs.length} ${evs.length === 1 ? 'evento' : 'eventos'}`;
      const chip = (act, v, label, on, icon, n) => `<button class="chip ${on ? 'on' : ''}" data-action="${act}" data-v="${esc(v)}">${icon ? ic(icon) : ''}${esc(label)}${n != null ? ` <i>${n}</i>` : ''}</button>`;
      let h = `<div class="act-h"><div class="act-top">
          ${a.entity ? `<button class="ib" data-action="actback" aria-label="Volver">${ic('back')}</button>` : `<div class="ri">${ic('history')}</div>`}
          <div class="act-t"><h2>${esc(title)}</h2><span>${esc(sub)}</span></div>
          <button class="ib" data-action="actclose" aria-label="Cerrar">${ic('x')}</button></div>
        <div class="act-f">${this._hNav(a.period, 'actnav', 'actperiod')}</div>`;
      if (!a.entity) {
        h += `<div class="act-search">${ic('search')}<input id="actq" type="search" placeholder="Buscar un dispositivo o ambiente…" value="${esc(a.q || '')}" autocomplete="off"></div>
          <div class="act-f scroll">${ACT_CATS.filter(([k]) => k === 'all' || counts[k]).map(([k, l, i]) => chip('actcat', k, l, a.cat === k, i, counts[k])).join('')}</div>
          <div class="act-f scroll">${chip('actroom', '', 'Toda la casa', !a.room, 'home')}${m.rooms.map((r) => chip('actroom', r.id, r.name, a.room === r.id, r.icon)).join('')}</div>`;
        // equipos: elegir uno o varios (como el historial de Home Assistant)
        const sel = a.ents || [];
        h += `<div class="act-f scroll">${chip('actentsp', '', sel.length ? `Equipos · ${sel.length}` : 'Elegir equipos', !!a.entsOpen || sel.length > 0, 'plug')}
          ${sel.map((id) => `<button class="chip on" data-action="actentx" data-v="${esc(id)}">${esc(this._name(id, meta[id] && meta[id].room))} ✕</button>`).join('')}
          ${sel.length ? '<button class="chip" data-action="actentclear" data-v="">Todos</button>' : ''}</div>`;
        if (a.entsOpen) {
          const n = {}; (a.events || []).forEach((e) => { n[e.entity_id] = (n[e.entity_id] || 0) + 1; });
          const ids = Object.keys(meta).filter((id) => !a.room || (meta[id].room && meta[id].room.id === a.room))
            .sort((x, y) => (n[y] || 0) - (n[x] || 0) || this._name(x, meta[x].room).localeCompare(this._name(y, meta[y].room), 'es'));
          h += `<div class="act-ents">${ids.map((id) => `<button class="${sel.includes(id) ? 'on' : ''}" data-action="actentx" data-v="${esc(id)}"><span class="ck">${sel.includes(id) ? '✓' : ''}</span>
            <span class="tx"><b>${esc(this._name(id, meta[id].room))}</b><small>${esc([meta[id].room && meta[id].room.name, n[id] ? `${n[id]} cambio${n[id] > 1 ? 's' : ''}` : 'sin cambios'].filter(Boolean).join(' · '))}</small></span></button>`).join('') || '<p class="mut" style="padding:8px">No hay equipos en este ambiente.</p>'}
            <button class="tbtn" data-action="actentsp" data-v="" style="margin:8px auto 2px;display:block">Listo</button></div>`;
        }
      }
      h += '</div><div class="act-body">';
      if (a.loading) h += `<div class="ev-empty">${ic('history')}Buscando lo que pasó en la casa…</div>`;
      else if (a.error && !evs.length) h += `<div class="ev-empty">${ic('alert')}No se pudo leer el registro.<br><small>${esc(a.error)}</small></div>`;
      else {
        h += summary;
        if (a.entity) h += this._hActTimeline(a, evs, a.hist && a.hist.id === a.entity && a.hist.period === a.period ? a.hist.pts : null);
        if (!evs.length) h += `<div class="ev-empty">${ic('check')}No hubo cambios en este período.</div>`;
        else {
          h += this._hActList(evs, meta, a.shown, a.entity ? { link: false, room: false } : {});
          if (evs.length > a.shown) h += `<div class="ev-more"><button class="tbtn" data-action="actmore">Ver más (${evs.length - a.shown})</button></div>`;
        }
      }
      h += '</div>';
      const cut = h.indexOf('<div class="act-body">');
      if (cut < 0) return h;
      const head = h.slice(0, cut), body = h.slice(cut);
      if (a.stale && a.lastBody) return head + a.lastBody.replace('<div class="act-body">', '<div class="act-body stale">');
      a.lastBody = body;
      return head + body;
    }

    /** Navegación por días: ◀ Hoy ▶ · 7 días. Sirve para la pantalla Actividad y para la ventana de cada dispositivo. */
    _hNav(period, navAct, perAct, attr) {
      const k = attr || 'data-action';
      const off = period === 'week' ? null : periodOffset(period);
      return `<div class="hnav">
        <button ${k}="${navAct}" data-d="1" aria-label="Día anterior">${ic('back')}</button>
        <b>${esc(periodLabel(period))}</b>
        <button class="fwd" ${k}="${navAct}" data-d="-1" ${off === 0 || off === null ? 'disabled' : ''} aria-label="Día siguiente">${ic('back')}</button>
      </div>
      <button class="hchip ${period === 'week' ? 'on' : ''}" ${k}="${perAct}" data-v="week">7 días</button>
      ${off !== 0 ? `<button class="hchip" ${k}="${perAct}" data-v="today">Hoy</button>` : ''}`;
    }
    /** Mover el período un día (d = 1: día anterior, -1: siguiente). Hasta 30 días atrás. */
    static shiftPeriod(period, d) {
      const base = period === 'week' ? 0 : periodOffset(period);
      const n = Math.max(0, Math.min(30, base + d));
      return n === 0 ? 'today' : `day:${n}`;
    }

    async _loadEntHist() {
      const a = this._act; if (!a || !a.entity) return;
      const key = { id: a.entity, period: a.period };
      const pts = await this._fetchStates(a.entity, a.range.start, a.range.end);
      if (this._act !== a || a.entity !== key.id || a.period !== key.period) return;
      a.hist = Object.assign(key, { pts });
      a.stale = false;
      this._renderAct();
    }

    /** Categoría de un equipo que no está en el dashboard (para textos y colores del historial). */
    _catOf(eid) {
      const st = this._hass.states[eid], d = dom(eid), dc = st && st.attributes.device_class;
      if (d === 'light') return 'luces';
      if (d === 'cover' || d === 'lock' || (d === 'binary_sensor' && OPEN_DC.has(dc))) return 'aberturas';
      if (d === 'binary_sensor' && MOTION_DC.has(dc)) return 'movimiento';
      if (d === 'alarm_control_panel' || d === 'binary_sensor') return 'seguridad';
      if (d === 'climate' || d === 'fan') return 'clima';
      if (d === 'media_player') return 'multimedia';
      if (d === 'person' || d === 'device_tracker') return 'personas';
      return 'equipos';
    }

    /**
     * Historial de un dispositivo, listo para mostrar (lo usa la ventana de cada dispositivo en la app).
     * Devuelve HTML con la línea de tiempo y la lista de cambios; los estilos están en window.MatterAIHome.historyCSS.
     */
    async entityHistory(eid, period) {
      if (!this._hass || typeof this._hass.callWS !== 'function' || !this._m) return '';
      const p = period || 'today';
      const meta = this._actMeta();
      if (!meta[eid]) meta[eid] = { cat: this._catOf(eid), room: null };
      const range = this._actRange(p);
      const [evs, pts] = await Promise.all([this._fetchLog([eid], range.start, range.end), this._fetchStates(eid, range.start, range.end)]);
      const a = { entity: eid, period: p, range, meta };
      return this._hActTimeline(a, evs, pts)
        + (evs.length ? this._hActList(evs, meta, 80, { link: false, room: false }) : `<div class="ev-empty">${ic('check')}No hubo cambios en este período.</div>`);
    }

    /* Actividad de hoy dentro de cada ambiente */
    _loadRoomAct(r, silent) {
      if (!r || !this._hass || typeof this._hass.callWS !== 'function') return;
      const meta = this._actMeta();
      const ids = Object.keys(meta).filter((id) => meta[id].room && meta[id].room.id === r.id);
      const prev = this._roomAct && this._roomAct.room === r.id ? this._roomAct : null;
      const ra = this._roomAct = { room: r.id, ids, meta, events: prev ? prev.events : null, loading: true, sig: this._actSig(ids) };
      if (!silent) this._schedule();
      const { start, end } = this._actRange('today');
      this._fetchLog(ids, start, end).then((evs) => { ra.events = evs; }, () => { ra.events = ra.events || []; })
        .then(() => { ra.loading = false; if (this._roomAct === ra) { ra.sig = this._actSig(ids); this._schedule(); } });
    }

    _hRoomAct(r) {
      if (!this._hass || typeof this._hass.callWS !== 'function') return '';
      // ya no va la lista en cada ambiente (se veía en todos): un botón a la Actividad filtrada por este ambiente.
      // room_activity: true vuelve a mostrar los últimos 6 cambios acá.
      if (this._config.room_activity !== true) {
        return `<div class="blk sh-act"><button class="tbtn" style="width:100%;display:flex;align-items:center;justify-content:center;gap:8px;padding:11px 13px" data-action="roomact" data-id="${esc(r.id)}">${ic('history')} Ver la actividad de este ambiente</button></div>`;
      }
      const ra = this._roomAct;
      if (!ra || ra.room !== r.id) { Promise.resolve().then(() => this._loadRoomAct(r)); return ''; }
      if (!ra.ids.length) return '';
      let body;
      if (!ra.events) body = '<div class="ev-empty" style="padding:16px">Cargando…</div>';
      else if (!ra.events.length) body = '<div class="ev-empty" style="padding:16px">Hoy todavía no hubo cambios en este ambiente.</div>';
      else body = ra.events.slice(0, 6).map((e) => this._evRow(e, ra.meta, { room: false })).join('');
      return `<div class="blk sh-act"><div class="blk-h"><h4>${ic('history')}Actividad de hoy</h4>
        <button class="tbtn" data-action="roomact" data-id="${esc(r.id)}">Ver todo</button></div>${body}</div>`;
    }

    /* ---------- PIN de alarma ---------- */
    _openPin(svc, eid) { this._pin = { svc, eid, code: '' }; this._renderPin(); }
    _renderPin() {
      const w = this._els.pinwrap;
      if (!this._pin) { w.className = 'pin-wrap'; w.innerHTML = ''; return; }
      const p = this._pin;
      w.className = 'pin-wrap open';
      w.innerHTML = `<div class="backdrop" data-action="pincancel"></div><div class="pin glass">
        <div class="pin-ic">${ic('shield')}</div><b>${esc(ALARM_SVC[p.svc] || 'Alarma')}</b><small>Ingresá tu código</small>
        <div class="pdots">${p.code ? p.code.split('').map(() => '<i></i>').join('') : '<em>• • • •</em>'}</div>
        <div class="keys">${['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'ok'].map((k) => `<button class="key ${k === 'ok' ? 'ok' : ''}" data-action="pin" data-k="${k}">${k === 'del' ? '⌫' : k === 'ok' ? ic('check') : k}</button>`).join('')}</div>
        <button class="link" data-action="pincancel">Cancelar</button></div>`;
    }

    /* ---------- acciones ---------- */
    _call(domain, service, data) {
      this._haptic('light');
      try {
        return Promise.resolve(this._hass.callService(domain, service, data)).catch((e) => this._toast(`${ic('alert')} No se pudo completar: ${esc(e && e.message ? e.message : e)}`));
      } catch (e) { this._toast(`${ic('alert')} ${esc(e.message || e)}`); return Promise.resolve(); }
    }
    _haptic(type) { this.dispatchEvent(new CustomEvent('haptic', { detail: type, bubbles: true, composed: true })); }
    _moreInfo(entityId) { this._haptic('medium'); this.dispatchEvent(new CustomEvent('hass-more-info', { detail: { entityId }, bubbles: true, composed: true })); }
    _toast(html) {
      const t = this._els.toast;
      t.innerHTML = html;
      t.classList.add('show');
      clearTimeout(this._tt);
      this._tt = setTimeout(() => t.classList.remove('show'), 2400);
    }
    _confirm(key, label) {
      const now = Date.now();
      if (this._cf === key && now < this._cfUntil) { this._cf = null; return true; }
      this._cf = key; this._cfUntil = now + 3500;
      this._toast(`${ic('alert')} Tocá de nuevo para ${esc(label)}`);
      return false;
    }

    _switchLights(ids, on) {
      const byDom = {};
      ids.forEach((id) => { (byDom[dom(id)] = byDom[dom(id)] || []).push(id); });
      Object.entries(byDom).forEach(([d, list]) => this._call(d, on ? 'turn_on' : 'turn_off', { entity_id: list }));
    }
    _roomLights(r, on) { if (r) this._switchLights(on ? r.lightsCtl : r.lightsOn, on); }
    _allOff() {
      const ids = [...new Set(this._m.rooms.flatMap((r) => r.lightsOn))];
      if (!ids.length) return this._toast(`${ic('check')} Las luces ya están apagadas`);
      this._switchLights(ids, false);
      this._toast(`${ic('moon')} Apagando ${ids.length} ${ids.length > 1 ? 'luces' : 'luz'}`);
    }
    _alarm(svc, eid) {
      const a = (eid && this._hass.states[eid]) || this._m.alarm; if (!a) return;
      const fmtc = a.attributes.code_format;
      const need = fmtc && (svc === 'alarm_disarm' || a.attributes.code_arm_required !== false);
      if (need) return this._openPin(svc, a.entity_id);
      this._call('alarm_control_panel', svc, { entity_id: a.entity_id });
    }
    _access(eid) {
      const st = this._hass.states[eid]; if (!st) return;
      if (dom(eid) === 'lock') {
        if (st.state !== 'locked') return this._call('lock', 'lock', { entity_id: eid });
        if (this._confirm(eid, 'destrabar')) this._call('lock', 'unlock', { entity_id: eid });
        return;
      }
      const open = ['open', 'opening'].includes(st.state);
      if (this._confirm(eid, open ? 'cerrar' : 'abrir')) this._call('cover', open ? 'close_cover' : 'open_cover', { entity_id: eid });
    }
    _bumpTemp(eid, dir) {
      const a = this._hass.states[eid].attributes;
      const step = a.target_temp_step || 0.5;
      const cur = this._pt[eid] != null ? this._pt[eid] : a.temperature != null ? a.temperature : 22;
      let v = Math.round((cur + dir * step) / step) * step;
      v = Math.min(a.max_temp != null ? a.max_temp : 35, Math.max(a.min_temp != null ? a.min_temp : 7, v));
      this._pt[eid] = v;
      this._haptic('selection');
      this._renderSheet();
      clearTimeout(this._ptT[eid]);
      this._ptT[eid] = setTimeout(() => {
        this._call('climate', 'set_temperature', { entity_id: eid, temperature: v })
          .then(() => setTimeout(() => { if (this._pt[eid] === v) { delete this._pt[eid]; this._schedule(); } }, 4000));
      }, 700);
    }
    _climPower(eid) {
      const st = this._hass.states[eid], a = st.attributes;
      if (st.state !== 'off') return this._call('climate', 'set_hvac_mode', { entity_id: eid, hvac_mode: 'off' });
      if ((a.supported_features || 0) & 256) return this._call('climate', 'turn_on', { entity_id: eid });
      const modes = (a.hvac_modes || []).filter((x) => x !== 'off');
      this._call('climate', 'set_hvac_mode', { entity_id: eid, hvac_mode: modes.includes('heat_cool') ? 'heat_cool' : modes[0] || 'auto' });
    }
    _runSuggestion(key) {
      const s = (this._sugs || []).find((x) => x.key === key); if (!s) return;
      const r = s.id && this._m.byId[s.id];
      if (s.act === 'alloff') this._allOff();
      else if (s.act === 'arm') this._alarm('alarm_arm_away');
      else if (s.act === 'roomoff') this._roomLights(r, false);
      else if (s.act === 'climoff' && r) r.climOn.forEach((id) => this._call('climate', 'set_hvac_mode', { entity_id: id, hvac_mode: 'off' }));
      this._dismissed.add(key);
      this._schedule();
    }

    _onClick(e) {
      // después de mantener apretado no se ejecuta además el toque
      if (this._holdFired && Date.now() - this._holdFired < 900) { this._holdFired = 0; e.preventDefault(); return; }
      // franja de la línea de tiempo: mostrar desde/hasta
      const seg = e.target.closest && e.target.closest('[data-seg]');
      if (seg && seg.dataset && seg.dataset.info != null) { const tl = seg.closest('.tl'), info = tl && tl.querySelector('.tl-info'); if (info) { info.textContent = seg.dataset.info; info.classList.add('on'); } return; }
      const t = e.target.closest('[data-action]');
      if (!t || !this._m) return;
      const d = t.dataset, a = d.action;
      if (a && a.startsWith('m_')) { if (this._mus && !(this._musSwiped && Date.now() - this._musSwiped < 350)) this._musAction(a.slice(2), d, t); return; }
      switch (a) {
        case 'room': this._openRoom(d.id); break;
        case 'panel': this._openPanel(d.v); break;
        // Agenda
        case 'agmonth': if (this._ag) {
          const mm = this._ag.month; let nm = mm.m + Number(d.d), ny = mm.y;
          if (nm < 0) { nm = 11; ny--; } if (nm > 11) { nm = 0; ny++; }
          this._ag.month = { y: ny, m: nm };
          const now = new Date();
          this._ag.sel = ny === now.getFullYear() && nm === now.getMonth() ? ymd(now) : ymd(new Date(ny, nm, 1));
          this._ag.loading = true; this._agRender(); this._loadAgenda();
        } break;
        case 'agtoday': if (this._ag) {
          const now = new Date(), same = this._ag.month.y === now.getFullYear() && this._ag.month.m === now.getMonth();
          this._ag.month = { y: now.getFullYear(), m: now.getMonth() }; this._ag.sel = ymd(now);
          if (same) this._agRender(); else { this._ag.loading = true; this._agRender(); this._loadAgenda(); }
        } break;
        case 'agsel': if (this._ag) {
          this._ag.sel = d.v;
          const sd = new Date(`${d.v}T00:00:00`);
          if (sd.getMonth() !== this._ag.month.m) { this._ag.month = { y: sd.getFullYear(), m: sd.getMonth() }; this._ag.loading = true; this._agRender(); this._loadAgenda(); } else this._agRender();
        } break;
        case 'agnew': if (this._ag) { this._ag.form = this._agForm(d.v); this._agForceRender(); this._els.sheet.scrollTop = 0; } break;
        case 'agcancel': if (this._ag) { this._ag.form = null; this._agForceRender(); } break;
        case 'agsave': this._agSave(); break;
        case 'agset': if (this._ag && this._ag.form) { const f = this._ag.form; f[d.f] = d.f === 'critical' || d.f === 'allDay' ? d.v === '1' : d.v; this._agForceRender(); } break;
        case 'agday': if (this._ag && this._ag.form) { const ds = this._ag.form.days; const i = ds.indexOf(d.v); if (i >= 0) ds.splice(i, 1); else ds.push(d.v); this._agForceRender(); } break;
        case 'agrcp': if (this._ag && this._ag.form) { const rs = this._ag.form.recipients; const i = rs.indexOf(d.v); if (i >= 0) rs.splice(i, 1); else rs.push(d.v); this._agForceRender(); } break;
        case 'agtoggle': {
          const r = this._ag && (this._ag.rems || []).find((x) => x.id === d.id);
          if (r) Promise.resolve(this._hass.callWS({ type: 'matterai_escenas/set_enabled', rule_id: r.id, enabled: !(r.enabled !== false && !(r.ui || {}).done) })).catch((e) => this._toast(`${ic('alert')} ${esc(e.message || e)}`));
          break;
        }
        case 'agdel':
          if (this._confirm(`del-${d.id}`, 'borrar')) Promise.resolve(this._hass.callWS({ type: 'matterai_escenas/delete', rule_id: d.id })).then(() => this._toast(`${ic('check')} Borrado`), (e) => this._toast(`${ic('alert')} ${esc(e.message || e)}`));
          break;
        case 'popt': this._panelOpt = d.v; if (this._panel === 'temp' || this._panel === 'hum') this._panel = d.v; this._cache.sheetdyn = null; this._renderSheet(); this._els.sheet.scrollTop = 0; break;
        case 'close': this._closeRoom(); break;
        case 'roomlights': { const r = this._m.byId[d.id]; this._roomLights(r, !r.lightsOn.length); break; }
        case 'roomall': this._roomLights(this._m.byId[d.id], d.on === '1'); break;
        case 'alloff': this._allOff(); break;
        case 'scene': {
          this._call(dom(d.eid), 'turn_on', { entity_id: d.eid });
          t.classList.remove('fired'); void t.offsetWidth; t.classList.add('fired');
          this._toast(`${ic('sparkle')} <b>${esc(this._name(d.eid))}</b>&nbsp;activada`);
          break;
        }
        case 'alarm': this._alarm(d.svc, d.eid); break;
        case 'toggle': this._call(dom(d.eid), 'toggle', { entity_id: d.eid }); break;
        case 'zone': {
          const z = this._planZones()[Number(d.i)]; if (!z) break;
          const ids = this._zoneEnts(z);
          if (!ids.length) { this._toast(`${ic('alert')} <b>${esc(z.name || 'Este espacio')}</b>&nbsp;no tiene luces asignadas`); break; }
          const S = this._hass.states, on = ids.some((id) => ['on', 'open'].includes(S[id].state));
          this._call('homeassistant', on ? 'turn_off' : 'turn_on', { entity_id: ids });
          t.classList.toggle('on', !on); this._haptic('light');
          this._toast(`${ic('bulb')} <b>${esc(z.name || '')}</b>&nbsp;${on ? 'apagado' : 'encendido'}`);
          break;
        }
        case 'pdev': { // equipo sobre el plano: luces y enchufes se prenden/apagan; lo demás abre su ventana
          const dm = dom(d.eid);
          if (['light', 'switch', 'fan', 'input_boolean', 'media_player'].includes(dm)) {
            this._call(dm, dm === 'media_player' ? 'media_play_pause' : 'toggle', { entity_id: d.eid });
            t.classList.toggle('on'); this._haptic('light');
          } else if (dm === 'cover' && !['garage', 'gate'].includes((this._hass.states[d.eid].attributes || {}).device_class)) {
            this._call('cover', 'toggle', { entity_id: d.eid }); this._haptic('light');
          } else this._moreInfo(d.eid); // portones, cerraduras y clima: con su ventana (no se abren con un toque suelto)
          break;
        }
        case 'run': {
          const dm = dom(d.eid);
          this._call(dm, dm === 'button' || dm === 'input_button' ? 'press' : 'turn_on', { entity_id: d.eid });
          t.classList.add('on'); setTimeout(() => t.classList.remove('on'), 900);
          this._toast(`${ic('sparkle')} <b>${esc(this._name(d.eid))}</b>&nbsp;en marcha`);
          break;
        }
        case 'automations': this.dispatchEvent(new CustomEvent('matterai-automations', { bubbles: true, composed: true })); break;
        case 'pin': {
          const p = this._pin; if (!p) break;
          if (d.k === 'del') p.code = p.code.slice(0, -1);
          else if (d.k === 'ok') {
            if (!p.code) break;
            this._call('alarm_control_panel', p.svc, { entity_id: p.eid || this._m.alarm.entity_id, code: p.code });
            this._pin = null;
          } else if (p.code.length < 12) { p.code += d.k; this._haptic('selection'); }
          this._renderPin();
          break;
        }
        case 'pincancel': this._pin = null; this._renderPin(); break;
        case 'cover': this._call('cover', d.svc, { entity_id: d.eid }); break;
        case 'temp': this._bumpTemp(d.eid, Number(d.d)); break;
        case 'hvac': this._call('climate', 'set_hvac_mode', { entity_id: d.eid, hvac_mode: d.mode }); break;
        case 'clpower': this._climPower(d.eid); break;
        case 'media': this._call('media_player', d.svc, { entity_id: d.eid }); break;
        case 'access': this._access(d.eid); break;
        case 'more': {
          // Cámaras con Advanced Camera Card (eventos de Frigate): la app la abre a pantalla completa.
          const cc = this._config.camera_card;
          if (cc && dom(d.eid) === 'camera') {
            const ev = new CustomEvent('matterai-camera-card', { detail: { config: cc, camera: d.eid }, bubbles: true, composed: true, cancelable: true });
            if (!this.dispatchEvent(ev)) break;
          }
          this._moreInfo(d.eid);
          break;
        }
        case 'sug': this._runSuggestion(d.key); break;
        case 'dismiss': this._dismissed.add(d.key); this._schedule(); break;
        case 'fpcopy': this._copyYaml(); break;
        // Música
        case 'ctab':
          this._ctab = d.v === 'seg' ? 'seg' : 'casa';
          try { localStorage.setItem('matterai.tab', this._ctab); } catch (_) { /* sin almacenamiento */ }
          this._pauseCams(this._ctab !== 'seg');
          this._update();
          break;
        case 'voice': this._voiceStart(); break;
        case 'voiceclose': this._voiceStop(true); break;
        case 'handsfree': { const on = !this._hfEnabled(); this._voiceStop(true); this._hfSet(on); break; }
        case 'music': this.openMusic(); break;
        case 'musclose': this._closeMusic(); break;
        // Actividad
        case 'act': this.openActivity(); break;
        case 'roomact': this.openActivity({ room: d.id }); break;
        case 'actclose': this._closeAct(); break;
        case 'actperiod': if (this._act && this._act.period !== d.v) { this._act.period = d.v; this._act.stale = !!this._act.events; this._act.shown = 150; this._loadAct(); } break;
        case 'actnav': if (this._act) { const np = MatterAIHomeCard.shiftPeriod(this._act.period, Number(d.d)); if (np !== this._act.period) { this._act.period = np; this._act.stale = !!this._act.events; this._act.shown = 150; this._loadAct(); } } break;
        case 'actcat': if (this._act) { this._act.cat = d.v; this._act.shown = 150; this._renderAct(); } break;
        case 'actroom': if (this._act) { this._act.room = d.v || null; this._act.shown = 150; this._renderAct(); } break;
        case 'actentsp': if (this._act) { this._act.entsOpen = !this._act.entsOpen; this._renderAct(); } break;
        case 'actentx': if (this._act) { const L = this._act.ents = this._act.ents || [], i = L.indexOf(d.v); if (i >= 0) L.splice(i, 1); else L.push(d.v); this._act.shown = 150; this._renderAct(); } break;
        case 'actentclear': if (this._act) { this._act.ents = []; this._act.shown = 150; this._renderAct(); } break;
        case 'actent': if (this._act) { this._act.from = { cat: this._act.cat, room: this._act.room, top: this._els.act.scrollTop }; this._act.entity = d.eid; this._act.typing = 0; this._renderAct(); this._els.act.scrollTop = 0; this._loadEntHist(); } break;
        case 'actback': if (this._act) { const f = this._act.from || {}; this._act.entity = null; this._renderAct(); this._els.act.scrollTop = f.top || 0; } break;
        case 'actmore': if (this._act) { this._act.shown += 150; this._renderAct(); } break;
        case 'camfull': {
          const ev = new CustomEvent('matterai-camera-card', { detail: { config: this._config.camera_card }, bubbles: true, composed: true, cancelable: true });
          if (this.dispatchEvent(ev) && this._m.cams[0]) this._moreInfo(this._m.cams[0]);
          break;
        }
        case 'menu': this.dispatchEvent(new CustomEvent('matterai-menu', { bubbles: true, composed: true })); break;
        default: break;
      }
    }

    /* Píldoras: tocar = prender/apagar · deslizar = brillo · mantener = más info */
    _onDown(e) {
      const fp = e.target.closest('[data-fp]');
      if (fp && this._els.stage) {
        e.preventDefault();
        this._fpDrag = { el: fp, id: fp.dataset.fp, pid: e.pointerId, rect: this._els.stage.getBoundingClientRect() };
        try { fp.setPointerCapture(e.pointerId); } catch (_) { /* noop */ }
        return;
      }
      const p = e.target.closest('[data-pill]');
      if (!p) {
        // Mantener apretado cualquier dispositivo (cortina, portón, aire, tele, sensor, persona…) → su ventana con historial
        const hEl = e.target.closest('[data-eid],[data-hold-room]');
        if (hEl && e.button <= 0 && !hEl.closest('.actv')) {
          clearTimeout(this._holdT);
          this._hold = { eid: hEl.dataset.eid, room: hEl.dataset.holdRoom, x0: e.clientX, y0: e.clientY, pid: e.pointerId };
          this._holdT = setTimeout(() => {
            const hd = this._hold; this._hold = null;
            if (!hd) return;
            this._holdFired = Date.now();
            if (hd.room) { this._haptic('medium'); this._openRoom(hd.room); } else this._moreInfo(hd.eid);
          }, 550);
        }
        return;
      }
      if (e.button > 0) return;
      this._drag = { el: p, eid: p.dataset.eid, dim: p.dataset.dim === '1', x0: e.clientX, y0: e.clientY, rect: p.getBoundingClientRect(), moved: false, t0: Date.now(), pid: e.pointerId, pct: null };
      clearTimeout(this._lp);
      this._lp = setTimeout(() => {
        const dd = this._drag;
        if (dd && !dd.moved) { this._drag = null; this._moreInfo(dd.eid); this._flushSheet(); }
      }, 550);
    }
    _onMove(e) {
      const hd = this._hold;
      if (hd && e.pointerId === hd.pid && Math.hypot(e.clientX - hd.x0, e.clientY - hd.y0) > 10) { clearTimeout(this._holdT); this._hold = null; }
      const f = this._fpDrag;
      if (f && e.pointerId === f.pid) {
        const r1 = (v) => Math.round(Math.min(100, Math.max(0, v)) * 10) / 10;
        const x = r1((e.clientX - f.rect.left) / f.rect.width * 100), y = r1((e.clientY - f.rect.top) / f.rect.height * 100);
        const p = this._fpPos[f.id] || (this._fpPos[f.id] = { r: 14 });
        p.x = x; p.y = y; delete p.auto; if (f.id.startsWith('dev:')) p.fixed = true;
        f.el.style.left = x + '%'; f.el.style.top = y + '%';
        const g = [...this._els.planfx.querySelectorAll('[data-gid]')].find((el) => el.dataset.gid === f.id);
        if (g) { g.style.left = x + '%'; g.style.top = y + '%'; }
        return;
      }
      const d = this._drag; if (!d || e.pointerId !== d.pid) return;
      const dx = e.clientX - d.x0, dy = e.clientY - d.y0;
      if (!d.moved) {
        if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) return this._cancelDrag();
        if (Math.abs(dx) > 8) {
          clearTimeout(this._lp);
          if (!d.dim) return this._cancelDrag();
          d.moved = true;
          try { d.el.setPointerCapture(d.pid); } catch (_) { /* noop */ }
          d.el.classList.add('dragging', 'on');
        } else return;
      }
      const pct = Math.min(100, Math.max(1, Math.round((e.clientX - d.rect.left) / d.rect.width * 100)));
      d.pct = pct;
      d.el.style.setProperty('--b', pct + '%');
      const s = d.el.querySelector('.st'); if (s) s.textContent = pct + '%';
    }
    _onUp(e) {
      if (this._hold && e.pointerId === this._hold.pid) { clearTimeout(this._holdT); this._hold = null; }
      if (this._fpDrag && e.pointerId === this._fpDrag.pid) {
        this._fpDrag = null;
        delete this._cache.planfx;
        this._schedule();
        return;
      }
      const d = this._drag; if (!d || e.pointerId !== d.pid) return;
      clearTimeout(this._lp);
      this._drag = null;
      if (d.moved) {
        if (d.pct != null) this._call('light', 'turn_on', { entity_id: d.eid, brightness_pct: d.pct });
      } else if (Date.now() - d.t0 < 550) {
        d.el.classList.add('busy');
        this._call(dom(d.eid), 'toggle', { entity_id: d.eid });
      }
      this._flushSheet();
    }
    _cancelDrag() { clearTimeout(this._lp); clearTimeout(this._holdT); this._hold = null; this._drag = null; if (this._fpDrag) { this._fpDrag = null; delete this._cache.planfx; this._schedule(); } this._flushSheet(); }
    _flushSheet() { if (this._sheetDirty) { this._sheetDirty = false; this._schedule(); } }
  }


  /* ======================================================================================
   * Editor visual de la tarjeta (el de Home Assistant: ✏️ Editar panel → la tarjeta).
   * Sólo lo ven los administradores de HA (el instalador): los clientes no pueden editar paneles.
   * La app MatterAI lee la configuración guardada en ese panel, así que se actualiza sola.
   * ====================================================================================== */
  const ROOM_ICONS = ['sofa', 'bed', 'pot', 'dining', 'bath', 'laundry', 'desk', 'tv', 'music', 'garage', 'door', 'tree', 'sparkle', 'home'];
  const FEAT_LABELS = [['lights', 'Luces'], ['openings', 'Puertas y ventanas'], ['security', 'Alarma y accesos'], ['people', 'Quiénes están'], ['cameras', 'Cámaras'],
    ['music', 'Música'], ['weather', 'Clima'], ['agenda', 'Agenda (tocar la hora)'], ['activity', 'Actividad'], ['automations', 'Automatizaciones'], ['energy', 'Consumo'], ['suggestions', 'Sugerencias']];
  const DOM_ICON = { light: 'bulb', switch: 'power', cover: 'blind', climate: 'snow', fan: 'fan', media_player: 'tv', camera: 'cam', lock: 'lock', sensor: 'thermo',
    binary_sensor: 'motion', person: 'user', device_tracker: 'user', scene: 'sparkle', script: 'play', alarm_control_panel: 'shield', weather: 'sun', button: 'play',
    input_button: 'play', input_boolean: 'power', automation: 'sparkle', calendar: 'cal' };
  const ROOM_DOMAINS = ['light', 'switch', 'cover', 'climate', 'fan', 'media_player', 'lock', 'camera', 'sensor', 'binary_sensor', 'scene', 'script', 'button', 'input_button', 'input_boolean', 'automation'];
  const BLOCK_LABELS = { resumen: 'Resumen', sugerencias: 'Sugerencias', personas: 'Quiénes están', modos: 'Modos (botones rápidos)', ambientes: 'Ambientes', seguridad: 'Seguridad', camaras: 'Cámaras' };
  const COL_LABELS = { left: 'Izquierda', center: 'Centro (debajo del plano)', right: 'Derecha' };
  const clone = (o) => JSON.parse(JSON.stringify(o == null ? {} : o));
  const r1 = (v) => Math.round(Math.min(100, Math.max(0, v)) * 10) / 10;

  const ED_CSS = `
  :host{display:block;color:var(--primary-text-color,#e8eaf0);font:14px/1.45 var(--paper-font-body1_-_font-family,system-ui,sans-serif)}
  .ic{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;flex:none}
  .tabs{display:flex;gap:4px;flex-wrap:wrap;margin-bottom:14px;border-bottom:1px solid var(--divider-color,rgba(255,255,255,.12));padding-bottom:8px}
  .tabs button{display:flex;align-items:center;gap:6px;padding:7px 12px;border-radius:999px;border:0;background:none;color:inherit;font:inherit;cursor:pointer;opacity:.7}
  .tabs button.on{background:var(--primary-color,#2f6bff);color:#fff;opacity:1}
  .tabs button:hover{opacity:1}
  h3{margin:18px 0 8px;font-size:14px;letter-spacing:.04em}
  p.h{margin:4px 0 10px;font-size:12.5px;opacity:.7}
  label.f{display:block;margin:10px 0}
  label.f>span{display:block;font-size:12.5px;opacity:.75;margin-bottom:4px}
  input[type=text],input:not([type]),input[type=number],select{width:100%;box-sizing:border-box;padding:9px 11px;border-radius:10px;border:1px solid var(--divider-color,rgba(255,255,255,.18));
    background:var(--card-background-color,rgba(255,255,255,.04));color:inherit;font:inherit}
  input:focus,select:focus{outline:2px solid var(--primary-color,#2f6bff);outline-offset:-1px}
  button.b{display:inline-flex;align-items:center;gap:6px;padding:8px 13px;border-radius:10px;border:1px solid var(--divider-color,rgba(255,255,255,.18));
    background:var(--card-background-color,rgba(255,255,255,.05));color:inherit;font:inherit;cursor:pointer}
  button.b:hover{border-color:var(--primary-color,#2f6bff)}
  button.b.pri{background:var(--primary-color,#2f6bff);border-color:transparent;color:#fff}
  button.b.del{color:var(--error-color,#ff5c6c)}
  button.i{width:32px;height:32px;display:inline-grid;place-items:center;border-radius:8px;border:0;background:none;color:inherit;cursor:pointer;opacity:.7}
  button.i:hover{opacity:1;background:rgba(127,127,127,.15)}button.i:disabled{opacity:.2;cursor:default;background:none}
  .row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
  .seg{display:inline-flex;border:1px solid var(--divider-color,rgba(255,255,255,.18));border-radius:10px;overflow:hidden}
  .seg button{padding:7px 12px;border:0;background:none;color:inherit;font:inherit;cursor:pointer}
  .seg button.on{background:var(--primary-color,#2f6bff);color:#fff}
  .el{display:flex;flex-direction:column;gap:6px}
  .er{display:flex;align-items:center;gap:8px;padding:6px 6px 6px 10px;border-radius:10px;background:rgba(127,127,127,.08)}
  .er .en{flex:1;min-width:0}.er .en b{display:block;font-weight:600;overflow-wrap:anywhere;line-height:1.25}
  .er .en small{display:block;font-size:11.5px;opacity:.6;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .er input.nm{width:clamp(110px,30%,190px);flex:none;padding:6px 9px}
  .er>button{flex:none}
  /* editor angosto (al lado de la vista previa o en el celular): nada se pisa */
  .edw{container:maed/inline-size}
  @container maed (max-width:430px){.er{flex-wrap:wrap}.er input.nm{width:100%;order:3}}
  .eg{display:flex;align-items:center;gap:8px;margin:10px 0 2px;font-size:13px;opacity:.85}.eg .ic{width:16px;height:16px}
  .er.miss{outline:1px dashed var(--error-color,#ff5c6c)}
  .eadd{display:flex;gap:8px;margin-top:4px}.eadd input{flex:1}
  /* ambientes arriba como botones; el ambiente elegido abajo con todo el ancho (los nombres se leen completos) */
  .rooms{display:block}
  .rooms>div{min-width:0}
  .rl{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px;padding-bottom:14px;border-bottom:1px solid var(--divider-color,rgba(255,255,255,.12))}
  .rl button.r{display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:10px;border:0;background:rgba(127,127,127,.08);color:inherit;font:inherit;text-align:left;cursor:pointer}
  .rl button.r.on{background:var(--primary-color,#2f6bff);color:#fff}
  .rl button.r small{margin-left:4px;opacity:.7}
  .icons{display:flex;flex-wrap:wrap;gap:6px}
  .icons button{width:38px;height:38px;display:grid;place-items:center;border-radius:10px;border:1px solid var(--divider-color,rgba(255,255,255,.18));background:none;color:inherit;cursor:pointer}
  .icons button.on{background:var(--primary-color,#2f6bff);color:#fff;border-color:transparent}
  .stage{position:relative;width:100%;border-radius:12px;overflow:hidden;background:#0a0d18;user-select:none;-webkit-user-select:none;touch-action:none;cursor:crosshair;aspect-ratio:16/10}
  .stage img{position:absolute;inset:0;width:100%;height:100%;object-fit:fill;pointer-events:none}
  .stage .noimg{position:absolute;inset:0;display:grid;place-items:center;text-align:center;padding:20px;color:#aab;font-size:13px}
  .z{position:absolute;border:2px solid rgba(124,156,255,.9);background:rgba(124,156,255,.18);border-radius:6px;cursor:move;box-sizing:border-box}
  .z.on{border-color:#ffb547;background:rgba(255,181,71,.22);z-index:2}
  .z span{position:absolute;left:4px;top:3px;font-size:11px;font-weight:700;color:#fff;text-shadow:0 1px 3px #000;white-space:nowrap;pointer-events:none}
  .z i{position:absolute;right:-6px;bottom:-6px;width:14px;height:14px;border-radius:4px;background:#ffb547;cursor:nwse-resize}
  .z.draft{border-style:dashed;pointer-events:none}
  .zl{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0}
  .zl button{padding:6px 11px;border-radius:999px;border:1px solid var(--divider-color,rgba(255,255,255,.18));background:none;color:inherit;font:inherit;cursor:pointer}
  .zl button.on{background:#ffb547;color:#1d1306;border-color:transparent}
  .box{padding:12px;border-radius:12px;border:1px solid var(--divider-color,rgba(255,255,255,.12));margin-top:10px}
  .feat{display:grid;grid-template-columns:1fr auto;gap:8px 12px;align-items:center}
  .feat small{display:block;font-size:11.5px;opacity:.6}
  .ok{color:#3ecf8e}.no{opacity:.55}
  .lay{display:grid;gap:10px}
  @media (max-width:640px){.lay{grid-template-columns:1fr!important}}
  .lcol{padding:10px;border-radius:12px;border:1px dashed var(--divider-color,rgba(255,255,255,.2));min-height:80px}
  .lcol h3{margin:0 0 8px;font-size:12.5px;opacity:.75}
  .lb{display:flex;flex-direction:column;gap:4px;padding:8px 10px;margin-bottom:6px;border-radius:10px;background:rgba(127,127,127,.12)}
  .lb span{display:flex;gap:2px}.lb button.i{width:28px;height:28px}
  button.i.flip .ic{transform:rotate(180deg)}
  .warn{padding:9px 12px;border-radius:10px;background:rgba(255,176,77,.12);border:1px solid rgba(255,176,77,.35);font-size:12.5px;margin:8px 0}
  `;

  class MatterAIHomeCardEditor extends HTMLElement {
    constructor() {
      super();
      this._tab = 'general'; this._room = 0; this._zone = -1;
      this._root = this.attachShadow ? this.attachShadow({ mode: 'open' }) : null;
    }
    setConfig(c) {
      const j = JSON.stringify(c || {});
      this._cfg = clone(c);
      if (j === this._lastEmit) return; // es lo que acabamos de mandar: no redibujar (no se pierde lo que estás escribiendo)
      this._render();
    }
    set hass(h) { const first = !this._hass; this._hass = h; if (first) this._render(); }
    get hass() { return this._hass; }

    /* ---------- datos ---------- */
    _get(path) { return String(path).split('.').reduce((o, k) => (o == null ? undefined : o[k]), this._cfg); }
    _put(path, val) {
      const ks = String(path).split('.'); let o = this._cfg;
      ks.slice(0, -1).forEach((k, i) => { if (o[k] == null || typeof o[k] !== 'object') o[k] = /^\d+$/.test(ks[i + 1]) ? [] : {}; o = o[k]; });
      const last = ks[ks.length - 1];
      if (val === undefined || val === '' || val === null) { if (Array.isArray(o)) o.splice(Number(last), 1); else delete o[last]; } else o[last] = val;
    }
    _emit(render = true) {
      this._lastEmit = JSON.stringify(this._cfg);
      this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: clone(this._cfg) }, bubbles: true, composed: true }));
      if (render) this._render();
    }
    _st(id) { return this._hass && this._hass.states ? this._hass.states[id] : null; }
    _fname(id) { const s = this._st(id); return (s && s.attributes.friendly_name) || id; }
    _ents(domains) { const S = (this._hass && this._hass.states) || {}; return Object.keys(S).filter((id) => !domains || domains.includes(id.split('.')[0])).sort(); }
    _eid(x) { return x && typeof x === 'object' ? x.entity : x; }

    /** Arma los ambientes a partir de las Áreas de HA (con sus entidades): punto de partida para ordenar a mano. */
    _fromAreas() {
      const h = this._hass || {}, areas = h.areas || {}, ents = h.entities || {}, devs = h.devices || {}, S = h.states || {};
      const rooms = Object.values(areas).map((a) => ({ name: a.name || a.area_id, icon: roomIcon(a.name || ''), entities: [] }));
      const byArea = {}; Object.values(areas).forEach((a, i) => { byArea[a.area_id] = rooms[i]; });
      Object.keys(S).sort().forEach((id) => {
        const e = ents[id] || {}; if (e.hidden || e.hidden_by || e.entity_category) return;
        if (!ROOM_DOMAINS.includes(id.split('.')[0])) return;
        const aid = e.area_id || (devs[e.device_id] || {}).area_id; const r = aid && byArea[aid];
        if (r) r.entities.push(id);
      });
      return rooms.filter((r) => r.entities.length);
    }

    /* ---------- piezas ---------- */
    _dl(id, domains) { return `<datalist id="${id}">${this._ents(domains).map((e) => `<option value="${esc(e)}">${esc(this._fname(e))}</option>`).join('')}</datalist>`; }
    /** Lista de entidades editable: nombre propio opcional, ordenar, quitar y agregar buscando. */
    _entList(path, domains, opts = {}) {
      const list = this._get(path) || [], dlid = `dl-${path.replace(/\W/g, '_')}`;
      // Las cámaras se ven juntas en un solo bloque de la app: en el editor van agrupadas y se ordenan entre ellas
      const isCam = (x) => opts.groupCams && String(this._eid(x)).startsWith('camera.');
      const idx = list.map((_, i) => i), others = idx.filter((i) => !isCam(list[i])), cams = idx.filter((i) => isCam(list[i]));
      const row = (i, group) => {
        const x = list[i], k = group.indexOf(i), prev = k > 0 ? group[k - 1] : -1, next = k < group.length - 1 ? group[k + 1] : -1;
        const id = this._eid(x), nm = x && typeof x === 'object' ? x.name || '' : '', ok = !!this._st(id);
        return `<div class="er ${ok ? '' : 'miss'}">${ic(DOM_ICON[String(id).split('.')[0]] || 'sparkle')}
          <div class="en"><b>${esc(nm || this._fname(id))}</b><small>${esc(id)}${ok ? '' : ' · no existe'}</small></div>
          ${opts.names === false ? '' : `<input class="nm" data-name="${esc(path)}" data-i="${i}" placeholder="Nombre propio" value="${esc(nm)}">`}
          <button class="i" data-a="mv" data-path="${esc(path)}" data-i="${i}" data-j="${prev}" ${prev < 0 ? 'disabled' : ''} title="Subir">${ic('up')}</button>
          <button class="i" data-a="mv" data-path="${esc(path)}" data-i="${i}" data-j="${next}" ${next < 0 ? 'disabled' : ''} title="Bajar">${ic('down')}</button>
          <button class="i" data-a="rm" data-path="${esc(path)}" data-i="${i}" title="Quitar">${ic('x')}</button></div>`;
      };
      const rows = others.map((i) => row(i, others)).join('') + (cams.length
        ? `<div class="eg">${ic('cam')}<span><b>Cámaras</b> · en la app se ven juntas en un solo bloque, en este orden</span></div>${cams.map((i) => row(i, cams)).join('')}` : '');
      return `<div class="el">${rows || '<p class="h">Ninguna todavía.</p>'}
        <div class="eadd"><input list="${dlid}" data-add="${esc(path)}" placeholder="${esc(opts.ph || 'Agregar: escribí para buscar una entidad…')}">${this._dl(dlid, domains)}</div></div>`;
    }
    _sel(path, options, val) { return `<select data-f="${esc(path)}">${options.map(([v, l]) => `<option value="${esc(v)}" ${String(val == null ? '' : val) === String(v) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`; }
    _txt(path, label, ph, hint) { return `<label class="f"><span>${esc(label)}</span><input data-f="${esc(path)}" value="${esc(this._get(path) == null ? '' : this._get(path))}" placeholder="${esc(ph || '')}">${hint ? `<p class="h">${hint}</p>` : ''}</label>`; }

    /* ---------- pestañas ---------- */
    _tGeneral() {
      const c = this._cfg, wx = this._ents(['weather']);
      const scenesMode = c.scenes === false ? 'off' : Array.isArray(c.scenes) ? 'list' : 'auto';
      return `${this._txt('installer', 'Tu marca (instalador)', 'MatterAI')}
        ${this._txt('support_phone', 'WhatsApp de soporte', '5491100000000', 'Con código de país, sin espacios. Aparece el botón "Soporte técnico".')}
        ${this._txt('logo', 'Logo (opcional)', '/local/matterai-home/logo.png')}
        <label class="f"><span>Clima</span>${this._sel('weather', [['', 'Automático'], ['__off', 'No mostrar'], ...wx.map((w) => [w, this._fname(w)])], c.weather === false ? '__off' : c.weather || '')}</label>
        <h3>Personas</h3><p class="h">Quiénes aparecen en "Quiénes están". Vacío = todas las personas de HA.</p>
        ${this._entList('people', ['person', 'device_tracker'])}
        <h3>Escenas en "Modos"</h3>
        <div class="seg">${[['auto', 'Automático'], ['list', 'Elegir'], ['off', 'Ninguna']].map(([k, l]) => `<button data-a="scenes" data-v="${k}" class="${scenesMode === k ? 'on' : ''}">${l}</button>`).join('')}</div>
        ${scenesMode === 'list' ? `<div class="box">${this._entList('scenes', ['scene', 'script'], { names: true })}</div>` : ''}`;
    }
    _tRooms() {
      const c = this._cfg, manual = Array.isArray(c.rooms);
      let h = `<p class="h">Automático: un ambiente por cada Área de Home Assistant. Manual: vos elegís los ambientes, el orden y qué entidades van en cada uno.</p>
        <div class="row"><div class="seg"><button data-a="rmode" data-v="auto" class="${manual ? '' : 'on'}">Automático (Áreas)</button><button data-a="rmode" data-v="manual" class="${manual ? 'on' : ''}">Manual</button></div></div>`;
      if (!manual) return h;
      const rooms = c.rooms; if (this._room >= rooms.length) this._room = Math.max(0, rooms.length - 1);
      const r = rooms[this._room];
      h += `<div class="rooms" style="margin-top:12px"><div class="rl">
        ${rooms.map((x, i) => `<button class="r ${i === this._room ? 'on' : ''}" data-a="room" data-i="${i}">${ic(x.icon || roomIcon(x.name))}<span>${esc(x.name || 'Sin nombre')}</span><small>${(x.entities || []).length}</small></button>`).join('')}
        <button class="b" data-a="radd">${ic('plus')} Agregar ambiente</button>
        <button class="b" data-a="rimport" title="Reemplaza la lista por los ambientes de las Áreas">${ic('history')} Traer desde Áreas</button></div><div>`;
      if (!r) return h + '<p class="h">Agregá un ambiente o traelos desde las Áreas.</p></div></div>';
      h += `<div class="row" style="justify-content:space-between"><h3 style="margin:0">Ambiente</h3><div>
          <button class="i" data-a="rmv" data-d="-1" ${this._room ? '' : 'disabled'} title="Subir">${ic('up')}</button>
          <button class="i" data-a="rmv" data-d="1" ${this._room < rooms.length - 1 ? '' : 'disabled'} title="Bajar">${ic('down')}</button>
          <button class="b del" data-a="rdel">${ic('trash')} Borrar</button></div></div>
        ${this._txt(`rooms.${this._room}.name`, 'Nombre', 'Living')}
        <label class="f"><span>Ícono</span><div class="icons">${ROOM_ICONS.map((k) => `<button data-a="ricon" data-v="${k}" class="${(r.icon || roomIcon(r.name)) === k ? 'on' : ''}" title="${k}">${ic(k)}</button>`).join('')}</div></label>
        <label class="f"><span>Cámaras en la ventana del ambiente</span><div class="seg">${[['top', 'Arriba de todo'], ['after', 'Después de los controles'], ['end', 'Al final']].map(([v, t]) => `<button data-a="rcampos" data-v="${v}" class="${(r.cameras_position || 'after') === v ? 'on' : ''}">${t}</button>`).join('')}</div></label>
        <label class="f"><span>Parlante para la música por voz</span><input list="dl-spk" data-f="rooms.${this._room}.speaker" value="${esc(r.speaker || '')}" placeholder="Automático: lo encuentra solo">${this._dl('dl-spk', ['media_player'])}<p class="h">Para «poné música en ${esc(r.name || 'este ambiente')}». Dejalo vacío salvo que elija mal: conviene el de Music Assistant.</p></label>
        <h3>Entidades</h3><p class="h">En este orden aparecen en la ventana del ambiente. Un switch con nombre de luz ("Luz …") se muestra como luz.</p>
        ${this._entList(`rooms.${this._room}.entities`, null, { groupCams: true })}</div></div>`;
      return h;
    }
    _tPlan() {
      const c = this._cfg, fp = c.floorplan || {}, zones = Array.isArray(fp.zones) ? fp.zones : [];
      const src = fp.image ? this._url(fp.image) : '';
      const roomNames = Array.isArray(c.rooms) ? c.rooms.map((r) => r.name) : Object.values((this._hass && this._hass.areas) || {}).map((a) => a.name);
      let h = `<p class="h">Cargá el render de la casa (apagado) y, si lo tenés, el mismo render con todas las luces prendidas. Después <b>dibujá cada espacio arrastrando sobre la imagen</b> y elegí sus luces.</p>
        ${this._txt('floorplan.image', 'Render (luces apagadas)', '/local/matterai-home/casa.png', 'Subilo a <code>/config/www/matterai-home/</code> y escribí <code>/local/matterai-home/archivo.png</code>.')}
        ${this._txt('floorplan.image_on', 'Render con las luces prendidas (opcional)', '/local/matterai-home/casa-prendida.png')}
        ${src && !/^(\/|https?:)/.test(fp.image) ? '<div class="warn">Esta imagen es de la app MatterAI (ruta relativa): en Home Assistant no se ve, pero en la app sí.</div>' : ''}`;
      if (!fp.image) return h + '<p class="h">Sin render la pantalla usa el diseño de 2 columnas.</p>';
      h += `<div class="stage" id="stage">${src ? `<img src="${esc(src)}" alt="">` : ''}<div class="noimg" ${src ? 'style="display:none"' : ''}>Sin imagen</div>
        ${zones.map((z, i) => { const a = (z.area || [0, 0, 10, 10]).map(Number); return `<div class="z ${i === this._zone ? 'on' : ''}" data-z="${i}" style="left:${a[0]}%;top:${a[1]}%;width:${a[2]}%;height:${a[3]}%"><span>${esc(z.name || `Espacio ${i + 1}`)}</span>${i === this._zone ? '<i data-rz="1"></i>' : ''}</div>`; }).join('')}</div>
        <p class="h">Arrastrá en un lugar vacío para dibujar un espacio · arrastrá un espacio para moverlo · la esquina naranja cambia su tamaño.</p>
        <div class="zl">${zones.map((z, i) => `<button data-a="zone" data-i="${i}" class="${i === this._zone ? 'on' : ''}">${esc(z.name || `Espacio ${i + 1}`)}</button>`).join('')}</div>`;
      const z = zones[this._zone];
      if (z) {
        h += `<div class="box"><div class="row" style="justify-content:space-between"><h3 style="margin:0">${esc(z.name || 'Espacio')}</h3><button class="b del" data-a="zdel">${ic('trash')} Borrar espacio</button></div>
          ${this._txt(`floorplan.zones.${this._zone}.name`, 'Nombre', 'Cocina')}
          <label class="f"><span>Al mantenerlo apretado abre el ambiente</span>${this._sel(`floorplan.zones.${this._zone}.room`, [['', 'Automático (por nombre o por su luz)'], ...roomNames.map((n) => [n, n])], z.room || '')}</label>
          <h3>Luces que prende</h3>${this._entList(`floorplan.zones.${this._zone}.lights`, ['light', 'switch', 'input_boolean'], { names: false, ph: 'Agregar luz…' })}</div>`;
      }
      return h;
    }
    _tSecurity() {
      const c = this._cfg;
      return `<h3>Alarmas</h3>${this._entList('alarm', ['alarm_control_panel'], { names: false })}
        <h3>Portones y cerraduras</h3><p class="h">Piden doble toque para abrir.</p>${this._entList('access', ['cover', 'lock'])}
        <h3>Sensores y extras de seguridad</h3><p class="h">Puertas, ventanas, zonas de la alarma, simulación de presencia…</p>${this._entList('security_entities', ['binary_sensor', 'switch', 'sensor', 'input_boolean'])}
        <h3>Cámaras</h3>${this._entList('cameras', ['camera'], { names: false })}
        <label class="f"><span>Máximo de cámaras</span><input type="number" min="1" max="12" data-f="max_cameras" data-num="1" value="${esc(c.max_cameras || 4)}"></label>
        <p class="h">${c.camera_card ? 'La Advanced Camera Card (eventos de Frigate) está configurada: sus opciones avanzadas se editan en el editor de código.' : 'Para ver los eventos de Frigate, agregá <code>camera_card:</code> desde el editor de código.'}</p>`;
    }
    _tFeatures() {
      const c = this._cfg, f = c.features || {};
      let auto = {}, why = {};
      try { // qué detecta la tarjeta en esta casa
        const t = new MatterAIHomeCard(); t.setConfig(Object.assign({}, c, { features: {} })); t._hass = this._hass; auto = t.features(); why = t._featWhy || {};
      } catch (_) { /* sin datos de la casa */ }
      return `<p class="h">Cada sección aparece sola si la casa tiene con qué. Acá podés forzarla o esconderla para este cliente.</p>
        <div class="feat">${FEAT_LABELS.map(([k, l]) => `<div><b>${esc(l)}</b><small class="${auto[k] ? 'ok' : 'no'}">${auto[k] ? '✓ ' : '— '}${esc(String(why[k] || '').replace(/^auto: /, ''))}</small></div>
          <div class="seg">${[['', 'Auto'], ['1', 'Mostrar'], ['0', 'Ocultar']].map(([v, lb]) => `<button data-a="feat" data-k="${k}" data-v="${v}" class="${(f[k] === true ? '1' : f[k] === false ? '0' : '') === v ? 'on' : ''}">${lb}</button>`).join('')}</div>`).join('')}</div>
        <h3>Pestaña "Seguridad" junto al plano</h3>
        <div class="seg"><button data-a="sectab" data-v="1" class="${c.security_tab === false ? '' : 'on'}">Sí</button><button data-a="sectab" data-v="0" class="${c.security_tab === false ? 'on' : ''}">No</button></div>
        <h3>Rendimiento</h3>
        <p class="h">Automático (recomendado): Completo en computadoras y Fluido en celulares y tablets, el mismo diseño sin los desenfoques en vivo que traban al deslizar. Liviano además frena los fondos animados, para equipos muy chicos.</p>
        <div class="seg">${[['', 'Automático'], ['fluid', 'Fluido'], ['lite', 'Liviano'], ['full', 'Completo']].map(([v, l]) => `<button data-a="perf" data-v="${v}" class="${(c.performance || '') === v ? 'on' : ''}">${l}</button>`).join('')}</div>
        <h3>Música por voz</h3>
        ${this._txt('music_default', 'Qué poner cuando dicen sólo «poné música»', 'Vacío: una lista favorita al azar de Music Assistant', 'Por ejemplo el nombre de una lista: <code>Asado</code>, <code>Rock nacional</code>.')}
        <h3>Android Auto</h3>
        <p class="h">Botones grandes en la pantalla del auto (hasta 6). Portones y cerraduras piden confirmación. Automático: portones, accesos y las primeras escenas.</p>
        <div class="seg"><button data-a="carmode" data-v="auto" class="${Array.isArray(c.car) ? '' : 'on'}">Automático</button><button data-a="carmode" data-v="list" class="${Array.isArray(c.car) ? 'on' : ''}">Elegir</button></div>
        ${Array.isArray(c.car) ? `<div style="margin-top:10px">${this._entList('car', ['cover', 'lock', 'light', 'switch', 'fan', 'input_boolean', 'scene', 'script', 'button', 'input_button'])}</div>` : ''}`;
    }
    /** Diseño actual: el elegido (completado con lo que falte) o el original de la tarjeta. */
    _layout() {
      const fp = !!(this._cfg.floorplan && this._cfg.floorplan.image);
      const def = fp ? { left: ['resumen', 'sugerencias', 'personas'], center: ['modos'], right: ['ambientes'] }
        : { left: ['resumen', 'sugerencias', 'seguridad', 'personas'], center: [], right: ['modos', 'ambientes', 'camaras'] };
      const L = this._cfg.layout; if (!L) return { fp, cols: def };
      const cols = { left: [], center: [], right: [] }, seen = new Set();
      ['left', 'center', 'right'].forEach((k) => (L[k] || []).forEach((b) => { if (BLOCK_LABELS[b] && !seen.has(b)) { cols[k].push(b); seen.add(b); } }));
      ['left', 'center', 'right'].forEach((k) => def[k].forEach((b) => { if (!seen.has(b)) { cols[k].push(b); seen.add(b); } }));
      if (fp) ['left', 'center', 'right'].forEach((k) => { cols[k] = cols[k].filter((b) => b !== 'seguridad' && b !== 'camaras'); });
      if (!fp) { cols.right = [...cols.center, ...cols.right]; cols.center = []; }
      return { fp, cols };
    }
    _tLayout() {
      const { fp, cols } = this._layout(), keys = fp ? ['left', 'center', 'right'] : ['left', 'right'];
      return `<p class="h">Elegí en qué columna va cada bloque y en qué orden. ${fp ? 'Con plano, Seguridad y Cámaras van en su pestaña junto al plano.' : 'Sin plano la pantalla tiene 2 columnas.'} En celulares todo queda en una sola columna.</p>
        <div class="lay" style="grid-template-columns:repeat(${keys.length},minmax(0,1fr))">${keys.map((k, ci) => `<div class="lcol"><h3>${COL_LABELS[k]}</h3>
          ${cols[k].map((b, i) => `<div class="lb"><b>${esc(BLOCK_LABELS[b])}</b><span>
            <button class="i" data-a="lmv" data-col="${k}" data-i="${i}" data-d="-1" ${i ? '' : 'disabled'} title="Subir">${ic('up')}</button>
            <button class="i" data-a="lmv" data-col="${k}" data-i="${i}" data-d="1" ${i < cols[k].length - 1 ? '' : 'disabled'} title="Bajar">${ic('down')}</button>
            <button class="i" data-a="lcol" data-col="${k}" data-i="${i}" data-d="-1" ${ci ? '' : 'disabled'} title="A la columna de la izquierda">${ic('back')}</button>
            <button class="i flip" data-a="lcol" data-col="${k}" data-i="${i}" data-d="1" ${ci < keys.length - 1 ? '' : 'disabled'} title="A la columna de la derecha">${ic('back')}</button></span></div>`).join('') || '<p class="h">Vacía</p>'}</div>`).join('')}</div>
        ${this._cfg.layout ? `<p><button class="b" data-a="lreset">${ic('history')} Volver al diseño original</button></p>` : ''}`;
    }
    _url(u) { const b = this._cfg && this._cfg.base_url; return u && b && u.charAt(0) === '/' ? b.replace(/\/+$/, '') + u : u; }

    _html() {
      // el panel MatterAI puede mostrar sólo algunas pestañas (La casa: datos; Inicio clásico: el diseño viejo)
      const tabs = [['general', 'home', 'General'], ['layout', 'menu', 'Diseño'], ['rooms', 'sofa', 'Ambientes'], ['plan', 'window', 'Plano'], ['security', 'shield', 'Seguridad'], ['features', 'sparkle', 'Secciones']]
        .filter(([k]) => !Array.isArray(this.onlyTabs) || this.onlyTabs.includes(k));
      if (!tabs.some(([k]) => k === this._tab) && tabs.length) this._tab = tabs[0][0];
      const body = this._tab === 'layout' ? this._tLayout() : this._tab === 'rooms' ? this._tRooms() : this._tab === 'plan' ? this._tPlan() : this._tab === 'security' ? this._tSecurity() : this._tab === 'features' ? this._tFeatures() : this._tGeneral();
      return `<style>${ED_CSS}</style><div class="edw"><div class="tabs">${tabs.map(([k, i, l]) => `<button data-a="tab" data-v="${k}" class="${this._tab === k ? 'on' : ''}">${ic(i)}${l}</button>`).join('')}</div><div id="body">${body}</div></div>`;
    }
    _render() {
      if (!this._root || !this._cfg) return;
      const sc = this._root.querySelector && this._root.querySelector('#body'), top = sc ? this.scrollTop : 0;
      this._root.innerHTML = this._html();
      if (!this._bound) this._bind();
      // el área de dibujo toma la proporción del render, así los espacios calzan igual que en la tarjeta
      const img = this._root.querySelector('#stage img'), st = this._root.querySelector('#stage');
      if (img && st) {
        const fit = () => { if (img.naturalWidth) st.style.aspectRatio = `${img.naturalWidth} / ${img.naturalHeight}`; };
        if (img.complete) fit(); else img.addEventListener('load', fit);
        img.addEventListener('error', () => { const n = st.querySelector('.noimg'); if (n) { n.style.display = ''; n.textContent = 'No se pudo cargar la imagen desde acá (en la app se ve igual si la ruta es de la app).'; } });
      }
      this.scrollTop = top;
    }

    /* ---------- acciones ---------- */
    _act(a, d) {
      const c = this._cfg;
      switch (a) {
        case 'tab': this._tab = d.v; this._render(); return;
        case 'rm': { const l = this._get(d.path) || []; l.splice(Number(d.i), 1); if (!l.length && d.path.split('.').length === 1) this._put(d.path, undefined); break; }
        case 'mv': { const l = this._get(d.path) || [], i = Number(d.i), j = d.j != null ? Number(d.j) : i + Number(d.d); if (j < 0 || j >= l.length) return; [l[i], l[j]] = [l[j], l[i]]; break; }
        case 'scenes': if (d.v === 'off') c.scenes = false; else if (d.v === 'auto') delete c.scenes; else if (!Array.isArray(c.scenes)) c.scenes = []; break;
        case 'rmode':
          if (d.v === 'auto') { if (Array.isArray(c.rooms) && c.rooms.length && !this._confirmAuto) { this._confirmAuto = true; this._render(); this._toastEd('Tocá de nuevo "Automático" para borrar los ambientes manuales'); return; } delete c.rooms; }
          else if (!Array.isArray(c.rooms)) c.rooms = this._fromAreas();
          this._confirmAuto = false; this._room = 0; break;
        case 'room': this._room = Number(d.i); this._render(); return;
        case 'radd': c.rooms.push({ name: `Ambiente ${c.rooms.length + 1}`, icon: 'home', entities: [] }); this._room = c.rooms.length - 1; break;
        case 'rimport': c.rooms = this._fromAreas(); this._room = 0; break;
        case 'rdel': c.rooms.splice(this._room, 1); this._room = Math.max(0, this._room - 1); break;
        case 'rmv': { const i = this._room, j = i + Number(d.d); [c.rooms[i], c.rooms[j]] = [c.rooms[j], c.rooms[i]]; this._room = j; break; }
        case 'ricon': c.rooms[this._room].icon = d.v; break;
        case 'perf': if (d.v) c.performance = d.v; else delete c.performance; break;
        case 'carmode': if (d.v === 'auto') delete c.car; else if (!Array.isArray(c.car)) c.car = []; break;
        case 'rcampos': if (d.v === 'after') delete c.rooms[this._room].cameras_position; else c.rooms[this._room].cameras_position = d.v; break;
        case 'zone': this._zone = Number(d.i); this._render(); return;
        case 'zdel': c.floorplan.zones.splice(this._zone, 1); if (!c.floorplan.zones.length) delete c.floorplan.zones; this._zone = -1; break;
        case 'feat': { c.features = c.features || {}; if (d.v === '') delete c.features[d.k]; else c.features[d.k] = d.v === '1'; if (!Object.keys(c.features).length) delete c.features; break; }
        case 'sectab': if (d.v === '0') c.security_tab = false; else delete c.security_tab; break;
        case 'lmv': case 'lcol': {
          const { fp, cols } = this._layout(), keys = fp ? ['left', 'center', 'right'] : ['left', 'right'];
          const list = cols[d.col], i = Number(d.i);
          if (a === 'lmv') { const j = i + Number(d.d); [list[i], list[j]] = [list[j], list[i]]; } else {
            const to = keys[keys.indexOf(d.col) + Number(d.d)]; if (!to) return;
            cols[to].push(list.splice(i, 1)[0]);
          }
          c.layout = { left: cols.left, center: cols.center, right: cols.right };
          if (!c.layout.center.length) delete c.layout.center;
          break;
        }
        case 'lreset': delete c.layout; break;
        default: return;
      }
      this._emit();
    }
    _field(t) {
      const path = t.dataset.f; let v = t.value;
      if (t.dataset.num) v = v === '' ? undefined : Number(v);
      if (path === 'weather') v = v === '__off' ? false : v || undefined;
      if (path === 'floorplan.image' && !v) { delete this._cfg.floorplan; this._emit(); return; }
      this._put(path, v);
      this._emit(t.tagName === 'SELECT' || path.endsWith('.name') && path.startsWith('floorplan.zones'));
    }
    _addEnt(t) {
      const id = t.value.trim(); if (!id || !this._st(id)) return;
      const path = t.dataset.add, l = this._get(path);
      if (Array.isArray(l)) { if (!l.some((x) => this._eid(x) === id)) l.push(id); } else this._put(path, [id]);
      t.value = ''; this._emit();
    }
    _setName(t) {
      const l = this._get(t.dataset.name), i = Number(t.dataset.i); if (!l || !l[i]) return;
      const id = this._eid(l[i]), nm = t.value.trim();
      l[i] = nm ? { entity: id, name: nm } : id;
      this._emit(false);
    }
    _toastEd(msg) { const w = this._root.querySelector('.tabs'); if (w) { const p = document.createElement('div'); p.className = 'warn'; p.textContent = msg; w.after(p); } }

    /* ---------- dibujar espacios sobre el render ---------- */
    _pt(e, st) { const b = st.getBoundingClientRect(); return [r1((e.clientX - b.left) / b.width * 100), r1((e.clientY - b.top) / b.height * 100)]; }
    _down(e) {
      const st = e.target.closest && e.target.closest('#stage'); if (!st || e.button > 0) return;
      e.preventDefault();
      const [x, y] = this._pt(e, st), zEl = e.target.closest('[data-z]');
      const zones = ((this._cfg.floorplan || {}).zones) || [];
      if (zEl) {
        const i = Number(zEl.dataset.z), a = (zones[i].area || [0, 0, 10, 10]).map(Number);
        if (i !== this._zone) { this._zone = i; this._render(); }
        this._dz = { mode: e.target.dataset.rz ? 'size' : 'move', i, x0: x, y0: y, a, st };
      } else this._dz = { mode: 'new', x0: x, y0: y, st, el: null };
      try { st.setPointerCapture(e.pointerId); } catch (_) { /* noop */ }
    }
    _move(e) {
      const d = this._dz; if (!d) return;
      const st = this._root.querySelector('#stage'); if (!st) return;
      const [x, y] = this._pt(e, st);
      let a;
      if (d.mode === 'new') {
        a = [Math.min(d.x0, x), Math.min(d.y0, y), Math.abs(x - d.x0), Math.abs(y - d.y0)];
        if (!d.el) { d.el = document.createElement('div'); d.el.className = 'z draft'; st.appendChild(d.el); }
        d.el.style.cssText = `left:${a[0]}%;top:${a[1]}%;width:${a[2]}%;height:${a[3]}%`;
      } else {
        const [ax, ay, aw, ah] = d.a, dx = x - d.x0, dy = y - d.y0;
        a = d.mode === 'move' ? [r1(Math.min(100 - aw, Math.max(0, ax + dx))), r1(Math.min(100 - ah, Math.max(0, ay + dy))), aw, ah]
          : [ax, ay, r1(Math.max(2, Math.min(100 - ax, aw + dx))), r1(Math.max(2, Math.min(100 - ay, ah + dy)))];
        const el = st.querySelector(`[data-z="${d.i}"]`); if (el) el.style.cssText = `left:${a[0]}%;top:${a[1]}%;width:${a[2]}%;height:${a[3]}%`;
      }
      d.a2 = a.map(r1);
    }
    _up() {
      const d = this._dz; this._dz = null; if (!d || !d.a2) return;
      const fp = this._cfg.floorplan = this._cfg.floorplan || {}; fp.zones = Array.isArray(fp.zones) ? fp.zones : [];
      if (d.mode === 'new') {
        if (d.a2[2] < 2 || d.a2[3] < 2) { if (d.el) d.el.remove(); return; }
        fp.zones.push({ name: `Espacio ${fp.zones.length + 1}`, area: d.a2, lights: [] });
        this._zone = fp.zones.length - 1;
      } else fp.zones[d.i].area = d.a2;
      this._emit();
    }

    _bind() {
      this._bound = true;
      const R = this._root;
      R.addEventListener('click', (e) => { const t = e.target.closest('[data-a]'); if (t && !t.disabled) this._act(t.dataset.a, t.dataset); });
      R.addEventListener('change', (e) => {
        const t = e.target;
        if (t.dataset.add) this._addEnt(t); else if (t.dataset.name) this._setName(t); else if (t.dataset.f) this._field(t);
      });
      R.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.dataset && e.target.dataset.add) this._addEnt(e.target); });
      R.addEventListener('pointerdown', (e) => this._down(e));
      R.addEventListener('pointermove', (e) => this._move(e));
      R.addEventListener('pointerup', () => this._up());
      R.addEventListener('pointercancel', () => { this._dz = null; this._render(); });
    }
  }
  if (!customElements.get('matterai-home-card-editor')) customElements.define('matterai-home-card-editor', MatterAIHomeCardEditor);

  if (!customElements.get('matterai-home-card')) customElements.define('matterai-home-card', MatterAIHomeCard);
  // Estilos del historial para usarlos fuera de la tarjeta (ventana de dispositivo de la app)
  window.MatterAIHome = Object.assign(window.MatterAIHome || {}, {
    historyCSS: '.ic{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round;flex:none}' + HIST_CSS,
  });
  window.customCards = window.customCards || [];
  if (!window.customCards.some((c) => c.type === 'matterai-home-card')) {
    window.customCards.push({ type: 'matterai-home-card', name: 'MatterAI Home', description: 'Dashboard inteligente que se arma solo a partir de las Áreas.', preview: false });
  }
  console.info(`%c MATTERAI HOME %c v${VERSION} `, 'background:#7c9cff;color:#fff;font-weight:700;border-radius:4px 0 0 4px', 'background:#151a2b;color:#fff;border-radius:0 4px 4px 0');
})();
