# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR. Linting uses [oxlint](https://oxc.rs/docs/guide/usage/linter.html) and formatting uses [oxfmt](https://oxc.rs/docs/guide/usage/formatter.html).

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Lint and format

- `bun run lint` — run oxlint
- `bun run format` — format with oxfmt
- `bun run format:check` — verify formatting (CI-friendly)

Configure rules in `.oxlintrc.json`. See the [oxlint config reference](https://oxc.rs/docs/guide/usage/linter/config-file-reference.html).
