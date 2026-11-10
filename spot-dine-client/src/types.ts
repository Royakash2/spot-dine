// Shapes returned by the SpotDine API. Mirrors server/models/*.ts — the server
// is the source of truth, so update these when a model changes.

export type Role = "user" | "owner" | "admin";

export interface User {
    _id: string;
    name: string;
    email: string;
    phone: string | null;
    role: Role;
}

export interface UserSummary {
    _id: string;
    name: string;
    email?: string;
    phone?: string;
}

export interface AuthResponse {
    success: true;
    message: string;
    token: string;
    user: User;
}

export type PriceRange = "$" | "$$" | "$$$" | "$$$$";
export type RestaurantStatus = "pending" | "approved" | "rejected";

export interface Restaurant {
    _id: string;
    name: string;
    slug: string;
    description: string;
    cuisine: string;
    priceRange: PriceRange;
    rating: number;
    reviewCount: number;
    location: string;
    address: string;
    image: string;
    chef: string;
    tags: string[];
    availableSlots: string[];
    featured: boolean;
    exclusive: boolean;
    owner: string | UserSummary;
    status: RestaurantStatus;
    totalSeats: number;
    createdAt: string;
    updatedAt: string;
}

// Embedded inside bookings and admin lists, where only a few fields are populated.
export type RestaurantSummary = Pick<
    Restaurant,
    "_id" | "name" | "slug" | "location" | "address" | "image"
> &
    Partial<Restaurant>;

export type BookingStatus = "pending" | "confirmed" | "completed" | "cancelled";

export interface Booking {
    _id: string;
    bookingId: string;
    user: string | UserSummary;
    restaurant: string | RestaurantSummary;
    date: string;
    timeSlot: string;
    guests: number;
    occasion?: string;
    guestName: string;
    guestEmail: string;
    guestPhone: string;
    status: BookingStatus;
    specialRequests?: string;
    createdAt: string;
    updatedAt: string;
}

export interface Review {
    _id: string;
    restaurant: string;
    user: string | UserSummary;
    booking: string;
    rating: number;
    comment: string;
    visitedDate: string;
    createdAt: string;
    updatedAt: string;
}

export interface SlotAvailability {
    time: string;
    availableSeats: number;
    isAvailable: boolean;
}

export interface PaginationMeta {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
}

export interface ApiMessage {
    success: true;
    message: string;
}
