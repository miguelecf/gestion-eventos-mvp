# Decisiones funcionales y de alcance

Este documento consolida las decisiones cerradas del plan y las reglas de negocio confirmadas en la versión corregida. Los identificadores del reporte se conservan como referencias, no como títulos. Es fuente para los capítulos finales del TFI.

## Decisiones cerradas del plan

1. **Instrucciones:** `AGENTS.md` es el archivo canónico para todos los agentes; `CLAUDE.md` sólo lo importa.
2. **Arquitectura:** la aplicación mantiene un monolito modular tipo microservicios. Las fronteras se documentan y vigilan con ArchUnit y lint. La deuda actual se congela; este plan no la refactoriza.
3. **Permisos y reglas de negocio:** USUARIO puede leer catálogos; la baja lógica de eventos se permite en cualquier estado para roles admin; AT consulta conflictos de prioridad, pero sólo AF y AC los resuelven; el motivo de rechazo de una solicitud se comunica al solicitante y el de un evento es interno; la conformidad técnica es obligatoria para aprobar.
4. **Alcance local:** `.atl/` se elimina, mientras `artifacts/` y `synthetic-user-engine/` permanecen locales e ignorados.

## Alcance futuro

- La pantalla de resolución de conflictos queda para trabajo futuro. Hoy, la consulta y resolución están disponibles por API.

## Reglas de negocio confirmadas

### Conformidad técnica obligatoria (hallazgo 3.1)
- Un evento pasa a `APROBADO` sólo con `ceremonialOk` **y** `technicalOk`, aunque `requiresTech=false`.
- **Motivo:** la conformidad técnica es una validación institucional del área, no sólo una reserva de capacidad.
- `requiresTech` determina si el evento **consume capacidad técnica**. No determina si Técnica interviene.
- **Implementación:** `EventStatusService.handleApproval`.

### `CONVERTIDO` no equivale a `APROBADO` (hallazgo 2.1, REQ-02)
- La solicitud (`RECIBIDO` → `EN_REVISION` → `CONVERTIDO`/`RECHAZADO`) y el evento creado al convertirla tienen ciclos de vida distintos. Convertir significa aceptar la solicitud para tramitarla; el evento nace en `EN_REVISION` y solo se aprueba con las dos conformidades.
- **Tracking público y correo:** si existe el evento, manda su estado ("Convertida a evento · En revisión", "Reservada", "Aprobada", "Rechazada"); el correo de conversión aclara que falta la conformidad de Ceremonial y Técnica.
- **Interfaz interna:** `CONVERTIDO` se muestra como "Convertido" con color propio (celeste); el verde queda reservado al evento `APROBADO`.

### Soporte técnico al convertir una solicitud (hallazgo 3.2, REQ-01)
- La solicitud pública no declara `requiresTech`; el solicitante solo informa `technicalSchedule`, que es informativo (ver hallazgo 3.6).
- El área lo define al convertir la solicitud en evento (`POST /admin/event-requests/{id}/convert-to-event`, body opcional `{requiresTech, techSupportMode}`), y el valor se conserva en el evento creado.
- Sin body, o con `requiresTech=false`, el evento no consume capacidad técnica. Con `requiresTech=true` y sin modo, el modo es `SETUP_ONLY`.
- Con `requiresTech=true`, la conversión valida la capacidad técnica del rango y se rechaza si no hay cupo.
- **Implementación:** `EventRequestService.convertToEvent`; en la interfaz, el diálogo de conversión de `PublicRequestDetailPage`. **Test:** `RequestConversionIntegrationTest`.

### Administración de la capacidad técnica (hallazgo 3.5)
- La configuración (`tech_capacity_config`: minutos por bloque y cupos por bloque) se gestiona por **migración Flyway**. No hay pantalla de administración.
- Si existiera más de una configuración activa, gana siempre la de mayor `id`, de forma determinística (hallazgo 5.3).
- Para cambiar la capacidad se agrega una migración que desactiva la vigente e inserta la nueva.

### `technicalSchedule` es informativo (hallazgo 3.6)
- El “horario técnico” que informa el solicitante o el área **no** participa del cálculo de capacidad.
- La capacidad se calcula con `scheduleFrom`/`scheduleTo`, los buffers y `techSupportMode`:
  - `ATTENDED`: horario completo más buffers.
  - `SETUP_ONLY`: sólo los tramos de montaje y desmontaje.
