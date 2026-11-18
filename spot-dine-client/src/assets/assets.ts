import hero_bg_img from "./hero_bg_img.jpg";
import default_restaurant_img from "./default_restaurant_img.jpg";
import membership_section_img from "./membership_section_img.jpg";
import hero_bg_two from "./hero_bg_two.jpg";
import {
    BeefIcon,
    Building2Icon,
    CroissantIcon,
    FishIcon,
    GlobeIcon,
    LeafIcon,
    MailIcon,
    Share2Icon,
    UtensilsCrossedIcon,
} from "lucide-react";

export const assets = {
    hero_bg_two,
    hero_bg_img,
    default_restaurant_img,
    membership_section_img,
};

export const dummyReviews = [
    {
        _id: "dummy-rev-1",
        userName: "Emily Watson",
        rating: 5,
        comment: "Absolutely phenomenal experience! The ambiance was perfect, and the food was cooked to perfection. A must-visit!",
        visitedDate: "2026-06-10T12:00:00.000Z",
        createdAt: "2026-06-10T12:00:00.000Z",
    },
    {
        _id: "dummy-rev-2",
        userName: "Marcus Vance",
        rating: 4,
        comment:
            "The signature dishes were incredible and the staff was extremely attentive. Will definitely come back for another dinner.",
        visitedDate: "2026-06-08T18:30:00.000Z",
        createdAt: "2026-06-08T18:30:00.000Z",
    },
    {
        _id: "dummy-rev-3",
        userName: "Sophia Loren",
        rating: 5,
        comment: "Every course of the tasting menu was a delightful surprise. The pairings were exquisite. High-end dining at its finest.",
        visitedDate: "2026-06-05T20:15:00.000Z",
        createdAt: "2026-06-05T20:15:00.000Z",
    },
];

export const footerSections = [
    {
        title: "COMPANY",
        links: [
            { label: "About Us", path: "#" },
            { label: "Partner with Us", path: "#" },
            { label: "Careers", path: "#" },
        ],
    },
    {
        title: "LEGAL",
        links: [
            { label: "Terms of Service", path: "#" },
            { label: "Privacy Policy", path: "#" },
            { label: "Cookies", path: "#" },
        ],
    },
];

export const socialLinks = [
    { icon: GlobeIcon, href: "#" },
    { icon: Share2Icon, href: "#" },
    { icon: MailIcon, href: "#" },
];

export const bottomLinks = [
    { label: "Terms", path: "#" },
    { label: "Privacy", path: "#" },
];

export const cuisines = [
    { name: "Italian", icon: UtensilsCrossedIcon, label: "ITALIAN" },
    { name: "Japanese", icon: FishIcon, label: "SUSHI" },
    { name: "French", icon: CroissantIcon, label: "FRENCH" },
    { name: "Rooftop", icon: Building2Icon, label: "ROOFTOP" },
    { name: "Steakhouse", icon: BeefIcon, label: "STEAKHOUSE" },
    { name: "Vegetarian", icon: LeafIcon, label: "VEGETARIAN" },
];

