// Formats a Date as YYYY-MM-DD in the user's local timezone, which is the
// format <input type="date"> expects. Avoids toISOString(), which shifts to UTC
// and can be off by a day.
export const toDateInputValue = (date: Date): string => {
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
    return local.toISOString().slice(0, 10);
};

export const todayInputValue = (): string => toDateInputValue(new Date());
