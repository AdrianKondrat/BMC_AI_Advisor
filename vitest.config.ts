import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: {
        configPath: "./dist/server/wrangler.json",
      },
    }),
  ],
  test: {
    include: ["tests/**/*.test.ts"],
    passWithNoTests: true,
  },
});
