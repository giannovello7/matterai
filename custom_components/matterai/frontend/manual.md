# Qué es MatterAI

MatterAI son cuatro piezas que trabajan juntas:

- **La integración MatterAI** (esta): se instala por HACS en el Home Assistant de cada casa. Tiene este panel, guarda los dashboards, crea los accesos de cada celular, corre las automatizaciones MatterAI y vigila que todo ande.
- **La app MatterAI** (Android, iPhone / iPad, y la app web en app.matterai.com.ar): es lo único que usa la familia. **El cliente nunca ve Home Assistant.** En la app web cada equipo aparece con lo que es (por ejemplo «iPhone (web)»), recibe su dashboard y los cambios al instante, igual que la app instalada. En iPhone y iPad las cámaras se ven como fotos que se renuevan cada 2 segundos (el video continuo hace que iOS cierre la página).
- **El panel central** (panel.matterai.com.ar): tu panel de instalador. Ves todas las casas, sabés cuál se cayó, guardás copias y plantillas, y reenvía los avisos a los celulares.
- **Firebase** (Google): entrega los avisos al celular aunque la app esté cerrada. Es un solo proyecto («MatterAI») para todos los clientes.

> Todo lo de esta casa se configura acá, en el panel MatterAI. La sección **Puesta en marcha** tiene el paso a paso para no olvidarte nada en ningún cliente.

# Instalar en un cliente nuevo

1. **Instalar la integración por HACS** (repositorio giannovello7/matterai) y reiniciar Home Assistant.
2. **Agregar la integración** (Ajustes → Dispositivos y servicios → Agregar → MatterAI): nombre de la casa, dirección remota y tu WhatsApp de soporte.
3. **Dirección local y wifi**: en Ficha de la casa → «Cambiar datos». La dirección local es la de adentro de la casa (por ejemplo, `192.168.1.50:8123`) y el wifi, el nombre de la red tal como aparece en el celular (si hay varias, separadas por coma; es opcional). Con eso la app se conecta directo cuando el celular está en la casa.
4. **Dar de alta la casa en el panel central**: corré `matterai-home\instalador\alta-cliente.ps1` (o «Agregar casa» en el panel central). Te da la **clave de la casa**: cargala en «Cambiar datos» → «Clave del panel central».
5. **Ambientes**: cada equipo en su Área de Home Assistant. Lo que no está en un ambiente no aparece en la app. Los ajustes finos (nombres, qué equipos van, alarma, portones, cámaras) se hacen en **La casa**.
   **Dispositivos**: elegí los dispositivos de Home Assistant que usa la app (viene una propuesta armada: revisala y guardá). Los avisos de fallas, la voz, la app y el editor sólo usan ésos.
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

- **Armar con el asistente**: para un cliente nuevo. Elegís una **plantilla**: **MatterAI** (la de siempre); **Vidrio** (como un dashboard de visionOS: todo adentro de una ventana de vidrio esmerilado, clara de entrada, sobre la casa desenfocada; saludo arriba («Buenas tardes» y cómo está la casa), barra de íconos a la izquierda, al medio la cámara, el consumo en barras, los números y los equipos con ícono grande e interruptor; a la derecha la hora, el termostato y la música con sus controles; los ambientes en una cápsula abajo); **Panel** (como la pantalla de inicio del Control4 nuevo, sin marcas: fondo de color desenfocado, accesos en pastillas arriba —Seguridad, Luces, Clima…—, los favoritos como cuadrados de color con el nombre abajo, mosaicos translúcidos de dos renglones —el aire con − y +, la alarma, portones y luces—, la cámara al lado, la música abajo y, en la tablet, la barra de íconos a la izquierda); **Elegante** (negro y champagne, minimalista: los ambientes en tarjetas grandes, letra fina espaciada); o **Plano grande** (2.32, como el panel de un departamento: el plano de toda la casa bien grande, a todo el alto de la pantalla, que se toca por ambiente, y pegada a él una sola columna angosta: una tarjeta con el nombre, la hora, la campanita, el clima y tres datos —luces, aires y consumo o temperatura—, las escenas, el modo ausente, las rutinas con su interruptor y la cerradura; sin barra de arriba, para que el plano gane alto; en el celular, el plano arriba y lo demás abajo). La tarjeta «Reloj y clima» tiene ese aspecto en «Cómo se ve → Panel». Se completa sola con lo que tiene la casa y después la ajustás en el editor.
- **Editar celular / Editar tablet**: abre el editor en ese diseño. Las miniaturas muestran cómo está armado cada uno («prearmado» = todavía se arma solo).
- **★**: el dashboard por defecto. Lo ven los equipos que no tienen uno elegido. Sin ★, esos equipos ven el «Inicio automático».
- **+ equipo**: elegís quién lo ve. Una persona con celular y tablet: marcá los dos.
- **⋮**: nombre y equipos, duplicar, borrar.

