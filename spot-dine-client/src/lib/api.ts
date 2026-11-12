import axios, { AxiosError } from "axios";
import type {
    AuthResponse,
    Booking,
    BookingStatus,
    PaginationMeta,
    Restaurant,
    Review,
    Role,
    SlotAvailability,
    User,
} from "../types.ts";

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

export interface RestaurantQuery {
    search?: string;
    location?: string;
    cuisine?: string[];
    priceRange?: string[];
    sort?: "price_low" | "price_high" | "rating" | "";
    page?: number;
    limit?: number;
}

export interface RestaurantListResponse extends PaginationMeta {
    success: true;
    count: number;
    restaurants: Restaurant[];
}

// Repeated keys (cuisine=Italian&cuisine=French) is what the API expects;
// axios' default array serialization would send cuisine[]=... instead.
const toSearchParams = (query: RestaurantQuery): URLSearchParams => {
    const params = new URLSearchParams();

    if (query.search) params.set("search", query.search);
    if (query.location) params.set("location", query.location);
    if (query.sort) params.set("sort", query.sort);
    if (query.page && query.page > 1) params.set("page", String(query.page));
    if (query.limit) params.set("limit", String(query.limit));
    query.cuisine?.forEach((cuisine) => params.append("cuisine", cuisine));
    query.priceRange?.forEach((price) => params.append("priceRange", price));

    return params;
};

export interface AvailabilityResponse {
    success: true;
    date: string;
    totalSeats: number;
    guests: number;
    slots: SlotAvailability[];
}

export interface ReviewListResponse extends PaginationMeta {
    success: true;
    count: number;
    rating: number;
    reviewCount: number;
    reviews: Review[];
}

export const restaurantApi = {
    async list(query: RestaurantQuery = {}): Promise<RestaurantListResponse> {
        const { data } = await api.get<RestaurantListResponse>("/restaurants", {
            params: toSearchParams(query),
        });
        return data;
    },

    async featured(): Promise<Restaurant[]> {
        const { data } = await api.get<{ success: true; count: number; restaurants: Restaurant[] }>(
            "/restaurants/featured",
        );
        return data.restaurants;
    },

    // The signed-in owner's own listings, newest first (any status).
    async mine(): Promise<Restaurant[]> {
        const { data } = await api.get<{ success: true; count: number; restaurants: Restaurant[] }>(
            "/restaurants/my",
        );
        return data.restaurants;
    },

    // Public detail pages only resolve approved restaurants; anything else is a 404.
    async getBySlug(slug: string): Promise<Restaurant> {
        const { data } = await api.get<{ success: true; restaurant: Restaurant }>(
            `/restaurants/${encodeURIComponent(slug)}`,
        );
        return data.restaurant;
    },

    async availability(
        id: string,
        params: { date: string; guests?: number },
    ): Promise<AvailabilityResponse> {
        const { data } = await api.get<AvailabilityResponse>(
            `/restaurants/${id}/availability`,
            { params },
        );
        return data;
    },
};

export const reviewApi = {
    async list(
        restaurant: string,
        query: { page?: number; limit?: number } = {},
    ): Promise<ReviewListResponse> {
        const { data } = await api.get<ReviewListResponse>("/reviews", {
            params: { restaurant, ...query },
        });
        return data;
    },
};

export interface CreateBookingPayload {
    restaurantId: string;
    date: string;
    timeSlot: string;
    guests: number;
    name: string;
    email: string;
    phone: string;
    occasion?: string;
    specialRequests?: string;
}

export interface BookingResponse {
    success: true;
    message: string;
    booking: Booking;
}

export interface BookingListResponse extends PaginationMeta {
    success: true;
    count: number;
    bookings: Booking[];
}

export const bookingApi = {
    async create(payload: CreateBookingPayload): Promise<BookingResponse> {
        const { data } = await api.post<BookingResponse>("/bookings", payload);
        return data;
    },

    async mine(): Promise<Booking[]> {
        const { data } = await api.get<{
            success: true;
            count: number;
            bookings: Booking[];
        }>("/bookings/my");
        return data.bookings;
    },

    // Soft-cancel: the server keeps the record and sets its status.
    async cancel(id: string): Promise<Booking> {
        const { data } = await api.patch<BookingResponse>(
            `/bookings/${encodeURIComponent(id)}/cancel`,
        );
        return data.booking;
    },

    // Owner view: reservations for one restaurant, with the guest populated.
    async forRestaurant(
        restaurantId: string,
        query: { status?: BookingStatus; date?: string; page?: number; limit?: number } = {},
    ): Promise<BookingListResponse> {
        const params = new URLSearchParams();

        if (query.status) params.set("status", query.status);
        if (query.date) params.set("date", query.date);
        if (query.page && query.page > 1) params.set("page", String(query.page));
        if (query.limit) params.set("limit", String(query.limit));

        const { data } = await api.get<BookingListResponse>(
            `/bookings/restaurant/${encodeURIComponent(restaurantId)}`,
            { params },
        );
        return data;
    },

    async confirm(id: string): Promise<Booking> {
        const { data } = await api.patch<BookingResponse>(
            `/bookings/${encodeURIComponent(id)}/confirm`,
        );
        return data.booking;
    },

    async complete(id: string): Promise<Booking> {
        const { data } = await api.patch<BookingResponse>(
            `/bookings/${encodeURIComponent(id)}/complete`,
        );
        return data.booking;
    },
};

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
