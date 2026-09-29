import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay } from 'swiper/modules';
import { Quote } from 'lucide-react';
import { dummyReviews } from '../../assets/assets';

// Import Swiper styles
import 'swiper/css';

const allReviews = [
    ...dummyReviews,
    {
        _id: "dummy-rev-4",
        userName: "James Thornton",
        rating: 5,
        comment: "The most seamless reservation experience I have ever had. Within seconds I had a table at my favourite spot.",
        visitedDate: "2026-07-01T12:00:00.000Z",
        createdAt: "2026-07-01T12:00:00.000Z",
    },
    {
        _id: "dummy-rev-5",
        userName: "Isabelle Fontaine",
        rating: 4,
        comment: "Discovering hidden gems around the city has never been easier. The curation on this platform is simply outstanding.",
        visitedDate: "2026-07-03T12:00:00.000Z",
        createdAt: "2026-07-03T12:00:00.000Z",
    },
];

export default function TestimonialsSection() {
    return (
        <section className="py-24 bg-surface-container-low/50 overflow-hidden">
            <div className="max-w-7xl mx-auto px-6 md:px-10">
                {/* Section Heading — matches all other sections */}
                <div className="flex justify-between items-end mb-12">
                    <div>
                        <span className="text-[10px] text-secondary tracking-[0.2em] block mb-2 uppercase">
                            VOICES OF THE PALATE
                        </span>
                        <h2 className="font-display text-2xl md:text-3xl font-semibold text-primary">
                            What Our Diners Say
                        </h2>
                    </div>
                </div>

                {/* Multi-Card Swiper */}
                <Swiper
                    modules={[Autoplay]}
                    spaceBetween={24}
                    slidesPerView={1}
                    autoplay={{ delay: 4000, disableOnInteraction: false }}
                    loop={true}
                    breakpoints={{
                        768: { slidesPerView: 2 },
                        1024: { slidesPerView: 3 },
                    }}
                >
                    {allReviews.map((review) => (
                        <SwiperSlide key={review._id}>
                            <div className="bg-white border border-outline-variant/20 p-8 flex flex-col gap-5 h-full min-h-[260px]">
                                {/* Top row: quote icon + stars */}
                                <div className="flex items-center justify-between">
                                    <Quote className="text-secondary/30" size={28} />
                                    <div className="flex gap-0.5">
                                        {[...Array(review.rating)].map((_, i) => (
                                            <span key={i} className="text-secondary text-sm">★</span>
                                        ))}
                                    </div>
                                </div>

                                {/* Comment */}
                                <p className="text-sm text-black/70 leading-relaxed flex-1">
                                    "{review.comment}"
                                </p>

                                {/* Diner info */}
                                <div className="border-t border-outline-variant/15 pt-4 flex items-center gap-3">
                                    <span className="w-8 h-8 rounded-full bg-secondary/10 flex items-center justify-center text-secondary text-xs font-semibold uppercase shrink-0">
                                        {review.userName.charAt(0)}
                                    </span>
                                    <div>
                                        <p className="text-xs font-medium text-primary uppercase tracking-wide">
                                            {review.userName}
                                        </p>
                                        <p className="text-[10px] text-black/55 tracking-[0.15em] uppercase mt-0.5">
                                            Verified Diner
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </SwiperSlide>
                    ))}
                </Swiper>
            </div>
        </section>
    );
}

