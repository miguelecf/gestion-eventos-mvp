package com.mvp.backend.config;

import com.mvp.backend.feature.auth.security.CustomUserDetailsService;
import com.mvp.backend.feature.auth.security.JwtAuthenticationFilter;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

import static org.springframework.security.config.Customizer.withDefaults;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {
    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final CustomUserDetailsService userDetailsService;
    private final AppCorsProperties appCorsProperties;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .cors(withDefaults())
                .csrf(AbstractHttpConfigurer::disable)
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                // Sin credenciales (o con un token inválido o vencido) responde 401, para que el cliente
                // pueda renovar el token; 403 queda para un rol sin permiso.
                .exceptionHandling(ex -> ex.authenticationEntryPoint(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)))
                .authorizeHttpRequests(auth -> auth
                        // El contenedor reenvía a /error tras un sendError (401, 404, 400…). Si Spring
                        // Security lo bloquea, todo error de un anónimo llega como 403 vacío.
                        .requestMatchers("/error").permitAll()
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/actuator/health", "/actuator/health/**", "/actuator/info")
                        .permitAll()
                        .requestMatchers("/swagger-ui/**", "/swagger-ui.html", "/v3/api-docs/**", "/api-docs/**")
                        .permitAll()
                        .requestMatchers("/api/users/**").hasRole("ADMIN_FULL")
                        .requestMatchers(HttpMethod.POST, "/public/event-requests").permitAll()
                        .requestMatchers(HttpMethod.POST, "/public/availability/check").permitAll()
                        .requestMatchers(HttpMethod.GET, "/public/spaces/*/occupancy").permitAll()
                        .requestMatchers(HttpMethod.GET, "/public/track/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/public/catalogs/spaces").permitAll()
                        .requestMatchers(HttpMethod.GET, "/public/events").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/catalogs/**")
                        .hasAnyRole("ADMIN_FULL", "ADMIN_CEREMONIAL", "ADMIN_TECNICA", "USUARIO")
                        .requestMatchers(HttpMethod.POST, "/api/catalogs/**")
                        .hasAnyRole("ADMIN_FULL", "ADMIN_CEREMONIAL", "ADMIN_TECNICA")
                        .requestMatchers(HttpMethod.PATCH, "/api/catalogs/**")
                        .hasAnyRole("ADMIN_FULL", "ADMIN_CEREMONIAL", "ADMIN_TECNICA")
                        .requestMatchers(HttpMethod.POST, "/auth/login", "/auth/refresh").permitAll()
                        .requestMatchers(HttpMethod.POST, "/auth/register").hasRole("ADMIN_FULL")
                        .requestMatchers(HttpMethod.POST, "/auth/change-password", "/auth/logout").authenticated()
                        .requestMatchers(HttpMethod.GET, "/auth/me").authenticated()
                        .requestMatchers(HttpMethod.GET, "/api/events/*/status")
                        .hasAnyRole("ADMIN_FULL", "ADMIN_CEREMONIAL", "ADMIN_TECNICA")
                        .requestMatchers(HttpMethod.POST, "/api/events/*/status")
                        .hasAnyRole("ADMIN_FULL", "ADMIN_CEREMONIAL", "ADMIN_TECNICA")
                        .requestMatchers(HttpMethod.GET, "/api/events/*/comments/**")
                        .hasAnyRole("ADMIN_FULL", "ADMIN_CEREMONIAL", "ADMIN_TECNICA")
                        .requestMatchers(HttpMethod.POST, "/api/events/*/comments")
                        .hasAnyRole("ADMIN_FULL", "ADMIN_CEREMONIAL", "ADMIN_TECNICA")
                        .requestMatchers(HttpMethod.PATCH, "/api/events/*/comments/**")
                        .hasAnyRole("ADMIN_FULL", "ADMIN_CEREMONIAL", "ADMIN_TECNICA")
                        .requestMatchers(HttpMethod.DELETE, "/api/events/*/comments/**")
                        .hasAnyRole("ADMIN_FULL", "ADMIN_CEREMONIAL", "ADMIN_TECNICA")
                        .requestMatchers(HttpMethod.GET, "/api/events/**")
                        .hasAnyRole("ADMIN_FULL", "ADMIN_CEREMONIAL", "ADMIN_TECNICA", "USUARIO")
                        // Alta, edición y baja lógica de eventos (cualquier método que no sea GET): sólo
                        // roles admin. USUARIO sólo crea solicitudes (POST /public/event-requests) —
                        // hallazgo 1.4, SEC-03, docs/permisos.md.
                        .requestMatchers("/api/events/**")
                        .hasAnyRole("ADMIN_FULL", "ADMIN_CEREMONIAL", "ADMIN_TECNICA")
                        .requestMatchers(HttpMethod.POST, "/api/availability/check")
                        .hasAnyRole("ADMIN_FULL", "ADMIN_CEREMONIAL", "ADMIN_TECNICA", "USUARIO")
                        .requestMatchers(HttpMethod.GET, "/api/audit/**")
                        .hasAnyRole("ADMIN_FULL", "ADMIN_CEREMONIAL", "ADMIN_TECNICA")
                        .requestMatchers(HttpMethod.GET, "/api/tech/capacity")
                        .hasAnyRole("ADMIN_FULL", "ADMIN_CEREMONIAL", "ADMIN_TECNICA")
                        .requestMatchers(HttpMethod.GET, "/api/tech/events")
                        .hasAnyRole("ADMIN_FULL", "ADMIN_CEREMONIAL", "ADMIN_TECNICA")
                        .requestMatchers(HttpMethod.GET, "/api/priority/conflicts", "/api/priority/conflicts/**")
                        .hasAnyRole("ADMIN_FULL", "ADMIN_CEREMONIAL", "ADMIN_TECNICA")
                        .requestMatchers(HttpMethod.POST, "/api/priority/decisions")
                        .hasAnyRole("ADMIN_FULL", "ADMIN_CEREMONIAL")
                        // Cualquier otro método sobre /api/priority/** (HEAD incluido, que Spring MVC
                        // atiende con el handler GET): sólo roles admin. Antes caía en
                        // anyRequest().authenticated() — hallazgo 1.6, SEC-05, docs/permisos.md.
                        .requestMatchers("/api/priority/**")
                        .hasAnyRole("ADMIN_FULL", "ADMIN_CEREMONIAL", "ADMIN_TECNICA")
                        .requestMatchers(HttpMethod.GET, "/api/notifications/**")
                        .hasAnyRole("ADMIN_FULL", "ADMIN_CEREMONIAL", "ADMIN_TECNICA", "USUARIO")
                        .requestMatchers(HttpMethod.PATCH, "/api/notifications/**")
                        .hasAnyRole("ADMIN_FULL", "ADMIN_CEREMONIAL", "ADMIN_TECNICA", "USUARIO")
                        .requestMatchers(HttpMethod.GET, "/admin/event-requests/**")
                        .hasAnyRole("ADMIN_FULL", "ADMIN_CEREMONIAL", "ADMIN_TECNICA")
                        .requestMatchers(HttpMethod.PATCH, "/admin/event-requests/**")
                        .hasAnyRole("ADMIN_FULL", "ADMIN_CEREMONIAL", "ADMIN_TECNICA")
                        .requestMatchers(HttpMethod.POST, "/admin/event-requests/**")
                        .hasAnyRole("ADMIN_FULL", "ADMIN_CEREMONIAL", "ADMIN_TECNICA")
                        .anyRequest().authenticated())
                .authenticationProvider(authenticationProvider())
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(appCorsProperties.getAllowedOrigins());
        configuration.setAllowedMethods(List.of("GET", "POST", "PATCH", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("Authorization", "Content-Type", "Accept", "X-Requested-With"));
        configuration.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public DaoAuthenticationProvider authenticationProvider() {
        DaoAuthenticationProvider provider = new DaoAuthenticationProvider();
        provider.setUserDetailsService(userDetailsService);
        provider.setPasswordEncoder(passwordEncoder());
        return provider;
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration configuration) throws Exception {
        return configuration.getAuthenticationManager();
    }
}
