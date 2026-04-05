// Must run before Expo Router / TanStack SQLite persistence (uses `crypto.randomUUID`).
import "./src/polyfills/crypto-native";
// Load Uniwind / Tailwind entry before Router so release bundles initialize the stylesheet early.
import "./src/global.css";
import "expo-router/entry";
