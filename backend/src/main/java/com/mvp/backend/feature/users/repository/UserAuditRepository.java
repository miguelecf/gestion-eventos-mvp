package com.mvp.backend.feature.users.repository;

import com.mvp.backend.feature.users.model.UserAuditEntry;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface UserAuditRepository extends JpaRepository<UserAuditEntry, Long> {

    List<UserAuditEntry> findByTargetIdOrderByAtDescIdDesc(Long targetUserId);
}