- **Implementación:** `TechCapacityService.computeBlocks`.

### Conformidades parciales (hallazgo 3.9)
- Cada área registra su conformidad de forma independiente. Un OK parcial se guarda y la API responde `202` con las conformidades faltantes.
- La validación de disponibilidad y capacidad se ejecuta **al completar** la aprobación (o al reservar).
- **Motivo:** la conformidad expresa la evaluación de cada área. Que la agenda sea viable se garantiza en la transición que efectivamente bloquea el recurso.

### Edición de eventos
- Se permite editar eventos en `EN_REVISION`, `RESERVADO` y `APROBADO`; un evento `RECHAZADO` no se edita.
- Si un evento `RESERVADO` o `APROBADO` cambia la agenda, la ubicación o los buffers, vuelve a `EN_REVISION` para una nueva revisión.
- **Implementación verificada:** `EventService.update` rechaza `RECHAZADO` y restablece `EN_REVISION` cuando cambian agenda o buffers en un estado bloqueante; `EDITABLE_EVENT_STATUSES` en `frontend/src/features/events/utils/edit-event.ts` coincide con los tres estados permitidos.

### Envío de correos (hallazgo 5.5)
- Los correos se envían **después del commit** (`@TransactionalEventListener(AFTER_COMMIT)`, `@Async`). Una falla de entrega no revierte la operación de negocio: se registra en el log con nivel `WARN`, junto con el destinatario y el agregado.
- `app.mail.mock-mode=true` (perfil local por defecto) **no envía** correos, sólo los registra en el log, incluidas las contraseñas temporales. Al arrancar se emite un `WARN` explícito.
- El perfil `docker` usa `MAIL_MOCK_MODE=false` y entrega en Mailpit.
- Correos al solicitante:
  - alta, con código y link de seguimiento;
  - solicitud en revisión;
  - solicitud rechazada, con motivo;
  - solicitud convertida en evento;
  - luego, cada cambio de estado del evento.

### Ubicación libre (hallazgo 6.1)
- Los eventos con `freeLocation` (texto libre, sin espacio del catálogo) **no se validan como recurso exclusivo**: dos eventos pueden indicar el mismo lugar libre a la misma hora.
- **Motivo:** la ubicación libre representa lugares no gestionados por la institución (patios, espacios externos).
- Un lugar que deba bloquearse tiene que darse de alta como **Espacio** en el catálogo.
- **Implementación:** `AvailabilityService.checkSpaceAvailability` (`skipped=true`).

## Otras decisiones funcionales

- **Rol USUARIO:** consulta eventos y catálogos; crea **solicitudes** (formulario público, accesible desde “Solicitar evento”); no crea, edita ni da de baja eventos. Ver `docs/permisos.md`.
- **Conflictos de prioridad:** los consultan los tres roles admin y los resuelven sólo ADMIN_FULL y ADMIN_CEREMONIAL; las decisiones son `REBOOK_OTHER` y `KEEP_ORIGINAL`; el decisor es siempre el usuario autenticado.
- **Baja de eventos:** es lógica (soft-delete), queda auditada (`EVENT_DELETED`) y se permite en cualquier estado a los roles admin.
- **Motivos de rechazo:** el de una **solicitud** es obligatorio y se comunica al solicitante (correo y seguimiento); el de un **evento** es obligatorio y queda en la auditoría interna.
- **Seguimiento público:** expone sólo nombre, estados, fecha y hora, ubicación legible, una línea temporal de cambios de estado y de agenda, y el motivo de rechazo de la solicitud; nunca expone comentarios internos, IDs ni datos administrativos.
- **Calendario público:** `GET /public/events` expone sólo id, nombre, fecha y horario, estado, prioridad, espacio o ubicación libre y departamento; nunca expone el contacto del solicitante, usuarios, observaciones ni datos de gestión.
- **Rechazos por conflicto de espacio o capacidad:** no se auditan, porque abortan la operación (`409`) sin persistir cambios; el usuario recibe el detalle del conflicto en la respuesta.
- **Concurrencia de capacidad técnica:** las operaciones que consumen capacidad se serializan con un bloqueo pesimista sobre la configuración activa; el pool de conexiones usa `READ_COMMITTED`.
