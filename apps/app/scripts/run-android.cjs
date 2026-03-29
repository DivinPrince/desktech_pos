"use strict";

const { spawnSync } = require("node:child_process");
const { existsSync, readFileSync, writeFileSync } = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const appRoot = path.join(__dirname, "..");

function ensureJavaHome() {
  if (process.env.JAVA_HOME) return;

  if (process.platform === "win32") {
    const jbr = "C:\\Program Files\\Android\\Android Studio\\jbr";
    if (existsSync(path.join(jbr, "bin", "java.exe"))) {
      process.env.JAVA_HOME = jbr;
    }
    return;
  }

  if (process.platform === "darwin") {
    const jbr = "/Applications/Android Studio.app/Contents/jbr/Contents/Home";
    if (existsSync(path.join(jbr, "bin", "java"))) {
      process.env.JAVA_HOME = jbr;
    }
  }
}

function defaultAndroidSdkPath() {
  if (process.platform === "win32") {
    const localAppData =
      process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
    return path.join(localAppData, "Android", "Sdk");
  }
  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Android", "sdk");
  }
  return path.join(os.homedir(), "Android", "Sdk");
}

function resolveAndroidSdkPath() {
  const fallback = defaultAndroidSdkPath();
  const custom = process.env.ANDROID_HOME;

  if (custom && existsSync(custom)) {
    return custom;
  }
  if (custom && !existsSync(custom)) {
    console.warn(
      `Warning: ANDROID_HOME="${custom}" does not exist; trying default SDK path.`,
    );
  }
  if (existsSync(fallback)) {
    return fallback;
  }

  console.error(
    "Android SDK not found.\n" +
      "Install Android Studio (SDK Manager) or set ANDROID_HOME to your SDK directory.\n" +
      `Expected default: ${fallback}`,
  );
  process.exit(1);
}

function ensureLocalPropertiesSdkDir(sdkPath) {
  const androidDir = path.join(appRoot, "android");
  const lpPath = path.join(androidDir, "local.properties");
  const sdkDirLine = `sdk.dir=${sdkPath.replace(/\\/g, "/")}`;

  let content = "";
  if (existsSync(lpPath)) {
    content = readFileSync(lpPath, "utf8");
    if (/^sdk\.dir=/m.test(content)) {
      content = content.replace(/^sdk\.dir=.*$/m, sdkDirLine);
    } else {
      content = content.trimEnd() + "\n" + sdkDirLine + "\n";
    }
  } else {
    content = `${sdkDirLine}\n`;
  }

  writeFileSync(lpPath, content, "utf8");
}

ensureJavaHome();

const sdkPath = resolveAndroidSdkPath();
process.env.ANDROID_HOME = sdkPath;
process.env.ANDROID_SDK_ROOT = sdkPath;
ensureLocalPropertiesSdkDir(sdkPath);

const expoPkg = path.dirname(require.resolve("expo/package.json", { paths: [appRoot] }));
const expoCli = path.join(expoPkg, "bin", "cli");

const result = spawnSync(process.execPath, [expoCli, "run:android", ...process.argv.slice(2)], {
  stdio: "inherit",
  cwd: appRoot,
  env: process.env,
  shell: false,
});

process.exit(result.status ?? 1);
