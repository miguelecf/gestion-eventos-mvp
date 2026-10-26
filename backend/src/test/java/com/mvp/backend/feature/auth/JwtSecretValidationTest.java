package com.mvp.backend.feature.auth;

import com.mvp.backend.feature.auth.security.JwtTokenProvider;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** REV-11: el backend no arranca sin una clave JWT propia. */
class JwtSecretValidationTest {

    private static void init(String secret) {
        ReflectionTestUtils.invokeMethod(new JwtTokenProvider(secret, 900_000), "init");
    }

    @Test
    void rechazaClaveAusenteCortaOPublicada() {
        assertThatThrownBy(() -> init("")).isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> init("corta")).isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> init("aaee89681dd2ffeec808837802a9fdb19b157c71aea36e1886e42c7b2fe0fd7c"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("publicada");
    }

    @Test
    void aceptaUnaClavePropiaDeAlMenos32Bytes() {
        assertThatCode(() -> init("0123456789abcdef0123456789abcdef")).doesNotThrowAnyException();
    }
}
