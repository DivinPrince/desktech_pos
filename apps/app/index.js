// Must run before Expo Router / TanStack SQLite persistence (uses `crypto.randomUUID`).
import "./src/polyfills/crypto-native";
import "expo-router/entry";
