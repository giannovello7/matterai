/* MatterAI · <ha-camera-stream> y <ha-web-rtc-player> compatibles con los de Home Assistant.
 *
 * Fuera de Home Assistant (la app) esos elementos no existen, y la Advanced Camera Card (el visor de Frigate) los
 * extiende para su modo «ha» (live_provider: ha). Esta es una versión de los de la web de Home Assistant
 * (home-assistant/frontend: src/components/ha-camera-stream.ts y ha-web-rtc-player.ts, licencia Apache-2.0), con los
 * mismos nombres internos que el visor usa: _startWebRtc, _cleanUp, _videoEl, _addTrack, _loadedData, _peerConnection,
 * _remoteStream, _error; y en la cámara: _capabilities, _hlsStreams, _webRtcStreams, _posterUrl, _streams(), _renderStream().
 *
 * WebRTC como Home Assistant: camera/webrtc/get_client_config → RTCPeerConnection → audio y video sólo de recepción →
 * la oferta por camera/webrtc/offer (suscripción: session, answer, candidate, error) → los candidatos propios por
 * camera/webrtc/candidate. Entre WebRTC y HLS: WebRTC, y HLS sólo si WebRTC no da imagen (Home Assistant arranca los dos
 * y se queda con WebRTC). Igual en todos los equipos.
 */
import { LitElement, html, css, nothing } from './vendor/lit-core.min.js';

const HIDDEN_CLEANUP_DELAY = 60000; // como Home Assistant: escondida 1 minuto, se corta

/* Los mismos tiempos que Home Assistant: sin respuesta de la casa en 20 s, o sin camino de video en 30 s, la conexión
   se da por fallida y se avisa a la cámara (que muestra HLS). No se reintenta: Home Assistant tampoco, «a retry would
   most likely end the same way». */
const ANSWER_TIMEOUT = 20000, ICE_TIMEOUT = 30000;
/* El video arranca un momento después de que la cámara queda en pantalla. Pasando rápido por varias cámaras, las que se
   pasan de largo se sacan antes de ese momento y NO llegan a abrir ninguna conexión. Sin esto, cuatro cámaras en cinco
   segundos abrían y cerraban ocho conexiones de video seguidas y Safari de iPhone cerraba la página (visto en el iPhone
   del usuario, 2026-11-16, con un solo video en pantalla). */
const START_DELAY = 400;
const IOS_SNAP = typeof navigator !== 'undefined' && (/iPhone|iPad|iPod/.test(navigator.userAgent || '') || (/Macintosh/.test(navigator.userAgent || '') && navigator.maxTouchPoints > 1));
const camLog = (m) => { try { if (typeof window !== 'undefined' && window.__maeCamLog) window.__maeCamLog(m); } catch (_) { /* nada */ } };

class MaeWebRtcPlayer extends LitElement {
  static get properties() {
    return {
      hass: { attribute: false },
      entityid: { type: String },
      controls: { type: Boolean },
      muted: { type: Boolean },
      autoPlay: { type: Boolean, attribute: 'autoplay' },
      playsInline: { type: Boolean, attribute: 'playsinline' },
      posterUrl: { type: String, attribute: 'poster-url' },
      aspectRatio: { type: Number },
      fitMode: { type: String },
      _error: { state: true },
    };
  }

  static get styles() {
    return css`:host,video{display:block}:host{height:var(--mae-video-h,auto)}video{width:100%;height:var(--mae-video-h,auto);object-fit:var(--mae-video-fit,contain);max-height:var(--video-max-height,calc(100vh - 97px));background:#000}`;
  }

