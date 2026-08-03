import type { NextConfig } from "next";

// Static export for GitHub Pages. Deployed at https://<owner>.github.io/ghin/,
// so paths need the /ghin base path — GITHUB_PAGES=true is set by the deploy workflow.
const basePath = process.env.GITHUB_PAGES === "true" ? "/ghin" : "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  assetPrefix: basePath ? `${basePath}/` : undefined,
  images: { unoptimized: true },
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
};

export default nextConfig;
