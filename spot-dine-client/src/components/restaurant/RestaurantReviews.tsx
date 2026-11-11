import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import toast from "react-hot-toast";
import { reviewApi } from "../../lib/api.ts";
import type { Review } from "../../types.ts";

const PAGE_SIZE = 5;

// Tagged with the restaurant slug so the UI can derive "loading" while a new
// restaurant's reviews are in flight, without resetting state in an effect.
type ReviewsState =
    | { status: "loading" }
    | { status: "error"; slug: string; message: string }
    | {
          status: "ready";
          slug: string;
          reviews: Review[];
          reviewCount: number;
          hasNextPage: boolean;
          page: number;
      };

const reviewerName = (review: Review): string =>
    typeof review.user === "string" ? "Guest" : review.user.name || "Guest";

const formatVisitDate = (value: string): string => {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
        ? ""
        : date.toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
          });
};

interface RestaurantReviewsProps {
    restaurantSlug: string;
}

export default function RestaurantReviews({ restaurantSlug }: RestaurantReviewsProps) {
    const [state, setState] = useState<ReviewsState>({ status: "loading" });
    const [reloadKey, setReloadKey] = useState(0);
    const [loadingMore, setLoadingMore] = useState(false);

    useEffect(() => {
        let active = true;

        reviewApi
            .list(restaurantSlug, { page: 1, limit: PAGE_SIZE })
            .then((data) => {
                if (!active) return;
                setState({
                    status: "ready",
                    slug: restaurantSlug,
                    reviews: data.reviews,
                    reviewCount: data.reviewCount,
                    hasNextPage: data.hasNextPage,
                    page: 1,
                });
            })
            .catch((err: unknown) => {
                if (!active) return;
                setState({
                    status: "error",
                    slug: restaurantSlug,
                    message: err instanceof Error ? err.message : "Could not load reviews.",
                });
            });

        return () => {
            active = false;
        };
    }, [restaurantSlug, reloadKey]);

    const isStale = state.status !== "loading" && state.slug !== restaurantSlug;
    const loading = state.status === "loading" || isStale;
    const ready =
        state.status === "ready" && state.slug === restaurantSlug ? state : null;
    const error =
        state.status === "error" && state.slug === restaurantSlug ? state.message : null;

    const handleRetry = () => {
        setState({ status: "loading" });
        setReloadKey((key) => key + 1);
    };

    const loadMore = async () => {
        if (!ready || loadingMore) return;

        const requestedSlug = ready.slug;
        setLoadingMore(true);

        try {
            const data = await reviewApi.list(requestedSlug, {
                page: ready.page + 1,
                limit: PAGE_SIZE,
            });

            setState((previous) =>
                previous.status === "ready" && previous.slug === requestedSlug
                    ? {
                          ...previous,
                          reviews: [...previous.reviews, ...data.reviews],
                          page: previous.page + 1,
                          hasNextPage: data.hasNextPage,
                      }
                    : previous,
            );
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "Could not load more reviews.");
        } finally {
            setLoadingMore(false);
        }
    };

    return (
        <section className="space-y-8 pt-6 border-t border-outline-variant/10 text-left">
            <h3 className="font-display text-xl font-semibold text-primary">
                Guest Experiences
                {ready && ready.reviewCount > 0 && (
                    <span className="text-sm text-black/45 font-normal"> ({ready.reviewCount})</span>
                )}
            </h3>

            {loading ? (
                <div className="space-y-6" aria-label="Loading reviews">
                    {[0, 1].map((row) => (
                        <div
                            key={row}
                            className="space-y-2 pb-6 border-b border-outline-variant/10 last:border-b-0"
                        >
                            <div className="h-3 w-32 bg-black/5 rounded animate-pulse" />
                            <div className="h-3 w-full max-w-lg bg-black/5 rounded animate-pulse" />
                        </div>
                    ))}
                </div>
            ) : error ? (
                <div className="space-y-3">
                    <p className="text-xs text-black/55 italic">{error}</p>
                    <button
                        onClick={handleRetry}
                        className="text-[10px] font-medium tracking-widest uppercase text-secondary hover:underline cursor-pointer"
                    >
                        Try Again
                    </button>
                </div>
            ) : !ready || ready.reviews.length === 0 ? (
                <p className="text-xs text-black/55/80 italic">
                    No reviews yet. Be the first to share your experience!
                </p>
            ) : (
                <>
                    <div className="space-y-6">
                        {ready.reviews.map((review) => {
                            const visited = formatVisitDate(review.visitedDate);

                            return (
                                <div
                                    key={review._id}
                                    className="pb-6 border-b border-outline-variant/10 last:border-b-0 space-y-2"
                                >
                                    <div className="flex items-center justify-between gap-4">
                                        <div>
                                            <h4 className="text-sm font-medium text-primary">
                                                {reviewerName(review)}
                                            </h4>
                                            {visited && (
                                                <span className="text-xs text-black/55">
                                                    Visited {visited}
                                                </span>
                                            )}
                                        </div>
                                        <div
                                            className="flex items-center gap-0.5 text-secondary shrink-0"
                                            aria-label={`${review.rating} out of 5 stars`}
                                        >
                                            {[1, 2, 3, 4, 5].map((star) => (
                                                <Star
                                                    key={star}
                                                    size={12}
                                                    fill={star <= review.rating ? "currentColor" : "none"}
                                                    className={star <= review.rating ? "" : "text-outline-variant"}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                    {review.comment && (
                                        <p className="text-xs text-black/55 max-w-lg leading-relaxed">
                                            {review.comment}
                                        </p>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {ready.hasNextPage && (
                        <button
                            onClick={loadMore}
                            disabled={loadingMore}
                            className="text-[10px] font-medium tracking-widest uppercase text-secondary hover:underline cursor-pointer disabled:opacity-50 disabled:cursor-wait"
                        >
                            {loadingMore ? "Loading..." : "Load More Reviews"}
                        </button>
                    )}
                </>
            )}
        </section>
    );
}
