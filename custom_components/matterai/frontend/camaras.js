/*
 * MatterAI · Tarjeta de cámaras propia (<mae-cam>).
 *
 * Una sola tarjeta para todas las cámaras de la casa, mezcladas: las de Home Assistant sin Frigate (RTSP / «Generic
 * Camera», ONVIF, etc.) y las de Frigate. Lo del día a día y nada más:
 *   - en vivo (WebRTC por Home Assistant; si la cámara no lo da, HLS; si tampoco, fotos seguidas);
 *   - pasar de cámara (deslizando o con las flechas);
 *   - zoom (pellizco, doble toque, rueda del mouse) y moverse por la imagen;
 *   - pantalla completa;
 *   - en las de Frigate: eventos y grabaciones por hora. En las demás ese botón no aparece.
 * Un solo video a la vez. Los controles aparecen al tocar y se esconden solos: no tapan la imagen.
 *
 *   const el = document.createElement('mae-cam');
 *   el.setConfig({ cameras: ['camera.a', 'camera.b'], start: 'camera.b', mode: 'card' | 'page' });
 *   el.hass = hass;
 *
 * El video en vivo lo dan los reproductores de la app (lib/ha-camera-players.js y lib/ha-hls-player.js), que hablan
 * con Home Assistant igual que su propia página (camera/capabilities, camera/webrtc/offer, camera/stream).
 */