## La casa
Los datos que usan todos los dashboards: General (marca, soporte, personas), Ambientes (qué equipos hay en cada uno), Seguridad (alarma, portones, cerraduras, cámaras) y Secciones (qué partes tiene la app). Al final, «Inicio clásico» tiene el diseño de la pantalla anterior, sólo para equipos que todavía la usan.

## Dispositivos
Qué dispositivos de Home Assistant usa la app. Se elige por **dispositivo** (trae sus entidades útiles; las técnicas, de diagnóstico o configuración, quedan afuera solas) y aparte las **sueltas**: escenas, rutinas, scripts, ayudantes, personas, clima.
- **Sirve para**: que los **avisos de fallas** sean sólo de lo que instalaste para el cliente, que **«Mate»** sólo controle eso, que la **app** no muestre cosas técnicas y que en el **editor** busques entre pocos equipos.
- **La primera vez**: mientras no guardes, la app usa todo (como siempre). La página trae una **propuesta**: lo que ya está en ambientes y dashboards, lo que tiene ambiente y las escenas, rutinas, clima, personas, calendarios, cámaras y alarmas. Revisala y tocá **Guardar**.
- **Buscador y filtros**: todos, elegidos, sin elegir y **nuevos**. Por ambiente, «Todos» o «Ninguno».
- **Dispositivos nuevos**: los que aparecen después quedan **sin revisar** (no entran solos). Lo avisan **Salud y avisos** y la **Puesta en marcha**.
- **Mostrar todo sin filtrar**: vuelve a como era antes.
- Lo de la integración MatterAI (automatizaciones, mantenimiento) está siempre. Un dashboard viejo que use algo que sacaste lo sigue mostrando; en el editor ya no aparece para elegir.

## Equipos
- **Vincular**: el QR y el link (por WhatsApp o impreso).
- **Acceso de invitado**: un link que vence solo (1 día, 3 días, 1 semana o 1 mes) con lo que puede ver: sólo luces y clima, todo menos la seguridad, o todo.
- **Mensaje a la app**: aparece en la pantalla de los equipos con la app abierta.
- **Qué ve cada equipo**: el dashboard de cada celular o tablet. Avisa los vinculados dos veces y los quita.
- **Accesos a la casa**: cada equipo tiene el suyo. **Desvincular** corta sólo ese equipo (celular perdido, empleado que ya no está).
- **Celulares y tablets**: si está **conectado ahora**, la versión de la app (avisa si hay una más nueva; se actualiza sola cada vez que el equipo abre la app), el **perfil** (completo, sin seguridad para los chicos, o sólo luces y clima), **pedir huella** para la alarma, cerraduras y portón, y **Probar** (mostrar un aviso, prender la pantalla o recargar la app).

## El dashboard en la app de Home Assistant

Para los clientes que usan la app de Home Assistant (y no queremos que cambien de app): el mismo dashboard que arman en el editor se ve también ahí.

