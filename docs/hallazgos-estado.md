# Estado de corrección de hallazgos

Fuente: el reporte "Errores Gestión de Eventos". Se atacan de **menor a mayor complejidad**. Un commit por ID.

- **Estados:** `pendiente` · `en curso` · `corregido` · `documentado` (decisión sin cambio de código) · `descartado`.
- **Próxima migración Flyway libre:** `V13`.

## Hallazgos adicionales detectados durante la corrección
- **2.7-bis:** al loguearse con contraseña temporal, el frontend ignoraba `mustChangePassword` y entraba con un token que sólo sirve para cambiar la contraseña, así que todas las pantallas daban 403. Además, `currentPassword` podía omitirse si la contraseña no era temporal. Corregido en el mismo commit que 2.7.
- **2.1-bis:** el tracking esperaba el estado `SOLICITADO` en la solicitud, pero el backend usa `RECIBIDO`. Si un evento convertido terminaba `RECHAZADO`, la página igual decía "Aprobada". Corregido en 2.1.
- **Pendiente (1.5):** el dashboard de USUARIO consulta conflictos y capacidad técnica, que ahora le responden 403. Hay que condicionar esas consultas por rol.

| Fase | ID | Hallazgo | Estado | Commit | Test |
|:-:|---|---|---|---|---|
| 1 | 2.1 | CONVERTIDO mostrado como "Aprobada" | corregido | eaf4a8d | tsc (UI) |
| 1 | 2.2 | Baja de evento usa DELETE inexistente | corregido | 3097d76 | tsc (UI) |
| 1 | 2.7 | Cambio de contraseña propio (DTO + botón) | corregido | 0979086 | ChangePasswordIntegrationTest |
| 1 | 3.4 | Decisión CANCELLED sin efecto → eliminar | corregido | f00f3e5 | PriorityConflictAccessIntegrationTest |
| 1 | 1.6 | `/api/priority/conflicts/pending` sin rol | corregido | 9f0d668 | PriorityConflictAccessIntegrationTest |
| 1 | 5.3 | Varias configs de capacidad activas | corregido | dd0415b | compilación |
| 1 | 6.3 | Motivo de rechazo opcional en backend | corregido | 16c466e | EventRejectionIntegrationTest |
| 1 | 2.10 | Promesa de sugerencias automáticas | corregido | ac157d9 | suite completa |
| 2 | 1.1 | Tracking expone comentarios internos (P0) | pendiente | | |
| 2 | 1.3 | Tracking expone datos internos | pendiente | | |
| 2 | 1.7 | Decisor de conflicto informado por el cliente | pendiente | | |
| 2 | 4.5 | Soft-delete sin auditoría | pendiente | | |
| 2 | 3.7 | Cambio de buffers/freeLocation no vuelve a revisión | pendiente | | |
| 2 | 2.9 | Cambio de espacio a ubicación libre | pendiente | | |
| 2 | 3.3 | Estado SOLICITADO huérfano | pendiente | | |
| 2 | 3.2 | requiresTech no se define en la conversión | pendiente | | |
| 2 | 5.1 | expectedVersion/clientMutationId ficticios | pendiente | | |
| 3 | 2.4 | Bandeja admin sobre endpoint público | pendiente | | |
| 3 | 1.2 | Listado público de solicitudes con datos personales (P0) | pendiente | | |
| 3 | 1.4 | USUARIO con permisos excesivos (P0) | pendiente | | |
| 3 | 1.5 | Desalineación CASL vs backend | pendiente | | |
| 3 | 2.6 | Motivo de rechazo de solicitud mal modelado | pendiente | | |
| 3 | 4.1 | Historial de solicitud sin actor/motivo | pendiente | | |
| 3 | 4.2 | Sin endpoint admin de historial de solicitud | pendiente | | |
| 3 | 2.5 | Correos prometidos no enviados | pendiente | | |
| 3 | 2.3 | Filtros del listado sin soporte backend | pendiente | | |
| 3 | 4.3 | Tipos de auditoría sin uso | pendiente | | |
| 3 | 4.6 | Conflictos de prioridad fuera del historial | pendiente | | |
| 3 | 2.8 | Edición de comentarios sin UI | pendiente | | |
| 4 | 5.2 | Carrera en capacidad técnica | pendiente | | |
| 4 | 3.8 | Buffers que cruzan medianoche | pendiente | | |
| 4 | 4.4 | Auditoría incompleta de campos del evento | pendiente | | |
| 4 | 5.4 | Indicador de capacidad en frontend ≠ backend | pendiente | | |
| 4 | 6.2 | Reprogramación pendiente poco visible | pendiente | | |
| doc | 3.1 | technicalOk siempre obligatoria | documentado | | — ver `docs/permisos.md` |
| doc | 3.5 | Sin administración de capacidad técnica | pendiente | | |
| doc | 3.6 | technicalSchedule no afecta capacidad | pendiente | | |
| doc | 3.9 | Aprobación parcial antes de validar capacidad | pendiente | | |
| doc | 5.5 | Fallas de correo silenciosas | pendiente | | |
| doc | 6.1 | Ubicación libre no se valida como recurso | pendiente | | |
| test | 5.6 | Cobertura de flujos críticos | en curso | | harness `IntegrationTestBase` |
| final | 5.7 | Verificación E2E en entorno limpio | pendiente | | |
