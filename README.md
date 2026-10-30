<p align="center"><a href="https://matterai.com.ar"><img src="logo.png" alt="MatterAI" height="80"></a></p>

# Integración MatterAI (para el instalador)

[![Validar](https://github.com/giannovello7/matterai/actions/workflows/validate.yaml/badge.svg)](https://github.com/giannovello7/matterai/actions/workflows/validate.yaml)
![Licencia](https://img.shields.io/badge/licencia-MIT-blue)

Todo lo que una casa necesita para la app MatterAI, en **una sola integración**. El cliente nunca ve Home Assistant: usa sólo la app.

## Qué hace

| | |
|---|---|
| **Tarjeta del dashboard** | La sirve la integración y la registra sola. No hay que copiar archivos a `www` ni cambiar `?v=`. Si había una copia vieja en Recursos, la reemplaza. |
| **Configuración del dashboard** | La guarda la integración, sin YAML ni panel aparte. La primera vez se trae sola la que hubiera en algún panel. |
| **Panel «MatterAI»** (barra lateral, sólo administradores) | **Dashboard**: editor visual + vista previa en vivo + Guardar. Al guardar, la app de los clientes cambia en el momento. **App del cliente**: QR y link para vincular el celular, imprimir o mandar por WhatsApp, y generar un acceso nuevo si pierde el celular. **Estado**: dirección, versiones, permiso de la app (CORS), panel central y avisos de la casa. |
| **Usuario de la app** | Crea «App MatterAI» sin permisos de administrador, con un acceso de larga duración. |
| **Panel central** | Si cargás la clave de la casa, cada 5 minutos le cuenta al panel que está viva, qué versión tiene y si hay algo para atender: equipos sin responder, pilas bajas, alarma disparada, disco lleno o actualizaciones. |
| **MatterAI Escenas** | Si está instalada y no configurada, la deja configurada en el mismo paso. |

## Control por voz ("prendé la música en el living")

La app muestra un **botón de micrófono** arriba, al lado de Música. El cliente toca, habla y la casa lo hace y le contesta en voz alta. Hay tres modos (MatterAI → Configurar → «Control por voz»):

| Modo | Costo | Qué entiende |
|---|---|---|
| **Sólo gratis** | $0, sin internet | Los pedidos comunes: «prendé/apagá la luz del living», «el velador», «la luz al 30%», «poné el aire del dormitorio en 23», «aire en frío», «bajá la persiana del quincho», «a la mitad», «prendé el ventilador / el caloventor», «pausá la música», «subí el volumen», «poné Soda Stereo en el quincho», «modo cine», «apagá todo», «¿está prendida la luz del baño?», «¿qué temperatura hace?» |
| **Gratis + IA** (por defecto) | Sólo paga lo que el modo gratis no entiende | Todo lo anterior gratis. Lo raro («armame algo lindo para el asado») se lo pregunta a la IA, si hay clave. Sin clave funciona como «sólo gratis». |
| **Siempre IA** | Cada pedido, una fracción de centavo | Cualquier frase |

El modo gratis usa los mismos nombres que ve el cliente. Si falta el ambiente («prendé la luz» a secas) no adivina: pregunta cuál.

Para la IA: creá una clave en **console.anthropic.com** → API Keys (empieza con `sk-ant-`), cargale crédito y pegala en MatterAI → Configurar.

Cómo funciona:
- El celular pasa la voz a texto. En Android usa el reconocimiento del sistema, que es excelente en español.
- En **iPhone** sólo Safari reconoce la voz. En Chrome o en la app de HA, la app **graba el audio y lo pasa a texto la casa** con el motor de voz del asistente de HA (Google Cloud, Whisper, HA Cloud…). Nunca se usa el teclado: si el micrófono no se puede usar, la pantalla de voz dice el motivo exacto (permiso, página sin https, sin motor de voz) y cómo arreglarlo.
- La integración le manda el pedido a Claude (`claude-opus-5-5`, esfuerzo bajo para que conteste rápido) junto con los ambientes y equipos de la casa, con los mismos nombres que ve el cliente.
- La lista de equipos queda en caché, así los pedidos siguientes son más baratos y rápidos.
- La integración **valida** cada acción: sólo equipos de esa casa y servicios permitidos.
- **Alarmas, cerraduras y portones nunca se manejan por voz.** Eso queda en la app, con confirmación.
- Las acciones se ejecutan con el usuario que habló.

Qué entiende:
- Luces, con brillo.
- Enchufes, ventiladores y persianas, con posición.
- Aire acondicionado, con temperatura y modo.
- Teles y parlantes, con volumen y pausa.
- Música por Music Assistant: «poné Soda Stereo en el quincho».
- Escenas.
- Preguntas: «¿quedó prendida la luz del quincho?», «¿qué temperatura hace?».

**«Hey Matte» (manos libres):** en la pantalla de voz aparece «Activar «Hey Matte» en este dispositivo».
- Activado, ese dispositivo escucha de forma continua (ideal para la tablet de pared) y reacciona sólo a **«Hey Matte»**, «Oye Matte» o «Che Matte». El prefijo es obligatorio, porque «mate» sola aparece en cualquier charla.
- «Hey Matte, prendé la luz del living» se ejecuta de una. Si decís sólo «Hey Matte», se abre la pantalla y espera el pedido.
- Se nota porque el micrófono de arriba queda con un brillo turquesa.
- Por ahora funciona con la app abierta en Chrome. En la app de Android y con el celular bloqueado hace falta un detector propio en el teléfono: es la parte 3.

En la demo de la app hay una versión simple, sin IA, que entiende «prendé/apagá las luces de <ambiente>», para mostrarla.

## Instalar con HACS

1. **HACS → ⋮ → Repositorios personalizados**: pegá `https://github.com/giannovello7/matterai`, categoría **Integración**.
2. Descargá **MatterAI** y también **MatterAI Escenas** (`https://github.com/giannovello7/matterai-escenas`): la app usa las dos.
3. Reiniciá Home Assistant y seguí con el paso 2 de abajo.

[![Abrir en HACS](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=giannovello7&repository=matterai&category=integration)

Las versiones nuevas aparecen en **Ajustes → Actualizaciones**.

## Instalar en una casa (lo hace `instalador\alta-cliente.ps1`)

1. Copiar `custom_components/matterai` (y `matterai_escenas`) a `/config/custom_components/` y reiniciar HA.
2. **Ajustes → Dispositivos y servicios → Agregar integración → MatterAI**. Es una sola pantalla: nombre del cliente, dirección remota (la de Cloudflare), WhatsApp de soporte y clave del panel central (opcional).
3. En **Ajustes → Sistema → Red**, en «Orígenes permitidos por CORS», agregar `https://app.matterai.com.ar`. El panel MatterAI → Estado te avisa si falta: la integración lo revisa, pero no lo escribe sola, porque un error ahí deja a HA sin acceso web.
4. Barra lateral → **MatterAI** → Dashboard (ajustar y Guardar) → App del cliente (QR).

## La app

La app lee la configuración con `matterai/config` y queda escuchando `matterai/config/subscribe`. En casas viejas sin la integración, sigue buscando la tarjeta en los paneles como antes.

## Comandos (WebSocket)

| Comando | Quién | Para qué |
|---|---|---|
| `matterai/config` | cualquier usuario (la app) | configuración del dashboard + nombre de la casa |
| `matterai/config/subscribe` | cualquier usuario | avisos cuando el instalador guarda |
| `matterai/config/save` | admin | guardar la configuración |
| `matterai/pairing` (`regenerate`) | admin | link/QR de vinculación (o acceso nuevo) |
| `matterai/status` | admin | estado de la casa |
| `matterai/heartbeat` | admin | mandar un latido ya al panel central |

## Pruebas

```
python -m venv venv && venv\Scripts\pip install pytest-homeassistant-custom-component
venv\Scripts\python -m pytest
```

Corren sobre un Home Assistant real de prueba: alta, usuario y token de la app, permisos (la app lee pero no guarda ni ve el QR), suscripción a cambios, avisos, latido al panel central y formatos de CORS.

## Licencia

Libre bajo la [licencia MIT](LICENSE). El nombre y el logo de MatterAI son marcas: ver [NOTICE.md](NOTICE.md).

Hecho por **[MatterAI — Domótica & Automatismo](https://matterai.com.ar)**.
