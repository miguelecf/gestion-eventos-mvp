package com.mvp.backend.feature.auth.service;

import com.mvp.backend.feature.auth.exception.EmailDeliveryException;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@Slf4j
public class EmailService {

    private final JavaMailSender emailSender;

    @Value("${app.mail.from:noreply@gestion-eventos.local}")
    private String from;

    @Value("${app.mail.mock-mode:true}")
    private boolean mockMode;

    @Value("${app.mail.fail-on-error:true}")
    private boolean failOnError;

    /**
     * Hallazgo 5.5: el modo mock debe ser evidente. En mock no se envía nada: los correos (incluidas
     * credenciales temporales) sólo se escriben en el log. Uso exclusivo de desarrollo local;
     * el perfil docker lo desactiva (MAIL_MOCK_MODE=false) y entrega en Mailpit.
     */
    @PostConstruct
    void warnIfMockMode() {
        if (mockMode) {
            log.warn("[MAIL_MOCK] app.mail.mock-mode=true: NO se envían correos; se registran en el log "
                    + "(incluye contraseñas temporales). Sólo para desarrollo local.");
        }
    }

    public void sendNewPassword(String to, String temporaryPassword) {
        String subject = "Gestion de Eventos - ALTA DE USUARIO";
        String textBody = "Hola,\n te informamos que tu usuario ha sido dado de alta y que la contrasenia es: "
                + temporaryPassword + "\nPor favor, cambiala al iniciar sesion.\nSaludos.";
        sendInternal(
                to,
                subject,
                textBody,
                () -> log.info("[MAIL_MOCK] Alta de usuario para {} con password temporal {}", to, temporaryPassword),
                "No se pudo enviar el email de credenciales");
    }

    public void send(String to, String subject, String textBody) {
        sendInternal(
                to,
                subject,
                textBody,
                () -> log.info("[MAIL_MOCK] Email simulado to={} subject={} body={}", to, subject, textBody),
                "No se pudo enviar el email");
    }

    private void sendInternal(String to, String subject, String textBody, Runnable mockLogger, String errorMessage) {
        if (mockMode) {
            mockLogger.run();
            return;
        }

        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(from);
        message.setTo(to);
        message.setSubject(subject);
        message.setText(textBody);

        try {
            emailSender.send(message);
        } catch (Exception e) {
            if (failOnError) {
                throw new EmailDeliveryException(errorMessage, e);
            }
            log.error("Fallo al enviar email a {} con asunto {}. Se continua por fail-on-error=false", to, subject, e);
        }
    }
}
