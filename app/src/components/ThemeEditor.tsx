import { useEffect, useState } from "react";
import { Theme, ThemeTokens, Tone } from "../lib/theme/types";
import { ThemeApi } from "../hooks/useTheme";
import { applyTheme } from "../lib/theme/engine";
import { parseThemeJson, themeToJson } from "../lib/theme/validate";

const COLOR_FIELDS: { key: keyof ThemeTokens; label: string; group: string }[] = [
  { group: "Surfaces", key: "bg", label: "Background" },
  { group: "Surfaces", key: "surface", label: "Surface" },
  { group: "Surfaces", key: "border", label: "Border" },
  { group: "Text", key: "text", label: "Text" },
  { group: "Text", key: "textDim", label: "Dim text" },
  { group: "Accents", key: "accent", label: "Accent" },
  { group: "Accents", key: "accent2", label: "Accent 2" },
  { group: "Accents", key: "accent3", label: "Accent 3" },
  { group: "Semantic", key: "danger", label: "Danger" },
];
const GROUPS = ["Surfaces", "Text", "Accents", "Semantic", "File Icons"];
const TONES: Tone[] = ["rust", "amber", "green", "violet", "red", "neutral"];
const TONE_LABELS: Record<Tone, string> = {
  rust: "Rust (code)",
  amber: "Amber (folders)",
  green: "Green (images)",
  violet: "Violet (audio)",
  red: "Red (video/exe)",
  neutral: "Neutral (docs)",
};

function fork(base: Theme, isNew: boolean): Theme {
  return {
    ...base,
    id: isNew ? `custom-${Date.now()}` : base.id,
    name: isNew ? `${base.name} copy` : base.name,
    author: undefined,
    tokens: { ...base.tokens },
    fonts: { ...base.fonts },
    effects: { ...base.effects },
    tiles: base.tiles ? { ...base.tiles } : undefined,
  };
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="tf-field">
      <span className="tf-label">{label}</span>
      <span className="tf-color" style={{ borderColor: value }}>
        <input type="color" value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#000000"} onChange={(e) => onChange(e.target.value)} />
        <input type="text" className="tf-hex" value={value} spellCheck={false} onChange={(e) => onChange(e.target.value)} />
      </span>
    </label>
  );
}

