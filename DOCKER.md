# Docker

Stack base cerrado por defecto: solo se publica el frontend en `127.0.0.1:8080`. Backend, MySQL y MailHog quedan accesibles solo dentro de la red Docker.

## Levantar

```bash
docker compose up --build
```

Abrir `http://127.0.0.1:8080`.

En Docker Dashboard, usar el grupo/app Compose `gestion-eventos-mvp`. Evitar arrancar contenedores sueltos porque `backend` depende de la red interna y del DNS de Compose para resolver `mysql`.

## BD, migraciones y seeds

La base se llena automaticamente al arrancar el backend. Spring Boot ejecuta Flyway desde `backend/src/main/resources/db/migration` y aplica todas las migraciones `V*__*.sql`, incluyendo seeds.

Verificar migraciones y datos:

```bash
docker compose exec mysql mysql -uroot -proot eventosbd -e "select version, description, success from flyway_schema_history order by installed_rank;"
```

Probar una instalacion limpia sin tocar tu volumen actual:

```bash
FRONTEND_PORT=18080 docker compose -p gestion-eventos-mvp-check up -d --build
FRONTEND_PORT=18080 docker compose -p gestion-eventos-mvp-check exec mysql mysql -uroot -proot eventosbd -e "select count(*) from flyway_schema_history; select count(*) from events;"
FRONTEND_PORT=18080 docker compose -p gestion-eventos-mvp-check down -v
```

## Acceder a MySQL desde VS Code

```bash
docker compose -f docker-compose.yml -f docker-compose.db-access.yml up --build
```

Conectar a:

- Host: `127.0.0.1`
- Puerto: `3307`
- Database: `eventosbd`
- Usuario: `root`
- Password: `root`

Los scripts y queries locales van en `./sql`. El contenedor MySQL los ve en `/sql`, pero no los ejecuta automaticamente.

## Variables utiles

- `FRONTEND_PORT`: puerto local del frontend, por defecto `8080`.
- `FRONTEND_HOST`: interfaz local del frontend, por defecto `127.0.0.1`. Para exponerlo en una VM o servidor usar `0.0.0.0`.
- `MYSQL_HOST_PORT`: puerto local de MySQL cuando se usa `docker-compose.db-access.yml`, por defecto `3307`.
- `MYSQL_ROOT_PASSWORD`: password root de MySQL.
- `JWT_SECRET`: secreto JWT del backend.

## Limpiar datos locales

```bash
docker compose down -v
```

Esto borra el volumen de MySQL.
