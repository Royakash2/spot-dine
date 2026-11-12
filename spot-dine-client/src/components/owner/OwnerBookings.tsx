import { Calendar, Users, Clock } from "lucide-react";
import { formatCalendarDate, formatTimeSlot } from "../../lib/date.ts";
import type { Booking, BookingStatus } from "../../types.ts";

const statusStyles: Record<BookingStatus, string> = {
    pending: "bg-amber-100 text-amber-800",
    confirmed: "bg-blue-100 text-blue-800",
    completed: "bg-green-100 text-green-800",
    cancelled: "bg-error-container text-on-error-container",
};

interface OwnerBookingsProps {
    bookings: Booking[];
    totalSeats: number;
    updatingBookingId: string | null;
    onUpdateStatus: (booking: Booking, status: BookingStatus) => void;
}

export default function OwnerBookings({
    bookings,
    totalSeats,
    updatingBookingId,
    onUpdateStatus,
}: OwnerBookingsProps) {
    return (
        <div className="space-y-6 text-left">
            <div className="flex justify-between items-center">
                <h3 className="font-display text-lg font-medium text-primary">Active Reservations</h3>
                <span className="text-xs text-black/55">Total capacity: {totalSeats} seats</span>
            </div>

            {bookings.length === 0 ? (
                <div className="bg-white border border-outline-variant/10 p-12 text-center rounded-md">
                    <Calendar size={32} className="mx-auto text-outline-variant mb-2" />
                    <p className="text-xs text-black/55 italic">No booking records found.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {bookings.map((booking) => {
                        const guestName =
                            typeof booking.user === "string"
                                ? booking.guestName || "Guest"
                                : booking.user.name;
                        const isUpdating = updatingBookingId === booking._id;

                        return (
                            <div
                                key={booking._id}
                                className="bg-white border border-outline-variant/20 rounded-md p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6"
                            >
                                <div className="space-y-1.5 flex-1">
                                    <div className="flex items-center gap-3">
                                        <h4 className="font-display text-base font-medium text-primary">{guestName}</h4>
                                        <span className="text-[9px] text-black/50 border border-outline-variant/30 px-1.5 py-0.5">
                                            {booking.bookingId}
                                        </span>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-black/55">
                                        <span className="flex items-center gap-1">
                                            <Users size={12} /> {booking.guests} Guests
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Clock size={12} /> {formatTimeSlot(booking.timeSlot)}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Calendar size={12} />
                                            {formatCalendarDate(booking.date, {
                                                month: "short",
                                                day: "numeric",
                                                year: "numeric",
                                            })}
                                        </span>
                                    </div>
                                    {booking.specialRequests && (
                                        <p className="text-xs text-secondary/80 bg-secondary/5 px-3 py-1.5 rounded-sm border-l-2 border-secondary mt-2">
                                            <strong>Requests:</strong> {booking.specialRequests}
                                        </p>
                                    )}
                                </div>

                                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
                                    <span
                                        className={`text-[9px] font-medium tracking-wider uppercase px-2 py-0.5 rounded-sm ${statusStyles[booking.status]}`}
                                    >
                                        {booking.status}
                                    </span>

                                    {booking.status === "pending" && (
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => onUpdateStatus(booking, "confirmed")}
                                                disabled={isUpdating}
                                                className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-[9px] font-medium tracking-wider uppercase transition-colors rounded-sm cursor-pointer disabled:opacity-50 disabled:cursor-wait"
                                            >
                                                {isUpdating ? "Saving..." : "Confirm"}
                                            </button>
                                            <button
                                                onClick={() => onUpdateStatus(booking, "cancelled")}
                                                disabled={isUpdating}
                                                className="px-3 py-1.5 bg-error hover:bg-error/85 text-white text-[9px] font-medium tracking-wider uppercase transition-colors rounded-sm cursor-pointer disabled:opacity-50 disabled:cursor-wait"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    )}

                                    {booking.status === "confirmed" && (
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => onUpdateStatus(booking, "completed")}
                                                disabled={isUpdating}
                                                className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-[9px] font-medium tracking-wider uppercase transition-colors rounded-sm cursor-pointer disabled:opacity-50 disabled:cursor-wait"
                                            >
                                                {isUpdating ? "Saving..." : "Complete"}
                                            </button>
                                            <button
                                                onClick={() => onUpdateStatus(booking, "cancelled")}
                                                disabled={isUpdating}
                                                className="px-3 py-1.5 bg-error hover:bg-error/85 text-white text-[9px] font-medium tracking-wider uppercase transition-colors rounded-sm cursor-pointer disabled:opacity-50 disabled:cursor-wait"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
