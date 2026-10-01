import axios from "axios";
import api from "../../lib/http";
import type {
RegisterRequest,
RegisterResponse,
LoginRequest,
LoginResponse,
ChangePasswordRequest,
RefreshRequest,
UserSummary,
} from "./types";


export const AuthApi = {
register(data: RegisterRequest) {
return api.post<RegisterResponse>("/auth/register", data).then(r => r.data);
},
login(data: LoginRequest) {
return api.post<LoginResponse>("/auth/login", data).then(r => r.data);
},
changePassword(data: ChangePasswordRequest, accessToken?: string) {
if (accessToken) {
  // Token temporal (mustChangePassword): se evita el interceptor de http.ts,
  // que pisaría el header Authorization con el token guardado en localStorage.
  return axios
    .post<void>("/auth/change-password", data, {
      baseURL: api.defaults.baseURL,
      withCredentials: true,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    })
    .then(r => r.data);
}
return api.post<void>("/auth/change-password", data).then(r => r.data);
},
refresh(data: RefreshRequest) {
return api.post<LoginResponse>("/auth/refresh", data).then(r => r.data);
},
logout(refreshToken?: string) {
  const payload = refreshToken ? { refreshToken } : {};
  return api.post<void>("/auth/logout", payload).then(r => r.data);
},
me() {
return api.get<UserSummary>("/auth/me").then(r => r.data);
},
};