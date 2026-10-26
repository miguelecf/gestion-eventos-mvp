package com.mvp.backend.feature.auth.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.JwtException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.HashSet;
import java.util.Set;

@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtTokenProvider tokenProvider;
    private final CustomUserDetailsService userDetailsService;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        String bearerToken = resolveToken(request);

        if (StringUtils.hasText(bearerToken)) {
            try {
                Claims claims = tokenProvider.parseToken(bearerToken).getBody();
                Long userId = Long.parseLong(claims.getSubject());
                UserDetails userDetails = userDetailsService.loadUserById(userId);

                Set<String> scopes = tokenProvider.extractScopes(claims);
                boolean passwordOnly = scopes.contains("password:update");
                // Una cuenta con contraseña restablecida solo acepta el token de cambio de contraseña:
                // las sesiones emitidas antes del restablecimiento dejan de valer (REV-12).
                boolean staleSession = userDetails instanceof UserPrincipal principal
                        && ((principal.isMustChangePassword() && !passwordOnly)
                            || issuedBefore(claims, principal.getSessionsInvalidBefore()));

                if (userDetails.isEnabled() && !staleSession) {
                    Set<GrantedAuthority> authorities = new HashSet<>();
                    scopes.forEach(scope -> authorities.add(new SimpleGrantedAuthority("SCOPE_" + scope)));
                    // El rol sale de la cuenta, no del claim: un cambio de rol rige desde la petición
                    // siguiente, sin esperar a que venza el token (REV-12).
                    if (!passwordOnly) {
                        authorities.addAll(userDetails.getAuthorities());
                    }

                    UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
                            userDetails,
                            null,
                            authorities
                    );
                    SecurityContextHolder.getContext().setAuthentication(authentication);
                } else if (staleSession) {
                    request.setAttribute("jwt_invalid", true);
                }
            } catch (ExpiredJwtException ex) {
                request.setAttribute("jwt_expired", true);
            } catch (UsernameNotFoundException ex) {
                request.setAttribute("jwt_invalid", true);
            } catch (JwtException | IllegalArgumentException ex) {
                request.setAttribute("jwt_invalid", true);
            }
        }

        filterChain.doFilter(request, response);
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest req) {
        String p = req.getServletPath();
        String m = req.getMethod();

        return p != null && (
                        (p.equals("/auth/login") && m.equals("POST")) ||
                        (p.equals("/auth/refresh") && m.equals("POST")) ||
                        p.startsWith("/public/") ||
                        p.startsWith("/v3/api-docs") || p.startsWith("/swagger") || p.startsWith("/swagger-ui")
        ) || "OPTIONS".equalsIgnoreCase(req.getMethod());
    }

    private String resolveToken(HttpServletRequest request) {
        String bearer = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (StringUtils.hasText(bearer) && bearer.startsWith("Bearer ")) {
            return bearer.substring(7);
        }
        return null;
    }

    /** Token emitido antes de la marca de invalidación de la cuenta (REV-20); el iat tiene precisión de segundos. */
    private static boolean issuedBefore(Claims claims, java.time.Instant invalidBefore) {
        return invalidBefore != null && claims.getIssuedAt() != null
                && claims.getIssuedAt().toInstant().isBefore(invalidBefore.truncatedTo(java.time.temporal.ChronoUnit.SECONDS));
    }
}
