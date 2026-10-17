# Docker local

El motor local es **OrbStack** (reemplaza a Docker Desktop): antes de levantar, `docker context show` debe devolver `orbstack`. El runner E2E lo acepta porque su endpoint es un socket Unix local.

Por defecto, el stack base publica solo la aplicación en `127.0.0.1:8080`; backend, MySQL y Mailpit permanecen dentro de la red Docker. Usá `docker compose` desde la raíz del repositorio.

## Inicio rápido

```bash
docker compose up --build
```

Abrí `http://127.0.0.1:8080`. En OrbStack, el proyecto Compose se llama `gestion-eventos-mvp`. Evitá arrancar contenedores sueltos: el backend resuelve MySQL por el DNS interno `mysql`.

## Datos iniciales

Flyway aplica al iniciar el backend las migraciones `V*__*.sql` de `backend/src/main/resources/db/migration`, incluida `V2__seed.sql`.

La migración de seed define estos usuarios locales:

| Usuario | Rol |
|---|---|
| `admin.full` | `ADMIN_FULL` |
| `admin.ceremonial` | `ADMIN_CEREMONIAL` |
| `admin.tecnica` | `ADMIN_TECNICA` |
| `viewer` | `USUARIO` |

El comentario y el hash BCrypt del seed documentan `admin123` como contraseña de demo para los cuatro usuarios. **Esto es evidencia del archivo de seed, no una prueba de inicio de sesión contra una base levantada.** La confirmación de credenciales en ejecución queda pendiente de E1; no uses estos datos fuera de un entorno descartable.

Para inspeccionar el historial de migraciones en un stack ya iniciado:

```bash
docker compose exec mysql mysql -uroot -p eventosbd \
  -e "select version, description, success from flyway_schema_history order by installed_rank;"
```

El comando solicita la contraseña interactiva de MySQL; no la escribas en la línea de comandos.

## Ver correos locales con Mailpit

El servicio conserva el nombre Compose `mailhog` por compatibilidad, pero ejecuta Mailpit (`axllent/mailpit`). Para publicar su interfaz solo en loopback:

```bash
docker compose -f docker-compose.yml -f docker-compose.mail-access.yml up --build
```

Abrí `http://127.0.0.1:8025`. El SMTP sigue disponible para el backend dentro de la red Docker en `mailhog:1025`; el override publica únicamente la interfaz web. Para cambiar el puerto del host, definí `MAILPIT_HOST_PORT` (por defecto `8025`).

## MySQL desde una herramienta local

MySQL no publica puertos en el stack base. Para habilitar acceso desde VS Code u otra herramienta local:

```bash
docker compose -f docker-compose.yml -f docker-compose.db-access.yml up --build
```

Conectate a `127.0.0.1:3307`, base `eventosbd`, usuario `root`. La contraseña corresponde a `MYSQL_ROOT_PASSWORD` en tu `.env`; no se documenta ni se pasa como argumento para evitar exponerla en el historial del shell. Los scripts y queries locales van en `./sql` (montado como `/sql`); MySQL no los ejecuta automáticamente.

## Variables de entorno

Copiá `.env.example` a `.env` y ajustá los valores locales. Compose toma `.env` desde el directorio actual. Los valores indicados abajo son los defaults del compose/ejemplo; los secretos de desarrollo son solo para uso local y deben reemplazarse si el entorno deja de ser descartable.

| Variable | Default | Uso |
|---|---|---|
| `FRONTEND_HOST` | `127.0.0.1` | Interfaz del host donde se publica el frontend. Usá `0.0.0.0` solo si necesitás acceso desde otra máquina y entendés la exposición. |
| `FRONTEND_PORT` | `8080` | Puerto del host para la aplicación web. |
| `MYSQL_HOST` | `127.0.0.1` | Interfaz del host para MySQL; solo aplica con `docker-compose.db-access.yml`. |
| `MYSQL_HOST_PORT` | `3307` | Puerto del host para MySQL; solo aplica con el override de acceso a DB. |
| `MYSQL_DATABASE` | `eventosbd` | Base creada por la imagen MySQL. |
| `MYSQL_ROOT_PASSWORD` | `root` en `.env.example` | Contraseña root de MySQL; elegí una propia si el entorno no es descartable. |
| `SPRING_PROFILES_ACTIVE` | `docker` | Perfil Spring activo en el backend. |
| `SPRING_DATASOURCE_URL` | JDBC a `mysql:3306/eventosbd` | URL JDBC interna del backend hacia MySQL. Si cambiás la base, mantenela consistente con `MYSQL_DATABASE`. |
| `SPRING_DATASOURCE_USERNAME` | `root` | Usuario de conexión del backend. |
| `SPRING_DATASOURCE_PASSWORD` | `root` en el compose | Contraseña de conexión del backend; debe corresponder a la configuración de MySQL. |
| `DB_WAIT_TIMEOUT_SECONDS` | `120` | Tiempo máximo de espera de disponibilidad de DB al iniciar el backend. |
| `MAIL_HOST` | `mailhog` | Host SMTP dentro de la red Compose (nombre del servicio conservado). |
| `MAIL_PORT` | `1025` | Puerto SMTP interno de Mailpit. |
| `MAIL_FROM` | `noreply@gestion-eventos.local` | Remitente usado por el backend local. |
| `MAIL_MOCK_MODE` | `false` | `true` simula el envío; `false` envía al SMTP local configurado. |
| `MAIL_FAIL_ON_ERROR` | `true` | Hace fallar la operación cuando no puede entregarse el correo. |
| `MAIL_USERNAME` | vacío | Usuario SMTP cuando el proveedor configurado lo requiere. |
| `MAIL_PASSWORD` | vacío | Contraseña SMTP cuando el proveedor configurado lo requiere. |
| `MAIL_SMTP_AUTH` | `false` | Habilita autenticación SMTP. |
| `MAIL_SMTP_STARTTLS_ENABLE` | `false` | Habilita STARTTLS SMTP. |
| `MAILPIT_HOST_PORT` | `8025` | Puerto local de la UI, solo con `docker-compose.mail-access.yml`. |
| `APP_PUBLIC_BASE_URL` | `http://127.0.0.1:${FRONTEND_PORT:-8080}` | URL pública del frontend conocida por el backend, por ejemplo para enlaces de correo. |
| `APP_CORS_ALLOWED_ORIGINS` | `http://127.0.0.1:8080,http://localhost:8080` | Orígenes web autorizados por el backend; lista separada por comas. |
| `JWT_SECRET` | Valor de desarrollo de `.env.example` | Secreto de firma JWT. Reemplazalo por un secreto propio y no lo compartas. |
| `JWT_ACCESS_TOKEN_EXPIRATION` | `900000` | Vigencia del access token en milisegundos (15 minutos). |
| `JWT_REFRESH_TOKEN_EXPIRATION` | `604800000` | Vigencia del refresh token en milisegundos (7 días). |
| `BACKEND_JAVA_OPTS` | vacío | Opciones de JVM pasadas al backend mediante `JAVA_OPTS`. |
| `VITE_API_BASE_URL` | vacío | Base API inyectada durante el build del frontend; vacío usa rutas relativas y el proxy de Nginx. |

