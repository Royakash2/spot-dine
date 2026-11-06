// Small input-normalisation helpers shared by the controllers.

const REGEX_SPECIAL_CHARACTERS = /[.*+?^${}()|[\]\\]/g;

// User input is interpolated into MongoDB $regex queries, so metacharacters
// must be escaped or a search like "a+)" becomes a ReDoS / injection vector.
export const escapeRegex = (value: string): string =>
  value.replace(REGEX_SPECIAL_CHARACTERS, "\\$&");

export const cleanString = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";

// Express gives query params as string | string[] | ParsedQs | undefined.
// Controllers only care about the first plain string.
export const firstString = (value: unknown): string | undefined => {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    const first: unknown = value[0];
    if (typeof first === "string") return first;
  }
  return undefined;
};

export const firstStringArray = (value: unknown): string[] => {
  if (typeof value === "string") return [value];
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
};

// Multer delivers every text field as a string, while JSON clients can send a
// real array. Normalise both forms into a clean string[].
export const toStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
};

// "24" -> 24, "" -> null, "abc" -> null, 0 -> null
export const toPositiveInt = (value: unknown): number | null => {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : null;
};

// "My Restaurant" -> "my-restaurant"
export const slugify = (value: string): string =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
