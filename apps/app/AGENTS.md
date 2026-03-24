# @repo/mobile (`apps/app`)

Expo Router app, HeroUI Native, Uniwind + Tailwind v4 (`src/global.css`).

- **Flex layout / Uniwind:** Do not rely on `className="flex-1"` on `SafeAreaView` from `react-native-safe-area-context`, `KeyboardAvoidingView`, or `ScrollView`. Uniwind often does not apply flex there, which breaks the flex chain (scroll/content height collapses to zero). You may see only `bg-background` and absolutely positioned UI (e.g. a version badge) while the form vanishes. Use `StyleSheet` (e.g. `fill: { flex: 1 }`) or `style={{ flex: 1 }}` on those three; keep `className` for theming on `View`, HeroUI components, and `Text` as usual.
