import type { Components } from "react-markdown";
import { convertFileSrc } from "@tauri-apps/api/core";
import { api, isTauri } from "./api";

// Check if a URL points to an external website
export function isExternalUrl(href: string): boolean {
  if (!href) return false;
  if (href.startsWith("mailto:")) return true;
  // If it starts with localhost or tauri.localhost, it's a webview-local relative URL
  if (/^https?:\/\/(localhost|127\.0\.0\.1|tauri\.localhost)/i.test(href)) {
    return false;
  }
  return /^https?:\/\//i.test(href);
}

// Clean raw href from DOM/markdown (stripping localhost/tauri.localhost webview origins)
export function cleanHref(rawHref: string): string {
  if (!rawHref) return "";
  try {
    if (/^https?:\/\/(localhost|127\.0\.0\.1|tauri\.localhost)/i.test(rawHref)) {
      const url = new URL(rawHref);
      return decodeURIComponent(url.pathname.replace(/^\/+/, ""));
    }
  } catch { /* ignore */ }
  return rawHref;
}

// Resolve a link/image href that appears inside a markdown file against that
// file's folder. Absolute paths and URLs pass through unchanged.
export function resolveRelativePath(baseFilePath: string, relPath: string): string {
  const cleaned = cleanHref(relPath);
  if (!cleaned || isExternalUrl(cleaned)) return cleaned;
  if (/^[a-zA-Z]:[/\\]/.test(cleaned) || cleaned.startsWith("/")) {
    return cleaned.replace(/\\/g, "/");
  }
  const cleanBase = baseFilePath.replace(/\\/g, "/");
  const baseDir = cleanBase.includes("/") ? cleanBase.substring(0, cleanBase.lastIndexOf("/")) : "";
  const baseParts = baseDir ? baseDir.split("/") : [];
  const relParts = cleaned.replace(/\\/g, "/").split("/");
  for (const part of relParts) {
    if (part === "..") baseParts.pop();
    else if (part !== "." && part !== "") baseParts.push(part);
  }
  return baseParts.join("/");
}

// A relative/local image src resolves against the app origin (not the
// filesystem) and 404s; resolve it against the file's folder and hand it to the
// asset protocol. External/data URLs pass through.
function resolveAsset(baseFilePath: string, src?: string): string {
  const cleaned = cleanHref(src || "");
  if (!cleaned || /^(https?:|data:|asset:|blob:|file:|#)/i.test(cleaned)) return cleaned;
  const abs = resolveRelativePath(baseFilePath, cleaned);
  return isTauri ? convertFileSrc(abs) : abs;
}

// react-markdown overrides shared by every place we render a markdown file
// (editor preview, hover preview, card peek): make local images load, and stop
// relative <a>/<img> from navigating the webview away. Pass onOpenPath to make
// internal links open the target in-app; omit it in transient previews.
export function mdAssetComponents(basePath: string, onOpenPath?: (path: string) => void): Components {
  return {
    img: ({ src, alt, node, ...rest }) => (
      <img {...rest} src={resolveAsset(basePath, typeof src === "string" ? src : undefined)} alt={alt ?? ""} style={{ maxWidth: "100%", height: "auto" }} />
    ),
    source: ({ srcSet, node, ...rest }) => (
      <source {...rest} srcSet={resolveAsset(basePath, typeof srcSet === "string" ? srcSet : undefined)} />
    ),
    a: ({ href, children, node, ...rest }) => {
      const raw = href || (node as any)?.properties?.href || (rest as any)?.href || "";
      const cleaned = cleanHref(raw);
      const external = isExternalUrl(cleaned);
      return (
        <a
          {...rest}
          className="md-link"
          href={cleaned}
          target={external ? "_blank" : undefined}
          rel={external ? "noopener noreferrer" : undefined}
          draggable={false}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!cleaned || cleaned.startsWith("#")) return;
            if (external) {
              if (isTauri) api.openUrl(cleaned);
              else window.open(cleaned, "_blank", "noopener,noreferrer");
            } else if (onOpenPath) {
              const target = resolveRelativePath(basePath, cleaned);
              onOpenPath(target);
            }
          }}
        >
          {children}
        </a>
      );
    },
  };
}
