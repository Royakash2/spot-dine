import { useEffect, useState } from "react";
import Navbar from "../../components/Navbar.tsx";
import Footer from "../../components/Footer.tsx";
import Loader from "../../components/Loader.tsx";
import { CalendarIcon, SettingsIcon, Plus, ChevronDown, Store } from "lucide-react";
import toast from "react-hot-toast";
import RestaurantWizard from "../../components/owner/RestaurantWizard.tsx";
import PendingApproval from "../../components/owner/PendingApproval.tsx";
import RequestRejected from "../../components/owner/RequestRejected.tsx";
import OwnerBookings from "../../components/owner/OwnerBookings.tsx";
import OwnerProfileDetails from "../../components/owner/OwnerProfileDetails.tsx";
import { useAppContext } from "../../context/AppContext.tsx";
import { bookingApi, restaurantApi } from "../../lib/api.ts";
import type { Booking, BookingStatus, Restaurant } from "../../types.ts";

export default function OwnerDashboard() {
    const { logout } = useAppContext();

    const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
    const [selectedRestaurantId, setSelectedRestaurantId] = useState<string | null>(null);
    const [isCreatingNew, setIsCreatingNew] = useState(false);

    // Bookings are stored with the venue they were loaded for, so switching
    // venues can never show the previous venue's reservations while the new
    // list is still loading.
    const [bookingsState, setBookingsState] = useState<{
        venueId: string | null;
        bookings: Booking[];
    }>({ venueId: null, bookings: [] });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [reloadKey, setReloadKey] = useState(0);
    const [updatingBookingId, setUpdatingBookingId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<"bookings" | "details">("bookings");
    const [switcherOpen, setSwitcherOpen] = useState(false);

    // Initial load of all owned restaurants
    useEffect(() => {
        let active = true;

        restaurantApi
            .mine()
            .then((list) => {
                if (!active) return;
                setRestaurants(list);
                if (list.length > 0) {
                    // Retain current selection if valid; otherwise pick approved or first
                    setSelectedRestaurantId((prev) => {
                        if (prev && list.some((r) => r._id === prev)) return prev;
                        const defaultVenue = list.find((item) => item.status === "approved") ?? list[0];
                        return defaultVenue._id;
                    });
                } else {
                    setSelectedRestaurantId(null);
                }
            })
            .catch((err: unknown) => {
                if (!active) return;
                setError(
                    err instanceof Error ? err.message : "Could not load the owner dashboard.",
                );
            })
            .finally(() => {
                if (active) setLoading(false);
            });

        return () => {
            active = false;
        };
    }, [reloadKey]);

    const currentRestaurant =
        restaurants.find((r) => r._id === selectedRestaurantId) ?? null;

    // Load bookings whenever selected restaurant changes
    useEffect(() => {
        if (!currentRestaurant || currentRestaurant.status !== "approved") {
            return;
        }

        let active = true;

        bookingApi
            .forRestaurant(currentRestaurant._id, { limit: 100 })
            .then((list) => {
                if (active) {
                    setBookingsState({
                        venueId: currentRestaurant._id,
                        bookings: list.bookings,
                    });
                }
            })
            .catch((err: unknown) => {
                if (active) {
                    toast.error(
                        err instanceof Error
                            ? err.message
                            : "Failed to load bookings for this restaurant.",
                    );
                    // Mark the venue as loaded with an empty list so the
                    // spinner stops; the toast explains what happened.
                    setBookingsState({ venueId: currentRestaurant._id, bookings: [] });
                }
            });

        return () => {
            active = false;
        };
    }, [currentRestaurant]);

    const bookingsLoading =
        currentRestaurant?.status === "approved" &&
        bookingsState.venueId !== currentRestaurant._id;

    const activeBookings =
        currentRestaurant &&
        currentRestaurant.status === "approved" &&
        bookingsState.venueId === currentRestaurant._id
            ? bookingsState.bookings
            : [];

    const handleRetry = () => {
        setLoading(true);
        setError(null);
        setReloadKey((key) => key + 1);
    };

    const handleRestaurantCreated = (newRestaurant: Restaurant) => {
        setRestaurants((prev) => [newRestaurant, ...prev]);
        setSelectedRestaurantId(newRestaurant._id);
        setIsCreatingNew(false);
    };

    const handleRestaurantUpdated = (updated: Restaurant) => {
        setRestaurants((prev) =>
            prev.map((r) => (r._id === updated._id ? updated : r)),
        );
    };

    const handleUpdateBookingStatus = async (booking: Booking, nextStatus: BookingStatus) => {
        const action =
            nextStatus === "confirmed"
                ? bookingApi.confirm
                : nextStatus === "completed"
                  ? bookingApi.complete
                  : bookingApi.cancel;

        setUpdatingBookingId(booking._id);

        try {
            await action(booking._id);
            setBookingsState((previous) => {
                if (!currentRestaurant || previous.venueId !== currentRestaurant._id) {
                    return previous;
                }

                return {
                    ...previous,
                    bookings: previous.bookings.map((item) =>
                        item._id === booking._id ? { ...item, status: nextStatus } : item,
                    ),
                };
            });
            toast.success(`Booking ${nextStatus}.`);
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "Could not update the booking.");
        } finally {
            setUpdatingBookingId(null);
        }
    };

    if (loading) {
        return <Loader text="Loading Owner Dashboard..." />;
    }

    if (error) {
        return (
            <div className="min-h-screen bg-surface flex flex-col">
                <Navbar />
                <main className="grow flex items-center justify-center px-6 py-24 text-center">
                    <div className="max-w-md space-y-4">
                        <h1 className="font-display text-2xl md:text-3xl font-medium text-primary">
                            Dashboard unavailable
                        </h1>
                        <p className="text-xs text-black/55 leading-relaxed">{error}</p>
                        <button
                            onClick={handleRetry}
                            className="px-5 py-3 bg-primary text-white text-[10px] font-medium tracking-widest uppercase hover:bg-secondary transition-colors cursor-pointer"
                        >
                            Try Again
                        </button>
                    </div>
                </main>
                <Footer />
            </div>
        );
    }

    const showWizard = isCreatingNew || !currentRestaurant;

    return (
        <div className="min-h-screen bg-surface flex flex-col">
            <Navbar />

            <main className="grow max-w-7xl w-full mx-auto px-6 md:px-10 py-12">
                {/* Heading & Restaurant Switcher */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-outline-variant/10 pb-8 mb-8">
                    <div className="space-y-1">
                        <h1 className="font-display text-2xl md:text-3xl text-primary">Restaurant Portal</h1>
                        <p className="text-xs text-black/55">
                            Manage venue capacity, update menus and menus details, and process live table bookings.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        {/* Multi-Restaurant Switcher */}
                        {restaurants.length > 0 && !showWizard && (
                            <div className="relative">
                                <button
                                    onClick={() => setSwitcherOpen(!switcherOpen)}
                                    className="flex items-center gap-2 bg-white border border-outline-variant/40 hover:border-primary text-xs font-medium px-4 py-2.5 rounded-sm transition-colors cursor-pointer"
                                >
                                    <Store size={14} className="text-secondary" />
                                    <span className="font-medium text-primary max-w-[150px] truncate">
                                        {currentRestaurant?.name}
                                    </span>
                                    <ChevronDown size={14} className="text-black/40" />
                                </button>

                                {switcherOpen && (
                                    <>
                                        <div
                                            className="fixed inset-0 z-40"
                                            onClick={() => setSwitcherOpen(false)}
                                        />
                                        <div className="absolute right-0 mt-2 w-64 bg-white border border-outline-variant/30 ambient-shadow rounded-md py-2 z-50 text-left">
                                            <div className="px-3 py-1.5 border-b border-outline-variant/10 text-[9px] uppercase tracking-wider text-black/45 font-medium">
                                                Your Establishments ({restaurants.length})
                                            </div>
                                            <div className="max-h-60 overflow-y-auto divide-y divide-outline-variant/5">
                                                {restaurants.map((r) => (
                                                    <button
                                                        key={r._id}
                                                        onClick={() => {
                                                            setSelectedRestaurantId(r._id);
                                                            setSwitcherOpen(false);
                                                        }}
                                                        className={`w-full px-3 py-2.5 text-xs text-left flex items-center justify-between hover:bg-surface transition-colors cursor-pointer ${
                                                            r._id === selectedRestaurantId
                                                                ? "bg-secondary-container/20 font-medium text-primary"
                                                                : "text-black/70"
                                                        }`}
                                                    >
                                                        <span className="truncate pr-2">{r.name}</span>
                                                        <span
                                                            className={`text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm shrink-0 ${
                                                                r.status === "approved"
                                                                    ? "bg-green-100 text-green-800"
                                                                    : r.status === "pending"
                                                                      ? "bg-amber-100 text-amber-800"
                                                                      : "bg-error-container text-on-error-container"
                                                            }`}
                                                        >
                                                            {r.status}
                                                        </span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}

                        {/* Add Another Restaurant Button */}
                        {restaurants.length > 0 && !showWizard && (
                            <button
                                onClick={() => setIsCreatingNew(true)}
                                className="flex items-center gap-1.5 bg-primary hover:bg-secondary text-white px-3.5 py-2.5 text-[10px] font-medium tracking-widest uppercase transition-colors rounded-sm cursor-pointer"
                            >
                                <Plus size={12} />
                                Add Venue
                            </button>
                        )}

                        <button
                            onClick={logout}
                            className="bg-error-container hover:bg-error-container/85 text-error px-4 py-2 text-[10px] font-medium tracking-widest uppercase transition-colors rounded-sm cursor-pointer"
                        >
                            Sign Out
                        </button>
                    </div>
                </div>

                {/* Case 1: Restaurant Creation Wizard */}
                {showWizard ? (
                    <RestaurantWizard
                        setRestaurant={handleRestaurantCreated}
                        onCancel={restaurants.length > 0 ? () => setIsCreatingNew(false) : undefined}
                    />
                ) : currentRestaurant.status === "pending" ? (
                    /* Case 2: Selected Venue is Pending Approval */
                    <PendingApproval restaurant={currentRestaurant} />
                ) : currentRestaurant.status === "rejected" ? (
                    /* Case 3: Selected Venue was Rejected */
                    <RequestRejected restaurantName={currentRestaurant.name} />
                ) : (
                    /* Case 4: Approved - Active Dashboard Panel */
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                        {/* Left Tab selector sidebar */}
                        <aside className="lg:col-span-3 space-y-6 bg-white border border-outline-variant/20 p-6 rounded-md shadow-sm h-fit">
                            <div className="flex items-center gap-3.5 border-b border-outline-variant/10 pb-5">
                                <span className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary font-medium text-base">
                                    {currentRestaurant.name.charAt(0)}
                                </span>
                                <div>
                                    <h4 className="font-display font-medium text-primary text-base line-clamp-1">
                                        {currentRestaurant.name}
                                    </h4>
                                    <span className="text-[9px] text-secondary tracking-widest uppercase bg-secondary-container/20 px-2 py-0.5 rounded-sm inline-block mt-0.5">
                                        APPROVED
                                    </span>
                                </div>
                            </div>

                            <nav className="flex flex-col gap-1.5">
                                <button
                                    onClick={() => setActiveTab("bookings")}
                                    className={`w-full flex items-center gap-3 px-4 py-3 text-xs font-medium tracking-wider uppercase text-left rounded-sm cursor-pointer transition-colors ${
                                        activeTab === "bookings" ? "bg-primary text-white" : "text-black/55 hover:bg-surface"
                                    }`}
                                >
                                    <CalendarIcon size={14} />
                                    Bookings ({activeBookings.length})
                                </button>

                                <button
                                    onClick={() => setActiveTab("details")}
                                    className={`w-full flex items-center gap-3 px-4 py-3 text-xs font-medium tracking-wider uppercase text-left rounded-sm cursor-pointer transition-colors ${
                                        activeTab === "details" ? "bg-primary text-white" : "text-black/55 hover:bg-surface"
                                    }`}
                                >
                                    <SettingsIcon size={14} />
                                    Profile Details
                                </button>
                            </nav>
                        </aside>

                        {/* Content Area */}
                        <div className="lg:col-span-9 space-y-8">
                            {/* Tab 1: Bookings List */}
                            {activeTab === "bookings" && (
                                bookingsLoading ? (
                                    <div className="bg-white border border-outline-variant/10 p-12 text-center flex justify-center rounded-md">
                                        <div className="w-6 h-6 border-2 border-outline-variant/30 border-t-secondary rounded-full animate-spin" />
                                    </div>
                                ) : (
                                    <OwnerBookings
                                        bookings={activeBookings}
                                        totalSeats={currentRestaurant.totalSeats}
                                        updatingBookingId={updatingBookingId}
                                        onUpdateStatus={handleUpdateBookingStatus}
                                    />
                                )
                            )}

                            {/* Tab 2: Update details & slots capacity */}
                            {activeTab === "details" && (
                                <OwnerProfileDetails
                                    restaurant={currentRestaurant}
                                    setRestaurant={handleRestaurantUpdated}
                                />
                            )}
                        </div>
                    </div>
                )}
            </main>

            <Footer />
        </div>
    );
}

