import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache Components stays off for now: nearly every route is authenticated and
  // per-tenant, so we render dynamically. Revisit for marketing pages.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
