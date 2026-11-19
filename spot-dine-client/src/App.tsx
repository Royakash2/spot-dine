import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute.tsx";
import Loader from "./components/Loader.tsx";
import AuthModal from "./components/AuthModal.tsx";
import { Toaster } from "react-hot-toast";

const Home = lazy(() => import("./pages/Home.tsx"));
const Search = lazy(() => import("./pages/Search.tsx"));
const RestaurantDetail = lazy(() => import("./pages/RestaurantDetail.tsx"));
const BookingConfirmation = lazy(() => import("./pages/BookingConfirmation.tsx"));
const Dashboard = lazy(() => import("./pages/Dashboard.tsx"));
const OwnerDashboard = lazy(() => import("./pages/owner/OwnerDashboard.tsx"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));

export default function App() {
    return (
        <>
            <Toaster 
                position="bottom-right"
                toastOptions={{
                    style: {
                        background: "#1a1c1c",
                        color: "#ffffff",
                        fontFamily: "Manrope, sans-serif",
                        fontSize: "12px",
                        letterSpacing: "0.02em",
                        borderRadius: "4px",
                        border: "1px solid rgba(255, 255, 255, 0.08)",
                    },
                }}
            />
            {/* Mounted once for the whole app so any page (including 404) can
                open the sign-in dialog. */}
            <AuthModal />
            <Suspense fallback={<Loader />}>
                <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/search" element={<Search />} />
                    <Route path="/restaurant/:slug" element={<RestaurantDetail />} />
                    <Route 
                        path="/booking/:slug" 
                        element={
                            <ProtectedRoute>
                                <BookingConfirmation />
                            </ProtectedRoute>
                        } 
                    />
                    <Route 
                        path="/dashboard" 
                        element={
                            <ProtectedRoute>
                                <Dashboard />
                            </ProtectedRoute>
                        } 
                    />
                    <Route 
                        path="/owner/dashboard" 
                        element={
                            <ProtectedRoute allowedRoles={["owner"]}>
                                <OwnerDashboard />
                            </ProtectedRoute>
                        } 
                    />
                    <Route 
                        path="/admin/dashboard" 
                        element={
                            <ProtectedRoute allowedRoles={["admin"]}>
                                <AdminDashboard />
                            </ProtectedRoute>
                        } 
                    />
                    <Route path="*" element={<NotFound />} />
                </Routes>
            </Suspense>
        </>
    );
}

