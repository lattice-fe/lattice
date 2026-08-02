import { Kind } from "./api";
import { KIND_TONE } from "./theme/types";

// File-kind tile colours resolve to themeable CSS vars (set by the theme
// engine). Each kind maps to a tone; the tone's bg/fg come from the theme.
const tile = (kind: Kind) => {
  const tone = KIND_TONE[kind] ?? "neutral";
  return { bg: `var(--tile-${tone}-bg)`, fg: `var(--tile-${tone}-fg)` };
};
export const TONE: Record<Kind, { bg: string; fg: string }> = {
  folder: tile("folder"), archive: tile("archive"), code: tile("code"),
  image: tile("image"), audio: tile("audio"), video: tile("video"),
  executable: tile("executable"), document: tile("document"), other: tile("other"),
};

export const kindOf = (name: string): Kind => {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico"].includes(ext)) return "image";
  if (["mp4", "mkv", "mov", "webm", "avi", "wmv"].includes(ext)) return "video";
  if (["mp3", "wav", "flac", "ogg", "m4a"].includes(ext)) return "audio";
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) return "archive";
  if (["rs", "ts", "tsx", "js", "jsx", "py", "go", "json", "toml", "yaml", "yml", "html", "css", "c", "cpp", "h", "java"].includes(ext)) return "code";
  if (["pdf", "md", "txt", "doc", "docx", "csv", "rtf"].includes(ext)) return "document";
  if (["exe", "msi", "bat"].includes(ext)) return "executable";
  return "other";
};

export function Glyph({ kind }: { kind: Kind }) {
  const p = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (kind) {
    case "folder": return <svg viewBox="0 0 24 24" {...p}><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></svg>;
    case "image": return <svg viewBox="0 0 24 24" {...p}><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="1.6" /><path d="m21 15-5-5L5 21" /></svg>;
    case "code": return <svg viewBox="0 0 24 24" {...p}><path d="m16 18 6-6-6-6M8 6l-6 6 6 6" /></svg>;
    case "video": return <svg viewBox="0 0 24 24" {...p}><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m10 9 5 3-5 3z" /></svg>;
    case "audio": return <svg viewBox="0 0 24 24" {...p}><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>;
    case "archive": return <svg viewBox="0 0 24 24" {...p}><rect x="3" y="4" width="18" height="4" rx="1" /><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8M10 12h4" /></svg>;
    case "executable": return <svg viewBox="0 0 24 24" {...p}><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m8 9 3 3-3 3M13 15h3" /></svg>;
    default: return <svg viewBox="0 0 24 24" {...p}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M9 13h6M9 17h4" /></svg>;
  }
}

export const Mark = () => (
  <svg viewBox="0 0 48 48">
    <g fill="none" stroke="#C05F3C" strokeWidth="2" strokeLinecap="round" opacity="0.92">
      <line x1="10" y1="10" x2="38" y2="10" /><line x1="10" y1="38" x2="38" y2="38" />
      <line x1="10" y1="10" x2="10" y2="38" /><line x1="38" y1="10" x2="38" y2="38" />
      <line x1="10" y1="24" x2="38" y2="24" /><line x1="24" y1="10" x2="24" y2="38" />
    </g>
    <g fill="#C05F3C"><circle cx="10" cy="10" r="3.1" /><circle cx="38" cy="10" r="3.1" /><circle cx="10" cy="38" r="3.1" /><circle cx="38" cy="38" r="3.1" /><circle cx="24" cy="10" r="3.1" /><circle cx="10" cy="24" r="3.1" /><circle cx="38" cy="24" r="3.1" /><circle cx="24" cy="38" r="3.1" /></g>
    <circle cx="24" cy="24" r="7.4" fill="none" stroke="#E2A64C" strokeWidth="1.5" opacity="0.45" style={{ animation: "pulse 3.4s ease-in-out infinite", transformOrigin: "24px 24px" }} />
    <circle cx="24" cy="24" r="4.4" fill="#E2A64C" />
  </svg>
);
