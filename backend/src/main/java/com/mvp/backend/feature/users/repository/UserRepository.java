package com.mvp.backend.feature.users.repository;

import com.mvp.backend.feature.users.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long>, JpaSpecificationExecutor<User> {

    Optional<User> findByUsername(String username);

    Optional<User> findByEmail(String email);

    boolean existsByUsername(String username);

    boolean existsByEmail(String email);

    boolean existsByUsernameIgnoreCase(String username);

    boolean existsByEmailIgnoreCase(String email);

    boolean existsByUsernameIgnoreCaseAndIdNot(String username, Long id);

    boolean existsByEmailIgnoreCaseAndIdNot(String email, Long id);

    long countByRoleAndActiveTrue(String role);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
    update User u
       set u.password = :password,
           u.mustChangePassword = false,
           u.failedLoginAttempts = 0,
           u.updatedAt = :updatedAt
     where u.id = :id
  """)
    int updatePassword(@Param("id") Long id,
                       @Param("password") String passwordHash,
                       @Param("updatedAt") Instant updatedAt);

    /** Incremento atómico: dos intentos fallidos simultáneos suman dos (REV-21). */
    @Modifying
    @Query("update User u set u.failedLoginAttempts = u.failedLoginAttempts + 1 where u.username = :username")
    int incrementFailedLoginAttempts(@Param("username") String username);
}
