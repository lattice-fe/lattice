export const fmtSize = (b: number, isDir = false) => {
  if (isDir || b <= 0) return "—";
  const u = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(b) / Math.log(1024));
  return `${(b / 1024 ** i).toFixed(i ? 1 : 0)} ${u[i]}`;
};

export const fmtWhen = (ms: number | null) => {
  if (!ms) return "—";
  const s = (Date.now() - ms) / 1000;
  if (s < 90) return "just now";
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  if (s < 172800) return "yesterday";
  if (s < 2592000) return `${Math.round(s / 86400)}d ago`;
  return new Date(ms).toLocaleDateString();
};

export const parentOf = (p: string) => {
  const norm = p.replace(/\\/g, "/").replace(/\/+$/, "");
  const i = norm.lastIndexOf("/");
  if (i <= 0) return norm.match(/^[A-Za-z]:$/) ? null : norm.slice(0, i + 1) || null;
  const parent = norm.slice(0, i);
  return /^[A-Za-z]:$/.test(parent) ? parent + "/" : parent;
};

export const baseName = (p: string) => {
  const norm = p.replace(/\\/g, "/").replace(/\/+$/, "");
  return norm.slice(norm.lastIndexOf("/") + 1) || norm;
};

export const isFilePath = (p: string): boolean => {
  if (!p) return false;
  const name = baseName(p);
  return name.includes(".") && !name.startsWith(".");
};

// breadcrumb segments as [label, fullPath] pairs
export const crumbsOf = (p: string): [string, string][] => {
  const norm = p.replace(/\\/g, "/").replace(/\/+$/, "");
  const parts = norm.split("/").filter(Boolean);
  const out: [string, string][] = [];
  let acc = "";
  parts.forEach((part, i) => {
    acc = i === 0 ? (/^[A-Za-z]:$/.test(part) ? part + "/" : "/" + part) : acc.replace(/\/$/, "") + "/" + part;
    out.push([part, acc]);
  });
  return out;
};
