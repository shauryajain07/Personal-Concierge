import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@openai/codex-sdk", "@openai/codex", "pdf-parse"],
  outputFileTracingExcludes: {
    "/*": ["./data/**", "./next.config.ts"],
  },
};

export default nextConfig;
