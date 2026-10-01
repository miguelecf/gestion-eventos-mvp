# syntax=docker/dockerfile:1

FROM eclipse-temurin:17-jdk-jammy AS build

WORKDIR /workspace

COPY .mvn/ .mvn/
COPY mvnw pom.xml ./

RUN chmod +x mvnw

RUN ./mvnw -B -ntp -DskipTests dependency:go-offline

COPY src/main src/main

RUN ./mvnw -B -ntp -DskipTests package


FROM eclipse-temurin:17-jre-jammy AS runtime

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl netcat-openbsd \
    && rm -rf /var/lib/apt/lists/*

RUN groupadd --system spring \
    && useradd --system --gid spring --create-home --home-dir /app spring

WORKDIR /app

COPY --from=build /workspace/target/*.jar app.jar
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

RUN chmod +x /usr/local/bin/docker-entrypoint.sh \
    && chown spring:spring /app/app.jar

USER spring

ENV SPRING_PROFILES_ACTIVE=docker
ENV JAVA_OPTS=""

EXPOSE 9090

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=5 \
  CMD curl -fsS http://localhost:9090/actuator/health || exit 1

ENTRYPOINT ["docker-entrypoint.sh"]