  constructor() {
    super();
    this.controls = false; this.muted = false; this.autoPlay = false; this.playsInline = false;
    this._peerConnection = undefined; this._remoteStream = undefined; this._unsub = undefined;
    this._sessionId = undefined; this._candidatesList = []; this._cleanUpCount = 0; this._hiddenTimer = undefined;
    // como en Home Assistant son propiedades (flechas): el visor de Frigate reemplaza _addTrack
    this._addTrack = async (event) => {
      if (!this._remoteStream) return;
      if (event.track.kind === 'audio' && this.muted) return;
      this._remoteStream.addTrack(event.track);
      if (!this.hasUpdated) await this.updateComplete;
      if (this._videoEl) this._videoEl.srcObject = this._remoteStream;
    };
    this._startNegotiation = () => this.__negotiate();
    this._handleIceCandidate = (event) => {
      if (!this.entityid || !event.candidate || !event.candidate.candidate) return;
      if (this._sessionId) this.__sendCandidate(this._sessionId, event.candidate.toJSON());
      else this._candidatesList.push(event.candidate);
    };
    this._iceConnectionStateChanged = () => {
      const pc = this._peerConnection, st = pc && pc.iceConnectionState;
      if (st === 'connected' || st === 'completed') this.__clearWait();
      else if (st === 'failed') this._failStart('sin camino de video');
    };
    this._visibilityChanged = () => {
      if (document.pictureInPictureElement) return;
      if (document.hidden) {
        if (!this._hiddenTimer) this._hiddenTimer = setTimeout(() => { this._hiddenTimer = undefined; this._cleanUp(); }, HIDDEN_CLEANUP_DELAY);
      } else if (this._hiddenTimer) { clearTimeout(this._hiddenTimer); this._hiddenTimer = undefined; } else if (!this._peerConnection) this._startWebRtc();
    };
  }

  get _videoEl() { return this.renderRoot ? this.renderRoot.querySelector('#remote-stream') : null; }

