/// <reference types="vite/client" />

/**
 * The application version, injected from `package.json` by `vite.config.ts`.
 *
 * The export manifest records it, so a backup names the build that wrote it
 * (TASK-026).
 */
declare const __APP_VERSION__: string;
