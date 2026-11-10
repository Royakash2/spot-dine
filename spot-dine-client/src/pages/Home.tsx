import { useState, useEffect } from "react";
import Navbar from "../components/Navbar.tsx";
import Footer from "../components/Footer.tsx";
import AuthModal from "../components/AuthModal.tsx";
import Hero from "../components/home/Hero.tsx";
import CuisineBrowse from "../components/home/CuisineBrowse.tsx";
import TrendingRow from "../components/home/TrendingRow.tsx";
import TestimonialsSection from "../components/home/TestimonialsSection.tsx";
import MembershipSection from "../components/home/MembershipSection.tsx";
import NewsletterCTA from "../components/home/NewsletterCTA.tsx";
import { restaurantApi } from "../lib/api.ts";
import type { Restaurant } from "../types.ts";

export default function Home() {
    const [trending, setTrending] = useState<Restaurant[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        const fetchTrending = async () => {
            try {
                // "Trending" is the top-rated approved restaurants
                const data = await restaurantApi.list({ sort: "rating", limit: 6 });
                if (!cancelled) setTrending(data.restaurants);
            } catch (err) {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : "Could not load restaurants");
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        fetchTrending();
        return () => {
            cancelled = true;
        };
    }, []);

    return (
        <div className="min-h-screen bg-surface flex flex-col pt-0">
            <Navbar />
            <AuthModal />
            <main className="flex-1">
                <Hero />
                <div className="pt-4 md:pt-16">
                    <CuisineBrowse />
                </div>
                <TrendingRow trending={trending} loading={loading} error={error} />
                <TestimonialsSection />
                <MembershipSection />
                <NewsletterCTA />
            </main>
            <Footer />
        </div>
    );
}
