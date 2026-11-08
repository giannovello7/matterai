# Qué es MatterAI

MatterAI son cuatro piezas que trabajan juntas:

- **La integración MatterAI** (esta): se instala por HACS en el Home Assistant de cada casa. Tiene este panel, guarda los dashboards, crea los accesos de cada celular, corre las automatizaciones MatterAI y vigila que todo ande.
- **La app MatterAI** (Android, iPhone / iPad, y la app web en app.matterai.com.ar): es lo único que usa la familia. **El cliente nunca ve Home Assistant.**
- **El panel central** (panel.matterai.com.ar): tu panel de instalador. Ves todas las casas, sabés cuál se cayó, guardás copias y plantillas, y reenvía los avisos a los celulares.
- **Firebase** (Google): entrega los avisos al celular aunque la app esté cerrada. Es un solo proyecto («MatterAI») para todos los clientes.

> Todo lo de esta casa se configura acá, en el panel MatterAI. La sección **Puesta en marcha** tiene el paso a paso para no olvidarte nada en ningún cliente.

# Instalar en un cliente nuevo

1. **Instalar la integración por HACS** (repositorio giannovello7/matterai) y reiniciar Home Assistant.
2. **Agregar la integración** (Ajustes → Dispositivos y servicios → Agregar → MatterAI): nombre de la casa, dirección remota y tu WhatsApp de soporte.
3. **Dirección local y wifi**: en Ficha de la casa → «Cambiar datos». La dirección local es la de adentro de la casa (por ejemplo, `192.168.1.50:8123`) y el wifi, el nombre de la red tal como aparece en el celular (si hay varias, separadas por coma; es opcional). Con eso la app se conecta directo cuando el celular está en la casa.
4. **Dar de alta la casa en el panel central**: corré `matterai-home\instalador\alta-cliente.ps1` (o «Agregar casa» en el panel central). Te da la **clave de la casa**: cargala en «Cambiar datos» → «Clave del panel central».
5. **Ambientes**: cada equipo en su Área de Home Assistant. Lo que no está en un ambiente no aparece en la app. Los ajustes finos (nombres, qué equipos van, alarma, portones, cámaras) se hacen en **La casa**.
6. **Dashboards**: Dashboards → «Armar con el asistente». Elegís la estructura MatterAI, tu plantilla o un dashboard existente; se adapta solo y te dice qué revisar.
7. **Vincular los celulares**: Equipos → el QR (uno por celular, vence en 24 horas). La familia baja la app y lo escanea.
8. **Automatizaciones**: las básicas (buenas noches, me voy / llego, portero, avisos de aberturas, riego).
9. **Entrega**: probar un aviso, explicarle la app, dejar la tablet de pared lista y guardar los datos de la casa en tu gestor de contraseñas.

# El panel MatterAI

Arriba a la derecha elegís **☀ Claro, ☾ Oscuro o Auto** (como Home Assistant). Se acuerda en cada navegador.

## Resumen
El estado general: avisos, servicios vigilados, equipos que no responden, última copia y versión. Mientras falte algo de la puesta en marcha, aparece su cuadro.

## Puesta en marcha
El paso a paso de la instalación, en 5 grupos: la casa, panel central y copias, app del cliente, automatizaciones y entrega. Los pasos se tildan solos cuando la casa ya los tiene; los de la entrega los marcás vos (queda la fecha). Lo que dice «si corresponde» depende de cada cliente.

## Dashboards
Lo que ve cada persona en su pantalla. Cada dashboard tiene **un diseño para el celular y otro para la tablet**.

- **Armar con el asistente**: para un cliente nuevo. Elegís una **plantilla**: **MatterAI** (la de siempre); **Vision** (como Apple Vision Pro: vidrio claro, barra lateral, pestañas de ambientes, datos grandes, mosaicos con interruptor y una columna clara con hora, termostato y música); **Control4** (oscuro con color: barra de temas arriba, escenas como portadas, controles en grilla, cámaras como fotos y la música abajo); o **Savant / Lutron** (negro y dorado, minimalista: los ambientes en tarjetas grandes, títulos finos espaciados). Se completa sola con lo que tiene la casa y después la ajustás en el editor.
- **Editar celular / Editar tablet**: abre el editor en ese diseño. Las miniaturas muestran cómo está armado cada uno («prearmado» = todavía se arma solo).
- **★**: el dashboard por defecto. Lo ven los equipos que no tienen uno elegido. Sin ★, esos equipos ven el «Inicio automático».
- **+ equipo**: elegís quién lo ve. Una persona con celular y tablet: marcá los dos.
- **⋮**: nombre y equipos, duplicar, borrar.

