import { useEffect, useState } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import toast from "react-hot-toast";
import { useAppContext } from "../context/AppContext.tsx";
import Navbar from "../components/Navbar.tsx";
import Footer from "../components/Footer.tsx";
import Loader from "../components/Loader.tsx";
import BookingSuccess from "../components/booking/BookingSuccess.tsx";
import BookingSummary from "../components/booking/BookingSummary.tsx";
import BookingForm from "../components/booking/BookingForm.tsx";
import { bookingApi, restaurantApi } from "../lib/api.ts";
import type { Booking, Restaurant } from "../types.ts";

// Tagged with the slug it was fetched for, so "loading" can be derived while a
// different restaurant is being loaded instead of resetting state in an effect.
interface RestaurantResult {
    slug: string;
    restaurant: Restaurant | null;
    error: string | null;
}

export default function BookingConfirmation() {
    const { slug } = useParams<{ slug: string }>();
    const [searchParams] = useSearchParams();
    const { user } = useAppContext();

    const [result, setResult] = useState<RestaurantResult | null>(null);
    const [reloadKey, setReloadKey] = useState(0);
    const [confirming, setConfirming] = useState(false);
    const [confirmedBooking, setConfirmedBooking] = useState<Booking | null>(null);

    // Guest details, prefilled from the signed-in account. The user is already
    // loaded by ProtectedRoute, so the form can start from it directly.
    const [name, setName] = useState(user?.name ?? "");
    const [email, setEmail] = useState(user?.email ?? "");
    const [phone, setPhone] = useState(user?.phone ?? "");
    const [occasion, setOccasion] = useState("");
    const [specialRequests, setSpecialRequests] = useState("");

    // Reservation details chosen on the restaurant page
    const slot = searchParams.get("slot") ?? "";
    const date = searchParams.get("date") ?? "";
    const guests = searchParams.get("guests") ?? "2";

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

    const handleRetry = () => {
        setResult(null);
        setReloadKey((key) => key + 1);
    };

    const handleConfirmSubmit = async (event: React.FormEvent) => {
        event.preventDefault();

        if (!restaurant) return;

        if (!slot || !date) {
            toast.error("Reservation details are missing. Return to the restaurant page.");
            return;
        }

        const partySize = Number(guests);
        if (!Number.isInteger(partySize) || partySize < 1) {
            toast.error("Please choose a valid party size.");
            return;
        }

        setConfirming(true);

        try {
            const { booking } = await bookingApi.create({
                restaurantId: restaurant._id,
                date,
                timeSlot: slot,
                guests: partySize,
                name: name.trim(),
                email: email.trim(),
                phone: phone.trim(),
                occasion,
                specialRequests: specialRequests.trim(),
            });

            setConfirmedBooking(booking);
            toast.success("Booking requested!");
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "Could not create the booking.");
        } finally {
            setConfirming(false);
        }
    };

    if (loading) {
        return <Loader text="Retrieving Dining Details..." />;
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
                            Reservation unavailable
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

    if (confirmedBooking) {
        return (
            <div className="min-h-screen bg-surface flex flex-col pt-20">
                <Navbar />
                <main className="grow flex items-center justify-center py-12 px-6">
                    <BookingSuccess booking={confirmedBooking} restaurant={restaurant} />
                </main>
                <Footer />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-surface flex flex-col">
            <Navbar />

            {/* Main Booking Content */}
            <main className="grow max-w-7xl w-full mx-auto px-6 md:px-10 py-12">
                {/* Progress bar header */}
                <div className="flex items-center gap-2 mb-10 pb-4 border-b border-outline-variant/10 text-xs text-black/55">
                    <Link
                        to={`/restaurant/${restaurant.slug}`}
                        className="hover:text-primary transition-colors"
                    >
                        {restaurant.name}
                    </Link>
                    <ChevronRight size={14} />
                    <span className="text-primary">Details & Confirmation</span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
                    {/* Left Column (Reservation Summary) */}
                    <div className="lg:col-span-5">
                        <BookingSummary
                            restaurant={restaurant}
                            date={date}
                            slot={slot}
                            guests={guests}
                        />
                    </div>

                    {/* Right Column (Guest Details Form) */}
                    <div className="lg:col-span-7">
                        <BookingForm
                            name={name}
                            setName={setName}
                            email={email}
                            setEmail={setEmail}
                            phone={phone}
                            setPhone={setPhone}
                            occasion={occasion}
                            setOccasion={setOccasion}
                            specialRequests={specialRequests}
                            setSpecialRequests={setSpecialRequests}
                            confirming={confirming}
                            onSubmit={handleConfirmSubmit}
                        />
                    </div>
                </div>
            </main>

            <Footer />
        </div>
    );
}
