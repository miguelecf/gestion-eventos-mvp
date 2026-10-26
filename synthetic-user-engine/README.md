# Motor de usuarios sintéticos

Cinco personas sintéticas recorren Gestión de Eventos por HTTP, como lo haría la interfaz, y cada paso verifica la regla de negocio que corresponde. Al terminar quedan datos realistas en la base y un informe con lo que pasó y lo que falló.

| Persona | Cuenta | Qué hace |
|---|---|---|
| Solicitante | sin cuenta | Consulta espacios y disponibilidad, pide eventos, sigue su pedido y mira el calendario público. |
| Ceremonial | `admin.ceremonial` | Revisa la bandeja, rechaza con motivo, convierte, da la conformidad ceremonial y resuelve conflictos de prioridad. |
| Técnica | `admin.tecnica` | Convierte, consulta la capacidad técnica y da la conformidad técnica. |
| Administración | `admin.full` | Carga actos de Rectorado, da ambas conformidades y administra cuentas. |
| Consulta | `viewer` | Lee la agenda interna e intenta lo que no le corresponde. |

Cada persona tiene su propia sesión: inicia sesión por `/auth/login` y, si el token vence, lo renueva con `/auth/refresh`, igual que el frontend. El motor no toca la base de datos ni cambia la contraseña, el rol o el estado de las cuentas semilla; sus ingresos solo actualizan la fecha del último acceso.

## Recorridos

| Recorrido | Qué comprueba |
|---|---|
| `matriz_de_permisos` | Lee `frontend/src/libs/permisos.json` y prueba cada operación con cada perfil. Sin sesión, todo lo interno debe responder 401; con un perfil sin permiso, 403. Las lecturas permitidas no deben rechazarse. Solo se ejecuta en la primera ronda. |
| `solicitud_aprobada` | Una solicitud pública recorre todo el circuito: disponibilidad, envío, seguimiento, revisión, conversión, comentarios internos, las dos conformidades, descuento de capacidad técnica y publicación en el calendario sin datos de contacto. |
| `solicitud_rechazada` | El rechazo exige motivo, el solicitante lo ve en el seguimiento y la solicitud ya no vuelve a revisión ni se convierte. |
| `conversion_simultanea` | Dos áreas convierten la misma solicitud en el mismo instante. Una sola gana y queda un único evento. |
| `reprogramacion` | Al mover la fecha de un evento aprobado, vuelve a revisión, pierde las conformidades y sale del calendario público. Una edición que no toca la agenda no lo reabre. |
| `choque_de_espacio` | Un evento reservado bloquea su espacio y horario. El armado también ocupa: lo que termina dentro de él choca y lo que termina justo antes entra. Al rechazarlo, el horario queda libre. |
| `conformidades` | Ninguna área otorga la conformidad de la otra. Si las dos la dan a la vez, ninguna se pierde. |
| `prioridad_rectorado` | Un acto de Rectorado desplaza a un evento reservado. Técnica no puede resolver el conflicto. Ceremonial reprograma al desplazado, que vuelve a revisión. Dos eventos de prioridad alta no se desplazan entre sí. |
| `baja_logica` | La baja saca el evento de la agenda, libera el espacio y queda en la auditoría con su autor. |
| `alta_de_cuenta` | Alta de una cuenta, primer ingreso con la clave del correo, cambio obligatorio de contraseña, intento fallido, cambio de rol sin volver a iniciar sesión, baja que corta la sesión e historial de la cuenta. |

Si un paso falla, el recorrido se corta, porque los pasos siguientes dependen de él, y la falla queda en el informe con el pedido y la respuesta.

## Uso

Requisitos: Python 3.10 o posterior y el stack levantado (ver [DOCKER.md](../DOCKER.md)).

```bash
cd synthetic-user-engine
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt

.venv/bin/python main.py                  # una ronda contra http://127.0.0.1:8080
.venv/bin/python main.py --rounds 5       # cinco rondas, para poblar la agenda de una demostración
.venv/bin/python main.py --only solicitud_aprobada prioridad_rectorado
.venv/bin/python main.py --list           # recorridos disponibles
```

| Opción | Uso |
|---|---|
| `--base-url` | Otra instancia, por ejemplo el stack E2E en `http://127.0.0.1:18080`. También `ENGINE_BASE_URL`. |
| `--mailpit-url` | Mailpit, para el primer ingreso de una cuenta nueva. También `ENGINE_MAILPIT_URL`. |
| `--seed` | Repite los mismos datos y decisiones, salvo el sufijo único de las cuentas nuevas. Sin semilla, se usa la hora. |
| `--shuffle` | Mezcla el orden de los recorridos en cada ronda. |
| `--pause` | Segundos de espera entre recorridos, para seguir la corrida desde la interfaz. |

El primer ingreso de una cuenta nueva necesita la clave temporal que llega por correo. El stack local publica Mailpit solo si se levanta con `docker compose -f docker-compose.yml -f docker-compose.mail-access.yml up`. Si no lo encuentra, el motor omite esos pasos y lo indica en el informe.

## Informe

Cada corrida escribe en `reports/` un Markdown para leer y un JSON con todos los pasos y todas las llamadas HTTP: persona, método, ruta, código y duración. El Markdown incluye las fallas, los pasos omitidos, el tráfico por persona, las llamadas más lentas y los errores del servidor.

El proceso termina con código 0 si no hubo fallas ni respuestas 5xx, con 1 si las hubo y con 2 si no pudo preparar la corrida (por ejemplo, credenciales semilla inválidas).

## Datos que deja

Los nombres de los eventos llevan al final la etiqueta de la corrida (`· 6a3f1c`), que también figura en el informe, así se distingue en la interfaz qué generó cada ejecución. Las fechas empiezan unos 400 días adelante, lejos de los datos de demostración, y cada recorrido usa un día propio. Los contactos usan el dominio reservado `example.test`, de modo que ningún correo sale a una dirección real.

El motor escribe en la base de la instancia a la que apunta. Para probar sin tocar datos locales, usar el stack descartable: `bash scripts/e2e/run.sh --keep` y después `--base-url http://127.0.0.1:18080 --mailpit-url http://127.0.0.1:18025`.

## Estructura

```text
synthetic-user-engine/
├── main.py            CLI
├── config.yaml        URL, cuentas semilla y vocabulario de los datos
├── core/              sesión HTTP por persona, informe, Mailpit
├── agents/            personas y lo que cada una puede hacer
├── journeys/          recorridos y sus verificaciones
├── generators/        datos verosímiles con semilla
├── simulation/        contexto compartido, agenda libre y ejecución por rondas
└── reports/           informes generados (no se versionan)
```
