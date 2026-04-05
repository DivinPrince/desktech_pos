// Monorepo-aware defaults (SDK 52+): https://docs.expo.dev/guides/monorepos/
const { getDefaultConfig } = require("expo/metro-config");
const { withUniwindConfig } = require("uniwind/metro");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Uniwind requires relative paths from the app root (not path.resolve). Absolute paths
// break CSS detection in the Metro transformer → no Tailwind / theme on web.
// @see https://docs.uniwind.dev/quickstart — Expo (Metro) / cssEntryFile
module.exports = withUniwindConfig(config, {
  cssEntryFile: "./src/global.css",
  dtsFile: "./src/uniwind-types.d.ts",
});
