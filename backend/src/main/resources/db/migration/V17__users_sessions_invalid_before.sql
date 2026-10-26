SET NAMES utf8mb4;

-- REV-20: los tokens emitidos antes de esta marca dejan de valer. Se fija al restablecer la
-- contraseña y al desactivar la cuenta, para que una sesión anterior no reviva después.
ALTER TABLE users
    ADD COLUMN sessions_invalid_before DATETIME(6) NULL;
