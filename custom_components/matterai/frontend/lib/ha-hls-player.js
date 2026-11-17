/* MatterAI · reproductor HLS compatible con el <ha-hls-player> de Home Assistant.
 * La Advanced Camera Card lo extiende para ver grabaciones y eventos de Frigate:
 * ella dibuja el <video> (render) y nosotros ponemos el video a andar (updated → _start).
 *  - Celulares (iPhone / Android): HLS nativo del navegador → no necesita permisos CORS.
 *  - PC: hls.js → Home Assistant tiene que permitir el origen de la app (http: cors_allowed_origins).
 */
import { LitElement, html, css } from './vendor/lit-core.min.js';
import Hls from './vendor/hls.min.js'; // (en la integración va como .js: Home Assistant no siempre manda los .mjs como JavaScript)

const camLog = (m) => { try { if (typeof window !== 'undefined' && window.__maeCamLog) window.__maeCamLog(m); } catch (_) { /* nada */ } };

class MaeHlsPlayer extends LitElement {
  static get properties() {
    return {
      hass: { attribute: false },
      url: { type: String },
      posterUrl: { type: String },
      entityid: { type: String },
      controls: { type: Boolean },
      muted: { type: Boolean },
      autoPlay: { type: Boolean },
      playsInline: { type: Boolean },
      allowExoPlayer: { type: Boolean },
      _error: { state: true },
      _errorIsFatal: { state: true },
    };
  }

  static get styles() {
    return css`:host{display:block;position:relative;height:var(--mae-video-h,auto)}video{display:block;width:100%;height:100%;max-height:var(--video-max-height,100vh);object-fit:var(--mae-video-fit,contain);background:#000}`;
  }

  constructor() {
    super();
    this.controls = false; this.muted = false; this.autoPlay = false; this.playsInline = false; this.allowExoPlayer = false;
    this._hls = null;
  }

  render() {
    return html`<video id="video" .poster=${this.posterUrl} ?autoplay=${this.autoPlay} .muted=${this.muted}
      ?playsinline=${this.playsInline} ?controls=${this.controls} @loadeddata=${() => this._loadedData()}></video>`;
  }

  get _videoEl() { return this.renderRoot && this.renderRoot.querySelector('video'); }

  connectedCallback() {
    super.connectedCallback();
    if (this.hasUpdated && this.url) this._start(); else if (this.hasUpdated && this.entityid) this.__soon();
  }

  /** En vivo: arranca en un momento, si la cámara sigue en pantalla (pasando rápido de cámara no se pide nada). */
  __soon() {
    clearTimeout(this._startT);
    this._startT = setTimeout(() => { this._startT = undefined; if (this.isConnected && this.entityid && !this.url) this._start(); }, 400);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    clearTimeout(this._startT); this._startT = undefined;
    this._cleanUp();
  }

  updated(changed) {
    super.updated(changed);
    // con dirección (grabaciones) o, como el de Home Assistant, sólo con la cámara: pide el video HLS (camera/stream)
    // (con hass sólo si la cámara había llegado antes que hass; nunca con cada cambio de la casa: si el pedido había
    // fallado, eso lo repetía sin parar)
    if (changed.has('url')) this._start();
    else if (changed.has('entityid') && !this.url) { this._cleanUp(); this.__soon(); }
    else if (changed.has('hass') && this.hass && this._needStart && !this._startT) this._start();
  }

  /** El video ya tiene datos: avisa si tiene video y audio (como Home Assistant: «streams»). La tarjeta lo extiende. */
  _loadedData() {
    const v = this._videoEl;
    const hasAudio = !!(v && ((v.audioTracks && v.audioTracks.length) || v.mozHasAudio || v.webkitAudioDecodedByteCount));
    if (!this.url) camLog(`hls ${this.entityid}: con imagen`);
    this.dispatchEvent(new CustomEvent('streams', { detail: { hasAudio, hasVideo: true } }));
  }

