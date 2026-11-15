import React, { useState } from "react";
import { Star, X } from "lucide-react";
import toast from "react-hot-toast";
import { reviewApi } from "../../lib/api.ts";
import type { Booking } from "../../types.ts";

interface ReviewModalProps {
    booking: Booking;
    onClose: () => void;
    onSuccess: (bookingId: string) => void;
}

export default function ReviewModal({ booking, onClose, onSuccess }: ReviewModalProps) {
    const [rating, setRating] = useState<number>(5);
    const [hoverRating, setHoverRating] = useState<number | null>(null);
    const [comment, setComment] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const restaurantName =
        typeof booking.restaurant === "object" && booking.restaurant?.name
            ? booking.restaurant.name
            : "Restaurant";

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (submitting) return;

        if (rating < 1 || rating > 5) {
            toast.error("Please choose a rating between 1 and 5 stars.");
            return;
        }

        setSubmitting(true);
        try {
            await reviewApi.create({
                bookingId: booking._id,
                rating,
                comment: comment.trim(),
            });
            toast.success("Thank you for sharing your experience!");
            onSuccess(booking._id);
            onClose();
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "Failed to submit review.");
        } finally {
            setSubmitting(false);
        }
    };

    const activeRating = hoverRating ?? rating;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="absolute inset-0" onClick={onClose} />

            <div className="relative w-full max-w-md bg-white border border-outline-variant/30 ambient-shadow rounded-lg p-6 sm:p-8 z-10 text-left">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-black/45 hover:text-primary transition-colors cursor-pointer"
                    aria-label="Close"
                >
                    <X size={18} />
                </button>

                <div className="space-y-1 pb-4 border-b border-outline-variant/10">
                    <span className="text-[10px] text-secondary font-medium tracking-widest uppercase">
                        Verified Dining Review
                    </span>
                    <h3 className="font-display text-xl font-medium text-primary line-clamp-1">
                        {restaurantName}
                    </h3>
                    <p className="text-xs text-black/55">
                        Booking reference: <span className="font-medium text-primary">{booking.bookingId}</span>
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="mt-6 space-y-6">
                    {/* Star selector */}
                    <div className="space-y-2 text-center sm:text-left">
                        <label className="block text-[10px] font-medium text-black/55 tracking-wider uppercase">
                            Your Rating
                        </label>
                        <div className="flex items-center gap-1.5 justify-center sm:justify-start">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                    key={star}
                                    type="button"
                                    onClick={() => setRating(star)}
                                    onMouseEnter={() => setHoverRating(star)}
                                    onMouseLeave={() => setHoverRating(null)}
                                    className="p-1 cursor-pointer transition-transform hover:scale-110 focus:outline-none"
                                    aria-label={`${star} star`}
                                >
                                    <Star
                                        size={26}
                                        fill={star <= activeRating ? "#D4AF37" : "none"}
                                        className={
                                            star <= activeRating
                                                ? "text-[#D4AF37]"
                                                : "text-outline-variant/60"
                                        }
                                    />
                                </button>
                            ))}
                            <span className="text-xs text-black/55 font-medium ml-2">
                                {activeRating} / 5
                            </span>
                        </div>
                    </div>

                    {/* Comment Area */}
                    <div className="space-y-1.5">
                        <div className="flex justify-between items-center text-[10px] text-black/55 tracking-wider uppercase font-medium">
                            <label htmlFor="review-comment">Your Experience</label>
                            <span>{comment.length}/1000</span>
                        </div>
                        <textarea
                            id="review-comment"
                            rows={4}
                            maxLength={1000}
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            placeholder="Tell others about the food, ambiance, service, and standout dishes..."
                            className="w-full bg-surface-container-low/30 border border-outline-variant/40 p-3 text-xs focus:border-secondary focus:outline-none rounded-sm resize-none"
                        />
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={submitting}
                            className="px-4 py-2.5 text-xs text-black/55 hover:text-primary transition-colors cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="bg-primary hover:bg-secondary text-white text-[10px] font-medium tracking-widest uppercase px-6 py-2.5 rounded-sm transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-wait"
                        >
                            {submitting ? "Submitting..." : "Submit Review"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
