# SQL local

Este directorio queda montado dentro del contenedor MySQL en `/sql` en modo solo lectura.

Uso recomendado:

- Guardar aca queries o scripts auxiliares que quieras editar desde VS Code.
- Conectarte desde VS Code usando el override `docker-compose.db-access.yml`.
- Ejecutar scripts manualmente contra la BD; este directorio no se corre automaticamente al iniciar MySQL.

Conexion local opcional:

- Host: `127.0.0.1`
- Puerto: `3307`
- Database: `eventosbd`
- Usuario: `root`
- Password: `root`
