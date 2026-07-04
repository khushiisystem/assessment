// Tiny, dependency-free Markdown -> HTML converter for question answers.
// Authors type light markdown (headings, lists, code, bold, links) and it
// renders in the same structured style as the rest of the app. No AI, instant.
//
// Always run the result through sanitizeHtml() before injecting — this only
// formats; it does not sanitize.

const esc = (s: string): string =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

// Inline: **bold**, *italic*, `code`, [text](url). Operates on already-escaped text.
const inline = (s: string): string =>
  s
    .replace(/`([^`]+)`/g, (_m, c) => `<code>${c}</code>`)
    .replace(/\*\*([^*]+)\*\*/g, (_m, c) => `<strong>${c}</strong>`)
    .replace(/(^|[^*])\*([^*\n]+)\*/g, (_m, p, c) => `${p}<em>${c}</em>`)
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_m, t, u) => `<a href="${u}">${t}</a>`);

// Looks like the author already wrote HTML (e.g. seeded/rich content)? Leave it.
const looksLikeHtml = (s: string): boolean =>
  /<\/?(p|h[1-6]|ul|ol|li|pre|code|blockquote|table|div|span|strong|em|br)\b/i.test(s);

/**
 * Convert light markdown to HTML. If the input already contains HTML tags it is
 * returned unchanged, so existing rich answers keep rendering as-is.
 */
export const renderRich = (input: unknown): string => {
  const text = typeof input === "string" ? input : input == null ? "" : String(input);
  if (!text.trim()) return "";
  if (looksLikeHtml(text)) return text;

  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let i = 0;
  let para: string[] = [];

  const flushPara = () => {
    if (para.length) {
      out.push(`<p>${inline(esc(para.join(" ")))}</p>`);
      para = [];
    }
  };

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block: ``` ... ```
    const fence = line.match(/^\s*```/);
    if (fence) {
      flushPara();
      i++;
      const code: string[] = [];
      while (i < lines.length && !/^\s*```/.test(lines[i])) {
        code.push(lines[i]);
        i++;
      }
      i++; // skip closing fence
      out.push(`<pre><code>${esc(code.join("\n"))}</code></pre>`);
      continue;
    }

    // Heading: #, ##, ### -> h4 (matches the app's answer styling)
    const heading = line.match(/^\s*#{1,6}\s+(.*)$/);
    if (heading) {
      flushPara();
      out.push(`<h4>${inline(esc(heading[1].trim()))}</h4>`);
      i++;
      continue;
    }

    // Blockquote: > text
    if (/^\s*>\s?/.test(line)) {
      flushPara();
      const quote: string[] = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        quote.push(lines[i].replace(/^\s*>\s?/, ""));
        i++;
      }
      out.push(`<blockquote>${inline(esc(quote.join(" ")))}</blockquote>`);
      continue;
    }

    // Unordered list: - or *
    if (/^\s*[-*]\s+/.test(line)) {
      flushPara();
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(`<li>${inline(esc(lines[i].replace(/^\s*[-*]\s+/, "")))}</li>`);
        i++;
      }
      out.push(`<ul>${items.join("")}</ul>`);
      continue;
    }

    // Ordered list: 1. 2. ...
    if (/^\s*\d+[.)]\s+/.test(line)) {
      flushPara();
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) {
        items.push(`<li>${inline(esc(lines[i].replace(/^\s*\d+[.)]\s+/, "")))}</li>`);
        i++;
      }
      out.push(`<ol>${items.join("")}</ol>`);
      continue;
    }

    // Blank line ends a paragraph
    if (!line.trim()) {
      flushPara();
      i++;
      continue;
    }

    // Otherwise accumulate into the current paragraph
    para.push(line.trim());
    i++;
  }

  flushPara();
  return out.join("\n");
};
