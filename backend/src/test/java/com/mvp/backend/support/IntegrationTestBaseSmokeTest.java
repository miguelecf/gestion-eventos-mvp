package com.mvp.backend.support;

import org.junit.jupiter.api.Test;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class IntegrationTestBaseSmokeTest extends IntegrationTestBase {

    @Test
    void cadaRolPuedeAutenticarse() throws Exception {
        for (Role role : Role.values()) {
            mockMvc.perform(as(role, get("/auth/me")))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.role").value(role.name()));
        }
    }

    @Test
    void sinTokenLaApiInternaRechaza() throws Exception {
        mockMvc.perform(get("/api/events")).andExpect(status().is4xxClientError());
    }
}
