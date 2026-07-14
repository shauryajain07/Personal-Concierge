import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@openai/codex-sdk", "@openai/codex", "pdf-parse"],
};

export default nextConfig;
