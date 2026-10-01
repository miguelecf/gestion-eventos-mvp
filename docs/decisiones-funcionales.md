# Decisiones funcionales del producto corregido

Reglas de negocio que el reporte de hallazgos pedía **confirmar o documentar**, en lugar de cambiar código. Cada una refleja el comportamiento real de la versión corregida. Fuente para los capítulos finales del TFI.

## 3.1 La conformidad técnica es siempre obligatoria
- Un evento pasa a `APROBADO` sólo con `ceremonialOk` **y** `technicalOk`, aunque `requiresTech=false`.
- **Motivo:** la conformidad técnica es una validación institucional del área, no sólo una reserva de capacidad.
- `requiresTech` determina si el evento **consume capacidad técnica**. No determina si Técnica interviene.
- **Implementación:** `EventStatusService.handleApproval`.

## 3.5 Administración de la capacidad técnica
- La configuración (`tech_capacity_config`: minutos por bloque y cupos por bloque) se gestiona por **migración Flyway**. No hay pantalla de administración.
- Si existiera más de una configuración activa, gana siempre la de mayor `id`, de forma determinística (hallazgo 5.3).
- Para cambiar la capacidad se agrega una migración que desactiva la vigente e inserta la nueva.

## 3.6 `technicalSchedule` es informativo
- El "horario técnico" que informa el solicitante o el área **no** participa del cálculo de capacidad.
- La capacidad se calcula con `scheduleFrom`/`scheduleTo`, los buffers y `techSupportMode`:
  - `ATTENDED`: horario completo más buffers.
  - `SETUP_ONLY`: sólo los tramos de montaje y desmontaje.
- **Implementación:** `TechCapacityService.computeBlocks`.

## 3.9 Conformidades parciales
- Cada área registra su conformidad de forma independiente. Un OK parcial se guarda y la API responde `202` con las conformidades faltantes.
- La validación de disponibilidad y capacidad se ejecuta **al completar** la aprobación (o al reservar).
- **Motivo:** la conformidad expresa la evaluación de cada área. Que la agenda sea viable se garantiza en la transición que efectivamente bloquea el recurso.

## 5.5 Envío de correos
- Los correos se envían **después del commit** (`@TransactionalEventListener(AFTER_COMMIT)`, `@Async`). Una falla de entrega no revierte la operación de negocio: se registra en el log con nivel `WARN`, junto con el destinatario y el agregado.
- `app.mail.mock-mode=true` (perfil local por defecto) **no envía** correos, sólo los registra en el log, incluidas las contraseñas temporales. Al arrancar se emite un `WARN` explícito.
- El perfil `docker` usa `MAIL_MOCK_MODE=false` y entrega en Mailpit.
- Correos al solicitante:
  - alta, con código y link de seguimiento;
  - solicitud en revisión;
  - solicitud rechazada, con motivo;
  - solicitud convertida en evento;
  - luego, cada cambio de estado del evento.

## 6.1 Ubicación libre
- Los eventos con `freeLocation` (texto libre, sin espacio del catálogo) **no se validan como recurso exclusivo**: dos eventos pueden indicar el mismo lugar libre a la misma hora.
- **Motivo:** la ubicación libre representa lugares no gestionados por la institución (patios, espacios externos).
- Un lugar que deba bloquearse tiene que darse de alta como **Espacio** en el catálogo.
- **Implementación:** `AvailabilityService.checkSpaceAvailability` (`skipped=true`).

## Otras decisiones tomadas durante la corrección
- **Rol USUARIO:**
  - consulta eventos y catálogos;
  - crea **solicitudes** (formulario público, accesible desde "Solicitar evento");
  - no crea, edita ni da de baja eventos.
  - Ver `docs/permisos.md`.
- **Conflictos de prioridad:**
  - los consultan los tres roles admin y los resuelven sólo ADMIN_FULL y ADMIN_CEREMONIAL;
  - las decisiones son `REBOOK_OTHER` y `KEEP_ORIGINAL`;
  - el decisor es siempre el usuario autenticado.
- **Baja de eventos:** es lógica (soft-delete), queda auditada (`EVENT_DELETED`) y se permite en cualquier estado a los roles admin.
- **Motivos de rechazo:**
  - el de una **solicitud** es obligatorio y se comunica al solicitante (correo y seguimiento);
  - el de un **evento** es obligatorio y queda en la auditoría interna.
- **Seguimiento público:**
  - expone sólo nombre, estados, fecha y hora, ubicación legible, una línea temporal de cambios de estado y de agenda, y el motivo de rechazo de la solicitud;
  - nunca expone comentarios internos, IDs ni datos administrativos.
- **Rechazos por conflicto de espacio o capacidad:**
  - no se auditan, porque abortan la operación (`409`) sin persistir cambios;
  - el usuario recibe el detalle del conflicto en la respuesta.
- **Concurrencia de capacidad técnica:**
  - las operaciones que consumen capacidad se serializan con un bloqueo pesimista sobre la configuración activa;
  - el pool de conexiones usa `READ_COMMITTED`.
