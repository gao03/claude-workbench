# Coding Style & Conventions
- TypeScript + React functional components with hooks; state handled via hooks and context rather than class components.
- Tailwind CSS and Radix UI primitives for styling; utility functions consolidated in `src/lib/utils.ts`.
- Prefer type-safe APIs; shared types in `src/types/`. Use `zod` for schema validation where applicable.
- Internationalization handled via `i18next` with locale files under `src/i18n/locales/`; keep text in translation keys.
- Follow existing file structure when adding components (e.g., UI primitives in `src/components/ui`).
- Rust backend adheres to standard Rust formatting; commands defined under `src-tauri/src/`.
