import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { AuthApi } from "./api";
import { getStoredTokens, setStoredTokens, clearStoredTokens, type Tokens } from "../../lib/http";
import type { LoginRequest, LoginResult, RegisterRequest, UserSummary } from "./types";
import { useAppStore } from "@/store";

export type AuthContextType = {
  user: UserSummary | null;
  tokens: Tokens | null;
  loading: boolean;
  login: (payload: LoginRequest) => Promise<LoginResult>;
  register: (payload: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  me: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<UserSummary | null>(null);
  const [authTokens, setAuthTokens] = useState<Tokens | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // Conectar con el store global
  const setAuth = useAppStore((state) => state.setAuth);
  const clearAuth = useAppStore((state) => state.clearAuth);

  useEffect(() => {
    // Al iniciar la app: intenta restaurar sesión desde tokens guardados
    (async () => {
      try {
        const stored = getStoredTokens();
        if (stored?.accessToken) {
          setAuthTokens(stored);
          const user = await AuthApi.me();
          setCurrentUser(user);
          // ✅ Sincronizar con store global
          setAuth(stored.accessToken, user.id.toString(), [`ROLE_${user.role}`]);
          
          console.log('✅ Sesión restaurada:', {
            user: user.username,
            role: user.role
          });
        }
      } catch (error) {
        console.error('❌ Error al restaurar sesión:', error);
        clearStoredTokens();
        setAuthTokens(null);
        clearAuth();
      } finally {
        setIsAuthLoading(false);
      }
    })();

    // Escucha cambios en localStorage desde otras pestañas (sincroniza sesión)
    const handleStorageSync = (e: StorageEvent) => {
      // ✅ Escuchar cambios en 'accessToken' o 'refreshToken'
      if (e.key === 'accessToken' || e.key === 'refreshToken' || e.key === null) {
        const stored = getStoredTokens();
        if (!stored) {
          setCurrentUser(null);
          setAuthTokens(null);
          clearAuth();
        } else {
          setAuthTokens(stored);
        }
      }
    };

    window.addEventListener("storage", handleStorageSync);
    return () => window.removeEventListener("storage", handleStorageSync);
  }, [setAuth, clearAuth]);

  const login = async (payload: LoginRequest): Promise<LoginResult> => {
    console.log('🔐 Iniciando login...');
    
    const response = await AuthApi.login(payload);

    // Contraseña temporal: el token sólo sirve para /auth/change-password.
    // No se guarda ni se consulta /auth/me; la pantalla de login maneja el cambio.
    if (response.mustChangePassword) {
      return { mustChangePassword: true, tempToken: response.accessToken };
    }
    
    console.log('✅ Login exitoso:', {
      username: payload.username,
      hasAccessToken: !!response.accessToken,
      hasRefreshToken: !!response.refreshToken
    });
    
    const nextTokens: Tokens = {
      accessToken: response.accessToken,
      refreshToken: response.refreshToken ?? "",
      expiresIn: response.expiresIn,
    };
    
    // ✅ Guardar tokens
    setStoredTokens(nextTokens);
    setAuthTokens(nextTokens);

    // ✅ Obtener datos del usuario
    const fetchedUser = await AuthApi.me();
    setCurrentUser(fetchedUser);

    console.log('✅ Usuario cargado:', {
      id: fetchedUser.id,
      username: fetchedUser.username,
      role: fetchedUser.role
    });

    // ✅ Sincronizar con store global
    setAuth(nextTokens.accessToken, fetchedUser.id.toString(), [`ROLE_${fetchedUser.role}`]);
  };

  const register = async (payload: RegisterRequest) => {
    await AuthApi.register(payload);
    // Después de registro, limpiar todo (debe hacer login)
    setStoredTokens(null);
    setAuthTokens(null);
    setCurrentUser(null);
    clearAuth();
  };

  const logout = async () => {
    console.log('🚪 Cerrando sesión...');
    setIsAuthLoading(true);
    
    try {
      if (authTokens?.refreshToken) {
        try {
          await AuthApi.logout(authTokens.refreshToken);
        } catch (err) {
          console.warn("Logout request failed (ignored):", err);
        }
      } else {
        try {
          await AuthApi.logout();
        } catch {}
      }
    } finally {
      // Limpia todo: tokens, usuario, localStorage
      clearStoredTokens();
      setAuthTokens(null);
      setCurrentUser(null);
      clearAuth(); // ✅ Limpiar store global
      setIsAuthLoading(false);
      
      console.log('✅ Sesión cerrada');
    }
  };

  const refresh = async () => {
    if (!authTokens?.refreshToken) return;
    
    console.log('🔄 Refrescando token...');
    
    const response = await AuthApi.refresh({ refreshToken: authTokens.refreshToken });
    const nextTokens: Tokens = {
      accessToken: response.accessToken,
      refreshToken: response.refreshToken ?? authTokens.refreshToken,
      expiresIn: response.expiresIn,
    };
    
    setStoredTokens(nextTokens);
    setAuthTokens(nextTokens);
    
    const fetchedUser = await AuthApi.me();
    setCurrentUser(fetchedUser);
    
    console.log('✅ Token refrescado');
  };

  const me = async () => {
    if (!authTokens?.accessToken) return;
    const fetchedUser = await AuthApi.me();
    setCurrentUser(fetchedUser);
  };

  const value = useMemo(
    () => ({
      user: currentUser,
      tokens: authTokens,
      loading: isAuthLoading,
      login,
      register,
      logout,
      refresh,
      me,
    }),
    [currentUser, authTokens, isAuthLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export { AuthContext };
