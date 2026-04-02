# Desktech mobile app

Expo Router mobile client for Desktech POS.

## Stack

- Expo / React Native
- Expo Router
- HeroUI Native
- Uniwind + Tailwind v4
- Better Auth with Expo SecureStore session persistence
- TanStack Query + TanStack DB
- SQLite persistence on native

## Local development

From the monorepo root, install dependencies with Bun:

```bash
bun install
```

Then from `apps/app`:

### First Android build

```bash
bun run run:android
```

This performs the native prebuild if needed, compiles the Android dev client, and installs Desktech on the emulator/device.

### Daily development

```bash
bun run start:dev
```

Open the already-installed dev client on the device/emulator and connect to Metro.

### Web preview

```bash
bun run web
```

## Important implementation notes

### Auth and onboarding

- Auth state comes from Better Auth `useSession()`.
- Post-login routing is centralized in `src/lib/auth-session.ts`.
- First-time users are routed to `/onboarding` until their first business is created.

### Keyboard-safe forms

- Use `src/components/layout/keyboard-screen.tsx` for form-heavy screens.
- Do **not** rely on Uniwind `className="flex-1"` for:
  - `SafeAreaView`
  - `KeyboardAvoidingView`
  - `ScrollView`
- Use explicit `style={{ flex: 1 }}` or a `StyleSheet` entry instead.

### Offline data

- Native catalog collections persist via SQLite.
- UI should prefer stale-while-revalidate behavior instead of flashing full-page loaders when cached rows already exist.

### Android keyboard behavior

- The app config uses `android.softwareKeyboardLayoutMode = "pan"` to keep focused fields visible in mobile form flows.

## Scripts

- `bun run start:dev` — Expo dev client Metro server
- `bun run run:android` — Android native build + install
- `bun run run:ios` — iOS native build + install
- `bun run web` — web preview
- `bun run lint` — Expo lint

## Assets

Launcher, splash, adaptive icon, and favicon assets live in `assets/images/`.
