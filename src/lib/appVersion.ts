/**
 * Application version, for the export manifest (TASK-026).
 *
 * Injected from `package.json` by `vite.config.ts`, so a backup names the build
 * that wrote it and there is no second copy of the version number to drift. The
 * fallback keeps a bare Node import (a script, a test double) from throwing.
 */
export const APP_VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0-dev';
