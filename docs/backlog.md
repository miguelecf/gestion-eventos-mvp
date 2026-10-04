# Backlog de producto y arquitectura

Este documento reúne trabajo futuro que no forma parte de la funcionalidad actual. Las rutas y permisos describen el contrato vigente del backend; no implican que ya exista una pantalla para consumirlo.

## Resolver conflictos de prioridad

**Objetivo:** permitir que los roles autorizados revisen conflictos abiertos y resuelvan uno conservando el evento original o reubicando el evento desplazado.

### Contrato existente

| Acción | Endpoint | Acceso efectivo | Entrada y salida |
|---|---|---|---|
| Consultar conflictos pendientes | `GET /api/priority/conflicts/pending` | `ADMIN_FULL`, `ADMIN_CEREMONIAL` y `ADMIN_TECNICA` | Responde una página de `PendingPriorityConflictResponse`: `conflictId`, `highEventId`, `displacedEventId`, `spaceId`, `date`, `from`, `to`, `priorityHigh`, `priorityDisplaced`, `requiresRebooking`, `createdAt` y `createdByUserId`. La página usa orden descendente por `createdAt` por defecto. |
| Resolver un conflicto | `POST /api/priority/decisions` | Solo `ADMIN_FULL` y `ADMIN_CEREMONIAL` | JSON `{"conflictId":"…","decision":"REBOOK_OTHER"|"KEEP_ORIGINAL","target":{"date":"yyyy-MM-dd","from":"HH:mm","to":"HH:mm","spaceId":1},"reason":"…"}`. `target` es opcional para el DTO, pero requerido por el servicio al elegir `REBOOK_OTHER`; `reason` es opcional. Responde `conflictId`, `decision` y `status` (HTTP 201). |

La consulta acepta los parámetros estándar de `Pageable` (`page`, `size`, `sort`); la respuesta es `Page<PendingPriorityConflictResponse>` con `content` y metadatos de página como número, tamaño y totales. Si no se envía `sort`, el controller usa `createdAt,DESC`.

El cliente nunca envía el usuario decisor: el servicio usa la identidad autenticada. `REBOOK_OTHER` valida disponibilidad y capacidad técnica aplicables; no se debe presentar la reubicación como confirmada hasta recibir respuesta exitosa. Un conflicto cerrado responde 409; un conflicto inexistente, 404. `KEEP_ORIGINAL` cierra el conflicto sin cambiar fecha/espacio del evento desplazado y desactiva `requiresRebooking`.

### Criterios de hecho

- [ ] La pantalla obtiene y pagina los conflictos pendientes mediante el endpoint existente; muestra fecha, horario, espacio, eventos/prioridades e indicador de reubicación requerida sin inferir campos que la API no devuelve.
- [ ] Solo `ADMIN_FULL` y `ADMIN_CEREMONIAL` ven/pueden ejecutar acciones de resolución; `ADMIN_TECNICA` conserva acceso de lectura. La UI usa CASL como control de presentación y el backend sigue siendo la autoridad.
- [ ] `KEEP_ORIGINAL` envía únicamente `conflictId` y `decision` (más `reason` solo si se captura) y refresca el listado ante éxito.
- [ ] `REBOOK_OTHER` solicita fecha, hora inicial/final y espacio; envía `target` con los nombres y formatos exactos del DTO. No permite enviar `deciderUserId`.
- [ ] Se muestran errores observables del backend para conflicto cerrado, inexistente, disponibilidad/capacidad y validación, sin retirar el conflicto del listado como si se hubiera resuelto.
- [ ] Pruebas cubren visualización por permisos, ambas decisiones, target ausente para `REBOOK_OTHER`, error del servidor y actualización tras éxito; los tests backend de acceso existentes continúan verdes.

**Fuentes:** `PriorityConflictController`, `PendingPriorityConflictResponse`, `PriorityConflictDecisionRequest`, `PriorityConflictDecisionResponse`, `PriorityConflictService`, `SecurityConfig`, `PriorityConflictAccessIntegrationTest`, `docs/permisos.md` y `docs/decisiones-funcionales.md`.

## Pagar deuda de límites entre módulos

