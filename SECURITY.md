# Política de seguridad

## Reportar una vulnerabilidad

Escribí a **security@matterai.com.ar** con la descripción, los pasos para reproducirlo y la versión.

- Respondemos en **72 horas hábiles** y te mantenemos al tanto hasta la corrección.
- Pedimos **no divulgarlo** hasta que esté corregido (máximo 90 días).
- No tomamos acciones legales contra quien investigue **de buena fe**: sin dañar casas reales, sin acceder a datos de terceros y sin interrumpir el servicio.
- No abras un issue público con detalles de una vulnerabilidad.

## Versiones con soporte

Sólo la **última versión publicada** recibe correcciones de seguridad. Actualizá por HACS.

## Lo que hace la integración para proteger cada casa

- Un acceso propio por celular, que se puede desvincular solo. La vinculación usa códigos de un solo uso.
- Registro de auditoría de cada casa, que no se puede editar, de cerraduras, alarma, portones, cámaras y accesos.
- Las copias que salen de la casa no llevan links de invitado, historiales ni claves.
- Avisos si Home Assistant está expuesto sin bloqueo de intentos o si hay administradores sin 2 pasos.
- Pruebas automáticas (incluidas las negativas), CodeQL, Semgrep y pip-audit en cada cambio.
