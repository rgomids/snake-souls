// scripts/build.js — esbuild bundler for Snake Souls
// Usage:
//   node scripts/build.js            → single build (development, with sourcemap)
//   node scripts/build.js --watch    → rebuild on file changes
//   NODE_ENV=production node scripts/build.js → minified production build
"use strict";

const esbuild = require("esbuild");
const path    = require("path");

const root      = path.resolve(__dirname, "..");
const isWatch   = process.argv.includes("--watch");
const isProd    = process.env.NODE_ENV === "production";

/** @type {import('esbuild').BuildOptions} */
const config = {
  entryPoints: [path.join(root, "src", "entry.js")],
  bundle:      true,
  platform:    "browser",
  target:      ["es2020"],
  format:      "iife",
  globalName:  "SnakeSouls",
  outfile:     path.join(root, "dist", "bundle.js"),
  sourcemap:   !isProd,
  minify:      isProd,
  logLevel:    "info",
};

async function main() {
  if (isWatch) {
    const ctx = await esbuild.context(config);
    await ctx.watch();
    console.log("[esbuild] watching for changes…  (Ctrl+C to stop)");
  } else {
    const result = await esbuild.build(config);
    if (result.errors.length === 0) {
      console.log(`[esbuild] build complete → dist/bundle.js${isProd ? " (minified)" : " + sourcemap"}`);
    }
  }
}

main().catch((err) => {
  console.error("[esbuild] build failed:", err.message);
  process.exit(1);
});
