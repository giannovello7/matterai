/*
 * MatterAI · Tarjeta «Dashboard MatterAI» para Home Assistant (custom:matterai-dashboard).
 *
 * Muestra adentro de Home Assistant (la app de Home Assistant o el navegador) el mismo dashboard que ve la app
 * MatterAI: el que se arma en el editor del panel MatterAI. Pensada para los clientes que ya usan la app de Home
 * Assistant y no queremos hacerles cambiar de app.
 *
 *   type: custom:matterai-dashboard
 *   view: <id>        (opcional) un dashboard fijo; si no, el que tiene asignado el usuario, o el general de la casa
 *   kind: auto        (opcional) auto | phone | tablet: diseño de celular o de tablet (auto: según el ancho)
 *
 * Va mejor sola en un panel en modo «panel» (ocupa toda la pantalla). Por dentro es una página aparte (un marco):
 * el mismo motor que la app (vista.js), la tarjeta MatterAI sin dibujarse (abre ambientes, clima, música…), y la
 * tarjeta de cámaras propia (camaras.js). Así los estilos de Home Assistant no la desacomodan.
 * Cuando el instalador guarda un dashboard, se redibuja sola.
 */
(function () {
  'use strict';
  if (typeof customElements === 'undefined' || customElements.get('matterai-dashboard')) return;
  const BASE = new URL('.', (document.currentScript && document.currentScript.src) || `${location.origin}/matterai_static/`).href.replace(/\/$/, '');
  const ROOT = BASE.includes('/matterai_static') ? BASE : `${location.origin}/matterai_static`;
  const PHONE_MAX = 720; // más angosto que esto, diseño de celular

  class MatteraiDashboard extends HTMLElement {
    constructor() {
      super();
      this._cfg = {}; this._hass = null; this._ifr = null; this._v = null; this._view = undefined; this._kind = null; this._unsub = null;
      this.attachShadow({ mode: 'open' }).innerHTML = `<style>
        :host{display:block;position:relative;width:100%;height:var(--mae-dash-h,calc(100vh - var(--header-height,56px)));min-height:420px;overflow:hidden;background:#0b0e12}
        iframe{position:absolute;inset:0;width:100%;height:100%;border:0;display:block;background:transparent}
        .msg{position:absolute;inset:0;display:grid;place-items:center;padding:24px;text-align:center;color:#c4cad6;font:14px system-ui,sans-serif}
      </style><div class="msg" id="msg">Cargando el dashboard…</div>`;
      this._onResize = () => this._checkKind();
    }

    static getStubConfig() { return { kind: 'auto' }; }
    setConfig(c) {
      this._cfg = Object.assign({ kind: 'auto' }, c || {});
      if (this._cfg.height) this.style.setProperty('--mae-dash-h', String(this._cfg.height));
      if (this._hass) { this._resub(); this._push(); }
    }
    getCardSize() { return 12; }
    getGridOptions() { return { columns: 'full', rows: 'auto' }; } // en vistas de secciones, de lado a lado

    set hass(h) {
      const first = !this._hass;
      this._hass = h;
      if (first) { this._boot(); return; }
      this._push();
    }
    get hass() { return this._hass; }

    connectedCallback() {
      window.addEventListener('resize', this._onResize);
      if (this._hass && !this._unsub) this._resub();
    }
    disconnectedCallback() {
      window.removeEventListener('resize', this._onResize);
      this._stop();
    }

    /* ───────── qué diseño (celular o tablet) ───────── */
    _wantKind() {
      const k = this._cfg.kind;
      if (k === 'phone' || k === 'tablet') return k;
      const w = this.getBoundingClientRect().width || window.innerWidth;
      return w && w < PHONE_MAX ? 'phone' : 'tablet';
    }
    _checkKind() {
      const k = this._wantKind();
      if (k === this._kind) return;
      this._kind = k;
      if (this._v) this._v.setCtx({ kind: k });
      this._resub();
    }

    /* ───────── la casa: qué dashboard, y avisos cuando cambia ───────── */
    _stop() { if (this._unsub) { const u = this._unsub; this._unsub = null; Promise.resolve(u).then((f) => { try { f(); } catch (_) { /* ya */ } }, () => undefined); } }
    _resub() {
      this._stop();
      const h = this._hass; if (!h || !h.connection) return;
      const msg = { type: 'matterai/ha/view', kind: this._kind || this._wantKind() };
      if (this._cfg.view) msg.view_id = String(this._cfg.view);
      this._unsub = h.connection.subscribeMessage((ev) => {
        this._view = (ev && ev.view) || null;
        if (this._v) this._v.setView(this._view);
      }, msg).catch((e) => { this._msg(`La integración MatterAI de esta casa no tiene esta función (${(e && (e.message || e.code)) || 'error'}). Actualizala desde HACS.`); return null; });
    }

    _msg(t) { const m = this.shadowRoot.getElementById('msg'); if (m) { m.textContent = t; m.hidden = !t; } }

    /* ───────── la página de adentro ───────── */
    async _boot() {
      this._kind = this._wantKind();
      this._resub();
      let cfg = {};
      try { cfg = (await this._hass.callWS({ type: 'matterai/config' })).config || {}; } catch (_) { cfg = {}; }
      this._houseCfg = cfg;
      const ifr = this._ifr = document.createElement('iframe');
      ifr.title = 'Dashboard MatterAI';
      ifr.setAttribute('allow', 'fullscreen; autoplay; microphone');
      ifr.setAttribute('allowfullscreen', '');
      const v = Date.now().toString(36);
      ifr.srcdoc = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Red+Hat+Display:wght@400;500;600;700&family=Red+Hat+Mono:wght@400;500&display=swap">
        <link rel="stylesheet" href="${ROOT}/vista.css?v=${v}">
        <style>html,body{margin:0;background:#161b21;min-height:100%}html{-webkit-text-size-adjust:100%}
          .mae-camp{position:fixed;inset:0;z-index:70;display:flex;flex-direction:column;background:#0b0e12;color:#e9ecf2;font-family:"Red Hat Display",system-ui,sans-serif}
          .mae-camp header{display:flex;align-items:center;gap:10px;padding:12px 14px}.mae-camp header b{font-size:17px}
          .mae-camp header button{width:38px;height:38px;border:0;border-radius:50%;background:rgba(255,255,255,.1);color:inherit;font-size:20px;cursor:pointer}
          .mae-camp .body{flex:1;overflow:auto;padding:0 14px 20px;max-width:980px;width:100%;margin:0 auto;box-sizing:border-box}</style></head>
        <body><div id="pv"></div>
        <script src="${ROOT}/matterai-home-card.js?v=${v}"><\/script><script src="${ROOT}/vista.js?v=${v}"><\/script><script src="${ROOT}/camaras.js?v=${v}"><\/script></body></html>`;
      ifr.onload = () => this._start();
      this.shadowRoot.appendChild(ifr);
    }

    _start() {
      const W = this._ifr && this._ifr.contentWindow;
      if (!W || !W.MaeVista) { this._msg('No se pudo cargar el dashboard (recargá la página).'); return; }
      const D = W.document, h = this._hass, cfg = this._houseCfg || {};
      // la tarjeta MatterAI sin dibujarse: da el modelo de la casa y abre sus ventanas (ambiente, clima, música…)
      let pc = null;
      const PC = W.customElements.get('matterai-home-card');
      if (PC) {
        try {
          pc = D.createElement('matterai-home-card');
          pc.setAttribute('headless', '');
          pc.setConfig(Object.assign({}, cfg, { camera_inline: false }));
          D.body.appendChild(pc);
          pc.hass = h;
          pc.addEventListener('matterai-model', () => { if (this._v) this._v.render(); });
        } catch (e) { pc = null; }
      }
      this._pc = pc;
      this._camHooks(W, D, cfg);
      // lo que la tarjeta MatterAI le pide a la app: acá lo hace Home Assistant
      const host = this;
      D.addEventListener('matterai-menu', () => host.dispatchEvent(new CustomEvent('hass-toggle-menu', { bubbles: true, composed: true })));
      D.addEventListener('matterai-camera-card', (e) => { e.preventDefault(); const s = W.__maeCamStart; W.__maeCamStart = null; W.__maeOpenCams(s); });
      this._v = W.MaeVista.create(D.getElementById('pv'), {
        card: pc, hass: () => this._hass, base: () => '', kind: this._kind,
        toast: (t) => host.dispatchEvent(new CustomEvent('hass-notification', { detail: { message: t }, bubbles: true, composed: true })),
        // la ventana de un equipo: la de Home Assistant
        openEntity: (id) => host.dispatchEvent(new CustomEvent('hass-more-info', { detail: { entityId: id }, bubbles: true, composed: true })),
        openMenu: () => host.dispatchEvent(new CustomEvent('hass-toggle-menu', { bubbles: true, composed: true })),
        sign: async (path) => (await this._hass.callWS({ type: 'auth/sign_path', path, expires: 7200 })).path,
      });
      if (this._view !== undefined) this._v.setView(this._view);
      this._msg('');
    }

    /** La tarjeta de cámaras propia (camaras.js), como en la app: en el inicio y en una ventana «Cámaras». */
    _camHooks(W, D, cfg) {
      const fitOf = (id) => {
        const c = ((cfg.camera_card && cfg.camera_card.cameras) || []).find((x) => x && x.camera_entity === id);
        const f = c && c.dimensions && c.dimensions.layout && c.dimensions.layout.fit;
        return ['contain', 'cover', 'fill'].includes(f) ? f : null;
      };
      const camsOf = () => {
        const S = (this._hass && this._hass.states) || {};
        let ids = [];
        try { const m = this._pc && this._pc.model && this._pc.model(); if (m && Array.isArray(m.cams)) ids = m.cams.slice(); } catch (_) { ids = []; }
        ((cfg.camera_card && cfg.camera_card.cameras) || []).forEach((x) => { if (x && x.camera_entity && !ids.includes(x.camera_entity)) ids.push(x.camera_entity); });
        if (!ids.length) ids = Object.keys(S).filter((id) => id.startsWith('camera.'));
        return ids.filter((id) => S[id]);
      };
      W.__maeLiveCam = (ids) => {
        if (!W.customElements.get('mae-cam')) return null;
        const el = D.createElement('mae-cam');
        el.setConfig({ mode: 'card', cameras: (ids || []).map((id) => ({ entity: id, fit: fitOf(id) || 'cover' })) });
        el.hass = this._hass;
        this._cams = (this._cams || []).filter((x) => x.isConnected).concat([el]);
        return el;
      };
      W.__maeOpenCams = (start) => {
        const ids = camsOf(); if (!ids.length || !W.customElements.get('mae-cam')) return false;
        this._closeCams();
        if (this._v && this._v.pauseLive) this._v.pauseLive(true); // un solo video a la vez
        const box = D.createElement('div');
        box.className = 'mae-camp';
        box.innerHTML = '<header><button aria-label="Volver">‹</button><b>Cámaras</b></header><div class="body"></div>';
        const el = D.createElement('mae-cam');
        el.setConfig({ mode: 'page', start: start && ids.includes(start) ? start : ids[0], cameras: ids.map((id) => ({ entity: id, fit: fitOf(id) || 'contain' })) });
        el.hass = this._hass;
        box.querySelector('.body').appendChild(el);
        box.querySelector('button').onclick = () => this._closeCams();
        D.body.appendChild(box);
        this._camPage = { box, el };
        return true;
      };
      D.addEventListener('mae-cam-open', (e) => W.__maeOpenCams(e.detail && e.detail.camera));
    }
    _closeCams() {
      const p = this._camPage; this._camPage = null;
      if (!p) return;
      p.box.remove();
      if (this._v && this._v.pauseLive) this._v.pauseLive(false);
    }

    /** Cada cambio de la casa le llega a todo lo de adentro. */
    _push() {
      const h = this._hass;
      if (this._pc) this._pc.hass = h;
      if (this._camPage) this._camPage.el.hass = h;
      (this._cams || []).forEach((el) => { if (el.isConnected) el.hass = h; });
      if (this._v) this._v.render();
    }
  }

  customElements.define('matterai-dashboard', MatteraiDashboard);
  window.customCards = window.customCards || [];
  if (!window.customCards.some((c) => c.type === 'matterai-dashboard')) {
    window.customCards.push({ type: 'matterai-dashboard', name: 'Dashboard MatterAI', description: 'El dashboard de la app MatterAI (el que armás en el editor del panel MatterAI), adentro de Home Assistant.', preview: false });
  }
})();
