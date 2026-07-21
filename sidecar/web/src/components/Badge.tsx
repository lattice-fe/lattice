export function Badge({
  label,
  bg,
  text,
  pulse,
  mono,
}: {
  label: string;
  bg: string;
  text: string;
  pulse?: boolean;
  mono?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-medium ${mono ? "font-mono" : ""}`}
      style={{ background: bg, color: text }}
    >
      {pulse && <span className="h-1.5 w-1.5 rounded-full animate-pulse-dot" style={{ background: "currentColor" }} />}
      {label}
    </span>
  );
}

export function TypeChip({ code, bg, text }: { code: string; bg: string; text: string }) {
  return (
    <span
      className="inline-flex flex-none items-center rounded px-1.5 py-1 font-mono text-[10px] font-medium"
      style={{ background: bg, color: text }}
    >
      {code}
    </span>
  );
}

export function FileChip({ name, className = "" }: { name: string; className?: string }) {
  return (
    <span
      className={`inline-flex min-w-0 items-center rounded px-1.5 py-0.5 font-mono text-[10.5px] ${className}`}
      style={{ background: "var(--color-border-soft)", color: "var(--color-muted)" }}
      title={name}
    >
      <span className="truncate">{name}</span>
    </span>
  );
}

export function Avatar({ label, size = 26 }: { label: string; size?: number }) {
  return (
    <div
      className="flex flex-none items-center justify-center rounded-full font-semibold"
      style={{
        width: size,
        height: size,
        background: "var(--color-accent-soft)",
        color: "var(--color-accent-ink)",
        fontSize: size * 0.42,
      }}
    >
      {label}
    </div>
  );
}
