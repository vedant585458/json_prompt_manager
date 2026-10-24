import { Field, Select, Textarea } from '@/components/ui';
import { revisionsOfPrompt } from '@/features/diff/sources';
import type { DiffSource, DiffSourceKind } from '@/features/diff/sources';
import type { Prompt, PromptRevision } from '@/domain/types';

export interface DiffSourcePickerProps {
  readonly side: 'before' | 'after';
  readonly heading: string;
  readonly source: DiffSource;
  readonly text: string;
  readonly textError: string | null;
  readonly prompts: readonly Prompt[];
  readonly revisions: readonly PromptRevision[];
  readonly onKindChange: (kind: DiffSourceKind) => void;
  readonly onSourceChange: (source: DiffSource) => void;
  readonly onTextChange: (text: string) => void;
}

/**
 * One side of the comparison (TASK-020).
 *
 * The picker chooses *what* is compared, never *whether* it is compared: an
 * unparsable paste is reported on the field and pauses the comparison instead
 * of replacing the screen with an error. Choosing a snapshot asks for the
 * prompt first, then the snapshot, because snapshots belong to prompts and a
 * single list of every snapshot in the library would be unreadable.
 */
export function DiffSourcePicker({
  side,
  heading,
  source,
  text,
  textError,
  prompts,
  revisions,
  onKindChange,
  onSourceChange,
  onTextChange,
}: DiffSourcePickerProps) {
  const activePromptId =
    source.kind === 'prompt'
      ? source.promptId
      : source.kind === 'revision'
        ? source.promptId || undefined
        : undefined;

  const promptOptions = prompts.map((prompt) => ({ value: prompt.id, label: prompt.title }));
  const snapshotOptions = revisionsOfPrompt(revisions, activePromptId).map((revision) => ({
    value: revision.id,
    label: `v${revision.revisionNumber} · ${revision.label ?? 'No label'}`,
  }));

  return (
    <div className="flex min-w-0 flex-col gap-3 rounded-md border border-line bg-surface-1 p-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-2xs font-semibold tracking-[0.14em] text-ink-muted uppercase">
          {heading}
        </h2>
        <span className="text-2xs text-ink-muted">{side === 'before' ? 'older' : 'newer'}</span>
      </div>

      <Field label={`${heading} source`} hint="Stored prompt, one snapshot, or pasted JSON.">
        {(control) => (
          <Select
            {...control}
            value={source.kind}
            options={[
              { value: 'prompt', label: 'Stored prompt' },
              {
                value: 'revision',
                label: 'Snapshot',
                disabled: revisions.length === 0,
              },
              { value: 'text', label: 'Pasted JSON' },
            ]}
            onChange={(event) => onKindChange(event.target.value as DiffSourceKind)}
          />
        )}
      </Field>

      {source.kind === 'prompt' ? (
        <Field label={`${heading} prompt`}>
          {(control) => (
            <Select
              {...control}
              value={source.promptId}
              placeholder={prompts.length === 0 ? 'No prompts stored' : 'Choose a prompt'}
              options={promptOptions}
              disabled={prompts.length === 0}
              onChange={(event) => onSourceChange({ kind: 'prompt', promptId: event.target.value })}
            />
          )}
        </Field>
      ) : null}

      {source.kind === 'revision' ? (
        <>
          <Field label={`${heading} prompt`}>
            {(control) => (
              <Select
                {...control}
                value={activePromptId ?? ''}
                placeholder="Choose a prompt"
                options={promptOptions}
                disabled={prompts.length === 0}
                onChange={(event) =>
                  onSourceChange({ kind: 'prompt', promptId: event.target.value })
                }
              />
            )}
          </Field>

          <Field
            label={`${heading} snapshot`}
            hint={
              snapshotOptions.length === 0
                ? 'This prompt has no snapshots yet. Save one from its editor, then compare.'
                : undefined
            }
          >
            {(control) => (
              <Select
                {...control}
                value={source.revisionId}
                placeholder="Choose a snapshot"
                options={snapshotOptions}
                disabled={snapshotOptions.length === 0}
                onChange={(event) =>
                  onSourceChange({
                    kind: 'revision',
                    revisionId: event.target.value,
                    promptId: activePromptId ?? '',
                  })
                }
              />
            )}
          </Field>
        </>
      ) : null}

      {source.kind === 'text' ? (
        <Field
          label={`${heading} JSON`}
          hint="Parsed with the same scanner as the editor; formatting does not matter."
          error={textError ?? undefined}
        >
          {(control) => (
            <Textarea
              {...control}
              rows={6}
              mono
              value={text}
              placeholder='{ "name": "Draft prompt", "objective": "…" }'
              onChange={(event) => onTextChange(event.target.value)}
            />
          )}
        </Field>
      ) : null}

      {source.kind === 'text' ? (
        <p className="text-2xs leading-relaxed text-ink-warning">
          Pasted JSON stays in this tab only: it is not written to storage and is not part of the
          URL, so reloading clears it.
        </p>
      ) : null}
    </div>
  );
}
