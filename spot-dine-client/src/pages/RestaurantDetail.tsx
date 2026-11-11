import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import Navbar from "../components/Navbar.tsx";
import Footer from "../components/Footer.tsx";
import AuthModal from "../components/AuthModal.tsx";
import Loader from "../components/Loader.tsx";
import RestaurantHero from "../components/restaurant/RestaurantHero.tsx";
import RestaurantInfo from "../components/restaurant/RestaurantInfo.tsx";
import RestaurantReviews from "../components/restaurant/RestaurantReviews.tsx";
import BookingWidget from "../components/restaurant/BookingWidget.tsx";
import { useAppContext } from "../context/AppContext.tsx";
import { restaurantApi } from "../lib/api.ts";
import { todayInputValue } from "../lib/date.ts";
import type { Restaurant, SlotAvailability } from "../types.ts";

// The fetched restaurant, tagged with the slug it belongs to. Keeping the slug
// lets us derive "loading" during a route change instead of resetting state
// inside an effect, which would trigger a second render pass.
interface RestaurantResult {
    slug: string;
    restaurant: Restaurant | null;
    error: string | null;
}

interface AvailabilityResult {
    key: string;
    slots: SlotAvailability[];
}

export default function RestaurantDetail() {
    const { slug } = useParams<{ slug: string }>();
    const { isAuthenticated, setAuthModalOpen } = useAppContext();
    const navigate = useNavigate();

    const [result, setResult] = useState<RestaurantResult | null>(null);
    const [reloadKey, setReloadKey] = useState(0);

    // Reservation widget
    const [selectedDate, setSelectedDate] = useState(todayInputValue);
    const [selectedGuests, setSelectedGuests] = useState("2");
    const [selectedSlot, setSelectedSlot] = useState("");
    const [availability, setAvailability] = useState<AvailabilityResult | null>(null);

    const restaurant = result && result.slug === slug ? result.restaurant : null;
    const loading = Boolean(slug) && result?.slug !== slug;

    useEffect(() => {
        if (!slug) return;

        let active = true;

        restaurantApi
            .getBySlug(slug)
            .then((data) => {
                if (active) setResult({ slug, restaurant: data, error: null });
            })
            .catch((err: unknown) => {
                if (!active) return;
                setResult({
                    slug,
                    restaurant: null,
                    error:
                        err instanceof Error
                            ? err.message
                            : "This restaurant could not be loaded.",
                });
            });

        return () => {
            active = false;
        };
    }, [slug, reloadKey]);

    // Live seats for this restaurant, date and party size. The key makes it
    // possible to derive whether the current request has finished.
    const restaurantId = restaurant?._id ?? null;
    const availabilityKey = restaurantId ? `${restaurantId}|${selectedDate}|${selectedGuests}` : null;
    const loadingSlots = Boolean(availabilityKey) && availability?.key !== availabilityKey;
    const slots = availability && availability.key === availabilityKey ? availability.slots : [];

    useEffect(() => {
        if (!restaurantId) return;

        const key = `${restaurantId}|${selectedDate}|${selectedGuests}`;
        let active = true;

        restaurantApi
            .availability(restaurantId, {
                date: selectedDate,
                guests: Number(selectedGuests) || 1,
            })
            .then((data) => {
                if (active) setAvailability({ key, slots: data.slots });
            })
            .catch(() => {
                // Empty list makes BookingWidget fall back to the restaurant's
                // regular slots instead of showing an empty time grid.
                if (active) setAvailability({ key, slots: [] });
            });

        return () => {
            active = false;
        };
    }, [restaurantId, selectedDate, selectedGuests]);

    // A chosen time is tied to a date and party size, so changing either
    // clears it. Done in the event handlers, where state updates belong.
    const handleDateChange = (date: string) => {
        setSelectedDate(date);
        setSelectedSlot("");
    };

    const handleGuestsChange = (guests: string) => {
        setSelectedGuests(guests);
        setSelectedSlot("");
    };

    const handleRetry = () => {
        setResult(null);
        setReloadKey((key) => key + 1);
    };

    if (loading) {
        return <Loader text="Loading Restaurant Details..." />;
    }

    if (!restaurant) {
        const message =
            result?.error ??
            (slug
                ? "This restaurant could not be loaded."
                : "This restaurant could not be found.");

        return (
            <div className="min-h-screen bg-surface flex flex-col">
                <Navbar />
                <main className="grow flex items-center justify-center px-6 py-24 text-center">
                    <div className="max-w-md space-y-4">
                        <h1 className="font-display text-2xl md:text-3xl font-medium text-primary">
                            Restaurant unavailable
                        </h1>
                        <p className="text-xs text-black/55 leading-relaxed">{message}</p>
                        <div className="flex flex-wrap justify-center gap-3 pt-2">
                            <button
                                onClick={handleRetry}
                                className="px-5 py-3 bg-primary text-white text-[10px] font-medium tracking-widest uppercase hover:bg-secondary transition-colors cursor-pointer"
                            >
                                Try Again
                            </button>
                            <Link
                                to="/search"
                                className="px-5 py-3 border border-outline-variant/40 text-[10px] font-medium tracking-widest uppercase hover:border-primary transition-colors"
                            >
                                Browse Restaurants
                            </Link>
                        </div>
                    </div>
                </main>
                <Footer />
            </div>
        );
    }

    const handleReserveClick = () => {
        if (!selectedSlot) {
            toast.error("Please select a dining time slot.");
            return;
        }

        if (!isAuthenticated) {
            setAuthModalOpen(true);
            return;
        }

        navigate(
            `/booking/${restaurant.slug}?slot=${encodeURIComponent(selectedSlot)}&date=${selectedDate}&guests=${selectedGuests}`,
        );
    };

    return (
        <div className="min-h-screen bg-surface flex flex-col">
            <Navbar />
            <AuthModal />

            <RestaurantHero restaurant={restaurant} />

            <main className="grow max-w-7xl w-full mx-auto px-6 md:px-10 py-12">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
                    <div className="lg:col-span-8 space-y-12">
                        <RestaurantInfo restaurant={restaurant} />
                        <RestaurantReviews
                            key={restaurant.slug}
                            restaurantSlug={restaurant.slug}
                        />
                    </div>

                    <div className="lg:col-span-4 lg:sticky lg:top-36">
                        <BookingWidget
                            restaurant={restaurant}
                            selectedDate={selectedDate}
                            setSelectedDate={handleDateChange}
                            selectedGuests={selectedGuests}
                            setSelectedGuests={handleGuestsChange}
                            selectedSlot={selectedSlot}
                            setSelectedSlot={setSelectedSlot}
                            slotsAvailability={slots}
                            loadingSlots={loadingSlots}
                            isAuthenticated={isAuthenticated}
                            handleReserveClick={handleReserveClick}
                        />
                    </div>
                </div>
            </main>

            <Footer />
        </div>
    );
}
