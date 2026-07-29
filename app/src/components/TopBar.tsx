import { Explorer } from "../hooks/useExplorer";
import { baseName, crumbsOf } from "../lib/format";

const I = {
  back: <path d="M15 18l-6-6 6-6" />,
  fwd: <path d="M9 18l6-6-6-6" />,
  up: <path d="M12 19V5M5 12l7-7 7 7" />,
  refresh: <path d="M21 12a9 9 0 1 1-2.6-6.4M21 3v6h-6" />,
};
const Ico = ({ d, w = 17 }: { d: React.ReactNode; w?: number }) => (
  <svg width={w} height={w} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{d}</svg>
);

export function TopBar({ ex }: { ex: Explorer }) {
  const crumbs = ex.path ? crumbsOf(ex.path) : [];
  return (
    <div className="topbar">
      <div className="nav">
        <button className="iconbtn" title="Back" disabled={!ex.canBack} onClick={ex.back}><Ico d={I.back} /></button>
        <button className="iconbtn" title="Forward" disabled={!ex.canForward} onClick={ex.forward}><Ico d={I.fwd} /></button>
        <button className="iconbtn" title="Up" disabled={!ex.canUp} onClick={ex.up}><Ico d={I.up} /></button>
        <button className="iconbtn" title="Refresh" onClick={ex.refresh}><Ico d={I.refresh} w={16} /></button>
      </div>
      <div className="crumbs">
        {crumbs.map(([label, full], i) => (
          <span key={full} style={{ display: "contents" }}>
            <button
              className={"crumb" + (i === crumbs.length - 1 ? " here" : "")}
              onClick={() => ex.navigate(full)}
            >{label.replace(/\/$/, "") || baseName(full)}</button>
            {i < crumbs.length - 1 && <span className="crumb-sep">/</span>}
          </span>
        ))}
      </div>
      <div className="search">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
        <input placeholder="Search or jump to…" />
        <span className="kbd">⌘K</span>
      </div>
      <button className="iconbtn" title="Settings"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 8 19.3a1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0-1.2-2.9H2a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 3.7 8a1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H8a1.7 1.7 0 0 0 1-1.5V2a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V8a1.7 1.7 0 0 0 1.5 1H22a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg></button>
    </div>
  );
}
