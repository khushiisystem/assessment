import { useCallback, useState } from "react";

/** Copy text to clipboard with a transient `copied` flag (auto-resets). */
export function useCopyToClipboard(resetMs = 2000): [boolean, (text: string) => Promise<void>] {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), resetMs);
      } catch {
        /* clipboard blocked — caller can fall back to manual select */
      }
    },
    [resetMs]
  );
  return [copied, copy];
}
