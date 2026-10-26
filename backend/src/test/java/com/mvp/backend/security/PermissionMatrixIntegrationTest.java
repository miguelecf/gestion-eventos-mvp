package com.mvp.backend.security;

import com.fasterxml.jackson.databind.JsonNode;
import com.mvp.backend.support.IntegrationTestBase;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.core.annotation.AnnotatedElementUtils;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.AuthorityUtils;
import org.springframework.security.web.access.WebInvocationPrivilegeEvaluator;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * SEC-04: la matriz única de permisos (frontend/src/libs/permisos.json, la misma que arma CASL)
 * coincide con los controllers, con SecurityConfig y con los @PreAuthorize. Las reglas que aplican
 * los servicios (filas sin endpoints) no se verifican acá. Cada GET no público se evalúa también
 * como HEAD. Contrato en docs/permisos.md.
 */
class PermissionMatrixIntegrationTest extends IntegrationTestBase {

    private static final Path MATRIX = Path.of("..", "frontend", "src", "libs", "permisos.json");
    private static final String ANONYMOUS = "ANONIMO";
    private static final Pattern ROLE_EXPRESSION = Pattern.compile("has(Any)?Role\\((.+)\\)");
    private static final Pattern QUOTED_ROLE = Pattern.compile("'([A-Z_]+)'");

    @Autowired
    private WebInvocationPrivilegeEvaluator privilegeEvaluator;

    @Autowired
    @Qualifier("requestMappingHandlerMapping")
    private RequestMappingHandlerMapping handlerMapping;

    @Test
    void laMatrizCubreExactamenteLosEndpointsDeLosControllers() throws IOException {
        Set<String> mapped = new TreeSet<>();
        handlerMapping.getHandlerMethods().forEach((info, handler) -> {
            if (isOwnController(handler)) {
                info.getMethodsCondition().getMethods().forEach(method ->
                        info.getPatternValues().forEach(pattern -> mapped.add(method.name() + " " + pattern)));
            }
        });

        assertThat(new TreeSet<>(endpointsByRow().keySet())).isEqualTo(mapped);
    }

    @Test
    void securityConfigAplicaLaMatrizParaCadaRol() throws IOException {
        JsonNode matrix = matrix();
        List<String> roles = new ArrayList<>();
        matrix.get("roles").forEach(role -> roles.add(role.asText()));
        List<String> mismatches = new ArrayList<>();

        for (JsonNode row : matrix.get("permissions")) {
            boolean isPublic = row.path("public").asBoolean(false);
            Set<String> allowed = new TreeSet<>();
            row.path("roles").forEach(role -> allowed.add(role.asText()));
            assertThat(roles).as("roles de %s", row.get("id").asText()).containsAll(allowed);
            assertThat(isPublic || !allowed.isEmpty()).as("%s sin roles ni public", row.get("id").asText()).isTrue();

            for (JsonNode endpoint : row.get("endpoints")) {
                String[] parts = endpoint.asText().split(" ", 2);
                String uri = parts[1].replaceAll("\\{[^}]+}", "1");
                List<String> subjects = new ArrayList<>(roles);
                subjects.add(ANONYMOUS);
                for (String subject : subjects) {
                    boolean expected = isPublic || allowed.contains(subject);
                    boolean actual = privilegeEvaluator.isAllowed("", uri, parts[0], authenticationFor(subject));
                    if (expected != actual) {
                        mismatches.add("%s %s como %s: matriz=%s, SecurityConfig=%s"
                                .formatted(row.get("id").asText(), endpoint.asText(), subject, expected, actual));
                    }
                    // Spring MVC atiende HEAD con el handler GET: una regla solo por GET lo deja abierto
                    // (REV-05). Para las filas públicas no hace falta que HEAD quede abierto.
                    if ("GET".equals(parts[0]) && !isPublic) {
                        boolean headExpected = allowed.contains(subject);
                        boolean headActual = privilegeEvaluator.isAllowed("", uri, "HEAD", authenticationFor(subject));
                        if (headExpected != headActual) {
                            mismatches.add("%s HEAD %s como %s: matriz=%s, SecurityConfig=%s"
                                    .formatted(row.get("id").asText(), parts[1], subject, headExpected, headActual));
                        }
                    }
                }
            }
        }

        assertThat(mismatches).isEmpty();
    }

