package com.mvp.backend.feature.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ChangePasswordRequest {

    @NotBlank(message = "Debe indicar la contraseña actual")
    private String currentPassword;

    @NotBlank
    @Size(min = 10, max = 128)
    @Pattern(regexp = "^(?=.*[A-Za-z])(?=.*\\d).{10,}$", message = "La contraseña debe tener al menos 10 caracteres, incluyendo letras y números")
    private String newPassword;
}
