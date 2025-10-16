# Repository Guidelines

## Project Structure & Module Organization
Source lives in `src/`, split by Chrome contexts: `background/` for the service worker, `content/` for in-page memo logic, `popup/` and `options/` for UI surfaces, and `shared/` for types, storage helpers, and cross-cutting utilities. Static assets, including extension icons, are in `src/assets/`. `manifest.json` defines permissions, while Webpack emits bundled artifacts into `dist/`; avoid editing `dist/` directly.

## Build, Test, and Development Commands
Use `npm install` once to fetch dependencies. Run `npm run dev` for a watch build while iterating; Webpack rebuilds into `dist/`. Execute `npm run build` to produce the production bundle before packaging or review. `npm run type-check` runs `tsc --noEmit` and should stay clean prior to pushing changes.

## Coding Style & Naming Conventions
The project is TypeScript-first with strict compiler settings (`strict`, `noUnusedLocals`, `noImplicitReturns`). Follow the existing 2-space indentation and Prettier-compatible spacing seen in `src/content/MemoManager.ts`. Use `PascalCase` for classes (`MemoManager`), `camelCase` for functions and variables, and `SCREAMING_SNAKE_CASE` for constants in `shared/constants.ts`. Keep DOM manipulations sanitized through `dompurify` utilities when injecting HTML.

## Testing Guidelines
Unit tests are not yet scaffolded; rely on `npm run type-check` and manual verification in Chrome. After building, load the unpacked extension from the `dist/` folder and confirm memo creation, drag/drop, color changes, and storage sync on multiple pages. When adding high-risk logic, author lightweight browser-driven checks (e.g., Playwright) under `src/__tests__/` and document how to run them in the PR.

## Commit & Pull Request Guidelines
Adopt Conventional Commit prefixes (`feat:`, `fix:`, `refactor:`) for clarity in change history. Each PR should include: a concise summary of the change, test notes (`npm run build` / manual scenarios), and screenshots or GIFs for UI-visible updates. Reference related GitHub issues when applicable and call out any manifest permission changes explicitly.

## Security & Configuration Tips
Keep Chrome permissions minimal; review `manifest.json` whenever adding APIs. Treat local storage payloads as untrusted—sanitize user-entered content and re-use helpers in `shared/utils.ts`. Store credentials or API keys outside the repo; prefer environment variables consumed during build steps if integration becomes necessary.
