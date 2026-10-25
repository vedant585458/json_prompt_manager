/**
 * Domain barrel (TASK-005).
 *
 * Import domain code from `@/domain`; the module graph stays inside
 * `src/domain/` and never reaches into React, stores, or storage.
 */

export * from '@/domain/types';
export * from '@/domain/errors';
export * from '@/domain/invariants';
export * from '@/domain/promptDocument';
export * from '@/domain/revisions';
export * from '@/domain/serialization';
export * from '@/domain/factories';
export * from '@/domain/search';
export * from '@/domain/jsonText';
export * from '@/domain/jsonTree';
export * from '@/domain/textDiff';
export * from '@/domain/jsonSchema';
export * from '@/domain/validation';
export * from '@/domain/composer';
export * from '@/domain/diff';
export * from '@/domain/variables';
export * from '@/domain/render';
export * from '@/domain/templates';
export * from '@/domain/renderDiff';
export * from '@/domain/lab';
export * from '@/domain/graph';
export * from '@/domain/health';
export * from '@/domain/transfer/bundle';
export * from '@/domain/transfer/export';
export * from '@/domain/transfer/import';
export * from '@/domain/quality';
