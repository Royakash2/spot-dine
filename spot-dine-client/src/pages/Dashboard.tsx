import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAppContext } from "../context/AppContext.tsx";
import Navbar from "../components/Navbar.tsx";
import Footer from "../components/Footer.tsx";
import RestaurantCard from "../components/RestaurantCard.tsx";
import AuthModal from "../components/AuthModal.tsx";
import { CalendarIcon, UsersIcon, ClockIcon, MapPinIcon, CalendarDaysIcon } from "lucide-react";
import toast from "react-hot-toast";
import { bookingApi, restaurantApi } from "../lib/api.ts";
import { formatCalendarDate, formatTimeSlot, todayInputValue } from "../lib/date.ts";
import type { Booking, BookingStatus, Restaurant } from "../types.ts";

type BookingsState =
    | { status: "loading" }
    | { status: "error"; message: string }
    | { status: "ready"; bookings: Booking[] };

const statusStyles: Record<BookingStatus, string> = {
    pending: "bg-amber-100 text-amber-800",
    confirmed: "bg-secondary-container/30 text-on-secondary-container",
    completed: "bg-green-100 text-green-800",
    cancelled: "bg-error-container text-on-error-container",
};

export default function Dashboard() {
    const { user } = useAppContext();

    const [state, setState] = useState<BookingsState>({ status: "loading" });
    const [reloadKey, setReloadKey] = useState(0);
    const [cancellingId, setCancellingId] = useState<string | null>(null);
    const [recommendations, setRecommendations] = useState<Restaurant[] | null>(null);

    useEffect(() => {
        let active = true;

        bookingApi
            .mine()
            .then((bookings) => {
                if (active) setState({ status: "ready", bookings });
            })
            .catch((err: unknown) => {
                if (!active) return;
                setState({
                    status: "error",
                    message: err instanceof Error ? err.message : "Could not load your bookings.",
                });
            });

        return () => {
            active = false;
        };
    }, [reloadKey]);

    useEffect(() => {
        let active = true;

        restaurantApi
            .list({ sort: "rating", limit: 3 })
            .then((data) => {
                if (active) setRecommendations(data.restaurants);
            })
            .catch(() => {
                // Recommendations are a nice-to-have; the page still works without them.
                if (active) setRecommendations([]);
            });

        return () => {
            active = false;
        };
    }, []);

    const bookings = state.status === "ready" ? state.bookings : [];
    const loadingBookings = state.status === "loading";
    const errorBookings = state.status === "error" ? state.message : null;

    const handleRetry = () => {
        setState({ status: "loading" });
        setReloadKey((key) => key + 1);
    };

    const handleCancelBooking = async (booking: Booking) => {
        if (!window.confirm("Are you sure you want to cancel this booking?")) {
            return;
        }

        setCancellingId(booking._id);

        try {
            await bookingApi.cancel(booking._id);
            setState((previous) =>
                previous.status === "ready"
                    ? {
                          ...previous,
                          bookings: previous.bookings.map((item) =>
                              item._id === booking._id
                                  ? { ...item, status: "cancelled" as const }
                                  : item,
                          ),
                      }
                    : previous,
            );
            toast.success("Reservation cancelled successfully.");
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "Could not cancel the booking.");
        } finally {
            setCancellingId(null);
        }
    };

    if (!user) return null;

    // Booking dates are calendar days stored at UTC midnight, so today is
    // measured from UTC midnight as well.
    const todayStart = new Date(`${todayInputValue()}T00:00:00.000Z`).getTime();

    const upcomingBookings = bookings.filter(
        (booking) =>
            new Date(booking.date).getTime() >= todayStart &&
            (booking.status === "pending" || booking.status === "confirmed"),
    );

    const pastBookings = bookings.filter((booking) => !upcomingBookings.includes(booking));

    return (
        <div className="min-h-screen bg-surface flex flex-col">
            <Navbar />
            <AuthModal />

            <main className="grow max-w-7xl w-full mx-auto px-6 md:px-10 py-12">
                {/* Main Content Area */}
                <div className="grow space-y-10">
                    {/* Welcoming header */}
                    <div className="pb-4 border-b border-outline-variant/10">
                        <h2 className="font-display text-2xl md:text-3xl font-semibold text-primary">
                            Welcome back, {user.name.split(" ")[0]}
                        </h2>
                        <p className="text-xs text-black/55 mt-1.5">Manage your upcoming dining experiences.</p>
                    </div>

                    <div className="space-y-10">
                        {/* Upcoming Reservations */}
                        <div className="space-y-4">
                            <h3 className="font-display text-lg font-medium text-primary">Upcoming Bookings</h3>

                            {loadingBookings ? (
                                <div className="bg-white border border-outline-variant/10 p-12 text-center flex justify-center">
                                    <div className="w-6 h-6 border-2 border-outline-variant/30 border-t-secondary rounded-full animate-spin"></div>
                                </div>
                            ) : errorBookings ? (
                                <div className="bg-white border border-outline-variant/10 p-12 text-center rounded-md space-y-3">
                                    <p className="text-xs text-black/55 italic">{errorBookings}</p>
                                    <button
                                        onClick={handleRetry}
                                        className="text-[10px] font-medium tracking-widest uppercase text-secondary hover:underline cursor-pointer"
                                    >
                                        Try Again
                                    </button>
                                </div>
                            ) : upcomingBookings.length === 0 ? (
                                <div className="bg-white border border-outline-variant/10 p-12 text-center rounded-md">
                                    <CalendarDaysIcon size={36} className="mx-auto text-outline-variant mb-2" />

                                    <p className="text-xs text-black/55 italic">No upcoming reservations scheduled.</p>

                                    <Link
                                        to="/search"
                                        className="inline-block mt-4 bg-primary hover:bg-secondary text-white text-[10px] font-medium tracking-widest uppercase px-6 py-2.5 transition-colors"
                                    >
                                        Book a Table
                                    </Link>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {upcomingBookings.map((b) => (
                                        <div
                                            key={b._id}
                                            className="bg-white border border-outline-variant/20 rounded-md p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6"
                                        >
                                            <div className="flex gap-4">
                                                <div className="w-16 h-16 rounded-sm overflow-hidden shrink-0 bg-surface">
                                                    <img
                                                        src={typeof b.restaurant === "string" ? "" : b.restaurant.image}
                                                        alt={typeof b.restaurant === "string" ? "" : b.restaurant.name}
                                                        className="w-full h-full object-cover"
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[9px] font-medium text-secondary tracking-widest uppercase">
                                                            {typeof b.restaurant === "string"
                                                                ? ""
                                                                : b.restaurant.cuisine}
                                                        </span>
                                                        <span
                                                            className={`inline-block py-0.5 px-2 text-[9px] font-medium tracking-wider uppercase rounded-sm ${statusStyles[b.status]}`}
                                                        >
                                                            {b.status}
                                                        </span>
                                                    </div>
                                                    <h4 className="font-display text-base font-medium text-primary">
                                                        {typeof b.restaurant === "string"
                                                            ? "Restaurant"
                                                            : b.restaurant.name}
                                                    </h4>
                                                    <p className="text-xs text-black/55 flex items-center gap-1">
                                                        <MapPinIcon size={12} />
                                                        {typeof b.restaurant === "string"
                                                            ? ""
                                                            : b.restaurant.location}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex flex-wrap items-center gap-6 text-xs text-on-surface bg-surface-container-low p-4 rounded-md border border-outline-variant/10 w-full md:w-auto">
                                                <div className="flex items-center gap-2 pr-4 md:border-r border-outline-variant/20">
                                                    <CalendarIcon size={14} className="text-secondary" />
                                                    <span className="font-medium">
                                                        {formatCalendarDate(b.date, {
                                                            month: "short",
                                                            day: "numeric",
                                                            year: "numeric",
                                                        })}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2 pr-4 md:border-r border-outline-variant/20">
                                                    <ClockIcon size={14} className="text-secondary" />
                                                    <span className="font-medium">{formatTimeSlot(b.timeSlot)}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <UsersIcon size={14} className="text-secondary" />
                                                    <span className="font-medium">{b.guests} Guests</span>
                                                </div>
                                            </div>

                                            <div className="flex gap-3 w-full md:w-auto justify-end">
                                                <button
                                                    onClick={() => handleCancelBooking(b)}
                                                    disabled={cancellingId === b._id}
                                                    className="px-5 py-2.5 text-[10px] font-medium tracking-widest uppercase text-error hover:bg-error-container/20 border border-outline-variant/40 rounded-sm cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-wait"
                                                >
                                                    {cancellingId === b._id ? "Cancelling..." : "Cancel"}
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Past & Cancelled Dining History */}
                        <div className="space-y-4">
                            {loadingBookings
                                ? null
                                : pastBookings.length !== 0 && (
                                      <>
                                          <h3 className="font-display text-lg font-medium text-primary">Dining History</h3>
                                          <div className="bg-white border border-outline-variant/20 rounded-md overflow-hidden shadow-sm">
                                              <table className="w-full text-left text-xs border-collapse">
                                                  <thead>
                                                      <tr className="bg-surface-container-low border-b border-outline-variant/10 text-[10px] font-medium tracking-wider text-black/55 uppercase">
                                                          <th className="p-4">Restaurant</th>
                                                          <th className="p-4">Date & Time</th>
                                                          <th className="p-4">Party</th>
                                                          <th className="p-4">Status</th>
                                                      </tr>
                                                  </thead>
                                                  <tbody className="divide-y divide-outline-variant/10">
                                                      {pastBookings.map((b) => (
                                                          <tr key={b._id} className="hover:bg-surface/50">
                                                              <td className="p-4 font-medium text-primary">
                                                                  <Link
                                                                      to={`/restaurant/${
                                                                          typeof b.restaurant === "string"
                                                                              ? ""
                                                                              : b.restaurant.slug
                                                                      }`}
                                                                      className="hover:text-secondary"
                                                                  >
                                                                      {typeof b.restaurant === "string"
                                                                          ? "Restaurant"
                                                                          : b.restaurant.name}
                                                                  </Link>
                                                              </td>
                                                              <td className="p-4">
                                                                  {formatCalendarDate(b.date, {
                                                                      month: "short",
                                                                      day: "numeric",
                                                                      year: "numeric",
                                                                  })}{" "}
                                                                  at {formatTimeSlot(b.timeSlot)}
                                                              </td>
                                                              <td className="p-4">
                                                                  {b.guests} {b.guests === 1 ? "Guest" : "Guests"}
                                                              </td>
                                                              <td className="p-4">
                                                                  <span
                                                                      className={`inline-block py-0.5 px-2 text-[9px] font-medium tracking-wider uppercase rounded-sm ${statusStyles[b.status]}`}
                                                                  >
                                                                      {b.status}
                                                                  </span>
                                                              </td>
                                                          </tr>
                                                      ))}
                                                  </tbody>
                                              </table>
                                          </div>
                                      </>
                                  )}
                        </div>
                    </div>

                    {/* Recommendations Section */}
                    {recommendations && recommendations.length > 0 && (
                        <div className="space-y-4 pt-10 border-t border-outline-variant/10">
                            <h3 className="font-display text-lg font-medium text-primary">Recommended for You</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {recommendations.map((restaurant) => (
                                    <RestaurantCard key={restaurant._id} restaurant={restaurant} />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </main>

            <Footer />
        </div>
    );
}
