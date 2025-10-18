// build-vendor.mjs
import { build } from "esbuild";

const shared = {
  bundle: true,
  format: "esm",
  sourcemap: false,
  splitting: false,      // ESM unique, compatible MV3
  minify: true,
  target: "es2018",
  legalComments: "none",
  logLevel: "info",
};

await build({
  ...shared,
  entryPoints: ["./1.2.5_0/lightweight-charts.production.mjs"],
  outfile: "vendor/lightweight-charts.bundle.js",
});

await build({
  ...shared,
  entryPoints: ["./1.2.5_0/html2canvas.esm.js"],
  outfile: "vendor/html2canvas.bundle.js",
});

await build({
  ...shared,
  entryPoints: ["./1.2.5_0/+esm.js"],
  outfile: "vendor/+esm.js",
});

console.log("Vendor bundles generated in ./vendor/");
