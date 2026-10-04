package com.mvp.backend.architecture;

import com.tngtech.archunit.core.domain.Dependency;
import com.tngtech.archunit.core.domain.JavaClass;
import com.tngtech.archunit.core.domain.JavaClasses;
import com.tngtech.archunit.core.importer.ClassFileImporter;
import com.tngtech.archunit.core.importer.ImportOption;
import org.junit.jupiter.api.Test;

import java.util.Set;
import java.util.TreeSet;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertEquals;

class ModuleBoundariesTest {

    private static final String BASE_PACKAGE = "com.mvp.backend";

    // Deuda congelada — ver docs/arquitectura.md#deuda
    private static final Set<String> ALLOWED_MODULE_EDGES = Set.of(
            "auth -> users",
            "availability -> catalogs",
            "availability -> events",
            "catalogs -> shared",
            "comments -> auth",
            "comments -> events",
            "comments -> history",
            "comments -> notifications",
            "comments -> shared",
            "comments -> users",
            "config -> auth",
            "events -> auth",
            "events -> availability",
            "events -> catalogs",
            "events -> history",
            "events -> notifications",
            "events -> priority",
            "events -> requests",
            "events -> shared",
            "events -> tech",
            "events -> users",
            "history -> events",
            "history -> requests",
            "history -> users",
            "notifications -> auth",
            "notifications -> catalogs",
            "notifications -> comments",
            "notifications -> events",
            "notifications -> priority",
            "notifications -> requests",
            "notifications -> shared",
            "notifications -> users",
            "priority -> auth",
            "priority -> availability",
            "priority -> catalogs",
            "priority -> events",
            "priority -> history",
            "priority -> notifications",
            "priority -> shared",
            "priority -> tech",
            "priority -> users",
            "requests -> auth",
            "requests -> availability",
            "requests -> catalogs",
            "requests -> events",
            "requests -> history",
            "requests -> notifications",
            "requests -> shared",
            "requests -> tech",
            "requests -> users",
            "root -> users",
            "shared -> auth",
            "shared -> availability",
            "shared -> tech",
            "tech -> catalogs",
            "tech -> events",
            "users -> auth",
            "users -> shared");

    // Deuda congelada — ver docs/arquitectura.md#deuda
    private static final Set<String> ALLOWED_FOREIGN_REPOSITORY_USES = Set.of(
            "AvailabilityService -> EventRepository",
            "AvailabilityService -> SpaceRepository",
            "BackendApplication -> UserRepository",
            "CustomUserDetailsService -> UserRepository",
            "EmailNotificationListener -> EventRepository",
            "EmailNotificationListener -> EventRequestRepository",
            "EmailNotificationListener -> SpaceRepository",
            "EventCommentService -> EventRepository",
            "EventRequestService -> DepartmentRepository",
            "EventRequestService -> EventHistoryRepository",
            "EventRequestService -> EventRepository",
            "EventRequestService -> EventRequestHistoryRepository",
            "EventRequestService -> SpaceRepository",
            "EventService -> DepartmentRepository",
            "EventService -> EventRequestRepository",
            "EventService -> SpaceRepository",
            "NotificationEventListener -> EventCommentRepository",
            "NotificationEventListener -> EventRepository",
            "NotificationEventListener -> PriorityConflictRepository",
            "NotificationService -> EventCommentRepository",
            "NotificationService -> EventRepository",
            "NotificationService -> UserRepository",
            "PriorityConflictService -> EventRepository",
            "PriorityConflictService -> SpaceRepository",
            "TechCapacityService -> EventRepository");

    // Deuda congelada — ver docs/arquitectura.md#deuda
    private static final Set<String> ALLOWED_CONTROLLER_DEPENDENCIES = Set.of(
            "com.mvp.backend.feature.requests.controller.AdminEventRequestController -> com.mvp.backend.feature.events.dto.EventResponseDto",
            "com.mvp.backend.feature.notifications.controller.NotificationController -> com.mvp.backend.feature.auth.security.UserPrincipal");

    // Deuda congelada — ver docs/arquitectura.md#deuda
    private static final Set<String> ALLOWED_NOTIFICATION_EVENTS = Set.of(
            "com.mvp.backend.feature.notifications.event.EventCreatedEmailEvent",
            "com.mvp.backend.feature.notifications.event.EventRequestCreatedEmailEvent",
            "com.mvp.backend.feature.notifications.event.EventRequestStatusChangedEmailEvent",
            "com.mvp.backend.feature.notifications.event.EventRescheduledEmailEvent",
            "com.mvp.backend.feature.notifications.event.EventStatusChangedEvent",
            "com.mvp.backend.feature.notifications.event.NewCommentEvent",
            "com.mvp.backend.feature.notifications.event.PriorityConflictEvent");

    private final JavaClasses classes = new ClassFileImporter()
            .withImportOption(new ImportOption.DoNotIncludeTests())
            .importPackages(BASE_PACKAGE);

    @Test
    void moduleDependencyEdgesMatchFrozenDebt() {
        Set<String> actual = dependencies().stream()
                .filter(dependency -> dependency.getTargetClass().getName().startsWith(BASE_PACKAGE + "."))
                .filter(dependency -> !dependency.getTargetClass().getPackageName().startsWith("java."))
                .map(dependency -> new ModulePair(moduleOf(dependency.getOriginClass()),
                        moduleOf(dependency.getTargetClass())))
                .filter(pair -> !pair.origin().equals(pair.target()))
                .map(pair -> pair.origin() + " -> " + pair.target())
                .collect(Collectors.toCollection(TreeSet::new));

        assertSetEquals("Dependencia no permitida: documentar en docs/arquitectura.md o evitarla; "
                + "deuda pagada: quitarla de la lista", ALLOWED_MODULE_EDGES, actual);
    }

