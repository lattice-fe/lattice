import type { Components } from "react-markdown";
import { convertFileSrc } from "@tauri-apps/api/core";
import { api, isTauri } from "./api";

// Resolve a link/image href that appears inside a markdown file against that
// file's folder. Absolute paths and URLs pass through unchanged.
export function resolveRelativePath(baseFilePath: string, relPath: string): string {
  if (relPath.startsWith("http://") || relPath.startsWith("https://") || relPath.startsWith("mailto:")) {
    return relPath;
  }
  if (/^[a-zA-Z]:[/\\]/.test(relPath) || relPath.startsWith("/")) {
    return relPath;
  }
  const cleanBase = baseFilePath.replace(/\\/g, "/");
  const baseDir = cleanBase.substring(0, cleanBase.lastIndexOf("/"));
  const baseParts = baseDir ? baseDir.split("/") : [];
  const relParts = relPath.replace(/\\/g, "/").split("/");
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
  if (!src || /^(https?:|data:|asset:|blob:|file:|#)/i.test(src)) return src ?? "";
  const abs = resolveRelativePath(baseFilePath, src);
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
      const external = !!href && /^(https?:|mailto:)/i.test(href);
      return (
        <a
          {...rest}
          className="md-link"
          href={href}
          target={external ? "_blank" : undefined}
          rel={external ? "noopener noreferrer" : undefined}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log("[md-link] click", { href, external, hasOnOpenPath: !!onOpenPath, basePath });
            if (!href || href.startsWith("#")) return;
            if (external) {
              if (isTauri) api.openUrl(href);
              else window.open(href, "_blank", "noopener,noreferrer");
            } else if (onOpenPath) {
              const target = resolveRelativePath(basePath, href);
              console.log("[md-link] internal → onOpenPath", target);
              onOpenPath(target);
            } else {
              console.log("[md-link] internal link but NO onOpenPath (transient preview) — no-op");
            }
          }}
        >
          {children}
        </a>
      );
    },
  };
}
