import { useState, useMemo, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { api, isTauri } from "../lib/api";
import guideMd from "../docs/guide.md?raw";

interface TocItem {
  id: string;
  title: string;
  level: number;
}

// Generate URL slug ID from heading text
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

export function DocumentationViewer() {
  const [activeId, setActiveId] = useState<string>("");
  const activeIdRef = useRef(activeId);
  activeIdRef.current = activeId;
  const contentRef = useRef<HTMLDivElement>(null);

  // Parse all headings (# and ##) dynamically from the Markdown file
  const tocItems = useMemo<TocItem[]>(() => {
    const items: TocItem[] = [];
    const lines = guideMd.split("\n");
    for (const line of lines) {
      const match = line.match(/^(#{1,3})\s+(.+)$/);
      if (match) {
        const level = match[1].length;
        const rawTitle = match[2].trim();
        const title = rawTitle.replace(/`([^`]+)`/g, "$1").replace(/\*([^*]+)\*/g, "$1");
        const id = slugify(title);
        items.push({ id, title, level });
      }
    }
    return items;
  }, []);

  // Default active heading to first item
  useEffect(() => {
    if (tocItems.length > 0 && !activeId) {
      setActiveId(tocItems[0].id);
    }
  }, [tocItems, activeId]);

  // High-performance scroll listener: requestAnimationFrame throttled + no layout thrashing
  useEffect(() => {
    const pane = contentRef.current;
    if (!pane || tocItems.length === 0) return;

    let rAfId: number | null = null;

    const handleScroll = () => {
      if (rAfId !== null) return;

      rAfId = requestAnimationFrame(() => {
        rAfId = null;
        const scrollTop = pane.scrollTop;
        const headingEls = tocItems
          .map((item) => document.getElementById(item.id))
          .filter((el): el is HTMLElement => el !== null);

        if (headingEls.length === 0) return;

        let currentId = headingEls[0].id;
        for (const el of headingEls) {
          if (el.offsetTop - 80 <= scrollTop) {
            currentId = el.id;
          } else {
            break;
          }
        }

        if (currentId !== activeIdRef.current) {
          setActiveId(currentId);
        }
      });
    };

    pane.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      pane.removeEventListener("scroll", handleScroll);
      if (rAfId !== null) cancelAnimationFrame(rAfId);
    };
  }, [tocItems]);

  const scrollToHeading = (id: string) => {
    setActiveId(id);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="doc-viewer-container">
      {/* Left-Side Index Pane */}
      <div className="doc-toc-pane">
        <div className="doc-toc-header">Index</div>
        <div className="doc-toc-list">
          {tocItems.map((item) =>
            item.level === 1 ? (
              <button
                key={item.id}
                className={"doc-toc-section-header" + (activeId === item.id ? " active" : "")}
                onClick={() => scrollToHeading(item.id)}
              >
                {item.title}
              </button>
            ) : (
              <button
                key={item.id}
                className={"doc-toc-subitem" + (activeId === item.id ? " active" : "")}
                onClick={() => scrollToHeading(item.id)}
              >
                {item.title}
              </button>
            )
          )}
        </div>
      </div>

      {/* Main Documentation Content Panel */}
      <div className="doc-main-pane" ref={contentRef}>
        <div className="doc-header-banner">
          <span className="doc-badge">DOCUMENTATION & GUIDES</span>
          <h1>Lattice Documentation</h1>
        </div>

        <div className="doc-content-body">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              h1: ({ children }) => {
                const text = String(children);
                const id = slugify(text);
                return <h1 id={id} className="doc-h1">{children}</h1>;
              },
              h2: ({ children }) => {
                const text = String(children);
                const id = slugify(text);
                return <h2 id={id} className="doc-h2">{children}</h2>;
              },
              h3: ({ children }) => {
                const text = String(children);
                const id = slugify(text);
                return <h3 id={id} className="doc-h3">{children}</h3>;
              },
              a: ({ href, children }) => {
                const isExternal = href?.startsWith("http://") || href?.startsWith("https://") || href?.startsWith("mailto:");
                return (
                  <a
                    href={href}
                    style={{ color: "var(--teal)", textDecoration: "underline", cursor: "pointer" }}
                    onClick={(e) => {
                      e.preventDefault();
                      if (!href) return;
                      if (isExternal) {
                        if (isTauri) api.openUrl(href);
                        else window.open(href, "_blank", "noopener,noreferrer");
                      }
                    }}
                  >
                    {children}
                  </a>
                );
              },
              table: ({ children }) => (
                <table className="doc-table">{children}</table>
              ),
              code: ({ className, children }) => {
                const inline = !className;
                return inline ? (
                  <code className="doc-inline-code">{children}</code>
                ) : (
                  <pre className="doc-code">
                    <code>{children}</code>
                  </pre>
                );
              },
            }}
          >
            {guideMd}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