  render() {
    if (this._error) return html`<div class="error">${this._error}</div>`;
    return html`<video id="remote-stream" ?autoplay=${this.autoPlay} .muted=${this.muted} ?playsinline=${this.playsInline}
      ?controls=${this.controls} poster=${this.posterUrl || nothing} @loadeddata=${() => this._loadedData()}></video>`;
  }

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener('visibilitychange', this._visibilityChanged);
    if (this.hasUpdated && this.entityid) this.__soon();
  }

  /** Arranca en un momento, si para entonces la cámara sigue en pantalla (ver START_DELAY). */
  __soon() {
    clearTimeout(this._startT);
    this._startT = setTimeout(() => { this._startT = undefined; if (this.isConnected && this.entityid) this._startWebRtc(); }, START_DELAY);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    clearTimeout(this._startT); this._startT = undefined;
    document.removeEventListener('visibilitychange', this._visibilityChanged);
    if (this._hiddenTimer) { clearTimeout(this._hiddenTimer); this._hiddenTimer = undefined; }
    this._cleanUp();
  }

  willUpdate(changed) {
    // Como Home Assistant: arranca cuando cambia la cámara. Además, si la cámara llegó antes que hass (el visor los pasa
    // por separado), cuando llega hass. NUNCA con cada cambio de la casa: si la conexión había fallado, eso la volvía a
    // armar decenas de veces por minuto (una RTCPeerConnection nueva cada vez) hasta que iOS cerraba la página.
    if (changed.has('entityid') && this.entityid) { this._cleanUp(); this.__soon(); }
    else if (changed.has('hass') && this.hass && this._needStart && !this._startT) this._startWebRtc();
  }

  _api() { return this.hass; }

  async __sendCandidate(sessionId, candidate) {
    try { await this.hass.callWS({ type: 'camera/webrtc/candidate', entity_id: this.entityid, session_id: sessionId, candidate }); } catch (_) { /* como HA: se ignora */ }
  }

  _failStart(message) {
    this._error = message || 'No se pudo conectar con la cámara';
    camLog(`webrtc ${this.entityid}: falló (${String(this._error).slice(0, 80)})`);
    this._giveUp();
  }

  /** Como Home Assistant: se corta y se avisa a la cámara que este reproductor no tiene video. */
  _giveUp() {
    this._cleanUp();
    this.dispatchEvent(new CustomEvent('streams', { detail: { hasAudio: false, hasVideo: false } }));
  }

  __clearWait() { if (this._waitT) { clearTimeout(this._waitT); this._waitT = undefined; } }
  __wait(ms, pc) {
    this.__clearWait();
    this._waitT = setTimeout(() => { this._waitT = undefined; if (this._peerConnection === pc) this._failStart(`sin conexión en ${ms / 1000} s`); }, ms);
  }

  async _startWebRtc() {
    this._cleanUp();
    if (typeof RTCPeerConnection === 'undefined') { this._error = 'Este navegador no reproduce WebRTC'; this.dispatchEvent(new CustomEvent('streams', { detail: { hasAudio: false, hasVideo: false } })); return; }
    const h = this.hass;
    this._needStart = !h || !h.callWS || !h.connection; // sin hass todavía: se arranca cuando llegue
    if (this._needStart || !this.entityid || !this.isConnected) return;
    this._error = undefined;
    camLog(`webrtc ${this.entityid}: arranca`);
    const start = this._cleanUpCount;
    this._starting = true;
    let clientConfig;
    try { clientConfig = await h.callWS({ type: 'camera/webrtc/get_client_config', entity_id: this.entityid }); } catch (err) {
      this._starting = false;
      if (start === this._cleanUpCount) this._failStart(err && (err.message || err.code));
      return;
    }
    this._starting = false;
    if (start !== this._cleanUpCount) return;
    const pc = this._peerConnection = new RTCPeerConnection((clientConfig && clientConfig.configuration) || {});
    if (clientConfig && clientConfig.dataChannel) pc.createDataChannel(clientConfig.dataChannel);
    pc.onnegotiationneeded = this._startNegotiation;
    pc.onicecandidate = this._handleIceCandidate;
    pc.oniceconnectionstatechange = this._iceConnectionStateChanged;
    this._remoteStream = new MediaStream();
    pc.ontrack = this._addTrack;
    pc.addTransceiver('audio', { direction: 'recvonly' });
    pc.addTransceiver('video', { direction: 'recvonly' });
  }

  async __negotiate() {
    const pc = this._peerConnection;
    if (!pc) return;
    let offer;
    try {
      offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
      if (this._peerConnection !== pc) return;
      await pc.setLocalDescription(offer);
    } catch (err) { if (this._peerConnection === pc) this._failStart(err && err.message); return; }
    if (this._peerConnection !== pc || !this.entityid) return;
    let candidates = '';
    while (this._candidatesList.length) { const c = this._candidatesList.pop(); if (c) candidates += `a=${c.candidate}\r\n`; }
    const offerSdp = offer.sdp + candidates;
    const entity = this.entityid;
    if (this._unsub) { const u = this._unsub; this._unsub = undefined; u.then((f) => f(), () => undefined); } // reinicio de ICE: una sola suscripción
    this.__wait(ANSWER_TIMEOUT, pc);
    this._unsub = this.hass.connection.subscribeMessage((event) => this._handleOfferEvent(pc, event), { type: 'camera/webrtc/offer', entity_id: entity, offer: offerSdp });
    this._unsub.catch((err) => { if (this._peerConnection === pc) { this._unsub = undefined; this._failStart(err && (err.message || err.code)); } });
  }

  async _handleOfferEvent(pc, event) {
    if (pc !== this._peerConnection || !this.entityid || !event) return;
    if (event.type === 'session') {
      this._sessionId = event.session_id;
      this._candidatesList.forEach((c) => this.__sendCandidate(event.session_id, c.toJSON()));
      this._candidatesList = [];
    } else if (event.type === 'answer') {
      if (pc.iceConnectionState !== 'connected' && pc.iceConnectionState !== 'completed') this.__wait(ICE_TIMEOUT, pc);
      if (['stable', 'closed'].includes(pc.signalingState)) return;
      try { await pc.setRemoteDescription({ type: 'answer', sdp: event.answer }); } catch (err) { if (pc === this._peerConnection) this._failStart(err && err.message); }
    } else if (event.type === 'candidate') {
      const c = event.candidate || {};
      try { await pc.addIceCandidate(c.sdpMid || c.sdpMLineIndex != null ? c : { candidate: c.candidate, sdpMid: '0' }); } catch (_) { /* como HA: se ignora */ }
    } else if (event.type === 'error') {
      this._failStart(event.message);
    }
  }

  _loadedData() {
    const s = this._videoEl && this._videoEl.srcObject;
    const detail = { hasAudio: !!(s && s.getAudioTracks && s.getAudioTracks().length), hasVideo: !!(s && s.getVideoTracks && s.getVideoTracks().length) };
    this.__clearWait();
    camLog(`webrtc ${this.entityid}: con imagen`);
    this.dispatchEvent(new CustomEvent('load'));
    this.dispatchEvent(new CustomEvent('streams', { detail }));
  }

  _cleanUp() {
    this._cleanUpCount++;
    this.__clearWait();
    if (this._remoteStream) { this._remoteStream.getTracks().forEach((t) => { try { t.stop(); } catch (_) { /* ya */ } }); this._remoteStream = undefined; }
    const v = this._videoEl;
    if (v) { v.srcObject = null; v.removeAttribute('src'); try { v.load(); } catch (_) { /* ya */ } }
    const pc = this._peerConnection;
    if (pc) {
      try { pc.close(); } catch (_) { /* ya */ }
      pc.onnegotiationneeded = null; pc.onicecandidate = null; pc.oniceconnectionstatechange = null; pc.onicegatheringstatechange = null; pc.ontrack = null; pc.onsignalingstatechange = null;
      this._peerConnection = undefined;
    }
    if (this._unsub) { this._unsub.then((u) => u(), () => undefined); this._unsub = undefined; }
    this._sessionId = undefined; this._candidatesList = [];
  }
}