- **Panel MatterAI → Dashboards → «En la app de Home Assistant» → «Crear o actualizar el panel Casa»**: crea en Home Assistant un panel «Casa» (/matterai-casa) con el dashboard ocupando toda la pantalla. Se elige cuál muestra: uno fijo, o «el de cada usuario» (el asignado, o el general de la casa).
- Para que el cliente lo vea al abrir la app: en su usuario de Home Assistant, Perfil → Panel → «Casa».
- **Se actualiza solo** cuando guardás en el editor (también «Probar en el equipo»). Elige celular o tablet según el ancho de la pantalla.
- Ambientes, clima, música y escenas se abren igual que en la app MatterAI; un equipo abre la ventana de Home Assistant; las cámaras van con la tarjeta de cámaras de MatterAI.
- No están las funciones propias de la app MatterAI (micrófono, ubicación, accesos rápidos, avisos propios). Alrededor se ven las barras de Home Assistant.
- También se puede poner a mano en cualquier panel: `type: custom:matterai-dashboard` (opcional `view: <id>` y `kind: phone|tablet`).

## Cámaras en la app

La app tiene su propia tarjeta de cámaras (no usa la tarjeta de Frigate). Sirve para todas las cámaras de Home Assistant, mezcladas:

- **Cámaras comunes** (RTSP / «Generic Camera», ONVIF y las demás integraciones): en vivo.
- **Cámaras de Frigate**: en vivo y, además, **eventos** (con miniatura, qué detectó y a qué hora) y **grabaciones por hora** de los últimos días. El botón del reloj aparece sólo en estas.
- **Pasar de cámara**: deslizando o con las flechas. **Zoom**: pellizco, doble toque o la rueda del mouse; con zoom, se arrastra para moverse. **Pantalla completa**: el botón de la esquina.
- Los controles aparecen al tocar la imagen y se esconden solos. Se ve un solo video a la vez (el de la cámara que estás mirando).
- El video llega por Home Assistant (WebRTC; si la cámara no lo ofrece, HLS; si tampoco, fotos seguidas). No hace falta abrir ningún puerto de las cámaras.
- Si una grabadora manda la imagen angosta (por ejemplo 1080P Lite, 960×1080), se estira sola si en la configuración de cámaras esa cámara tiene `dimensions.layout.fit: fill`.

## Automatizaciones
Escenas y automatizaciones MatterAI, pensadas para que las entienda cualquiera: escenas de un toque, «si pasa esto, hacé aquello», horarios, simulación de presencia, riego por zonas, luz que sigue el ritmo del día, luz por presencia, avisos si algo quedó abierto, me voy / llego, buenas noches, clima inteligente, despertador con luz, recordatorios, portero, cámaras con Frigate, tele inteligente e invitados con link para el portón. Las escenas y automatizaciones aparecen solas en las tarjetas **Escenas** y **Rutinas** de los dashboards.

**Qué puede usar el cliente** (2.34, en ⚙ Ajustes del instalador de la tarjeta de automatizaciones): vos, como administrador, elegís una por una qué automatizaciones listas puede crear el cliente (luz por presencia, clima inteligente, portero…) y qué opciones le aparecen al armar la suya («Si…»: horario, amanecer, cuando un dispositivo cambia, cuando alguien llega…; «Sólo si…»; «Entonces…»; y las ideas de ejemplo). Al lado de cada una avisa si la casa no tiene lo que necesita (por ejemplo, sin sensores no sirve la luz por presencia). Hay **perfiles de un toque**: «Según esta casa», «Básico: escenas y horarios», «Todo» y «Sólo usar lo armado». **«Ver cómo lo ve el cliente»** muestra la pantalla Crear como la ve él. Lo controla también el servidor: aunque el cliente lo intente, no puede guardar algo que no habilitaste. Para un cliente que usa sólo Home Assistant (sin la app), se pone la tarjeta `custom:matterai-escenas-card` en su dashboard.

**Pestañas y equipos** (2.34, en los mismos ajustes): **Pestañas que ve el cliente** (Escenas, Automáticas, Inteligentes, Recordatorios, Temporizadores): las que apagues no le aparecen. **Equipos que puede usar**, de tres formas: **Los de la app** (los mismos que elegiste en el panel MatterAI → Dispositivos; no hay que marcar nada), **Sólo los que marco** (arranca vacío; lo más práctico en casas con cientos de entidades) o **Todos menos los que saco** (lo de antes). La lista va **por ambiente o por tipo**, con cada grupo plegado y «Todos / Ninguno» por grupo; tocando el grupo se despliega.

