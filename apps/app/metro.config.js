// Monorepo-aware defaults (SDK 52+): https://docs.expo.dev/guides/monorepos/
const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");
const { withUniwindConfig } = require("uniwind/metro");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

module.exports = withUniwindConfig(config, {
  // Absolute paths: uniwind compares `path.join(process.cwd(), cssEntryFile)` to the
  // resolved file path — relative paths break when Expo/Metro’s cwd is the monorepo root.
  cssEntryFile: path.resolve(__dirname, "src/global.css"),
  dtsFile: path.resolve(__dirname, "src/uniwind-types.d.ts"),
});