Seguir este orden, que prioriza propiedad de escrituras antes de reubicar eventos y restringir acceso a repositorios. En cada tramo, inspeccionar consumidores actuales, mover una operación al servicio dueño cuando corresponda, actualizar `docs/arquitectura.md`, añadir pruebas del comportamiento/límite y retirar solo la arista que ya no tenga consumidores. No convertir las dependencias actuales en excepciones silenciosas.

1. **Escrituras ajenas (primero).** Mover las escrituras directas de `EventRequestService` sobre `Event`, `EventHistory` y `EventRequestHistory`, y de `PriorityConflictService` sobre `Event`, a operaciones transaccionales del módulo dueño. Preservar auditoría, estado y atomicidad.
2. **Eventos junto a sus publicadores (segundo).** Mover los contratos actualmente declarados en `feature/notifications/event` a `feature/<publisher>/event` para `comments`, `events`, `priority` y `requests`. Transportar IDs/datos escalares, no entidades JPA; mantener los efectos post-commit con `@TransactionalEventListener(AFTER_COMMIT)`. Revisar explícitamente `PriorityConflictEvent`, cuyo listener no se observa en el estado documentado, antes de decidir si se elimina o se agrega consumidor.
3. **Repositorios ajenos (tercero).** Retirar inyecciones/uso externo de repositorios privados y reemplazarlos por operaciones/consultas de servicios dueños o contratos explícitos. Verificar el inventario completo en el código al iniciar cada lote; los ejemplos actuales incluyen `CustomUserDetailsService`, `AvailabilityService`, `EventService`, `EventRequestService`, `PriorityConflictService` y componentes de notificaciones.

### Criterios de hecho por tramo

- [ ] No quedan escrituras directas fuera del módulo dueño para las tablas cubiertas por el tramo; tests prueban el estado/auditoría esperado y la atomicidad relevante.
- [ ] Los eventos movidos viven en el paquete `event` del publisher, tienen payload estable sin entidades JPA y sus listeners conservan semántica post-commit; el caso sin listener tiene decisión explícita y prueba/documentación coherente.
- [ ] No quedan imports/inyecciones ajenos a `feature.*.repository` fuera del módulo propietario para las clases cubiertas; las operaciones mantienen resultados y permisos observables.
- [ ] Se actualizan el mapa/deuda de `docs/arquitectura.md` y las listas de `ModuleBoundariesTest` al retirar aristas; las pruebas existentes y los tests de módulo afectado pasan.

**Dependencia/bloqueo actual:** la guarda backend C1 (`ModuleBoundariesTest`) está bloqueada. El intento encontró que `PriorityConflictController` referencia `PriorityConflict`, cuya entidad enlaza `Event` y `User`; la regla estricta de controller del plan no permite esa dependencia. C1 no debe darse por resuelto ni la deuda de límites por cubierta hasta aislar los tipos expuestos del controller o recibir una decisión explícita que modifique la regla del plan. Este backlog no cambia esa regla ni autoriza una allowlist nueva.

**Fuentes:** sección [Deuda](arquitectura.md#deuda) y reglas vigentes de [Arquitectura](arquitectura.md); los nombres y ejemplos son inventario documentado y deben contrastarse con los imports/consumidores actuales al tomar cada tarea.

## Actualizar `synthetic-user-engine` (condicional)

El motor sintético local está ignorado/no versionado y su contrato fue identificado como antiguo. No actualizar ni publicar esa carpeta como parte automática de este backlog. Primero decidir explícitamente si se versionará y cuál será su dueño/fuente de contrato. Si se decide versionarlo, actualizarlo contra endpoints, roles y payloads actuales documentados y verificar sus escenarios contra el backend vigente; si no se versiona, mantenerlo fuera del alcance y no tratarlo como evidencia de compatibilidad.

### Criterios de hecho si se aprueba versionarlo

- [ ] Hay una decisión registrada sobre versionado, ubicación y mantenimiento antes de tocar los artefactos locales.
- [ ] El motor consume solo contratos vigentes contrastados con controllers/DTOs y `SecurityConfig`; no reproduce payloads/roles obsoletos.
- [ ] Sus escenarios se ejecutan contra el backend de prueba actual y el resultado queda registrado. La prueba del motor no sustituye tests de integración backend ni E2E.

**Dependencia:** decisión de versionado pendiente; hasta entonces no hay tarea de implementación aprobada.
