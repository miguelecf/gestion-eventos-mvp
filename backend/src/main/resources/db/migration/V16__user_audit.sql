SET NAMES utf8mb4;
SET time_zone = '+00:00';

-- REV-09 (CU-02, RNF-05): trazabilidad de las acciones administrativas sobre cuentas internas.
CREATE TABLE user_audit (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  target_user_id BIGINT NOT NULL,
  actor_user_id BIGINT NULL,
  at DATETIME(6) NOT NULL,
  action VARCHAR(30) NOT NULL,
  details VARCHAR(500) NULL,

  CONSTRAINT fk_user_audit_target FOREIGN KEY (target_user_id) REFERENCES users(id),
  CONSTRAINT fk_user_audit_actor FOREIGN KEY (actor_user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX ix_user_audit_target ON user_audit (target_user_id, at);
