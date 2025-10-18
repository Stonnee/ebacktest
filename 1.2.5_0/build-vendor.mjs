// build-vendor.mjs
import { build } from "esbuild";

const shared = { bundle: true, format: "esm", sourcemap: false, splitting: false,
                 minify: true, target: "es2018", legalComments: "none", logLevel: "info" };

await build({
  ...shared,
  entryPoints: ["./node_modules/lightweight-charts/dist/lightweight-charts.standalone.production.js"],
  outfile: "vendor/lightweight-charts.bundle.js",
});



console.log("Vendor bundles generated in ./vendor/");