**Para el cliente, como una app comercial** (2.34): la tarjeta tiene dos pestañas como Tuya, **Escenas** (un toque) y **Automatizaciones** (todo lo que la casa hace sola, también las inteligentes), más Recordatorios y Temporizadores si se usan. Cada automatización dice **«Última vez: hoy 19:42»**. Cuando tiene pocas, abajo aparecen **«Ideas para tu casa»** (2.34.2: en un recuadro amarillo aparte que dice «Todavía no están armadas», y plegadas en una línea «3 ideas para tu casa · Ver» si ya tiene automatizaciones propias) armadas con sus equipos («Al llegar, prender el aire», «Luces al atardecer», «Cerrar el portón a la noche»…): las toca, quedan listas y sólo falta Guardar (se apagan en Ajustes del instalador). Antes de guardar, el editor muestra **«En resumen»** en una frase. La opción técnica «Si se vuelve a activar mientras está en curso» sólo la ve el instalador.

## Estado de la casa, Mantenimiento y Copias
- **Estado**: avisos de la casa (equipos sin responder, pilas bajas, actualizaciones, seguridad). Cada aviso tiene **Ir**, que lleva a donde se arregla (el dispositivo en Home Assistant, Mantenimiento, el pedido de datos, Reparaciones…). Si son muchos equipos, «Ver cuáles» los lista con su ambiente y desde cuándo. Un equipo cuenta «sin responder» sólo si no contesta en nada (si una parte anda, no avisa).
- **Mantenimiento**: vigila los servicios (Frigate, Music Assistant, el túnel, etc.) y los reinicia solos si se caen. «Modo mantenimiento» pausa la vigilancia mientras trabajás. Si desinstalaste un Zigbee2MQTT, su último «offline» que queda guardado en MQTT ya no cuenta: no se muestra ni hace reiniciar al que anda.
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
- **La parte de arriba** (saludo u hora, clima, campanita, menú): tocándola elegís qué muestra. Ocupa siempre todo el ancho; desde la 2.34, con **«Pasarla a una tarjeta»** queda como una tarjeta (Reloj y clima, aspecto «Saludo» u «Hora grande») arriba de la primera sección, que se mueve y se le cambia el ancho como a cualquiera, y con **«Sacar la parte de arriba»** desaparece. En el editor queda una barrita «Parte de arriba oculta»: tocándola se vuelve a mostrar.
- **Reloj y clima**: tocar la hora abre la agenda y tocar el clima, el pronóstico. En Aspecto: hora grande, día y hora en dos cuadros, **panel** (nombre, hora, clima y datos) o **saludo** («Buenas tardes» y cómo está la casa, con campanita y menú si querés). Desde la 2.34 los **datos del panel se eligen** como en la tarjeta de Datos: hasta 6, cada uno un resumen (luces, aires, consumo, quién está…) o un equipo cualquiera.
- **Tablet: ▦ Columnas** (en ⋯): plano al costado + 1 o 2 columnas, 2, 3 o 4 columnas, o una grande + 2 chicas. **El ancho de cada tarjeta (¼, ½, ¾ o completo) lo cambiás arrastrando su borde derecho** en la pantalla del editor (aparece una manija al pasar por la tarjeta), en celular y tablet. **El ancho de cada columna (y el del costado del plano) lo ajustás arrastrando la manija** que aparece entre ellas en la pantalla del editor. La pantalla de la tablet se desplaza entera: cada columna crece con sus tarjetas, nada queda cortado, y la barra de abajo queda siempre a la vista. Una columna sin tarjetas no deja un hueco en la app. Cada tarjeta acomoda cuántas cosas pone por fila según su ancho (en una columna angosta, menos). Además hay una **banda de arriba** (debajo de la hora) y una **banda de abajo** (arriba de la música), de lado a lado. En «Aspecto → Dónde va» elegís la columna o la banda, y «Llenar el alto que sobra» hace que el plano ocupe el resto de su columna sin tapar a las demás.
- **El dashboard se arma por secciones** (como en Home Assistant). Cada sección tiene su barra arriba, un título opcional y un ancho; adentro, las tarjetas se acomodan solas en filas según su ancho. En la tablet las secciones van una al lado de la otra mientras entren; en el celular, una debajo de la otra. No hay columnas ni bandas.
- **Ancho de una tarjeta**: el botón dorado de su barrita (cada toque: ¼, ½, ¾, completo) o arrastrando la manija de su borde derecho. Si una tarjeta alta (el plano) deja huecos al lado, ponela en su propia sección angosta y las demás en otra al costado.
- **Alto de una tarjeta** (desde la 2.32): en «Aspecto → Alto» (Automático, Chico, Mediano, Grande o **Pantalla**, que ocupa todo el alto que queda debajo de la hora y arriba de la barra; con «− más bajo / + más alto» se ajusta de a una fila) o arrastrando la manija de su **borde de abajo** (dos toques en esa manija la vuelven a automático). Va en filas de 56 px, como en Home Assistant. Con un alto fijo la cámara llena el alto (recortada, sin deformarse), el plano entra entero y centrado, y si una lista no entra se desliza adentro de la tarjeta. Una tarjeta al lado del plano ya no se estira hasta el alto del plano (antes, con los estilos Vidrio y Panel, la cámara quedaba larga y finita).
- **Secciones**: «+ Agregar sección» al final; se mueven arrastrándolas de su barra; el ancho (¼, ⅓, ½, ⅔, ¾ o completo) se cambia arrastrando la manija dorada de la barra o con el lápiz, que también tiene el título, **moverla antes o después, duplicarla con sus tarjetas** (2.33) y borrar.
- **🏠 Ambientes** (arriba): la lista de ambientes de la casa; tocá uno para editar su nombre, ícono, equipos y las tarjetas de adentro. Se ve abierto en la pantalla, con el estilo del dashboard.
- **Arrastrá** una tarjeta **desde cualquier parte** (también desde sus botones) para moverla. Mientras la llevás, todas las columnas y bandas se marcan como lugares donde soltar y una línea dorada muestra dónde va a caer: arriba, abajo o al costado de otra, debajo de la última o en una columna vacía. Si llegás al borde de arriba o de abajo, la pantalla se desplaza sola. Al soltarla no se abre nada: queda donde la dejaste. Nunca hay flechas.
- **Lo de adentro de una tarjeta** (escenas, ambientes, botones) se ordena arrastrando cuando esa tarjeta está abierta para editar (tocala primero).
- **Agregar**: el **+** que aparece arriba de cada tarjeta al pasar el mouse agrega una justo antes; «+ Agregar tarjeta» al final de cada columna o banda agrega ahí; «+ Tarjeta» (arriba) la suma al final.
- **La pantalla del medio muestra el dashboard entero**, del ancho del equipo: no hay que deslizar adentro para llegar al final de una columna. Una línea punteada marca hasta dónde se ve en el equipo sin deslizar. Con «▶ Probar» vuelve a ser la pantalla del equipo.
- **⋮** en cada tarjeta: agregar una tarjeta arriba o abajo de esa, duplicar, **copiar, cortar y pegar** (desde la 2.33), mandar una copia a otro dashboard, pasarla a otra sección, **editar como texto** y borrar (también en las tarjetas de adentro de un ambiente).
- **Copiar, cortar y pegar** (2.33, como en Home Assistant): con la tarjeta elegida, **Ctrl+C** la copia, **Ctrl+X** la corta y **Ctrl+V** la pega abajo de la elegida (o al final). La copia queda guardada en el navegador: se puede pegar en **otro dashboard** o en el otro equipo (celular ↔ tablet). En «+ Tarjeta» aparece arriba «📋 Pegar la tarjeta copiada».
- **Editar como texto** (2.33, como el editor de código de Home Assistant): en ⋮, toda la tarjeta en texto (JSON) para ajustar algo que no está en las pestañas o pasar una tarjeta armada por mensaje. Si algo está mal escrito no se cambia nada y dice qué.
- **+ Tarjeta**: el catálogo con buscador, ordenado por La casa, Seguridad, Información, Multimedia y Otras, con un dibujito de cómo se ve cada tarjeta. **+ Agregar tarjeta** al final de cada columna. Las tarjetas nuevas ya muestran algo: Botones arranca con cuatro equipos de la casa, Ambientes con los cuatro con más equipos, Sensor con uno de temperatura, y Texto como nota para escribir.
- **+ Tarjeta → Por equipo** (2.33, como «Agregar por entidad» de Home Assistant): marcás equipos de la casa (con buscador por nombre o ambiente) y se arman solas las tarjetas que les van: todas las luces juntas en una de Luces, las cortinas en Cortinas, cada aire en su termostato, las cámaras en una de Cámaras, cada sensor y cada cerradura en la suya, portones e interruptores como Botones, escenas en Escenas. Abajo dice qué se va a armar antes de agregarlo.
- **Empezar de cero** (2.33, en ⋯ → «Este diseño»): deja el diseño vacío (un título y secciones vacías) para armarlo a medida; ahí mismo está «Aplicar una plantilla…». Ctrl+Z lo deshace.
- **En el celular** (2.33) la ventana de una tarjeta sube desde abajo a todo el ancho, y la pantalla se desplaza sola para que la tarjeta elegida quede a la vista arriba.
- **Hasta 60 tarjetas** por diseño (antes 30). Al llegar al tope el editor lo dice en vez de dejar agregar y no poder guardar.
- Si la casa no acepta un guardado (un dato mal escrito), el editor dice **qué tarjeta y qué dato** (por ejemplo «la tarjeta «Luces» de la tablet tiene el servicio mal cargado») y la abre. El servicio de una acción ofrece la lista de los servicios de la casa y no acepta uno mal escrito.
- **Barra de abajo**: arrastrá sus botones en la pantalla del medio para ordenarlos.
- **Sin listas desplegables**: cada opción se elige tocando botones; los íconos, en una grilla con su dibujo.
- **La barra de arriba**: ← y el nombre (abajo dice si ya se guardó) · **Celular / Tablet** (en la tablet, un botón la gira: Horizontal / Vertical) · ↶ ↷ · 🎨 Diseño · + Tarjeta · ▶ Probar · ⋯ · **Listo**.
- **Con el dedo** (en una tablet o el celular): mantené apretada una tarjeta, un botón o un equipo hasta que se levanta y arrastralo; si movés el dedo enseguida, la pantalla se desplaza como siempre.
- **🎨 Diseño**: todo el aspecto en un lugar: 1 · **Plantilla** (MatterAI, Vidrio, Panel, Elegante, Plano grande, y desde la 2.33 **Fácil** —botones grandes y pocos datos, para chicos o personas mayores—, **Seguridad** —las cámaras grandes, alarma, cerradura, aberturas, quién está y la actividad—, **Tablet de pared** —hora, clima, agenda, música, escenas, luces y el aire— y **Clima y consumo** —el termostato grande, el consumo, cortinas, luces, riego y pilas—; sólo a este equipo o al celular y la tablet juntos; Ctrl+Z la deshace), 2 · **Estilo** (MatterAI, Hogar, Cristal, Vidrio, Panel, Elegante, y desde la 2.31: **Vidrio líquido** —vidrio transparente con reflejos—, **Relieve** —botones con volumen que se hunden al prenderse—, **Editorial** —blanco, negro y rojo, como una revista—, **Plastilina** —formas infladas en pastel— y **Neo-brutal** —colores fuertes con bordes negros y sombras duras—; todos con versión oscura y clara). El estilo se ve en todo: la pantalla principal, los ambientes, los paneles, la música, la actividad y las ventanas de cada equipo y de cámaras, 3 · **Fondo** (degradés, un color o una foto de la casa), 4 · **Modo** (oscuro, claro o automático) y el nombre. Cada diseño (celular y tablet) tiene el suyo. Abajo dice qué puede cambiar el cliente desde su app.
- **Tamaño del plano**: tocá el plano → Tamaño: chico, mediano, normal o grande.
- **Cómo se ve cada tarjeta**: Ambientes (lista, grilla o tarjetas grandes), Escenas (botones o portadas de colores), Botones (grilla, lista, mosaicos con interruptor o fila de accesos) y el termostato grande con los modos del aire.
- **Ambientes por dentro**: abrí un ambiente y arrastrá cada equipo a su lugar directo en la pantalla del medio. Desde la 2.34 se edita como una tarjeta: pestañas **Contenido** (nombre, equipos, tarjetas del ambiente) y **Aspecto** (cómo se abre, dónde van las cámaras, ícono). **Tocá un equipo** en la pantalla (o ✎ en la lista) y se abre solo: nombre en ese ambiente, moverlo antes o después, sacarlo; en el editor tocarlo no lo prende.
- **Ventana o página completa** (2.34, Aspecto del ambiente): el ambiente se abre como ventana encima del inicio (lo de siempre) o como una **página** que ocupa toda la pantalla. Vale en la app y en todos los dashboards.
- **Cámaras del ambiente** (2.34): se ven en la **tarjeta de cámaras de MatterAI** (en vivo, pasar con ‹ › o deslizando, zoom, pantalla completa), ya no como fotos sueltas. En Aspecto se elige si van arriba de todo, después de los equipos o al final.
- **Zoom en las cámaras** (2.34): con zoom, arrastrar el dedo mueve la imagen y ya no cambia de cámara; para pasar de cámara, sin zoom (o con ‹ ›).
- **Tarjetas dentro de un ambiente**: con el ambiente abierto, «+ Agregar tarjeta» arriba o abajo de sus equipos (o en el panel: «+ Tarjeta arriba / abajo»). Puede ser cualquier tarjeta: la cámara del ambiente, escenas, botones, música, texto, una imagen… Se tocan, se editan con la misma ventana que todas y se arrastran para ordenarlas. Son **de la casa** (se ven en todos los dashboards y en la app); con «Tarjetas propias de este ambiente sólo en este dashboard» ese dashboard tiene su versión y los demás siguen con la de la casa. Guardar / Cancelar de una tarjeta del ambiente vuelve al ambiente, y Ctrl+Z también deshace lo de adentro.
- **Plano e imágenes** (en ⋯): el render de la casa (de noche, con luces y de día) y sus ambientes: puntos para paredes de más de 4 lados, mover la zona, doble clic para borrar un punto, Ctrl+Z.
- **▶ Probar**: usás la pantalla como en el celular (prender luces, entrar a un ambiente).
- **Simular** (en ⋯): ver cómo queda de noche, con la alarma armada, con música, etc., sin tocar la casa. Mientras simula, arriba dice «Simulando: …» y la ✕ lo apaga.
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
- **Voz: «Mate»**. Tocás el micrófono y pedís («prendé la luz del living», «poné música en el quincho»). La respuesta se dice en voz alta; en el iPhone, desde el navegador, queda escrita en pantalla (Safari deja el micrófono mudo después de hablar). Con **«Escuchar «Mate»»** prendido (Opciones → Pantalla, o en la pantalla de voz) no hace falta tocar nada: decís **«Mate»**, suena un tilín y pedís. Escucha en el equipo, sin internet (el audio no sale de la tablet o el celular), mientras la app está abierta: ideal para la tablet de pared. La primera vez baja la voz en español (unos 40 MB). «Mate» se activa sola al principio de la frase, así que «tomamos mate» no la despierta.
- **Opciones**: pantalla (modo claro u oscuro, **estilo de la pantalla**: el de tu instalador o una de las plantillas Vidrio, Panel, Elegante o Plano grande, protector, tablet de pared), conexión (local o remota), huella, accesos rápidos (widgets, botones rápidos, NFC), agregar otro celular y desvincular.
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

### Estilos de tarjeta nuevos (para cualquier dashboard)
- **Botones → Equipos**: el nombre arriba, el ícono grande y fino al medio, el estado y el interruptor abajo.
- **Botones → Panel táctil**: cuadrados con el ícono grande y el nombre abajo (como un panel de pared).
- **Hora → Día y hora en dos cuadros**; **Clima → Cuadro**; **Música → Tarjeta con controles** (anterior, pausa, siguiente y la barra del tema); **Consumo → Barras** (las últimas 24 h).
- **Encabezado → Saludo**: «Buenas tardes» (con un nombre, si querés) y cómo está la casa, en vez de la hora.