const STREAM = 2; // CameraEntityFeature.STREAM

class MaeCameraStream extends LitElement {
  static get properties() {
    return {
      hass: { attribute: false },
      stateObj: { attribute: false },
      controls: { type: Boolean },
      muted: { type: Boolean },
      allowExoPlayer: { type: Boolean, attribute: 'allow-exoplayer' },
      aspectRatio: { type: Number },
      fitMode: { type: String },
      _posterUrl: { state: true },
      _capabilities: { state: true },
      _hlsStreams: { state: true },
      _webRtcStreams: { state: true },
    };
  }

  static get styles() { return css`:host,img,video{display:block}:host{height:var(--mae-video-h,auto)}img,video{width:100%;height:var(--mae-video-h,auto);object-fit:var(--mae-video-fit,contain)}.hidden{display:none}`; }

  constructor() {
    super();
    this.controls = false; this.muted = false; this.allowExoPlayer = false;
    this._connected = undefined;
    this._handleHlsStreams = (ev) => { this._hlsStreams = ev.detail; };
    this._handleWebRtcStreams = (ev) => { this._webRtcStreams = ev.detail; };
  }

  connectedCallback() { super.connectedCallback(); this._connected = true; }
  disconnectedCallback() { super.disconnectedCallback(); this._connected = false; }

  willUpdate(changed) {
    if (!changed.has('stateObj') || !this.stateObj) return;
    const old = changed.get('stateObj');
    if (old && old.entity_id === this.stateObj.entity_id) return;
    this._hlsStreams = undefined; this._webRtcStreams = undefined; this._capabilities = undefined;
    this._posterUrl = this.__poster();
    this.__capabilities(this.stateObj.entity_id);
  }

  __poster() {
    const p = this.stateObj && this.stateObj.attributes && this.stateObj.attributes.entity_picture;
    if (!p) return undefined;
    return this.hass && typeof this.hass.hassUrl === 'function' && p.charAt(0) === '/' ? this.hass.hassUrl(p) : p;
  }

  async __capabilities(entityId) {
    const so = this.stateObj;
    if (!so || !((so.attributes.supported_features || 0) & STREAM)) { this._capabilities = { frontend_stream_types: [], two_way_audio: false }; return; }
    try {
      const cap = await this.hass.callWS({ type: 'camera/capabilities', entity_id: entityId });
      if (this.stateObj && this.stateObj.entity_id === entityId) this._capabilities = cap;
    } catch (_) {
      if (this.stateObj && this.stateObj.entity_id === entityId) this._capabilities = { frontend_stream_types: [], two_way_audio: false };
    }
  }