## La casa
Los datos que usan todos los dashboards: General (marca, soporte, personas), Ambientes (qué equipos hay en cada uno), Seguridad (alarma, portones, cerraduras, cámaras) y Secciones (qué partes tiene la app). Al final, «Inicio clásico» tiene el diseño de la pantalla anterior, sólo para equipos que todavía la usan.

## Equipos
- **Vincular**: el QR y el link (por WhatsApp o impreso).
- **Acceso de invitado**: un link que vence solo (1 día, 3 días, 1 semana o 1 mes) con lo que puede ver: sólo luces y clima, todo menos la seguridad, o todo.
- **Mensaje a la app**: aparece en la pantalla de los equipos con la app abierta.
- **Qué ve cada equipo**: el dashboard de cada celular o tablet. Avisa los vinculados dos veces y los quita.
- **Accesos a la casa**: cada equipo tiene el suyo. **Desvincular** corta sólo ese equipo (celular perdido, empleado que ya no está).
- **Celulares y tablets**: si está **conectado ahora**, la versión de la app (avisa si hay una más nueva), el **perfil** (completo, sin seguridad para los chicos, o sólo luces y clima), **pedir huella** para la alarma, cerraduras y portón, y **Probar** (mostrar un aviso, prender la pantalla o recargar la app).

## Automatizaciones
Escenas y automatizaciones MatterAI, pensadas para que las entienda cualquiera: escenas de un toque, «si pasa esto, hacé aquello», horarios, simulación de presencia, riego por zonas, luz que sigue el ritmo del día, luz por presencia, avisos si algo quedó abierto, me voy / llego, buenas noches, clima inteligente, despertador con luz, recordatorios, portero, cámaras con Frigate, tele inteligente e invitados con link para el portón. Las escenas y automatizaciones aparecen solas en las tarjetas **Escenas** y **Rutinas** de los dashboards.

## Estado de la casa, Mantenimiento y Copias
- **Estado**: avisos de la casa (equipos sin responder, pilas bajas, actualizaciones, seguridad).
- **Mantenimiento**: vigila los servicios (Frigate, Music Assistant, el túnel, etc.) y los reinicia solos si se caen. «Modo mantenimiento» pausa la vigilancia mientras trabajás.
- **Copias**: copia de seguridad en el panel central (se hacen solas; podés hacer una ahora o restaurar una parte).
- **Plantillas**: guardás automatizaciones y diseños para usarlos en otras casas.

## Conexión, Seguridad, Voz y Ficha de la casa
- **Conexión**: cómo llega la app a la casa (dirección remota, local y acceso desde la app web).
- **Seguridad**: el registro de todo lo importante (quién vinculó, desvinculó, abrió, cambió perfiles), el acceso de soporte del instalador y los pedidos de privacidad de los clientes.
- **Voz**: control por voz de la app: gratis (en la casa) o con IA (necesita una clave de Anthropic).
- **Ficha de la casa**: nombre, direcciones, soporte y la clave del panel central («Cambiar datos»).

# El editor de dashboards

Funciona como el de Home Assistant (Lovelace): **lo que ves es lo que se edita**.

