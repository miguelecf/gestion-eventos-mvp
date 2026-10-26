package com.mvp.backend.feature.auth.security;

import com.mvp.backend.feature.users.model.User;
import lombok.Getter;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.time.Instant;
import java.util.Collection;
import java.util.HashSet;
import java.util.Set;

@Getter
public class UserPrincipal implements UserDetails {

    private final Long id;
    private final String username;
    private final String password;
    private final Set<GrantedAuthority> authorities;
    private final boolean active;
    private final boolean mustChangePassword;
    private final Instant sessionsInvalidBefore;

    private UserPrincipal(Long id, String username, String password, Set<GrantedAuthority> authorities, boolean active,
                          boolean mustChangePassword, Instant sessionsInvalidBefore) {
        this.id = id;
        this.username = username;
        this.password = password;
        this.authorities = authorities;
        this.active = active;
        this.mustChangePassword = mustChangePassword;
        this.sessionsInvalidBefore = sessionsInvalidBefore;
    }

    public static UserPrincipal fromUser(User user) {
        Set<GrantedAuthority> authorities = new HashSet<>();
        if (user.getRole() != null) {
            authorities.add(new SimpleGrantedAuthority("ROLE_" + user.getRole()));
        }
        return new UserPrincipal(
                user.getId(),
                user.getUsername(),
                user.getPassword(),
                authorities,
                user.isActive(),
                user.isMustChangePassword(),
                user.getSessionsInvalidBefore()
        );
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return authorities;
    }

    @Override
    public String getPassword() {
        return password;
    }

    @Override
    public String getUsername() {
        return username;
    }

    @Override
    public boolean isAccountNonExpired() {
        return active;
    }

    @Override
    public boolean isAccountNonLocked() {
        return active;
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return active;
    }

    @Override
    public boolean isEnabled() {
        return active;
    }
}