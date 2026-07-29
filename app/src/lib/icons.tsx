import { Kind } from "./api";

export const TONE: Record<Kind, { bg: string; fg: string }> = {
  folder: { bg: "#33260f", fg: "#E2A64C" },
  archive: { bg: "#33260f", fg: "#E2A64C" },
  code: { bg: "#331f14", fg: "#d8794a" },
  image: { bg: "#22271f", fg: "#9db98a" },
  audio: { bg: "#282132", fg: "#b199d6" },
  video: { bg: "#301c1a", fg: "#cf6f5b" },
  executable: { bg: "#301c1a", fg: "#cf6f5b" },
  document: { bg: "#26221d", fg: "#a99f8e" },
  other: { bg: "#26221d", fg: "#a99f8e" },
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
