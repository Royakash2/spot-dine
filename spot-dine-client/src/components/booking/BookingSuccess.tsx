import { Link } from "react-router-dom";
import { Calendar, Users, Clock, MapPin, Check } from "lucide-react";
import { formatCalendarDate, formatTimeSlot } from "../../lib/date.ts";
import type { Booking, Restaurant } from "../../types.ts";

interface BookingSuccessProps {
    booking: Booking;
    restaurant: Restaurant;
}

export default function BookingSuccess({ booking, restaurant }: BookingSuccessProps) {
    const isConfirmed = booking.status === "confirmed";

    return (
        <div className="max-w-xl w-full bg-white border border-outline-variant/20 p-10 text-center rounded-lg ambient-shadow space-y-8 animate-in zoom-in-95 duration-300">
            <div className="w-16 h-16 bg-secondary/15 rounded-full flex items-center justify-center text-secondary mx-auto">
                <Check size={32} />
            </div>

            <div className="space-y-3">
                <h2 className="font-display text-3xl font-medium text-primary">
                    {isConfirmed ? "Reservation Confirmed" : "Booking Requested"}
                </h2>
                <p className="text-xs text-black/55 max-w-sm mx-auto leading-relaxed">
                    {isConfirmed ? (
                        <>
                            Your table at{" "}
                            <span className="text-primary">{restaurant.name}</span> is confirmed. We
                            look forward to seeing you.
                        </>
                    ) : (
                        <>
                            Your request at{" "}
                            <span className="text-primary">{restaurant.name}</span> has been sent.
                            The restaurant will confirm your table shortly.
                        </>
                    )}
                </p>
            </div>

            {/* Confirmation Card Details */}
            <div className="bg-surface-container-low p-6 rounded-md space-y-4 text-left border border-outline-variant/10">
                <div className="flex justify-between items-center pb-3 border-b border-outline-variant/10 gap-4">
                    <span className="text-[10px] font-medium text-black/55 tracking-wider uppercase">
                        REFERENCE CODE
                    </span>
                    <span className="text-sm font-medium text-secondary">{booking.bookingId}</span>
                </div>

                <div className="space-y-3 text-xs text-on-surface">
                    <div className="flex items-center gap-3">
                        <Calendar size={14} className="text-black/55" />
                        <span>
                            {formatCalendarDate(booking.date, {
                                weekday: "long",
                                year: "numeric",
                                month: "long",
                                day: "numeric",
                            })}
                        </span>
                    </div>
                    <div className="flex items-center gap-3">
                        <Clock size={14} className="text-black/55" />
                        <span>{formatTimeSlot(booking.timeSlot)}</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <Users size={14} className="text-black/55" />
                        <span>
                            {booking.guests} {booking.guests === 1 ? "Guest" : "Guests"}
                        </span>
                    </div>
                    <div className="flex items-start gap-3">
                        <MapPin size={14} className="text-black/55 mt-0.5" />
                        <span>{restaurant.address}</span>
                    </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-outline-variant/10 gap-4">
                    <span className="text-[10px] font-medium text-black/55 tracking-wider uppercase">
                        STATUS
                    </span>
                    <span className="inline-block py-0.5 px-2 text-[9px] font-medium tracking-wider uppercase rounded-sm bg-secondary-container/30 text-on-secondary-container">
                        {booking.status}
                    </span>
                </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <Link
                    to="/dashboard"
                    className="flex-1 bg-primary hover:bg-primary-container text-white py-3.5 px-4 text-xs font-medium tracking-widest uppercase hover:text-secondary text-center cursor-pointer transition-colors"
                >
                    MY BOOKINGS
                </Link>
                <Link
                    to="/"
                    className="flex-1 border border-outline-variant/50 hover:border-primary text-primary py-3.5 px-4 text-xs font-medium tracking-widest uppercase text-center cursor-pointer transition-colors"
                >
                    DISCOVER MORE
                </Link>
            </div>
        </div>
    );
}
