package com.mvp.backend.feature.users.service;

import com.mvp.backend.feature.auth.dto.RegisterRequest;
import com.mvp.backend.feature.users.model.RoleName;
import com.mvp.backend.feature.users.model.User;
import com.mvp.backend.feature.users.repository.UserRepository;
import com.mvp.backend.shared.Priority;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.Optional;

import static org.springframework.http.HttpStatus.CONFLICT;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;

    @Transactional
    public User register(RegisterRequest request, String encodedPassword) {
        String username = request.getUsername().trim();
        String email = request.getEmail().trim();

        if (userRepository.existsByUsernameIgnoreCase(username)) {
            throw new ResponseStatusException(CONFLICT, "El nombre de usuario ya está en uso");
        }
        if (userRepository.existsByEmailIgnoreCase(email)) {
            throw new ResponseStatusException(CONFLICT, "El email ya está en uso");
        }

        String role = RoleName.fromNullable(request.getRole(), RoleName.USUARIO).name();

        User user = User.builder()
                .username(username)
                .email(email)
                .name(request.getName().trim())
                .lastName(request.getLastName().trim())
                .password(encodedPassword)
                .priority(Priority.LOW)
                .role(role)
                .mustChangePassword(true)
                .failedLoginAttempts(0)
                .build();

        return userRepository.save(user);
    }

    public User getById(Long id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(org.springframework.http.HttpStatus.NOT_FOUND, "Usuario no encontrado"));
    }

    public User getByUsername(String username) {
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new ResponseStatusException(org.springframework.http.HttpStatus.UNAUTHORIZED, "Credenciales inválidas"));
    }

    public void incrementFailedLoginAttempts(String username) {
        userRepository.incrementFailedLoginAttempts(username);
    }

    public Optional<User> findByUsername(String username) {
        return userRepository.findByUsername(username);
    }

    @Transactional
    public User save(User user) {
        return userRepository.save(user);
    }

    @Transactional
    public int updatePassword(Long id, String passwordHash){
        return userRepository.updatePassword(id, passwordHash, Instant.now());
    }
}
