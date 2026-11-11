import { MapPin, Clock, Utensils, ChefHat } from "lucide-react";
import type { Restaurant } from "../../types.ts";

interface RestaurantInfoProps {
    restaurant: Restaurant;
}

const formatTime = (time: string): string => {
    const [hours, minutes] = time.split(":").map(Number);

    if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return time;

    const period = hours >= 12 ? "PM" : "AM";
    const hour = hours % 12 === 0 ? 12 : hours % 12;
    return `${hour}:${String(minutes).padStart(2, "0")} ${period}`;
};

export default function RestaurantInfo({ restaurant }: RestaurantInfoProps) {
    if (!restaurant) return null;

    const { availableSlots } = restaurant;
    const openingHours =
        availableSlots.length > 0
            ? `${formatTime(availableSlots[0])} - ${formatTime(availableSlots[availableSlots.length - 1])}`
            : "Not published";

    return (
        <div className="space-y-12 text-left">
            {/* Info Ribbon */}
            <div className="grid grid-cols-3 gap-4 py-6 border-y border-outline-variant/10">
                <div className="text-center border-r border-outline-variant/10 px-2">
                    <ChefHat className="text-secondary mx-auto mb-2" size={20} />
                    <span className="block text-[9px] tracking-wider text-black/55 uppercase">CHEF</span>
                    <span className="text-xs text-primary mt-1 block">{restaurant.chef}</span>
                </div>
                <div className="text-center border-r border-outline-variant/10 px-2">
                    <Utensils className="text-secondary mx-auto mb-2" size={20} />
                    <span className="block text-[9px] tracking-wider text-black/55 uppercase">CUISINE</span>
                    <span className="text-xs text-primary mt-1 block">{restaurant.cuisine}</span>
                </div>
                <div className="text-center px-2">
                    <Clock className="text-secondary mx-auto mb-2" size={20} />
                    <span className="block text-[9px] tracking-wider text-black/55 uppercase">OPENING</span>
                    <span className="text-xs text-primary mt-1 block">{openingHours}</span>
                </div>
            </div>

            {/* About Section */}
            <section className="space-y-4">
                <h3 className="font-display text-xl font-semibold text-primary">About the Dining Room</h3>
                <p className="text-sm text-black/55 leading-relaxed">{restaurant.description}</p>
                <div className="flex items-start gap-2 text-sm text-black/55 pt-2">
                    <MapPin size={16} className="text-secondary shrink-0 mt-0.5" />
                    <span>{restaurant.address}</span>
                </div>
            </section>
        </div>
    );
}