- **Tocá cualquier cosa** en la pantalla del medio (una tarjeta, un ambiente, un dato del resumen, la parte de arriba o la barra de abajo) y se abre su ventana con 3 pestañas: **Contenido** (qué muestra), **Aspecto** (cómo se ve, su ancho y dónde va) y **Cuándo se ve** (mostrarla sólo si…).
- **Ancho de cada tarjeta**: ¼, ½, ¾ o completo; las angostas se acomodan una al lado de la otra.
- **Tablet: ▦ Columnas** (arriba): plano al costado + 1 o 2 columnas, 2, 3 o 4 columnas, o una grande + 2 chicas. Además hay una **banda de arriba** (debajo de la hora) y una **banda de abajo** (arriba de la música), de lado a lado. En «Aspecto → Dónde va» elegís la columna o la banda, y «Llenar el alto que sobra» hace que el plano ocupe el resto de su columna sin tapar a las demás.
- **Arrastrá** las tarjetas para moverlas (una línea dorada marca dónde van a caer: arriba, abajo o al costado de otra, o en una columna o banda vacía), y lo de adentro de cada tarjeta (escenas, ambientes, botones) para ordenarlo. Nunca hay flechas.
- **⋮** en cada tarjeta: agregar una tarjeta arriba o abajo de esa, duplicar, copiar a otro dashboard, borrar (también en las tarjetas de adentro de un ambiente).
- **+ Tarjeta**: el catálogo con buscador, ordenado por La casa, Seguridad, Información, Multimedia y Otras, con un dibujito de cómo se ve cada tarjeta. **+ Agregar tarjeta** al final de cada columna.
- **Barra de abajo**: arrastrá sus botones en la pantalla del medio para ordenarlos.
- **Sin listas desplegables**: cada opción se elige tocando botones; los íconos, en una grilla con su dibujo.
- **Celular / Tablet** y, en la tablet, **Horizontal / Vertical**.
- **🎨 Diseño**: todo el aspecto en un lugar: 1 · **Plantilla** (MatterAI, Vision, Control4 o Savant, sólo a este equipo o al celular y la tablet juntos; Ctrl+Z la deshace), 2 · **Estilo** (MatterAI, tipo Apple, Cristal, Vision, Control4 o Savant), 3 · **Fondo** (degradés, un color o una foto de la casa), 4 · **Modo** (oscuro, claro o automático) y el nombre. Cada diseño (celular y tablet) tiene el suyo. Abajo dice qué puede cambiar el cliente desde su app.
- **Tamaño del plano**: tocá el plano → Tamaño: chico, mediano, normal o grande.
- **Cómo se ve cada tarjeta**: Ambientes (lista, grilla o tarjetas grandes), Escenas (botones o portadas de colores), Botones (grilla, lista, mosaicos con interruptor o fila de accesos) y el termostato grande con los modos del aire.
- **Ambientes por dentro**: abrí un ambiente y arrastrá cada equipo a su lugar directo en la pantalla del medio.
- **Tarjetas dentro de un ambiente**: con el ambiente abierto, «+ Agregar tarjeta» arriba o abajo de sus equipos (o en el panel: «+ Tarjeta arriba / abajo»). Puede ser cualquier tarjeta: la cámara del ambiente, escenas, botones, música, texto, una imagen… Se tocan, se editan con la misma ventana que todas y se arrastran para ordenarlas. Son **de la casa** (se ven en todos los dashboards y en la app); con «Tarjetas propias de este ambiente sólo en este dashboard» ese dashboard tiene su versión y los demás siguen con la de la casa. Guardar / Cancelar de una tarjeta del ambiente vuelve al ambiente, y Ctrl+Z también deshace lo de adentro.
- **Plano e imágenes**: el render de la casa (de noche, con luces y de día) y sus ambientes: puntos para paredes de más de 4 lados, mover la zona, doble clic para borrar un punto, Ctrl+Z.
- **▶ Probar**: usás la pantalla como en el celular (prender luces, entrar a un ambiente).
- **Simular**: ver cómo queda de noche, con la alarma armada, con música, etc., sin tocar la casa.
- **⋯**: historial de versiones; probar en un equipo real por 15 minutos; exportar o importar plantilla.
- **Guardar** se lo manda a los equipos al instante (sin actualizar la app).

## Las tarjetas
Resumen · Cámara con botón · Ambientes · Escenas · Botones · Cámaras en vivo (Frigate) · Portero (cámara con botones) · Alarma · Modo ausente · Rutinas · Música · Cerradura · Plano · Reloj y clima · Clima · Aire / termostato (compacto o **termostato grande**) · Cortinas · Luces · Consumo · Sensor · Personas · Texto · Imagen · Actividad · **Puertas y ventanas** · **Agenda del día** · **Riego** · **Pilas**.

Las tarjetas «en automático» se arman solas con lo que tiene la casa. Si elegís los equipos a mano, quedan fijos.

# La app del cliente

