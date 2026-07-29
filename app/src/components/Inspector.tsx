import { Explorer } from "../hooks/useExplorer";
import { Glyph, TONE } from "../lib/icons";
import { fmtSize, fmtWhen, parentOf } from "../lib/format";

export function Inspector({ ex }: { ex: Explorer }) {
  const items = ex.selectedEntries;

  if (items.length === 0)
    return <aside className="inspector empty">Select an item<br />to see details</aside>;

  if (items.length > 1) {
    const total = items.reduce((a, e) => a + e.size, 0);
    return (
      <aside className="inspector">
        <div className="insp-in">
          <div className="preview" style={{ background: "linear-gradient(150deg, #2a251f, #1b1712)", color: "var(--amber)" }}>
            <div style={{ fontFamily: "var(--serif)", fontSize: 40, fontWeight: 600 }}>{items.length}</div>
          </div>
          <div><div className="insp-name">{items.length} items</div><div className="insp-sub">selected · {fmtSize(total)}</div></div>
        </div>
      </aside>
    );
  }

  const e = items[0];
  const t = TONE[e.kind];
  return (
    <aside className="inspector">
      <div className="insp-in" key={e.path}>
        <div className="preview" style={{ background: `linear-gradient(150deg, ${t.bg}, #1b1712)`, color: t.fg }}><Glyph kind={e.kind} /></div>
        <div>
          <div className="insp-name">{e.name}</div>
          <div className="insp-sub">{e.type_label} · {fmtSize(e.size, e.is_dir)}</div>
        </div>
        <div className="actions">
          <button className="btn-open" onClick={() => ex.openEntry(e)}>Open</button>
          <button className="btn-ghost" title="Reveal" onClick={() => ex.reveal(e.path)}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></svg></button>
          <button className="btn-ghost" title="More" onClick={(ev) => ex.openContext(ev.clientX, ev.clientY, ex.entries.findIndex((x) => x.path === e.path))}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1.4" /><circle cx="19" cy="12" r="1.4" /><circle cx="5" cy="12" r="1.4" /></svg></button>
        </div>
        <div className="divider" />
        <div>
          <div className="info-h">Information</div>
          <div className="info-row"><span className="k">Kind</span><span className="v">{e.type_label}</span></div>
          <div className="info-row"><span className="k">Size</span><span className="v">{fmtSize(e.size, e.is_dir)}</span></div>
          <div className="info-row"><span className="k">Where</span><span className="v">{parentOf(e.path) ?? "/"}</span></div>
          <div className="info-row"><span className="k">Modified</span><span className="v">{fmtWhen(e.modified)}</span></div>
        </div>
      </div>
    </aside>
  );
}
