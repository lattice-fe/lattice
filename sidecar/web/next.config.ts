import type { NextConfig } from "next";

// Built as a static export and served by the FastAPI sidecar on the same origin
// (:8765), so the app's relative /scopes calls hit the API directly — no dev
// proxy/rewrites needed.
const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,
};

export default nextConfig;
