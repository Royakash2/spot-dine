import axios, { AxiosError } from "axios";
import type { AuthResponse, Role, User } from "../types.ts";

const TOKEN_KEY = "token";

// Fired when the API rejects a stored token, so AppContext can drop the
// session and reopen the auth modal.
export const AUTH_EXPIRED_EVENT = "spotdine:auth-expired";

export const getToken = (): string | null => localStorage.getItem(TOKEN_KEY);

export const setToken = (token: string | null): void => {
    if (token) {
        localStorage.setItem(TOKEN_KEY, token);
    } else {
        localStorage.removeItem(TOKEN_KEY);
    }
};

export class ApiError extends Error {
    status: number | null;

    constructor(message: string, status: number | null = null) {
        super(message);
        this.name = "ApiError";
        this.status = status;
    }
}

export const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:5000/api",
    timeout: 15000,
});

api.interceptors.request.use((config) => {
    const token = getToken();
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

interface ErrorBody {
    message?: string;
}

const ENDPOINTS_WITHOUT_SESSION = ["/auth/login", "/auth/register"];

const describeError = (error: AxiosError<ErrorBody>): string => {
    if (error.response?.data?.message) return error.response.data.message;
    if (error.code === "ECONNABORTED") return "The request timed out. Please try again.";
    if (!error.response) return "Cannot reach the server. Please check your connection.";
    return error.message || "Something went wrong";
};

api.interceptors.response.use(
    (response) => response,
    (error: AxiosError<ErrorBody>) => {
        const status = error.response?.status ?? null;
        const url = error.config?.url ?? "";
        const isAuthAttempt = ENDPOINTS_WITHOUT_SESSION.some((path) => url.startsWith(path));

        // A 401 on login/register means wrong credentials, not an expired
        // session, so only clear a token the user actually had.
        if (status === 401 && !isAuthAttempt && getToken()) {
            setToken(null);
            window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
        }

        return Promise.reject(new ApiError(describeError(error), status));
    },
);

interface RegisterPayload {
    name: string;
    email: string;
    password: string;
    phone?: string;
    role?: Extract<Role, "user" | "owner">;
}

export const authApi = {
    async login(email: string, password: string): Promise<AuthResponse> {
        const { data } = await api.post<AuthResponse>("/auth/login", { email, password });
        return data;
    },

    async register(payload: RegisterPayload): Promise<AuthResponse> {
        const { data } = await api.post<AuthResponse>("/auth/register", payload);
        return data;
    },

    async me(): Promise<User> {
        const { data } = await api.get<{ success: true; user: User }>("/auth/me");
        return data.user;
    },
};
