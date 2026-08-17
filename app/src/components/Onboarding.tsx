import { useEffect, useState } from "react";
import { ThemeApi } from "../hooks/useTheme";
import { themeVars } from "../lib/theme/engine";
import { api } from "../lib/api";
import { Mark } from "../lib/icons";

const SWATCH_KEYS = ["--card", "--terracotta", "--amber", "--teal"];

export function Onboarding({ th, onDone }: { th: ThemeApi; onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [folder, setFolder] = useState("");

  useEffect(() => { api.homeDir().then((h) => setFolder(h)).catch(() => {}); }, []);

  const finish = (index: boolean) => {
    const n = name.trim();
    if (n) localStorage.setItem("lattice:user-name", n);
    localStorage.setItem("lattice:onboarded", "true");
    if (index && folder) api.indexFolder(folder).catch(() => {}); // fire-and-forget; runs in background
    onDone();
  };

  const pickFolder = async () => {
    const p = await api.selectFolder();
    if (p) setFolder(p);
  };

  return (
    <div className="onboard-overlay">
      {/* Aurora glow */}
      <div className="onboard-glow g1" />
      <div className="onboard-glow g2" />
      {/* Faint tiled Lattice-glyph doodles */}
      <svg className="onboard-doodles" aria-hidden="true" width="100%" height="100%">
        <defs>
          <pattern id="onboardDoodle" width="150" height="150" patternUnits="userSpaceOnUse" patternTransform="rotate(-8)">
            <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path transform="translate(12,18)" d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <path transform="translate(98,12)" d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6" />
              <g transform="translate(20,94)"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></g>
              <path transform="translate(104,98)" d="M12 2.5l2.9 6.3 6.6.6-5 4.4 1.5 6.6L12 17l-5.9 3.4 1.5-6.6-5-4.4 6.6-.6z" />
            </g>
            <g fill="currentColor">
              <circle cx="68" cy="60" r="2" /><circle cx="82" cy="60" r="2" />
              <circle cx="68" cy="74" r="2" /><circle cx="82" cy="74" r="2" />
            </g>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#onboardDoodle)" />
      </svg>
      <div className="onboard-card">
        {step === 0 && (
          <div className="onboard-step">
            <div className="onboard-head">
              <span className="onboard-mark"><Mark /></span>
              <h1 className="onboard-title">Welcome to Lattice</h1>
            </div>
            <p className="onboard-sub">A fast, inviting file explorer. Two quick things and you're set.</p>
            <input
              className="onboard-input" autoFocus value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") setStep(1); }}
              placeholder="What should we call you?"
            />
          </div>
        )}

        {step === 1 && (
          <div className="onboard-step">
            <h1 className="onboard-title">Pick a look</h1>
            <p className="onboard-sub">Choose a theme — change it anytime in Settings.</p>
            <div className="theme-grid onboard-themes">
              {th.themes.map((t) => {
                const v = themeVars(t);
                const active = t.id === th.theme.id;
                return (
                  <div
                    key={t.id}
                    className={"theme-card" + (active ? " on" : "")}
                    onClick={() => th.setTheme(t.id)}
                    style={{ background: v["--ink"], borderColor: active ? v["--terracotta"] : v["--border"] }}
                  >
                    <div className="theme-swatches">
                      {SWATCH_KEYS.map((k) => <span key={k} style={{ background: v[k] }} />)}
                    </div>
                    <div className="theme-name" style={{ color: v["--paper"] }}>{t.name}</div>
                    <div className="theme-appear" style={{ color: v["--dim"] }}>{t.appearance}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="onboard-step">
            <h1 className="onboard-title">Make search instant</h1>
            <p className="onboard-sub">Index a folder so search, Spotlight, and Watson can find things right away. It runs in the background — you can keep using Lattice.</p>
            <div className="onboard-folder">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--terracotta)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></svg>
              <span className="onboard-folder-path" title={folder}>{folder || "…"}</span>
              <button className="onboard-btn ghost" onClick={pickFolder}>Change</button>
            </div>
          </div>
        )}

        <div className="onboard-footer">
          <button className="onboard-skip" onClick={() => finish(false)}>Skip setup</button>
          <div className="onboard-dots">
            {[0, 1, 2].map((i) => <span key={i} className={"onboard-dot" + (i === step ? " on" : "")} />)}
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            {step > 0 && <button className="onboard-btn ghost" onClick={() => setStep(step - 1)}>Back</button>}
            {step < 2
              ? <button className="onboard-btn primary" onClick={() => setStep(step + 1)}>Continue</button>
              : <button className="onboard-btn primary" onClick={() => finish(true)}>{folder ? "Index & finish" : "Finish"}</button>}
          </div>
        </div>
      </div>
    </div>
  );
}
