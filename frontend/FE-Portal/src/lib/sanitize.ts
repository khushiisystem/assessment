import DOMPurify from "dompurify";

/**
 * Sanitize untrusted HTML before injecting via dangerouslySetInnerHTML.
 * Question/answer/description content is authored rich text and must never be
 * rendered raw (stored-XSS risk). Use everywhere `__html` is set with data that
 * originates from the API.
 */
export const sanitizeHtml = (dirty: unknown): string =>
  DOMPurify.sanitize(typeof dirty === "string" ? dirty : dirty == null ? "" : String(dirty));
