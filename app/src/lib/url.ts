// Decide whether a Spotlight "?" web query is itself a URL to open directly
// (vs. a search term to hand to Google). Conservative on purpose: bare
// dotted terms like "node.js" or "react.ts" should stay searches, so a bare
// domain only counts when its TLD is in a known set. Anything with an explicit
// scheme, a www. prefix, or a domain + path is treated as a URL.
const KNOWN_TLDS =
  /\.(com|org|net|io|dev|app|co|ai|gg|edu|gov|mil|xyz|me|so|sh|info|biz|tv|fm|cloud|page|site|tech|store|blog|wiki|to|us|uk|ca|de|fr|jp|in|au|eu)$/i;

export function asUrl(query: string): string | null {
  const t = query.trim();
  if (!t || /\s/.test(t)) return null; // URLs have no spaces
  if (/^https?:\/\/\S+$/i.test(t)) return t; // explicit scheme
  if (/^www\.\S+\.\S+$/i.test(t)) return "https://" + t; // www.example.com
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+\/\S*$/i.test(t)) return "https://" + t; // domain + path
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(t) && KNOWN_TLDS.test(t)) return "https://" + t; // bare domain w/ known TLD
  return null;
}

export function webSearchUrl(query: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}