- **Inicio**: el dashboard de esa persona. En el celular: hora, clima, avisos, resumen, cámara, sus ambientes, escenas y «Toda la casa». En la tablet: el plano que se ilumina, resumen, escenas, rutinas, cámaras, música y la barra de abajo.
- **Ambientes**: tocar prende o apaga las luces; mantener lo fija en el inicio; entrar muestra todo lo que tiene.
- **Plano** (tablet): tocar una zona prende su luz; tocar su cartel entra al ambiente. Los íconos muestran lo que está prendido.
- **Música**: como Spotify, sobre Music Assistant: cola, parlantes, pasar la música de uno a otro, volumen grande.
- **Cámaras**: el visor de Frigate en vivo, con eventos y grabaciones.
- **Actividad**: qué pasó en la casa, por equipo, día, tipo y ambiente.
- **Agenda, clima y avisos** (la campanita).
- **Voz: «Mate»**. Tocás el micrófono y pedís («prendé la luz del living», «poné música en el quincho»). Con **«Escuchar «Mate»»** prendido (Opciones → Pantalla, o en la pantalla de voz) no hace falta tocar nada: decís **«Mate»**, suena un tilín y pedís. Escucha en el equipo, sin internet (el audio no sale de la tablet o el celular), mientras la app está abierta: ideal para la tablet de pared. La primera vez baja la voz en español (unos 40 MB). «Mate» se activa sola al principio de la frase, así que «tomamos mate» no la despierta.
- **Opciones**: pantalla (modo claro u oscuro, **estilo de la pantalla**: el de tu instalador o una de las plantillas Vision, Control4 o Savant, protector, tablet de pared), conexión (local o remota), huella, accesos rápidos (widgets, botones rápidos, NFC), agregar otro celular y desvincular.
- **Tablet de pared**: queda siempre prendida, fijada en la app, con protector de pantalla, se despierta al acercarse y escucha «Mate». El portero aparece como una llamada.
- **Android Auto**: botones del portón, luces y escenas en el auto.

# Avisos con la app cerrada

El aviso sale de la casa, pasa por el panel central y Firebase lo entrega al celular. Para que llegue:

1. La casa conectada al panel central (con su clave).
2. El celular con la app 1.13 o más nueva, vinculado a esa casa.

Nada más: cada celular se registra solo. El panel sólo reenvía avisos a celulares que esa casa registró, y con una clave secreta entre la casa y el celular.

# El panel central

- **Casas**: todas tus instalaciones, su versión y si están conectadas. Si una deja de responder 15 minutos, te avisa (por Telegram, si lo configuraste).
- **Copias y plantillas** de todas las casas. Una casa nunca ve los datos de otra.
- **Entrar**: con la contraseña del panel y el código de 2 pasos de tu app de autenticación.
- **Publicar una versión nueva**: `matterai-panel-central\publicar.ps1`. `-NuevaClave` cambia la contraseña y cierra todas las sesiones.

# Seguridad

- Cada celular tiene su propio acceso: perder uno no compromete a los demás.
- Los códigos de vinculación sirven una sola vez y vencen.
- Los invitados vencen solos.
- La huella protege alarma, cerraduras y portón en el equipo que la tenga.
- Todo lo importante queda en el registro de Seguridad, que detecta si alguien lo modifica.
- Las claves (Firebase, panel central) nunca van en el código ni en GitHub.

# Si algo no anda

- **No veo un cambio del panel en la app**: los dashboards llegan al instante; si cambió la app o la integración, cerrá y abrí la app (o recargá el navegador).
- **Una tablet aparece dos veces**: Equipos → «Quitar duplicado». Desde la 2.15 la casa reemplaza el vínculo viejo sola.
- **No llegan los avisos**: revisá en Puesta en marcha «Conectada al panel central» y «Avisos con la app cerrada», y probá con Equipos → Probar.
- **La app tarda en conectar en la casa**: falta la dirección local o el wifi en «Cambiar datos».
- **Un equipo no aparece en la app**: no está en ningún ambiente (Puesta en marcha te dice cuántos faltan).
- **Una cámara no se ve en vivo**: el visor necesita la Advanced Camera Card y Frigate funcionando (Mantenimiento lo vigila).

# Para vos (instalador)

- **Publicar en tandas**: se juntan varios cambios y se publica todo junto (integración por HACS, app web y APK).
- **Compilar la app**: `matterai-android\compilar-silencioso.ps1`. El APK queda en `android\app\build\outputs\apk\debug`.
- **App de iPhone / iPad**: en una Mac, `matterai-android/preparar-ios.sh` y seguir `IOS.md` (Xcode, cuenta de Apple Developer, Firebase para iOS y la clave de avisos de Apple). Cada casa necesita también el origen `capacitor://app.matterai.com.ar` en CORS (lo avisa la Puesta en marcha).
- **Archivos de Firebase**: `google-services.json` va en `matterai-android\android\app\` y la cuenta de servicio en `Documentos\secretos`. Nunca se suben a GitHub.
