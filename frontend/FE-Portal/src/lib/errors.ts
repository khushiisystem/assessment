/**
 * Extract a human-friendly message from an RTK Query / fetch error of unknown shape.
 * Use everywhere instead of re-implementing `e?.data?.detail || ...` per page.
 */
export const getErrorMessage = (
  e: any,
  fallback = "Something went wrong. Please try again."
): string => {
  if (!e) return fallback;
  const data = e.data ?? e.response?.data;
  if (typeof data === "string" && data.trim()) return data;
  if (data && typeof data === "object") {
    if (typeof data.detail === "string") return data.detail;
    if (typeof data.message === "string") return data.message;
    // First field error (e.g. {email: ["already exists"]})
    const first = Object.values(data).flat()[0];
    if (typeof first === "string") return first;
  }
  if (typeof e.message === "string" && e.message) return e.message;
  return fallback;
};
