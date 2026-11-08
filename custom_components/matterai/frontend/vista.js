/*
 * MatterAI · motor de dashboards (vistas). Dibuja un dashboard de celular o de tablet a partir de su lista de
 * tarjetas (lo que se arma en el editor del panel MatterAI). Lo usan la app (inicio) y la vista previa del editor.
 *
 *   const v = MaeVista.create(root, ctx); v.setView(view); v.render();
 *   ctx: { card, hass(), base(), sign(path)→Promise<url>, toast(t), openEntity(id), openMenu(), openAutomations(),
 *          deviceName(), onPin(names), edit: { selected, onSelect(id) } | null, kind: 'phone'|'tablet', orientation }
 *
 * Datos: el modelo de la casa lo da la tarjeta MatterAI (modo headless), que además abre sus ventanas (ambiente,
 * clima, agenda, música, actividad, alarma con PIN, voz). Sin tarjetas configuradas se usa el prearmado.
 */
(function (root) {
  'use strict';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const I = {
    bulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z"/>',
    shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>', gate: '<path d="M3 21V8l9-5 9 5v13M7 21v-8h10v8M7 17h10"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>', unlock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.5-2"/>',
    temp: '<path d="M14 14.8V5a2 2 0 0 0-4 0v9.8a4 4 0 1 0 4 0z"/>', snow: '<path d="M12 2v20M4.9 6.5l14.2 11M4.9 17.5l14.2-11M9 4l3 2 3-2M9 20l3-2 3 2"/>',
    curt: '<path d="M3 3h18M5 3v18M19 3v18M5 3c0 6 4 10 5 18M19 3c0 6-4 10-5 18"/>', bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>', home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    moon: '<path d="M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10z"/>', sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    cloud: '<path d="M7 18h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 9.5 4.3 4.3 0 0 0 7 18z"/>', rain: '<path d="M7 15h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 6.5 4.3 4.3 0 0 0 7 15z"/><path d="M8 21l1-3M12 21l1-3M16 21l1-3"/>',
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10 21h4"/>', menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    cam: '<path d="M3 7h12a2 2 0 0 1 2 2v1l4-3v10l-4-3v1a2 2 0 0 1-2 2H3z"/>', mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>', music: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    chev: '<path d="M9 6l6 6-6 6"/>', x: '<path d="M18 6L6 18M6 6l12 12"/>', cdown: '<path d="M6 9l6 6 6-6"/>',
    up: '<path d="M12 19V5M5 12l7-7 7 7"/>', down: '<path d="M12 5v14M19 12l-7 7-7-7"/>', pin: '<path d="M12 17v5M9 3h6l-1 6 4 4H6l4-4z"/>',
    play: '<path d="M6 4l14 8-14 8z" fill="currentColor"/>', pause: '<path d="M7 4h3v16H7zM14 4h3v16h-3z" fill="currentColor"/>', next: '<path d="M5 4l10 8-10 8zM19 4v16"/>',
    spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6"/>',
    battery: '<rect x="2" y="7" width="17" height="10" rx="2"/><path d="M22 11v2M6 10v4"/>', alert: '<path d="M12 3l10 18H2zM12 10v4M12 17h.01"/>',
    door: '<path d="M6 21V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17M3 21h18M14 12h.01"/>', bed: '<path d="M3 18v-7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v7M3 14h18M3 18v2M21 18v2M7 9V6h4v3"/>',
    bath: '<path d="M4 12h16v3a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM6 12V5a2 2 0 0 1 4 0"/>', sofa: '<path d="M4 11V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3M3 17v-4a2 2 0 0 1 4 0v1h10v-1a2 2 0 0 1 4 0v4zM5 17v2M19 17v2"/>',
    dining: '<path d="M4 9h16M6 9v11M18 9v11M8 4h8l1 5H7z"/>', pot: '<path d="M4 10h16v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4zM2 10h2M20 10h2"/>',
    car: '<path d="M5 17h14M6 17v2M18 17v2M3 13l2-6h14l2 6v4H3z"/>', tree: '<path d="M12 22v-6M7 16h10l-5-13z"/>',
    desk: '<path d="M3 8h18M5 8v12M19 8v12M5 13h6"/>', tool: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-2.4z"/>',
    film: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4"/>', kid: '<circle cx="12" cy="7" r="3"/><path d="M6 21v-4a6 6 0 0 1 12 0v4"/>',
    pool: '<path d="M2 18c2 0 2-1.5 4-1.5S8 18 10 18s2-1.5 4-1.5 2 1.5 4 1.5 2-1.5 4-1.5M7 15V5a2 2 0 0 1 4 0M13 15V5a2 2 0 0 1 4 0M7 9h6"/>',
    power: '<path d="M12 2v10M5.6 6.6a8 8 0 1 0 12.8 0"/>', cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    robot: '<rect x="4" y="8" width="16" height="12" rx="3"/><path d="M12 4v4M9 13h.01M15 13h.01M9 17h6"/>', plug: '<path d="M9 2v6M15 2v6M6 8h12v4a6 6 0 0 1-12 0zM12 18v4"/>',
    fan: '<circle cx="12" cy="12" r="2"/><path d="M12 10c0-4 1-7 4-7s3 4-2 7M14 12c4 0 7 1 7 4s-4 3-7-2M12 14c0 4-1 7-4 7s-3-4 2-7M10 12c-4 0-7-1-7-4s4-3 7 2"/>',
    tv: '<rect x="3" y="5" width="18" height="12" rx="2"/><path d="M8 21h8"/>', edit: '<path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4"/>',
    dots: '<circle cx="12" cy="5" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="12" cy="19" r="1.3"/>', water: '<path d="M12 3c-4 5-6 8-6 11a6 6 0 0 0 12 0c0-3-2-6-6-11z"/>',
  };
  const ICONS = Object.keys(I);
  const ic = (n) => `<svg class="i" viewBox="0 0 24 24">${I[n] || I.home}</svg>`;
  const ROOM_IC = { sofa: 'sofa', living: 'sofa', bed: 'bed', bath: 'bath', kitchen: 'pot', cook: 'pot', dining: 'dining', garage: 'car', car: 'car', tree: 'tree', garden: 'tree',
    desk: 'desk', office: 'desk', door: 'door', entry: 'door', tool: 'tool', kid: 'kid', pool: 'pool', music: 'music', tv: 'film', film: 'film', sparkle: 'spark', grill: 'pot' };
  const roomIc = (r) => ROOM_IC[r.icon] || (/(ba[ñn]o|toilette)/i.test(r.name) ? 'bath' : /dorm|habit|suite/i.test(r.name) ? 'bed' : /cocin/i.test(r.name) ? 'pot' : /garage|cochera/i.test(r.name) ? 'car' : /jard|patio|parque/i.test(r.name) ? 'tree' : 'home');
  const WX = { sunny: 'sun', 'clear-night': 'moon', partlycloudy: 'cloud', cloudy: 'cloud', rainy: 'rain', pouring: 'rain', lightning: 'rain', 'lightning-rainy': 'rain', fog: 'cloud', windy: 'cloud' };
  const dec = (n) => String(Math.round(n * 10) / 10).replace('.', ',');
  const uid = () => Math.random().toString(36).slice(2, 10);

  /* Catálogo de tarjetas (lo usa el editor: nombre, descripción, en qué equipo tiene sentido) */
  const CATALOG = {
    kpis: { name: 'Resumen', desc: 'Alarma, portón, luces, temperatura, aires, consumo', kinds: ['phone', 'tablet'] },
    featured: { name: 'Cámara con botón', desc: 'Una cámara grande y su portón o puerta', kinds: ['phone', 'tablet'] },
    rooms: { name: 'Ambientes', desc: 'Los ambientes elegidos, con su interruptor', kinds: ['phone', 'tablet'] },
    scenes: { name: 'Escenas', desc: 'Escenas y scripts para tocar', kinds: ['phone', 'tablet'] },
    buttons: { name: 'Botones', desc: 'Botones a elección, con su acción', kinds: ['phone', 'tablet'] },
    frigate: { name: 'Cámaras en vivo (Frigate)', desc: 'Video en vivo con el visor de Frigate: pasar de cámara, eventos y grabaciones', kinds: ['phone', 'tablet'] },
    camera: { name: 'Portero: cámara con botones', desc: 'Una cámara en vivo con sus botones (abrir, ver más)', kinds: ['phone', 'tablet'] },
    alarm: { name: 'Alarma', desc: 'Botón grande para armar y desarmar', kinds: ['phone', 'tablet'] },
    away: { name: 'Modo ausente', desc: 'Un interruptor o escena «me voy»', kinds: ['phone', 'tablet'] },
    routines: { name: 'Rutinas', desc: 'Automatizaciones con su interruptor', kinds: ['phone', 'tablet'] },
    music: { name: 'Música', desc: 'Lo que está sonando, con sus controles', kinds: ['phone', 'tablet'] },
    lock: { name: 'Cerradura', desc: 'Abrir o cerrar, con su estado', kinds: ['phone', 'tablet'] },
    plan: { name: 'Plano', desc: 'El render de la casa que se ilumina', kinds: ['tablet', 'phone'] },
    clock: { name: 'Reloj y clima', desc: 'Hora, fecha y clima grandes', kinds: ['tablet'] },
    weather: { name: 'Clima', desc: 'Temperatura, cielo, humedad y viento', kinds: ['phone', 'tablet'] },
    climate: { name: 'Aire / termostato', desc: 'Temperatura con − y +, modo y prender', kinds: ['phone', 'tablet'] },
    covers: { name: 'Cortinas', desc: 'Subir, parar y bajar, con su posición', kinds: ['phone', 'tablet'] },
    lights: { name: 'Luces', desc: 'Prender y apagar con el brillo', kinds: ['phone', 'tablet'] },
    energy: { name: 'Consumo', desc: 'Lo que gasta la casa y el gráfico del día', kinds: ['phone', 'tablet'] },
    sensor: { name: 'Sensor', desc: 'Un valor con su medidor (tanque, humedad…)', kinds: ['phone', 'tablet'] },
    people: { name: 'Personas', desc: 'Quién está en casa', kinds: ['phone', 'tablet'] },
    text: { name: 'Texto', desc: 'Un título, un separador o una nota', kinds: ['phone', 'tablet'] },
    image: { name: 'Imagen', desc: 'Una foto o logo, con acción al tocar', kinds: ['phone', 'tablet'] },
    activity: { name: 'Actividad', desc: 'Qué pasó en la casa: por equipo, día, tipo y ambiente', kinds: ['phone', 'tablet'] },
    openings: { name: 'Puertas y ventanas', desc: 'Qué quedó abierto (o «todo cerrado»)', kinds: ['phone', 'tablet'] },
    agenda: { name: 'Agenda del día', desc: 'Lo que viene hoy y mañana en los calendarios', kinds: ['phone', 'tablet'] },
    irrigation: { name: 'Riego', desc: 'Zonas de riego y programas, con su interruptor', kinds: ['phone', 'tablet'] },
    batteries: { name: 'Pilas', desc: 'Sensores con la pila baja, para cambiarlas a tiempo', kinds: ['phone', 'tablet'] },
  };
  /* Condiciones para mostrar una tarjeta (como la tarjeta condicional de Home Assistant) */
  const CONDITIONS = { state: 'Un equipo está en un estado', not_state: 'Un equipo NO está en un estado', night: 'Es de noche (20 a 7 h)', day: 'Es de día (7 a 20 h)',
    music: 'Hay música sonando', alarm_armed: 'La alarma está armada', alarm_off: 'La alarma está desarmada', someone_home: 'Hay alguien en casa', nobody_home: 'No hay nadie en casa' };
  const WX_TXT = { sunny: 'Despejado', 'clear-night': 'Despejado', partlycloudy: 'Algo nublado', cloudy: 'Nublado', rainy: 'Lluvia', pouring: 'Lluvia fuerte', lightning: 'Tormenta',
    'lightning-rainy': 'Tormenta', fog: 'Niebla', windy: 'Ventoso', 'windy-variant': 'Ventoso', snowy: 'Nieve', 'snowy-rainy': 'Aguanieve', hail: 'Granizo', exceptional: 'Alerta' };
  const MODE_TXT = { cool: 'Frío', heat: 'Calor', heat_cool: 'Automático', auto: 'Automático', dry: 'Seco', fan_only: 'Ventilación', off: 'Apagado' };
  /* Botones de la barra de abajo: [ícono, texto]. «voice» es el micrófono (va redondo). */
  const DOCK = { top: ['home', 'Inicio'], camaras: ['cam', 'Cámaras'], musica: ['music', 'Música'], actividad: ['list', 'Actividad'], voice: ['mic', 'Micrófono'],
    agenda: ['cal', 'Agenda'], casa: ['grid', 'Casa'], menu: ['menu', 'Menú'], luces: ['bulb', 'Luces'], clima: ['sun', 'Clima'], seguridad: ['shield', 'Seguridad'], automatizaciones: ['robot', 'Rutinas'] };
  const DOCK_DEF = { phone: ['top', 'camaras', 'voice', 'actividad', 'musica'], tablet: ['top', 'camaras', 'musica', 'actividad', 'voice', 'agenda', 'casa', 'menu'] };
  const SCREEN_NAMES = { agenda: 'Agenda', clima: 'Clima', musica: 'Música', actividad: 'Actividad', camaras: 'Cámaras', seguridad: 'Seguridad', avisos: 'Avisos',
    menu: 'Menú', casa: 'Toda la casa', luces: 'Luces prendidas', automatizaciones: 'Automatizaciones', aberturas: 'Puertas y ventanas' };

  /* ───────── prearmado: el diseño de los prototipos con los equipos de esta casa ───────── */
  function defaults(kind, m, legacy, hassStates, floorplan) {
    const L = legacy || {};
    const S = hassStates || {};
    const f = L.featured || {};
    const fname = (id) => (S[id] && S[id].attributes.friendly_name) || id;
    const gate = f.gate || (m && m.access[0]) || null;
    const cam = f.camera || (m && (m.cams.find((id) => /garage|cochera|port[oó]n|entrada|puerta/i.test(fname(id))) || m.cams[0])) || null;
    const roomOfGate = gate && m && m.roomOf[gate];
    const rooms = (L.pinned && L.pinned.length ? L.pinned : (m ? m.rooms.slice().sort((a, b) => (b.count || 0) - (a.count || 0)).slice(0, kind === 'tablet' ? 8 : 4).map((r) => r.name) : []));
    const scenes = L.scenes && L.scenes.length ? L.scenes : null;
    const lockId = m && m.access.find((id) => id.startsWith('lock.'));
    const B = [];
    if (kind === 'tablet') {
      B.push({ id: 'plan', type: 'plan', col: 0, cfg: {} });
      B.push({ id: 'kpis', type: 'kpis', col: 1, cfg: { auto: true } });
      B.push({ id: 'scenes', type: 'scenes', col: 1, title: 'Escenas', cfg: scenes ? { entities: scenes } : { auto: true } });
      B.push({ id: 'away', type: 'away', col: 1, title: 'Modo ausente', cfg: { auto: true } });
      B.push({ id: 'routines', type: 'routines', col: 1, title: 'Rutinas', cfg: { auto: true } });
      if (cam || gate) B.push({ id: 'cam', type: 'camera', col: 2, title: f.title || (roomOfGate && roomOfGate.name) || 'Entrada', cfg: { entity: cam, gate } });
      B.push({ id: 'music', type: 'music', col: 2, title: 'Música', cfg: {} });
      if (lockId) B.push({ id: 'lock', type: 'lock', col: 2, title: 'Entrada principal', cfg: { entity: lockId } });
      B.push({ id: 'rooms', type: 'rooms', col: 2, title: 'Ambientes', cfg: { rooms, style: 'grid', auto: !L.pinned } });
    } else {
      B.push({ id: 'kpis', type: 'kpis', cfg: { auto: true } });
      if (cam || gate) B.push({ id: 'feat', type: 'featured', title: f.title || (roomOfGate && roomOfGate.name) || 'Entrada', cfg: { entity: cam, gate } });
      B.push({ id: 'rooms', type: 'rooms', title: 'Lo tuyo', cfg: { rooms, auto: !L.pinned } });
      B.push({ id: 'scenes', type: 'scenes', title: 'Escenas', cfg: scenes ? { entities: scenes } : { auto: true } });
    }
    // plano: el que ya tenía la casa (tarjeta clásica: zonas rectangulares en %)
    let plan = null;
    if (floorplan && floorplan.image) {
      plan = { image: floorplan.image, image_on: floorplan.image_on || null, image_day: floorplan.image_day || null,
        zones: (floorplan.zones || []).filter((z) => Array.isArray(z.area) && z.area.length === 4).map((z) => {
          const [x, y, w, h] = z.area.map((v) => v / 100);
          return { name: z.name, room: z.room || z.name, lights: z.lights || [], poly: [[x, y], [x + w, y], [x + w, y + h], [x, y + h]] };
        }) };
    }
    return { blocks: B, plan, orientation: 'landscape' };
  }

  /* ───────── formato de diseño v2: columnas con ancho, bandas arriba y abajo, ancho de cada tarjeta ─────────
     layout.v = 2
     layout.cols = [ancho, …]   ancho relativo de cada columna de la tablet (0 = el ancho justo del contenido)
     layout.side = true         la columna 0 va al costado, de arriba a abajo (al lado de la hora), como el plano de siempre
     tarjeta.col = 0…3          su columna (tablet)          tarjeta.zone = 'top' | 'bottom'   banda de lado a lado (tablet)
     tarjeta.span = 1…4         ancho en cuartos (4 = completa, 2 = media)   tarjeta.fill = true   llena el alto que sobra */
  const TABLET_PRESETS = [
    ['side2', 'Plano al costado + 2 columnas', { side: true, cols: [0, 1, 1] }],
    ['side1', 'Plano al costado + 1 columna', { side: true, cols: [0, 1] }],
    ['c3', '3 columnas iguales', { side: false, cols: [1, 1, 1] }],
    ['big3', 'Una grande + 2 chicas', { side: false, cols: [2, 1, 1] }],
    ['c2', '2 columnas', { side: false, cols: [1, 1] }],
    ['c4', '4 columnas', { side: false, cols: [1, 1, 1, 1] }],
  ];
  /** Un diseño viejo (columna del plano + 2 columnas, «media columna», resumen que se iba arriba solo) al formato v2,
   *  sin que cambie cómo se ve. No modifica el original. */
  function migrateLayout(L, kind) {
    if (!L || L.v === 2) return L;
    const out = Object.assign({}, L, { v: 2 });
    out.blocks = (L.blocks || []).map((b0) => {
      const b = Object.assign({}, b0);
      if (b.size === 'half' && !b.span) b.span = 2;
      if (kind === 'tablet') {
        if (b.type === 'kpis' && (b.col || 0) !== 0 && !b.zone) b.zone = 'top'; // antes el resumen iba solo de lado a lado
        if (b.type === 'plan' && (b.col || 0) === 0 && b.fill == null) b.fill = true; // el plano llenaba su columna
      }
      return b;
    });
    if (kind === 'tablet') { if (out.side == null) out.side = true; if (!Array.isArray(out.cols) || !out.cols.length) out.cols = [0, 1, 1]; }
    return out;
  }

  /* ───────── una instancia por pantalla ───────── */
  /* estilos prearmados del diseño y degradés de fondo (el editor los ofrece; el servidor valida las mismas claves) */
  const STYLE_LIST = [
    ['matterai', 'MatterAI', 'Grafito y acento cálido, letra Red Hat'],
    ['apple', 'Tipo Apple', 'Tarjetas redondeadas sin bordes, letra del sistema, títulos grandes'],
    ['cristal', 'Cristal', 'Burbujas translúcidas sobre un fondo de color'],
    ['vision', 'Vision', 'Vidrio esmerilado sobre la casa, números grandes y finos (como Apple Vision Pro)'],
    ['control4', 'Control4', 'Oscuro con color: tarjetas sólidas, música con tapas y acentos azules'],
    ['savant', 'Savant', 'Negro elegante y minimalista, títulos finos y acento dorado'],
  ];
  const STYLES = STYLE_LIST.map((x) => x[0]);
  const GRAD_LIST = [
    ['aurora', 'Aurora', 'radial-gradient(90% 70% at 15% 10%,#2b5876 0,transparent 60%),radial-gradient(80% 70% at 90% 30%,#4e4376 0,transparent 60%),radial-gradient(90% 80% at 50% 100%,#1d6b5f 0,transparent 60%),#0f1419'],
    ['atardecer', 'Atardecer', 'linear-gradient(160deg,#3a1c4a 0%,#9c3d54 45%,#e2703a 80%,#eeb86d 100%)'],
    ['oceano', 'Océano', 'linear-gradient(170deg,#0b1a33 0%,#123f6b 50%,#1f7a8c 100%)'],
    ['bosque', 'Bosque', 'linear-gradient(165deg,#0f2017 0%,#1f4d36 55%,#5b8c5a 100%)'],
    ['noche', 'Noche', 'radial-gradient(120% 80% at 50% 0%,#232b3b 0,#0b0e14 70%)'],
    ['arena', 'Arena (claro)', 'linear-gradient(170deg,#f6efe6 0%,#ead9c4 60%,#d9c2a5 100%)'],
    ['nube', 'Nube (claro)', 'linear-gradient(170deg,#eef3fa 0%,#dbe6f4 55%,#c9d8ee 100%)'],
    ['calido', 'Living cálido', 'radial-gradient(80% 60% at 20% 20%,#a8876a 0,transparent 60%),radial-gradient(70% 60% at 85% 80%,#6f5643 0,transparent 60%),linear-gradient(160deg,#8d735d,#5a4636)'],
    ['violeta', 'Noche violeta', 'radial-gradient(90% 70% at 85% 10%,#6b2c4f 0,transparent 60%),radial-gradient(80% 70% at 10% 90%,#2b2e6b 0,transparent 60%),#141522'],
  ];
  /* Plantillas: un estilo + un orden de tarjetas para celular y tablet. Se completan solas con lo de cada casa
     (las tarjetas en automático eligen los equipos, ambientes, escenas y cámaras que haya). */
  const TEMPLATE_LIST = [
    ['matterai', 'MatterAI', 'La de siempre: plano, resumen, escenas, cámara y ambientes'],
    ['vision', 'Vision', 'Vidrio sobre la casa: termostato grande, clima, luces y ambientes'],
    ['control4', 'Control4', 'Oscuro con color: accesos por tema, música con tapas, cámaras y aire'],
    ['savant', 'Savant', 'Negro y dorado, minimalista: ambientes grandes, escenas, aire y seguridad'],
  ];
  function template(k, kind, m, legacy, S, floorplan) {
    const base = defaults(kind, m, legacy, S, floorplan);
    if (!k || k === 'matterai') return base;
    S = S || {};
    const n = (t, col, extra) => Object.assign({ id: `${k}-${t}`.slice(0, 24), type: t, col: kind === 'tablet' ? col : 0, cfg: {} }, extra || {}, { col: kind === 'tablet' ? col : 0 });
    const clim = Object.keys(S).find((x) => x.startsWith('climate.'));
    const lock = m && (m.access || []).find((x) => x.startsWith('lock.'));
    const cams = (m && m.cams) || [];
    const rooms = base.blocks.find((b) => b.type === 'rooms');
    const roomsCfg = (style) => Object.assign({}, rooms ? rooms.cfg : { auto: true }, { style });
    const plan = base.blocks.find((b) => b.type === 'plan');
    const T = kind === 'tablet';
    let B, G = null; // G: cómo se reparte la tablet (columnas, si la primera va al costado)
    const top = { zone: 'top' }, bot = { zone: 'bottom' };
    // equipos de la casa para los mosaicos y los accesos
    const pick = (pred, n) => Object.keys(S).filter((id) => pred(id, S[id])).slice(0, n);
    const dev = (id, s) => /^(light|switch|fan|media_player|cover|lock|input_boolean)\./.test(id) && !(s.attributes || {}).entity_id && !/grupo|todas|_group/i.test(id + (s.attributes.friendly_name || ''));
    const tilesFor = (n) => {
      const gar = pick((id, s) => id.startsWith('cover.') && ['garage', 'gate'].includes(s.attributes.device_class), 2);
      const rest = pick((id, s) => dev(id, s) && !gar.includes(id), n);
      return [...gar, ...rest].slice(0, n).map((id) => ({ entity: id }));
    };
    const roomChips = (m && m.rooms ? m.rooms.slice().sort((x, y) => (y.count || 0) - (x.count || 0)).slice(0, 6) : []).map((r) => ({ name: r.name, icon: '', tap: { type: 'room', room: r.name } })); // pestañas sin ícono, como en Vision
    const themeChips = [
      { name: 'Seguridad', icon: 'shield', tap: { type: 'screen', screen: 'seguridad' } },
      { name: 'Luces', icon: 'bulb', tap: { type: 'screen', screen: 'luces' } },
      clim ? { name: 'Clima', icon: 'temp', tap: { type: 'more_info', entity: clim } } : { name: 'Clima', icon: 'cloud', tap: { type: 'screen', screen: 'clima' } },
      { name: 'Aberturas', icon: 'door', tap: { type: 'screen', screen: 'aberturas' } },
      cams.length ? { name: 'Cámaras', icon: 'cam', tap: { type: 'screen', screen: 'camaras' } } : null,
      { name: 'Música', icon: 'music', tap: { type: 'screen', screen: 'musica' } },
    ].filter(Boolean);
    const camHalf = (id, i, col) => n(`cam${i}`, col, { type: 'camera', title: S[id] && S[id].attributes.friendly_name ? String(S[id].attributes.friendly_name).replace(/^(c[aá]mara|camera)\s*/i, '') : 'Cámara', size: 'half', cfg: { entity: id, video: 'photo' } });
    if (k === 'vision') {
      // Apple Vision Pro: ambientes arriba como pestañas, termostato y música en una columna clara a la derecha,
      // datos grandes y mosaicos cuadrados con su interruptor
      // tablet: las pestañas de ambientes de lado a lado arriba; ambientes · lo del medio (doble) · hora, clima y música
      G = { side: false, cols: [1, 2, 1] };
      B = T ? [
        n('chips', 1, Object.assign({ type: 'buttons', cfg: { style: 'chips', items: roomChips } }, top)),
        n('rooms', 0, { title: 'Ambientes', cfg: roomsCfg('photo') }),
        n('kpis', 1, { cfg: { auto: true } }),
        n('tiles', 1, { type: 'buttons', title: 'Dispositivos', cfg: { style: 'tiles', cols: 2, items: tilesFor(4) } }),
        n('energy', 1, { title: 'Consumo' }),
        n('clock', 2),
        clim ? n('climate', 2, { title: 'Termostato', cfg: { entity: clim, style: 'big' } }) : n('weather', 2),
        n('music', 2, { title: 'Música' }),
      ] : [
        n('chips', 0, { type: 'buttons', cfg: { style: 'chips', items: roomChips } }),
        n('kpis', 0, { cfg: { auto: true } }),
        clim ? n('climate', 0, { title: 'Termostato', cfg: { entity: clim, style: 'big' } }) : null,
        n('tiles', 0, { type: 'buttons', title: 'Dispositivos', cfg: { style: 'tiles', cols: 2, items: tilesFor(4) } }),
        n('music', 0, { title: 'Música' }),
      ];
    } else if (k === 'control4') {
      // Control4: arriba la barra de temas (Seguridad, Luces, Clima…), una fila de portadas (escenas),
      // la grilla de controles oscuros (aire, portones, alarma), las cámaras como fotos y la música abajo de lado a lado
      // tablet: el plano al costado (todo el alto), la barra de temas arriba y la música abajo, de lado a lado
      G = plan ? { side: true, cols: [0, 1, 1] } : { side: false, cols: [1, 1, 1] };
      B = T ? [
        plan ? Object.assign({}, plan, { fill: true }) : n('rooms', 0, { title: 'Ambientes', cfg: roomsCfg('list') }),
        n('chips', 1, Object.assign({ type: 'buttons', cfg: { style: 'chips', items: themeChips } }, top)),
        n('scenes', 1, { title: 'Escenas', cfg: { auto: true, style: 'covers' } }),
        clim ? n('climate', 1, { title: 'Aire', cfg: { entity: clim } }) : null,
        n('grid', 1, { type: 'buttons', cfg: { cols: 2, items: tilesFor(4).concat(m && m.alarm ? [{ entity: m.alarm.entity_id, name: 'Alarma' }] : []).slice(0, 4) } }),
        ...cams.slice(0, 2).map((id, i) => camHalf(id, i, 2)),
        n('routines', 2, { title: 'Rutinas', cfg: { auto: true } }),
        n('music', 1, Object.assign({ title: 'Música' }, bot)),
      ] : [
        n('chips', 0, { type: 'buttons', cfg: { style: 'chips', items: themeChips } }),
        n('scenes', 0, { title: 'Escenas', cfg: { auto: true, style: 'covers' } }),
        n('grid', 0, { type: 'buttons', cfg: { cols: 2, items: tilesFor(4) } }),
        n('routines', 0, { title: 'Rutinas', cfg: { auto: true, style: 'list' } }),
        ...cams.slice(0, 2).map((id, i) => camHalf(id, i, 0)),
      ];
    } else if (k === 'savant') {
      // Savant / Lutron: los ambientes son la pantalla (tarjetas grandes), negro y dorado, todo minimalista;
      // a la derecha la hora, las escenas, el clima y la seguridad
      // tablet: los ambientes ocupan la mitad (columna doble), a la derecha dos columnas angostas
      G = { side: false, cols: [2, 1, 1] };
      B = T ? [
        n('rooms', 0, { title: 'Ambientes', cfg: roomsCfg('photo') }),
        n('clock', 1),
        n('scenes', 1, { title: 'Escenas', cfg: { auto: true } }),
        clim ? n('climate', 1, { title: 'Clima', cfg: { entity: clim, style: 'big' } }) : n('weather', 1),
        n('alarm', 2, { title: 'Seguridad' }),
        lock ? n('lock', 2, { title: 'Entrada', cfg: { entity: lock } }) : null,
        cams.length ? n('frigate', 2, { title: 'Cámaras' }) : null,
        n('music', 2, { title: 'Música' }),
      ] : [
        n('rooms', 0, { title: 'Ambientes', cfg: roomsCfg('photo') }),
        n('scenes', 0, { title: 'Escenas', cfg: { auto: true } }),
        clim ? n('climate', 0, { title: 'Clima', cfg: { entity: clim, style: 'big' } }) : null,
        n('alarm', 0, { title: 'Seguridad' }),
      ];
    } else return base;
    const out = Object.assign({}, base, { blocks: B.filter(Boolean), style: k });
    if (T && G) { out.v = 2; out.side = G.side; out.cols = G.cols; out.blocks.forEach((b) => { if (b.size === 'half' && !b.span) { b.span = 2; delete b.size; } }); }
    return out;
  }
  const GRADS = Object.fromEntries(GRAD_LIST.map((g) => [g[0], g[2]]));

  function create(el, ctx) {
    const X = { el, ctx, view: null, layout: null, sheet: null, menuFor: null, hidePlayer: false, cache: {}, signed: {}, held: false, camT: null, hist: {}, simOver: null, shown: {}, curB: null, live: {}, colSig: {}, partCache: {},
      dismissed: new Set(load('matterai.vista.dismissed', [])) };
    const card = () => ctx.card;
    const hass = () => ctx.hass && ctx.hass();
    const M = () => { const c = card(); return c && c.model ? c.model() : null; };
    // en el editor se pueden simular estados (noche, alarma disparada, música, portón abierto) sin tocar la casa
    const st = (id) => {
      if (id && X.simOver && X.simOver[id]) return X.simOver[id];
      const h = hass(), real = (id && h && h.states && h.states[id]) || null;
      // play/pausa al instante: se ve ya lo que se tocó, hasta que la casa lo confirma (o pasan 4 s)
      const o = id && X.opt && X.opt[id];
      if (o && real) { if (Date.now() < o.until && real.state !== o.state && real.last_updated === o.from) return Object.assign({}, real, { state: o.state }); delete X.opt[id]; }
      return real;
    };
    const now = () => { if (ctx.sim && ctx.sim.night) { const d = new Date(); d.setHours(23, 30, 0, 0); return d; } return new Date(); };
    const isNight = () => { const h = now().getHours(); return h < 7 || h >= 20; };
    const fname = (id) => { const s = st(id); return (s && s.attributes.friendly_name) || id || ''; };
    const url = (u) => (u && u.charAt(0) === '/' && !u.startsWith('/api/matterai/media/') ? (ctx.base() || '').replace(/\/+$/, '') + u : u);
    const toast = (t) => ctx.toast && ctx.toast(t);
    const vib = () => { try { if (navigator.vibrate) navigator.vibrate(10); } catch (_) { /* sin vibración */ } };
    const kind = () => ctx.kind || (X.view && X.view.kind) || 'phone';
    const editing = () => !!ctx.edit;
    function load(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (_) { return d; } }
    function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) { /* sin almacenamiento */ } }

    // imágenes privadas de la casa: link firmado (se renueva solo)
    function img(path) {
      if (!path) return '';
      if (!path.startsWith('/api/matterai/media/')) return url(path);
      const c = X.signed[path];
      if (c && c.until > Date.now()) return c.url;
      if (!c || !c.pending) {
        X.signed[path] = { url: c ? c.url : '', until: 0, pending: true };
        Promise.resolve(ctx.sign ? ctx.sign(path) : path).then((u) => { X.signed[path] = { url: u && u.charAt(0) === '/' ? (ctx.base() || '').replace(/\/+$/, '') + u : u, until: Date.now() + 20 * 3600e3 }; X.cache = {}; render(); })
          .catch(() => { X.signed[path] = { url: '', until: Date.now() + 60e3 }; });
      }
      return c ? c.url : '';
    }

    /** El fondo del diseño en CSS: un color, un degradé prearmado o una imagen de la casa (oscurecida para que se lea). */
    function bgCSS(bg, light) {
      if (!bg || !bg.kind || bg.kind === 'none') return '';
      if (bg.kind === 'color' && /^#[0-9a-f]{6}$/i.test(bg.color || '')) return bg.color;
      if (bg.kind === 'gradient' && GRADS[bg.gradient]) return GRADS[bg.gradient];
      if (bg.kind === 'image' && bg.image) {
        const u = img(bg.image); if (!u) return '';
        const d = Math.max(0, Math.min(0.8, Number(bg.dim == null ? 0.35 : bg.dim)));
        const tint = light ? `rgba(255,255,255,${d})` : `rgba(8,10,14,${d})`;
        return `linear-gradient(${tint},${tint}),url("${String(u).replace(/["\\\n]/g, '')}") center/cover no-repeat`;
      }
      return '';
    }

    /* layout: lo del editor, o el prearmado */
    function layout(m) {
      // embebido (las tarjetas de adentro de un ambiente): sólo su lista, nunca el prearmado
      if (ctx.embed) { const v = X.view || {}; return { blocks: v.blocks || [], v: 2, theme: v.theme || null, style: v.style || null, bg: null, plan: v.plan || null }; }
      return migrateLayout(layoutRaw(m), kind());
    }
    function layoutRaw(m) {
      const v = X.view || {};
      const mine = !editing() ? load('matterai.template', '') : '';
      if (mine && TEMPLATE_LIST.some((x) => x[0] === mine)) {
        const cfg0 = card() && card()._config;
        const d = template(mine, kind(), m, v, (hass() || {}).states, cfg0 && cfg0.floorplan);
        if (v.plan) d.plan = v.plan;
        d.header = v.header || null; d.dock = v.dock || null; d.theme = v.theme || null; d.style = mine; d.bg = null;
        return d;
      }
      if (Array.isArray(v.blocks) && v.blocks.length) return { blocks: v.blocks, plan: v.plan || null, orientation: v.orientation || 'landscape', header: v.header || null, dock: v.dock || null, theme: v.theme || null, style: v.style || null, bg: v.bg || null, v: v.v, cols: v.cols, side: v.side };
      const cfg = card() && card()._config;
      const d = defaults(kind(), m, v, (hass() || {}).states, cfg && cfg.floorplan);
      if (v.plan) d.plan = v.plan;
      d.header = v.header || null; d.dock = v.dock || null; d.theme = v.theme || null; d.style = v.style || null; d.bg = v.bg || null;
      return d;
    }
    const roomByName = (m, n) => m.rooms.find((r) => r.name.toLowerCase() === String(n).toLowerCase() || String(r.id).toLowerCase() === String(n).toLowerCase());

    /* ───────── acciones (lo que hace cada botón) ───────── */
    function run(a, item) {
      const c = card(), m = M(); if (!a || !c || !m) return;
      const ent = a.entity || (item && item.entity);
      if (a.confirm && typeof confirm === 'function' && !confirm(`¿${(item && item.name) || fname(ent) || 'Seguro'}?`)) return;
      vib();
      switch (a.type) {
        case 'toggle': {
          if (!ent) return;
          const d = ent.split('.')[0];
          if (d === 'lock' || d === 'cover') return c.access(ent); // con la confirmación y la huella / PIN de la app
          if (d === 'scene' || d === 'script') return c.call(d, 'turn_on', { entity_id: ent });
          if (d === 'button' || d === 'input_button') return c.call(d, 'press', { entity_id: ent });
          if (d === 'alarm_control_panel') return openSheet('alarm', ent);
          return c.call('homeassistant', 'toggle', { entity_id: ent });
        }
        case 'more_info': return ent && ctx.openEntity(ent);
        case 'room': { const r = roomByName(m, a.room || ''); return r && c.openRoom(r.id); }
        case 'screen': return screen(a.screen);
        case 'service': {
          if (!a.service) return;
          const [d, s] = a.service.split('.');
          const data = Object.assign({}, a.data || {});
          if (ent && !data.entity_id) data.entity_id = ent;
          return c.call(d, s, data);
        }
        default: return undefined;
      }
    }
    function screen(k) {
      const c = card(), m = M();
      switch (k) {
        case 'agenda': return m.f.agenda && c.openPanel('agenda');
        case 'clima': return m.weather && c.openPanel('weather');
        case 'musica': return c.openMusic();
        case 'actividad': return c.openActivity();
        case 'camaras': return c.openCameras();
        case 'seguridad': case 'aberturas': return c.openPanel('open');
        case 'luces': return c.openPanel('lights');
        case 'avisos': return openSheet('avisos');
        case 'casa': return openSheet('casa');
        case 'menu': return ctx.openMenu && ctx.openMenu();
        case 'automatizaciones': return ctx.openAutomations && ctx.openAutomations();
        default: return undefined;
      }
    }

    /* ───────── estados que se muestran ───────── */
    function gateState(id) {
      const s = st(id); if (!s) return { word: '', btn: '', open: false };
      const lock = id.startsWith('lock.');
      const open = lock ? s.state !== 'locked' : ['open', 'opening'].includes(s.state);
      const moving = ['opening', 'closing', 'locking', 'unlocking'].includes(s.state);
      return { lock, open, moving, word: lock ? (open ? 'Abierta' : 'Cerrada') : moving ? 'Moviendo' : open ? 'Abierto' : 'Cerrado',
        btn: moving ? 'Moviendo…' : lock ? (open ? 'Cerrar' : 'Abrir') : open ? 'Cerrar' : 'Abrir' };
    }
    function entState(id) {
      const s = st(id); if (!s) return { on: false, txt: 'No disponible' };
      const d = id.split('.')[0], v = s.state;
      if (d === 'cover' || d === 'lock') { const g = gateState(id); return { on: g.open, txt: g.word }; }
      if (d === 'climate') return { on: v !== 'off', txt: v === 'off' ? 'Apagado' : `${s.attributes.temperature != null ? s.attributes.temperature + '° · ' : ''}${v === 'cool' ? 'Frío' : v === 'heat' ? 'Calor' : 'Auto'}` };
      if (d === 'sensor') return { on: false, txt: `${v}${s.attributes.unit_of_measurement ? ' ' + s.attributes.unit_of_measurement : ''}` };
      if (d === 'binary_sensor') return { on: v === 'on', txt: v === 'on' ? 'Activo' : 'Normal' };
      if (d === 'scene' || d === 'script' || d === 'button' || d === 'input_button') return { on: false, txt: 'Tocar' };
      if (d === 'media_player') return { on: v === 'playing', txt: v === 'playing' ? 'Sonando' : v === 'off' ? 'Apagado' : 'En pausa' };
      if (d === 'alarm_control_panel') return { on: v.startsWith('armed') || v === 'triggered', txt: v.startsWith('armed') ? 'Armada' : v === 'triggered' ? 'Disparada' : 'Desarmada' };
      return { on: v === 'on', txt: v === 'on' ? 'Prendido' : v === 'off' ? 'Apagado' : v };
    }
    function defIcon(id) {
      const d = (id || '').split('.')[0], dc = (st(id) || { attributes: {} }).attributes.device_class;
      return { light: 'bulb', switch: 'plug', cover: dc === 'garage' || dc === 'gate' ? 'gate' : 'curt', lock: 'lock', climate: 'snow', fan: 'fan', media_player: 'music', scene: 'spark', script: 'spark',
        camera: 'cam', alarm_control_panel: 'shield', sensor: 'temp', binary_sensor: 'door', automation: 'robot', button: 'power', input_boolean: 'power' }[d] || 'power';
    }
    const kpiAuto = (m, k) => {
      const out = [];
      if (m.alarm) out.push({ kind: 'alarm' });
      const g = m.access[0]; if (g) out.push({ kind: 'entity', entity: g });
      out.push({ kind: 'lights' });
      if (k === 'tablet') { out.push({ kind: 'acs' }); out.push({ kind: 'curtains' }); out.push(m.power ? { kind: 'power' } : { kind: 'temp' }); }
      else if (!m.alarm || !g) out.splice(2, 0, { kind: 'temp' });
      return out.slice(0, k === 'tablet' ? 6 : 3);
    };
    function kpi(m, it, i) {
      let ico = 'power', lbl = '', val = '', cls = '', alert = false, tap = it.tap;
      if (it.kind === 'alarm' && m.alarm) {
        const a = m.alarm.state, armed = a.startsWith('armed'), trig = a === 'triggered';
        ico = 'shield'; lbl = it.name || 'Alarma'; val = trig ? 'Disparada' : armed ? 'Armada' : a === 'arming' ? 'Armando' : 'Desarmada'; cls = trig || armed ? 'r' : 'g'; alert = trig || armed;
        tap = tap || { type: 'toggle', entity: m.alarm.entity_id };
      } else if (it.kind === 'lights') {
        ico = 'bulb'; lbl = it.name || 'Luces'; val = m.lightsOn ? `${m.lightsOn} prendida${m.lightsOn > 1 ? 's' : ''}` : 'Apagadas'; cls = m.lightsOn ? 'w' : ''; tap = tap || { type: 'screen', screen: 'luces' };
      } else if (it.kind === 'temp') { ico = 'temp'; lbl = it.name || 'Adentro'; val = m.tempIn != null ? `${dec(m.tempIn)}°` : '—'; }
      else if (it.kind === 'acs') {
        const on = m.rooms.flatMap((r) => r.climOn || []); ico = 'snow'; lbl = it.name || 'Aires'; val = on.length ? `${on.length} prendido${on.length > 1 ? 's' : ''}` : 'Apagados'; cls = on.length ? 'c' : '';
      } else if (it.kind === 'curtains') {
        const cv = [...new Set(m.rooms.flatMap((r) => r.covers || []))].filter((id) => !['gate', 'garage', 'door'].includes((st(id) || { attributes: {} }).attributes.device_class));
        const open = cv.filter((id) => (st(id) || {}).state === 'open'); ico = 'curt'; lbl = it.name || 'Cortinas'; val = cv.length ? (open.length ? `${open.length} abierta${open.length > 1 ? 's' : ''}` : 'Cerradas') : '—';
      } else if (it.kind === 'power') { ico = 'bolt'; lbl = it.name || 'Consumo'; val = m.power ? `${m.power.state} ${m.power.attributes.unit_of_measurement || ''}` : '—'; }
      else if (it.kind === 'people') { const n = m.people.filter((p) => p.state === 'home').length; ico = 'user'; lbl = it.name || 'En casa'; val = n ? `${n} en casa` : 'Nadie'; }
      else if (it.entity) {
        const s = entState(it.entity), g = /^(cover|lock)\./.test(it.entity) ? gateState(it.entity) : null;
        ico = it.icon || defIcon(it.entity); lbl = it.name || fname(it.entity).split(' ').slice(0, 2).join(' '); val = s.txt;
        cls = g ? (g.open ? 'r' : 'g') : s.on ? 'w' : ''; alert = !!(g && g.open); tap = tap || { type: 'toggle', entity: it.entity };
      } else return '';
      return `<button class="v-kpi ${alert ? 'alert' : ''}" data-kt="${i}"${EL(i)}><span class="l">${ic(it.icon || ico)}<span>${esc(lbl)}</span></span><span class="v ${cls}">${esc(val)}</span></button>`;
    }
    /* Editor: cada cosa de adentro de una tarjeta (un dato, una escena, un ambiente…) se toca, se elige y se edita sola */
    const EL = (i) => (editing() ? ` data-el="${i}"${ctx.edit.selected === X.curB && ctx.edit.el != null && String(ctx.edit.el) === String(i) ? ' data-elsel="1"' : ''}` : '');
    const elAdd = () => ''; // lo de adentro se agrega en la ventana de la tarjeta (como en Lovelace)
    /** La lista de una tarjeta: la armada a mano (con nombre, ícono, modo) o la que elige la app sola. */
    function listOf(c, autoIds, max) {
      if (!c.auto && c.items && c.items.length) return c.items.filter((x) => x && x.entity);
      if (!c.auto && c.entities && c.entities.length) return c.entities.map((e) => ({ entity: e }));
      return autoIds.filter((id) => st(id)).slice(0, max || 24).map((e) => ({ entity: e }));
    }
    const nameIn = (c, id) => { const x = (c.items || []).find((y) => y && y.entity === id); return (x && x.name) || ''; };
    /** Escenas y automatizaciones de MatterAI (las del motor de la integración): primero, antes que las de Home Assistant. */
    const maeRole = (role) => { const S = (hass() || {}).states || {}; return Object.keys(S).filter((x) => (S[x].attributes || {}).matterai_role === role).sort((a, b) => fname(a).localeCompare(fname(b), 'es')); };
    /** Las rutinas de una tarjeta (las elegidas, o las automatizaciones de la casa) y sus filas con interruptor o «Ejecutar». */
    function routineList(c, max) {
      const S = (hass() || {}).states || {};
      return listOf(c, [...maeRole('routine'), ...Object.keys(S).filter((x) => x.startsWith('automation.'))], max).filter((x) => S[x.entity] || editing());
    }
    function routineRows(list, withEl) {
      const S = (hass() || {}).states || {};
      const last = (s) => { const t = s && (s.attributes.last_triggered || s.attributes.last_run); return t ? 'Última: ' + new Date(t).toLocaleString('es-AR', { weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false }) : 'Nunca se ejecutó'; };
      return list.map((x, i) => { const s = S[x.entity], run = x.mode === 'run' || x.entity.startsWith('script.');
        return `<div class="v-rti"${withEl ? EL(i) : ''}><span class="v-tx"><b>${esc(x.name || fname(x.entity))}</b><span>${esc(s ? last(s) : 'No existe en la casa')}</span></span>${run ? `<button class="v-btn1" data-run="${esc(x.entity)}">Ejecutar</button>` : `<button class="v-pw ${s && s.state === 'on' ? 'on' : ''}" data-auto="${esc(x.entity)}" aria-label="Activar o desactivar"></button>`}</div>`; }).join('');
    }
    function roomRow(r, mark, i) {
      const n = r.lightsOn.length, hasL = r.lightsCtl.length > 0, bits = [n ? `${n} prendida${n > 1 ? 's' : ''}` : (r.count ? 'Apagado' : '')];
      if (r.temp != null) bits.push(`${dec(r.temp)}°`);
      return `<div class="v-room${mark ? ' mark' : ''}" data-room="${esc(r.id)}"${i != null ? EL(i) : ''}><span class="v-ric ${n ? 'on' : ''}">${ic(roomIc(r))}</span><span class="v-tx"><b>${esc(r.name)}</b><span>${esc(bits.filter(Boolean).join(' · ') || 'Ver')}</span></span>${hasL ? `<button class="v-pw ${n ? 'on' : ''}" data-tog="${esc(r.id)}" aria-label="Luces de ${esc(r.name)}"></button>` : `<span class="v-chev">${ic('chev')}</span>`}</div>`;
    }
    function roomTile(r, i) {
      const n = r.lightsOn.length;
      return `<div class="v-tile ${n ? 'lit' : ''}" data-room="${esc(r.id)}"${i != null ? EL(i) : ''}><span class="v-tic">${ic(roomIc(r))}</span><b>${esc(r.name)}</b><span>${n ? `${n} prendida${n > 1 ? 's' : ''}` : 'Apagado'}</span></div>`;
    }
    // video continuo (MJPEG) de la cámara: lo que se ve mientras carga el visor de Frigate y en la vista previa del editor
    const camStream = (id) => { const s = st(id), p = s && s.attributes.entity_picture; return p ? url(p.replace('/api/camera_proxy/', '/api/camera_proxy_stream/')) : ''; };
    // iPhone / iPad: el video continuo (MJPEG) en una imagen llena la memoria hasta que iOS cierra la página
    // («Ocurrió un problema varias veces»). Ahí el «video» son fotos seguidas, cada una cuando terminó la anterior.
    const IOS = typeof navigator !== 'undefined' && (/iPhone|iPad|iPod/.test(navigator.userAgent || '') || (/Macintosh/.test(navigator.userAgent || '') && navigator.maxTouchPoints > 1));
    const camSrc = (id) => { const s = st(id); return s && s.attributes.entity_picture ? url(s.attributes.entity_picture) + (s.attributes.entity_picture.includes('?') ? '&' : '?') + 't=' + Math.floor(Date.now() / 10000) : ''; };
    /** Equipos de una tarjeta: los elegidos, o los de los ambientes elegidos, o los de la casa (hasta 8). */
    function entsOf(c, m, dom, roomKey) {
      if (!c.auto && c.items && c.items.length) return c.items.map((x) => x && x.entity).filter((id) => id && st(id));
      if (c.entities && c.entities.length) return c.entities.filter((id) => st(id));
      const S = (hass() || {}).states || {};
      const rooms = c.rooms && c.rooms.length ? c.rooms.map((n) => roomByName(m, n)).filter(Boolean) : null;
      const out = rooms ? rooms.flatMap((r) => r[roomKey] || []) : (m.rooms || []).flatMap((r) => r[roomKey] || []);
      const ids = (out.length || rooms ? out : Object.keys(S)).filter((id, i, a) => id.startsWith(`${dom}.`) && st(id) && a.indexOf(id) === i);
      return ids.slice(0, rooms ? 24 : 8);
    }
    /** Historial de las últimas 24 h de un sensor (para el gráfico); se pide a la casa cada 5 minutos. */
    function hist(id) {
      const h = X.hist[id];
      if (h && h.until > Date.now()) return h.pts;
      const H = hass();
      if ((!h || !h.pending) && H && typeof H.callWS === 'function') {
        X.hist[id] = { pts: h ? h.pts : null, until: 0, pending: true };
        H.callWS({ type: 'history/history_during_period', start_time: new Date(Date.now() - 864e5).toISOString(), entity_ids: [id], minimal_response: true, no_attributes: true, significant_changes_only: false })
          .then((r) => {
            const L = (r && r[id]) || [];
            const pts = L.map((x) => [x.lu ? x.lu * 1000 : Date.parse(x.last_updated || x.last_changed || 0), Number(x.s != null ? x.s : x.state)]).filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]));
            X.hist[id] = { pts, until: Date.now() + 300e3 }; X.cache = {}; render();
          })
          .catch(() => { X.hist[id] = { pts: [], until: Date.now() + 60e3 }; });
      }
      return h ? h.pts : null;
    }
    function spark(pts) {
      if (!pts || pts.length < 2) return '<div class="v-spark none"></div>';
      const t0 = Date.now() - 864e5, t1 = Date.now(), vs = pts.map((p) => p[1]), lo = Math.min(...vs), hi = Math.max(...vs), r = hi - lo || 1;
      const xy = pts.map(([t, v]) => `${(((Math.max(t, t0) - t0) / (t1 - t0)) * 300).toFixed(1)},${(56 - ((v - lo) / r) * 50).toFixed(1)}`);
      xy.push(`300,${xy[xy.length - 1].split(',')[1]}`);
      return `<svg class="v-spark" viewBox="0 0 300 60" preserveAspectRatio="none" aria-hidden="true"><polyline points="${xy.join(' ')}"/></svg>`;
    }
    /** ¿Se ve esta tarjeta ahora? (todas sus condiciones se cumplen) */
    function visible(b, m) {
      return (b.show || []).every((q) => {
        const s = st(q.entity), al = m.alarm && st(m.alarm.entity_id);
        switch (q.type) {
          case 'state': return !!s && s.state === q.state;
          case 'not_state': return !s || s.state !== q.state;
          case 'night': return isNight();
          case 'day': return !isNight();
          case 'music': return !!player();
          case 'alarm_armed': return !!al && (al.state.startsWith('armed') || al.state === 'triggered');
          case 'alarm_off': return !!al && al.state === 'disarmed';
          case 'someone_home': return (m.people || []).some((p) => (st(p.entity_id) || p).state === 'home');
          case 'nobody_home': return (m.people || []).length > 0 && (m.people || []).every((p) => (st(p.entity_id) || p).state !== 'home');
          default: return true;
        }
      });
    }
    /** Simulación del editor: cambia el estado que se muestra (nunca el de la casa). */
    function buildSim(m) {
      const s = ctx.sim || {}, H = (hass() || {}).states || {}, o = {};
      const patch = (id, state, attrs) => { const b = H[id]; if (b) o[id] = Object.assign({}, b, { state, attributes: Object.assign({}, b.attributes, attrs || {}), last_changed: new Date().toISOString() }); };
      if (s.alarm && m.alarm) patch(m.alarm.entity_id, 'triggered');
      if (s.gate && m.access && m.access[0]) patch(m.access[0], m.access[0].startsWith('lock.') ? 'unlocked' : 'open');
      if (s.music) {
        const c = card(), ids = c && c.players ? c.players() : [];
        if (ids[0]) patch(ids[0], 'playing', { media_title: 'Canción de prueba', media_artist: 'MatterAI', media_duration: 200, media_position: 70, media_position_updated_at: new Date().toISOString() });
      }
      X.simOver = Object.keys(o).length ? o : null;
      return X.simOver && m.alarm && X.simOver[m.alarm.entity_id] ? Object.assign({}, m, { alarm: X.simOver[m.alarm.entity_id] }) : m;
    }
    function player() {
      const c = card(); if (!c || !c.players) return null;
      const live = c.players().map(st).filter(Boolean);
      return live.find((s) => s.state === 'playing') || live.find((s) => s.state === 'paused' && s.attributes.media_title) || null;
    }

    /* ───────── cada tarjeta ───────── */
    function block(b, m) {
      const c = b.cfg || {}, K = kind(), t = b.title ? `<h3>${esc(b.title)}</h3>` : '';
      switch (b.type) {
        case 'kpis': {
          const items = (c.items && c.items.length && !c.auto) ? c.items : kpiAuto(m, K);
          X.kpiItems = X.kpiItems || {}; X.kpiItems[b.id] = items; X.shown[b.id] = items;
          return `${t}<div class="v-kpis n${Math.min(items.length, K === 'tablet' ? 6 : 3)}">${items.map((it, i) => kpi(m, it, i)).join('')}</div>${elAdd('Agregar un dato')}`;
        }
        case 'featured': case 'camera': case 'frigate': {
          // las cámaras elegidas en el editor (sólo esas); si no se eligió ninguna, todas las de la casa
          const picked = Array.isArray(c.entities) && c.entities.length;
          const list = [c.entity].concat(picked ? c.entities : (m.cams || [])).filter((id, i, a) => id && st(id) && a.indexOf(id) === i);
          X.camIdx = X.camIdx || {}; const ci = (X.camIdx[b.id] || 0) % Math.max(list.length, 1); X.camList = X.camList || {}; X.camList[b.id] = list;
          const cam = list[ci] || null, gate = c.gate && st(c.gate) ? c.gate : null;
          const g = gate ? gateState(gate) : null;
          const extra = (c.items || []).map((it, i) => `<button class="v-cbtn" data-it="${i}"${EL(i)}>${ic(it.icon || defIcon(it.entity))}${esc(it.name || fname(it.entity))}</button>`).join('');
          X.shown[b.id] = c.items || [];
          // video en vivo con el visor de Frigate (se arma aparte y no se corta cuando cambia otra cosa) o foto cada 10 s
          const video = !!cam && c.video !== 'photo', live = video && liveOk() && !editing();
          // en video: el visor de Frigate en el equipo; mientras carga (y en el editor) el video continuo de la cámara
          const photo = !cam ? '<div class="v-feed none"></div>' : video && IOS ? `<img class="v-feed" data-cam="${esc(cam)}" data-fast="1"${EL('cam')} alt="" src="${esc(camSrc(cam))}">`
            : video ? `<img class="v-feed" data-cam="${esc(cam)}" data-stream="1"${EL('cam')} alt="" src="${esc(camStream(cam))}">`
            : `<img class="v-feed" data-cam="${esc(cam)}"${EL('cam')} alt="" src="${esc(camSrc(cam))}">`;
          const feed = live ? `<div class="v-feed v-lslot" data-live="${esc(b.id)}" data-key="${esc(cam)}"></div>` : photo;
          // en video no va ningún cartel encima (como el visor de Frigate original); en modo foto se avisa que es foto
          const badge = !cam || video ? '' : '<span class="v-live photo">FOTO · cada 10 s</span>';
          const gateBtn = g ? `<button class="v-gate ${g.open ? 'open' : ''} ${g.moving ? 'mv' : ''}" data-gate="${esc(gate)}">${ic(g.lock ? 'lock' : 'gate')}${g.btn}</button>` : '';
          if (video) {
            // en video, nada encima de la imagen (como la tarjeta de Frigate original): el visor trae sus flechas y su menú.
            // La tarjeta «Cámaras en vivo (Frigate)» es sólo el visor; la del portero lleva sus botones debajo del video.
            const bar = b.type === 'frigate' ? '' : `${extra}${gateBtn}`;
            return `${t}<div class="v-cam clean ${live ? 'is-live' : ''}">${feed}${badge}</div>${bar ? `<div class="v-cbar">${bar}</div>` : ''}`;
          }
          return `${t}<div class="v-cam">${feed}${badge}${list.length > 1 ? `<span class="v-dots">${list.map((x, i) => `<b class="${i === ci ? 'on' : ''}"></b>`).join('')}</span>` : ''}
            <span class="v-lbl">${esc(cam ? fname(cam) : (b.title || ''))}</span><span class="v-cact">${list.length > 1 ? `<button class="v-cbtn" data-camnext="1">Otra cámara</button>` : ''}${b.type === 'frigate' ? '' : extra + gateBtn}</span></div>`;
        }
        case 'rooms': {
          const names = (c.rooms && c.rooms.length) ? c.rooms : m.rooms.slice(0, 4).map((r) => r.name);
          const pairs = names.map((n, i) => [roomByName(m, n), i]).filter((p) => p[0]);
          X.roomNames = names; X.shown[b.id] = names;
          const grid = c.style === 'grid' || c.style === 'photo' || (K === 'tablet' && c.style !== 'list');
          if (!pairs.length) return `${t}<p class="v-empty">${editing() ? 'Esta tarjeta no tiene ambientes todavía.' : 'Mantené apretado un ambiente en «Toda la casa» para fijarlo acá.'}</p>${elAdd('Agregar un ambiente')}`;
          return `${t}<div class="${grid ? `v-tiles${c.style === 'photo' ? ' photo' : ''}` : 'v-rooms'}">${pairs.map(([r, i]) => (grid ? roomTile(r, i) : roomRow(r, false, i))).join('')}</div>${elAdd('Agregar un ambiente')}`;
        }
        case 'scenes': {
          const list = listOf(c, [...maeRole('scene'), ...(m.scenes || [])], 12).filter((x) => st(x.entity) || editing());
          X.shown[b.id] = list;
          if (!list.length) return editing() ? `${t}<p class="v-empty">La casa no tiene escenas todavía.</p>${elAdd('Agregar una escena')}` : '';
          const icn = (n) => (/noche|dormir|night/i.test(n) ? 'moon' : /cine|pel[ií]cula|tv/i.test(n) ? 'film' : /sal|me voy|ausen/i.test(n) ? 'car' : /bienven|lleg/i.test(n) ? 'home' : /apag/i.test(n) ? 'power' : 'spark');
          if (c.style === 'covers') {
            // como las portadas de la música de Control4: un cuadrado de color por escena, con el nombre abajo
            const hue = (n) => { let h = 0; for (const ch of String(n)) h = (h * 31 + ch.charCodeAt(0)) % 360; return h; };
            return `${t}<div class="v-scovers">${list.map((x, i) => { const n = x.name || fname(x.entity), hh = hue(n);
              return `<button class="v-scover" data-scene="${esc(x.entity)}" data-n="${esc(n)}"${EL(i)}><span class="v-sart" style="--h1:${hh};--h2:${(hh + 50) % 360}">${ic(x.icon || icn(n))}</span><b>${esc(n)}</b></button>`; }).join('')}</div>${elAdd('Agregar una escena')}`;
          }
          return `${t}<div class="${K === 'tablet' ? 'v-sgrid' : 'v-scenes'}">${list.map((x, i) => { const n = x.name || fname(x.entity);
            return `<button class="v-scene" data-scene="${esc(x.entity)}" data-n="${esc(n)}"${EL(i)}><span class="v-sic">${ic(x.icon || icn(n))}</span>${esc(n)}</button>`; }).join('')}</div>${elAdd('Agregar una escena')}`;
        }
        case 'buttons': {
          const items = c.items || [];
          X.shown[b.id] = items;
          if (!items.length) return editing() ? `${t}<p class="v-empty">Esta tarjeta no tiene botones todavía.</p>${elAdd('Agregar un botón')}` : '';
          const cols = c.style !== 'list' && c.cols ? ` style="grid-template-columns:repeat(${Math.max(1, Math.min(4, +c.cols))},minmax(0,1fr))"` : '';
          const icOf = (it) => it.icon || (it.entity ? defIcon(it.entity) : 'spark');
          if (c.style === 'chips') {
            return `${t}<div class="v-chips">${items.map((it, i) => { const s = it.entity ? entState(it.entity) : { on: false };
              return `<button class="v-chp ${s.on ? 'on' : ''}" data-it="${i}"${EL(i)}>${it.icon === '' ? '' : ic(icOf(it))}<span>${esc(it.name || fname(it.entity) || 'Botón')}</span></button>`; }).join('')}</div>${elAdd('Agregar un botón')}`;
          }
          if (c.style === 'tiles') {
            const sw = (id) => id && !/^(scene|script|button|input_button|camera|alarm_control_panel)\./.test(id);
            return `${t}<div class="v-mosaic"${cols}>${items.map((it, i) => { const s = it.entity ? entState(it.entity) : { on: false, txt: '' };
              return `<button class="v-mtile ${s.on ? 'on' : ''}" data-it="${i}"${EL(i)}><span class="v-mtop"><span class="v-mdot">${ic('grid')}</span>${sw(it.entity) ? `<i class="v-msw ${s.on ? 'on' : ''}"></i>` : ''}</span>
                <span class="v-mbot"><span class="v-tx"><span>${esc(s.txt || '')}</span><b>${esc(it.name || fname(it.entity) || 'Botón')}</b></span>${ic(icOf(it))}</span></button>`; }).join('')}</div>${elAdd('Agregar un botón')}`;
          }
          return `${t}<div class="v-btns ${c.style === 'list' ? 'list' : ''}"${cols}>${items.map((it, i) => {
            const s = it.entity ? entState(it.entity) : { on: false, txt: it.tap && it.tap.type === 'screen' ? SCREEN_NAMES[it.tap.screen] || '' : '' };
            return `<button class="v-btn ${s.on ? 'on' : ''}" data-it="${i}"${EL(i)}><span class="v-bic">${ic(it.icon || (it.entity ? defIcon(it.entity) : 'spark'))}</span><span class="v-tx"><b>${esc(it.name || fname(it.entity) || 'Botón')}</b><span>${esc(s.txt)}</span></span></button>`;
          }).join('')}</div>${elAdd('Agregar un botón')}`;
        }
        case 'alarm': {
          const a = (c.entity && st(c.entity)) || m.alarm; if (!a) return editing() ? `${t}<p class="v-empty">La casa no tiene alarma.</p>` : '';
          const armed = a.state.startsWith('armed') || a.state === 'triggered';
          return `${t}<button class="v-alarm ${armed ? 'armed' : ''}" data-alarm="${esc(a.entity_id)}">${ic('shield')}<span class="v-tx"><b>${a.state === 'triggered' ? 'Alarma disparada' : armed ? 'Alarma armada' : 'Alarma desarmada'}</b><span>${armed ? 'Tocá para desarmar' : 'Tocá para armar'}</span></span></button>`;
        }
        case 'away': {
          const id = c.entity && st(c.entity) ? c.entity : Object.keys((hass() || {}).states || {}).find((x) => /^(input_boolean|switch)\./.test(x) && /ausen|simul|vacacion/i.test(x + fname(x)));
          if (!id) return editing() ? `${t}<p class="v-empty">Elegí el interruptor o la escena del modo ausente.</p>` : '';
          const s = entState(id), dd = id.split('.')[0];
          return `<div class="v-card ${s.on ? 'away' : ''}"><div class="v-row"><span class="v-tx"><b>${esc(b.title || 'Modo ausente')}</b><span>${s.on ? 'Activo · simulando presencia' : esc(fname(id))}</span></span>${dd === 'scene' || dd === 'script' ? `<button class="v-btn1" data-ent="${esc(id)}">Activar</button>` : `<button class="v-pw ${s.on ? 'on' : ''}" data-ent="${esc(id)}"></button>`}</div></div>`;
        }
        case 'routines': {
          const S = (hass() || {}).states || {};
          const asList = c.style === 'list';
          // por defecto es un botón que abre todas las rutinas (no se activan o desactivan desde la pantalla principal)
          const list = routineList(c, asList ? 4 : 200);
          X.shown[b.id] = list;
          if (!list.length) return editing() ? `${t}<p class="v-empty">Esta tarjeta no tiene rutinas todavía.</p>${elAdd('Agregar una rutina')}` : '';
          if (!asList) {
            const on = list.filter((x) => (S[x.entity] || {}).state === 'on').length;
            return `<div class="v-card v-rbtn" data-rsheet="${esc(b.id)}"><div class="v-row"><span class="v-bic">${ic('robot')}</span><span class="v-tx"><b>${esc(b.title || 'Rutinas')}</b>
              <span>${list.length} rutina${list.length === 1 ? '' : 's'}${on ? ` · ${on} activa${on === 1 ? '' : 's'}` : ''}</span></span><span class="v-chev">${ic('chev')}</span></div></div>`;
          }
          return `<div class="v-card">${t}<div class="v-rt">${routineRows(list, true)}</div>${elAdd('Agregar una rutina')}</div>`;
        }
        case 'music': {
          const p = player();
          if (!p) return editing() ? `${t}<p class="v-empty">Aparece cuando hay música sonando.</p>` : '';
          const art = p.attributes.entity_picture ? `style="background-image:url('${esc(url(p.attributes.entity_picture))}')"` : '';
          return `<div class="v-card v-mcard" data-k="player">${t}<div class="v-music"><span class="v-art" ${art}></span><span class="v-tx"><b>${esc(p.attributes.media_title || 'Música')}</b><span>${esc(p.attributes.media_artist || fname(p.entity_id))}</span></span>
            <button class="v-mb pl" data-mp="${esc(p.entity_id)}">${ic(p.state === 'playing' ? 'pause' : 'play')}</button><button class="v-mb" data-mn="${esc(p.entity_id)}">${ic('next')}</button></div></div>`;
        }
        case 'lock': {
          const id = c.entity && st(c.entity) ? c.entity : m.access.find((x) => x.startsWith('lock.'));
          if (!id) return editing() ? `${t}<p class="v-empty">Elegí la cerradura.</p>` : '';
          const g = gateState(id), s = st(id), bat = Object.keys((hass() || {}).states || {}).find((x) => x.startsWith('sensor.') && x.includes(id.split('.')[1]) && /bat/i.test(x));
          return `<div class="v-card">${t}<div class="v-row"><button class="v-lk ${g.open ? 'open' : ''}" data-gate="${esc(id)}">${ic(g.open ? 'unlock' : 'lock')}</button><span class="v-tx"><b>${g.word}</b><span>${esc(fname(id))}${bat ? ` · batería ${esc(st(bat).state)}%` : ''} · desde ${esc(new Date(s.last_changed).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false }))}</span></span></div></div>`;
        }
        case 'clock': {
          const d = new Date(), w = m.weather;
          return `<div class="v-clock" data-scr="agenda"><b>${esc(d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false }))}</b><span>${esc(d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }))}</span>${w ? `<button class="v-chip" data-scr="clima">${ic(WX[w.state] || 'sun')}${esc(Math.round(Number(w.attributes.temperature)))}°</button>` : ''}</div>`;
        }
        case 'plan': return planHTML(m, c.zoom);
        case 'weather': {
          const w = (c.entity && st(c.entity)) || m.weather;
          if (!w) return editing() ? `${t}<p class="v-empty">La casa no tiene clima: agregá una integración del clima (Met.no).</p>` : '';
          const a = w.attributes, bits = [WX_TXT[w.state] || w.state];
          if (a.humidity != null) bits.push(`humedad ${Math.round(a.humidity)}%`);
          if (a.wind_speed != null) bits.push(`viento ${Math.round(a.wind_speed)} ${a.wind_speed_unit || 'km/h'}`);
          return `<div class="v-card v-wx" ${c.tap ? 'data-btap="1"' : 'data-scr="clima"'}>${t}<div class="v-row"><span class="v-wxi">${ic(WX[w.state] || (isNight() ? 'moon' : 'sun'))}</span>
            <span class="v-tx"><b class="v-big">${esc(Math.round(Number(a.temperature)))}°</b><span>${esc(bits.join(' · '))}</span></span><span class="v-chev">${ic('chev')}</span></div></div>`;
        }
        case 'climate': {
          const S = (hass() || {}).states || {};
          const id = c.entity && st(c.entity) ? c.entity : Object.keys(S).find((x) => x.startsWith('climate.'));
          if (!id) return editing() ? `${t}<p class="v-empty">Elegí el aire en las propiedades.</p>` : '';
          const s = st(id), a = s.attributes, on = s.state !== 'off';
          if (c.style === 'big') {
            // termostato grande: el anillo marca la temperatura elegida entre la mínima y la máxima del aire
            const lo = Number(a.min_temp != null ? a.min_temp : 16), hi = Number(a.max_temp != null ? a.max_temp : 30), tg = Number(a.temperature);
            const pct = Number.isFinite(tg) && hi > lo ? Math.max(0, Math.min(1, (tg - lo) / (hi - lo))) : 0;
            return `<div class="v-card v-clim v-dial ${on ? 'on' : ''} m-${esc(s.state)}">${t}<div class="v-dring"><svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="50" class="d0" pathLength="100"/><circle cx="60" cy="60" r="50" class="d1" pathLength="100" style="stroke-dasharray:${(pct * 75).toFixed(1)} 100"/></svg>
              <div class="v-dmid" data-more="${esc(id)}"><small>${esc(on ? MODE_TXT[s.state] || s.state : 'Apagado')}</small><b>${Number.isFinite(tg) ? dec(tg) : '—'}<i>°</i></b><span>${a.current_temperature != null ? `Adentro ${dec(a.current_temperature)}°` : esc(fname(id))}</span></div></div>
              <div class="v-dbar"><button class="v-cb" data-ctemp="${esc(id)}" data-d="-1" aria-label="Bajar">−</button><button class="v-pw ${on ? 'on' : ''}" data-ent="${esc(id)}" aria-label="Prender o apagar"></button><button class="v-cb" data-ctemp="${esc(id)}" data-d="1" aria-label="Subir">+</button></div>
              ${(a.hvac_modes || []).filter((x) => x !== 'off').length > 1 ? `<div class="v-modes">${(a.hvac_modes || []).filter((x) => x !== 'off').slice(0, 4).map((mo) => `<button class="${s.state === mo ? 'on' : ''}" data-hvac="${esc(mo)}" data-eid="${esc(id)}">${ic({ cool: 'snow', heat: 'sun', fan_only: 'fan', dry: 'water', heat_cool: 'temp', auto: 'temp' }[mo] || 'temp')}<span>${esc(MODE_TXT[mo] || mo)}</span></button>`).join('')}</div>` : ''}</div>`;
          }
          return `<div class="v-card v-clim ${on ? 'on' : ''}">${t}<div class="v-row"><span class="v-bic">${ic('snow')}</span><span class="v-tx" data-more="${esc(id)}"><b>${esc(fname(id))}</b>
            <span>${esc(on ? MODE_TXT[s.state] || s.state : 'Apagado')}${a.current_temperature != null ? ` · adentro ${dec(a.current_temperature)}°` : ''}</span></span><button class="v-pw ${on ? 'on' : ''}" data-ent="${esc(id)}" aria-label="Prender o apagar"></button></div>
            <div class="v-cset"><button class="v-cb" data-ctemp="${esc(id)}" data-d="-1" aria-label="Bajar">−</button><b>${a.temperature != null ? `${dec(a.temperature)}°` : '—'}</b><button class="v-cb" data-ctemp="${esc(id)}" data-d="1" aria-label="Subir">+</button></div></div>`;
        }
        case 'openings': {
          // puertas, ventanas y portones: los elegidos, o todos los sensores de apertura de la casa
          const S = (hass() || {}).states || {};
          const isOpening = (id) => { const s = S[id]; if (!s) return false; const dc = s.attributes.device_class;
            return (id.startsWith('binary_sensor.') && ['door', 'window', 'garage_door', 'opening'].includes(dc)) || (id.startsWith('cover.') && ['garage', 'gate', 'door'].includes(dc)); };
          const ids = (c.entities && c.entities.length ? c.entities.filter((id) => S[id]) : Object.keys(S).filter(isOpening)).slice(0, 40);
          X.shown[b.id] = ids.map((id) => ({ entity: id, name: nameIn(c, id) }));
          const open = ids.filter((id) => ['on', 'open', 'opening'].includes(S[id].state));
          if (!ids.length) return editing() ? `${t}<p class="v-empty">La casa no tiene sensores de puertas o ventanas.</p>` : '';
          const since = (id) => { const ms = Date.now() - new Date(S[id].last_changed).getTime(), mn = Math.round(ms / 60000); return mn < 1 ? 'recién' : mn < 60 ? `hace ${mn} min` : mn < 1440 ? `hace ${Math.round(mn / 60)} h` : `hace ${Math.round(mn / 1440)} días`; };
          const shown = c.style === 'list' ? ids : open;
          return `<div class="v-card v-open ${open.length ? 'warn' : 'ok'}">${t}<div class="v-row" data-scr="aberturas"><span class="v-bic">${ic('door')}</span><span class="v-tx"><b>${open.length ? `${open.length} abierta${open.length > 1 ? 's' : ''}` : 'Todo cerrado'}</b><span>${ids.length} puerta${ids.length > 1 ? 's' : ''} y ventana${ids.length > 1 ? 's' : ''}</span></span><span class="v-chev">${ic('chev')}</span></div>
            ${shown.length ? `<div class="v-list2">${shown.map((id, i) => { const o = ['on', 'open', 'opening'].includes(S[id].state);
              return `<div class="v-orow ${o ? 'o' : ''}" data-more="${esc(id)}"${EL(i)}><i></i><span class="v-tx"><b>${esc(nameIn(c, id) || fname(id))}</b><span>${o ? 'Abierta' : 'Cerrada'} · ${esc(since(id))}</span></span></div>`; }).join('')}</div>` : ''}</div>`;
        }
        case 'agenda': {
          // lo próximo de cada calendario (el estado del calendario trae su próximo evento); tocar abre la Agenda
          const S = (hass() || {}).states || {};
          const cals = (c.entities && c.entities.length ? c.entities : Object.keys(S).filter((x) => x.startsWith('calendar.'))).filter((id) => S[id]);
          if (!cals.length) return editing() ? `${t}<p class="v-empty">La casa no tiene calendarios.</p>` : '';
          const day0 = new Date(); day0.setHours(0, 0, 0, 0);
          const evs = cals.map((id) => ({ id, a: S[id].attributes })).filter((x) => x.a.message && x.a.start_time)
            .map((x) => ({ id: x.id, msg: x.a.message, start: new Date(String(x.a.start_time).replace(' ', 'T')), allDay: !!x.a.all_day, now: S[x.id].state === 'on' }))
            .filter((x) => !Number.isNaN(x.start.getTime()) && x.start - day0 < 2 * 864e5).sort((p, q) => p.start - q.start).slice(0, 6);
          const when = (x) => { const tom = x.start - day0 >= 864e5; const h = x.allDay ? 'Todo el día' : x.start.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false }); return x.now ? `Ahora · ${h}` : `${tom ? 'Mañana · ' : ''}${h}`; };
          return `<div class="v-card v-agd" data-scr="agenda">${t || `<h3>${esc(b.title || 'Hoy')}</h3>`}${evs.length ? `<div class="v-list2">${evs.map((x) => `<div class="v-arow ${x.now ? 'now' : ''}"><span class="v-bic">${ic('cal')}</span><span class="v-tx"><b>${esc(x.msg)}</b><span>${esc(when(x))}</span></span></div>`).join('')}</div>` : '<p class="v-empty">Nada para hoy ni mañana.</p>'}</div>`;
        }
        case 'irrigation': {
          // riego: los programas de MatterAI (riego por zonas) y las válvulas o interruptores de riego
          const S = (hass() || {}).states || {};
          const auto = Object.keys(S).filter((id) => { const a = S[id].attributes || {}; return (a.matterai_role === 'routine' && a.kind === 'irrigation') || id.startsWith('valve.') || (/^switch\./.test(id) && /riego|aspersor|valvula|válvula|irrig|sprinkl/i.test(id + ' ' + (a.friendly_name || '')) && !a.matterai_role); });
          const ids = (c.entities && c.entities.length ? c.entities : auto).filter((id) => S[id]).slice(0, 16);
          X.shown[b.id] = ids.map((id) => ({ entity: id, name: nameIn(c, id) }));
          if (!ids.length) return editing() ? `${t}<p class="v-empty">La casa no tiene riego (válvulas, interruptores de riego o programas de MatterAI).</p>` : '';
          const on = (id) => ['on', 'open', 'opening'].includes(S[id].state);
          const n = ids.filter((id) => on(id) && !(S[id].attributes || {}).matterai_role).length;
          return `<div class="v-card v-irr">${t || `<h3>${esc(b.title || 'Riego')}</h3>`}<p class="v-isub">${ic('water')}${n ? `Regando ${n} zona${n > 1 ? 's' : ''}` : 'Sin regar ahora'}</p><div class="v-list2">${ids.map((id, i) => { const prog = (S[id].attributes || {}).matterai_role === 'routine';
            return `<div class="v-rti"${EL(i)}><span class="v-tx" data-more="${esc(id)}"><b>${esc(nameIn(c, id) || fname(id))}</b><span>${prog ? (on(id) ? 'Programa activo' : 'Programa pausado') : on(id) ? 'Regando' : 'Cerrada'}</span></span><button class="v-pw ${on(id) ? 'on' : ''}" ${prog ? `data-auto="${esc(id)}"` : `data-ent="${esc(id)}"`} aria-label="Prender o apagar"></button></div>`; }).join('')}</div></div>`;
        }
        case 'batteries': {
          // pilas: los sensores de batería por debajo del límite (25 % si no se elige otro)
          const S = (hass() || {}).states || {}, lim = c.max != null ? Number(c.max) : 25;
          const all = Object.keys(S).filter((id) => { const a = S[id].attributes || {}; return a.device_class === 'battery' && (id.startsWith('sensor.') || id.startsWith('binary_sensor.')); });
          const lvl = (id) => (id.startsWith('binary_sensor.') ? (S[id].state === 'on' ? 0 : 100) : Number(S[id].state));
          const low = all.filter((id) => Number.isFinite(lvl(id)) && lvl(id) <= lim).sort((p, q) => lvl(p) - lvl(q));
          if (!all.length) return editing() ? `${t}<p class="v-empty">La casa no tiene sensores con batería.</p>` : '';
          const nm = (id) => fname(id).replace(/\s*(bater[ií]a|battery|pila)s?\s*$/i, '') || fname(id);
          return `<div class="v-card v-bat ${low.length ? 'warn' : 'ok'}">${t}<div class="v-row"><span class="v-bic">${ic(low.length ? 'alert' : 'battery')}</span><span class="v-tx"><b>${low.length ? `${low.length} pila${low.length > 1 ? 's' : ''} para cambiar` : 'Todas las pilas bien'}</b><span>${all.length} equipo${all.length > 1 ? 's' : ''} con pila</span></span></div>
            ${low.length ? `<div class="v-list2">${low.slice(0, 12).map((id) => `<div class="v-orow o" data-more="${esc(id)}"><i></i><span class="v-tx"><b>${esc(nm(id))}</b><span>${id.startsWith('binary_sensor.') ? 'Pila baja' : `${Math.round(lvl(id))} %`}</span></span></div>`).join('')}</div>` : ''}</div>`;
        }
        case 'covers': {
          const ids = entsOf(c, m, 'cover', 'covers').filter((id) => (c.entities && c.entities.length) || !['gate', 'garage', 'door'].includes((st(id) || { attributes: {} }).attributes.device_class));
          X.shown[b.id] = ids.map((id) => ({ entity: id, name: nameIn(c, id) }));
          if (!ids.length) return editing() ? `${t}<p class="v-empty">Esta tarjeta no tiene cortinas todavía.</p>${elAdd('Agregar una cortina')}` : '';
          return `<div class="v-card">${t}<div class="v-list2">${ids.map((id, i) => {
            const s = st(id), p = s.attributes.current_position, mv = ['opening', 'closing'].includes(s.state);
            return `<div class="v-cov"${EL(i)}><span class="v-tx" data-more="${esc(id)}"><b>${esc(nameIn(c, id) || fname(id))}</b><span>${esc(mv ? (s.state === 'opening' ? 'Subiendo…' : 'Bajando…') : s.state === 'open' ? (p != null && p < 100 ? `Abierta ${p}%` : 'Abierta') : s.state === 'closed' ? 'Cerrada' : s.state)}</span>
              ${p != null ? `<i class="v-pos"><i style="width:${Math.max(0, Math.min(100, p))}%"></i></i>` : ''}</span>
              <button class="v-cb" data-cov="open_cover" data-id="${esc(id)}" aria-label="Subir">${ic('up')}</button><button class="v-cb" data-cov="stop_cover" data-id="${esc(id)}" aria-label="Parar">${ic('pause')}</button><button class="v-cb" data-cov="close_cover" data-id="${esc(id)}" aria-label="Bajar">${ic('down')}</button></div>`;
          }).join('')}</div>${elAdd('Agregar una cortina')}</div>`;
        }
        case 'lights': {
          const ids = entsOf(c, m, 'light', 'lightsCtl');
          X.shown[b.id] = ids.map((id) => ({ entity: id, name: nameIn(c, id) }));
          if (!ids.length) return editing() ? `${t}<p class="v-empty">Esta tarjeta no tiene luces todavía.</p>${elAdd('Agregar una luz')}` : '';
          return `<div class="v-card">${t}<div class="v-list2">${ids.map((id, i) => {
            const s = st(id), on = s.state === 'on', a = s.attributes, dim = id.startsWith('light.') && (a.brightness != null || (a.supported_color_modes || []).some((x) => x !== 'onoff'));
            const pct = on && a.brightness != null ? Math.max(1, Math.round((a.brightness / 255) * 100)) : 0;
            return `<div class="v-lt ${on ? 'on' : ''}"${EL(i)}><div class="v-row"><span class="v-bic">${ic('bulb')}</span><span class="v-tx" data-more="${esc(id)}"><b>${esc(nameIn(c, id) || fname(id))}</b><span>${on ? (pct ? `${pct}%` : 'Prendida') : 'Apagada'}</span></span>
              <button class="v-pw ${on ? 'on' : ''}" data-ent="${esc(id)}" aria-label="Prender o apagar"></button></div>
              ${dim ? `<input class="v-bri" type="range" min="1" max="100" value="${pct || 50}" data-bri="${esc(id)}" aria-label="Brillo de ${esc(fname(id))}">` : ''}</div>`;
          }).join('')}</div>${elAdd('Agregar una luz')}</div>`;
        }
        case 'energy': {
          const id = c.entity && st(c.entity) ? c.entity : m.power && m.power.entity_id;
          if (!id) return editing() ? `${t}<p class="v-empty">Elegí el sensor de consumo en las propiedades.</p>` : '';
          const s = st(id), pts = hist(id);
          return `<div class="v-card v-en" data-more="${esc(id)}">${t}<div class="v-row"><span class="v-bic">${ic('bolt')}</span><span class="v-tx"><b class="v-big">${esc(s.state)}<small> ${esc(s.attributes.unit_of_measurement || '')}</small></b><span>${esc(fname(id))} · últimas 24 h</span></span></div>${spark(pts)}</div>`;
        }
        case 'sensor': {
          const id = c.entity && st(c.entity) ? c.entity : null;
          if (!id) return editing() ? `${t}<p class="v-empty">Elegí el sensor en las propiedades.</p>` : '';
          const s = st(id), v = Number(s.state), lo = c.min != null ? Number(c.min) : 0, hi = c.max != null ? Number(c.max) : (s.attributes.unit_of_measurement === '%' ? 100 : Math.max(100, Number.isFinite(v) ? v : 0));
          const pct = Number.isFinite(v) && hi > lo ? Math.max(0, Math.min(1, (v - lo) / (hi - lo))) : 0;
          return `<div class="v-card v-gauge" data-more="${esc(id)}">${t}<svg viewBox="0 0 100 56" aria-hidden="true"><path d="M8 50a42 42 0 0 1 84 0" class="g0"/><path d="M8 50a42 42 0 0 1 84 0" class="g1" style="stroke-dasharray:${(pct * 131.95).toFixed(1)} 200"/></svg>
            <b>${esc(Number.isFinite(v) ? dec(v) : s.state)}<small> ${esc(s.attributes.unit_of_measurement || '')}</small></b><span>${esc(fname(id))}</span></div>`;
        }
        case 'people': {
          const P = (m.people || []).map((p) => st(p.entity_id) || p);
          if (!P.length) return editing() ? `${t}<p class="v-empty">La casa no tiene personas configuradas.</p>` : '';
          return `<div class="v-card">${t}<div class="v-ppl">${P.map((p) => { const home = p.state === 'home', pic = p.attributes.entity_picture;
            return `<div class="v-pp ${home ? 'home' : ''}"><span class="v-av" ${pic ? `style="background-image:url('${esc(url(pic))}')"` : ''}>${pic ? '' : esc(String(p.attributes.friendly_name || '?').charAt(0))}</span><b>${esc(String(p.attributes.friendly_name || p.entity_id).split(' ')[0])}</b><span>${home ? 'En casa' : p.state === 'not_home' ? 'Afuera' : esc(p.state)}</span></div>`; }).join('')}</div></div>`;
        }
        case 'text': {
          if (c.style === 'separator' || !c.text) return `<div class="v-sep"><span>${esc(b.title || '')}</span></div>`;
          return `<div class="v-card v-text">${b.title ? `<b>${esc(b.title)}</b>` : ''}<p>${esc(c.text).replace(/\n/g, '<br>')}</p></div>`;
        }
        case 'activity': {
          // la Actividad completa (filtros por día, tipo, ambiente y buscador de equipos); tocar un evento muestra el historial de ese equipo
          const rm = c.rooms && c.rooms[0] ? roomByName(m, c.rooms[0]) : null;
          return `<div class="v-card v-actc" data-actv="${esc(rm ? rm.id : '')}">${t}<div class="v-row"><span class="v-bic">${ic('list')}</span><span class="v-tx"><b>${esc(rm ? `Actividad · ${rm.name}` : 'Actividad de la casa')}</b>
            <span>Qué pasó y quién lo hizo · por equipo, día y tipo</span></span><span class="v-chev">${ic('chev')}</span></div></div>`;
        }
        case 'image': {
          const src = img(c.image);
          if (!c.image) return editing() ? `${t}<p class="v-empty">Subí o elegí la imagen en las propiedades.</p>` : '';
          return `<div class="v-imgc" ${c.tap && c.tap.type !== 'none' ? 'data-btap="1"' : ''}>${src ? `<img src="${esc(src)}" alt="${esc(b.title || '')}">` : ''}${b.title ? `<span>${esc(b.title)}</span>` : ''}</div>`;
        }
        default: return editing() ? `<p class="v-empty">Tarjeta «${esc(b.type)}» (la app todavía no la conoce)</p>` : '';
      }
    }

    /* ───────── plano: imagen apagada + prendida por ambiente, según las luces ───────── */
    /** Cartel de cada ambiente del plano: la luz siempre (prendida o apagada) y, si están andando, el aire, la música,
     *  el ventilador, las cortinas abiertas, la cerradura abierta y las aberturas abiertas (como en la demo). */
    function pinIcons(z, n, m) {
      const ico = (name, cls, title) => ic(name).replace('class="i"', `class="i ${cls}"`).replace('<svg ', `<svg aria-label="${title}" `);
      let h = ico('bulb', n ? 'on' : '', n ? 'Luz prendida' : 'Luz apagada');
      const r = roomByName(m, z.room || z.name); if (!r) return h;
      const S = (hass() || {}).states || {};
      if ((r.climOn || []).length) h += ico('snow', 'ac', 'Aire prendido');
      if ((r.mediaOn || []).length) h += ico('music', 'mu', 'Música sonando');
      if ((r.fansOn || []).length) h += ico('fan', 'ac', 'Ventilador prendido');
      if ((r.covers || []).some((id) => { const s = st(id); return s && s.state === 'open' && !['gate', 'garage', 'door'].includes(s.attributes.device_class); })) h += ico('curt', 'ac', 'Cortina abierta');
      if ((r.locks || []).some((id) => (st(id) || {}).state === 'unlocked')) h += ico('unlock', 'al', 'Cerradura abierta');
      if ((r.openNow || []).length) h += ico('door', 'al', 'Abertura abierta');
      void S;
      return h;
    }
    function planHTML(m, zoom) {
      const p = X.layout.plan, sz = ['s', 'm', 'xl'].includes(zoom) ? ` sz-${zoom}` : '';
      if (!p || !p.image) return editing() ? '<div class="v-plan empty"><p>Subí el render de la casa en «Plano» para verlo acá.</p></div>' : '';
      const off = img(p.image), on = img(p.image_on || p.image), day = p.image_day ? img(p.image_day) : '';
      const isDay = day && !isNight();
      const zones = p.zones || [];
      const pts = (poly) => poly.map(([x, y]) => `${(x * 1000).toFixed(1)},${(y * 1000).toFixed(1)}`).join(' ');
      const ar = p.aspect || X.aspect || 0.6;
      X.zonePolys = zones;
      const zoneOn = (z) => (z.lights || []).filter((id) => (st(id) || {}).state === 'on').length;
      const cen = (z) => { const P = z.pin || [z.poly.reduce((a, q) => a + q[0], 0) / z.poly.length, z.poly.reduce((a, q) => a + q[1], 0) / z.poly.length]; return P; };
      return `<div class="v-plan${sz}" style="aspect-ratio:${ar}"><svg viewBox="0 0 1000 ${(1000 / ar).toFixed(0)}" preserveAspectRatio="none">
        <defs>${zones.map((z, i) => `<mask id="vz${i}" maskUnits="userSpaceOnUse"><polygon points="${pts(z.poly.map(([x, y]) => [x, y / ar]))}" fill="#fff"/></mask>`).join('')}</defs>
        <image href="${esc(isDay ? day : off)}" x="0" y="0" width="1000" height="${(1000 / ar).toFixed(0)}" preserveAspectRatio="none" data-planimg="1"/>
        ${zones.map((z, i) => { const n = zoneOn(z); return n ? `<image href="${esc(on)}" x="0" y="0" width="1000" height="${(1000 / ar).toFixed(0)}" preserveAspectRatio="none" mask="url(#vz${i})" opacity="0.95"/>` : ''; }).join('')}
        ${zones.map((z, i) => `<polygon class="v-hit${editing() && ctx.edit.pz === i && ctx.edit.selected === X.curB ? ' zsel' : ''}" data-zone="${i}" points="${pts(z.poly.map(([x, y]) => [x, y / ar]))}"/>`).join('')}
        </svg>${zones.map((z, i) => { const [x, y] = cen(z), n = zoneOn(z); return `<span class="v-pin ${n ? 'on' : ''}" style="left:${(x * 100).toFixed(2)}%;top:${(y * 100).toFixed(2)}%" data-zone="${i}" data-zpin="1"${z.pin ? ' data-man="1"' : ''}>${pinIcons(z, n, m)}<b>${esc(z.name)}</b></span>`; }).join('')}
        ${editing() ? '' : '<span class="v-ptag">Tocá un ambiente para prender o apagar · tocá su nombre para ver todo</span>'}</div>${elAdd('Dibujar un ambiente en el plano')}`;
    }

    /* ───────── avisos de la casa (campanita) ───────── */
    function notes(m) {
      const c = card(), out = [];
      if (m.alarm && m.alarm.state === 'triggered') out.push({ key: 'alarm-trig', lvl: 'r', ic: 'alert', t: 'Se disparó la alarma', d: fname(m.alarm.entity_id), a: 'Ver', run: () => c.openPanel('open') });
      (c.suggestions ? c.suggestions() : []).forEach((s) => out.push({ key: 'sug:' + s.key, lvl: 'w', ic: s.icon === 'shield' ? 'shield' : 'bulb', t: s.title, d: s.text, a: s.btn, sug: s.key }));
      m.openAcc.forEach((id) => out.push({ key: `open-${id}-${(st(id) || {}).last_changed}`, lvl: 'w', ic: 'gate', t: `${fname(id)} abierto`, d: 'Tocá para cerrarlo', a: 'Cerrar', run: () => c.access(id) }));
      const S = (hass() || {}).states || {};
      Object.keys(S).forEach((id) => {
        const s = S[id];
        if (id.startsWith('sensor.') && s.attributes.device_class === 'battery') {
          const v = Number(s.state);
          if (Number.isFinite(v) && v <= 15) out.push({ key: `bat-${id}-${Math.round(v / 5)}`, lvl: '', ic: 'battery', t: `Pila baja: ${String(s.attributes.friendly_name || id).replace(/\s*(bater[ií]a|battery)\s*/i, ' ').trim()}`, d: `${Math.round(v)}%`, a: null });
        }
      });
      return out.filter((n) => !X.dismissed.has(n.key));
    }
    function dismiss(n) { if (n.sug) card().dismissSuggestion(n.sug); X.dismissed.add(n.key); save('matterai.vista.dismissed', [...X.dismissed].slice(-200)); }

    /* ───────── dibujo ───────── */
    function set(sel, html) { if (X.cache[sel] === html) return; X.cache[sel] = html; const e = X.el.querySelector(sel); if (e) e.innerHTML = html; }
    function head(m, compact) {
      const d = new Date(), w = m.weather, ns = notes(m).length, H = (X.layout && X.layout.header) || {};
      const on = (k) => H[k] !== false;
      return `${on('clock') ? '' : '<span class="v-hsp"></span>'}${on('clock') ? `<button class="v-when" data-scr="agenda"><b>${esc(d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false }))}</b><span>${esc(d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }))}</span></button>` : ''}
        ${w && on('weather') ? `<button class="v-chip" data-scr="clima">${ic(WX[w.state] || (isNight() ? 'moon' : 'sun'))}${esc(Math.round(Number(w.attributes.temperature)))}°${compact ? '' : `<small>${esc(w.state === 'sunny' || w.state === 'clear-night' ? 'Despejado' : w.state === 'rainy' || w.state === 'pouring' ? 'Lluvia' : 'Nublado')}</small>`}</button>` : ''}
        ${on('bell') ? `<button class="v-sq" data-scr="avisos" aria-label="Avisos">${ic('bell')}${ns ? `<span class="v-badge">${ns > 9 ? '9+' : ns}</span>` : ''}</button>` : ''}
        ${on('menu') ? `<button class="v-sq" data-scr="menu" aria-label="Menú">${ic('menu')}</button>` : ''}`;
    }
    /** La barra de abajo: la del diseño (o la de siempre), sólo con lo que la casa tiene. */
    function dockHTML(m, p) {
      const L = (X.layout && X.layout.dock && X.layout.dock.length ? X.layout.dock : DOCK_DEF[kind()]);
      const has = { camaras: m.f.cameras, musica: m.f.music, agenda: m.f.agenda, voice: voiceOn(), clima: !!m.weather };
      // en el editor cada botón se arrastra para ordenarlos (data-dkk)
      return L.filter((k, i, a) => DOCK[k] && has[k] !== false && a.indexOf(k) === i).map((k, j) => {
        const [i, t2] = DOCK[k], dk = editing() ? ` data-dkk="${k}"` : '';
        if (k === 'voice') return `<button class="v-mic" data-scr="voice"${dk} aria-label="Hablar">${ic('mic')}</button>`;
        if (k === 'musica') return `<button data-k="music"${dk}>${p && X.hidePlayer && p.state === 'playing' ? '<span class="v-eq"><i></i><i></i><i></i></span>' : ''}${ic(i)}${t2}</button>`;
        return `<button class="${j === 0 && k === 'top' ? 'on' : ''}" data-scr="${k}"${dk}>${ic(i)}${t2}</button>`;
      }).join('');
    }
    function wrapBlock(b, m) {
      const shown = visible(b, m);
      if (!shown && !editing()) return '';
      X.curB = b.id;
      const inner = block(b, m);
      if (!inner && !editing()) return '';
      const sel = editing() && ctx.edit.selected === b.id;
      const sp = spanOf(b), cls = ` sp-${sp}${b.fill ? ' fill' : ''}${!shown ? ' hid' : ''}${(b.show || []).length ? ' cond' : ''}`;
      // en el editor, como Lovelace: la tarjeta entera se arrastra; ✎ la edita (o tocarla) y ⋮ tiene duplicar, copiar y borrar
      const tool = `<span class="v-ecard"><button data-eact="edit" title="Editar" aria-label="Editar">${ic('edit')}</button><button data-eact="menu" title="Más opciones" aria-label="Más opciones">${ic('dots')}</button></span>`;
      const tag = `${esc((CATALOG[b.type] || {}).name || b.type)}${(b.show || []).length ? (shown ? ' · condicional' : ' · oculta ahora') : ''}`;
      return `<section class="v-b t-${b.type}${cls}${sel ? ' sel' : ''}" data-block="${esc(b.id)}">${editing() ? `<span class="v-btag">${tag}</span>${tool}` : ''}${inner}</section>`;
    }
    /** Ancho de una tarjeta en cuartos de su columna (4 = completa). */
    function spanOf(b) { const n = +b.span || (b.size === 'half' ? 2 : 4); return Math.max(1, Math.min(4, n)); }
    /** Una columna en partes: cada tarjeta completa es una parte; las más angostas se juntan en filas de hasta 4 cuartos. */
    function colParts(list, m) {
      const out = []; let buf = [], used = 0;
      const flush = () => { if (buf.length) { out.push({ key: `r:${buf.map((x) => x.id).join(',')}`, html: `<div class="v-row4">${buf.map((x) => x.h).join('')}</div>` }); buf = []; used = 0; } };
      list.forEach((b) => {
        const h = wrapBlock(b, m); if (!h) return;
        const sp = spanOf(b);
        if (sp >= 4) { flush(); out.push({ key: b.id, html: h }); return; }
        if (used + sp > 4) flush();
        buf.push({ id: b.id, h }); used += sp;
        if (used >= 4) flush();
      });
      flush();
      return out;
    }
    function colHTML(list, m) { return colParts(list, m).map((x) => x.html).join(''); }
    /** Dibuja una columna cambiando sólo las tarjetas que cambiaron (una luz que se prende no corta el video de la cámara). */
    function setCol(sel, list, m, tail) {
      const parts = colParts(list, m), html = parts.map((x) => x.html).join('') + (tail || '');
      const e = X.el.querySelector(sel);
      if (!e || X.cache[sel] === html) return;
      const sig = `${parts.map((x) => x.key).join('|')}#${tail || ''}`;
      const real = e.children && typeof document !== 'undefined' && document.createElement;
      if (real && X.colSig[sel] === sig && e.children.length === parts.length + (tail ? 1 : 0)) {
        parts.forEach((x, i) => {
          const k = `${sel}|${x.key}`;
          if (X.partCache[k] === x.html) return;
          const tpl = document.createElement('template'); tpl.innerHTML = x.html;
          const nu = tpl.content.firstElementChild; if (nu && !keepLive(e.children[i], nu)) e.children[i].replaceWith(nu);
        });
      } else e.innerHTML = html;
      X.cache[sel] = html; X.colSig[sel] = sig;
      parts.forEach((x) => { X.partCache[`${sel}|${x.key}`] = x.html; });
    }
    /** Actualiza una tarjeta sin tocar el visor en vivo que tiene adentro (si es la misma cámara). Devuelve false si no se pudo
     *  (entonces se reemplaza entera, como siempre). */
    function keepLive(old, nu) {
      const os = old.querySelector && old.querySelector('[data-live]'), ns = nu.querySelector && nu.querySelector('[data-live]');
      if (!os || !ns || os.dataset.key !== ns.dataset.key || os.dataset.live !== ns.dataset.live) return false;
      const swap = (o, n) => {
        if (o === os) return;
        if (!o.contains(os)) { o.replaceWith(n); return; }
        [...o.attributes].forEach((a) => { if (!n.hasAttribute(a.name)) o.removeAttribute(a.name); });
        [...n.attributes].forEach((a) => { if (o.getAttribute(a.name) !== a.value) o.setAttribute(a.name, a.value); });
        const oc = [...o.children], nc = [...n.children];
        if (oc.length !== nc.length) throw new Error('distinto');
        oc.forEach((c2, k) => swap(c2, nc[k]));
      };
      try { swap(old, nu); return true; } catch (_) { return false; }
    }
    /** ¿Se puede mostrar video en vivo? (la tarjeta MatterAI sabe armar el visor de Frigate) */
    // en vivo también en iPhone / iPad: la app le saca al visor el modo MJPEG (el que llenaba la memoria y hacía que iOS
    // cerrara la página) y usa WebRTC o MSE. Mientras carga el visor, o si no está, fotos seguidas.
    function liveOk() { const c = card(); return !X.liveFail && !!(c && typeof c.liveCam === 'function'); }
    /** Pone el visor en vivo de cada cámara en su lugar; es siempre el mismo (no se vuelve a conectar si no cambió la cámara). */
    function mountLive() {
      if (!X.el.querySelectorAll || editing()) return;
      const seen = new Set();
      X.el.querySelectorAll('[data-live]').forEach((slot) => {
        const id = slot.dataset.live, key = slot.dataset.key; seen.add(id);
        let L = X.live[id];
        if (!L || L.key !== key) {
          const elx = card().liveCam([key].concat((X.camList[id] || []).filter((x) => x !== key)));
          if (!elx) { waitLive(); return; }
          L = X.live[id] = { el: elx, key };
        }
        L.el.hass = hass();
        if (L.el.parentNode !== slot) { slot.innerHTML = ''; slot.appendChild(L.el); }
      });
      Object.keys(X.live).forEach((id) => { if (!seen.has(id)) delete X.live[id]; });
    }
    function waitLive() {
      if (X.liveWait || typeof customElements === 'undefined') return;
      X.liveWait = true;
      const t = setTimeout(() => { if (!customElements.get('advanced-camera-card')) { X.liveFail = true; X.cache = {}; X.partCache = {}; render(); } }, 20000);
      customElements.whenDefined('advanced-camera-card').then(() => { clearTimeout(t); X.liveWait = false; X.liveFail = false; X.cache = {}; X.partCache = {}; render(); });
    }
    /** En el editor: al final de cada columna, «+ Agregar tarjeta» (como en Home Assistant). */
    const addSlot = (col, zone) => (editing() && ctx.edit.onAdd ? `<button class="v-eadd" data-eadd="${col}"${zone ? ` data-ezone="${zone}"` : ''}>+ Agregar tarjeta</button>` : '');
    function render() {
      // mientras se arrastra un brillo no se redibuja (si no, se suelta solo). Si el «soltar» se perdió (la ventana se
      // cerró con el dedo apoyado), a los 3 s se destraba: si no, la pantalla quedaba congelada hasta cerrar la app
      if (X.sliding && Date.now() - (X.slideAt || 0) > 3000) X.sliding = false;
      if (!X.el || X.el.hidden || X.sliding || X.dnd) return;
      const m0 = M();
      if (!m0) { if (X.el.innerHTML === '') X.el.innerHTML = '<p class="v-empty">Conectando con tu casa…</p>'; return; }
      const m = buildSim(m0);
      const L = X.layout = layout(m), K = kind(), ori = ctx.orientation || L.orientation || 'landscape';
      // en el editor manda lo que se está diseñando; en la tablet de verdad, cómo está parada (o «vertical» si se fijó así)
      const vertical = K === 'tablet' && (editing() ? ori === 'portrait'
        : ori === 'portrait' || (typeof innerHeight !== 'undefined' && innerHeight > innerWidth));
      // el cliente puede elegir en Opciones (oscuro, claro o como el equipo); si no, el del instalador
      let mine = null; try { mine = !editing() && typeof localStorage !== 'undefined' ? localStorage.getItem('matterai.theme') : null; } catch (_) { mine = null; }
      const th = mine || L.theme || 'dark';
      const light = th === 'light' || (th === 'auto' && typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: light)').matches);
      if (typeof document !== 'undefined' && document.documentElement && document.documentElement.classList) document.documentElement.classList.toggle('mae-light', light);
      // estilo prearmado (MatterAI, tipo Apple, cristal) y fondo propio del diseño
      const st = STYLES.includes(L.style) ? L.style : 'matterai', bgx = bgCSS(L.bg, light);
      if (ctx.embed) { // las tarjetas de adentro de un ambiente: una columna, sin hora ni barras
        const sigE = `embed|${editing()}|${light}|${st}`;
        if (X.shell !== sigE) { X.shell = sigE; X.cache = {}; X.colSig = {}; X.partCache = {}; X.el.className = `vista embed k-phone${editing() ? ' editing' : ''}${light ? ' light' : ''} st-${st}`; X.el.innerHTML = `<div class="v-col v-embed" id="v-c1" data-zone="room-${ctx.embed}"></div>`; }
        setCol('#v-c1', L.blocks || [], m, editing() ? addSlot(0, `room-${ctx.embed}`) : '');
        mountLive();
        return;
      }
      const cols = K === 'tablet' ? (Array.isArray(L.cols) && L.cols.length ? L.cols.slice(0, 4) : [0, 1, 1]) : [1];
      const side = K === 'tablet' && L.side !== false, nCol = cols.length;
      const sig = `${K}|${vertical}|${editing()}|${light}|${st}|${bgx ? 1 : 0}|${side}|${cols.join(',')}`;
      if (X.el.style && X.el.style.setProperty) { if (bgx) X.el.style.setProperty('--v-bgx', bgx); else X.el.style.removeProperty('--v-bgx'); }
      if (X.shell !== sig) {
        X.shell = sig; X.cache = {}; X.colSig = {}; X.partCache = {};
        X.el.className = `vista k-${K}${vertical ? ' vert' : ''}${editing() ? ' editing' : ''}${light ? ' light' : ''} st-${st}${bgx ? ' has-bg' : ''}${K === 'tablet' && !side ? ' noside' : ''}`;
        const w = (x) => (x ? `minmax(0,${x}fr)` : 'auto');
        const colDiv = (i) => `<div class="v-col v-c${i}" id="v-c${i}" data-col="${i}"></div>`;
        const inner = (side ? cols.slice(1).map((_, j) => colDiv(j + 1)) : cols.map((_, i) => colDiv(i))).join('');
        const tpl = (side ? cols.slice(1) : cols).map(w).join(' ');
        const sideW = side && cols[0] ? ` style="flex:0 0 ${Math.round((cols[0] / cols.reduce((a, x) => a + (x || 0), 0)) * 100)}%;max-width:none"` : '';
        X.tabletHTML = `<div class="v-tab">${side ? `<div class="v-c0 v-side" id="v-c0" data-col="0"${sideW}></div>` : ''}<div class="v-main"><header class="v-head" id="v-head"></header><div class="v-top" id="v-top" data-zone="top"></div><div class="v-cols" style="grid-template-columns:${tpl}">${inner}</div><div class="v-bot" id="v-bot" data-zone="bottom"></div><div class="v-player hide" id="v-player" data-k="player"></div><nav class="v-dock" id="v-dock"></nav></div></div>`;
        X.el.innerHTML = K === 'tablet'
          ? `${X.tabletHTML}${shared()}`
          : `<header class="v-head" id="v-head"></header><div id="v-c1"></div><button class="v-allb" data-scr="casa" id="v-allb"></button><div class="v-bottom"><div class="v-player hide" id="v-player" data-k="player"></div><nav class="v-nav" id="v-nav"></nav></div>${shared()}`;
        // si había una ventana abierta (por ejemplo el ambiente en el editor), sigue abierta después de rearmar la pantalla
        if (X.sheet) { const sh = X.el.querySelector('#v-sheet'); if (sh && sh.classList) sh.classList.add('show'); }
      }
      set('#v-head', head(m, K === 'phone'));
      const bl = L.blocks;
      if (K === 'tablet') {
        // bandas de lado a lado (arriba y abajo) y cada columna con sus tarjetas, en el orden de la lista
        const colOf = (b) => Math.max(0, Math.min(nCol - 1, +b.col || 0));
        setCol('#v-top', bl.filter((b) => b.zone === 'top'), m, editing() ? addSlot(1, 'top') : '');
        setCol('#v-bot', bl.filter((b) => b.zone === 'bottom'), m, editing() ? addSlot(1, 'bottom') : '');
        for (let i = 0; i < nCol; i++) setCol(`#v-c${i}`, bl.filter((b) => !b.zone && colOf(b) === i), m, addSlot(i));
        fit(vertical);
        const c = card();
        const p = drawPlayer();
        set('#v-dock', dockHTML(m, p));
      } else {
        setCol('#v-c1', bl, m, addSlot(0));
        set('#v-allb', `${ic('grid')}Toda la casa`);
        { const ab = X.el.querySelector('#v-allb'); if (ab && ab.classList) ab.classList.toggle('off', ((L.header || {}).casa) === false); }
        // reproductor: sólo con música; se esconde al botón Música
        const p = drawPlayer();
        set('#v-nav', dockHTML(m, p));
      }
      // editor: el ambiente que se está editando se ve por dentro en la pantalla
      if (editing() && ctx.edit.room) { if (X.sheet !== 'roomedit') openSheet('roomedit'); }
      else if (X.sheet === 'roomedit') closeSheet();
      if (X.sheet) renderSheet();
      mountLive();
      editMarks();
      spreadPins();
      refreshXtra();
    }
    /* ── tarjetas de adentro de los ambientes: la ventana del ambiente (de la tarjeta) le pide al motor que las dibuje ── */
    /** La página de un ambiente: lo que se está editando, la versión propia de este dashboard o la de la casa. */
    function roomPage(name) {
      const ed = editing() && ctx.edit.roomPage;
      if (ed && ed.name === name) return ed;
      const own = X.view && X.view.room_pages && X.view.room_pages[name];
      if (own) return own;
      const cfg = card() && card()._config, rc = cfg && Array.isArray(cfg.rooms) ? cfg.rooms.find((x) => x && x.name === name) : null;
      return (rc && rc.page) || {};
    }
    function adoptCss(node) {
      const rn = node && node.getRootNode ? node.getRootNode() : null;
      if (!rn || !rn.host || rn.querySelector('link[data-mae-vista]')) return;
      const lk = typeof document !== 'undefined' && document.querySelector('link[href*="vista.css"]');
      if (!lk) return;
      const c = lk.cloneNode(); c.setAttribute('data-mae-vista', '1'); rn.appendChild(c);
    }
    function mountXtra(r, top, bot) {
      closeXtra();
      if (!top || !bot || ctx.embed) return;
      adoptCss(top);
      const L = X.layout || {};
      const mk = (el0, zone) => { const inst = create(el0, Object.assign({}, ctx, { embed: zone, kind: 'phone' })); return inst; };
      X.xtra = { r, top: mk(top, 'top'), bot: mk(bot, 'bottom'), theme: L.theme, style: L.style };
      refreshXtra(true);
    }
    function refreshXtra(force) {
      const x = X.xtra; if (!x) return;
      const p = roomPage(x.r.name), L = X.layout || {};
      const sig = JSON.stringify([p.top || [], p.bottom || [], L.theme, L.style, editing(), editing() && ctx.edit.selected]);
      if (!force && x.sig === sig) return;
      x.sig = sig;
      x.top.setCtx({ edit: ctx.edit }); x.bot.setCtx({ edit: ctx.edit });
      x.top.setView({ blocks: p.top || [], theme: L.theme, style: L.style, plan: L.plan });
      x.bot.setView({ blocks: p.bottom || [], theme: L.theme, style: L.style, plan: L.plan });
    }
    function closeXtra() { const x = X.xtra; X.xtra = null; if (x) { try { x.top.destroy(); x.bot.destroy(); } catch (_) { /* ya estaban */ } } }
    if (!ctx.embed) {
      // la pantalla más nueva es la que dibuja (si la app vuelve a crear el inicio, la tarjeta habla con la nueva)
      const hook = () => { const c = card(); if (c && !X.destroyed) { c.roomExtra = (r, top, bot) => mountXtra(r, top, bot); c.roomExtraClose = () => closeXtra(); } };
      hook(); setTimeout(hook, 500);
    }
    /** Carteles del plano que se pisan (ambientes angostos o pegados): se separan solos, uno hacia arriba y otro hacia
     *  abajo. Los que el instalador ubicó a mano (arrastrándolos en el editor) quedan donde están. */
    function spreadPins() {
      if (!X.el.querySelectorAll) return;
      X.el.querySelectorAll('.v-plan').forEach((pl) => {
        const R = pl.getBoundingClientRect && pl.getBoundingClientRect(); if (!R || !R.height) return;
        const pins = [...pl.querySelectorAll('.v-pin')];
        pins.forEach((q) => { if (q.dataset.oy) q.style.top = q.dataset.oy; else q.dataset.oy = q.style.top; });
        const free = (q) => !q.dataset.man;
        for (let pass = 0; pass < 8; pass++) {
          let moved = false;
          for (let i = 0; i < pins.length; i++) {
            for (let j = i + 1; j < pins.length; j++) {
              const a = pins[i].getBoundingClientRect(), b = pins[j].getBoundingClientRect();
              if (!(a.right > b.left + 2 && b.right > a.left + 2 && a.bottom > b.top + 2 && b.bottom > a.top + 2)) continue;
              const [up, dn] = a.top <= b.top ? [pins[i], pins[j]] : [pins[j], pins[i]];
              const ov = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) + 4;
              const both = free(up) && free(dn), pct = ((both ? ov / 2 : ov) / R.height) * 100;
              if (!free(up) && !free(dn)) continue;
              if (free(up)) up.style.top = `${(parseFloat(up.style.top) - (both ? pct : pct)).toFixed(2)}%`;
              if (free(dn) && (both || !free(up))) dn.style.top = `${(parseFloat(dn.style.top) + pct).toFixed(2)}%`;
              moved = true;
            }
          }
          if (!moved) break;
        }
      });
    }
    /** Editor: marca el encabezado o la barra si están elegidos, y trae a la vista la tarjeta elegida (columnas que se desplazan). */
    function editMarks() {
      if (!X.el.querySelector) return;
      const z = editing() ? ctx.edit.zone : null;
      [['#v-head', 'header'], ['#v-nav', 'dock'], ['#v-dock', 'dock'], ['#v-allb', 'allb']].forEach(([q, k]) => { const e = X.el.querySelector(q); if (e && e.classList) e.classList.toggle('zsel', z === k); });
      const sel = editing() ? ctx.edit.selected : null;
      if (sel && sel !== X.lastSel) {
        const sec = X.el.querySelector(`[data-block="${String(sel).replace(/"/g, '')}"]`);
        if (sec && sec.scrollIntoView) sec.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
      X.lastSel = sel;
    }
    /** Editor: barrita arriba del elemento elegido (subir, bajar, sacar). */
    function placeElTool() {
      if (!X.el.querySelectorAll || typeof document === 'undefined' || !document.createElement) return;
      X.el.querySelectorAll('.v-eltool').forEach((x) => x.remove());
      if (!editing() || ctx.edit.el == null || ctx.edit.el === 'cam') return;
      const e = X.el.querySelector('[data-elsel]'); if (!e || !e.getBoundingClientRect) return;
      const sec = e.closest('[data-block]'); if (!sec) return;
      const r = e.getBoundingClientRect(), rs = sec.getBoundingClientRect();
      const tb = document.createElement('span');
      tb.className = 'v-eltool';
      tb.innerHTML = [['up', 'up', 'Subir'], ['down', 'down', 'Bajar'], ['del', 'x', 'Sacar de la tarjeta']].map(([k, i, tt]) => `<button data-elact="${k}" title="${tt}" aria-label="${tt}">${ic(i)}</button>`).join('');
      tb.style.left = `${Math.max(0, r.left - rs.left)}px`; tb.style.top = `${Math.max(-12, r.top - rs.top - 30)}px`;
      sec.appendChild(tb);
    }
    /* La tablet se arma sobre un lienzo de tamaño fijo (como el diseño) y se escala a la pantalla:
     * así se ve igual en una tablet de 8" que en una de 12", sin tarjetas apretadas ni textos cortados. */
    function fit(vertical) {
      const e = X.el; if (!e || !e.style) return;
      if (editing() || typeof innerWidth === 'undefined') { e.style.width = e.style.height = e.style.zoom = ''; return; }
      const iw = innerWidth, ih = innerHeight, W = Math.max(iw, vertical ? 800 : 1180), s = iw / W;
      // zoom (y no transform) para que el alto, el scroll vertical y las ventanas fijas sigan andando bien
      e.style.zoom = s < 1 ? String(s) : ''; e.style.width = s < 1 ? W + 'px' : '';
      e.style.height = Math.round(ih / s) + 'px';
    }
    /** Micrófono a la vista siempre (como en el diseño), salvo que el instalador apague la voz. */
    function voiceOn() { const c = card(); return !!c && typeof c.voice === 'function' && !(c._config && c._config.voice === false); }
    /** La barra de música (celular y tablet): sólo con música, con su progreso; la flecha la guarda en el botón Música. */
    function drawPlayer() {
      const p = player();
      if (!p) X.hidePlayer = false;
      // la barra de música aparece siempre que haya música (en el celular y en la tablet), arriba de la barra de abajo
      const shown = !!p && !X.hidePlayer, pl = X.el.querySelector('#v-player');
      if (pl) pl.classList.toggle('hide', !shown);
      X.el.classList.toggle('with-player', shown);
      if (p) {
        const a = p.attributes, art = a.entity_picture ? `style="background-image:url('${esc(url(a.entity_picture))}')"` : '';
        let pct = 0;
        if (a.media_duration > 0 && a.media_position != null) {
          const run = p.state === 'playing' && a.media_position_updated_at ? (Date.now() - new Date(a.media_position_updated_at).getTime()) / 1000 : 0;
          pct = Math.max(0, Math.min(100, ((Number(a.media_position) + run) / Number(a.media_duration)) * 100));
        }
        const q = a.queue_size || (Array.isArray(a.queue) ? a.queue.length : 0);
        set('#v-player', `<span class="v-art" ${art}></span><span class="v-tx"><b>${esc(a.media_title || 'Música')}</b><span>${esc(a.media_artist || fname(p.entity_id))} · ${p.state === 'playing' ? 'sonando' : 'en pausa'}${q ? ` · ${q} en cola` : ''}</span></span>
          <button class="v-pl" data-mp="${esc(p.entity_id)}" aria-label="${p.state === 'playing' ? 'Pausar' : 'Reproducir'}">${ic(p.state === 'playing' ? 'pause' : 'play')}</button>${kind() === 'tablet' ? `<button class="v-mb" data-mn="${esc(p.entity_id)}" aria-label="Siguiente">${ic('next')}</button>` : ''}<button class="v-hide" data-k="hidep" aria-label="Esconder">${ic('cdown')}</button>
          ${pct ? `<span class="v-prog"><i style="width:${pct.toFixed(1)}%"></i></span>` : ''}`);
      }
      return p;
    }
    function shared() {
      return '<div class="v-sheet" id="v-sheet"><div class="v-sin"></div></div><div class="v-menu" id="v-menu"><div class="v-min"></div></div>';
    }

    /* ───────── hojas (avisos, toda la casa, alarma) y menú de fijar ───────── */
    function renderSheet() {
      const m = M(); if (!m) return;
      const sh = X.el.querySelector('#v-sheet .v-sin'); if (!sh) return;
      const hd = (t, s) => `<div class="v-grab"></div><div class="v-sh"><div><h2>${esc(t)}</h2>${s ? `<small>${esc(s)}</small>` : ''}</div><button class="v-x" data-close aria-label="Cerrar">${ic('x')}</button></div>`;
      let h = '';
      if (X.sheet === 'avisos') {
        const ns = notes(m);
        h = hd('Avisos', ns.length ? `${ns.length} de tu casa` : '') + (ns.length
          ? `<div class="v-list">${ns.map((n, i) => `<div class="v-ntf ${n.lvl}"><span class="v-nic">${ic(n.ic)}</span><span class="v-tx"><b>${esc(n.t)}</b><span>${esc(n.d || '')}</span></span>${n.a ? `<button class="v-btn1 ${n.lvl ? 'w' : ''}" data-na="${i}">${esc(n.a)}</button>` : ''}<button class="v-dx" data-nd="${i}" aria-label="Descartar">${ic('x')}</button></div>`).join('')}</div>
            <button class="v-allb" data-ndall>Descartar todos</button>`
          : `<div class="v-empty big">${ic('bell')}<p>No hay avisos. Todo en orden en tu casa.</p></div>`);
      }
      if (X.sheet === 'casa') {
        const pins = (X.roomNames || []).map((n) => (roomByName(m, n) || {}).id);
        h = hd('Toda la casa', `${m.rooms.length} ambientes`) + `<div class="v-rooms">${m.rooms.map((r) => roomRow(r, pins.includes(r.id))).join('')}</div>
          <p class="v-note">Los marcados están en tu inicio. Mantené apretado para sumar, mover o sacar.</p>`;
      }
      if (X.sheet === 'alarm') {
        const a = st(X.sheetArg) || m.alarm;
        if (a) {
          const armed = a.state.startsWith('armed') || a.state === 'triggered';
          h = hd('Alarma', fname(a.entity_id)) + `<div class="v-list">${armed ? `<button class="v-opt w" data-al="alarm_disarm">${ic('shield')}Desarmar</button>`
            : `<button class="v-opt" data-al="alarm_arm_away">${ic('car')}Armar · me voy</button><button class="v-opt" data-al="alarm_arm_home">${ic('home')}Armar · estoy en casa</button>${a.attributes.supported_features & 4 ? `<button class="v-opt" data-al="alarm_arm_night">${ic('moon')}Armar · noche</button>` : ''}`}
            <button class="v-opt ghost" data-scr="seguridad">${ic('door')}Ver sensores y aberturas</button></div>`;
        }
      }
      if (X.sheet === 'roomedit' && ctx.edit && ctx.edit.room) h = roomEditHTML(ctx.edit.room);
      if (X.sheet === 'rutinas') {
        const b = (X.layout.blocks || []).find((y) => y.id === X.sheetArg), list = b ? routineList(b.cfg || {}, 200) : [];
        const on = list.filter((x) => (st(x.entity) || {}).state === 'on').length;
        h = hd(b && b.title ? b.title : 'Rutinas', `${list.length} rutina${list.length === 1 ? '' : 's'} · ${on} activa${on === 1 ? '' : 's'}`) + `<div class="v-rt">${routineRows(list, false)}</div>
          <p class="v-note">Activá o desactivá cada rutina, o tocá «Ejecutar» para hacerla ahora.</p>`;
      }
      if (sh.innerHTML !== h) sh.innerHTML = h;
    }
    /** Editor: el ambiente por dentro, con sus equipos en orden; se ordenan, sacan y agregan acá mismo. */
    function roomEditHTML(R) {
      const L = R.entities || [];
      // como en la app: las entidades seguidas del mismo tipo forman un bloque (Cámaras, Iluminación, Equipos…)
      const KIND = { camera: ['cam', 'cam', 'Cámaras'], light: ['light', 'bulb', 'Iluminación'], climate: ['clim', 'snow', 'Climatización'], fan: ['clim', 'snow', 'Climatización'],
        cover: ['cover', 'curt', 'Cortinas y aberturas'], media_player: ['media', 'music', 'Multimedia'], switch: ['switch', 'plug', 'Equipos'], input_boolean: ['switch', 'plug', 'Equipos'],
        lock: ['lock', 'lock', 'Cerraduras'], scene: ['act', 'spark', 'Acciones'], script: ['act', 'spark', 'Acciones'], button: ['act', 'spark', 'Acciones'], input_button: ['act', 'spark', 'Acciones'] };
      const kindOf = (id) => KIND[String(id).split('.')[0]] || ['sens', 'door', 'Sensores'];
      const groups = [];
      L.forEach((x, i) => {
        const id = x && typeof x === 'object' ? x.entity : x, k = kindOf(id), g = groups[groups.length - 1];
        if (g && g.k[0] === k[0]) g.items.push([x, id, i]); else groups.push({ k, items: [[x, id, i]] });
      });
      const tools = (i) => `<span class="v-ret"><button data-rme="del" data-i="${i}" title="Sacar del ambiente">${ic('x')}</button></span>`;
      const tile = ([x, id, i]) => {
        const s0 = st(id), s = s0 ? entState(id) : { on: false, txt: 'No existe en la casa' }, nm = (x && x.name) || fname(id);
        if (id.startsWith('camera.')) return `<div class="v-rcam" data-ri="${i}"><img alt="" src="${esc(camSrc(id))}"><span class="v-rcn">${esc(nm)}</span>${tools(i)}</div>`;
        return `<div class="v-rer ${s.on ? 'on' : ''}" data-ri="${i}"><span class="v-bic">${ic(defIcon(id))}</span><span class="v-tx"><b>${esc(nm)}</b><span>${esc(s.txt)}</span></span>${tools(i)}</div>`;
      };
      const body = groups.map((g) => `<div class="v-rblk"><h4>${ic(g.k[1])}${g.k[2]}</h4><div class="${g.k[0] === 'cam' || g.k[0] === 'cover' || g.k[0] === 'clim' || g.k[0] === 'media' ? 'v-rlist' : 'v-rgrid'}">${g.items.map(tile).join('')}</div></div>`).join('');
      return `<div class="v-grab"></div><div class="v-sh"><span class="v-ric on">${ic(roomIc(R))}</span><div><h2>${esc(R.name)}</h2><small>${L.length} equipo${L.length === 1 ? '' : 's'} · arrastralos para ordenarlos</small></div><button class="v-x" data-rme="close" aria-label="Cerrar">${ic('x')}</button></div>
        ${body || '<p class="v-empty">Todavía no tiene equipos.</p>'}
        <button class="v-eadd" data-radd>+ Agregar un equipo</button>${R.dirty ? `<button class="v-rsave" data-rme="save">Guardar ambiente</button>` : ''}`;
    }
    function openSheet(k, arg) { X.sheet = k; X.sheetArg = arg || null; X.el.querySelector('#v-sheet').classList.add('show'); renderSheet(); }
    function closeSheet() { X.sheet = null; const s = X.el.querySelector('#v-sheet'); if (s) s.classList.remove('show'); }
    function openPinMenu(rid) {
      const m = M(), r = m && m.byId[rid]; if (!r || !ctx.onPin) return;
      const names = (X.roomNames || []).filter((n) => roomByName(m, n));
      const i = names.findIndex((n) => (roomByName(m, n) || {}).id === rid);
      X.menuFor = { rid, names, i };
      X.el.querySelector('#v-menu .v-min').innerHTML = `<div class="t">${esc(r.name)}</div><p>Lo que fijás queda en tu inicio${X.view && X.view.name ? ` («${esc(X.view.name)}»)` : ''}.</p>
        ${i >= 0 ? `${i > 0 ? `<button data-m="up">${ic('up')}Subir</button>` : ''}${i < names.length - 1 ? `<button data-m="down">${ic('down')}Bajar</button>` : ''}<button class="del" data-m="unpin">${ic('x')}Sacar de mi inicio</button>`
          : `<button data-m="pin">${ic('pin')}Fijar en mi inicio</button>`}<button data-m="close">Cancelar</button>`;
      X.el.querySelector('#v-menu').classList.add('show');
    }
    function menuAct(k) {
      const f = X.menuFor; X.el.querySelector('#v-menu').classList.remove('show'); X.menuFor = null;
      if (!f || k === 'close') return;
      const m = M(), r = m.byId[f.rid], names = f.names.slice();
      if (k === 'pin') { names.push(r.name); toast(`${r.name} en tu inicio`); }
      if (k === 'unpin') { names.splice(f.i, 1); toast(`${r.name} sigue en «Toda la casa»`); }
      if (k === 'up') names.splice(f.i - 1, 0, names.splice(f.i, 1)[0]);
      if (k === 'down') names.splice(f.i + 1, 0, names.splice(f.i, 1)[0]);
      ctx.onPin(names);
    }

    /* ───────── toques ───────── */
    function blockOf(elx) { const s = elx.closest('[data-block]'); return s && X.layout.blocks.find((b) => b.id === s.dataset.block); }
    function onClick(e) {
      if (X.held) { X.held = false; return; }
      const c = card(), m = M(); if (!c || !m) return;
      const t = e.target;
      if (editing()) {
        e.preventDefault();
        // el ambiente abierto por dentro (se edita acá mismo)
        const re = t.closest('[data-rme]'); if (re && ctx.edit.onRoom) return ctx.edit.onRoom(re.dataset.rme, +re.dataset.i);
        if (t.closest('[data-radd]') && ctx.edit.onRoom) return ctx.edit.onRoom('add');
        if (t.closest('#v-sheet')) { if (t.id === 'v-sheet' && ctx.edit.onRoom) ctx.edit.onRoom('close'); return; }
        if (t.closest('#v-head')) return ctx.edit.onSelect && ctx.edit.onSelect(null, { zone: 'header' });
        if (t.closest('#v-allb')) return ctx.edit.onSelect && ctx.edit.onSelect(null, { zone: 'allb' });
        if (t.closest('#v-nav,#v-dock')) return ctx.edit.onSelect && ctx.edit.onSelect(null, { zone: 'dock' });
        const ea = t.closest('[data-eact]'), b = t.closest('[data-block]');
        if (ea && b && ctx.edit.onAction) return ctx.edit.onAction(b.dataset.block, ea.dataset.eact);
        const pz = t.closest('[data-zone]'); if (pz && b) return ctx.edit.onSelect && ctx.edit.onSelect(b.dataset.block, { pz: +pz.dataset.zone });
        // la barra del elemento elegido y «+ Agregar …» de adentro de la tarjeta
        const ela = t.closest('[data-elact]'); if (ela && b && ctx.edit.onElem) return ctx.edit.onElem(b.dataset.block, ela.dataset.elact, ctx.edit.el);
        if (t.closest('[data-eladd]') && b && ctx.edit.onElem) return ctx.edit.onElem(b.dataset.block, 'add');
        const add = t.closest('[data-eadd]'); if (add && ctx.edit.onAdd) return ctx.edit.onAdd(+add.dataset.eadd, add.dataset.ezone || null);
        // lo que se toca adentro de la tarjeta: un ambiente, un dato del resumen, un botón
        let sub = null;
        const rm = t.closest('[data-room]'), kt = t.closest('[data-kt]'), it = t.closest('[data-it]');
        const elx = t.closest('[data-el]');
        if (elx) { const v = elx.dataset.el; sub = { el: /^\d+$/.test(v) ? +v : v }; if (rm) sub.room = rm.dataset.room; }
        else if (rm) sub = { room: rm.dataset.room }; else if (kt) sub = { item: +kt.dataset.kt }; else if (it) sub = { item: +it.dataset.it };
        if (ctx.edit.onSelect) ctx.edit.onSelect(b ? b.dataset.block : null, sub);
        return;
      }
      if (t.id === 'v-sheet' || t.closest('[data-close]')) return closeSheet();
      if (t.id === 'v-menu') { X.el.querySelector('#v-menu').classList.remove('show'); return; }
      const mm = t.closest('[data-m]'); if (mm) return menuAct(mm.dataset.m);
      const tog = t.closest('[data-tog]'); if (tog) { vib(); const r = m.byId[tog.dataset.tog]; c.roomLights(tog.dataset.tog, !(r && r.lightsOn.length)); return; }
      const na = t.closest('[data-na]'); if (na) { const n = notes(m)[+na.dataset.na]; if (n) { if (n.sug) c.runSuggestion(n.sug); else if (n.run) n.run(); dismiss(n); } return render(); }
      const nd = t.closest('[data-nd]'); if (nd) { const n = notes(m)[+nd.dataset.nd]; if (n) dismiss(n); return render(); }
      if (t.closest('[data-ndall]')) { notes(m).forEach(dismiss); return render(); }
      const al = t.closest('[data-al]'); if (al) { const a = st(X.sheetArg) || m.alarm; c.alarm(al.dataset.al, a && a.entity_id); closeSheet(); return; }
      const sc = t.closest('[data-scene]'); if (sc) { vib(); const id = sc.dataset.scene, dm = id.split('.')[0]; c.call(dm, dm === 'button' ? 'press' : 'turn_on', { entity_id: id }); sc.classList.add('act'); setTimeout(() => sc.classList.remove('act'), 1200); toast(`Escena «${fname(id)}»`); return; }
      const kt = t.closest('[data-kt]'); if (kt) { const b = blockOf(kt), items = X.kpiItems && b && X.kpiItems[b.id], it = items && items[+kt.dataset.kt]; if (it) { const a = it.tap || (it.kind === 'alarm' ? { type: 'toggle', entity: m.alarm && m.alarm.entity_id } : it.kind === 'lights' ? { type: 'screen', screen: 'luces' } : it.entity ? { type: 'toggle', entity: it.entity } : null); run(a, it); } return; }
      const itb = t.closest('[data-it]'); if (itb) { const b = blockOf(itb), it = b && (b.cfg.items || [])[+itb.dataset.it]; if (it) run(it.tap || { type: it.entity ? 'toggle' : 'none' }, it); return; }
      const gate = t.closest('[data-gate]'); if (gate) { vib(); return c.access(gate.dataset.gate); }
      const alb = t.closest('[data-alarm]'); if (alb) return openSheet('alarm', alb.dataset.alarm);
      const en = t.closest('[data-ent]'); if (en) { const id = en.dataset.ent, d = id.split('.')[0]; vib(); return c.call(d === 'scene' || d === 'script' ? d : 'homeassistant', d === 'scene' || d === 'script' ? 'turn_on' : 'toggle', { entity_id: id }); }
      const rs = t.closest('[data-rsheet]'); if (rs) { vib(); return openSheet('rutinas', rs.dataset.rsheet); }
      const rn = t.closest('[data-run]'); if (rn) { vib(); const id = rn.dataset.run; toast(`«${fname(id)}» en marcha`); return id.startsWith('script.') ? c.call('script', 'turn_on', { entity_id: id }) : c.call('automation', 'trigger', { entity_id: id }); }
      const au = t.closest('[data-auto]'); if (au) { vib(); const s = st(au.dataset.auto), dm = au.dataset.auto.split('.')[0]; return c.call(dm === 'switch' ? 'switch' : 'automation', s && s.state === 'on' ? 'turn_off' : 'turn_on', { entity_id: au.dataset.auto }); }
      const mp = t.closest('[data-mp]'); if (mp) {
        vib(); const id = mp.dataset.mp, s0 = st(id);
        if (s0) { X.opt = X.opt || {}; X.opt[id] = { state: s0.state === 'playing' ? 'paused' : 'playing', until: Date.now() + 4000, from: s0.last_updated }; X.cache = {}; render(); }
        return c.call('media_player', 'media_play_pause', { entity_id: id });
      }
      const mn = t.closest('[data-mn]'); if (mn) return c.call('media_player', 'media_next_track', { entity_id: mn.dataset.mn });
      const cn = t.closest('[data-camnext]'); if (cn) return nextCam(cn, 1);
      if (t.closest('[data-camall]')) return c.openCameras();
      const av = t.closest('[data-actv]'); if (av) return c.openActivity(av.dataset.actv ? { room: av.dataset.actv } : undefined);
      if (t.closest('[data-bri]')) return undefined; // el brillo se maneja al soltar (change)
      const hv = t.closest('[data-hvac]'); if (hv) { vib(); return c.call('climate', 'set_hvac_mode', { entity_id: hv.dataset.eid, hvac_mode: hv.dataset.hvac }); }
      const ct = t.closest('[data-ctemp]'); if (ct) {
        const s = st(ct.dataset.ctemp); if (!s) return undefined;
        const a = s.attributes, step = Number(a.target_temp_step) || 1, cur = Number(a.temperature != null ? a.temperature : a.current_temperature || 24);
        const v = Math.max(Number(a.min_temp) || 10, Math.min(Number(a.max_temp) || 32, Math.round((cur + step * +ct.dataset.d) * 10) / 10));
        vib(); return c.call('climate', 'set_temperature', { entity_id: ct.dataset.ctemp, temperature: v });
      }
      const cv = t.closest('[data-cov]'); if (cv) { vib(); return c.call('cover', cv.dataset.cov, { entity_id: cv.dataset.id }); }
      const bt = t.closest('[data-btap]'); if (bt) { const b = blockOf(bt); if (b && b.cfg && b.cfg.tap) run(b.cfg.tap, { entity: b.cfg.entity, name: b.title }); return undefined; }
      const mo = t.closest('[data-more]'); if (mo) return ctx.openEntity(mo.dataset.more);
      const cam = t.closest('[data-cam]'); if (cam) return openCam(cam.dataset.cam);
      // el cartel (nombre o íconos) abre el ambiente con todo lo que tiene; la zona prende o apaga sus luces
      const zpin = t.closest('[data-zpin]');
      if (zpin) { const zz = X.zonePolys[+zpin.dataset.zone], r = zz && roomByName(m, zz.room || zz.name); if (r) { vib(); return c.openRoom(r.id); } }
      const z = t.closest('[data-zone]'); if (z) { const zz = X.zonePolys[+z.dataset.zone]; if (zz && zz.lights.length) { const any = zz.lights.some((id) => (st(id) || {}).state === 'on'); vib(); c.call('homeassistant', any ? 'turn_off' : 'turn_on', { entity_id: zz.lights }); toast(`${zz.name}: ${any ? 'apagado' : 'prendido'}`); } else if (zz && zz.room) { const r = roomByName(m, zz.room); if (r) c.openRoom(r.id); } return; }
      const room = t.closest('[data-room]'); if (room) { if (X.sheet === 'casa') closeSheet(); return c.openRoom(room.dataset.room); }
      const scr = t.closest('[data-scr]');
      if (scr) {
        const k = scr.dataset.scr;
        if (k === 'top') { if (typeof scrollTo === 'function') scrollTo({ top: 0, behavior: 'smooth' }); return; }
        if (k === 'voice') return c.voice();
        if (X.sheet && k === 'seguridad') closeSheet();
        return screen(k);
      }
      const kk = t.closest('[data-k]'); if (!kk) return;
      const p = player();
      if (kk.dataset.k === 'hidep') { X.hidePlayer = true; return render(); }
      if (kk.dataset.k === 'music') { if (p && X.hidePlayer) { X.hidePlayer = false; return render(); } return c.openMusic(); }
      if (kk.dataset.k === 'player') return c.openMusic();
    }
    // cámaras: la tarjeta de Frigate (grabaciones, todas las cámaras) si está configurada; si no, la ventana del equipo
    function openCam(id) { const c = card(); if (c && c._config && c._config.camera_card) return c.openCameras(); return ctx.openEntity(id); }
    function nextCam(elx, d) {
      const b = blockOf(elx), list = b && X.camList && X.camList[b.id]; if (!list || list.length < 2) return;
      X.camIdx[b.id] = ((X.camIdx[b.id] || 0) + d + list.length) % list.length; vib(); render();
    }
    let holdT = null, swipe = null;
    function onDown(e) {
      if (editing()) return;
      X.held = false; // un toque nuevo: lo de antes (deslizar la cámara, mantener) ya no se come este toque
      const cv = e.target.closest('.v-cam'); swipe = cv ? { x: e.clientX, y: e.clientY, el: cv } : null;
      const r = e.target.closest('[data-room],[data-zone],[data-it]'); if (!r) return;
      if (e.target.closest('button') && !e.target.closest('[data-it]')) return; // el interruptor de un ambiente no abre el menú de fijar
      X.held = false; clearTimeout(holdT);
      holdT = setTimeout(() => {
        X.held = true; vib();
        const m = M();
        if (r.dataset.room) { r.classList.add('press'); setTimeout(() => r.classList.remove('press'), 500); openPinMenu(r.dataset.room); }
        else if (r.dataset.zone) { const zz = X.zonePolys[+r.dataset.zone], rr = zz && roomByName(m, zz.room || zz.name); if (rr) card().openRoom(rr.id); }
        else if (r.dataset.it) { const b = blockOf(r), it = b && (b.cfg.items || [])[+r.dataset.it]; if (it && it.hold) run(it.hold, it); else if (it && it.entity) ctx.openEntity(it.entity); }
      }, 520);
    }
    const onUp = (e) => {
      clearTimeout(holdT);
      if (swipe && e && e.type === 'pointerup') { const dx = e.clientX - swipe.x; if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(e.clientY - swipe.y)) { X.held = true; nextCam(swipe.el, dx < 0 ? 1 : -1); } }
      swipe = null;
    };
    el.addEventListener('click', onClick);
    el.addEventListener('pointerdown', onDown);
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => el.addEventListener(ev, onUp));
    el.addEventListener('contextmenu', (e) => { if (e.target.closest('[data-room],[data-zone],[data-it]')) e.preventDefault(); });
    // brillo de las luces: se manda al soltar el deslizador
    el.addEventListener('pointerdown', (e) => { if (!editing() && e.target.closest && e.target.closest('[data-bri]')) { X.sliding = true; X.slideAt = Date.now(); setTimeout(() => { if (X.sliding && Date.now() - X.slideAt >= 3000) { X.sliding = false; render(); } }, 3100); } }, true);
    el.addEventListener('change', (e) => {
      const r = e.target.closest && e.target.closest('[data-bri]'); X.sliding = false;
      if (!r || editing()) return;
      const c = card(); if (c) { vib(); c.call('light', 'turn_on', { entity_id: r.dataset.bri, brightness_pct: Math.max(1, Math.min(100, +r.value || 1)) }); }
    });
    const endSlide = () => { if (X.sliding) { X.sliding = false; setTimeout(render, 400); } };
    ['pointerup', 'pointercancel'].forEach((ev) => { if (typeof addEventListener === 'function') addEventListener(ev, endSlide); });
    if (typeof document !== 'undefined' && document.addEventListener) document.addEventListener('visibilitychange', endSlide); // al volver a la app, nunca trabada
    // editor: los carteles del plano se arrastran a su lugar
    let pinDrag = null;
    el.addEventListener('pointerdown', (e) => {
      if (!editing() || !ctx.edit.onPin) return;
      const pin = e.target.closest && e.target.closest('.v-pin'); if (!pin) return;
      const plan = pin.closest('.v-plan'); if (!plan) return;
      pinDrag = { pin, plan, i: +pin.dataset.zone, x: e.clientX, y: e.clientY, moved: false };
      try { pin.setPointerCapture(e.pointerId); } catch (_) { /* navegador viejo */ }
    });
    el.addEventListener('pointermove', (e) => {
      if (!pinDrag) return;
      if (Math.abs(e.clientX - pinDrag.x) + Math.abs(e.clientY - pinDrag.y) > 4) pinDrag.moved = true;
      if (!pinDrag.moved) return;
      const r = pinDrag.plan.getBoundingClientRect();
      pinDrag.pos = [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))].map((v) => Math.round(v * 10000) / 10000);
      pinDrag.pin.style.left = `${(pinDrag.pos[0] * 100).toFixed(2)}%`; pinDrag.pin.style.top = `${(pinDrag.pos[1] * 100).toFixed(2)}%`;
    });
    el.addEventListener('pointerup', () => {
      const d = pinDrag; pinDrag = null;
      if (d && d.moved && d.pos) { X.held = true; ctx.edit.onPin(d.i, d.pos); }
    });
    /* ── editor: arrastrar y soltar, uno solo para todo (tarjetas, lo de adentro de cada tarjeta y los equipos del ambiente).
       Con el puntero (mouse y dedo): se agarra, aparece una copia que sigue el dedo y una línea marca dónde va a caer. */
    let dnd = null;
    const DRAG_MIN = 6, LONG_MS = 380;
    const ghostOf = (node) => {
      const r = node.getBoundingClientRect(), g = node.cloneNode(true);
      g.classList.add('v-ghost'); g.removeAttribute('id');
      const base = X.el.getBoundingClientRect();
      Object.assign(g.style, { position: 'absolute', left: `${r.left - base.left}px`, top: `${r.top - base.top}px`, width: `${r.width}px`, height: `${Math.min(r.height, 260)}px`, margin: '0', pointerEvents: 'none', zIndex: '60', overflow: 'hidden' });
      X.el.appendChild(g);
      return { g, dx: 0, dy: 0, r };
    };
    const line = () => { let l = X.el.querySelector('.v-dropline'); if (!l) { l = X.el.ownerDocument.createElement('div'); l.className = 'v-dropline'; X.el.appendChild(l); } return l; };
    const showLine = (rect, edge) => {
      const l = line(), base = X.el.getBoundingClientRect(), z = parseFloat((X.el.style && X.el.style.zoom) || 1) || 1;
      const L0 = (rect.left - base.left) / z, T0 = (rect.top - base.top) / z, W = rect.width / z, H = rect.height / z;
      const v = edge === 'left' || edge === 'right';
      Object.assign(l.style, v ? { left: `${(edge === 'left' ? L0 - 4 : L0 + W + 1)}px`, top: `${T0}px`, width: '3px', height: `${H}px` }
        : { left: `${L0}px`, top: `${(edge === 'top' ? T0 - 5 : T0 + H + 2)}px`, width: `${W}px`, height: '3px' });
      l.style.display = 'block';
    };
    const hideLine = () => { const l = X.el.querySelector('.v-dropline'); if (l) l.style.display = 'none'; };
    /** ¿Las cosas de este grupo van una al lado de la otra? (filas de tarjetas angostas, grillas de botones o ambientes) */
    const sideways = (a, b) => { const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect(); return Math.abs(ra.top - rb.top) < Math.min(ra.height, rb.height) / 2; };
    const edgeFor = (target, x, y) => {
      const r = target.getBoundingClientRect(), sibs = Array.from(target.parentNode ? target.parentNode.children : []).filter((n) => n !== target && n.matches && n.matches(dnd.sel));
      const horiz = sibs.some((n) => sideways(n, target));
      return horiz ? (x < r.left + r.width / 2 ? 'left' : 'right') : (y < r.top + r.height / 2 ? 'top' : 'bottom');
    };
    const under = (x, y) => { const rn = X.el.getRootNode ? X.el.getRootNode() : null, d = rn && rn.elementFromPoint ? rn : X.el.ownerDocument; return d.elementFromPoint ? d.elementFromPoint(x, y) : null; };
    const autoScroll = (x, y) => {
      const n = under(x, y), sc = n && n.closest && n.closest('.v-col,.v-sin,.v-side');
      const box = sc || X.el.ownerDocument.scrollingElement;
      if (!box || !box.getBoundingClientRect) return;
      const r = sc ? box.getBoundingClientRect() : { top: 0, bottom: X.el.ownerDocument.defaultView.innerHeight };
      if (y < r.top + 40) box.scrollTop -= 14; else if (y > r.bottom - 40) box.scrollTop += 14;
    };
    el.addEventListener('pointerdown', (e) => {
      if (!editing() || e.button > 0 || pinDrag) return;
      const t = e.target;
      if (t.closest && t.closest('input,select,textarea,.v-ecard,.v-etool,.v-eltool,.v-eadd,[data-eact],[data-radd],[data-rme],.v-pin')) return;
      let kind0 = null, node = null;
      const it = t.closest && t.closest('[data-el]'), ri = t.closest && t.closest('[data-ri]'), blk = t.closest && t.closest('[data-block]'), dk = t.closest && t.closest('[data-dkk]');
      if (dk && ctx.edit.onDock) { kind0 = 'dock'; node = dk; } else if (it && it.dataset.el !== 'cam' && blk) { kind0 = 'el'; node = it; } else if (ri) { kind0 = 'ri'; node = ri; } else if (blk) { kind0 = 'card'; node = blk; }
      if (!node) return;
      dnd = { kind: kind0, node, sel: kind0 === 'el' ? '[data-el]' : kind0 === 'ri' ? '[data-ri]' : kind0 === 'dock' ? '[data-dkk]' : '[data-block]', x0: e.clientX, y0: e.clientY, on: false, block: blk && blk.dataset.block };
      // con el dedo: hay que mantenerla apretada un momento (si se mueve antes, es para desplazar la pantalla)
      if (e.pointerType === 'touch') {
        const d0 = dnd; d0.touch = true; d0.armed = false;
        d0.lt = setTimeout(() => { if (dnd !== d0) return; d0.armed = true; node.classList.add('lift'); try { if (navigator.vibrate) navigator.vibrate(12); } catch (_) { /* sin vibración */ } }, LONG_MS);
      }
    }, true);
    el.addEventListener('pointermove', (e) => {
      if (!dnd) return;
      if (dnd.touch && !dnd.armed) {
        if (Math.abs(e.clientX - dnd.x0) + Math.abs(e.clientY - dnd.y0) > 10) { clearTimeout(dnd.lt); dnd = null; } // desplaza la pantalla
        return;
      }
      if (!dnd.on) {
        if (!dnd.touch && Math.abs(e.clientX - dnd.x0) + Math.abs(e.clientY - dnd.y0) < DRAG_MIN) return;
        dnd.on = true; X.dnd = true;
        dnd.ghost = ghostOf(dnd.node); dnd.node.classList.add('dragging');
        dnd.ghost.dx = e.clientX - dnd.ghost.r.left; dnd.ghost.dy = e.clientY - dnd.ghost.r.top;
      }
      e.preventDefault();
      { const base = X.el.getBoundingClientRect(); dnd.ghost.g.style.left = `${e.clientX - dnd.ghost.dx - base.left}px`; dnd.ghost.g.style.top = `${e.clientY - dnd.ghost.dy - base.top}px`; }
      autoScroll(e.clientX, e.clientY);
      const n = under(e.clientX, e.clientY);
      dnd.drop = null;
      if (!n || !n.closest) { hideLine(); return; }
      if (dnd.kind === 'card') {
        const tgt = n.closest('[data-block]');
        if (tgt && tgt !== dnd.node && !tgt.contains(dnd.node)) {
          const edge = edgeFor(tgt, e.clientX, e.clientY);
          dnd.drop = { target: tgt.dataset.block, after: edge === 'bottom' || edge === 'right' };
          showLine(tgt.getBoundingClientRect(), edge); return;
        }
        // en una columna o banda, debajo de la última tarjeta (o vacía)
        const area = n.closest('[data-col],[data-zone]');
        if (area && !tgt) {
          const kids = Array.from(area.querySelectorAll(':scope > [data-block], :scope > .v-row4 > [data-block]')).filter((x) => x !== dnd.node);
          dnd.drop = area.dataset.zone ? { zone: area.dataset.zone } : { col: +area.dataset.col };
          if (kids.length) showLine(kids[kids.length - 1].getBoundingClientRect(), 'bottom');
          else { const r = area.getBoundingClientRect(); showLine({ left: r.left, top: r.top + 6, width: r.width, height: 0 }, 'top'); }
          return;
        }
      } else if (dnd.kind === 'dock') {
        const tgt = n.closest('[data-dkk]');
        if (tgt && tgt !== dnd.node) {
          const r = tgt.getBoundingClientRect(), after = e.clientX > r.left + r.width / 2;
          dnd.drop = { from: dnd.node.dataset.dkk, to: tgt.dataset.dkk, after };
          showLine(r, after ? 'right' : 'left'); return;
        }
      } else {
        const tgt = n.closest(dnd.sel);
        const same = tgt && tgt !== dnd.node && (dnd.kind === 'ri' || (tgt.closest('[data-block]') || {}).dataset.block === dnd.block);
        if (same) {
          const edge = edgeFor(tgt, e.clientX, e.clientY), ti = +(dnd.kind === 'el' ? tgt.dataset.el : tgt.dataset.ri), fi = +(dnd.kind === 'el' ? dnd.node.dataset.el : dnd.node.dataset.ri);
          let to = ti + (edge === 'bottom' || edge === 'right' ? 1 : 0); if (fi < to) to -= 1;
          dnd.drop = { from: fi, to };
          showLine(tgt.getBoundingClientRect(), edge); return;
        }
      }
      hideLine();
    }, { passive: false });
    const endDnd = (ok) => {
      const d = dnd; dnd = null;
      if (!d) return;
      clearTimeout(d.lt); if (d.node && d.node.classList) d.node.classList.remove('lift');
      hideLine();
      if (d.ghost) d.ghost.g.remove();
      if (d.node && d.node.classList) d.node.classList.remove('dragging');
      if (!d.on) return;
      X.dnd = false; X.held = true; // el «click» que sigue al soltar no elige nada
      setTimeout(() => { X.held = false; }, 0);
      if (!ok || !d.drop) { render(); return; }
      if (d.kind === 'card' && ctx.edit.onMove) ctx.edit.onMove(d.node.dataset.block, d.drop);
      else if (d.kind === 'el' && ctx.edit.onElem && d.drop.from !== d.drop.to) ctx.edit.onElem(d.block, 'move', d.drop);
      else if (d.kind === 'ri' && ctx.edit.onRoom && d.drop.from !== d.drop.to) ctx.edit.onRoom('move', d.drop);
      else if (d.kind === 'dock' && ctx.edit.onDock) ctx.edit.onDock(d.drop.from, d.drop.to, d.drop.after);
      else render();
    };
    el.addEventListener('pointerup', () => endDnd(true));
    // ya agarrada con el dedo, la pantalla no se desplaza ni sale el menú del sistema
    el.addEventListener('touchmove', (e) => { if (dnd && dnd.armed && e.cancelable) e.preventDefault(); }, { passive: false });
    el.addEventListener('contextmenu', (e) => { if (editing()) e.preventDefault(); });
    el.addEventListener('pointercancel', () => endDnd(false));
    if (typeof addEventListener === 'function') addEventListener('keydown', (e) => { if (e.key === 'Escape' && dnd) endDnd(false); });
    // el navegador no arrastra imágenes ni textos por su cuenta mientras se edita
    el.addEventListener('dragstart', (e) => { if (editing()) e.preventDefault(); });
    const refreshCam = () => {
      if (!X.el || X.el.hidden || (typeof document !== 'undefined' && document.hidden)) return;
      X.el.querySelectorAll('img[data-cam]:not([data-stream])').forEach((im) => {
        if (im.closest && im.closest('[data-live]') && im.closest('[data-live]').querySelector('advanced-camera-card')) return; const s = camSrc(im.dataset.cam); if (s && im.getAttribute('src') !== s) im.src = s; });
    };
    X.camT = setInterval(refreshCam, 10000);
    // las fotos seguidas de iOS: cada 2 s, sólo si la anterior ya cargó (no se apilan pedidos)
    if (IOS) X.fastT = setInterval(() => {
      if (!X.el || X.el.hidden || (typeof document !== 'undefined' && document.hidden)) return;
      X.el.querySelectorAll('img[data-fast]').forEach((im) => {
        if (!im.complete) return;
        const s = camSrc(im.dataset.cam); if (s) im.src = s.replace(/([?&])t=\d+/, `$1t=${Date.now()}`);
      });
    }, 2000);
    const onResize = () => { if (kind() === 'tablet') { X.shell = null; render(); } };
    if (typeof addEventListener === 'function') addEventListener('resize', onResize);
    X.clockT = setInterval(() => { if (!X.el.hidden) render(); }, 20000);

    return {
      setView(v) { X.view = v || null; X.cache = {}; X.shell = null; render(); },
      view: () => X.view,
      shown: (id) => X.shown[id] || null, // lo que muestra cada tarjeta (para pasar de automático a armada a mano)
      layout: () => X.layout || layout(M() || { rooms: [], access: [], cams: [], roomOf: {}, scenes: [] }),
      render,
      setCtx(patch) { Object.assign(ctx, patch); X.cache = {}; X.shell = null; render(); },
      destroy() { X.destroyed = true; closeXtra(); clearInterval(X.camT); clearInterval(X.fastT); clearInterval(X.clockT); if (typeof removeEventListener === 'function') removeEventListener('resize', onResize); el.removeEventListener('click', onClick); el.innerHTML = ''; },
      _test: { notes, X, run },
    };
  }

  root.MaeVista = { create, defaults, template, TEMPLATE_LIST, migrateLayout, TABLET_PRESETS, CATALOG, SCREEN_NAMES, CONDITIONS, DOCK, DOCK_DEF, ICONS, icon: ic, uid, STYLE_LIST, GRAD_LIST };
})(typeof window !== 'undefined' ? window : globalThis);