    @Test
    void foreignRepositoryUsesMatchFrozenDebt() {
        Set<String> actual = dependencies().stream()
                .filter(dependency -> isFeatureRepository(dependency.getTargetClass()))
                .filter(dependency -> !featureModuleOf(dependency.getOriginClass())
                        .equals(featureModuleOf(dependency.getTargetClass())))
                .map(dependency -> dependency.getOriginClass().getSimpleName() + " -> "
                        + dependency.getTargetClass().getSimpleName())
                .collect(Collectors.toCollection(TreeSet::new));

        assertSetEquals("Dependencia no permitida: documentar en docs/arquitectura.md o evitarla; "
                + "deuda pagada: quitarla de la lista", ALLOWED_FOREIGN_REPOSITORY_USES, actual);
    }

    @Test
    void controllersDependOnlyOnTheirModuleAndSharedFrameworkPackages() {
        Set<String> violations = dependencies().stream()
                .filter(dependency -> isController(dependency.getOriginClass()))
                .filter(dependency -> !isAllowedControllerTarget(dependency))
                .map(dependency -> dependency.getOriginClass().getName() + " -> "
                        + dependency.getTargetClass().getName())
                .collect(Collectors.toCollection(TreeSet::new));

        assertEquals(Set.of(), violations,
                "Controllers may use only their module, shared/framework packages, and the two exact exceptions");
    }

    @Test
    void notificationEventClassesMatchFrozenAllowlist() {
        Set<String> actual = classes.stream()
                .filter(javaClass -> javaClass.getPackageName().equals(
                        BASE_PACKAGE + ".feature.notifications.event")
                        || javaClass.getPackageName().startsWith(
                        BASE_PACKAGE + ".feature.notifications.event."))
                .map(JavaClass::getName)
                .collect(Collectors.toCollection(TreeSet::new));

        assertSetEquals("Los eventos nuevos van en el paquete event del módulo que los publica",
                ALLOWED_NOTIFICATION_EVENTS, actual);
    }

    private Set<Dependency> dependencies() {
        return classes.stream()
                .flatMap(javaClass -> javaClass.getDirectDependenciesFromSelf().stream())
                .filter(dependency -> dependency.getOriginClass().getName().startsWith(BASE_PACKAGE + "."))
                .collect(Collectors.toSet());
    }

    private boolean isAllowedControllerTarget(Dependency dependency) {
        String origin = dependency.getOriginClass().getName();
        String target = dependency.getTargetClass().getName();
        if ((origin.equals("com.mvp.backend.feature.requests.controller.AdminEventRequestController")
                && target.equals("com.mvp.backend.feature.events.dto.EventResponseDto"))
                || (origin.equals("com.mvp.backend.feature.notifications.controller.NotificationController")
                && target.equals("com.mvp.backend.feature.auth.security.UserPrincipal"))) {
            return true;
        }

        String targetPackage = dependency.getTargetClass().getPackageName();
        if ((targetPackage.equals(BASE_PACKAGE + ".shared")
                || targetPackage.startsWith(BASE_PACKAGE + ".shared."))
                || targetPackage.startsWith("java.")
                || targetPackage.startsWith("jakarta.")
                || targetPackage.startsWith("org.springframework.")
                || targetPackage.equals("lombok")
                || targetPackage.startsWith("lombok.")
                || targetPackage.startsWith("io.swagger.")) {
            return true;
        }

        return moduleOf(dependency.getOriginClass()).equals(moduleOf(dependency.getTargetClass()));
    }

    private boolean isController(JavaClass javaClass) {
        return javaClass.getPackageName().matches(".*\\.feature\\.[^.]+\\.controller(\\..*)?");
    }

    private boolean isFeatureRepository(JavaClass javaClass) {
        return javaClass.getPackageName().matches(".*\\.feature\\.[^.]+\\.repository(\\..*)?");
    }

    private String featureModuleOf(JavaClass javaClass) {
        String packageName = javaClass.getPackageName();
        String marker = BASE_PACKAGE + ".feature.";
        if (!packageName.startsWith(marker)) {
            return moduleOf(javaClass);
        }
        return packageName.substring(marker.length()).split("\\.")[0];
    }

    private String moduleOf(JavaClass javaClass) {
        String packageName = javaClass.getPackageName();
        String featureMarker = BASE_PACKAGE + ".feature.";
        if (packageName.startsWith(featureMarker)) {
            return packageName.substring(featureMarker.length()).split("\\.")[0];
        }
        String baseMarker = BASE_PACKAGE + ".";
        if (packageName.startsWith(baseMarker)) {
            String remainder = packageName.substring(baseMarker.length());
            return remainder.contains(".") ? remainder.substring(0, remainder.indexOf('.')) : remainder;
        }
        return "root";
    }

    private void assertSetEquals(String message, Set<String> expected, Set<String> actual) {
        Set<String> added = new TreeSet<>(actual);
        added.removeAll(expected);
        Set<String> removed = new TreeSet<>(expected);
        removed.removeAll(actual);
        assertEquals(expected, actual, message + "\nAdded: " + added + "\nRemoved: " + removed);
    }

    private record ModulePair(String origin, String target) {}
}