(function () {
  'use strict';
  if (typeof customElements === 'undefined' || customElements.get('mae-cam')) return;

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const IC = {
    prev: '<path d="M15 5l-7 7 7 7"/>', next: '<path d="M9 5l7 7-7 7"/>',
    full: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>', exit: '<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>',
    rec: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>', mute: '<path d="M4 9.5h3l4-3.5v12l-4-3.5H4z"/><path d="M16 9l5 6M21 9l-5 6"/>',
    sound: '<path d="M4 9.5h3l4-3.5v12l-4-3.5H4z"/><path d="M15.5 9a4.5 4.5 0 010 6M18 6.5a8 8 0 010 11"/>',
    live: '<circle cx="12" cy="12" r="4" fill="currentColor" stroke="none"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>',
  };
  const ic = (k) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[k]}</svg>`;
  // lo que detecta Frigate, en castellano
  const LABELS = { person: 'Persona', car: 'Auto', truck: 'Camión', bus: 'Colectivo', motorcycle: 'Moto', bicycle: 'Bicicleta', dog: 'Perro', cat: 'Gato', bird: 'Pájaro', horse: 'Caballo', package: 'Paquete', face: 'Cara', license_plate: 'Patente' };
  const IOS = /iPhone|iPad|iPod/.test(navigator.userAgent || '') || (/Macintosh/.test(navigator.userAgent || '') && navigator.maxTouchPoints > 1);
  const UI_MS = 3500, SWIPE = 45, ZMAX = 6;

  const CSS = `
  :host{display:block;position:relative;width:100%;height:100%;color:#fff;font:14px/1.35 "Red Hat Display",system-ui,-apple-system,sans-serif;-webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none}
  :host([mode=page]){height:auto}
  *{box-sizing:border-box}
  .wrap{position:relative;width:100%;height:100%;display:flex;flex-direction:column;background:#000}
  :host([mode=page]) .wrap{background:none;height:auto}
  .stage{position:relative;flex:1;min-height:0;overflow:hidden;background:#05070a;touch-action:pan-y}
  :host([mode=page]) .stage{flex:none;aspect-ratio:16/9;border-radius:18px}
  .stage.zoomed,.fs .stage{touch-action:none}
  .zoom{position:absolute;inset:0;transform-origin:0 0;will-change:transform}
  .zoom>*{position:absolute;inset:0;width:100%;height:100%;display:block;--mae-video-h:100%;--mae-video-fit:contain;--video-max-height:100%}
  .zoom>video,.zoom>img{object-fit:contain;background:#000}
  .poster{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;opacity:.55;filter:blur(2px);transition:opacity .3s}
  .poster.off{opacity:0}
  .load{position:absolute;left:50%;top:50%;width:34px;height:34px;margin:-17px;border-radius:50%;border:3px solid rgba(255,255,255,.25);border-top-color:#fff;animation:sp 1s linear infinite;pointer-events:none}
  .load.off{display:none}
  @keyframes sp{to{transform:rotate(360deg)}}
  /* lo que va encima de la imagen: chico, en los bordes, y se esconde solo */
  .ov{position:absolute;inset:0;pointer-events:none;opacity:0;transition:opacity .25s}
  .ui .ov{opacity:1}
  .ov button{pointer-events:none}
  .ui .ov button{pointer-events:auto}
  .name{position:absolute;left:10px;bottom:10px;max-width:60%;padding:4px 10px;border-radius:999px;background:rgba(0,0,0,.5);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);font-weight:600;font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;pointer-events:none;opacity:1;transition:opacity .25s}
  .name i{display:inline-block;width:7px;height:7px;border-radius:50%;background:#ff5a4d;margin-right:6px;vertical-align:1px}
  .name.clip i{background:#f2b766}
  .b{width:36px;height:36px;padding:8px;border:0;border-radius:50%;background:rgba(0,0,0,.5);color:#fff;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);cursor:pointer;display:grid;place-items:center}
  .b svg{width:100%;height:100%}
  .b:active{background:rgba(255,255,255,.3)}
  .nav{position:absolute;top:50%;margin-top:-18px}
  .nav.p{left:8px}.nav.n{right:8px}
  .bar{position:absolute;right:8px;bottom:8px;display:flex;gap:8px}
  .top{position:absolute;right:8px;top:8px;display:flex;gap:8px}
  .dots{position:absolute;left:0;right:0;top:8px;display:flex;gap:5px;justify-content:center;pointer-events:none}
  .dots i{width:6px;height:6px;border-radius:50%;background:rgba(255,255,255,.4)}.dots i.on{background:#fff}
  .msg{position:absolute;left:12px;right:12px;top:50%;transform:translateY(-50%);text-align:center;color:#d5dae3;font-size:13px;pointer-events:none}
  .msg:empty{display:none}
  [hidden]{display:none!important}
  /* pantalla completa (cuando el equipo no la da de verdad, como el iPhone): ocupa todo, y de costado si está parado */
  :host(.fs){position:fixed!important;inset:0!important;z-index:2147483600;width:auto!important;height:auto!important;background:#000}
  :host(.fs) .wrap{position:absolute;inset:0;height:auto}
  :host(.fs) .stage,:host(:fullscreen) .stage{aspect-ratio:auto;border-radius:0;flex:1}
  :host(.fs.rot) .wrap{inset:auto;left:50%;top:50%;width:100vh;height:100vw;transform:translate(-50%,-50%) rotate(90deg)}
  :host(.fs) .panel,:host(:fullscreen) .panel{display:none}
  :host(:fullscreen){background:#000}
  /* eventos y grabaciones (sólo cámaras de Frigate) */
  .panel{padding:12px 2px 4px;color:var(--primary-text-color,#e9ecf2)}
  .tabs{display:inline-flex;padding:3px;border-radius:12px;background:rgba(127,137,155,.18);margin-bottom:10px}
  .tabs button{border:0;background:none;color:inherit;opacity:.65;font:inherit;font-weight:600;padding:7px 14px;border-radius:9px;cursor:pointer}
  .tabs button.on{opacity:1;background:rgba(127,137,155,.32)}
  .evs{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}
  .ev{position:relative;border:0;padding:0;border-radius:14px;overflow:hidden;background:rgba(127,137,155,.18);color:inherit;font:inherit;text-align:left;cursor:pointer}
  .ev img{display:block;width:100%;aspect-ratio:16/9;object-fit:cover;background:#0b0e12}
  .ev span{display:block;padding:7px 10px 9px}.ev b{display:block;font-size:13.5px}.ev small{opacity:.7;font-size:12px}
  .ev.on{outline:2px solid #f2b766}
  .chips{display:flex;gap:8px;overflow-x:auto;padding-bottom:8px;scrollbar-width:none}.chips::-webkit-scrollbar{display:none}
  .chip{flex:none;border:0;border-radius:999px;padding:8px 14px;background:rgba(127,137,155,.18);color:inherit;font:inherit;font-weight:600;cursor:pointer}
  .chip.on{background:#f2b766;color:#1b1408}
  .hours{display:grid;grid-template-columns:repeat(auto-fill,minmax(92px,1fr));gap:8px}
  .hr{border:0;border-radius:12px;padding:10px 8px;background:rgba(127,137,155,.18);color:inherit;font:inherit;text-align:center;cursor:pointer}
  .hr b{display:block;font-size:15px}.hr small{opacity:.7;font-size:11.5px}.hr.on{outline:2px solid #f2b766}
  .more{display:block;margin:12px auto 0;border:0;border-radius:999px;padding:9px 18px;background:rgba(127,137,155,.25);color:inherit;font:inherit;font-weight:600;cursor:pointer}
  .hint{opacity:.65;font-size:13px;padding:10px 2px}
  `;

  class MaeCam extends HTMLElement {
    constructor() {
      super();
      this._cfg = { cameras: [], mode: 'card' };
      this._i = 0; this._z = { s: 1, x: 0, y: 0 }; this._muted = true; this._clip = null; this._tab = 'ev';
      this._fr = {}; // por cámara de Frigate: { client, name } (o false si no lo es)
      this._ptr = new Map();
      this.attachShadow({ mode: 'open' }).innerHTML = `<style>${CSS}</style>
        <div class="wrap"><div class="stage" id="st">
          <img class="poster off" id="po" alt="">
          <div class="zoom" id="zo"></div>
          <div class="load" id="ld"></div>
          <div class="msg" id="ms"></div>
          <div class="name" id="nm"></div>
          <div class="ov"><div class="dots" id="dt"></div>
            <button class="b nav p" data-a="prev" aria-label="Cámara anterior">${ic('prev')}</button>
            <button class="b nav n" data-a="next" aria-label="Cámara siguiente">${ic('next')}</button>
            <div class="top"><button class="b" data-a="live" id="bl" hidden aria-label="Volver al vivo">${ic('x')}</button></div>
            <div class="bar">
              <button class="b" data-a="rec" id="br" hidden aria-label="Eventos y grabaciones">${ic('rec')}</button>
              <button class="b" data-a="mute" id="bm" aria-label="Sonido">${ic('mute')}</button>
              <button class="b" data-a="full" id="bf" aria-label="Pantalla completa">${ic('full')}</button>
            </div></div>
        </div><div class="panel" id="pn" hidden></div></div>`;
      const $ = (id) => this.shadowRoot.getElementById(id);
      this.$ = $;
      this._wrap = this.shadowRoot.querySelector('.wrap');
      this._bindGestures();
      this.shadowRoot.addEventListener('click', (e) => this._onClick(e));
      this._onFs = () => this._syncFs();
      this._onResize = () => { if (this.classList.contains('fs')) this._syncFs(); };
    }

    /* ───────── configuración y datos ───────── */
    setConfig(c) {
      // cada cámara: 'camera.x' o { entity, fit }. fit: 'contain' (entera, con bordes si hace falta), 'cover' (llena y
      // recorta) o 'fill' (estira: para las grabadoras que mandan la imagen angosta, p. ej. 1080P Lite 960x1080)
      const fit = {};
      const cams = (c && Array.isArray(c.cameras) ? c.cameras : []).map((x) => {
        if (typeof x === 'string') return x;
        const id = x && (x.camera_entity || x.entity);
        if (id && ['contain', 'cover', 'fill'].includes(x.fit)) fit[id] = x.fit;
        return id;
      }).filter(Boolean);
      this._cfg = { cameras: [...new Set(cams)], mode: c && c.mode === 'page' ? 'page' : 'card', start: c && c.start, fit };
      this.setAttribute('mode', this._cfg.mode);
      const k = this._cfg.cameras.indexOf(this._cfg.start);
      this._i = k >= 0 ? k : 0;
      if (this._hass) this._show();
    }
    set hass(h) {
      const first = !this._hass;
      this._hass = h;
      if (first) { this._show(); return; }
      if (this._stream) {
        this._stream.hass = h;
        const st = h && h.states && h.states[this._cam()];
        if (st && this._stream.stateObj !== st) this._stream.stateObj = st;
      }
      if (this._hls) this._hls.hass = h;
    }
    get hass() { return this._hass; }
    _cam() { return this._cfg.cameras[this._i]; }
    _state(id) { return this._hass && this._hass.states ? this._hass.states[id] : null; }
    _title(id) { const s = this._state(id); return (s && s.attributes && s.attributes.friendly_name) || String(id || '').replace(/^camera\./, '').replace(/_/g, ' '); }
    _abs(p) { return this._hass && typeof this._hass.hassUrl === 'function' && p && p.charAt(0) === '/' ? this._hass.hassUrl(p) : p; }
    _log(m) { try { if (window.__maeCamLog) window.__maeCamLog(m); } catch (_) { /* nada */ } }

    connectedCallback() {
      document.addEventListener('fullscreenchange', this._onFs);
      window.addEventListener('resize', this._onResize);
      if (this._hass && !this._stream && !this._clip) this._show();
    }
    disconnectedCallback() {
      document.removeEventListener('fullscreenchange', this._onFs);
      window.removeEventListener('resize', this._onResize);
      clearTimeout(this._uiT); clearInterval(this._snapT);
      if (!this._moving) this._drop();
    }

    /* ───────── en vivo ───────── */
    async _players() {
      if (customElements.get('ha-camera-stream')) return true;
      try { await import('./lib/ha-hls-player.js'); await import('./lib/ha-camera-players.js'); } catch (e) { this._log(`cámaras: no cargaron los reproductores (${e && e.message})`); }
      return !!customElements.get('ha-camera-stream');
    }
    _drop() {
      clearInterval(this._snapT); this._snapT = null;
      const z = this.$('zo');
      while (z.firstChild) z.removeChild(z.firstChild); // al sacarlos, los reproductores cortan su video
      this._stream = null; this._hls = null; this._vid = null;
    }
    async _show() {
      if (!this._hass || !this.isConnected) return;
      const id = this._cam(), st = this._state(id), tok = (this._tok = (this._tok || 0) + 1);
      this._clip = null; this._drop(); this._resetZoom();
      this._paintChrome();
      const ms = this.$('ms'), po = this.$('po');
      ms.textContent = '';
      if (!id) { this.$('ld').classList.add('off'); ms.textContent = 'No hay cámaras para mostrar.'; return; }
      if (!st || st.state === 'unavailable') { this.$('ld').classList.add('off'); po.classList.add('off'); ms.textContent = `${this._title(id)} no responde.`; return; }
      // mientras conecta: la última foto de la cámara, apenas borrosa
      const pic = st.attributes && st.attributes.entity_picture;
      if (pic) { po.src = this._abs(pic); po.classList.remove('off'); } else po.classList.add('off');
      this.$('ld').classList.remove('off');
      if (!(await this._players()) || tok !== this._tok) return;
      const el = document.createElement('ha-camera-stream');
      el.muted = this._muted; el.controls = false;
      el.hass = this._hass; el.stateObj = st;
      el.style.setProperty('--mae-video-fit', (this._cfg.fit && this._cfg.fit[id]) || 'contain');
      this.$('zo').appendChild(el);
      this._stream = el;
      // ¿ya hay imagen? Se mira el video (o la foto) que arma el reproductor por dentro
      const deep = (root, out) => { root.querySelectorAll('*').forEach((x) => { out.push(x); if (x.shadowRoot) deep(x.shadowRoot, out); }); return out; };
      clearInterval(this._snapT);
      const t0 = Date.now();
      this._snapT = setInterval(() => {
        if (tok !== this._tok || !el.isConnected) { clearInterval(this._snapT); return; }
        const all = el.shadowRoot ? deep(el.shadowRoot, []) : [];
        const ok = all.some((x) => (x.tagName === 'VIDEO' && x.readyState >= 2 && x.videoWidth > 0) || (x.tagName === 'IMG' && x.complete && x.naturalWidth > 0));
        if (ok) { clearInterval(this._snapT); this.$('ld').classList.add('off'); po.classList.add('off'); this._log(`cámara ${id}: con imagen en ${((Date.now() - t0) / 1000).toFixed(1)} s`); } else if (Date.now() - t0 > 45000) { clearInterval(this._snapT); this.$('ld').classList.add('off'); this.$('ms').textContent = `No llega el video de ${this._title(id)}.`; this._log(`cámara ${id}: sin imagen en 45 s`); }
      }, 300);
      this._frigate(id).then(() => { if (tok === this._tok) this._paintChrome(); });
      if (this._cfg.mode === 'page') this._paintPanel();
      this._ui(true);
    }
    _go(d) {
      const n = this._cfg.cameras.length; if (n < 2) return;
      this._i = (this._i + d + n) % n;
      this._show();
    }
    _paintChrome() {
      const id = this._cam(), n = this._cfg.cameras.length, fr = this._fr[id];
      const nm = this.$('nm');
      nm.className = `name${this._clip ? ' clip' : ''}`;
      nm.innerHTML = `<i></i>${esc(this._clip ? this._clip.title : this._title(id))}`;
      this.$('dt').innerHTML = n > 1 && n <= 12 ? this._cfg.cameras.map((_, k) => `<i class="${k === this._i ? 'on' : ''}"></i>`).join('') : '';
      this.shadowRoot.querySelectorAll('.nav').forEach((b) => { b.hidden = n < 2 || !!this._clip; });
      this.$('br').hidden = !fr;            // grabaciones: sólo si esta cámara es de Frigate
      this.$('bl').hidden = !this._clip;
      this.$('bm').hidden = !!this._clip;   // las grabaciones traen sus propios controles
      this.$('bm').innerHTML = ic(this._muted ? 'mute' : 'sound');
      this.$('bf').innerHTML = ic(this._isFs() ? 'exit' : 'full');
    }

    /* ───────── gestos: tocar, deslizar, zoom ───────── */
    _ui(on) {
      clearTimeout(this._uiT);
      this._wrap.classList.toggle('ui', !!on);
      if (on) this._uiT = setTimeout(() => this._wrap.classList.remove('ui'), UI_MS);
    }
    _rot() { return this.classList.contains('rot'); }
    /** Punto de la pantalla → punto dentro de la imagen (cuenta si la pantalla completa está girada). */
    _pt(e) {
      const r = this.$('st').getBoundingClientRect();
      if (!this._rot()) return { x: e.clientX - r.left, y: e.clientY - r.top, w: r.width, h: r.height };
      // girada 90°: el ancho de la imagen es el alto de la pantalla
      return { x: e.clientY - r.top, y: r.right - e.clientX, w: r.height, h: r.width };
    }
    _apply() {
      const z = this._z, st = this.$('st'), r = st.getBoundingClientRect();
      const w = this._rot() ? r.height : r.width, h = this._rot() ? r.width : r.height;
      z.s = Math.max(1, Math.min(ZMAX, z.s));
      z.x = Math.min(0, Math.max(w - w * z.s, z.x)); z.y = Math.min(0, Math.max(h - h * z.s, z.y));
      this.$('zo').style.transform = z.s === 1 ? '' : `translate(${z.x}px,${z.y}px) scale(${z.s})`;
      st.classList.toggle('zoomed', z.s > 1.01);
    }
    _resetZoom() { this._z = { s: 1, x: 0, y: 0 }; this._apply(); }
    _zoomAt(p, s) {
      const z = this._z, k = Math.max(1, Math.min(ZMAX, s)) / z.s;
      z.x = p.x - (p.x - z.x) * k; z.y = p.y - (p.y - z.y) * k; z.s *= k;
      this._apply();
    }
    _bindGestures() {
      const st = this.$('st');
      let start = null, moved = false, lastTap = 0, pinch = null;
      const pts = () => [...this._ptr.values()];
      st.addEventListener('pointerdown', (e) => {
        if (e.target.closest && e.target.closest('button')) return;
        if (this._clip) return; // las grabaciones se manejan con sus controles
        this._ptr.set(e.pointerId, this._pt(e));
        try { st.setPointerCapture(e.pointerId); } catch (_) { /* sin captura */ }
        if (this._ptr.size === 1) { start = this._pt(e); moved = false; }
        if (this._ptr.size === 2) { const [a, b] = pts(); pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, s: this._z.s }; moved = true; }
      });
      st.addEventListener('pointermove', (e) => {
        if (!this._ptr.has(e.pointerId)) return;
        const prev = this._ptr.get(e.pointerId), p = this._pt(e);
        this._ptr.set(e.pointerId, p);
        if (this._ptr.size >= 2 && pinch) {
          const [a, b] = pts(), d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
          this._zoomAt({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, pinch.s * (d / pinch.d));
          e.preventDefault(); return;
        }
        if (!start) return;
        if (Math.abs(p.x - start.x) + Math.abs(p.y - start.y) > 8) moved = true;
        if (this._z.s > 1.01) { this._z.x += p.x - prev.x; this._z.y += p.y - prev.y; this._apply(); e.preventDefault(); }
      });
      const up = (e) => {
        if (!this._ptr.has(e.pointerId)) return;
        const p = this._ptr.get(e.pointerId);
        this._ptr.delete(e.pointerId);
        if (this._ptr.size < 2) pinch = null;
        if (this._ptr.size || !start) return;
        const dx = p.x - start.x, dy = p.y - start.y, s0 = start; start = null;
        if (e.type === 'pointercancel') return;
        if (this._z.s <= 1.01 && Math.abs(dx) > SWIPE && Math.abs(dx) > Math.abs(dy) * 1.4) { this._go(dx < 0 ? 1 : -1); return; } // deslizar: otra cámara
        if (moved) return;
        const now = Date.now();
        if (now - lastTap < 300) { lastTap = 0; if (this._z.s > 1.01) this._resetZoom(); else this._zoomAt(s0, 2.5); this._ui(true); return; } // doble toque: zoom
        lastTap = now;
        this._ui(!this._wrap.classList.contains('ui')); // un toque: muestra o esconde los controles
      };
      st.addEventListener('pointerup', up);
      st.addEventListener('pointercancel', up);
      st.addEventListener('wheel', (e) => { if (this._clip) return; e.preventDefault(); this._zoomAt(this._pt(e), this._z.s * (e.deltaY < 0 ? 1.2 : 1 / 1.2)); }, { passive: false });
      st.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse' && !this._ptr.size) this._ui(true); });
    }
    _onClick(e) {
      const b = e.target.closest && e.target.closest('[data-a]');
      if (!b) return;
      e.stopPropagation();
      const a = b.dataset.a;
      if (a === 'prev') this._go(-1);
      else if (a === 'next') this._go(1);
      else if (a === 'full') this._toggleFs();
      else if (a === 'mute') { this._muted = !this._muted; this._show(); } // el audio se pide al conectar: se vuelve a conectar con o sin sonido
      else if (a === 'live') this._show();
      else if (a === 'rec') this._openRec();
      else if (a === 'tab') { this._tab = b.dataset.v; this._paintPanel(); }
      else if (a === 'ev') this._playEvent(b.dataset.id);
      else if (a === 'more') this._loadEvents(true);
      else if (a === 'day') { this._day = b.dataset.v; this._paintPanel(); }
      else if (a === 'hour') this._playHour(b.dataset.d, b.dataset.h);
      this._ui(true);
    }

    /* ───────── pantalla completa ───────── */
    _isFs() { return this.classList.contains('fs') || document.fullscreenElement === this; }
    _syncFs() {
      // de costado si el equipo está parado (así la cámara, que es apaisada, ocupa toda la pantalla)
      if (this.classList.contains('fs')) this.classList.toggle('rot', window.innerHeight > window.innerWidth);
      this._resetZoom(); this._paintChrome();
    }
    async _toggleFs() {
      if (document.fullscreenElement === this) { try { await document.exitFullscreen(); } catch (_) { /* ya */ } return; }
      if (this.classList.contains('fs')) { this._leavePseudoFs(); return; }
      // la pantalla completa de verdad (Android, PC, iPad); en el iPhone no existe para una página: se arma una propia
      if (this.requestFullscreen && !IOS) {
        try { await this.requestFullscreen(); try { if (screen.orientation && screen.orientation.lock) await screen.orientation.lock('landscape'); } catch (_) { /* no se puede fijar */ } return; } catch (_) { /* sigue con la propia */ }
      }
      this._enterPseudoFs();
    }
    _enterPseudoFs() {
      // se pasa a colgar de <body>: adentro de una tarjeta con efectos, «ocupar toda la pantalla» no sale de la tarjeta
      this._home = { parent: this.parentNode, next: this.nextSibling };
      this._moving = true;
      document.body.appendChild(this);
      this._moving = false;
      this.classList.add('fs');
      this._syncFs();
      if (!this._stream && !this._clip) this._show();
    }
    _leavePseudoFs() {
      this.classList.remove('fs', 'rot');
      const h = this._home; this._home = null;
      this._moving = true;
      if (h && h.parent && h.parent.isConnected) h.parent.insertBefore(this, h.next && h.next.parentNode === h.parent ? h.next : null); else this.remove();
      this._moving = false;
      this._syncFs();
    }

    /* ───────── Frigate: eventos y grabaciones ───────── */
    /** ¿Esta cámara es de Frigate? Devuelve { client, name } (y lo recuerda) o false. */
    async _frigate(id) {
      if (id in this._fr) return this._fr[id];
      const h = this._hass, reg = h && h.entities && h.entities[id];
      if (!reg || reg.platform !== 'frigate' || !h.callWS) return (this._fr[id] = false);
      let name = null;
      try { const e = await h.callWS({ type: 'config/entity_registry/get', entity_id: id }); const m = String((e && e.unique_id) || '').match(/:camera:([^:]+)$/); name = m && m[1]; } catch (_) { /* sin permiso */ }
      if (!name) name = id.replace(/^camera\./, '');
      const st = this._state(id);
      return (this._fr[id] = { client: (st && st.attributes && st.attributes.client_id) || 'frigate', name });
    }
    async _ws(msg) { const r = await this._hass.callWS(msg); return typeof r === 'string' ? JSON.parse(r) : r; }
    async _sign(path) { const r = await this._hass.callWS({ type: 'auth/sign_path', path, expires: 3600 }); return this._abs(r.path); }
    _openRec() {
      if (this._cfg.mode === 'page') { this.$('pn').scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
      // en el inicio la tarjeta es chica: los eventos se ven en la ventana «Cámaras», con esta cámara
      if (document.fullscreenElement === this) { try { document.exitFullscreen(); } catch (_) { /* ya */ } }
      if (this.classList.contains('fs')) this._leavePseudoFs();
      this.dispatchEvent(new CustomEvent('mae-cam-open', { detail: { camera: this._cam() }, bubbles: true, composed: true }));
    }
    async _paintPanel() {
      const pn = this.$('pn'), id = this._cam(), fr = await this._frigate(id);
      if (id !== this._cam()) return;
      if (this._cfg.mode !== 'page' || !fr) { pn.hidden = true; pn.innerHTML = ''; return; }
      pn.hidden = false;
      const head = `<div class="tabs"><button data-a="tab" data-v="ev" class="${this._tab === 'ev' ? 'on' : ''}">Eventos</button><button data-a="tab" data-v="hr" class="${this._tab === 'hr' ? 'on' : ''}">Grabaciones</button></div>`;
      if (this._evCam !== id) { this._evCam = id; this._evs = null; this._sum = null; this._day = null; }
      if (this._tab === 'ev') {
        pn.innerHTML = `${head}<div id="pb">${this._evs ? this._eventsHTML() : '<p class="hint">Buscando eventos…</p>'}</div>`;
        if (!this._evs) this._loadEvents(false);
      } else {
        pn.innerHTML = `${head}<div id="pb">${this._sum ? this._hoursHTML() : '<p class="hint">Buscando grabaciones…</p>'}</div>`;
        if (!this._sum) this._loadSummary();
      }
    }
    _when(ts) {
      const d = new Date(ts * 1000), now = new Date(), day = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
      const diff = Math.round((day(now) - day(d)) / 864e5), hm = d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
      return `${diff === 0 ? 'Hoy' : diff === 1 ? 'Ayer' : d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })} ${hm}`;
    }
    _eventsHTML() {
      const L = this._evs || [];
      if (!L.length) return '<p class="hint">Esta cámara no tiene eventos guardados.</p>';
      return `<div class="evs">${L.map((e) => {
        const dur = e.end_time && e.start_time ? Math.max(1, Math.round(e.end_time - e.start_time)) : 0;
        return `<button class="ev${this._clip && this._clip.id === e.id ? ' on' : ''}" data-a="ev" data-id="${esc(e.id)}"><img loading="lazy" alt="" data-th="${esc(e.id)}"><span><b>${esc(LABELS[e.label] || e.label || 'Movimiento')}</b><small>${esc(this._when(e.start_time))}${dur ? ` · ${dur < 60 ? `${dur} s` : `${Math.round(dur / 60)} min`}` : ''}</small></span></button>`;
      }).join('')}</div>${this._evMore ? '<button class="more" data-a="more">Ver más</button>' : ''}`;
    }
    async _loadEvents(more) {
      const id = this._cam(), fr = await this._frigate(id); if (!fr) return;
      const PAGE = 12, cur = more && this._evs ? this._evs : [];
      const q = { type: 'frigate/events/get', instance_id: fr.client, cameras: [fr.name], limit: PAGE, has_clip: true };
      if (cur.length) q.before = Math.floor(cur[cur.length - 1].start_time);
      let list = [];
      try { list = (await this._ws(q)) || []; } catch (e) { if (id === this._cam()) { const pb = this.shadowRoot.getElementById('pb'); if (pb && this._tab === 'ev') pb.innerHTML = `<p class="hint">No se pudieron leer los eventos (${esc(e.message || e.code || 'error')}).</p>`; } return; }
      if (id !== this._cam()) return;
      this._evs = cur.concat(list.filter((e) => !cur.some((x) => x.id === e.id)));
      this._evMore = list.length >= PAGE;
      const pb = this.shadowRoot.getElementById('pb');
      if (pb && this._tab === 'ev') { pb.innerHTML = this._eventsHTML(); this._thumbs(fr); }
    }
    /** Las miniaturas piden permiso a la casa (dirección firmada) recién cuando se dibujan; de a pocas. */
    _thumbs(fr) {
      this.shadowRoot.querySelectorAll('img[data-th]').forEach((im) => {
        if (im.dataset.ok) return; im.dataset.ok = '1';
        this._sign(`/api/frigate/${fr.client}/thumbnail/${im.dataset.th}`).then((u) => { im.src = u; }).catch(() => { /* sin miniatura */ });
      });
    }
    async _media(contentId) {
      const r = await this._hass.callWS({ type: 'media_source/resolve_media', media_content_id: contentId, expires: 3600 });
      return { url: this._abs(r.url), hls: /mpegurl/i.test(r.mime_type || '') || /\.m3u8(\?|$)/.test(r.url || '') };
    }
    async _play(media, title, id) {
      this._tok = (this._tok || 0) + 1;
      this._drop(); this._resetZoom();
      this._clip = { title, id };
      this.$('po').classList.add('off'); this.$('ld').classList.add('off'); this.$('ms').textContent = '';
      const z = this.$('zo');
      if (media.hls) {
        if (!(await this._players())) return;
        const el = document.createElement('ha-hls-player');
        el.controls = true; el.muted = false; el.autoPlay = true; el.playsInline = true; el.hass = this._hass; el.url = media.url;
        z.appendChild(el); this._hls = el;
      } else {
        const v = document.createElement('video');
        v.controls = true; v.autoplay = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.src = media.url;
        z.appendChild(v); this._vid = v;
      }
      this._paintChrome(); this._ui(true);
      this.$('st').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    async _playEvent(evId) {
      const fr = await this._frigate(this._cam()), e = (this._evs || []).find((x) => x.id === evId); if (!fr || !e) return;
      const title = `${LABELS[e.label] || e.label || 'Evento'} · ${this._when(e.start_time)}`;
      try { await this._play(await this._media(`media-source://frigate/${fr.client}/event/clips/${fr.name}/${evId}`), title, evId); } catch (_) {
        // sin «media source»: el clip directo de Frigate
        try { await this._play({ url: await this._sign(`/api/frigate/${fr.client}/notifications/${evId}/clip.mp4`), hls: false }, title, evId); } catch (e2) { this.$('ms').textContent = 'No se pudo abrir la grabación de ese evento.'; }
      }
      this.shadowRoot.querySelectorAll('.ev').forEach((b) => b.classList.toggle('on', b.dataset.id === evId));
    }
    async _loadSummary() {
      const id = this._cam(), fr = await this._frigate(id); if (!fr) return;
      let sum = [];
      try { sum = (await this._ws({ type: 'frigate/recordings/summary', instance_id: fr.client, camera: fr.name, timezone: (this._hass.config && this._hass.config.time_zone) || 'UTC' })) || []; } catch (e) { sum = null; }
      if (id !== this._cam()) return;
      this._sum = sum || [];
      const pb = this.shadowRoot.getElementById('pb');
      if (pb && this._tab === 'hr') pb.innerHTML = sum ? this._hoursHTML() : '<p class="hint">No se pudieron leer las grabaciones.</p>';
    }
    _hoursHTML() {
      const days = (this._sum || []).filter((d) => d && d.day && (d.hours || []).length).slice(0, 14);
      if (!days.length) return '<p class="hint">Esta cámara no tiene grabaciones guardadas.</p>';
      const day = days.find((d) => d.day === this._day) || days[0];
      this._day = day.day;
      const dname = (s) => { const d = new Date(`${s}T12:00:00`), t = new Date(); const diff = Math.round((new Date(t.getFullYear(), t.getMonth(), t.getDate()) - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 864e5); return diff === 0 ? 'Hoy' : diff === 1 ? 'Ayer' : d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric' }); };
      const hours = day.hours.slice().sort((a, b) => Number(b.hour) - Number(a.hour));
      return `<div class="chips">${days.map((d) => `<button class="chip${d.day === day.day ? ' on' : ''}" data-a="day" data-v="${esc(d.day)}">${esc(dname(d.day))}</button>`).join('')}</div>
        <div class="hours">${hours.map((h) => `<button class="hr${this._clip && this._clip.id === `${day.day}/${h.hour}` ? ' on' : ''}" data-a="hour" data-d="${esc(day.day)}" data-h="${esc(h.hour)}"><b>${esc(String(h.hour).padStart(2, '0'))}:00</b><small>${h.events ? `${h.events} evento${h.events === 1 ? '' : 's'}` : 'sin eventos'}</small></button>`).join('')}</div>`;
    }
    async _playHour(day, hour) {
      const fr = await this._frigate(this._cam()); if (!fr) return;
      const hh = String(hour).padStart(2, '0');
      try { await this._play(await this._media(`media-source://frigate/${fr.client}/recordings/${fr.name}/${day}/${hh}`), `Grabación · ${day.slice(8, 10)}/${day.slice(5, 7)} ${hh}:00`, `${day}/${hour}`); } catch (e) { this.$('ms').textContent = 'No se pudo abrir esa grabación.'; }
      this.shadowRoot.querySelectorAll('.hr').forEach((b) => b.classList.toggle('on', b.dataset.d === day && b.dataset.h === String(hour)));
    }
  }
  customElements.define('mae-cam', MaeCam);
})();
