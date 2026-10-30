/* MatterAI · cargador de la tarjeta y del panel.
 * Home Assistant pone en la página una dirección fija (cambia sólo al reiniciar) y el navegador
 * se queda con la versión que guardó. Este archivo casi no cambia: pregunta por la versión actual
 * del archivo pedido (?f=…) y la carga con esa marca, así cada actualización se ve con sólo recargar.
 */
const BASE = new URL('.', import.meta.url);
const file = new URL(import.meta.url).searchParams.get('f') || 'matterai-home-card.js';
const url = new URL(file, BASE);
let tag = '';
try {
  const r = await fetch(url, { method: 'HEAD', cache: 'no-store', credentials: 'same-origin' });
  tag = r.headers.get('etag') || r.headers.get('last-modified') || '';
} catch (_) { /* sin red: se usa lo que haya */ }
url.searchParams.set('v', tag ? tag.replace(/[^\w.-]/g, '') : String(Date.now()));
await import(/* webpackIgnore: true */ url.href);