    @Test
    void preAuthorizeDeLosControllersCoincideConLaMatriz() throws IOException {
        Map<String, Set<String>> rolesByEndpoint = rolesByEndpoint();
        List<String> mismatches = new ArrayList<>();

        handlerMapping.getHandlerMethods().forEach((info, handler) -> {
            if (!isOwnController(handler)) {
                return;
            }
            PreAuthorize annotation = AnnotatedElementUtils.findMergedAnnotation(handler.getMethod(), PreAuthorize.class);
            if (annotation == null) {
                annotation = AnnotatedElementUtils.findMergedAnnotation(handler.getBeanType(), PreAuthorize.class);
            }
            if (annotation == null) {
                return;
            }
            Set<String> annotated = rolesOf(annotation.value());
            info.getMethodsCondition().getMethods().forEach(method -> info.getPatternValues().forEach(pattern -> {
                String endpoint = method.name() + " " + pattern;
                if (!annotated.equals(rolesByEndpoint.get(endpoint))) {
                    mismatches.add("%s: @PreAuthorize=%s, matriz=%s"
                            .formatted(endpoint, annotated, rolesByEndpoint.get(endpoint)));
                }
            }));
        });

        assertThat(mismatches).isEmpty();
    }

    /** Solo se admiten expresiones hasRole/hasAnyRole: otra expresión obliga a revisar este test. */
    private static Set<String> rolesOf(String expression) {
        Matcher matcher = ROLE_EXPRESSION.matcher(expression.trim());
        assertThat(matcher.matches()).as("expresión @PreAuthorize no soportada: %s", expression).isTrue();
        Set<String> roles = new TreeSet<>();
        Matcher role = QUOTED_ROLE.matcher(matcher.group(2));
        while (role.find()) {
            roles.add(role.group(1));
        }
        return roles;
    }

    private static boolean isOwnController(HandlerMethod handler) {
        return handler.getBeanType().getPackageName().startsWith("com.mvp.backend");
    }

    private static Authentication authenticationFor(String subject) {
        if (ANONYMOUS.equals(subject)) {
            return new AnonymousAuthenticationToken("matrix", "anonymousUser",
                    AuthorityUtils.createAuthorityList("ROLE_ANONYMOUS"));
        }
        return UsernamePasswordAuthenticationToken.authenticated("matrix", null,
                AuthorityUtils.createAuthorityList("ROLE_" + subject));
    }

    /** Roles de la fila de cada endpoint; las filas públicas no tienen entrada. */
    private Map<String, Set<String>> rolesByEndpoint() throws IOException {
        Map<String, Set<String>> roles = new LinkedHashMap<>();
        for (JsonNode row : matrix().get("permissions")) {
            if (row.path("public").asBoolean(false)) {
                continue;
            }
            Set<String> rowRoles = new TreeSet<>();
            row.path("roles").forEach(role -> rowRoles.add(role.asText()));
            row.get("endpoints").forEach(endpoint -> roles.put(endpoint.asText(), rowRoles));
        }
        return roles;
    }

    private Map<String, String> endpointsByRow() throws IOException {
        Map<String, String> endpoints = new LinkedHashMap<>();
        for (JsonNode row : matrix().get("permissions")) {
            for (JsonNode endpoint : row.get("endpoints")) {
                String previous = endpoints.put(endpoint.asText(), row.get("id").asText());
                assertThat(previous).as("%s repetido en la matriz", endpoint.asText()).isNull();
            }
        }
        return endpoints;
    }

    private JsonNode matrix() throws IOException {
        return objectMapper.readTree(Files.readString(MATRIX));
    }
}
