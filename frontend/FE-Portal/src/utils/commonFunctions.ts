type DateInput = string | number | Date | null | undefined;

const DEFAULT_DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "short",
  day: "numeric",
};

const DEFAULT_DATE_TIME_OPTIONS: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
};

const parseDateInput = (value: DateInput, unixSeconds = false): Date | null => {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const parsed = typeof value === "number" && unixSeconds ? new Date(value * 1000) : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const formatDateValue = (
  value: DateInput,
  options: Intl.DateTimeFormatOptions = DEFAULT_DATE_OPTIONS,
  fallback = "N/A",
  locale = "en-US",
  unixSeconds = false
): string => {
  const date = parseDateInput(value, unixSeconds);
  if (!date) return fallback;
  return date.toLocaleDateString(locale, options);
};

export const formatDate = (dateString: string | null): string =>
  formatDateValue(dateString, DEFAULT_DATE_OPTIONS, "No due date");

export const formatAssignedDate = (dateString: string | null): string =>
  formatDateValue(dateString, DEFAULT_DATE_OPTIONS, "No due date");

export const formatDateTime = (dateString: DateInput, fallback = "N/A"): string =>
  formatDateValue(dateString, DEFAULT_DATE_TIME_OPTIONS, fallback);

export const formatDateFromUnixSeconds = (timestamp?: number, fallback = "N/A"): string =>
  formatDateValue(timestamp, DEFAULT_DATE_OPTIONS, fallback, "en-US", true);

/** Short "Jun 6, 2026" style date. */
export const formatShortDate = (value: DateInput, fallback = "—"): string =>
  formatDateValue(value, { month: "short", day: "numeric", year: "numeric" }, fallback);

/** Relative "just now / 5m ago / 3h ago / 2d ago / Jun 6" formatter. */
export const timeAgo = (value: DateInput): string => {
  const date = parseDateInput(value);
  if (!date) return "—";
  const s = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

/** Whole-number percentage of part/whole, clamped to 0-100. */
export const pct = (part: number, whole: number): number =>
  whole > 0 ? Math.max(0, Math.min(100, Math.round((part / whole) * 100))) : 0;

/** Capitalize the first letter. */
export const capitalize = (s?: string | null): string =>
  s ? s.charAt(0).toUpperCase() + s.slice(1) : "";

/** Up-to-2-letter initials from a name / {first,last} / email. */
export const getInitials = (
  input?: string | { first_name?: string; last_name?: string; name?: string; email?: string } | null
): string => {
  if (!input) return "?";
  let name = "";
  if (typeof input === "string") name = input;
  else name = `${input.first_name || ""} ${input.last_name || ""}`.trim() || input.name || input.email || "";
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : name.slice(0, 2);
  return letters.toUpperCase();
};
