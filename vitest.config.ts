import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";

// ---------------------------------------------------------------------------
// Why these workarounds exist
// ---------------------------------------------------------------------------
// The wrangler.json compiled into dist/server/wrangler.json includes:
//   "rules": [{ "type": "ESModule", "globs": ["**/*.js", "**/*.mjs"] }]
// This propagates into miniflare's modulesRules, which the vitest-pool-workers
// messageWrapper uses to force EVERY .js file — including CJS node_modules files
// like @supabase/auth-js/dist/main/index.js — to be loaded as ESModule.
// When a CJS file runs as ESModule, `exports` is not defined → ReferenceError.
//
// The only files that escape this rule are those with .cjs extension.
// Packages that ship a top-level dist/index.cjs can be aliased directly.
// Packages that ship only dist/main/*.js (auth-js, functions-js, realtime-js, ssr)
// are pre-bundled by esbuild into a flat .cjs file so they can be aliased safely.
// ---------------------------------------------------------------------------

const BUNDLE_DIR = path.join(os.tmpdir(), "vitest-supabase-cjs");
const TO_BUNDLE = ["@supabase/auth-js", "@supabase/functions-js", "@supabase/realtime-js", "@supabase/ssr"];

async function preBundle(): Promise<Record<string, string>> {
  const esbuild = await import("esbuild");
  fs.mkdirSync(BUNDLE_DIR, { recursive: true });

  const aliases: Record<string, string> = {};
  await Promise.all(
    TO_BUNDLE.map(async (pkg) => {
      const slug = pkg.replace(/[@/]/g, "_");
      const outfile = path.join(BUNDLE_DIR, `${slug}.cjs`);
      if (!fs.existsSync(outfile)) {
        await esbuild.build({
          entryPoints: [pkg],
          bundle: true,
          format: "cjs",
          platform: "node",
          outfile,
          logLevel: "silent",
        });
      }
      aliases[pkg] = outfile;
    }),
  );
  return aliases;
}

function supabaseCjsBundlePlugin(): Plugin {
  let aliasesReady: Promise<Record<string, string>> | undefined;

  return {
    name: "supabase-cjs-bundle",
    enforce: "pre",
    buildStart() {
      aliasesReady ??= preBundle();
    },
    async resolveId(id, _importer, _opts) {
      if (!TO_BUNDLE.includes(id)) return;
      const aliases = await aliasesReady;
      return aliases[id];
    },
  };
}

export default defineConfig({
  test: {
    passWithNoTests: true,
    projects: [
      {
        plugins: [
          supabaseCjsBundlePlugin(),
          cloudflareTest({
            wrangler: {
              configPath: "./dist/server/wrangler.json",
            },
          }),
        ],
        resolve: {
          alias: {
            "@supabase/supabase-js": path.resolve("./node_modules/@supabase/supabase-js/dist/index.cjs"),
            "@supabase/storage-js": path.resolve("./node_modules/@supabase/storage-js/dist/index.cjs"),
            "@supabase/postgrest-js": path.resolve("./node_modules/@supabase/postgrest-js/dist/index.cjs"),
          },
        },
        test: {
          name: "workerd",
          globalSetup: ["./tests/global-setup.ts"],
          include: ["tests/integration/**/*.test.ts"],
          passWithNoTests: true,
        },
      },
      {
        resolve: {
          alias: {
            "@": path.resolve("./src"),
          },
        },
        esbuild: {
          jsx: "automatic",
          jsxImportSource: "react",
        },
        test: {
          name: "unit",
          environment: "jsdom",
          setupFiles: ["./tests/unit/setup.ts"],
          include: ["tests/unit/**/*.test.{ts,tsx}"],
          passWithNoTests: true,
        },
      },
    ],
  },
});
