/**
 * Domain barrel (TASK-005).
 *
 * Import domain code from `@/domain`; the module graph stays inside
 * `src/domain/` and never reaches into React, stores, or storage.
 */

export * from '@/domain/types';
export * from '@/domain/invariants';
export * from '@/domain/promptDocument';
export * from '@/domain/serialization';
export * from '@/domain/factories';
