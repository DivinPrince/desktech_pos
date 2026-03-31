/**
 * Rasterizes Desktech SVG logos into PNGs expected by Expo (app icon, adaptive icon,
 * splash, favicon). Run from repo root: `bun run generate:assets` in apps/app.
 *
 * @see https://docs.expo.dev/develop/user-interface/splash-screen-and-app-icon/
 */
import { readFileSync, unlinkSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = join(__dirname, "..");
const IMG = join(APP_ROOT, "assets", "images");
const WEB = join(IMG, "web");

/** DPI hint for SVG rasterization (higher = sharper downscaling). */
const DENSITY = 450;

/** Must match `viewBox` width/height of `logo.svg` / `logo-on-dark.svg`. */
const LOGO_VIEW_W = 1371;
const LOGO_VIEW_H = 765;

/** Scale factor before center-crop: larger = bigger mark (more edge crop). */
const ZOOM_ICON_SQUARE = 1.38;
const ZOOM_SPLASH = 1.22;
const ZOOM_FAVICON = 1.35;

/**
 * `logo-on-dark.svg` wraps artwork in `scale(1.38)` for legibility.
 * Divide splash zoom by this so light (`logo.svg`) and dark rasterize at the same visual size.
 */
const ON_DARK_EMBEDDED_SCALE = 1.38;

/** Splash PNG size (square); expo-splash-screen `imageWidth` is in dp — wide raster wasted horizontal space and shrinks the mark under `contain`. */
const SPLASH_PX = 960;

/**
 * Wide logo → square PNG: render oversize (preserving aspect), then center-crop.
 * Fixes tiny marks when `fit: contain` letterboxes in a square.
 */
async function logoToSquarePng(
  input,
  outPath,
  size,
  zoom,
  { flatten = null } = {},
) {
  const targetH = Math.round(size * zoom);
  const targetW = Math.round(targetH * (LOGO_VIEW_W / LOGO_VIEW_H));

  const buf = await sharp(input, { density: DENSITY })
    .resize(targetW, targetH, {
      fit: "contain",
      position: "center",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  const meta = await sharp(buf).metadata();
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  const left = Math.max(0, Math.floor((w - size) / 2));
  const top = Math.max(0, Math.floor((h - size) / 2));

  let pipeline =
    w >= size && h >= size
      ? sharp(buf).extract({ left, top, width: size, height: size })
      : sharp(buf).resize(size, size, { fit: "cover", position: "center" });

  if (flatten) {
    pipeline = pipeline.flatten({ background: flatten });
  }

  await pipeline.png().toFile(outPath);
}

async function fromFile(
  svgPath,
  outPath,
  width,
  height,
  options = {},
) {
  const {
    fit = "contain",
    background = { r: 0, g: 0, b: 0, alpha: 0 },
    flatten = null,
  } = options;

  let pipeline = sharp(svgPath, { density: DENSITY }).resize(width, height, {
    fit,
    position: "center",
    background,
  });
  if (flatten) {
    pipeline = pipeline.flatten({ background: flatten });
  }
  await pipeline.png().toFile(outPath);
}

async function fromBuffer(buf, outPath, width, height, options = {}) {
  const {
    fit = "contain",
    background = { r: 0, g: 0, b: 0, alpha: 0 },
    flatten = null,
  } = options;

  let pipeline = sharp(buf, { density: DENSITY }).resize(width, height, {
    fit,
    position: "center",
    background,
  });
  if (flatten) {
    pipeline = pipeline.flatten({ background: flatten });
  }
  await pipeline.png().toFile(outPath);
}

async function main() {
  mkdirSync(WEB, { recursive: true });

  const logoSvg = join(IMG, "logo.svg");
  const onDarkSvg = join(IMG, "logo-on-dark.svg");

  for (const p of [logoSvg, onDarkSvg]) {
    if (!existsSync(p)) {
      throw new Error(`Missing required SVG: ${p}`);
    }
  }

  // App Store / universal icon (1024×1024) — zoomed wordmark on brand cream
  await logoToSquarePng(logoSvg, join(IMG, "icon.png"), 1024, ZOOM_ICON_SQUARE, {
    flatten: "#FFF7ED",
  });

  // Android adaptive foreground (1024×1024, transparent)
  await logoToSquarePng(
    logoSvg,
    join(IMG, "android-icon-foreground.png"),
    1024,
    ZOOM_ICON_SQUARE,
  );

  // Android themed / monochrome icon (single-color glyph on transparent).
  // Use logo.svg (not logo-on-dark.svg): on-dark embeds scale(1.38); combining
  // that with ZOOM_ICON_SQUARE would stack zoom (~1.9×) vs foreground and clip.
  let mono = readFileSync(logoSvg, "utf8");
  mono = mono
    .replace(/fill="#D97706"/g, 'fill="#FFFFFF"')
    .replace(/fill="#292524"/g, 'fill="#FFFFFF"');
  const monoBuf = Buffer.from(mono);
  await logoToSquarePng(
    monoBuf,
    join(IMG, "android-icon-monochrome.png"),
    1024,
    ZOOM_ICON_SQUARE,
  );

  // Splash center image — square so the logo fills width at `imageWidth` dp (no widescreen letterboxing).
  await logoToSquarePng(logoSvg, join(IMG, "splash-icon.png"), SPLASH_PX, ZOOM_SPLASH);
  await logoToSquarePng(
    onDarkSvg,
    join(IMG, "splash-icon-dark.png"),
    SPLASH_PX,
    ZOOM_SPLASH / ON_DARK_EMBEDDED_SCALE,
  );

  // Web favicons — zoomed mark on cream (readable at 16px)
  await logoToSquarePng(logoSvg, join(WEB, "favicon-16.png"), 16, ZOOM_FAVICON, {
    flatten: "#FFF7ED",
  });
  await logoToSquarePng(logoSvg, join(WEB, "favicon-32.png"), 32, ZOOM_FAVICON, {
    flatten: "#FFF7ED",
  });
  await logoToSquarePng(logoSvg, join(WEB, "favicon-48.png"), 48, ZOOM_FAVICON, {
    flatten: "#FFF7ED",
  });
  await logoToSquarePng(logoSvg, join(IMG, "favicon.png"), 48, ZOOM_FAVICON, {
    flatten: "#FFF7ED",
  });

  const legacyBg = join(IMG, "android-icon-background.png");
  if (existsSync(legacyBg)) {
    unlinkSync(legacyBg);
  }

  const reactJunk = [
    "partial-react-logo.png",
    "react-logo.png",
    "react-logo@2x.png",
    "react-logo@3x.png",
  ];
  for (const name of reactJunk) {
    const fp = join(IMG, name);
    if (existsSync(fp)) unlinkSync(fp);
  }

  console.log(
    "Generated: icon.png, android-icon-foreground.png, android-icon-monochrome.png, splash-icon.png, favicon.png, web/favicon-{16,32,48}.png",
  );
  console.log("Removed: android-icon-background.png (use adaptive backgroundColor), React placeholder PNGs.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
