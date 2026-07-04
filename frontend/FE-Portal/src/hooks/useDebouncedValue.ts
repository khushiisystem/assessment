import { useEffect, useState } from "react";

/** Returns `value` debounced by `delay` ms. Replaces the repeated
 * setTimeout→setDebouncedSearch effect in list/search pages. */
export function useDebouncedValue<T>(value: T, delay = 400): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}
