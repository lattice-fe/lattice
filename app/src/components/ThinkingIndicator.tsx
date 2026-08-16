import { ThinkingOrb } from "thinking-orbs";

// Match the orb's palette to the active Lattice appearance.
const orbTheme = () => (document.documentElement.getAttribute("data-appearance") === "light" ? "light" : "dark");

/** Watson "composing" thinking orb + optional label — used in the chat pane,
 *  Spotlight, and the summary modal so every AI wait looks the same. */
export function ThinkingIndicator({ label, size = 20 }: { label?: string; size?: 20 | 64 }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "9px", color: "var(--dim)", fontSize: "13px" }}>
      <ThinkingOrb state="composing" size={size} theme={orbTheme()} />
      {label && <span>{label}</span>}
    </div>
  );
}
