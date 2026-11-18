import { Link } from "react-router-dom";
import Navbar from "../components/Navbar.tsx";
import Footer from "../components/Footer.tsx";
import { Compass, Home as HomeIcon } from "lucide-react";

export default function NotFound() {
    return (
        <div className="min-h-screen bg-surface flex flex-col">
            <Navbar />

            <main className="grow flex items-center justify-center px-6 py-24 text-center">
                <div className="max-w-md space-y-6">
                    <span className="text-[10px] tracking-[0.25em] text-secondary uppercase block font-medium">
                        ERROR 404
                    </span>

                    <h1 className="font-display text-4xl md:text-5xl font-medium text-primary tracking-tight">
                        Table Not Found
                    </h1>

                    <p className="text-xs text-black/55 leading-relaxed">
                        The culinary destination you are searching for does not exist or may have been relocated.
                    </p>

                    <div className="flex flex-wrap justify-center gap-3 pt-4">
                        <Link
                            to="/"
                            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white text-[10px] font-medium tracking-widest uppercase hover:bg-secondary transition-colors cursor-pointer"
                        >
                            <HomeIcon size={14} />
                            Return Home
                        </Link>
                        <Link
                            to="/search"
                            className="inline-flex items-center gap-2 px-6 py-3 border border-outline-variant/40 text-[10px] font-medium tracking-widest uppercase hover:border-primary text-primary transition-colors cursor-pointer"
                        >
                            <Compass size={14} />
                            Browse Venues
                        </Link>
                    </div>
                </div>
            </main>

            <Footer />
        </div>
    );
}
