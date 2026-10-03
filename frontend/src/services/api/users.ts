import { httpClient } from './client';
import type { SpringPageResponse } from './types/pagination.types';
import type {
  AdminUser,
  CreateAdminUserInput,
  UpdateAdminUserInput,
  UserFilters,
  UserRole,
  UserRoleOption,
} from '@/models/user-admin';

const USERS_BASE_PATH = '/api/users';

function buildUsersQuery(filters: UserFilters = {}): string {
  const params = new URLSearchParams();

  if (filters.q && filters.q.trim().length > 0) {
    params.set('q', filters.q.trim());
  }
  if (filters.role) {
    params.set('role', filters.role);
  }
  if (filters.active !== undefined) {
    params.set('active', String(filters.active));
  }
  if (filters.page !== undefined) {
    params.set('page', String(filters.page));
  }
  if (filters.size !== undefined) {
    params.set('size', String(filters.size));
  }

  const query = params.toString();
  return query ? `?${query}` : '';
}

export const usersApi = {
  list(filters: UserFilters = {}) {
    const query = buildUsersQuery(filters);
    return httpClient.get<SpringPageResponse<AdminUser>>(`${USERS_BASE_PATH}${query}`);
  },

  getById(id: number) {
    return httpClient.get<AdminUser>(`${USERS_BASE_PATH}/${id}`);
  },

  create(payload: CreateAdminUserInput) {
    return httpClient.post<AdminUser>(USERS_BASE_PATH, payload);
  },

  update(id: number, payload: UpdateAdminUserInput) {
    return httpClient.patch<AdminUser>(`${USERS_BASE_PATH}/${id}`, payload);
  },

  updateRole(id: number, role: UserRole) {
    return httpClient.patch<AdminUser>(`${USERS_BASE_PATH}/${id}/role`, { role });
  },

  updateStatus(id: number, active: boolean) {
    return httpClient.patch<AdminUser>(`${USERS_BASE_PATH}/${id}/status`, { active });
  },

  resetPassword(id: number) {
    return httpClient.post<AdminUser>(`${USERS_BASE_PATH}/${id}/reset-password`);
  },

  listRoles() {
    return httpClient.get<UserRoleOption[]>(`${USERS_BASE_PATH}/roles`);
  },
};
