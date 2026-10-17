# Registro de cambios por ticket

Bitácora de los tickets `SEC-xx` del sistema de tickets externo. Los tickets se revisan de a uno, aunque el hallazgo figure como corregido en [el historial](historial/hallazgos-2026-10.md): primero se verifica el código y el test, y después se corrige o se agrega cobertura.

- **Horario:** hora del commit, en Argentina (UTC−03:00).
- **Commit:** hash corto del commit que contiene el cambio. Los commits que solo actualizan esta bitácora no se registran.
- **Estado:** `verificado` (ya estaba corregido; solo se agregó cobertura) o `corregido` (había una fuga y se arregló).

## Log

| Fecha y hora | Ticket | Commit | Tipo | Cambio | Verificación |
|---|---|---|---|---|---|
| 2026-10-11 12:26 | SEC-01 | `fb280b3` | test | Test de borde: el tracking no expone el motivo ni la nota internos del rechazo de un evento convertido. | `PublicTrackingIntegrationTest` 2/2 |
| 2026-10-17 14:52 | SEC-02 | `187ac5f` | fix | `GET /public/events` responde `PublicEventDto` en lugar del DTO interno; sin contacto del solicitante ni datos de gestión. | `PublicEventsIntegrationTest`; suite backend 48/48; frontend `tsc -b`, build y lint |
| 2026-10-17 16:06 | SEC-02 | `002aad7` | test | El calendario público expone exactamente los campos de `PublicEventDto` y solo eventos aprobados, activos y no internos; cubre `freeLocation` sin espacio. | `PublicEventsIntegrationTest` 2/2 |

## SEC-01 — Comentarios internos en el tracking público

**Estado:** verificado. El fix original es `2b509af` (hallazgo 1.1, P0).

- `TrackingResponse` expone solo nombre, estados, agenda, ubicación legible, línea temporal y motivo de rechazo de la solicitud.
- `EventRequestService.buildTimeline` incluye solo `STATUS` y `SCHEDULE_CHANGE`/`REPROGRAM`, sin `details`; descarta comentarios, toggles de visibilidad, conformidades y el resto de la auditoría.
- `rejectionReason` toma solo el motivo de la solicitud; el del evento es interno.
- Los correos al solicitante incluyen solo el motivo de rechazo de la solicitud.
- **Cobertura agregada:** solicitud con motivo en un cambio de estado que no es rechazo, convertida y luego rechazada como evento con motivo y nota internos. El tracking muestra el evento `RECHAZADO`, sin `rejectionReason` y sin ninguno de los textos internos.

## SEC-02 — Acceso público al listado de solicitudes y sus datos personales

**Estado:** corregido.

- **Listado de solicitudes:** ya estaba eliminado en `4a992d4` (hallazgo 1.2, P0). `listadoPublicoDeSolicitudesYaNoExiste` lo cubre, y la bandeja `/admin/event-requests` rechaza a USUARIO y a anónimos.
- **Fuga abierta:** `GET /public/events` (anónimo) devolvía `EventResponseDto` completo. Al convertir una solicitud, el evento copia `contactName`, `contactEmail` y `contactPhone` (`EventRequestService`), de modo que el contacto del solicitante quedaba público, junto con el email de `createdBy`/`lastModifiedBy`, observaciones, buffers, flags de gestión y `originRequestId`.
- **Cambio:** `PublicEventDto` con id, nombre, fecha, horario, estado, prioridad, `spaceName`, `freeLocation` y `departmentName`. El frontend (`public-events.ts`, `PublicCalendarPage.tsx`) consume ese contrato. Regla registrada en [decisiones funcionales](decisiones-funcionales.md).
- **Decisión:** la prioridad se mantiene en el contrato público porque el calendario la usa para el color.
- **Verificación en OrbStack:** con el stack de Compose levantado, `GET /public/events` en `127.0.0.1:8080` devolvió solo los campos del DTO público. El E2E no se corrió; el smoke solo usa el `id` del evento, que se conserva.
- **Revisión con Pi:** `opencode-go/deepseek-v4-pro`, `openai/gpt-6.1-sol` y `minimax/MiniMax-M3`, en solo lectura. Los tres coincidieron en que la fuga queda cerrada y en que el resto de `/public/**` no expone datos personales ni de gestión. Se aceptaron sus huecos de test (lista exacta de campos, exclusión de internos/inactivos/no aprobados, `freeLocation`), cubiertos en `002aad7`.

## Incidencias de entorno

- **2026-10-17 — Maven falla con `cannot find symbol` en clases con Lombok.** El plugin `jdtls-lsp` de Claude Code lanza Eclipse JDT LS (`jdtls` de Homebrew) sin el agente de Lombok. JDT LS importa el proyecto Maven, genera `.classpath`/`.project`/`.settings` (ignorados por git) y compila en el mismo `target/classes` que Maven. Esas clases salen sin getters, builders ni constructores de Lombok; como son más nuevas que los fuentes, Maven no recompila `main` y falla `testCompile`. Solución inmediata: `./mvnw clean test`. Los errores de Lombok que muestra el editor no son reales.
