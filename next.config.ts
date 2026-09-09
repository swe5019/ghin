import { readFileSync } from "fs";
import type { NextConfig } from "next";

// Static export for GitHub Pages. Deployed at https://<owner>.github.io/ghin/,
// so paths need the /ghin base path — GITHUB_PAGES=true is set by the deploy workflow.
const basePath = process.env.GITHUB_PAGES === "true" ? "/ghin" : "";

// Written by the prebuild step, which puts the same id in public/version.json. Values
// set here are inlined into the bundle, so a running page can compare what it was built
// from against what the server is now serving and notice it is out of date.
const buildId = (() => {
  try {
    return readFileSync(".build-id", "utf-8").trim();
  } catch {
    return "unknown";
  }
})();

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  assetPrefix: basePath ? `${basePath}/` : undefined,
  images: { unoptimized: true },
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
    NEXT_PUBLIC_BUILD_ID: buildId,
  },
};

export default nextConfig;