export function ThemeEditor({ th, base, isNew, onClose }: { th: ThemeApi; base: Theme; isNew: boolean; onClose: () => void }) {
  const [draft, setDraft] = useState<Theme>(() => fork(base, isNew));
  const [importing, setImporting] = useState(false);
  const [importText, setImportText] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  // Live-preview the draft as it's edited. Reverting on cancel is handled in
  // cancel() (not an unmount cleanup — that would also fire on save and clobber
  // the just-saved theme with a stale value).
  useEffect(() => { applyTheme(draft); }, [draft]);

  const patch = (p: Partial<Theme>) => setDraft((d) => ({ ...d, ...p }));
  const setToken = (k: keyof ThemeTokens, v: string) => setDraft((d) => ({ ...d, tokens: { ...d.tokens, [k]: v } }));
  const setEffect = (k: "glow" | "glowStrength" | "shadowStrength", v: string | number) =>
    setDraft((d) => ({ ...d, effects: { ...d.effects, [k]: v } }));
  const setFont = (k: "ui" | "display" | "mono", v: string) =>
    setDraft((d) => ({ ...d, fonts: { ...d.fonts, [k]: v || undefined } }));
  const setTile = (tone: Tone, prop: "bg" | "fg", v: string) =>
    setDraft((d) => ({ ...d, tiles: { ...d.tiles, [tone]: { ...d.tiles?.[tone], [prop]: v } } }));

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(null), 1800); };

  const copyJson = () => {
    navigator.clipboard?.writeText(themeToJson(draft)).then(() => flash("Copied JSON")).catch(() => flash("Copy failed"));
  };
  const download = () => {
    const blob = new Blob([themeToJson(draft)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${draft.name.replace(/\s+/g, "-").toLowerCase() || "theme"}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const applyImport = () => {
    try {
      const parsed = parseThemeJson(importText);
      setDraft({ ...parsed, id: draft.id }); // keep editing the same slot
      setImporting(false); setImportText("");
      flash("Imported");
    } catch (e) { flash(String(e instanceof Error ? e.message : e)); }
  };

  const cancel = () => { th.applyPreview(th.theme); onClose(); };
  const save = () => { th.saveTheme(draft); onClose(); };

  return (
    <div className="modal-backdrop" onClick={cancel}>
      <div className="modal theme-editor" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{isNew ? "New theme" : "Edit theme"}</h2>
          <button className="modal-x" onClick={cancel} title="Close">×</button>
        </div>

        <div className="te-top">
          <label className="tf-field grow">
            <span className="tf-label">Name</span>
            <input className="te-input" value={draft.name} onChange={(e) => patch({ name: e.target.value })} />
          </label>
        </div>

        {GROUPS.map((g) => (
          <div key={g}>
            <div className="modal-sec">{g}</div>
            {g === "File Icons" ? (
              <div className="tf-grid">
                {TONES.map((tone) => {
                  const bg = draft.tiles?.[tone]?.bg ?? "";
                  const fg = draft.tiles?.[tone]?.fg ?? "";
                  return (
                    <div key={tone} style={{ gridColumn: "span 2" }}>
                      <div className="modal-subsec">{TONE_LABELS[tone]}</div>
                      <div className="tf-grid" style={{ marginTop: "8px" }}>
                        <ColorField label="Background" value={bg} onChange={(v) => setTile(tone, "bg", v)} />
                        <ColorField label="Foreground" value={fg} onChange={(v) => setTile(tone, "fg", v)} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="tf-grid">
                {COLOR_FIELDS.filter((f) => f.group === g).map((f) => (
                  <ColorField key={f.key} label={f.label} value={draft.tokens[f.key] ?? "#000000"} onChange={(v) => setToken(f.key, v)} />
                ))}
              </div>
            )}
          </div>
        ))}

        <div className="modal-sec">Shape &amp; effects</div>
        <div className="tf-grid">
          <label className="tf-field">
            <span className="tf-label">Corner radius · {draft.radius ?? 11}px</span>
            <input type="range" min={2} max={22} value={draft.radius ?? 11} onChange={(e) => patch({ radius: Number(e.target.value) })} />
          </label>
          <ColorField label="Ambient glow" value={draft.effects?.glow ?? draft.tokens.accent2} onChange={(v) => setEffect("glow", v)} />
          <label className="tf-field">
            <span className="tf-label">Glow strength</span>
            <input type="range" min={0} max={0.2} step={0.005} value={draft.effects?.glowStrength ?? 0.04} onChange={(e) => setEffect("glowStrength", Number(e.target.value))} />
          </label>
          <label className="tf-field">
            <span className="tf-label">Shadow strength</span>
            <input type="range" min={0} max={1} step={0.02} value={draft.effects?.shadowStrength ?? (draft.appearance === "dark" ? 0.7 : 0.15)} onChange={(e) => setEffect("shadowStrength", Number(e.target.value))} />
          </label>
        </div>

        <div className="modal-sec">Typography <span className="te-hint">(optional — blank uses defaults)</span></div>
        <div className="tf-grid">
          <label className="tf-field grow"><span className="tf-label">UI font</span><input className="te-input" placeholder="Inter" value={draft.fonts?.ui ?? ""} onChange={(e) => setFont("ui", e.target.value)} /></label>
          <label className="tf-field grow"><span className="tf-label">Display font</span><input className="te-input" placeholder="IBM Plex Sans" value={draft.fonts?.display ?? ""} onChange={(e) => setFont("display", e.target.value)} /></label>
          <label className="tf-field grow"><span className="tf-label">Mono font</span><input className="te-input" placeholder="JetBrains Mono" value={draft.fonts?.mono ?? ""} onChange={(e) => setFont("mono", e.target.value)} /></label>
        </div>

        {importing && (
          <div className="te-import">
            <textarea className="te-input" rows={5} placeholder="Paste theme JSON…" value={importText} onChange={(e) => setImportText(e.target.value)} spellCheck={false} />
            <div className="te-import-actions">
              <button className="btn-soft" onClick={applyImport}>Load</button>
              <button className="btn-ghost2" onClick={() => { setImporting(false); setImportText(""); }}>Cancel</button>
            </div>
          </div>
        )}

        <div className="te-foot">
          <div className="te-io">
            <button className="btn-ghost2" onClick={() => setImporting((v) => !v)}>Import</button>
            <button className="btn-ghost2" onClick={copyJson}>Copy JSON</button>
            <button className="btn-ghost2" onClick={download}>Download</button>
            {msg && <span className="te-msg">{msg}</span>}
          </div>
          <div className="te-actions">
            <button className="btn-ghost2" onClick={cancel}>Cancel</button>
            <button className="btn-soft primary" onClick={save}>{isNew ? "Create theme" : "Save"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
