export type RegisterRequest = {
    email: string;
    password: string;
    name?: string;
};


export type RegisterResponse = {
    id: string;
    email: string;
};


export type LoginRequest = {
    username: string;
    password: string;
};


export type LoginResponse = {
    accessToken: string;
    refreshToken?: string;
    tokenType: string;
    expiresIn: number;
    mustChangePassword?: boolean;
    user?: {
        id: number;
        username: string;
        role: string;
    };
};


export type ChangePasswordRequest = {
    currentPassword: string;
    newPassword: string;
};


export type LoginResult = { mustChangePassword: true; tempToken: string } | undefined;


export type RefreshRequest = {
    refreshToken: string;
};


export type UserSummary = {
    id: number;
    username: string;
    role:string;
    // otros campos si es necesario
    email?:string;
    name?:string;
    roles?:string[];
};