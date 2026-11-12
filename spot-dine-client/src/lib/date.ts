// Formats a Date as YYYY-MM-DD in the user's local timezone, which is the
// format <input type="date"> expects. Avoids toISOString(), which shifts to UTC
// and can be off by a day.
export const toDateInputValue = (date: Date): string => {
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
    return local.toISOString().slice(0, 10);
};

export const todayInputValue = (): string => toDateInputValue(new Date());

// Booking and review dates are calendar days stored at UTC midnight, so they
// must be formatted in UTC — local formatting would show the previous day for
// anyone west of Greenwich.
export const formatCalendarDate = (
    value: string,
    options: Intl.DateTimeFormatOptions = {},
): string => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString(undefined, { ...options, timeZone: "UTC" });
};

// Slots are stored as 24h "HH:MM" strings (the server validates that shape),
// e.g. "18:30" becomes "6:30 PM".
export const formatTimeSlot = (slot: string): string => {
    const match = /^(\d{1,2}):(\d{2})$/.exec(slot);
    if (!match) return slot;

    const hours = Number(match[1]);
    const suffix = hours >= 12 ? "PM" : "AM";
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${match[2]} ${suffix}`;
};