  _cleanUp() {
    if (this._hls) { try { this._hls.destroy(); } catch (_) { /* noop */ } this._hls = null; }
    const v = this._videoEl;
    if (v) { v.removeAttribute('src'); try { v.load(); } catch (_) { /* noop */ } }
  }

  _absUrl(u) {
    if (!u || /^[a-z]+:\/\//i.test(u)) return u;
    return this.hass && typeof this.hass.hassUrl === 'function' ? this.hass.hassUrl(u) : u;
  }

  _fail(msg) { this._error = msg; this._errorIsFatal = true; }

  async _start() {
    this._cleanUp();
    this._error = undefined; this._errorIsFatal = false;
    let src = this.url;
    this._needStart = !src && !!this.entityid && !(this.hass && this.hass.callWS); // sin hass todavía: se arranca cuando llegue
    if (!src && this.entityid && this.hass && this.hass.callWS) {
      camLog(`hls ${this.entityid}: pide el video`);
      const ent = this.entityid;
      this._asking = true;
      try { const r = await this.hass.callWS({ type: 'camera/stream', entity_id: ent, format: 'hls' }); src = this._streamUrl = r && r.url; } catch (e) {
        this._asking = false;
        this._fail(`No se pudo pedir el video de la cámara (${(e && (e.message || e.code)) || 'error'})`);
        camLog(`hls ${ent}: la casa no lo dio (${String((e && (e.message || e.code)) || 'error').slice(0, 60)})`);
        this.dispatchEvent(new CustomEvent('streams', { detail: { hasAudio: false, hasVideo: false } }));
        return;
      }
      this._asking = false;
      if (this.entityid !== ent || this.url) return;
    }
    if (!src) return;
    await this.updateComplete;
    const v = this._videoEl;
    if (!v) return;
    const url = this._absUrl(src);
    // en vivo: si el video no se puede reproducir, se avisa (una vez) para que la cámara no quede en negro
    if (!this.url && !v.__maeErr) {
      v.__maeErr = true;
      v.addEventListener('error', () => { if (this.url || !v.error) return; camLog(`hls ${this.entityid}: error de video ${v.error.code}`); this.dispatchEvent(new CustomEvent('streams', { detail: { hasAudio: false, hasVideo: false } })); });
    }
    const native = !!v.canPlayType('application/vnd.apple.mpegurl');
    if (native || !Hls.isSupported()) {
      // iPhone / Android: el navegador reproduce HLS solo (sin CORS).
      v.src = url;
    } else {
      const hls = this._hls = new Hls({
        backBufferLength: 60, maxBufferLength: 30, maxMaxBufferLength: 60,
        manifestLoadingTimeOut: 30000, levelLoadingTimeOut: 30000, fragLoadingTimeOut: 60000,
      });
      let mediaRetries = 0;
      hls.on(Hls.Events.ERROR, (_e, d) => {
        if (!d.fatal) return;
        if (d.type === Hls.ErrorTypes.MEDIA_ERROR && mediaRetries++ < 2) { hls.recoverMediaError(); return; }
        const cors = d.type === Hls.ErrorTypes.NETWORK_ERROR && (!d.response || !d.response.code);
        this._fail(cors
          ? 'No se pudo cargar la grabación. En la PC, Home Assistant tiene que permitir la dirección de la app (cors_allowed_origins).'
          : `No se pudo reproducir la grabación (${d.details}).`);
        this._cleanUp();
      });
      hls.attachMedia(v);
      hls.on(Hls.Events.MEDIA_ATTACHED, () => hls.loadSource(url));
    }
    if (this.autoPlay) v.play().catch(() => { /* el navegador puede pedir un toque primero */ });
  }
}

if (!customElements.get('ha-hls-player')) customElements.define('ha-hls-player', MaeHlsPlayer);
export default MaeHlsPlayer;