## Stack aislado o puerto alternativo

Para pruebas paralelas, asigná un nombre de proyecto distinto (crea otro volumen de MySQL) y alineá la URL pública y CORS con el host/puerto real del frontend. Ejemplo con puerto `18080`:

```bash
FRONTEND_PORT=18080 \
APP_PUBLIC_BASE_URL=http://127.0.0.1:18080 \
APP_CORS_ALLOWED_ORIGINS=http://127.0.0.1:18080,http://localhost:18080 \
docker compose -p gestion-eventos-mvp-check up -d --build
```

Verificá la instancia en `http://127.0.0.1:18080`. No ejecutes `down -v` sobre el proyecto habitual: borra su volumen de MySQL. Para eliminar solo este stack de prueba, comprobá primero que el nombre `gestion-eventos-mvp-check` sea el correcto y luego ejecutá:

```bash
docker compose -p gestion-eventos-mvp-check down -v
```

## E2E descartable

Desde la raíz del repositorio, ejecutá ambos recorridos (API y Playwright) en un proyecto Compose aislado:

```bash
bash scripts/e2e/run.sh
```

El runner usa únicamente `docker-compose.yml` y `docker-compose.mail-access.yml`, fija el proyecto `gestion-eventos-mvp-e2e`, publica la aplicación en `127.0.0.1:18080` y Mailpit en `127.0.0.1:18025`, y configura URL pública/CORS para ese origen. Antes de cualquier inventario o acción Docker, rechaza `DOCKER_HOST`/`DOCKER_CONTEXT` heredados y exige que el contexto seleccionado tenga un endpoint de socket Unix local; luego fija todas sus operaciones Docker a ese contexto validado. Ignora valores heredados o de `.env` para la base, correo, perfil Spring, JWT y API del bundle frontend; antes de iniciar, comprueba que la configuración renderizada apunta a `mysql:3306/eventosbd`, Mailpit interno (`mailhog:1025`) y rutas locales. Espera hasta 180 segundos por la salud del backend y la página frontend. Un lock atómico impide que dos invocaciones del runner compartan el proyecto; si queda un lock obsoleto, primero comprobá que ningún runner siga activo. También rechaza recursos Docker preexistentes con ese nombre para no adoptar ni borrar silenciosamente otro stack.

Por seguridad, al terminar —también ante un fallo o inicio parcial— ejecuta `docker compose ... down --volumes` **solo** para `gestion-eventos-mvp-e2e`; ese volumen MySQL descartable se elimina. `bash scripts/e2e/run.sh --keep` conserva el proyecto y sus datos para depuración, y el runner rechazará esa instancia en una ejecución posterior. Para quitarla conscientemente, primero comprobá que ningún runner la esté usando, que `DOCKER_HOST`/`DOCKER_CONTEXT` no estén definidos y que `docker context inspect "$(docker context show)" --format '{{.Endpoints.docker.Host}}'` devuelva un socket `unix://` local; recién entonces ejecutá `docker compose --project-name gestion-eventos-mvp-e2e --file docker-compose.yml --file docker-compose.mail-access.yml down --volumes --remove-orphans`. No cambies el nombre del proyecto ni reutilices este flujo con una base local/compartida/de producción. Si el login semilla `admin123` no funciona, el runner asigna una contraseña conocida a los cuatro usuarios sembrados solo en esta base aislada y pasa `E2E_PASSWORD` a ambos recorridos; no reutilices esa contraseña fuera de este entorno.
