/**
 * Domain rule errors (TASK-012).
 *
 * Some operations are refused by the model rather than by storage: a folder
 * cannot be moved inside itself, a name cannot collide with a sibling, nesting
 * cannot exceed the documented depth. Those rules already return `DomainIssue`
 * lists; this error carries the same issues to the caller so a dialog can put
 * each message beside the field that caused it instead of showing one opaque
 * failure.
 */

import type { DomainIssue } from '@/domain/types';

export class RuleViolationError extends Error {
  /** Every issue that blocked the change, in field order. */
  readonly issues: readonly DomainIssue[];

  constructor(issues: readonly DomainIssue[]) {
    const first = issues.find((issue) => issue.severity === 'error') ?? issues[0];
    super(first?.message ?? 'That change is not allowed.');
    this.name = 'RuleViolationError';
    this.issues = [...issues];
  }

  /** The message for one field path, or `undefined` when that field is fine. */
  issueFor(path: string): string | undefined {
    return this.issues.find((issue) => issue.path === path && issue.severity === 'error')?.message;
  }
}