  /** Entre WebRTC, HLS y MJPEG, como Home Assistant (selectCameraStreams), salvo que no arranca los dos a la vez. */
  _streams(supportedTypes, hlsStreams, webRtcStreams) {
    if (!supportedTypes) return [];
    if (supportedTypes.length === 0) return [{ type: 'mjpeg', visible: true }];
    if (supportedTypes.length === 1) {
      const t = supportedTypes[0];
      if ((t === 'hls' && hlsStreams && hlsStreams.hasVideo === false) || (t === 'web_rtc' && webRtcStreams && webRtcStreams.hasVideo === false)) return [{ type: 'mjpeg', visible: true }];
      return [{ type: t, visible: true }];
    }
    // Una sola conexión de video por cámara. Home Assistant arranca HLS y WebRTC juntos y se queda con WebRTC si anda;
    // acá va WebRTC solo (es el que queda en Home Assistant cuando anda) y HLS recién si WebRTC no da imagen. Con los dos
    // juntos, cada cambio de cámara abría el doble de conexiones (y HLS hace trabajar a la casa para nada).
    const hlsFailed = !!hlsStreams && hlsStreams.hasVideo === false;
    if (!webRtcStreams || webRtcStreams.hasVideo) return [{ type: 'web_rtc', visible: true }];
    return hlsFailed ? [{ type: 'mjpeg', visible: true }] : [{ type: 'hls', visible: true }];
  }

  render() {
    if (!this.stateObj) return nothing;
    const list = this._streams(this._capabilities && this._capabilities.frontend_stream_types, this._hlsStreams, this._webRtcStreams, this.muted);
    // cada tipo en su lugar fijo: si la lista cambia (HLS falla, queda WebRTC) el reproductor que sigue no se vuelve a crear
    const one = (t) => { const x = list.find((s) => s.type === t); return x ? this._renderStream(x) : nothing; };
    return html`${one('hls')}${one('web_rtc')}${one('mjpeg')}`;
  }

  _renderStream(stream) {
    if (!this.stateObj) return nothing;
    const so = this.stateObj;
    if (stream.type === 'mjpeg') {
      const tok = so.attributes.access_token;
      // iPhone / iPad: el video MJPEG en una imagen llena la memoria hasta que iOS cierra la página. Ahí, fotos seguidas.
      if (IOS_SNAP) {
        if (!this._snapT) this._snapT = setInterval(() => { if (this.isConnected) this.requestUpdate(); else { clearInterval(this._snapT); this._snapT = undefined; } }, 2000);
        const p = this._posterUrl;
        return p ? html`<img src=${`${p}${p.includes('?') ? '&' : '?'}_t=${Math.floor(Date.now() / 2000)}`} alt="">` : nothing;
      }
      const u = this._connected === undefined || this._connected ? (tok ? `/api/camera_proxy_stream/${so.entity_id}?token=${tok}` : undefined) : this._posterUrl;
      const src = u && this.hass && typeof this.hass.hassUrl === 'function' && u.charAt(0) === '/' ? this.hass.hassUrl(u) : u;
      return src ? html`<img src=${src} alt="">` : nothing;
    }
    if (stream.type === 'hls') {
      return html`<ha-hls-player autoplay playsinline .allowExoPlayer=${this.allowExoPlayer} .muted=${this.muted} .controls=${this.controls}
        .hass=${this.hass} .entityid=${so.entity_id} .posterUrl=${this._posterUrl} @streams=${this._handleHlsStreams}
        class=${stream.visible ? '' : 'hidden'}></ha-hls-player>`;
    }
    if (stream.type === 'web_rtc') {
      return html`<ha-web-rtc-player autoplay playsinline .muted=${this.muted} .controls=${this.controls} .hass=${this.hass}
        .entityid=${so.entity_id} .posterUrl=${this._posterUrl} @streams=${this._handleWebRtcStreams}
        class=${stream.visible ? '' : 'hidden'}></ha-web-rtc-player>`;
    }
    return nothing;
  }
}

if (!customElements.get('ha-web-rtc-player')) customElements.define('ha-web-rtc-player', MaeWebRtcPlayer);
if (!customElements.get('ha-camera-stream')) customElements.define('ha-camera-stream', MaeCameraStream);
export { MaeWebRtcPlayer, MaeCameraStream };
